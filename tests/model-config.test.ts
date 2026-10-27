import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Google retires model names for new projects without much warning: 2.5 Flash
 * began answering "no longer available to new users" in mid-2026, and every plan
 * silently became the on-device library because the failure looked like a
 * network problem. This test keeps the configured names current and ordered.
 */
test("the plan function asks for a model that exists for new projects", async () => {
  const source = await readFile("supabase/functions/generate-tree/index.ts", "utf8");
  assert.match(source, /MODEL_FALLBACKS\s*=\s*\["gemini-3\.8-flash"/);
  assert.doesNotMatch(source, /["'`]gemini-2\.5-flash["'`]/);
  // Gemini 3 thinks hard by default, which outlasts a planning screen; the
  // shorter path is what keeps a sixteen-practice answer inside the budget.
  assert.match(source, /thinkingConfig:\s*\{\s*thinkingLevel:\s*"low"\s*\}/);
});

test("the release checklist does not tell the next person to use a retired model", async () => {
  const checklist = await readFile("docs/RELEASE_CHECKLIST.md", "utf8");
  assert.match(checklist, /gemini-3\.8-flash/);
  assert.doesNotMatch(checklist, /GEMINI_MODEL=gemini-2\.5-flash/);
});
