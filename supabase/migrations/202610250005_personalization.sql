-- Apply only after a backup, local/staging testing and explicit production approval.
-- Rollback: remove the trigger and functions, then remove personalization_context;
-- convert mixed and unknown sources before restoring the original source constraints.
begin;

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
commit;
