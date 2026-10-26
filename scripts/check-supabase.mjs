/**
 * Checks that the Supabase project in .env has the tables the app needs.
 *
 *   npm run db:check
 *
 * Uses only the public URL and publishable/anon key — never a secret key.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
const key = (
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
)?.trim();

if (!url || !key) {
  console.error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.",
  );
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

// Checking columns, not just table names, catches an old schema that still has
// the pre-identity profile or the fitness-only branch list.
const checks = [
  {
    table: "profiles",
    select: "identity,goal,time_budget,season_started_at",
  },
  { table: "nodes", select: "node_id,pillar,tier,status" },
];
let healthy = true;

for (const { table, select } of checks) {
  try {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=${select}&limit=1`,
      { headers },
    );
    if (response.ok) {
      console.log(`ok   ${table}`);
      continue;
    }
    healthy = false;
    const body = await response.text();
    let message = body;
    try {
      message = JSON.parse(body).message ?? body;
    } catch {
      /* plain text error */
    }
    console.error(`fail ${table}: ${response.status} ${message}`);
  } catch (error) {
    healthy = false;
    console.error(`fail ${table}: ${error instanceof Error ? error.message : error}`);
  }
}

if (!healthy) {
  console.error(
    "\nRun the latest supabase/schema.sql in the Supabase SQL Editor\n(SQL Editor → New query → Run), then retry: npm run db:check",
  );
  process.exit(1);
}

console.log("\nSupabase schema looks good.");
