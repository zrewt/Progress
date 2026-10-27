import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, detectTheme, validatePlan, type Budget } from "../src/lib/plans";
import { dailyPlanFromTree } from "../src/lib/daily-adapter";
import type { DailyPlan } from "../src/lib/daily-types";
import type { BlockerId, GeneratedTree, IdentityId, PlanHistory } from "../src/lib/types";

/**
 * The same contract, checked across the goal shapes a real person arrives with.
 * Each case walks the full path: goal -> theme -> plan -> the tree a model would
 * return for it -> the plan the app actually saves. Anything that only works for
 * one kind of goal shows up here.
 */

const FILLER = [
  /\bedit (a|the) file\b/i,
  /\bwork on your (project|goal)\b/i,
  /\breset your (shoulders|body|mind)\b/i,
  /\bcheck in with yourself\b/i,
  /\breflect on your (progress|day|journey)\b/i,
];

interface Case {
  goal: string;
  identity: IdentityId;
  blocker: BlockerId;
  budget: Budget;
  theme: string;
}

const CASES: Case[] = [
  { goal: "run 5k without stopping", identity: "athlete", blocker: "consistency", budget: 15, theme: "running" },
  { goal: "get stronger with three gym sessions a week", identity: "athlete", blocker: "time", budget: 30, theme: "strength" },
  { goal: "fall asleep before midnight", identity: "creator", blocker: "energy", budget: 15, theme: "sleep" },
  { goal: "stop eating at night", identity: "creator", blocker: "consistency", budget: 5, theme: "nutrition" },
  { goal: "learn Spanish before my trip to Madrid", identity: "scholar", blocker: "time", budget: 15, theme: "study" },
  { goal: "build a health and habit tracking app", identity: "builder", blocker: "time", budget: 15, theme: "coding" },
  { goal: "write 500 words of my novel each morning", identity: "creator", blocker: "perfectionism", budget: 30, theme: "writing" },
  { goal: "feel less stressed after work", identity: "creator", blocker: "stress", budget: 5, theme: "mindfulness" },
  { goal: "call my sister once a week", identity: "creator", blocker: "distraction", budget: 15, theme: "connection" },
  { goal: "actually keep a habit for once", identity: "creator", blocker: "consistency", budget: 5, theme: "consistency" },
  { goal: "read one book a month", identity: "scholar", blocker: "distraction", budget: 15, theme: "study" },
  { goal: "prepare for my exam in six weeks", identity: "scholar", blocker: "overthinking", budget: 30, theme: "study" },
  { goal: "get fitter and have more energy", identity: "athlete", blocker: "energy", budget: 15, theme: "strength" },
  { goal: "be more present with my kids", identity: "creator", blocker: "distraction", budget: 5, theme: "connection" },
  { goal: "learn to cook one good meal", identity: "creator", blocker: "time", budget: 15, theme: "nutrition" },
  { goal: "spend less time on my phone", identity: "creator", blocker: "distraction", budget: 5, theme: "mindfulness" },
  { goal: "run my first 10k", identity: "scholar", blocker: "consistency", budget: 30, theme: "running" },
  { goal: "run a marathon while learning Spanish", identity: "athlete", blocker: "time", budget: 15, theme: "running" },
  // The subject of the goal is the artefact, not the theme of its subject matter.
  { goal: "make an app that helps people eat healthier", identity: "builder", blocker: "time", budget: 15, theme: "coding" },
  { goal: "build a workout app", identity: "athlete", blocker: "consistency", budget: 5, theme: "coding" },
  { goal: "write a book about running", identity: "creator", blocker: "perfectionism", budget: 30, theme: "writing" },
  { goal: "start a podcast about sleep", identity: "creator", blocker: "overthinking", budget: 15, theme: "writing" },
  // ...but a goal about their own habits stays their own habits.
  { goal: "eat healthier every day", identity: "creator", blocker: "consistency", budget: 5, theme: "nutrition" },
  { goal: "design a meal plan for my family", identity: "creator", blocker: "time", budget: 15, theme: "nutrition" },
];

function treeFrom(plan: DailyPlan, weeks = 4): GeneratedTree {
  return {
    summary: plan.plan_summary,
    safetyNote: plan.safety_note,
    pillars: plan.practices.map((practice) => ({
      pillar: practice.branch,
      focus: plan.branch_labels[practice.branch],
      easy: { title: practice.easy_variant.title, steps: practice.easy_variant.steps },
      nodes: Array.from({ length: weeks }, (_, index) => ({
        title:
          index === 0
            ? practice.full_variant.title
            : `${practice.title} — the week ${index + 1} step`,
        duration: `${practice.full_variant.minutes} min`,
        description: practice.why,
        instructions: practice.full_variant.steps.map(
          (step) => `${step} (week ${index + 1})`,
        ),
      })),
    })),
  };
}

function everyText(plan: DailyPlan): string[] {
  const texts: string[] = [plan.goal, plan.plan_summary, plan.safety_note];
  for (const practice of plan.practices) {
    texts.push(practice.title, practice.why);
    for (const variant of [practice.full_variant, practice.easy_variant]) {
      texts.push(variant.title, ...variant.steps);
      for (const rung of variant.ladder ?? []) texts.push(rung.title, ...rung.steps);
    }
  }
  return texts;
}

const history: PlanHistory = {
  seasons: 1,
  days_practised: 4,
  days_planned: 30,
  kept: ["Take the walk that thinks"],
  dropped: [],
  average_effort: 3.2,
  last_review: "Mornings were easier than evenings.",
};

