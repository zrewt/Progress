-- ============================================================================
-- Vitality Tree - the four migrations an existing project still needs
-- ============================================================================
-- Use this when supabase/apply_all_stages.sql reports "already exists": the
-- early schema from Stages 1-3 is already in that database, so the full file
-- cannot apply. It contains, in order and in one transaction:
--
--   * 202610270001_target_dates.sql   (goal target date, leg length, stages,
--                                      scaled milestones, accepted weekly detail)
--   * 202610270002_safety.sql         (age bracket, conservative mode, goal
--                                      category, pain handling, signup guard)
--   * 202610280001_midweek_adaptation.sql (owner-only set_lighter_week)
--   * 202610280002_budgets_and_questions.sql (45/60-minute budgets, up to five
--                                      personalization answers)
--
-- If the target-date and safety work is already applied, do NOT run this file:
-- it will abort safely at the first duplicate. Run only the migration whose
-- check below is still 0.
--
-- Check before running. This is read-only and safe:
--
--   select
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='seasons' and column_name='target_date') as target_dates,
--     (select count(*) from information_schema.columns
--       where table_schema='public' and table_name='profiles' and column_name='age_bracket') as safety,
--     (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--       where n.nspname='public' and p.proname='set_lighter_week') as midweek,
--     (select count(*) from pg_constraint
--       where conname='seasons_minutes_budget_check'
--         and pg_get_constraintdef(oid) like '%60%') as longer_budgets;
--
-- All four returning 0 is the expected case for a project that only ran the
-- old four-file setup: paste this whole file once, after a backup.
-- If one already returns 1, that migration was already applied; the whole file
-- will abort safely at its first duplicate rather than half-apply. In that case
-- run only the file whose check is still 0.
--
-- Do not run supabase/schema.sql on production: it contains a destructive
-- legacy pillar cleanup. Generated from the migration files; do not edit by hand.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610270001_target_dates.sql
-- ---------------------------------------------------------------------------
-- New, opt-in target-date planning. Apply to real databases only after approval.
-- Existing seasons (including extended backfills), events and plan history are not rewritten.
alter table public.seasons add column target_date date;
alter table public.seasons add column season_length_days integer check(season_length_days is null or season_length_days between 14 and 112);
alter table public.seasons add constraint target_date_pair check((target_date is null)=(season_length_days is null));
alter table public.seasons add column stages jsonb;
alter table public.seasons add column reality_check jsonb;
-- milestones has UNIQUE(season_id,branch,tier), not UNIQUE(required_days): coincident thresholds already work.
create function private.milestone_threshold(p_length integer,p_cadence text,p_n integer,p_tier integer) returns integer language sql immutable set search_path='' as $$
 select greatest(1,ceil((case when p_cadence='daily' then p_length else ceil(p_length::numeric/7)*p_n end)*(array[0.10,0.25,0.50,0.75])[p_tier])::integer)
$$;

create table public.practice_weeks(
 season_id uuid not null,user_id uuid not null,practice_id uuid not null,effective_week integer not null check(effective_week between 1 and 16),
 title text not null,why text not null,full_variant jsonb not null,easy_variant jsonb not null,
 source text not null check(source in ('ai','local')),accepted_at timestamptz not null default now(),
 foreign key(practice_id,season_id,user_id) references public.practices(id,season_id,user_id) on delete cascade,
 primary key(practice_id,effective_week)
);
alter table public.practice_weeks enable row level security;
create policy week_owner_read on public.practice_weeks for select to authenticated using(user_id=auth.uid());
revoke all on public.practice_weeks from public,anon,authenticated;
grant select on public.practice_weeks to authenticated;

