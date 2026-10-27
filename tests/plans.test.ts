import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEMES,
  detectTheme,
  buildPlan,
  validatePlan,
  alternativesFor,
  variantFor,
  BRANCH_ALTERNATIVES,
  BUDGETS,
  MAX_VARIANT_STEPS,
} from "../src/lib/plans";

const GOALS: [string, string][] = [
  ["Run my first 5k", "running"],
  ["Go for a run three times a week", "running"],
  ["Start jogging in the mornings", "running"],
  ["Build my cardio fitness", "running"],
  ["Get stronger", "strength"],
  ["Go to the gym on weekdays", "strength"],
  ["Lift weights twice a week", "strength"],
  ["Do more pushups", "strength"],
  ["Improve my sleep", "sleep"],
  ["Get to bed at a decent hour", "sleep"],
  ["Wake up at the same time every day", "sleep"],
  ["Stop eating at night", "nutrition"],
  ["Cut sugar", "nutrition"],
  ["No late-night snacking", "nutrition"],
  ["Cook at home more often", "nutrition"],
  ["Eat more vegetables", "nutrition"],
  ["Practise Spanish every day", "study"],
  ["Learn to speak French", "study"],
  ["Read more books", "study"],
  ["Pass my exam", "study"],
  ["Study for my course", "study"],
  ["Build a daily writing habit", "writing"],
  ["Write a novel", "writing"],
  ["Draw every day", "writing"],
  ["Publish one blog post a week", "writing"],
  ["Learn to code", "coding"],
  ["Ship my app", "coding"],
  ["Debug my project", "coding"],
  ["Finish my side project", "coding"],
  ["Meditate each morning", "mindfulness"],
  ["Reduce stress", "mindfulness"],
  ["Stay calm when I feel anxious", "mindfulness"],
  ["Spend more time with friends", "connection"],
  ["Call my family weekly", "connection"],
  ["Meet new people", "connection"],
  ["Be more consistent", "consistency"],
  ["Show up for myself", "consistency"],
  ["Stop procrastinating", "consistency"],
  ["Practise guitar every day", "consistency"],
  ["Write code in the evening", "coding"],
];

test("theme detection tolerates wording, order and word forms", () => {
  for (const [goal, expected] of GOALS) {
    assert.equal(detectTheme(goal).id, expected, `"${goal}" should be ${expected}`);
  }
  assert.equal(detectTheme("  RUNNING, three times a week! ").id, "running");
  assert.equal(detectTheme("").id, "consistency");
  assert.equal(detectTheme("a").id, "consistency");
});

test("every theme names one daily practice and three weekly supports across all branches", () => {
  assert.equal(THEMES.length, 10);
  for (const theme of THEMES) {
    const plan = buildPlan({ goal: "x", identity: "athlete", blocker: "consistency", minutes_budget: 15, theme });
    assert.equal(plan.practices.filter((p) => p.role === "primary").length, 1, theme.id);
    assert.equal(plan.practices.filter((p) => p.cadence === "daily").length, 1, theme.id);
    assert.equal(plan.practices.length, 4, theme.id);
    const branches = new Set(plan.practices.map((p) => p.branch));
    assert.equal(branches.size, 4, `${theme.id} should span four branches`);
    assert.deepEqual(validatePlan(plan), [], theme.id);
  }
});

test("variants stay inside the budget and the easy version is about two minutes", () => {
  for (const theme of THEMES) {
    for (const budget of BUDGETS) {
      const plan = buildPlan({ goal: "x", identity: "creator", blocker: "energy", minutes_budget: budget, theme });
      for (const practice of plan.practices) {
        assert.ok(practice.full_variant.minutes <= budget);
        assert.ok(practice.easy_variant.minutes <= 2);
        assert.ok(practice.easy_variant.steps.length >= 2);
        assert.ok(practice.full_variant.steps.length >= 3);
        // The database rejects a variant with more than five steps, so content
        // that grows past the cap must fail here rather than in production.
        assert.ok(
          practice.full_variant.steps.length <= MAX_VARIANT_STEPS,
          `${theme.id} ${budget}min ${practice.title} has ${practice.full_variant.steps.length} steps`,
        );
        assert.ok(practice.easy_variant.steps.length <= MAX_VARIANT_STEPS, `${theme.id} easy steps`);
        assert.notEqual(practice.full_variant.title, practice.easy_variant.title);
      }
    }
  }
});

test("replacement practices also fit the step limit the server enforces", () => {
  for (const branch of Object.keys(BRANCH_ALTERNATIVES) as (keyof typeof BRANCH_ALTERNATIVES)[]) {
    for (const practice of BRANCH_ALTERNATIVES[branch]) {
      for (const budget of [15, 30] as const) {
        for (const kind of ["full", "easy"] as const) {
          const variant = variantFor(practice, budget, kind);
          assert.ok(variant.steps.length >= 1, practice.key);
          assert.ok(
            variant.steps.length <= MAX_VARIANT_STEPS,
            `${practice.key} ${kind} at ${budget}min has ${variant.steps.length} steps`,
          );
          assert.ok(variant.minutes <= budget, practice.key);
        }
      }
    }
  }
});

test("a plan that breaks the budget or adds obligations is rejected", () => {
  const plan = buildPlan({ goal: "x", identity: "athlete", blocker: "consistency", minutes_budget: 5, theme: THEMES[0] });
  const overBudget = { ...plan, practices: plan.practices.map((p, i) => (i === 0 ? { ...p, full_variant: { ...p.full_variant, minutes: 20 } } : p)) };
  assert.ok(validatePlan(overBudget).some((problem) => problem.includes("exceeds")));

  const twoPrimaries = { ...plan, practices: plan.practices.map((p) => ({ ...p, role: "primary" as const })) };
  assert.ok(validatePlan(twoPrimaries).some((problem) => problem.includes("exactly one")));

  const timedStep = { ...plan, practices: plan.practices.map((p, i) => (i === 0 ? { ...p, full_variant: { ...p.full_variant, steps: ["Run for 45 minutes."] } } : p)) };
  assert.ok(validatePlan(timedStep).some((problem) => problem.includes("more time than the budget")));

  const emptySteps = { ...plan, practices: plan.practices.map((p, i) => (i === 0 ? { ...p, easy_variant: { ...p.easy_variant, steps: [] } } : p)) };
  assert.ok(validatePlan(emptySteps).some((problem) => problem.includes("no easy steps")));

  const tooManySteps = {
    ...plan,
    practices: plan.practices.map((p, i) =>
      i === 0 ? { ...p, full_variant: { ...p.full_variant, steps: ["One.", "Two.", "Three.", "Four.", "Five.", "Six."] } } : p,
    ),
  };
  assert.ok(validatePlan(tooManySteps).some((problem) => problem.includes("more than 5")));
});

test("replacement options stay on the branch and never repeat the plan", () => {
  const plan = buildPlan({ goal: "x", identity: "athlete", blocker: "consistency", minutes_budget: 15, theme: THEMES[0] });
  const inUse = plan.practices.filter((p) => p.branch === "body").map((p) => p.title);
  const options = alternativesFor("body", []);
  assert.equal(options.length, 3);
  assert.ok(options.every((option) => option.branch === "body"));
  assert.equal(new Set(options.map((option) => option.key)).size, 3);
  assert.ok(!options.some((option) => inUse.includes(option.title)));
  assert.equal(alternativesFor("body", options.slice(0, 2).map((option) => option.key)).length, 1);
});
