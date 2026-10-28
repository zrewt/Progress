-- New safety data only; no backfill or rewrite of existing history. NOT applied remotely.
begin;
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
commit;
