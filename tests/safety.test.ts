import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyGoal, safeForCategory, requiresPreparation, assessGoal, validatePracticeText, validateStepsWithinBudget } from "../src/lib/safety-rules";
import { eligibleAge } from "../src/lib/age";
import { buildSeedPlan } from "../src/lib/gemini";
import { dailyPlanFromTree } from "../src/lib/daily-adapter";
import { assessGoalSafety } from "../src/lib/safety";

test("age eligibility stores brackets only and rejects under 13 or missing choices", () => {
  assert.equal(eligibleAge("under_13"), false); assert.equal(eligibleAge(null), false);
  assert.equal(eligibleAge("13_17"), true); assert.equal(eligibleAge("18_plus"), true);
});
test("goal categories only escalate; making an app is not performing the sport", () => {
  assert.equal(classifyGoal("climb the Matterhorn"), "high-risk");
  assert.equal(classifyGoal("learn diving"), "high-risk");
  assert.equal(classifyGoal("study division"), "ordinary");
  assert.equal(classifyGoal("play tennis"), "physical");
  assert.equal(classifyGoal("build a climbing app"), "ordinary");
  assert.equal(classifyGoal("build an app and climb Everest"), "high-risk");
  assert.equal(classifyGoal("climb Everest", "ordinary"), "high-risk");
  assert.equal(classifyGoal("write a novel", "physical"), "physical");
  assert.equal(safeForCategory("Map out the Hörnli hut summit route", "high-risk"), false);
});
test("high-risk and conservative physical starter plans contain preparation only", () => {
  for (const goal of ["climb the Matterhorn", "play tennis"]) {
    const answers = { identity: "athlete" as const, goal, blocker: "consistency" as const, timeBudget: "15", conservativeMode: true };
    const tree = buildSeedPlan(answers);
    const plan = dailyPlanFromTree(answers, tree, "seed-engine");
    assert.equal(plan.conservative_mode, true);
    assert.equal(plan.plan_source, "local");
    assert.match(plan.safety_note, /qualified instruction/);
    assert.ok(plan.practices.every(p => safeForCategory(JSON.stringify(p), "high-risk")));
    assert.equal(requiresPreparation(classifyGoal(goal), true), true);
  }
});
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
