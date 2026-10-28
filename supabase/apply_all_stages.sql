-- ============================================================================
-- Vitality Tree - complete database setup (every stage, all 10 migrations)
-- ============================================================================
-- One paste for a project that has not applied any of the new schema yet.
--
--   * This is every file in supabase/migrations/ in filename order, merged into
--     one transaction. If any statement fails, everything rolls back and your
--     database is exactly as it was. Nothing is half-applied.
--   * Run it ONCE, on a project that still has the original profiles/nodes
--     tables, after a verified backup.
--   * If a project has ALREADY applied some of these migrations, do not run this
--     whole file. The first "already exists" aborts the transaction (safe, but
--     nothing is applied). Apply only the newer migration files instead.
--   * Do not run supabase/schema.sql on production: it contains a destructive
--     legacy pillar cleanup.
--   * Generated from the migration files; if they change, regenerate this file.
--     A test fails when it drifts, and another applies it to an empty database.
--
-- Section order matters: the first creates the tables and functions, the second
-- converts each existing account into a first season (DML), and the rest add
-- target dates, safety, mid-week adaptation, and longer sessions with up to
-- five personalization answers.
-- ============================================================================



begin;

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610250001_daily_loop.sql
-- ---------------------------------------------------------------------------
-- Stage 1. Apply only after explicit production approval and a database backup.
-- Rollback: restore old app + grants/policies from the baseline schema WITHOUT its destructive DELETE.
-- Keep new tables/history intact; never DROP them to roll back a client release.
create schema if not exists private;
revoke all on schema private from public;
create table private.progression_config (
  singleton boolean primary key default true check (singleton),
  xp_per_completion integer not null default 10,
  xp_per_level integer not null default 200,
  milestone_days integer[] not null default array[3,7,14,21],
  rest_days_per_week integer not null default 2
);
insert into private.progression_config default values;
alter table public.profiles add column timezone text not null default 'UTC';
alter table public.profiles add column blocker text;
alter table public.profiles add column ai_consent_version text;
alter table public.profiles add column ai_consent_at timestamptz;

