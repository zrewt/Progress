import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const BUNDLE = 'supabase/apply_all_stages.sql';

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

test('the one-file setup contains every migration once, in filename order', async () => {
  const files = await migrationFiles();
  const bundle = (await readFile(BUNDLE, 'utf8')).replace(/\r\n/g, '\n');
  assert.equal((bundle.match(/^begin;$/gm) ?? []).length, 1, 'exactly one transaction starts');
  assert.equal((bundle.match(/^commit;$/gm) ?? []).length, 1, 'exactly one transaction commits');

  let cursor = 0;
  for (const file of files) {
    assert.match(bundle, new RegExp(`^-- From supabase/migrations/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
    const body = bodyOf(await readFile(`supabase/migrations/${file}`, 'utf8'));
    const at = bundle.indexOf(body, cursor);
    assert.ok(at >= cursor, `${file} is missing from the bundle or appears out of order`);
    cursor = at + body.length;
    assert.equal(bundle.indexOf(body, cursor), -1, `${file} appears more than once`);
  }
});

test('the one-file setup applies to an empty project, then refuses a second run', async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(
    `create role anon; create role authenticated; create schema auth;
     create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
     create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
     grant usage on schema auth,public to authenticated,anon;
     grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(await readFile('supabase/schema.sql', 'utf8'));
  await db.exec('grant all on public.profiles,public.nodes to authenticated;');

  const bundle = await readFile(BUNDLE, 'utf8');
  await db.exec(bundle);

  const columns = new Set(
    (await db.query("select table_name||'.'||column_name as name from information_schema.columns where table_schema='public'")).rows.map((row) => row.name),
  );
  for (const column of [
    'seasons.target_date',
    'seasons.season_length_days',
    'seasons.goal_category',
    'seasons.conservative_mode',
    'seasons.progression_paused',
    'seasons.personalization_context',
    'profiles.age_bracket',
    'profiles.conservative_mode',
    'completion_events.something_hurt',
  ]) {
    assert.ok(columns.has(column), `missing ${column}`);
  }

  const functions = new Set(
    (await db.query("select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public'")).rows.map((row) => row.proname),
  );
  for (const name of ['set_lighter_week', 'record_pain', 'set_age_bracket', 'set_personalization_context', 'accept_practice_week', 'start_next_season']) {
    assert.ok(functions.has(name), `missing function ${name}`);
  }

  const tables = new Set(
    (await db.query("select tablename from pg_tables where schemaname='public'")).rows.map((row) => row.tablename),
  );
  for (const table of ['practice_weeks', 'weekly_reviews', 'plan_versions', 'generation_usage', 'legacy_xp_grants']) {
    assert.ok(tables.has(table), `missing table ${table}`);
  }

  assert.equal((await db.query("select 1 from pg_trigger where tgname='check_signup_age'")).rows.length, 1, 'signup age guard is created');
  assert.equal((await db.query('select count(*)::int n from public.seasons')).rows[0].n, 0, 'no season is invented for an empty project');

  // A second run must abort rather than half-apply anything. The failed
  // transaction is rolled back exactly as a SQL editor would roll it back.
  await assert.rejects(() => db.exec(bundle));
  await db.exec('rollback;');
  assert.ok(
    (await db.query("select 1 from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname='set_lighter_week'")).rows.length,
    'a refused second run leaves the first setup intact',
  );
});
