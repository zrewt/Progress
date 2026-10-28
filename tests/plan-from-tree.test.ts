import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyPlanFromTree } from "../src/lib/daily-adapter";
import { validatePlan } from "../src/lib/plans";
import { generateQuestions, normalizeTree, questionResponse } from "../src/lib/gemini";
import { GENERAL_QUESTIONS, validateQuestions } from "../supabase/functions/generate-tree/questions";
import type { GeneratedNode, GeneratedTree, OnboardingAnswers, PillarId } from "../src/lib/types";

const answers: OnboardingAnswers = {
  identity: "builder",
  goal: "build a health and habit tracking app",
  blocker: "time",
  timeBudget: "15",
};

const node = (branch: PillarId, overrides: Partial<GeneratedNode> = {}): GeneratedNode => ({
  title: `${branch} step for the tracking app`,
  duration: "15 min",
  description: `A ${branch} practice written for this exact goal.`,
  instructions: [
    "Open the habit tracker project and pick the smallest screen.",
    "Write one component for today's habit row.",
    "Save it and stop while it still feels unfinished.",
  ],
  ...overrides,
});

const tree = (overrides: Partial<GeneratedTree> = {}): GeneratedTree => ({
  summary: "A calm 30-day plan for the tracking app.",
  safetyNote: "Rest is part of the plan.",
  pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
    pillar,
    focus: `Focus for ${pillar}`,
    nodes: [node(pillar)],
  })),
  ...overrides,
});

test("the plan uses the practices written for this goal, not a shared template", () => {
  const plan = dailyPlanFromTree(answers, tree(), "edge-ai");
  const primary = plan.practices.find((practice) => practice.role === "primary");
  assert.ok(primary);
  assert.equal(primary.branch, "craft", "a builder's app goal belongs on the craft branch");
  assert.equal(primary.title, "craft step for the tracking app");
  assert.deepEqual(primary.full_variant.steps, node("craft").instructions);
  assert.equal(plan.plan_source, "ai");
});

test("a plan from the tree still has one daily practice and three weekly supports", () => {
  const plan = dailyPlanFromTree(answers, tree(), "edge-ai");
  assert.equal(plan.practices.length, 4);
  assert.equal(plan.practices.filter((practice) => practice.role === "primary").length, 1);
  assert.equal(plan.practices.filter((practice) => practice.cadence === "daily").length, 1);
  assert.equal(plan.practices.filter((practice) => practice.cadence === "weekly").length, 3);
  assert.deepEqual(validatePlan(plan), []);
});

test("the easier version is a real two-minute entry point", () => {
  const plan = dailyPlanFromTree(answers, tree(), "edge-ai");
  for (const practice of plan.practices) {
    assert.equal(practice.easy_variant.minutes, 2);
    assert.ok(practice.easy_variant.steps.length >= 1);
    assert.ok(practice.easy_variant.steps.length <= 5);
    assert.equal(practice.easy_variant.steps[0], practice.full_variant.steps[0]);
    assert.notEqual(practice.easy_variant.title, practice.full_variant.title);
  }
});

test("a node's own minutes are kept, but never past the chosen budget", () => {
  const small = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
      pillar,
      nodes: [node(pillar, { duration: "3 min" })],
    })),
  });
  assert.equal(dailyPlanFromTree({ ...answers, timeBudget: "15" }, small, "edge-ai").practices[0].full_variant.minutes, 3);
  const over = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
      pillar,
      nodes: [node(pillar, { duration: "45 min" })],
    })),
  });
  assert.equal(dailyPlanFromTree({ ...answers, timeBudget: "15" }, over, "edge-ai").practices[0].full_variant.minutes, 15);
});

test("long instruction lists cannot break the save", () => {
  const many = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
      pillar,
      nodes: [node(pillar, { instructions: ["One.", "Two.", "Three.", "Four.", "Five.", "Six.", "Seven."] })],
    })),
  });
  const plan = dailyPlanFromTree(answers, many, "edge-ai");
  for (const practice of plan.practices) assert.equal(practice.full_variant.steps.length, 5);
  assert.deepEqual(validatePlan(plan), []);
});

