-- Stage 1. Apply only after explicit production approval and a database backup.
-- Rollback: restore old app + grants/policies from the baseline schema WITHOUT its destructive DELETE.
-- Keep new tables/history intact; never DROP them to roll back a client release.
begin;
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
commit;