create or replace function private.install_practices(s public.seasons,p jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; pid uuid; i integer:=0; t integer; cfg integer[]; n integer;
begin
 select milestone_days into cfg from private.progression_config;
 for item in select value from jsonb_array_elements(p->'practices') loop
  insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
  values(s.id,s.user_id,item->>'branch',item->>'title',item->>'why',item->>'role',item->>'cadence',(item->>'cadence_n')::integer,item->'full_variant',item->'easy_variant',i) returning id into pid;
  for t in 1..4 loop
   n:=case when s.season_length_days is null then least(cfg[t],s.ends_on-s.started_on) else private.milestone_threshold(s.season_length_days,item->>'cadence',(item->>'cadence_n')::integer,t) end;
   insert into public.milestones(season_id,user_id,branch,tier,title,practice_id,required_days)
   values(s.id,s.user_id,item->>'branch',t,(array['Seed','Root','Branch','Canopy'])[t],pid,n);
  end loop;
  i:=i+1;
 end loop;
end $$;

create or replace function public.start_next_season(p_plan jsonb,p_timezone text,p_display_name text default null,p_previous_status text default 'completed') returns uuid language plpgsql security definer set search_path='' as $$
declare s public.seasons; dt date; target date; leg integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform private.validate_plan(p_plan);
 perform public.update_preferences(p_timezone,p_display_name);
 perform 1 from public.profiles where id=auth.uid() for update;
 if p_previous_status not in ('completed','archived') then raise exception 'Invalid season status'; end if;
 dt:=(now() at time zone p_timezone)::date;
 if p_plan->>'target_date' is not null or p_plan->>'season_length_days' is not null then
  target:=(p_plan->>'target_date')::date; leg:=(p_plan->>'season_length_days')::integer;
  if target is null or leg is null or leg not between 14 and 112 or target<dt+14 or leg<>least(target-dt,112) then raise exception 'Invalid target date or planning leg'; end if;
 end if;
 update public.seasons set status=p_previous_status,ended_at=now() where user_id=auth.uid() and status='active';
 insert into public.seasons(user_id,goal,identity,blocker,minutes_budget,started_on,ends_on,target_date,season_length_days,plan_version,plan_source,plan_summary,safety_note,branch_labels,stages,reality_check)
 values(auth.uid(),p_plan->>'goal',p_plan->>'identity',p_plan->>'blocker',(p_plan->>'minutes_budget')::integer,dt,dt+coalesce(leg,30),target,leg,1,p_plan->>'plan_source',p_plan->>'plan_summary',p_plan->>'safety_note',p_plan->'branch_labels',p_plan->'stages',p_plan->'reality_check') returning * into s;
 perform private.install_practices(s,p_plan);
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,auth.uid(),1,p_plan);
 update public.profiles set blocker=s.blocker where id=auth.uid();
 return s.id;
end $$;

-- Existing replacement RPCs also insert milestones: enforce the same rule for every new-plan insertion.
create function private.scale_new_milestone() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.seasons; p public.practices;
begin
 select * into s from public.seasons where id=new.season_id;
 if s.season_length_days is not null then
  select * into p from public.practices where id=new.practice_id;
  new.required_days:=private.milestone_threshold(s.season_length_days,p.cadence,p.cadence_n,new.tier);
 end if;
 return new;
end $$;
create trigger scale_new_milestone before insert on public.milestones for each row execute function private.scale_new_milestone();

-- Existing plan edits already call install_practices, so creation and editing share thresholds.
create function private.apply_outline() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.snapshot ? 'stages' then update public.seasons set stages=new.snapshot->'stages',reality_check=new.snapshot->'reality_check' where id=new.season_id and user_id=new.user_id; end if;
 return new;
end $$;
create trigger apply_outline after insert on public.plan_versions for each row execute function private.apply_outline();

create function private.validate_week_variant(v jsonb,cap integer,easy boolean) returns void language plpgsql set search_path='' as $$
begin
 if v is null or jsonb_typeof(v)<>'object' or not(v ?& array['title','minutes','steps']) or jsonb_typeof(v->'title')<>'string' or length(trim(v->>'title')) not between 3 and 80
 or (v->>'minutes')::integer not between 1 and least(cap,case when easy then 2 else cap end) or jsonb_typeof(v->'steps')<>'array' or jsonb_array_length(v->'steps') not between 1 and 5 then raise exception 'Invalid weekly variant'; end if;
 if exists(select 1 from jsonb_array_elements(v->'steps') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 180) then raise exception 'Invalid weekly steps'; end if;
end $$;

