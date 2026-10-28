import { test } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, buildPlan, validatePlan, validatePractice } from "../src/lib/plans";
import { clampDurationToBudget } from "../src/lib/safety";

test("longer sessions are offered and respected", () => {
  assert.deepEqual([...BUDGETS], [5, 15, 30, 45, 60]);

  for (const budget of [45, 60] as const) {
    const plan = buildPlan({
      goal: "prepare for a long supported ride",
      identity: "athlete",
      blocker: "time",
      minutes_budget: budget,
    });
    assert.equal(plan.minutes_budget, budget);
    assert.deepEqual(validatePlan(plan), []);
    for (const practice of plan.practices) {
      assert.ok(practice.full_variant.minutes <= budget);
      assert.ok(practice.easy_variant.minutes <= 2);
    }
  }

  const plan = buildPlan({ goal: "study for an exam", identity: "scholar", blocker: "time", minutes_budget: 60 });
  const problems = validatePractice({ ...plan.practices[0], full_variant: { ...plan.practices[0].full_variant, minutes: 61 } }, 60);
  assert.ok(problems.some((problem) => problem.includes("exceeds the 60 minute budget")));
});

test("durations are clamped to the chosen budget rather than the old 30-minute cap", () => {
  assert.equal(clampDurationToBudget("45 min", 1, "60"), "45 min");
  assert.equal(clampDurationToBudget("45 min", 1, "45"), "45 min");
  assert.equal(clampDurationToBudget("90 min", 1, "60"), "60 min");
  assert.equal(clampDurationToBudget("30 min", 1, "30"), "30 min");
  // Unknown legacy values keep the conservative ceiling.
  assert.equal(clampDurationToBudget("45 min", 1, "unknown"), "30 min");
});
