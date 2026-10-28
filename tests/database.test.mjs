import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
export const plan = {
 goal:'Write every day',identity:'creator',blocker:'consistency',minutes_budget:5,plan_source:'local',plan_summary:'One small step.',safety_note:'Rest is welcome.',branch_labels:{body:'Energy',mind:'Focus',craft:'Writing',connection:'Support'},
 practices:['craft','body','mind','connection'].map((branch,i)=>({branch,title:`Practice ${branch}`,why:'A small step.',role:i===0?'primary':'supporting',cadence:i===0?'daily':'weekly',cadence_n:1,full_variant:{title:'Full',minutes:5,steps:['Begin gently.']},easy_variant:{title:'Easy',minutes:2,steps:['Try one small part.']}}))
};
async function setup() {
 const db=await PGlite.create();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; insert into auth.users values('${A}'),('${B}');`);
 await db.exec(await readFile('supabase/schema.sql','utf8'));
 // Realistic baseline grants: policies alone do not grant privileges.
 await db.exec('grant all on public.profiles,public.nodes to authenticated;');
 await db.exec(`insert into public.profiles(id,identity,goal,time_budget,xp,season_started_at) values('${A}','creator','Write daily','5',150,now()-interval '4 days'),('${B}','athlete','Run daily','15',0,now()); insert into public.nodes(user_id,node_id,pillar,tier,title,status,completed_at) values('${A}','craft-0','craft',0,'Original seed','completed',now()-interval '3 days'),('${A}','craft-1','craft',1,'Original root','completed',null);`);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 return db;
}
async function asUser(db,id=A){ await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`); }
async function rpc(db,name,args=[]){ return (await db.query(`select public.${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result; }
test('daily database: migrations, backfill, atomic retries, undo, boundaries, archive and RLS', async(t)=>{
 const db=await setup(); t.after(()=>db.close()); await asUser(db);
 const original=(await db.query('select * from public.seasons')).rows[0];
 assert.equal(original.plan_source_verified,false, 'legacy source must not claim verified provenance');
 assert.deepEqual(original.personalization_context,[]);
 await t.test('backfill preserves exact XP and original rows, marks inferred dates',async()=>{
  assert.equal((await rpc(db,'get_progress',[original.id])).xp,150);
  assert.equal((await db.query('select * from public.nodes')).rows.length,2);
  assert.equal((await db.query('select * from public.completion_events')).rows.length,2);
  assert.equal((await db.query('select count(*)::int n from public.completion_events where date_inferred')).rows[0].n,1);
 });
 const season=await rpc(db,'start_next_season',[plan,'America/New_York','Writer','archived']);
 const pid=(await db.query('select id from public.practices where season_id=$1 order by sort_order',[season])).rows[0].id;
 const eid='33333333-3333-4333-8333-333333333333'; const at=new Date().toISOString();
 await t.test('config parity with app',async()=>{
  await db.exec('reset role'); const cfg=(await db.query('select * from private.progression_config')).rows[0];
  assert.equal(cfg.xp_per_completion,10); assert.deepEqual(cfg.milestone_days,[3,7,14,21]); await asUser(db);
 });
 await t.test('same event retry and different id same-day duplicate earn once',async()=>{
  const first=await rpc(db,'complete_practice',[season,pid,'easy',eid,at,2,3,'A small win']);
  assert.equal(first.progress.xp,160);assert.equal(first.credited,true);
  const retry=await rpc(db,'complete_practice',[season,pid,'full',eid,at]);assert.equal(retry.event.id,first.event.id);assert.equal(retry.credited,false);
  const duplicate=await rpc(db,'complete_practice',[season,pid,'full','44444444-4444-4444-8444-444444444444',at]);assert.equal(duplicate.progress.xp,160);assert.equal(duplicate.credited,false);
 });
 await t.test('invalid inputs cannot partially award XP',async()=>{
  for(const args of [[season,pid,'full',crypto.randomUUID(),new Date(Date.now()+3600000).toISOString()],[season,pid,'full',crypto.randomUUID(),new Date(Date.now()-15*86400000).toISOString()],[season,pid,'full',crypto.randomUUID(),at,5,6],[season,pid,'full',crypto.randomUUID(),at,5,2,'x'.repeat(281)]]) {
   // Existing counted day returns its original result; use undo first for validating optional fields below.
   if(args.length>5) continue;
   await assert.rejects(()=>rpc(db,'complete_practice',args));
  }
  assert.equal((await rpc(db,'get_progress',[season])).xp,160);
 });
 await t.test('undo is idempotent; retries do not resurrect it',async()=>{
  const event=(await db.query('select id from public.completion_events where client_event_id=$1',[eid])).rows[0].id;
  assert.equal((await rpc(db,'undo_completion',[event])).xp,150);assert.equal((await rpc(db,'undo_completion',[event])).xp,150);
  assert.equal((await rpc(db,'complete_practice',[season,pid,'easy',eid,at])).progress.xp,150);
  await assert.rejects(()=>rpc(db,'complete_practice',[season,pid,'full',crypto.randomUUID(),at,5,6]));
  await assert.rejects(()=>rpc(db,'complete_practice',[season,pid,'full',crypto.randomUUID(),at,5,2,'x'.repeat(281)]));
  const old=(await db.query("select id from public.completion_events where source='migrated' limit 1")).rows[0].id;await assert.rejects(()=>rpc(db,'undo_completion',[old]));
 });
 await t.test('direct rewards/event writes denied',async()=>{
  await assert.rejects(()=>db.exec('update public.profiles set xp=999999'));
  await assert.rejects(()=>db.exec('delete from public.completion_events'));
  await assert.rejects(()=>db.exec('update public.milestones set required_days=1'));
 });
 await t.test('two-user SQL isolation and foreign RPC rejection',async()=>{
  await asUser(db,B);assert.equal((await db.query('select * from public.completion_events')).rows.length,0);
  await assert.rejects(()=>rpc(db,'get_progress',[season]));await assert.rejects(()=>rpc(db,'complete_practice',[season,pid,'full',crypto.randomUUID(),at]));
  await asUser(db);
 });
 await t.test('archive and rollover preserve lifetime grants and history',async()=>{
  await rpc(db,'end_season',[season,'completed']);const next=await rpc(db,'start_next_season',[plan,'UTC','Writer','completed']);
  assert.notEqual(next,season);assert.equal((await rpc(db,'get_progress',[next])).xp,150);
  assert.equal((await db.query('select * from public.seasons')).rows.length,3);
 });
});

test('new target-date legs preserve legacy seasons and scale daily and weekly milestones', async(t)=>{
 const db=await setup(); t.after(()=>db.close()); await asUser(db);
 const old=(await db.query('select id,started_on,ends_on from public.seasons limit 1')).rows[0];
 const target=(await db.query("select to_char((now() at time zone 'UTC')::date + 14,'YYYY-MM-DD') value")).rows[0].value;
 const season=await rpc(db,'start_next_season',[{...plan,target_date:target,season_length_days:14},'UTC','Player','archived']);
 const row=(await db.query('select target_date,season_length_days,ends_on-started_on length from public.seasons where id=$1',[season])).rows[0];
 assert.equal(row.season_length_days,14); assert.equal(row.length,14);
 const before=(await db.query('select started_on,ends_on,target_date,season_length_days from public.seasons where id=$1',[old.id])).rows[0];
 assert.deepEqual(before.started_on,old.started_on); assert.deepEqual(before.ends_on,old.ends_on); assert.equal(before.target_date,null); assert.equal(before.season_length_days,null);
 const milestones=(await db.query('select branch,array_agg(required_days order by tier) thresholds from public.milestones where season_id=$1 group by branch',[season])).rows;
 assert.deepEqual(milestones.find(m=>m.branch==='craft').thresholds,[2,4,7,11]);
 assert.deepEqual(milestones.find(m=>m.branch==='body').thresholds,[1,1,1,2]);
 await assert.rejects(()=>rpc(db,'start_next_season',[{...plan,target_date:target,season_length_days:30},'UTC','Player','archived']));
});

test('rolling acceptance preserves milestone progress, rejects stale devices and respects consent', async(t)=>{
 const db=await setup(); t.after(()=>db.close()); await asUser(db);
 const target=(await db.query("select to_char((now() at time zone 'UTC')::date + 21,'YYYY-MM-DD') value")).rows[0].value;
 const season=await rpc(db,'start_next_season',[{...plan,target_date:target,season_length_days:21},'UTC','Writer','archived']);
 const practices=(await db.query('select * from public.practices where season_id=$1 order by sort_order',[season])).rows;
 await db.exec('reset role');
 await db.query("update public.seasons set started_on=started_on-7,ends_on=ends_on-7 where id=$1",[season]); await asUser(db);
 const start=(await db.query("select to_char(started_on,'YYYY-MM-DD') value from public.seasons where id=$1",[season])).rows[0].value;
 for(let i=0;i<3;i++){ const at=new Date(start+'T12:00:00Z'); at.setUTCDate(at.getUTCDate()+i); await rpc(db,'complete_practice',[season,practices[0].id,'easy',crypto.randomUUID(),at.toISOString()]); }
 const before=await rpc(db,'get_progress',[season]); assert.ok(before.unlocked_milestones.length>0);
 const draft={effective_week:2,expected_version:1,source:'ai',practices:practices.map(p=>({practice_id:p.id,title:p.title,why:p.why,full_variant:p.full_variant,easy_variant:p.easy_variant}))};
 await assert.rejects(()=>rpc(db,'accept_practice_week',[season,draft]));
 await rpc(db,'record_ai_consent',['2026-10-ai-3']);
 assert.equal(await rpc(db,'accept_practice_week',[season,draft]),2);
 const after=await rpc(db,'get_progress',[season]); assert.deepEqual(after,before);
 assert.equal((await db.query('select count(*)::int n from public.practice_weeks where season_id=$1',[season])).rows[0].n,4);
 await assert.rejects(()=>rpc(db,'accept_practice_week',[season,draft]));
 await asUser(db,B); await assert.rejects(()=>rpc(db,'accept_practice_week',[season,draft])); assert.equal((await db.query('select count(*)::int n from public.practice_weeks')).rows[0].n,0); await asUser(db);
 await rpc(db,'withdraw_ai_consent'); await assert.rejects(()=>rpc(db,'accept_practice_week',[season,{...draft,expected_version:2}]));
});

test('personalization is saved, owner-scoped and removable without changing plan history', async(t)=>{
 const db=await setup(); t.after(()=>db.close()); await asUser(db);
 const context=[{question:'What can you use?',answer:'A wall, no partner'}];
 const personalized={...plan,plan_source:'mixed',personalization_context:context};
 const season=await rpc(db,'start_next_season',[personalized,'UTC','Player','archived']);
 let row=(await db.query('select plan_source,plan_source_verified,personalization_context from public.seasons where id=$1',[season])).rows[0];
 assert.equal(row.plan_source,'mixed'); assert.equal(row.plan_source_verified,true); assert.deepEqual(row.personalization_context,context);
 await asUser(db,B);
 assert.equal((await db.query('select * from public.seasons where id=$1',[season])).rows.length,0);
 await assert.rejects(()=>rpc(db,'set_personalization_context',[season,[]]));
 await asUser(db);
 await assert.rejects(()=>rpc(db,'set_personalization_context',[season,null]));
 await assert.rejects(()=>rpc(db,'set_personalization_context',[season,Array(4).fill(context[0])]));
 await rpc(db,'update_plan',[season,{...personalized,goal:'Write a daily journal'}]);
 await rpc(db,'set_personalization_context',[season,[]]);
 row=(await db.query('select personalization_context from public.seasons where id=$1',[season])).rows[0];
 assert.deepEqual(row.personalization_context,[]);
 const versions=(await db.query('select snapshot from public.plan_versions where season_id=$1',[season])).rows;
 assert.equal(versions.length,2); assert.ok(versions.every(v=>!('personalization_context' in v.snapshot)));
 const target=(await db.query('select * from public.practices where season_id=$1 and active order by sort_order limit 1',[season])).rows[0];
 await rpc(db,'replace_practice',[season,target.id,{...target,title:'A replacement'}]);
 assert.equal((await db.query('select plan_source_verified from public.seasons where id=$1',[season])).rows[0].plan_source_verified,false);
 const continuation=await rpc(db,'start_next_season',[{...plan,plan_source:'unknown'},'UTC','Player','completed']);
 const continued=(await db.query('select plan_source,plan_source_verified from public.seasons where id=$1',[continuation])).rows[0];
 assert.equal(continued.plan_source,'unknown'); assert.equal(continued.plan_source_verified,false);
});

test('weekly review, plan edits and replacement keep history intact', async(t)=>{
 const db=await setup(); t.after(()=>db.close()); await asUser(db);
 const season=await rpc(db,'start_next_season',[plan,'America/New_York','Writer','archived']);
 const practices=(await db.query('select id,practice_id from public.milestones where season_id=$1',[season])).rows;
 const active=(await db.query('select id,branch,role,title from public.practices where season_id=$1 and active order by sort_order',[season])).rows;
 // Move the season back ten days so a full review week exists, then practise six of its days.
 await db.exec('reset role');
 const week=(await db.query("select to_char((now() at time zone 'America/New_York')::date - 10,'YYYY-MM-DD') week_start")).rows[0].week_start;
 await db.exec(`update public.seasons set started_on='${week}', ends_on=started_on+30 where id='${season}'`);
 await asUser(db);
 for(let day=0;day<6;day++){
   const at=new Date(`${week}T16:00:00Z`); at.setUTCDate(at.getUTCDate()+day);
   await rpc(db,'complete_practice',[season,active[0].id,'full',crypto.randomUUID(),at.toISOString()]);
 }
 await t.test('review computes adherence and offers an increase without changing the plan',async()=>{
  const review=await rpc(db,'submit_weekly_review',[season,week,2]);
  assert.equal(review.decision,'harder'); assert.equal(Number(review.adherence).toFixed(3),'0.857');
  assert.equal((await db.query('select week_mode from public.seasons where id=$1',[season])).rows[0].week_mode,'same');
  assert.equal((await db.query('select * from public.practices where season_id=$1 and active',[season])).rows.length,4);
 });
 await t.test('a hard review lightens the next week and resubmission updates one row',async()=>{
  const review=await rpc(db,'submit_weekly_review',[season,week,4,'A tiring week']);
  assert.equal(review.decision,'lighter');
  assert.equal((await db.query('select week_mode from public.seasons where id=$1',[season])).rows[0].week_mode,'lighter');
  assert.equal((await db.query('select count(*)::int n from public.weekly_reviews')).rows[0].n,1);
  await assert.rejects(()=>db.exec("update public.weekly_reviews set decision='harder'"));
  await assert.rejects(()=>db.exec('delete from public.weekly_reviews'));
 });
 await t.test('editing the plan adds a version and retires instead of deleting',async()=>{
  const events=(await db.query('select count(*)::int n from public.completion_events')).rows[0].n;
  const version=await rpc(db,'update_plan',[season,{...plan,minutes_budget:15,practices:plan.practices.map(p=>({...p,full_variant:{...p.full_variant,minutes:15}}))}]);
  assert.equal(version,2);
  assert.equal((await db.query('select count(*)::int n from public.practices where season_id=$1 and active',[season])).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from public.practices where season_id=$1 and not active',[season])).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from public.completion_events')).rows[0].n,events);
  assert.equal((await db.query('select count(*)::int n from public.milestones where season_id=$1',[season])).rows[0].n,16);
  assert.equal((await db.query('select minutes_budget from public.seasons where id=$1',[season])).rows[0].minutes_budget,15);
  await assert.rejects(()=>rpc(db,'update_plan',[season,{...plan,goal:'x'}]));
 });
 await t.test('replacement stays on its branch and moves the milestones',async()=>{
  const target=(await db.query('select id,branch,role from public.practices where season_id=$1 and active order by sort_order limit 1',[season])).rows[0];
  const draft={branch:target.branch,title:'A different small step',why:'Same branch, gentler entry.',full_variant:{title:'Full',minutes:15,steps:['Begin.']},easy_variant:{title:'Easy',minutes:2,steps:['Start small.']}};
  const newId=await rpc(db,'replace_practice',[season,target.id,draft]);
  assert.notEqual(newId,target.id);
  const old=(await db.query('select active,replaced_by,retired_at from public.practices where id=$1',[target.id])).rows[0];
  assert.equal(old.active,false); assert.equal(old.replaced_by,newId); assert.ok(old.retired_at);
  assert.equal((await db.query('select count(*)::int n from public.milestones where practice_id=$1',[newId])).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from public.milestones where season_id=$1',[season])).rows[0].n,16);
  await assert.rejects(()=>rpc(db,'replace_practice',[season,newId,{...draft,branch:target.branch==='body'?'mind':'body'}]));
  await assert.rejects(()=>rpc(db,'replace_practice',[season,target.id,draft]));
 });
 await t.test('consent is recorded and withdrawn by the owner only',async()=>{
  await rpc(db,'record_ai_consent',['2026-10-01']);
  const p=(await db.query('select ai_consent_version v, ai_consent_at at from public.profiles where id=$1',[A])).rows[0];
  assert.equal(p.v,'2026-10-01'); assert.ok(p.at);
  await rpc(db,'withdraw_ai_consent');
  assert.equal((await db.query('select ai_consent_version v from public.profiles where id=$1',[A])).rows[0].v,null);
  await assert.rejects(()=>rpc(db,'record_ai_consent',['']));
  await rpc(db,'record_ai_consent',['2026-10-01']);
 });
 await t.test('daily generation quota is atomic and per user',async()=>{
  const first=[]; for(let i=0;i<3;i++) first.push(await rpc(db,'consume_generation_quota',[2]));
  assert.deepEqual(first,[true,true,false]);
  assert.equal((await db.query('select used from public.generation_usage where user_id=$1',[A])).rows[0].used,3);
  await asUser(db,B);
  assert.equal((await db.query('select * from public.generation_usage')).rows.length,0);
  assert.equal(await rpc(db,'consume_generation_quota',[2]),true);
  await asUser(db);
 });
 await t.test('history lists finished seasons and stays private',async()=>{
  await rpc(db,'end_season',[season,'completed']);
  const history=await rpc(db,'season_history');
  assert.ok(history.length>=1); assert.ok(history.every((entry)=>entry.status!=='active'));
  assert.ok(history.some((entry)=>entry.id===season));
  await asUser(db,B); assert.equal((await rpc(db,'season_history')).length,0);
  await asUser(db);
 });
});