-- Stable practice identities preserve milestone counts. Only append detail and snapshots.
create function public.accept_practice_week(p_season_id uuid,p_draft jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; p public.practices; x jsonb; w integer; current_week integer; dt date; old_minutes integer; cap integer; n integer; source text; v integer;
begin
 if u is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found or s.status<>'active' or s.season_length_days is null then raise exception 'Season unavailable'; end if;
 select (now() at time zone timezone)::date into dt from public.profiles where id=u;
 current_week:=(dt-s.started_on)/7+1; w:=(p_draft->>'effective_week')::integer;
 if dt>=s.ends_on or w<2 or w<>current_week or s.started_on+(w-1)*7>=s.ends_on then raise exception 'Checkpoint unavailable'; end if;
 if (p_draft->>'expected_version')::integer is distinct from s.plan_version then raise exception 'Plan changed on another device; refresh'; end if;
 source:=p_draft->>'source';
 if source is null or source not in ('ai','local') then raise exception 'Invalid source'; end if;
 if source='ai' and not exists(select 1 from public.profiles where id=u and ai_consent_at is not null and ai_consent_version='2026-10-ai-3') then raise exception 'AI consent required'; end if;
 if jsonb_typeof(p_draft->'practices')<>'array' then raise exception 'Invalid detail'; end if;
 select count(*) into n from public.practices where season_id=s.id and active;
 if jsonb_array_length(p_draft->'practices')<>n then raise exception 'Incomplete detail'; end if;
 if (select count(distinct entry.value->>'practice_id') from jsonb_array_elements(p_draft->'practices') entry)<>n then raise exception 'Duplicate practice'; end if;
 for x in select value from jsonb_array_elements(p_draft->'practices') loop
  select * into p from public.practices where id=(x->>'practice_id')::uuid and season_id=s.id and user_id=u and active;
  if not found then raise exception 'Practice unavailable'; end if;
  if exists(select 1 from public.practice_weeks where practice_id=p.id and effective_week=w) then raise exception 'Week already accepted'; end if;
  select (full_variant->>'minutes')::integer into old_minutes from public.practice_weeks where practice_id=p.id and effective_week<w order by effective_week desc limit 1;
  if old_minutes is null then old_minutes:=coalesce((p.full_variant->'ladder'->0->>'minutes')::integer,(p.full_variant->>'minutes')::integer); end if;
  -- Duration only, not a measure or guarantee of difficulty.
  cap:=least(s.minutes_budget,floor(old_minutes+greatest(2,old_minutes*0.2))::integer);
  perform private.validate_week_variant(x->'full_variant',cap,false);
  perform private.validate_week_variant(x->'easy_variant',s.minutes_budget,true);
  if jsonb_typeof(x->'title')<>'string' or length(trim(x->>'title')) not between 3 and 80 or jsonb_typeof(x->'why')<>'string' or length(trim(x->>'why')) not between 3 and 280 then raise exception 'Invalid detail text'; end if;
  insert into public.practice_weeks(season_id,user_id,practice_id,effective_week,title,why,full_variant,easy_variant,source) values(s.id,u,p.id,w,x->>'title',x->>'why',x->'full_variant',x->'easy_variant',source);
 end loop;
 v:=s.plan_version+1;
 update public.seasons set plan_version=v,plan_source=case when plan_source=source then source else 'mixed' end,plan_source_verified=true where id=s.id;
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,u,v,p_draft||jsonb_build_object('kind','accepted_week','plan_source',case when s.plan_source=source then source else 'mixed' end));
 return v;
end $$;

