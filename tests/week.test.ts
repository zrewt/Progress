import { test } from "node:test";
import assert from "node:assert/strict";
import { ladderWeeks, planWeek, rungFor } from "../src/lib/engine/week";
import type { Variant } from "../src/lib/daily-types";

const rung = (title: string) => ({ title, minutes: 10, steps: [`${title} step one`, `${title} step two`] });

const laddered: Variant = {
  title: "Set up the habit row",
  minutes: 15,
  steps: ["Open the tracker project", "Add one row"],
  ladder: [rung("Add a checkbox"), rung("Persist the streak"), rung("Show the week")],
};

test("a season is four weeks, and day 29 is still week four", () => {
  assert.equal(planWeek("2026-10-01", "2026-10-01"), 1);
  assert.equal(planWeek("2026-10-01", "2026-10-07"), 1);
  assert.equal(planWeek("2026-10-01", "2026-10-08"), 2);
  assert.equal(planWeek("2026-10-01", "2026-10-14"), 2);
  assert.equal(planWeek("2026-10-01", "2026-10-15"), 3);
  assert.equal(planWeek("2026-10-01", "2026-10-22"), 4);
  assert.equal(planWeek("2026-10-01", "2026-10-30"), 4);
  // A date before the start is still week one rather than a negative week.
  assert.equal(planWeek("2026-10-01", "2026-09-28"), 1);
});

test("week one is the practice itself and later weeks are its ladder", () => {
  assert.equal(rungFor(laddered, 1).title, "Set up the habit row");
  assert.deepEqual(rungFor(laddered, 1).steps, ["Open the tracker project", "Add one row"]);
  assert.equal(rungFor(laddered, 2).title, "Add a checkbox");
  assert.equal(rungFor(laddered, 3).title, "Persist the streak");
  assert.equal(rungFor(laddered, 4).title, "Show the week");
  // Past the ladder it holds the last real step instead of snapping backwards.
  assert.equal(rungFor(laddered, 9).title, "Show the week");
});

test("a plan written before ladders existed still opens on its own steps", () => {
  const flat: Variant = { title: "Walk", minutes: 5, steps: ["Walk to the corner"] };
  for (const week of [1, 2, 3, 4]) {
    assert.deepEqual(rungFor(flat, week), { title: "Walk", minutes: 5, steps: ["Walk to the corner"] });
  }
  assert.equal(ladderWeeks(flat), 1);
});

test("a short ladder keeps working for the weeks it has", () => {
  const short: Variant = { ...laddered, ladder: [rung("Add a checkbox")] };
  assert.equal(ladderWeeks(short), 2);
  assert.equal(rungFor(short, 2).title, "Add a checkbox");
  assert.equal(rungFor(short, 4).title, "Add a checkbox");
});

test("an empty rung cannot replace a real practice with nothing", () => {
  const broken: Variant = { ...laddered, ladder: [{ title: "Empty", minutes: 5, steps: [] }] };
  assert.equal(ladderWeeks(broken), 1);
  assert.equal(rungFor(broken, 3).title, "Set up the habit row");
  assert.deepEqual(rungFor(broken, 3).steps, laddered.steps);
});
