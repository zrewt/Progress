-- Close a chapter without changing its practices, milestones or events.
begin;
create function public.finish_chapter(p_season_id uuid,p_expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare s public.seasons;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into s from public.seasons where id=p_season_id and user_id=auth.uid() for update;
 if not found or s.status<>'active' or s.plan_version is distinct from p_expected_version then raise exception 'Chapter changed; refresh'; end if;
 update public.seasons set status='completed',ended_at=now() where id=s.id;
end $$;

-- The separate restart entry point must never silently close a chapter opened
-- on another device while this device was drafting a new goal.
create function public.start_after_finished_chapter(p_plan jsonb,p_timezone text,p_display_name text default null) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.seasons where user_id=auth.uid() and status='active') then raise exception 'A chapter is already active; refresh'; end if;
 return public.start_next_season(p_plan,p_timezone,p_display_name,'completed');
end $$;
revoke all on function public.finish_chapter(uuid,integer),public.start_after_finished_chapter(jsonb,text,text) from public,anon;
grant execute on function public.finish_chapter(uuid,integer),public.start_after_finished_chapter(jsonb,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
