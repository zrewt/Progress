import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assessGoal, validatePracticeText, validateStepsWithinBudget } from "../src/lib/safety-rules";
import { assessGoalSafety } from "../src/lib/safety";

test("ordinary evening and food goals are allowed", () => {
  for (const goal of ["stop eating at night", "cut sugar", "no late-night snacking", "cook at home more often"]) {
    assert.equal(assessGoal(goal).kind, "ok", goal);
    assert.equal(assessGoalSafety(goal).safe, true, goal);
  }
});

test("recovery goals take the supportive path, not the error path", () => {
  const cocaine = assessGoal("quit cocaine");
  assert.equal(cocaine.kind, "support");
  assert.equal(cocaine.support, "recovery");
  assert.ok(cocaine.message && !/error|invalid|not allowed/i.test(cocaine.message));
  assert.equal(assessGoalSafety("quit cocaine").safe, true);

  const selfHarm = assessGoal("stop self-harm");
  assert.equal(selfHarm.kind, "support");
  assert.equal(selfHarm.support, "self-harm");
  assert.match(selfHarm.message ?? "", /988/);
  assert.equal(assessGoalSafety("stop self-harm").safe, false);
});

test("dangerous requests are declined kindly with an explanation", () => {
  for (const goal of ["never sleep", "sleep 2 hours", "starve myself", "0 calories", "eat 900 calories a day", "water fast for 10 days", "take steroids"]) {
    const verdict = assessGoal(goal);
    assert.equal(verdict.kind, "decline", goal);
    assert.ok(verdict.message && verdict.message.length > 20, goal);
    assert.ok(!/disgusting|weak|failure|no excuses/i.test(verdict.message ?? ""), goal);
  }
});

test("generated output is validated in both directions", () => {
  assert.equal(validatePracticeText("Eat 100 calories per day").ok, false);
  assert.equal(validatePracticeText("Starve yourself until the number drops").ok, false);
  assert.equal(validatePracticeText("Sleep 3 hours a night").ok, false);
  assert.equal(validatePracticeText("Do not ignore pain").ok, true);
  assert.equal(validatePracticeText("Never train through sharp pain").ok, true);
  assert.equal(validatePracticeText("Eat 1800 calories across normal meals").ok, true);
  assert.equal(validatePracticeText("Put your phone out of reach and dim the lights").ok, true);
});

test("steps cannot exceed the chosen budget", () => {
  assert.equal(validateStepsWithinBudget(["Run for 45 minutes."], 30).ok, false);
  assert.equal(validateStepsWithinBudget(["Walk for 20 minutes."], 30).ok, true);
  assert.equal(validateStepsWithinBudget(["Eat 100 calories per day."], 30).ok, false);
});

test("the Edge Function copy matches the canonical rules", async () => {
  const source = await readFile("src/lib/safety-rules.ts", "utf8");
  const copy = await readFile("supabase/functions/generate-tree/safety-rules.ts", "utf8");
  const header = copy.split("\n")[0];
  assert.match(header, /GENERATED FILE/);
  assert.equal(copy.slice(header.length + 1), source, "run `npm run safety:sync` and commit the copy");
});
