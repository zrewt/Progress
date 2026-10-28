-- New, opt-in target-date planning. Apply to real databases only after approval.
-- Existing seasons (including extended backfills), events and plan history are not rewritten.
begin;
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
commit;