test("a branch the tree forgot falls back to the curated practice for that branch", () => {
  const partial = tree({
    pillars: [{ pillar: "craft", focus: "Writing the app", nodes: [node("craft")] }],
  });
  const plan = dailyPlanFromTree(answers, partial, "edge-ai");
  assert.equal(plan.practices.length, 4);
  const craft = plan.practices.find((practice) => practice.branch === "craft");
  const body = plan.practices.find((practice) => practice.branch === "body");
  assert.equal(craft?.title, "craft step for the tracking app");
  assert.ok(body?.title, "the missing branches still get a practice");
  assert.notEqual(body?.title, "craft step for the tracking app");
  assert.deepEqual(validatePlan(plan), []);
});

test("an unusable node falls back instead of saving something empty", () => {
  const broken = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
      pillar,
      nodes: [node(pillar, { title: "   ", description: "" })],
    })),
  });
  const plan = dailyPlanFromTree(answers, broken, "edge-ai");
  assert.deepEqual(validatePlan(plan), []);
  for (const practice of plan.practices) assert.ok(practice.title.trim().length > 0);
});

const fourWeeks = (pillar: PillarId) => ({
  pillar,
  focus: `Focus for ${pillar}`,
  easy: {
    title: `Two minutes for ${pillar}`,
    steps: [`Open the ${pillar} screen and do the smallest thing.`],
  },
  nodes: [1, 2, 3, 4].map((week) =>
    node(pillar, {
      title: `${pillar} week ${week} for the tracking app`,
      instructions: [`${pillar} week ${week} first action`, `${pillar} week ${week} second action`],
    }),
  ),
});

test("the whole tree becomes a four-week ramp, not one repeated step", () => {
  const plan = dailyPlanFromTree(answers, tree({ pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map(fourWeeks) }), "edge-ai");
  const primary = plan.practices.find((practice) => practice.role === "primary");
  assert.ok(primary);
  assert.equal(primary.title, "craft week 1 for the tracking app");
  assert.deepEqual(
    primary.full_variant.ladder?.map((rung) => rung.title),
    ["craft week 2 for the tracking app", "craft week 3 for the tracking app", "craft week 4 for the tracking app"],
  );
  // Week four is recognisably the same practice, one step further along.
  assert.deepEqual(primary.full_variant.ladder?.[2].steps, ["craft week 4 first action", "craft week 4 second action"]);
  assert.deepEqual(validatePlan(plan), []);
});

test("the model's own two-minute version is kept when it is safe and short", () => {
  const plan = dailyPlanFromTree(answers, tree({ pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map(fourWeeks) }), "edge-ai");
  for (const practice of plan.practices) {
    assert.equal(practice.easy_variant.minutes, 2);
    assert.equal(practice.easy_variant.title, `Two minutes for ${practice.branch}`);
  }
});

test("a tree without an easy version still yields a real two-minute entry point", () => {
  const plan = dailyPlanFromTree(answers, tree(), "edge-ai");
  for (const practice of plan.practices) {
    assert.equal(practice.easy_variant.minutes, 2);
    assert.equal(practice.easy_variant.steps[0], practice.full_variant.steps[0]);
    assert.ok(practice.easy_variant.steps.length >= 1);
  }
  assert.deepEqual(validatePlan(plan), []);
});

test("a ladder rung never suggests more time than the budget", () => {
  const over = (pillar: PillarId) => {
    const built = fourWeeks(pillar);
    return {
      ...built,
      nodes: built.nodes.map((item) => ({ ...item, duration: "45 min" })),
    };
  };
  const plan = dailyPlanFromTree(answers, tree({ pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map(over) }), "edge-ai");
  for (const practice of plan.practices) {
    assert.equal(practice.full_variant.minutes, 15);
    for (const rung of practice.full_variant.ladder ?? []) assert.equal(rung.minutes, 15);
  }
  assert.deepEqual(validatePlan(plan), []);
});

