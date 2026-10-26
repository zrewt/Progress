-- Stage 1 backfill. Never run without explicit approval + a verified database backup.
-- Rollback: old profiles/nodes are untouched. Return to the old app using restored old grants.
-- Do not drop seasons/events/grants: new daily progress must survive any client rollback.
begin;
do $$
declare p public.profiles; n public.nodes; s public.seasons; pid uuid; dt date; at_time timestamptz; primary_chosen boolean; budget integer;
begin
 -- Abort the whole migration, rather than quietly changing unsupported/ambiguous balances or pillars.
 if exists(select 1 from public.profiles where xp<0) then raise exception 'Negative legacy XP requires manual review'; end if;
 if exists(select 1 from public.nodes where pillar not in ('body','mind','craft','connection') or tier not between 0 and 3) then raise exception 'Legacy tree requires manual review'; end if;
 if exists(select 1 from public.nodes legacy_node where not exists(select 1 from public.profiles legacy_profile where legacy_profile.id=legacy_node.user_id)) then raise exception 'Orphaned legacy nodes require manual review'; end if;
 for p in select * from public.profiles loop
 insert into public.legacy_xp_grants(user_id,xp) values(p.id,p.xp) on conflict(user_id) do nothing;
 if exists(select 1 from public.seasons where user_id=p.id) then continue; end if;
 if p.identity is null and not exists(select 1 from public.nodes where user_id=p.id) then continue; end if;
 if p.identity not in ('creator','athlete','scholar','builder') then raise exception 'Unsupported legacy identity requires manual review'; end if;
 dt:=(p.season_started_at at time zone p.timezone)::date;
 budget:=case when p.time_budget in ('5','15','30') then p.time_budget::integer else 15 end;
 insert into public.seasons(user_id,goal,identity,blocker,minutes_budget,started_on,ends_on,plan_source,plan_summary,safety_note,branch_labels)
 values(p.id,coalesce(nullif(p.goal,''),'Continue my daily practice'),coalesce(p.identity,'creator'),coalesce(p.blocker,'consistency'),budget,dt,greatest(dt+30,coalesce((select max((completed_at at time zone p.timezone)::date)+1 from public.nodes where user_id=p.id),dt+30)),
 'local','Your original tree, preserved. Earlier plan details were not saved.','Historical instructions are preserved, not newly reviewed. Choose a fresh plan to use updated variants.',jsonb_build_object('body','Body','mind','Mind','craft','Craft','connection','Connection')) returning * into s;
 primary_chosen:=false;
 for n in select * from public.nodes where user_id=p.id order by case when status='active' then 0 else 1 end,tier,pillar loop
 insert into public.practices(season_id,user_id,branch,title,why,role,cadence,cadence_n,full_variant,easy_variant,sort_order)
 values(s.id,p.id,n.pillar,n.title,coalesce(n.description,'Preserved from your original tree.'),case when not primary_chosen then 'primary' else 'supporting' end,case when not primary_chosen then 'daily' else 'weekly' end,1,
 jsonb_build_object('title',n.title,'minutes',budget,'steps',n.instructions),
 jsonb_build_object('title','A gentle start','minutes',2,'steps',jsonb_build_array('Prepare a comfortable place and the tool you need.','Try one small part, and stop after two minutes.')),n.tier*4+case n.pillar when 'body' then 0 when 'mind' then 1 when 'craft' then 2 else 3 end) returning id into pid;
 primary_chosen:=true;
 insert into public.milestones(season_id,user_id,branch,tier,title,practice_id,required_days)
 values(s.id,p.id,n.pillar,n.tier+1,n.title,pid,(select milestone_days[n.tier+1] from private.progression_config));
 if n.status='completed' then
 at_time:=coalesce(n.completed_at,p.season_started_at);
 insert into public.completion_events(user_id,season_id,practice_id,client_event_id,kind,occurred_at,local_date,source,date_inferred)
 values(p.id,s.id,pid,gen_random_uuid(),'full',at_time,(at_time at time zone p.timezone)::date,'migrated',n.completed_at is null);
 end if;
 end loop;
 insert into public.plan_versions(season_id,user_id,version,snapshot) values(s.id,p.id,1,jsonb_build_object('source','migrated','metadata_unavailable',true,'original_profile',to_jsonb(p)));
 end loop;
end $$;
commit;
