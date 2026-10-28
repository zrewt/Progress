import { test } from "node:test";
import assert from "node:assert/strict";
import { milestoneThresholds, planningLeg, stageRanges } from "../src/lib/engine/schedule";
import { addDays, daysBetween } from "../src/lib/progression";

const start = "2026-03-01";

test("target boundaries require a minimum and explicit first-leg acceptance", () => {
  assert.deepEqual(planningLeg(start, addDays(start, 13)), { kind: "too-soon", earliest: addDays(start, 14) });
  assert.deepEqual(planningLeg(start, addDays(start, 14)), { kind: "valid", target: addDays(start, 14), end: addDays(start, 14), length: 14 });
  assert.equal(planningLeg(start, addDays(start, 112)).kind, "valid");
  assert.deepEqual(planningLeg(start, addDays(start, 113)), { kind: "first-leg", checkpoint: addDays(start, 112) });
  assert.deepEqual(planningLeg(start, addDays(start, 200), true), { kind: "valid", target: addDays(start, 200), end: addDays(start, 112), length: 112 });
  assert.equal(planningLeg(start, "2026-02-30").kind, "invalid");
});

test("stages cover the leg with contiguous balanced date ranges", () => {
  for (const [length, count] of [[14, 3], [28, 3], [29, 4], [56, 4], [57, 5], [112, 5]]) {
    const stages = stageRanges(start, length);
    assert.equal(stages.length, count);
    assert.equal(stages[0].start, start);
    assert.equal(stages.at(-1)?.end, addDays(start, length));
    assert.ok(stages.every((stage, i) => i === 0 || stages[i - 1].end === stage.start));
    const sizes = stages.map((stage) => daysBetween(stage.start, stage.end));
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  }
});

test("milestones scale to planned occurrences and may coincide", () => {
  assert.deepEqual(milestoneThresholds(14, "daily"), [2, 4, 7, 11]);
  assert.deepEqual(milestoneThresholds(14, "weekly"), [1, 1, 1, 2]);
  assert.deepEqual(milestoneThresholds(112, "weekly"), [2, 4, 8, 12]);
});
