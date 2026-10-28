-- Mid-week adaptation: the fixed-rule offer to make the next seven days lighter.
-- New function only; no table, column or row is rewritten by this migration.
-- NOT applied remotely. Run after explicit approval, like every earlier stage.
begin;

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

commit;
