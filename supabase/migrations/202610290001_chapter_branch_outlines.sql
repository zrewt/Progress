-- New chapter outlines only. Existing seasons, milestones and events are not rewritten.
begin;
alter table public.seasons add column branch_outlines jsonb;

-- Capture the approved outlines atomically with the first plan version only.
create function private.install_branch_outlines() returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb; slot text; branch jsonb; item jsonb; names text[]:=array[]::text[]; titles text[];
begin
 if new.version<>1 or not (new.snapshot ? 'branch_outlines') or new.snapshot->'branch_outlines'='null'::jsonb then return new; end if;
 data:=new.snapshot->'branch_outlines';
 if jsonb_typeof(data)<>'object' or (select count(*) from jsonb_object_keys(data))<>4 then raise exception 'Invalid branch outlines'; end if;
 foreach slot in array array['body','mind','craft','connection'] loop
  branch:=data->slot;
  if jsonb_typeof(branch)<>'object' or jsonb_typeof(branch->'name')<>'string' or length(trim(branch->>'name')) not between 3 and 48 or jsonb_typeof(branch->'milestones')<>'array' or jsonb_array_length(branch->'milestones')<>4 then raise exception 'Invalid branch outlines'; end if;
  if lower(trim(branch->>'name'))=any(names) then raise exception 'Duplicate branch name'; end if;
  names:=array_append(names,lower(trim(branch->>'name'))); titles:=array[]::text[];
  for item in select value from jsonb_array_elements(branch->'milestones') loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'title')<>'string' or length(trim(item->>'title')) not between 3 and 70 or jsonb_typeof(item->'description')<>'string' or length(trim(item->>'description')) not between 8 and 180 then raise exception 'Invalid milestone outline'; end if;
   if lower(trim(item->>'title'))=any(titles) then raise exception 'Duplicate milestone title'; end if;
   titles:=array_append(titles,lower(trim(item->>'title')));
  end loop;
 end loop;
 update public.seasons set branch_outlines=data, branch_labels=jsonb_build_object('body',data->'body'->>'name','mind',data->'mind'->>'name','craft',data->'craft'->>'name','connection',data->'connection'->>'name') where id=new.season_id and user_id=new.user_id;
 return new;
end $$;
create trigger install_branch_outlines after insert on public.plan_versions for each row execute function private.install_branch_outlines();

create function private.keep_branch_outlines() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.branch_outlines is not null and (new.branch_outlines is distinct from old.branch_outlines or new.branch_labels is distinct from old.branch_labels) then raise exception 'Chapter outlines cannot be changed'; end if;
 return new;
end $$;
create trigger keep_branch_outlines before update of branch_outlines,branch_labels on public.seasons for each row execute function private.keep_branch_outlines();

-- Existing full-plan edits rebuild milestones; refuse them for new chapters so no
-- existing milestone or its growth can be rewritten. Legacy edits are unchanged.
alter function public.update_plan(uuid,jsonb) rename to update_plan_legacy;
revoke all on function public.update_plan_legacy(uuid,jsonb) from public,anon,authenticated;
create function public.update_plan(p_season_id uuid,p_plan jsonb) returns integer language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if exists(select 1 from public.seasons where id=p_season_id and user_id=auth.uid() and branch_outlines is not null) then raise exception 'Use a new chapter to change this plan'; end if;
 return public.update_plan_legacy(p_season_id,p_plan);
end $$;
revoke all on function public.update_plan(uuid,jsonb) from public,anon;
grant execute on function public.update_plan(uuid,jsonb) to authenticated;

alter function public.replace_practice(uuid,uuid,jsonb) rename to replace_practice_legacy;
revoke all on function public.replace_practice_legacy(uuid,uuid,jsonb) from public,anon,authenticated;
create function public.replace_practice(p_season_id uuid,p_practice_id uuid,p_practice jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.seasons; old public.practices; pid uuid;
begin
 if u is null then raise exception 'Sign in required'; end if;
 perform 1 from public.profiles where id=u for update;
 select * into s from public.seasons where id=p_season_id and user_id=u;
 if not found or s.status<>'active' then raise exception 'Season unavailable'; end if;
 if s.branch_outlines is null then return public.replace_practice_legacy(p_season_id,p_practice_id,p_practice); end if;
 select * into old from public.practices where id=p_practice_id and season_id=s.id and user_id=u and active;
 if not found then raise exception 'Practice unavailable'; end if;
 if p_practice is null or not(p_practice ?& array['branch','role','title','why','full_variant','easy_variant']) or p_practice->>'branch' is distinct from old.branch or p_practice->>'role' is distinct from old.role or length(trim(p_practice->>'title')) not between 1 and 80 or length(trim(p_practice->>'why')) not between 1 and 280 then raise exception 'Invalid replacement'; end if;
 perform private.validate_week_variant(p_practice->'full_variant',s.minutes_budget,false);
 perform private.validate_week_variant(p_practice->'easy_variant',s.minutes_budget,true);
 insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
 values(s.id,u,old.branch,p_practice->>'title',p_practice->>'why',old.role,old.cadence,old.cadence_n,p_practice->'full_variant',p_practice->'easy_variant',old.sort_order) returning id into pid;
 update public.practices set active=false,retired_at=now(),replaced_by=pid where id=old.id;
 -- Milestones keep their original practice reference; growth counts the branch's history.
 return pid;
end $$;
revoke all on function public.replace_practice(uuid,uuid,jsonb) from public,anon;
grant execute on function public.replace_practice(uuid,uuid,jsonb) to authenticated;

alter function public.get_progress(uuid) rename to get_progress_legacy;
revoke all on function public.get_progress_legacy(uuid) from public,anon,authenticated;
create function public.get_progress(p_season_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; unlocked jsonb;
begin
 result:=public.get_progress_legacy(p_season_id);
 if exists(select 1 from public.seasons where id=p_season_id and user_id=auth.uid() and branch_outlines is not null) then
  select coalesce(jsonb_agg(m.id),'[]'::jsonb) into unlocked from public.milestones m where m.season_id=p_season_id and m.user_id=auth.uid() and (
   select count(distinct e.local_date) from public.completion_events e join public.practices p on p.id=e.practice_id where e.user_id=auth.uid() and e.season_id=m.season_id and p.branch=m.branch and e.kind in ('full','easy') and e.undone_at is null)>=m.required_days;
  result:=jsonb_set(result,'{unlocked_milestones}',unlocked);
  result:=jsonb_set(result,'{branch_growth}',coalesce((select jsonb_object_agg(b,coalesce(c,0)) from unnest(array['body','mind','craft','connection']) b left join (select p.branch,count(distinct e.local_date) c from public.completion_events e join public.practices p on p.id=e.practice_id where e.user_id=auth.uid() and e.season_id=p_season_id and e.kind in ('full','easy') and e.undone_at is null group by p.branch) q on q.branch=b),'{}'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.get_progress(uuid) from public,anon;
grant execute on function public.get_progress(uuid) to authenticated;
revoke all on function private.install_branch_outlines(),private.keep_branch_outlines() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
