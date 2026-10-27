/**
 * Checks that the Supabase project in .env has the tables the app needs.
 *
 *   npm run db:check
 *
 * Uses only the public URL and publishable/anon key — never a secret key, and
 * never a signed-in session. Because an anonymous request has no user, RLS (and
 * the missing anon grant) means a healthy project answers 401 "permission denied
 * for table X" — which still proves the table exists. A missing table answers
 * 404 / PGRST205 instead, and that is the failure worth reporting.
 *
 * This file is a smoke test only. It never asks you to run supabase/schema.sql,
 * which contains destructive legacy cleanup and must not be re-run in production.
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

// The tables a Stage 1–3 database must have. Checking columns as well catches a
// half-applied schema.
const checks = [
  { table: "profiles", select: "identity,goal,time_budget,timezone,blocker,ai_consent_version" },
  { table: "seasons", select: "goal,status,plan_source,plan_summary,minutes_budget" },
  { table: "practices", select: "branch,role,cadence,full_variant,easy_variant" },
  { table: "milestones", select: "tier,required_days" },
  { table: "completion_events", select: "kind,client_event_id,local_date" },
  { table: "weekly_reviews", select: "week_start,decision" },
  { table: "generation_usage", select: "usage_day,used" },
  { table: "legacy_xp_grants", select: "xp" },
];

function classify(status, body) {
  const text = body ?? "";
  const missing =
    status === 404 ||
    /PGRST205|Could not find the table|does not exist/i.test(text);
  if (missing) return "missing";
  if (status === 401 || status === 403) return "protected";
  if (status >= 200 && status < 300) return "open";
  return "error";
}

function messageOf(body) {
  try {
    return JSON.parse(body).message ?? body;
  } catch {
    return body;
  }
}

let healthy = true;

for (const { table, select } of checks) {
  try {
    const response = await fetch(
      `${url}/rest/v1/${table}?select=${select}&limit=1`,
      { headers },
    );
    const body = await response.text();
    const state = classify(response.status, body);
    if (state === "protected" || state === "open") {
      console.log(
        `ok   ${table}${state === "protected" ? "  (exists; anonymous access denied as expected)" : ""}`,
      );
      continue;
    }
    healthy = false;
    console.error(`fail ${table}: ${response.status} ${messageOf(body)}`);
  } catch (error) {
    healthy = false;
    console.error(`fail ${table}: ${error instanceof Error ? error.message : error}`);
  }
}

if (!healthy) {
  console.error(
    "\nA table above is missing or unreachable. Apply the migrations in order —\n" +
      "docs/RELEASE_CHECKLIST.md lists them. Do NOT re-run supabase/schema.sql:\n" +
      "it contains destructive legacy cleanup.",
  );
  process.exit(1);
}

console.log("\nSupabase schema is reachable and protected.");