create table public.seasons (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 goal text not null check(length(goal) between 3 and 140), identity text not null check(identity in ('creator','athlete','scholar','builder')),
 blocker text not null, minutes_budget integer not null check(minutes_budget in (5,15,30)),
 started_on date not null, ends_on date not null, status text not null default 'active' check(status in ('active','completed','archived')),
 plan_version integer not null default 1 check(plan_version>0), plan_source text not null check(plan_source in ('ai','local')),
 plan_summary text not null, safety_note text not null, branch_labels jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), ended_at timestamptz, check(ends_on>started_on), unique(id,user_id)
);
create unique index one_active_season on public.seasons(user_id) where status='active';
create table public.practices (
 id uuid primary key default gen_random_uuid(), season_id uuid not null, user_id uuid not null references auth.users on delete cascade,
 branch text not null check(branch in ('body','mind','craft','connection')), title text not null, why text not null,
 role text not null check(role in ('primary','supporting')), cadence text not null check(cadence in ('daily','weekly')),
 cadence_n integer not null default 1 check(cadence_n between 1 and 7),
 full_variant jsonb not null, easy_variant jsonb not null, active boolean not null default true,
 replaced_by uuid references public.practices(id), retired_at timestamptz, sort_order integer not null,
 foreign key(season_id,user_id) references public.seasons(id,user_id) on delete cascade, unique(id,season_id,user_id)
);
create table public.milestones (
 id uuid primary key default gen_random_uuid(), season_id uuid not null, user_id uuid not null references auth.users on delete cascade,
 branch text not null check(branch in ('body','mind','craft','connection')), tier integer not null check(tier between 1 and 4), title text not null,
 practice_id uuid not null, required_days integer not null check(required_days>0), unlocked_at timestamptz,
 foreign key(practice_id,season_id,user_id) references public.practices(id,season_id,user_id) on delete cascade,
 unique(season_id,branch,tier)
);
create table public.completion_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 season_id uuid not null, practice_id uuid, client_event_id uuid not null,
 kind text not null check(kind in ('full','easy','skipped','rest')), occurred_at timestamptz not null, local_date date not null,
 minutes_actual integer check(minutes_actual between 0 and 1440), effort integer check(effort between 1 and 5),
 note text check(length(note)<=280), undone_at timestamptz, created_at timestamptz not null default now(),
 source text not null default 'app' check(source in ('app','migrated')), date_inferred boolean not null default false,
 foreign key(season_id,user_id) references public.seasons(id,user_id) on delete cascade,
 foreign key(practice_id,season_id,user_id) references public.practices(id,season_id,user_id),
 check((kind='rest' and practice_id is null) or (kind<>'rest' and practice_id is not null)), unique(user_id,client_event_id)
);
create unique index one_count_per_practice_day on public.completion_events(user_id,practice_id,local_date) where kind in ('full','easy') and undone_at is null;
create unique index one_rest_per_day on public.completion_events(user_id,local_date) where kind='rest' and undone_at is null;
create index events_user_date on public.completion_events(user_id,local_date);
create table public.legacy_xp_grants (
 user_id uuid primary key references auth.users on delete cascade, xp integer not null check(xp>=0), created_at timestamptz not null default now()
);
create table public.plan_versions (
 season_id uuid not null references public.seasons on delete cascade, user_id uuid not null references auth.users on delete cascade,
 version integer not null, snapshot jsonb not null, created_at timestamptz not null default now(), primary key(season_id,version)
);
create table private.event_receipts (
 user_id uuid not null references auth.users on delete cascade, client_event_id uuid not null,
 event_id uuid not null references public.completion_events on delete cascade, primary key(user_id,client_event_id)
);
-- RLS plus privilege revocation: ownership alone does not permit ledger/reward writes.
do $$ declare t text; begin
 foreach t in array array['seasons','practices','milestones','completion_events','legacy_xp_grants','plan_versions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
revoke all on public.profiles,public.nodes from anon,authenticated;
-- Column grants may survive a table REVOKE; explicitly revoke legacy progress grants.
revoke insert(level,xp,streak,last_completed_date), update(level,xp,streak,last_completed_date) on public.profiles from anon,authenticated;
grant select on public.profiles,public.nodes to authenticated;
drop policy if exists profiles_owner_all on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists nodes_owner_all on public.nodes;
create policy node_read on public.nodes for select to authenticated using(user_id=auth.uid());

create function public.update_preferences(p_timezone text, p_display_name text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid timezone'; end if;
 insert into public.profiles(id,timezone,display_name) values(auth.uid(),p_timezone,left(p_display_name,80))
 on conflict(id) do update set timezone=excluded.timezone, display_name=coalesce(excluded.display_name,public.profiles.display_name);
end $$;

create function public.get_progress(p_season_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); total integer; sxp integer; cur integer:=0; best integer:=0; n integer:=0; prev date; d record; tz text; today date; growth jsonb; unlocked jsonb;
begin
 if u is null or not exists(select 1 from public.seasons where id=p_season_id and user_id=u) then raise exception 'Season unavailable'; end if;
 select timezone into tz from public.profiles where id=u;
 today:=(now() at time zone tz)::date;
 select coalesce(sum(case when source='app' then 1 else 0 end),0)*(select xp_per_completion from private.progression_config)
 into total from public.completion_events where user_id=u and kind in ('full','easy') and undone_at is null;
 total:=total+coalesce((select xp from public.legacy_xp_grants where user_id=u),0);
 select count(*)*(select xp_per_completion from private.progression_config) into sxp from public.completion_events where user_id=u and season_id=p_season_id and source='app' and kind in ('full','easy') and undone_at is null;
 for d in
 with days as(select local_date,bool_or(kind in ('full','easy')) practiced,bool_or(kind='rest') rested from public.completion_events where user_id=u and undone_at is null and kind in ('full','easy','rest') and local_date<=today group by local_date)
 select a.*,(select count(*) from days b where b.rested and not b.practiced and b.local_date between a.local_date-6 and a.local_date) rest_count from days a order by local_date
 loop
 if d.practiced then n:=case when prev=d.local_date-1 then n+1 else 1 end;
 elsif d.rest_count<=(select rest_days_per_week from private.progression_config) and prev=d.local_date-1 and n>0 then n:=n+1;
 else n:=0; end if;
 best:=greatest(best,n); prev:=d.local_date;
 end loop;
 if prev>=today-1 then cur:=n; end if;
 select jsonb_object_agg(b,coalesce(c,0)) into growth from unnest(array['body','mind','craft','connection']) b left join(
 select p.branch,count(distinct e.local_date) c from public.completion_events e join public.practices p on p.id=e.practice_id where e.user_id=u and e.season_id=p_season_id and e.kind in ('full','easy') and e.undone_at is null group by p.branch) q on q.branch=b;
 select coalesce(jsonb_agg(m.id),'[]'::jsonb) into unlocked from public.milestones m where m.user_id=u and m.season_id=p_season_id and (
 select count(distinct local_date) from public.completion_events e where e.user_id=u and e.practice_id=m.practice_id and e.kind in ('full','easy') and e.undone_at is null)>=m.required_days;
 return jsonb_build_object('xp',total,'season_xp',sxp,'level',total/(select xp_per_level from private.progression_config)+1,'current_streak',cur,'best_streak',best,
 'practiced_days',(select count(distinct local_date) from public.completion_events where user_id=u and season_id=p_season_id and kind in ('full','easy') and undone_at is null),'branch_growth',growth,'unlocked_milestones',unlocked);
end $$;

create function public.complete_practice(p_season_id uuid,p_practice_id uuid,p_kind text,p_client_event_id uuid,p_occurred_at timestamptz,p_minutes_actual integer default null,p_effort integer default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); tz text; dt date; s public.seasons; old public.completion_events; eid uuid;
begin
 if u is null then raise exception 'Sign in required'; end if;
 -- Per-user serialization covers idempotency, undo and simultaneous devices.
 perform 1 from public.profiles where id=u for update;
 select e.* into old from public.completion_events e join private.event_receipts r on r.event_id=e.id where r.user_id=u and r.client_event_id=p_client_event_id;
 if not found then select * into old from public.completion_events where user_id=u and client_event_id=p_client_event_id; end if;
 if found then return jsonb_build_object('event',to_jsonb(old),'progress',public.get_progress(old.season_id),'credited',false); end if;
 if p_client_event_id is null or p_occurred_at is null or p_kind not in ('full','easy','skipped','rest') or p_kind is null then raise exception 'Invalid event'; end if;
 if p_occurred_at>now()+interval '5 minutes' or p_occurred_at<now()-interval '14 days' then raise exception 'Event outside recording window'; end if;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 select timezone into tz from public.profiles where id=u;
 dt:=(p_occurred_at at time zone tz)::date;
 if dt<s.started_on or dt>=s.ends_on then raise exception 'Outside season dates'; end if;
 -- Queued offline events from an archived season may arrive later, but must predate its archive.
 if s.status<>'active' and (s.ended_at is null or p_occurred_at>s.ended_at) then raise exception 'Season ended'; end if;
 if p_kind='rest' then
 if p_practice_id is not null then raise exception 'Rest has no practice'; end if;
 select * into old from public.completion_events where user_id=u and local_date=dt and kind='rest' and undone_at is null;
 else
 if not exists(select 1 from public.practices where id=p_practice_id and season_id=s.id and user_id=u and (active or p_occurred_at<=retired_at)) then raise exception 'Practice unavailable'; end if;
 if p_kind in ('full','easy') then select * into old from public.completion_events where user_id=u and practice_id=p_practice_id and local_date=dt and kind in ('full','easy') and undone_at is null; end if;
 end if;
 if old.id is not null then
 insert into private.event_receipts(user_id,client_event_id,event_id) values(u,p_client_event_id,old.id);
 return jsonb_build_object('event',to_jsonb(old),'progress',public.get_progress(old.season_id),'credited',false); end if;
 insert into public.completion_events(user_id,season_id,practice_id,client_event_id,kind,occurred_at,local_date,minutes_actual,effort,note)
 values(u,s.id,p_practice_id,p_client_event_id,p_kind,p_occurred_at,dt,p_minutes_actual,p_effort,nullif(trim(p_note),'')) returning id into eid;
 insert into private.event_receipts(user_id,client_event_id,event_id) values(u,p_client_event_id,eid);
 return jsonb_build_object('event',(select to_jsonb(e) from public.completion_events e where id=eid),'progress',public.get_progress(s.id),'credited',p_kind in ('full','easy'));
end $$;

create function public.record_skip_or_rest(p_season_id uuid,p_practice_id uuid,p_kind text,p_client_event_id uuid,p_occurred_at timestamptz,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_kind not in ('skipped','rest') then raise exception 'Invalid kind'; end if;
 return public.complete_practice(p_season_id,p_practice_id,p_kind,p_client_event_id,p_occurred_at,null,null,p_note);
end $$;
create function public.undo_completion(p_event_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.completion_events; tz text;
begin
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into e from public.completion_events where id=p_event_id and user_id=auth.uid();
 if not found then raise exception 'Event unavailable'; end if;
 if e.undone_at is not null then return public.get_progress(e.season_id); end if;
 select timezone into tz from public.profiles where id=auth.uid();
 if e.source='migrated' or e.local_date<>(now() at time zone tz)::date then raise exception 'Undo is available on the same local day'; end if;
 update public.completion_events set undone_at=now() where id=e.id;
 return public.get_progress(e.season_id);
end $$;

-- Shared strict structural validation, also used by future edit/review RPCs.
create function private.validate_plan(p jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; v jsonb; budget integer; n integer:=0;
begin
 if p is null or jsonb_typeof(p)<>'object' or not(p ?& array['goal','identity','blocker','minutes_budget','plan_source','plan_summary','safety_note','branch_labels','practices']) or jsonb_typeof(p->'practices')<>'array' then raise exception 'Incomplete plan'; end if;
 budget:=(p->>'minutes_budget')::integer;
 if budget not in (5,15,30) or length(p->>'goal') not between 3 and 140 or p->>'plan_source' not in ('ai','local') or p->>'identity' not in ('creator','athlete','scholar','builder') then raise exception 'Invalid plan'; end if;
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
create function private.install_practices(s public.seasons,p jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; pid uuid; i integer:=0; t integer; cfg integer[];
begin
 select milestone_days into cfg from private.progression_config;
 for item in select value from jsonb_array_elements(p->'practices') loop
 insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
 values(s.id,s.user_id,item->>'branch',item->>'title',item->>'why',item->>'role',item->>'cadence',(item->>'cadence_n')::integer,item->'full_variant',item->'easy_variant',i) returning id into pid;
 for t in 1..4 loop
 insert into public.milestones(season_id,user_id,branch,tier,title,practice_id,required_days)
 values(s.id,s.user_id,item->>'branch',t,(array['Seed','Root','Branch','Canopy'])[t],pid,least(cfg[t],s.ends_on-s.started_on));
 end loop;
 i:=i+1;
 end loop;
end $$;
create function public.start_next_season(p_plan jsonb,p_timezone text,p_display_name text default null,p_previous_status text default 'completed')
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.seasons; dt date;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform private.validate_plan(p_plan);
 perform public.update_preferences(p_timezone,p_display_name);
 perform 1 from public.profiles where id=auth.uid() for update;
 if p_previous_status not in ('completed','archived') then raise exception 'Invalid season status'; end if;
 dt:=(now() at time zone p_timezone)::date;
 update public.seasons set status=p_previous_status,ended_at=now() where user_id=auth.uid() and status='active';
 insert into public.seasons(user_id,goal,identity,blocker,minutes_budget,started_on,ends_on,plan_version,plan_source,plan_summary,safety_note,branch_labels)
 values(auth.uid(),p_plan->>'goal',p_plan->>'identity',p_plan->>'blocker',(p_plan->>'minutes_budget')::integer,dt,dt+30,1,p_plan->>'plan_source',p_plan->>'plan_summary',p_plan->>'safety_note',p_plan->'branch_labels') returning * into s;
 perform private.install_practices(s,p_plan);
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,auth.uid(),1,p_plan);
 update public.profiles set blocker=s.blocker where id=auth.uid();
 return s.id;
end $$;
create function public.end_season(p_season_id uuid,p_status text default 'completed') returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('completed','archived') then raise exception 'Invalid status'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 update public.seasons set status=p_status,ended_at=coalesce(ended_at,now()) where id=p_season_id and user_id=auth.uid();
 if not found then raise exception 'Season unavailable'; end if;
end $$;
-- Functions have PUBLIC execute by default; explicitly narrow every entry point.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.update_preferences(text,text),public.get_progress(uuid),public.complete_practice(uuid,uuid,text,uuid,timestamptz,integer,integer,text),public.record_skip_or_rest(uuid,uuid,text,uuid,timestamptz,text),public.undo_completion(uuid),public.start_next_season(jsonb,text,text,text),public.end_season(uuid,text) from public,anon;
grant execute on function public.update_preferences(text,text),public.get_progress(uuid),public.complete_practice(uuid,uuid,text,uuid,timestamptz,integer,integer,text),public.record_skip_or_rest(uuid,uuid,text,uuid,timestamptz,text),public.undo_completion(uuid),public.start_next_season(jsonb,text,text,text),public.end_season(uuid,text) to authenticated;
notify pgrst,'reload schema';

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610250002_backfill.sql
-- ---------------------------------------------------------------------------
-- Stage 1 backfill. Never run without explicit approval + a verified database backup.
-- Rollback: old profiles/nodes are untouched. Return to the old app using restored old grants.
-- Do not drop seasons/events/grants: new daily progress must survive any client rollback.
do $$
declare p public.profiles; n public.nodes; s public.seasons; pid uuid; dt date; at_time timestamptz; primary_chosen boolean; budget integer;
begin
 -- Abort the whole migration, rather than quietly changing unsupported/ambiguous balances or pillars.
 if exists(select 1 from public.profiles where xp<0) then raise exception 'Negative legacy XP requires manual review'; end if;
 if exists(select 1 from public.nodes where pillar not in ('body','mind','craft','connection') or tier not between 0 and 3) then raise exception 'Legacy tree requires manual review'; end if;
 if exists(select 1 from public.nodes legacy_node where not exists(select 1 from public.profiles legacy_profile where legacy_profile.id=legacy_node.user_id)) then raise exception 'Orphaned legacy nodes require manual review'; end if;
 for p in select * from public.profiles loop
 insert into public.legacy_xp_grants(user_id,xp) values(p.id,p.xp) on conflict(user_id) do nothing;
 if exists(select 1 from public.seasons where user_id=p.id) then continue; end if;
 if p.identity is null and not exists(select 1 from public.nodes where user_id=p.id) then continue; end if;
 if p.identity not in ('creator','athlete','scholar','builder') then raise exception 'Unsupported legacy identity requires manual review'; end if;
 dt:=(p.season_started_at at time zone p.timezone)::date;
 budget:=case when p.time_budget in ('5','15','30') then p.time_budget::integer else 15 end;
 insert into public.seasons(user_id,goal,identity,blocker,minutes_budget,started_on,ends_on,plan_source,plan_summary,safety_note,branch_labels)
 values(p.id,coalesce(nullif(p.goal,''),'Continue my daily practice'),coalesce(p.identity,'creator'),coalesce(p.blocker,'consistency'),budget,dt,greatest(dt+30,coalesce((select max((completed_at at time zone p.timezone)::date)+1 from public.nodes where user_id=p.id),dt+30)),
 'local','Your original tree, preserved. Earlier plan details were not saved.','Historical instructions are preserved, not newly reviewed. Choose a fresh plan to use updated variants.',jsonb_build_object('body','Body','mind','Mind','craft','Craft','connection','Connection')) returning * into s;
 primary_chosen:=false;
 for n in select * from public.nodes where user_id=p.id order by case when status='active' then 0 else 1 end,tier,pillar loop
 insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
 values(s.id,p.id,n.pillar,n.title,coalesce(n.description,'Preserved from your original tree.'),case when not primary_chosen then 'primary' else 'supporting' end,case when not primary_chosen then 'daily' else 'weekly' end,1,
 jsonb_build_object('title',n.title,'minutes',budget,'steps',n.instructions),
 jsonb_build_object('title','A gentle start','minutes',2,'steps',jsonb_build_array('Prepare a comfortable place and the tool you need.','Try one small part, and stop after two minutes.')),n.tier*4+case n.pillar when 'body' then 0 when 'mind' then 1 when 'craft' then 2 else 3 end) returning id into pid;
 primary_chosen:=true;
 insert into public.milestones(season_id,user_id,branch,tier,title,practice_id,required_days)
 values(s.id,p.id,n.pillar,n.tier+1,n.title,pid,(select milestone_days[n.tier+1] from private.progression_config));
 if n.status='completed' then
 at_time:=coalesce(n.completed_at,p.season_started_at);
 insert into public.completion_events(user_id,season_id,practice_id,client_event_id,kind,occurred_at,local_date,source,date_inferred)
 values(p.id,s.id,pid,gen_random_uuid(),'full',at_time,(at_time at time zone p.timezone)::date,'migrated',n.completed_at is null);
 end if;
 end loop;
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,p.id,1,jsonb_build_object('source','migrated','metadata_unavailable',true,'original_profile',to_jsonb(p)));
 end loop;
end $$;

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610250003_weekly_review_and_edits.sql
-- ---------------------------------------------------------------------------
-- Stage 2. Apply only after explicit production approval and a database backup.
-- Rollback: drop the weekly_reviews table and the four new functions, and drop the two
-- seasons columns. Season history, practices and completion events are untouched.

alter table public.seasons add column week_mode text not null default 'same' check(week_mode in ('same','lighter'));
alter table public.seasons add column week_mode_until date;

create table public.weekly_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users on delete cascade,
 season_id uuid not null, week_start date not null,
 difficulty integer not null check(difficulty between 1 and 5),
 note text check(length(note)<=280),
 adherence numeric(4,3) not null check(adherence between 0 and 1),
 decision text not null check(decision in ('lighter','same','harder')),
 applied_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(season_id,user_id) references public.seasons(id,user_id) on delete cascade,
 unique(user_id,season_id,week_start)
);
alter table public.weekly_reviews enable row level security;
create policy review_read on public.weekly_reviews for select to authenticated using(user_id=auth.uid());
revoke all on public.weekly_reviews from anon,authenticated;
grant select on public.weekly_reviews to authenticated;

-- Deterministic adaptation: no model call, no hidden change. The decision is stored,
-- and only the "lighter" outcome changes behaviour (the next week defaults to the easy
-- version). "harder" is an offer the client shows; it never changes a plan by itself.
create function public.submit_weekly_review(p_season_id uuid, p_week_start date, p_difficulty integer, p_note text default null, p_apply boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; practiced integer; adherence numeric; verdict text; rid uuid;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_difficulty not between 1 and 5 then raise exception 'Invalid difficulty'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 if p_week_start<s.started_on or p_week_start>=s.ends_on then raise exception 'Week outside the season'; end if;
 select count(distinct local_date) into practiced from public.completion_events
   where user_id=u and season_id=s.id and kind in ('full','easy') and undone_at is null
   and local_date between p_week_start and p_week_start+6;
 adherence:=least(1,greatest(0,practiced::numeric/7));
 verdict:=case
   when adherence<0.5 or p_difficulty>=4 then 'lighter'
   when adherence>=0.85 and p_difficulty<=2 then 'harder'
   else 'same' end;
 insert into public.weekly_reviews(user_id,season_id,week_start,difficulty,note,adherence,decision,applied_at)
 values(u,s.id,p_week_start,p_difficulty,nullif(trim(p_note),''),adherence,verdict,case when p_apply then now() else null end)
 on conflict(user_id,season_id,week_start) do update set difficulty=excluded.difficulty,note=excluded.note,
   adherence=excluded.adherence,decision=excluded.decision,applied_at=excluded.applied_at
 returning id into rid;
 if p_apply then
   if verdict='lighter' then
     update public.seasons set week_mode='lighter',week_mode_until=p_week_start+13 where id=s.id;
   else
     update public.seasons set week_mode='same',week_mode_until=null where id=s.id;
   end if;
 end if;
 return jsonb_build_object('review',(select to_jsonb(r) from public.weekly_reviews r where r.id=rid),'adherence',adherence,'decision',verdict);
end $$;

-- Edits keep history: old practices retire rather than delete, and a new plan version
-- is appended. Milestones are derived structures and are rebuilt for the new practices.
create function public.update_plan(p_season_id uuid,p_plan jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; next_version integer;
begin
 if u is null then raise exception 'Sign in required'; end if;
 perform private.validate_plan(p_plan);
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 if s.status<>'active' then raise exception 'Season ended'; end if;
 select coalesce(max(version),0)+1 into next_version from public.plan_versions where season_id=s.id;
 update public.practices set active=false,retired_at=coalesce(retired_at,now()) where season_id=s.id and user_id=u and active;
 delete from public.milestones where season_id=s.id and user_id=u;
 update public.seasons set goal=p_plan->>'goal',blocker=p_plan->>'blocker',minutes_budget=(p_plan->>'minutes_budget')::integer,
   plan_version=next_version,plan_summary=p_plan->>'plan_summary',safety_note=p_plan->>'safety_note',
   branch_labels=p_plan->'branch_labels',plan_source=p_plan->>'plan_source' where id=s.id;
 select * into s from public.seasons where id=s.id;
 perform private.install_practices(s,p_plan);
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,u,next_version,p_plan);
 update public.profiles set blocker=s.blocker where id=u;
 return next_version;
end $$;

create function public.replace_practice(p_season_id uuid,p_practice_id uuid,p_practice jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; old public.practices; pid uuid; t integer; cfg integer[];
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_practice is null or not(p_practice ?& array['branch','title','why','full_variant','easy_variant']) then raise exception 'Incomplete practice'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 if s.status<>'active' then raise exception 'Season ended'; end if;
 select * into old from public.practices where id=p_practice_id and season_id=s.id and user_id=u and active;
 if not found then raise exception 'Practice unavailable'; end if;
 if p_practice->>'branch'<>old.branch or p_practice->>'role'<>old.role then raise exception 'Replacement must stay on the same branch'; end if;
 insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
 values(s.id,u,old.branch,left(p_practice->>'title',80),left(p_practice->>'why',280),old.role,old.cadence,old.cadence_n,
   p_practice->'full_variant',p_practice->'easy_variant',old.sort_order) returning id into pid;
 update public.practices set active=false,retired_at=now(),replaced_by=pid where id=old.id;
 delete from public.milestones where practice_id=old.id and user_id=u;
 select milestone_days into cfg from private.progression_config;
 for t in 1..4 loop
   insert into public.milestones(season_id,user_id,branch,tier,title,practice_id,required_days)
   values(s.id,u,old.branch,t,(array['Seed','Root','Branch','Canopy'])[t],pid,least(cfg[t],s.ends_on-s.started_on));
 end loop;
 return pid;
end $$;

create function public.season_history()
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); out jsonb;
begin
 if u is null then raise exception 'Sign in required'; end if;
 select coalesce(jsonb_agg(row) ,'[]'::jsonb) into out from (
   select jsonb_build_object('id',s.id,'goal',s.goal,'status',s.status,'started_on',s.started_on,'ends_on',s.ends_on,
     'days_practiced',(select count(distinct local_date) from public.completion_events e where e.season_id=s.id and e.user_id=u and e.kind in ('full','easy') and e.undone_at is null),
     'xp',(select count(*)*10 from public.completion_events e where e.season_id=s.id and e.user_id=u and e.kind in ('full','easy') and e.undone_at is null and e.source='app'),
     'summary',s.plan_summary) row
   from public.seasons s where s.user_id=u and s.status<>'active' order by s.created_at desc limit 24) q;
 return out;
end $$;

revoke all on function public.submit_weekly_review(uuid,date,integer,text,boolean),public.update_plan(uuid,jsonb),public.replace_practice(uuid,uuid,jsonb),public.season_history() from public,anon;
grant execute on function public.submit_weekly_review(uuid,date,integer,text,boolean),public.update_plan(uuid,jsonb),public.replace_practice(uuid,uuid,jsonb),public.season_history() to authenticated;
notify pgrst,'reload schema';

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610250004_consent_and_quota.sql
-- ---------------------------------------------------------------------------
-- Stage 3. Apply only after explicit production approval and a database backup.
-- Rollback: drop the two consent functions, the quota function and generation_usage.
-- Existing consent columns on profiles are kept so history is not rewritten.

create table public.generation_usage (
  user_id uuid not null references auth.users on delete cascade,
  usage_day date not null,
  used integer not null default 0 check(used >= 0),
  primary key(user_id, usage_day)
);
alter table public.generation_usage enable row level security;
create policy usage_read on public.generation_usage for select to authenticated using(user_id=auth.uid());
revoke all on public.generation_usage from anon,authenticated;
grant select on public.generation_usage to authenticated;

create function public.record_ai_consent(p_version text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_version is null or length(p_version) not between 1 and 20 then raise exception 'Invalid consent version'; end if;
  insert into public.profiles(id,ai_consent_version,ai_consent_at) values(auth.uid(),p_version,now())
  on conflict(id) do update set ai_consent_version=excluded.ai_consent_version, ai_consent_at=excluded.ai_consent_at;
end $$;

create function public.withdraw_ai_consent()
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  update public.profiles set ai_consent_version=null, ai_consent_at=null where id=auth.uid();
end $$;

-- Atomic: the row lock makes a burst of requests count exactly once each.
create function public.consume_generation_quota(p_limit integer default 20)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); tz text; day date; used_now integer;
begin
  if u is null then raise exception 'Sign in required'; end if;
  if p_limit not between 1 and 200 then raise exception 'Invalid limit'; end if;
  select timezone into tz from public.profiles where id=u;
  day:=(now() at time zone coalesce(tz,'UTC'))::date;
  insert into public.generation_usage(user_id,usage_day,used) values(u,day,1)
  on conflict(user_id,usage_day) do update set used=public.generation_usage.used+1
  returning used into used_now;
  return used_now<=p_limit;
end $$;

revoke all on function public.record_ai_consent(text),public.withdraw_ai_consent(),public.consume_generation_quota(integer) from public,anon;
grant execute on function public.record_ai_consent(text),public.withdraw_ai_consent(),public.consume_generation_quota(integer) to authenticated;
notify pgrst,'reload schema';

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610250005_personalization.sql
-- ---------------------------------------------------------------------------
-- Apply only after a backup, local/staging testing and explicit production approval.
-- Rollback: remove the trigger and functions, then remove personalization_context;
-- convert mixed and unknown sources before restoring the original source constraints.

alter table public.seasons add column personalization_context jsonb not null default '[]'::jsonb;
-- Old labels predate accurate provenance tracking; do not claim they are verified.
alter table public.seasons add column plan_source_verified boolean not null default false;
alter table public.seasons drop constraint seasons_plan_source_check;
alter table public.seasons add constraint seasons_plan_source_check check(plan_source in ('ai','local','mixed','unknown'));

-- Preserve the existing validator and translate mixed only for its original source check.
alter function private.validate_plan(jsonb) rename to validate_plan_v1;
create function private.validate_plan(p jsonb) returns void language plpgsql set search_path='' as $$
declare x jsonb; item jsonb;
begin
 if p->>'plan_source' not in ('ai','local','mixed','unknown') then raise exception 'Invalid plan source'; end if;
 x:=coalesce(p->'personalization_context','[]'::jsonb);
 if jsonb_typeof(x)<>'array' or jsonb_array_length(x)>3 then raise exception 'Invalid personalization context'; end if;
 for item in select value from jsonb_array_elements(x) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
    or length(trim(item->>'question')) not between 1 and 140 or length(trim(item->>'answer')) not between 1 and 160
    then raise exception 'Invalid personalization answer'; end if;
 end loop;
 perform private.validate_plan_v1(case when p->>'plan_source' in ('mixed','unknown') then jsonb_set(p,'{plan_source}','"ai"'::jsonb) else p end);
end $$;
revoke all on function private.validate_plan(jsonb), private.validate_plan_v1(jsonb) from public,anon,authenticated;

-- start_next_season and update_plan already write a plan version atomically.
-- Capture the matching context alongside that version, without a second client write.
create function private.apply_plan_context() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.seasons set
  personalization_context=case when new.snapshot ? 'personalization_context' then new.snapshot->'personalization_context' else personalization_context end,
  plan_source_verified=coalesce(new.snapshot->>'plan_source','unknown') <> 'unknown'
 where id=new.season_id and user_id=new.user_id;
 return new;
end $$;
create trigger apply_plan_context after insert on public.plan_versions for each row execute function private.apply_plan_context();

-- A standalone replacement changes the makeup of the plan without recording its
-- source. New complete versions become verified again when their snapshot is inserted.
create function private.invalidate_plan_source() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.seasons set plan_source_verified=false where id=new.season_id and user_id=new.user_id;
 return new;
end $$;
create trigger invalidate_plan_source after insert on public.practices for each row execute function private.invalidate_plan_source();

-- Editing/removing context does not regenerate or change practices. Purge historical
-- snapshots too, otherwise a removed answer would remain in plan_versions.
create function public.set_personalization_context(p_season_id uuid,p_context jsonb) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); item jsonb;
begin
 if u is null then raise exception 'Sign in required'; end if;
 if p_context is null or jsonb_typeof(p_context)<>'array' or jsonb_array_length(p_context)>3 then raise exception 'Invalid personalization context'; end if;
 for item in select value from jsonb_array_elements(p_context) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'question')<>'string' or jsonb_typeof(item->'answer')<>'string'
    or length(trim(item->>'question')) not between 1 and 140 or length(trim(item->>'answer')) not between 1 and 160
    then raise exception 'Invalid personalization answer'; end if;
 end loop;
 update public.seasons set personalization_context=p_context where id=p_season_id and user_id=u;
 if not found then raise exception 'Season unavailable'; end if;
 update public.plan_versions set snapshot=snapshot-'personalization_context' where season_id=p_season_id and user_id=u;
end $$;
revoke all on function public.set_personalization_context(uuid,jsonb) from public,anon;
grant execute on function public.set_personalization_context(uuid,jsonb) to authenticated;
notify pgrst,'reload schema';

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

-- ---------------------------------------------------------------------------
-- From supabase/migrations/202610280003_chapter_continuation.sql
-- ---------------------------------------------------------------------------
-- Linked chapters. Existing seasons and history are not backfilled or rewritten.
alter table public.seasons add column previous_season_id uuid;
alter table public.seasons add constraint seasons_previous_owner_fk foreign key(previous_season_id,user_id) references public.seasons(id,user_id) on delete cascade;
create unique index one_continuation_per_season on public.seasons(previous_season_id) where previous_season_id is not null;
alter table public.profiles add column chapter_reflection_consent_at timestamptz;
alter table public.profiles add column chapter_reflection_consent_version text;

create function public.record_chapter_reflection_consent(p_version text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_version is distinct from '2026-10-chapter-1' or not exists(select 1 from public.profiles where id=auth.uid() and ai_consent_at is not null and ai_consent_version='2026-10-ai-3') then raise exception 'AI consent required'; end if;
 update public.profiles set chapter_reflection_consent_version=p_version,chapter_reflection_consent_at=now() where id=auth.uid();
end $$;
create function private.clear_chapter_consent() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.ai_consent_at is null or new.ai_consent_version is distinct from '2026-10-ai-3' then
  new.chapter_reflection_consent_at:=null; new.chapter_reflection_consent_version:=null;
 end if;
 return new;
end $$;
create trigger clear_chapter_consent before update of ai_consent_at,ai_consent_version on public.profiles for each row execute function private.clear_chapter_consent();
revoke all on function private.clear_chapter_consent() from public,anon,authenticated;
revoke all on function public.record_chapter_reflection_consent(text) from public,anon;
grant execute on function public.record_chapter_reflection_consent(text) to authenticated;

-- This delegates plan installation to the existing transaction while holding the
-- same per-account lock used by weekly acceptance. Any failure rolls it all back.
create function public.approve_next_chapter(p_previous_id uuid,p_expected_version integer,p_plan jsonb,p_timezone text,p_started_on date)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; next_id uuid; started date;
begin
 if u is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_previous_id and user_id=u for update;
 if not found or s.status<>'active' then raise exception 'Chapter changed; refresh'; end if;
 if p_expected_version is distinct from s.plan_version then raise exception 'Plan changed; refresh'; end if;
 if not exists(select 1 from public.profiles where id=u and timezone=p_timezone) then raise exception 'Time zone changed; refresh'; end if;
 started:=(now() at time zone p_timezone)::date;
 if p_started_on is distinct from started then raise exception 'Date changed; refresh'; end if;
 if p_plan->>'target_date' is null or p_plan->>'season_length_days' is null then raise exception 'A target and planning leg are required'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_plan->'stages','[]'::jsonb)) stage where (stage->>'start')::date<started or (stage->>'end')::date>started+(p_plan->>'season_length_days')::integer) then raise exception 'Draft dates changed; refresh'; end if;
 if coalesce((p_plan->>'conservative_mode')::boolean,false)=false and (s.conservative_mode or s.progression_paused) then
  raise exception 'Conservative mode must be preserved';
 end if;
 if s.progression_paused then raise exception 'Use the easy practice after pain before starting a chapter'; end if;
 if p_plan->>'plan_source' in ('ai','mixed') and not exists(select 1 from public.profiles where id=u and ai_consent_at is not null and ai_consent_version='2026-10-ai-3') then raise exception 'AI consent required'; end if;
 next_id:=public.start_next_season(p_plan,p_timezone,null,'completed');
 update public.seasons set previous_season_id=s.id where id=next_id and user_id=u;
 return next_id;
end $$;
revoke all on function public.approve_next_chapter(uuid,integer,jsonb,text,date) from public,anon;
grant execute on function public.approve_next_chapter(uuid,integer,jsonb,text,date) to authenticated;
notify pgrst,'reload schema';

commit;
