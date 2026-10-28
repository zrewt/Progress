import { test } from "node:test";
import assert from "node:assert/strict";
import { durationCap, normaliseStages, stageRanges as serverStageRanges, validateWeeklyDraft, validRealityCheck } from "../supabase/functions/generate-tree/plan-validation";
import { checkpointWeek, detailFor, localWeeklyAlternative } from "../src/lib/engine/rolling";
import { planWeek } from "../src/lib/engine/week";
import { nextReviewWeek, adherenceFor } from "../src/lib/review";
import { stageRanges } from "../src/lib/engine/schedule";
import type { DailySnapshot, Practice, Season } from "../src/lib/daily-types";

const variant = { title: "Write the opening", minutes: 5, steps: ["Write the opening sentence of the garden story."] };
const p = { id: "p", season_id: "s", title: variant.title, why: "Start with the garden story.", role: "primary", branch: "craft", cadence: "daily", cadence_n: 1, full_variant: { ...variant, ladder: [{ ...variant, title: "Rewrite the opening" }] }, easy_variant: { ...variant, minutes: 2 }, active: true } as Practice;
const season = { id: "s", started_on: "2026-03-01", ends_on: "2026-03-16", target_date: "2026-03-16", season_length_days: 15 } as Season;
const snapshot = { events: [], practiceWeeks: [] } as unknown as DailySnapshot;

test("new weeks are seven-day blocks, legacy stays capped at four", () => {
  assert.equal(planWeek("2026-03-01", "2026-05-10", 112), 11);
  assert.equal(planWeek("2026-03-01", "2026-05-10"), 4);
  assert.equal(checkpointWeek(season, "2026-03-15"), 3);
  assert.equal(checkpointWeek(season, "2026-03-16"), null);
});

test("late reviews stop at the leg end; final short week uses its own denominator", () => {
  assert.equal(nextReviewWeek(season.started_on, "2026-04-01", [], season.ends_on), "2026-03-15");
  assert.equal(nextReviewWeek(season.started_on, "2026-04-01", ["2026-03-01", "2026-03-08", "2026-03-15"], season.ends_on), null);
  assert.deepEqual(adherenceFor([{ kind: "easy", local_date: "2026-03-15", undone_at: null }], "2026-03-15", season.ends_on), { practiced: 1, adherence: 1, denominator: 1 });
});

test("offline, rejected and missing drafts continue approved detail, never outline text", () => {
  const current = detailFor(snapshot, season, p, 3);
  assert.equal(current.continuation, true);
  assert.equal(current.practice.full_variant.title, "Rewrite the opening");
  assert.equal(validateWeeklyDraft({ practices: [] }, [{ id: "p", minutes: 5 }], 15), false);
  assert.deepEqual(snapshot.practiceWeeks, []);
});

test("accepted detail is selected by effective week without changing identity or previous weeks", () => {
  const next = { ...snapshot, practiceWeeks: [{ practice_id: "p", season_id: "s", effective_week: 3, title: "Test the opening", why: p.why, full_variant: { ...variant, title: "Test the opening" }, easy_variant: p.easy_variant }] } as DailySnapshot;
  assert.equal(detailFor(next, season, p, 2).practice.full_variant.title, "Rewrite the opening");
  assert.equal(detailFor(next, season, p, 3).practice.id, "p");
  assert.equal(detailFor(next, season, p, 3).practice.title, "Test the opening");
  assert.equal(detailFor(next, season, p, 4).continuation, true);
});

test("weekly shape validates both versions, duration cap, ids and local alternative", () => {
  assert.equal(durationCap(5, 30), 7); assert.equal(durationCap(20, 30), 24); assert.equal(durationCap(30, 30), 30);
  const draft = localWeeklyAlternative([p], 3, 2);
  assert.equal(validateWeeklyDraft(draft, [{ id: "p", minutes: 5 }], 15), true);
  assert.equal(validateWeeklyDraft({ ...draft, practices: [{ ...draft.practices[0], full_variant: { ...variant, minutes: 8 } }] }, [{ id: "p", minutes: 5 }], 15), false);
  assert.equal(validateWeeklyDraft({ ...draft, practices: [{ ...draft.practices[0], easy_variant: { ...variant, minutes: 3 } }] }, [{ id: "p", minutes: 5 }], 15), false);
});

test("stage dates are the server's, so a model date or count cannot reject the plan", () => {
  const start = season.started_on, length = 15;
  const canonical = serverStageRanges(start, length);
  // Inclusive end dates and a shuffled count are both corrected, not rejected.
  const wrongDates = canonical.map((range) => ({ ...range, title: "Opening scene", outcome: "A draft of the garden scene exists." }));
  const corrected = normaliseStages(wrongDates.map((range) => ({ ...range, end: range.start })), start, length);
  assert.deepEqual(corrected.map(({ start: from, end }) => ({ start: from, end })), canonical);
  assert.equal(corrected[0].title, "Opening scene");

  const five = [1, 2, 3, 4, 5].map((n) => ({ title: `Part ${n}`, outcome: "A draft of that part exists." }));
  const fromFive = normaliseStages(five, start, length);
  assert.equal(fromFive.length, canonical.length);
  assert.deepEqual(fromFive.map((stage) => stage.title), ["Part 1", "Part 2", "Part 3"]);

  const fromOne = normaliseStages([{ title: "Part 1", outcome: "A draft exists." }], start, length);
  assert.deepEqual(fromOne.map((stage) => stage.title), ["Part 1", "Stage 2", "Stage 3"]);

  // Unsafe outline text is replaced only for that stage; the rest survives.
  const unsafe = normaliseStages([{ title: "Eat 900 calories", outcome: "A draft exists." }], start, length);
  assert.equal(unsafe[0].title, "Stage 1");
  assert.equal(unsafe.length, canonical.length);

  // The server and the app must divide a leg identically, or the pace line and
  // the outline would disagree about which stage is current.
  for (const span of [14, 15, 28, 29, 56, 57, 112]) {
    assert.deepEqual(serverStageRanges(start, span), stageRanges(start, span));
  }
});

test("the advisory reality check is still constrained", () => {
  assert.equal(validRealityCheck({ level: "very tight", explanation: "Use this leg to draft the opening rather than a whole novel." }), true);
  assert.equal(validRealityCheck({ level: "guaranteed", explanation: "Success." }), false);
});
