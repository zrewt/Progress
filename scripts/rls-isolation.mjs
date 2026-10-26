#!/usr/bin/env node
// Live two-account isolation check. Requires a real project and two throwaway accounts:
//   TEST_A_EMAIL, TEST_A_PASSWORD, TEST_B_EMAIL, TEST_B_PASSWORD
// plus EXPO_PUBLIC_SUPABASE_URL and the publishable key (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// or EXPO_PUBLIC_SUPABASE_ANON_KEY). Never prints credentials.
//
// Run: node --env-file=.env scripts/rls-isolation.mjs
// Exit codes: 0 passed or skipped, 1 failed.
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const accounts = {
  A: { email: process.env.TEST_A_EMAIL, password: process.env.TEST_A_PASSWORD },
  B: { email: process.env.TEST_B_EMAIL, password: process.env.TEST_B_PASSWORD },
};

const missing = Object.entries(accounts).filter(([, value]) => !value.email || !value.password).map(([name]) => name);
if (!url || !key || missing.length) {
  console.log(`NOT RUN: rls isolation needs a project and two test accounts (missing: ${[...(!url ? ["url"] : []), ...(!key ? ["key"] : []), ...missing].join(", ")}).`);
  process.exit(0);
}

const failures = [];
const check = (label, ok) => {
  if (ok) console.log(`ok  ${label}`);
  else { failures.push(label); console.log(`FAIL ${label}`); }
};

async function signIn({ email, password }) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("sign-in failed");
  return client;
}

try {
  const a = await signIn(accounts.A);
  const b = await signIn(accounts.B);

  const { data: aSeasons } = await a.from("seasons").select("id,user_id");
  const { data: bSeasons } = await b.from("seasons").select("id,user_id");
  const aSeasonIds = new Set((aSeasons ?? []).map((row) => row.id));
  check("B never reads A's seasons", !(bSeasons ?? []).some((row) => aSeasonIds.has(row.id)));
  const aUserIds = new Set((aSeasons ?? []).map((row) => row.user_id));
  check("B's rows belong to a different account", (bSeasons ?? []).every((row) => !aUserIds.has(row.user_id)) || !(bSeasons ?? []).length);

  const { data: aEvents } = await a.from("completion_events").select("id");
  const { data: bEvents } = await b.from("completion_events").select("id");
  const aEventIds = new Set((aEvents ?? []).map((row) => row.id));
  check("B cannot read A's events", !(bEvents ?? []).some((row) => aEventIds.has(row.id)));

  const target = (aSeasons ?? [])[0];
  if (target) {
    const { error: foreign } = await b.rpc("get_progress", { p_season_id: target.id });
    check("foreign get_progress is rejected", Boolean(foreign));
    const { data: foreignEvents } = await b.from("completion_events").select("id").eq("season_id", target.id);
    check("no events leak for the foreign season", (foreignEvents ?? []).length === 0);
  } else {
    console.log("note: account A has no season yet; skipping season-scoped checks");
  }

  const { error: directWrite } = await b.from("completion_events").insert({ kind: "full" });
  check("direct event writes are denied", Boolean(directWrite));

  await a.auth.signOut();
  await b.auth.signOut();
} catch (error) {
  console.log(`FAIL ${error instanceof Error ? error.message : "unexpected error"}`);
  failures.push("unexpected error");
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll isolation checks passed");
