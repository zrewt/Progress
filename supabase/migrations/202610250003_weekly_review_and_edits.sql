-- Stage 2. Apply only after explicit production approval and a database backup.
-- Rollback: drop the weekly_reviews table and the four new functions, and drop the two
-- seasons columns. Season history, practices and completion events are untouched.
begin;

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
commit;
