-- Longer daily sessions and up to five personalization answers.
-- Backward compatible: existing 5/15/30 plans and up to three answers stay valid.
-- Rollback: restore the previous constraint and the previous function bodies.
begin;

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
commit;