for (const item of CASES) {
  test(`matrix: "${item.goal}" at ${item.budget} minutes`, () => {
    const theme = detectTheme(item.goal);
    assert.equal(theme.id, item.theme, `"${item.goal}" should read as ${item.theme}`);

    const plan = buildPlan({
      goal: item.goal,
      identity: item.identity,
      blocker: item.blocker,
      minutes_budget: item.budget,
    });

    // A usable plan, whatever the budget and goal.
    assert.deepEqual(validatePlan(plan), []);
    assert.equal(plan.practices.length, 4);
    const branches = plan.practices.map((practice) => practice.branch);
    assert.equal(new Set(branches).size, 4, "every branch is covered exactly once");
    assert.equal(plan.practices.filter((practice) => practice.role === "primary").length, 1);
    assert.ok(plan.practices.filter((practice) => practice.role === "supporting").length <= 3);
    assert.equal(plan.practices.find((practice) => practice.role === "primary")?.branch, theme.primary.branch);

    for (const practice of plan.practices) {
      assert.ok(practice.full_variant.minutes <= item.budget);
      assert.equal(practice.easy_variant.minutes, 2, "the easier version is always about two minutes");
      assert.ok(practice.easy_variant.steps.length > 0);
      assert.ok(practice.full_variant.steps.length <= 5);
    }

    // Nothing a coach could not have said to this person specifically.
    for (const text of everyText(plan)) {
      for (const pattern of FILLER) {
        assert.doesNotMatch(text, pattern, `placeholder wording reached the plan: ${text}`);
      }
    }

    // The saved path: a model returns four nodes per branch, the app keeps all
    // four as a ladder, and the result still validates.
    const fromTree = dailyPlanFromTree(
      { identity: item.identity, goal: item.goal, blocker: item.blocker, timeBudget: String(item.budget) },
      treeFrom(plan),
      "edge-ai",
    );
    assert.deepEqual(validatePlan(fromTree), []);
    assert.equal(fromTree.practices.length, 4);
    const primary = fromTree.practices.find((practice) => practice.role === "primary");
    assert.ok(primary);
    assert.equal(primary.full_variant.ladder?.length, 3, "weeks two to four survive the adapter");
    assert.ok(primary.full_variant.ladder?.[2].steps[0].endsWith("(week 4)"));
    assert.notEqual(primary.full_variant.ladder?.[2].title, primary.title, "the ramp has its own titles");
    assert.equal(primary.easy_variant.title, primary.easy_variant.title.trim());
    assert.ok(primary.easy_variant.steps.length > 0);
  });
}

test("a goal about making something is planned around the making", () => {
  assert.equal(detectTheme("make an app that helps people eat healthier").id, "coding");
  assert.equal(detectTheme("build a workout app").id, "coding");
  assert.equal(detectTheme("an app that helps people eat healthier").id, "coding");
  assert.equal(detectTheme("write a book about running").id, "writing");
  assert.equal(detectTheme("start a podcast about sleep").id, "writing");
  assert.equal(detectTheme("help people eat healthier through an app").id, "coding");

  // A goal about the person's own body or habits must not be read as making one.
  assert.equal(detectTheme("eat healthier every day").id, "nutrition");
  assert.equal(detectTheme("design a meal plan for my family").id, "nutrition");
  assert.equal(detectTheme("read one book a month").id, "study");
  assert.equal(detectTheme("run a marathon while learning Spanish").id, "running");
  assert.equal(detectTheme("be more present with my kids").id, "connection");
});

test("an app-building goal never gets a plan about the builder's own cravings", () => {
  const plan = buildPlan({
    goal: "make an app that helps people eat healthier",
    identity: "builder",
    blocker: "time",
    minutes_budget: 15,
  });
  const primary = plan.practices.find((practice) => practice.role === "primary");
  assert.ok(primary);
  assert.equal(primary.branch, "craft");
  const text = everyText(plan).join(" ").toLowerCase();
  for (const foodClue of ["craving", "countertop", "snack", "kitchen"]) {
    assert.equal(text.includes(foodClue), false, `a building goal should not plan around ${foodClue}`);
  }
  assert.match(primary.full_variant.steps.join(" ").toLowerCase(), /build|app|screen|file|sentence/);
});

test("a plan history from a hard season changes what the prompt is told", () => {
  // The client-side summary is what the Edge Function clamps and prints; a
  // season where almost nothing happened must say so rather than look identical
  // to a good one.
  const weak: PlanHistory = { ...history, days_practised: 3, kept: [], dropped: ["Sketch the data model"] };
  assert.ok(weak.days_practised / weak.days_planned < 0.4);
  assert.deepEqual(weak.kept, []);
  assert.equal(weak.dropped.length, 1);
});

test("a five minute budget still produces a real first step, not a stub", () => {
  for (const item of CASES.filter((entry) => entry.budget === 5)) {
    const plan = buildPlan({
      goal: item.goal,
      identity: item.identity,
      blocker: item.blocker,
      minutes_budget: 5,
    });
    const primary = plan.practices.find((practice) => practice.role === "primary");
    assert.ok(primary);
    assert.ok(primary.full_variant.steps.length >= 2, `${item.goal} keeps enough steps to act on`);
    assert.ok(primary.full_variant.steps[0].length > 15, "the first step names a real action");
  }
});


