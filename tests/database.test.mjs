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