test("one branch that breaks the budget is repaired without losing the rest of the draft", () => {
  const mixed = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) =>
      pillar === "body"
        ? {
            pillar,
            focus: "Focus for body",
            nodes: [
              node(pillar, {
                instructions: ["Walk for 20 minutes and think about the app.", "Stop there."],
              }),
            ],
          }
        : { pillar, focus: `Focus for ${pillar}`, nodes: [node(pillar)] },
    ),
  });
  const plan = dailyPlanFromTree(answers, mixed, "edge-ai");
  const craft = plan.practices.find((practice) => practice.branch === "craft");
  const body = plan.practices.find((practice) => practice.branch === "body");
  // The drafted craft practice survives; only the branch that broke is replaced.
  assert.equal(craft?.title, "craft step for the tracking app");
  assert.ok(body?.title);
  assert.notEqual(body?.full_variant.steps[0], "Walk for 20 minutes and think about the app.");
  assert.equal(plan.plan_source, "mixed");
  assert.deepEqual(validatePlan(plan), []);
});

test("a draft that cannot be repaired says plainly that it is local", () => {
  const unusable = tree({
    pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map((pillar) => ({
      pillar,
      focus: `Focus for ${pillar}`,
      nodes: [
        node(pillar, {
          instructions: ["Walk for 20 minutes and think about the app.", "Stop there."],
        }),
      ],
    })),
  });
  const plan = dailyPlanFromTree(answers, unusable, "edge-ai");
  assert.equal(plan.plan_source, "local");
  assert.deepEqual(validatePlan(plan), []);
});

test("normalization reports AI text mixed with local repairs", () => {
  const raw = tree({ pillars: (["body", "mind", "craft", "connection"] as PillarId[]).map(fourWeeks) });
  raw.pillars[0].nodes[1].title = "";
  const plan = dailyPlanFromTree(answers, normalizeTree(raw, answers), "edge-ai");
  assert.equal(plan.plan_source, "mixed");
});

test("an entirely local normalized fallback is never marked AI", () => {
  const plan = dailyPlanFromTree(answers, normalizeTree(null, answers), "edge-ai");
  assert.equal(plan.plan_source, "local");
});

test("the AI primary branch overrides the keyword classifier", () => {
  const raw = tree({ primaryBranch: "body" });
  const plan = dailyPlanFromTree({ ...answers, goal: "improve my tennis" }, raw, "edge-ai");
  assert.equal(plan.practices.find((p) => p.role === "primary")?.branch, "body");
});

test("question validation limits shape, duplicates and sensitive questions", () => {
  assert.ok(validateQuestions({ questions: GENERAL_QUESTIONS }));
  assert.equal(validateQuestions({ questions: Array(4).fill(GENERAL_QUESTIONS[0]) }), null);
  assert.equal(validateQuestions({ questions: [{ question: "What is your medical diagnosis?", options: ["One", "Two"] }] }), null);
  assert.equal(validateQuestions({ questions: [{ question: "What tools can you use?", options: ["Wall", "wall"] }] }), null);
  assert.equal(validateQuestions({ questions: [] }), null);
});

test("question responses distinguish an outdated plan-only backend from valid questions", () => {
  const valid = { questions: [{ question: "What climbing experience do you have?", options: ["None", "Some", "Other", "Skip"] }] };
  const result = questionResponse(valid);
  assert.equal(result.source, "ai");
  assert.deepEqual(result.questions[0].options, ["None", "Some"]);
  assert.equal(questionResponse({ pillars: [] }).source, "general");
  assert.deepEqual(questionResponse({ pillars: [] }), { questions: GENERAL_QUESTIONS, source: "general", reason: "outdated" });
  assert.deepEqual(questionResponse({ questions: [{ question: "What is your medical diagnosis?", options: ["One", "Two"] }] }), { questions: GENERAL_QUESTIONS, source: "general", reason: "invalid" });
});

test("AI-off questions do not contact the backend", async () => {
  assert.deepEqual(await generateQuestions(answers, false), { questions: GENERAL_QUESTIONS, source: "general", reason: "off" });
});

test("the on-device plan is labelled local and is built the same way", () => {
  const plan = dailyPlanFromTree(answers, tree(), "seed-engine");
  assert.equal(plan.plan_source, "local");
  assert.equal(plan.practices.filter((practice) => practice.role === "primary").length, 1);
  assert.deepEqual(validatePlan(plan), []);
});