create or replace function public.submit_weekly_review(p_season_id uuid,p_week_start date,p_difficulty integer,p_note text default null,p_apply boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; practiced integer; adherence numeric; verdict text; rid uuid; denominator integer; dt date;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_difficulty is null or p_difficulty not between 1 and 5 then raise exception 'Invalid difficulty'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found or p_week_start<s.started_on or p_week_start>=s.ends_on then raise exception 'Week outside the season'; end if;
 denominator:=case when s.season_length_days is null then 7 else least(7,s.ends_on-p_week_start) end;
 select (now() at time zone timezone)::date into dt from public.profiles where id=u;
 if s.season_length_days is not null and ((p_week_start-s.started_on)%7<>0 or dt<p_week_start+denominator) then raise exception 'Review not due'; end if;
 select count(distinct local_date) into practiced from public.completion_events where user_id=u and season_id=s.id and kind in ('full','easy') and undone_at is null and local_date>=p_week_start and local_date<p_week_start+denominator;
 adherence:=least(1,greatest(0,practiced::numeric/denominator));
 verdict:=case when adherence<0.5 or p_difficulty>=4 then 'lighter' when adherence>=0.85 and p_difficulty<=2 then 'harder' else 'same' end;
 insert into public.weekly_reviews(user_id,season_id,week_start,difficulty,note,adherence,decision,applied_at) values(u,s.id,p_week_start,p_difficulty,nullif(trim(p_note),''),adherence,verdict,case when p_apply then now() else null end)
 on conflict(user_id,season_id,week_start) do update set difficulty=excluded.difficulty,note=excluded.note,adherence=excluded.adherence,decision=excluded.decision,applied_at=excluded.applied_at returning id into rid;
 if p_apply then update public.seasons set week_mode=case when verdict='lighter' then 'lighter' else 'same' end,week_mode_until=case when verdict='lighter' then least(p_week_start+13,s.ends_on-1) else null end where id=s.id; end if;
 return jsonb_build_object('review',(select to_jsonb(r) from public.weekly_reviews r where r.id=rid),'adherence',adherence,'decision',verdict);
end $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.accept_practice_week(uuid,jsonb) from public,anon;
grant execute on function public.accept_practice_week(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610270002_safety.sql
-- ---------------------------------------------------------------------------
-- New safety data only; no backfill or rewrite of existing history. NOT applied remotely.
alter table public.profiles add column age_bracket text check(age_bracket in ('13_17','18_plus'));
alter table public.profiles add column conservative_mode boolean not null default false;
alter table public.seasons add column goal_category text check(goal_category in ('ordinary','physical','high-risk'));
alter table public.seasons add column conservative_mode boolean not null default false;
alter table public.seasons add column progression_paused boolean not null default false;
alter table public.completion_events add column something_hurt boolean not null default false;

-- New signups must declare an eligible bracket. Existing users are not rewritten.
create function private.check_signup_age() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.raw_user_meta_data->>'age_bracket' is null or new.raw_user_meta_data->>'age_bracket' not in ('13_17','18_plus') then raise exception 'An eligible age bracket is required'; end if;
 return new;
end $$;
create trigger check_signup_age before insert on auth.users for each row execute function private.check_signup_age();
create function private.store_signup_age() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,age_bracket,conservative_mode) values(new.id,new.raw_user_meta_data->>'age_bracket',new.raw_user_meta_data->>'age_bracket'='13_17')
 on conflict(id) do update set age_bracket=excluded.age_bracket,conservative_mode=public.profiles.conservative_mode or excluded.conservative_mode;
 return new;
end $$;
create trigger store_signup_age after insert on auth.users for each row execute function private.store_signup_age();
create function public.set_age_bracket(p_bracket text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_bracket is null or p_bracket not in ('13_17','18_plus') then raise exception 'An eligible age bracket is required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.profiles where id=auth.uid() and age_bracket is not null and age_bracket<>p_bracket) then raise exception 'Age bracket already recorded'; end if;
 insert into public.profiles(id,age_bracket,conservative_mode) values(auth.uid(),p_bracket,p_bracket='13_17')
 on conflict(id) do update set age_bracket=excluded.age_bracket,conservative_mode=public.profiles.conservative_mode or excluded.conservative_mode;
end $$;

create function private.goal_category(goal text) returns text language sql immutable set search_path='' as $$
 select case
 when lower(goal) ~ '\m(build|make|create|design|write|develop|launch)\M' and lower(goal) ~ '\m(app|website|book|novel|podcast|software|game)\M' and lower(goal) !~ '\m(and|also|then)\M' then 'ordinary'
 when lower(goal) ~ '\m(climb[a-z]*|mountaineer[a-z]*|matterhorn|everest|div(e|es|er|ers|ing)|scuba|ultramarathon|ultra-endurance|triathlon|ironman|marathon|skydiv[a-z]*|parachut[a-z]*|base jump[a-z]*)\M' then 'high-risk'
 when lower(goal) ~ '\m(run[a-z]*|jog[a-z]*|walk[a-z]*|tennis|swim[a-z]*|cycl[a-z]*|bike|fitness|exercise|workout|strength|lift[a-z]*|sport[a-z]*|football|soccer|basketball|hike|hiking|yoga|gym)\M' then 'physical'
 else 'ordinary' end
$$;
create function private.season_safety() returns trigger language plpgsql security definer set search_path='' as $$
declare bracket text; conservative boolean;
begin
 select age_bracket,conservative_mode into bracket,conservative from public.profiles where id=new.user_id;
 new.goal_category:=private.goal_category(new.goal);
 new.conservative_mode:=new.conservative_mode or coalesce(conservative,false) or new.goal_category='high-risk';
 if tg_op='UPDATE' then new.conservative_mode:=new.conservative_mode or old.conservative_mode; end if;
 return new;
end $$;
create trigger season_safety before insert or update of goal on public.seasons for each row execute function private.season_safety();
create function private.apply_plan_safety() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((new.snapshot->>'conservative_mode')::boolean,false) then update public.seasons set conservative_mode=true where id=new.season_id and user_id=new.user_id; end if;
 return new;
end $$;
create trigger apply_plan_safety after insert on public.plan_versions for each row execute function private.apply_plan_safety();

-- Store only a boolean pain flag, not a medical answer or a diagnosis. A skipped event earns no growth.
create function public.record_pain(p_season_id uuid,p_practice_id uuid,p_client_event_id uuid,p_occurred_at timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; event_id uuid;
begin
 if exists(select 1 from public.completion_events where user_id=auth.uid() and client_event_id=p_client_event_id and something_hurt) then
  return jsonb_build_object('event',(select to_jsonb(e) from public.completion_events e where user_id=auth.uid() and client_event_id=p_client_event_id),'progress',public.get_progress(p_season_id),'credited',false);
 end if;
 result:=public.complete_practice(p_season_id,p_practice_id,'skipped',p_client_event_id,p_occurred_at);
 event_id:=(result->'event'->>'id')::uuid;
 update public.completion_events set something_hurt=true where id=event_id and user_id=auth.uid() and kind='skipped';
 update public.seasons set progression_paused=true where id=p_season_id and user_id=auth.uid();
 if not exists(select 1 from public.completion_events where id=event_id and user_id=auth.uid() and kind='skipped' and something_hurt) then raise exception 'Pain event must be a skipped practice'; end if;
 return jsonb_set(result,'{event,something_hurt}','true'::jsonb);
end $$;
-- New age data is unavailable for legacy accounts until they confirm it in the app.
-- Keep those accounts usable; server signup enforcement applies to every new account.
create function private.pain_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='full' and exists(select 1 from public.seasons where id=new.season_id and progression_paused) then raise exception 'Use the easy version after something hurt'; end if;
 if new.kind='easy' then update public.seasons set progression_paused=false where id=new.season_id; end if;
 return new;
end $$;
create trigger pain_guard before insert on public.completion_events for each row execute function private.pain_guard();
create function private.pause_week_progression() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.seasons where id=new.season_id and progression_paused) then raise exception 'Progression is paused after something hurt'; end if;
 return new;
end $$;
create trigger pause_week_progression before insert on public.practice_weeks for each row execute function private.pause_week_progression();
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.set_age_bracket(text),public.record_pain(uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.set_age_bracket(text),public.record_pain(uuid,uuid,uuid,timestamptz) to authenticated;
notify pgrst,'reload schema';

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610280001_midweek_adaptation.sql
-- ---------------------------------------------------------------------------
-- Mid-week adaptation: the fixed-rule offer to make the next seven days lighter.
-- New function only; no table, column or row is rewritten by this migration.
-- NOT applied remotely. Run after explicit approval, like every earlier stage.

/*
 * The weekly review can already turn the lighter mode on. This is the same
 * state, reached from the mid-week offer instead: it exists so three hard
 * practice ratings can lower the load without inventing a review for a week
 * that has not finished, and without letting the client write seasons directly.
 *
 * The window starts today because `seasons` records only an end date for the
 * lighter mode; there is no column for a future start, and inventing one would
 * be a larger change than this offer needs. The seven days end at the leg
 * boundary at the latest, so the last day of a season is never extended.
 */
create function public.set_lighter_week(p_season_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.seasons; local_today date;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into s from public.seasons where id=p_season_id and user_id=auth.uid() for update;
 if not found then raise exception 'Season not found'; end if;
 if s.status<>'active' then raise exception 'Season is not active'; end if;
 local_today:=(now() at time zone coalesce((select timezone from public.profiles where id=s.user_id),'UTC'))::date;
 update public.seasons
    set week_mode='lighter',
        week_mode_until=least(greatest(local_today,s.started_on)+6,s.ends_on-1)
  where id=s.id;
end $$;

revoke all on function public.set_lighter_week(uuid) from public,anon;
grant execute on function public.set_lighter_week(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610280002_budgets_and_questions.sql
-- ---------------------------------------------------------------------------
-- Longer daily sessions and up to five personalization answers.
-- Backward compatible: existing 5/15/30 plans and up to three answers stay valid.
-- Rollback: restore the previous constraint and the previous function bodies.

-- 45 and 60 minute sessions are needed for goals that cannot be done in half an
-- hour (a long ride, a full lesson, a deep work block). Keep this list in step
-- with src/lib/plans/index.ts, src/lib/pillars.ts, src/lib/safety.ts and the
-- Edge Function's allow-list.
alter table public.seasons drop constraint if exists seasons_minutes_budget_check;
alter table public.seasons add constraint seasons_minutes_budget_check check (minutes_budget in (5, 15, 30, 45, 60));

-- Same validator as v1, with the wider budget list.
create or replace function private.validate_plan_v1(p jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; v jsonb; budget integer; n integer:=0;
begin
 if p is null or jsonb_typeof(p)<>'object' or not(p ?& array['goal','identity','blocker','minutes_budget','plan_source','plan_summary','safety_note','branch_labels','practices']) or jsonb_typeof(p->'practices')<>'array' then raise exception 'Incomplete plan'; end if;
 budget:=(p->>'minutes_budget')::integer;
 if budget not in (5,15,30,45,60) or length(p->>'goal') not between 3 and 140 or p->>'plan_source' not in ('ai','local') or p->>'identity' not in ('creator','athlete','scholar','builder') then raise exception 'Invalid plan'; end if;
 if jsonb_array_length(p->'practices') not between 1 and 4 then raise exception 'Choose one main practice'; end if;
 if length(p->>'plan_summary')>500 or length(p->>'safety_note')>500 then raise exception 'Plan text too long'; end if;
 for item in select value from jsonb_array_elements(p->'practices') loop
 if not(item ?& array['branch','title','why','role','cadence','cadence_n','full_variant','easy_variant']) or item->>'branch' not in ('body','mind','craft','connection') then raise exception 'Incomplete practice'; end if;
 if item->>'role'='primary' then n:=n+1; if item->>'cadence'<>'daily' then raise exception 'Primary practice must be daily'; end if;
 elsif item->>'role'<>'supporting' or item->>'cadence'<>'weekly' then raise exception 'Supporting practice must be weekly'; end if;
 if length(item->>'title') not between 1 and 80 or length(item->>'why') not between 1 and 280 then raise exception 'Invalid practice text'; end if;
 foreach v in array array[item->'full_variant',item->'easy_variant'] loop
 if v is null or jsonb_typeof(v)<>'object' or not(v ?& array['title','minutes','steps']) or length(v->>'title') not between 1 and 80 or (v->>'minutes')::integer not between 1 and budget or jsonb_typeof(v->'steps')<>'array' or jsonb_array_length(v->'steps') not between 1 and 5 then raise exception 'Invalid variant'; end if;
 if exists(select 1 from jsonb_array_elements_text(v->'steps') step where length(step) not between 1 and 280) then raise exception 'Invalid steps'; end if;
 end loop;
 if (item->'easy_variant'->>'minutes')::integer>2 then raise exception 'Easy practice must fit two minutes'; end if;
 end loop;
 if n<>1 then raise exception 'Choose one main practice'; end if;
end $$;

-- Same wrapper as before, with the answer limit raised from three to five.
create or replace function private.validate_plan(p jsonb) returns void language plpgsql set search_path='' as $$
declare x jsonb; item jsonb;
begin
 if p->>'plan_source' not in ('ai','local','mixed','unknown') then raise exception 'Invalid plan source'; end if;
 x:=coalesce(p->'personalization_context','[]'::jsonb);
 if jsonb_typeof(x)<>'array' or jsonb_array_length(x)>5 then raise exception 'Invalid personalization context'; end if;
 for item in select value from jsonb_array_elements(x) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
    or length(trim(item->>'question')) not between 1 and 140 or length(trim(item->>'answer')) not between 1 and 160
    then raise exception 'Invalid personalization answer'; end if;
 end loop;
 perform private.validate_plan_v1(case when p->>'plan_source' in ('mixed','unknown') then jsonb_set(p,'{plan_source}','"ai"'::jsonb) else p end);
end $$;

-- The user-facing editor must accept the same five answers the prompts now ask.
create or replace function public.set_personalization_context(p_season_id uuid,p_context jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); item jsonb;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_context is null or jsonb_typeof(p_context)<>'array' or jsonb_array_length(p_context)>5 then raise exception 'Invalid personalization context'; end if;
 for item in select value from jsonb_array_elements(p_context) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
    or length(trim(item->>'question')) not between 1 and 140 or length(trim(item->>'answer')) not between 1 and 160
    then raise exception 'Invalid personalization answer'; end if;
 end loop;
 update public.seasons set personalization_context=p_context where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 update public.plan_versions set snapshot=snapshot-'personalization_context' where season_id=p_season_id and user_id=u;
end $$;

notify pgrst,'reload schema';
commit;
