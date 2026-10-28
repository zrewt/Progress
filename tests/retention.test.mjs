import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const USER='33333333-3333-4333-8333-333333333333';
const plan = {
 goal:'Play tennis once a week',identity:'athlete',blocker:'consistency',minutes_budget:15,plan_source:'local',
 plan_summary:'One small step.',safety_note:'Rest is welcome.',branch_labels:{body:'Energy',mind:'Focus',craft:'Craft',connection:'Support'},
 practices:['body','mind','craft','connection'].map((branch,i)=>({branch,title:`Practice ${branch}`,why:'A small step.',role:i===0?'primary':'supporting',cadence:i===0?'daily':'weekly',cadence_n:1,full_variant:{title:'Full',minutes:15,steps:['Begin gently.']},easy_variant:{title:'Easy',minutes:2,steps:['Try one small part.']}}))
};

async function setup() {
 const db=await PGlite.create();
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}'::jsonb); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(await readFile('supabase/schema.sql','utf8'));
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.exec(`insert into auth.users(id,raw_user_meta_data) values('${USER}','{"age_bracket":"18_plus"}'); select set_config('request.jwt.claim.sub','${USER}',false); set role authenticated;`);
 const season=(await db.query('select public.start_next_season($1,$2,$3,$4) id',[plan,'UTC','Player','archived'])).rows[0].id;
 // Backdate the season so every retention window has elapsed, then write the events the
 // queries should find. Inserted directly because the RPC refuses events older than its window.
 await db.exec(`reset role; update public.seasons set started_on=current_date-24, ends_on=current_date+6 where id='${season}';`);
 const practice=(await db.query('select id from public.practices where season_id=$1 and active order by sort_order limit 1',[season])).rows[0].id;
 for (const offset of [1,6,15]) {
   await db.query(
     `insert into public.completion_events(user_id,season_id,practice_id,client_event_id,kind,occurred_at,local_date,source)
      select $1,$2,$3,gen_random_uuid(),'full',(started_on+$4::int)::timestamptz+interval '12 hours',started_on+$4::int,'app' from public.seasons where id=$2`,
     [USER,season,practice,offset],
   );
 }
 return { db, season };
}

const files = ['01_onboarding_completion.sql','02_day2_and_day7_return.sql','03_week1_completion.sql','04_week3_active.sql','05_seasons_per_week.sql'];

test('retention queries run against the real schema and count the expected cohort', async(t)=>{
 const { db } = await setup(); t.after(()=>db.close());
 for (const file of files) {
  const sql=await readFile(`supabase/retention/${file}`,'utf8');
  const result=await db.query(sql);
  assert.ok(Array.isArray(result.rows), `${file} must return rows`);
 }
 const onboarding=(await db.query(await readFile(`supabase/retention/${files[0]}`,'utf8'))).rows;
 assert.equal(onboarding.reduce((sum,row)=>sum+Number(row.accounts_onboarded),0),1,'the account counts once as onboarded');
 const returns=(await db.query(await readFile(`supabase/retention/${files[1]}`,'utf8'))).rows[0];
 assert.equal(Number(returns.eligible_day2),1);
 assert.equal(Number(returns.returned_day2),1);
 assert.equal(Number(returns.eligible_day7),1);
 assert.equal(Number(returns.returned_day7),1);
 assert.equal(returns.day2_rate_pct,'100.0');
 const week1=(await db.query(await readFile(`supabase/retention/${files[2]}`,'utf8'))).rows[0];
 assert.equal(Number(week1.eligible_accounts),1);
 assert.equal(Number(week1.completed_any_week1),1);
 assert.equal(Number(week1.avg_counted_days),2);
 const week3=(await db.query(await readFile(`supabase/retention/${files[3]}`,'utf8'))).rows[0];
 assert.equal(Number(week3.eligible_accounts),1);
 assert.equal(Number(week3.active_in_week3),1);
 const seasons=(await db.query(await readFile(`supabase/retention/${files[4]}`,'utf8'))).rows;
 assert.equal(seasons.reduce((sum,row)=>sum+Number(row.first_seasons),0),1);
});

test('the retention queries stay outside the app reach', async()=>{
 const retention=await readFile('supabase/retention/README.md','utf8');
 assert.match(retention,/service\/owner role/i);
 assert.match(retention,/must never be reachable by an app client/i);
 for (const file of files) {
  const sql=await readFile(`supabase/retention/${file}`,'utf8');
  assert.doesNotMatch(sql,/^\s*(create|grant|alter|insert|update|delete|drop)\b/im,`${file} must be read-only`);
 }
});
