import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const FULL = 'supabase/apply_all_stages.sql';
const REMAINING = 'supabase/apply_remaining.sql';
/** The migrations a project set up with the old four-file bundle plus personalization has. */
const ALREADY_APPLIED = [
  '202610250001_daily_loop.sql',
  '202610250002_backfill.sql',
  '202610250003_weekly_review_and_edits.sql',
  '202610250004_consent_and_quota.sql',
  '202610250005_personalization.sql',
];

/** Mirrors the concatenation rule: one top-level begin/commit removed, edges trimmed. */
function bodyOf(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const begin = lines.indexOf('begin;');
  if (begin >= 0) lines.splice(begin, 1);
  const commit = lines.lastIndexOf('commit;');
  if (commit >= 0) lines.splice(commit, 1);
  return lines.join('\n').trim();
}

async function migrationFiles() {
  return (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
}

async function assertCovers(bundlePath, files) {
  const bundle = (await readFile(bundlePath, 'utf8')).replace(/\r\n/g, '\n');
  assert.equal((bundle.match(/^begin;$/gm) ?? []).length, 1, `${bundlePath}: exactly one transaction starts`);
  assert.equal((bundle.match(/^commit;$/gm) ?? []).length, 1, `${bundlePath}: exactly one transaction commits`);

  let cursor = 0;
  for (const file of files) {
    assert.match(bundle, new RegExp(`^-- From supabase/migrations/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    const body = bodyOf(await readFile(`supabase/migrations/${file}`, 'utf8'));
    const at = bundle.indexOf(body, cursor);
    assert.ok(at >= cursor, `${file} is missing from ${bundlePath} or appears out of order`);
    cursor = at + body.length;
    assert.equal(bundle.indexOf(body, cursor), -1, `${file} appears more than once in ${bundlePath}`);
  }
}

async function emptyProject() {
  const db = await PGlite.create();
  await db.exec(
    `create role anon; create role authenticated; create schema auth;
     create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
     create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
     grant usage on schema auth,public to authenticated,anon;
     grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(await readFile('supabase/schema.sql', 'utf8'));
  await db.exec('grant all on public.profiles,public.nodes to authenticated;');
  return db;
}

async function hasColumn(db, table, column) {
  return (await db.query(
    'select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3',
    ['public', table, column],
  )).rows.length === 1;
}

async function hasFunction(db, name) {
  return (await db.query(
    "select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",
    [name],
  )).rows.length === 1;
}

test('the full setup contains every migration once, in filename order', async () => {
  await assertCovers(FULL, await migrationFiles());
});

test('the remaining file contains only the migrations an existing project lacks', async () => {
  const outstanding = (await migrationFiles()).filter((file) => !ALREADY_APPLIED.includes(file));
  assert.deepEqual(outstanding, [
    '202610270001_target_dates.sql',
    '202610270002_safety.sql',
    '202610280001_midweek_adaptation.sql',
    '202610280002_budgets_and_questions.sql',
  ], 'the assumption this file is built on has changed; rebuild it');
  await assertCovers(REMAINING, outstanding);
});

test('the full setup applies to an empty project, then refuses a second run', async (t) => {
  const db = await emptyProject();
  t.after(() => db.close());

  const bundle = await readFile(FULL, 'utf8');
  await db.exec(bundle);

  for (const [table, column] of [
    ['seasons', 'target_date'],
    ['seasons', 'season_length_days'],
    ['seasons', 'goal_category'],
    ['seasons', 'conservative_mode'],
    ['seasons', 'progression_paused'],
    ['seasons', 'personalization_context'],
    ['profiles', 'age_bracket'],
    ['profiles', 'conservative_mode'],
    ['completion_events', 'something_hurt'],
  ]) {
    assert.ok(await hasColumn(db, table, column), `missing ${table}.${column}`);
  }
  for (const name of ['set_lighter_week', 'record_pain', 'set_age_bracket', 'set_personalization_context', 'accept_practice_week', 'start_next_season']) {
    assert.ok(await hasFunction(db, name), `missing function ${name}`);
  }
  const tables = new Set(
    (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map((row) => row.tablename),
  );
  for (const table of ['practice_weeks', 'weekly_reviews', 'plan_versions', 'generation_usage', 'legacy_xp_grants']) {
    assert.ok(tables.has(table), `missing table ${table}`);
  }
  assert.equal((await db.query("select 1 from pg_trigger where tgname='check_signup_age'")).rows.length, 1, 'signup age guard is created');
  assert.match((await db.query("select pg_get_constraintdef(oid) def from pg_constraint where conname='seasons_minutes_budget_check'")).rows[0].def, /60/);
  assert.equal((await db.query('select count(*)::int n from public.seasons')).rows[0].n, 0, 'no season is invented for an empty project');

  // A second run must abort rather than half-apply anything.
  await assert.rejects(() => db.exec(bundle));
  await db.exec('rollback;');
  assert.ok(await hasFunction(db, 'set_lighter_week'), 'a refused second run leaves the first setup intact');
});

test('the remaining file applies on top of the already-migrated schema', async (t) => {
  const db = await emptyProject();
  t.after(() => db.close());

  // Reproduce the live project: the old four-file setup plus the personalization migration.
  for (const file of ALREADY_APPLIED) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
  assert.equal(await hasColumn(db, 'seasons', 'target_date'), false, 'the live baseline must not already have target dates');
  assert.equal(await hasColumn(db, 'profiles', 'age_bracket'), false, 'the live baseline must not already have safety fields');
  assert.equal(await hasFunction(db, 'set_lighter_week'), false, 'the live baseline must not already have the midweek function');

  const remaining = await readFile(REMAINING, 'utf8');
  await db.exec(remaining);

  assert.ok(await hasColumn(db, 'seasons', 'target_date'));
  assert.ok(await hasColumn(db, 'seasons', 'season_length_days'));
  assert.ok(await hasColumn(db, 'profiles', 'age_bracket'));
  assert.ok(await hasColumn(db, 'seasons', 'goal_category'));
  assert.ok(await hasColumn(db, 'completion_events', 'something_hurt'));
  assert.ok(await hasFunction(db, 'set_lighter_week'));
  assert.ok(await hasFunction(db, 'record_pain'));
  assert.equal((await db.query("select 1 from pg_tables where schemaname='public' and tablename='practice_weeks'")).rows.length, 1);
  assert.equal((await db.query("select 1 from pg_trigger where tgname='check_signup_age'")).rows.length, 1);
  assert.match((await db.query("select pg_get_constraintdef(oid) def from pg_constraint where conname='seasons_minutes_budget_check'")).rows[0].def, /60/);

  // Running it again is refused, and the first application survives.
  await assert.rejects(() => db.exec(remaining));
  await db.exec('rollback;');
  assert.ok(await hasFunction(db, 'set_lighter_week'));
  assert.ok(await hasColumn(db, 'profiles', 'age_bracket'));
});
