-- Stage 3. Apply only after explicit production approval and a database backup.
-- Rollback: drop the two consent functions, the quota function and generation_usage.
-- Existing consent columns on profiles are kept so history is not rewritten.
begin;

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
commit;
