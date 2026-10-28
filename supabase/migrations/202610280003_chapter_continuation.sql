-- Linked chapters. Existing seasons and history are not backfilled or rewritten.
begin;
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
