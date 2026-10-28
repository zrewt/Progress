import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterDraftIsUsable, chapterReviewReason, reflectionContext, reflectionProblem } from "../src/lib/engine/chapter";
import { planningLeg } from "../src/lib/engine/schedule";
import { planHistory } from "../src/lib/engine/history";
import type { DailySnapshot } from "../src/lib/daily-types";

test("chapter review appears at the boundary or early when every milestone is grown", () => {
  const season = { status: "active" as const, ends_on: "2026-02-01" };
  assert.equal(chapterReviewReason(season, "2026-01-20", 16, 16), "grown");
  assert.equal(chapterReviewReason(season, "2026-02-01", 16, 1), "ended");
  assert.equal(chapterReviewReason(season, "2026-01-20", 16, 15), null);
  assert.equal(chapterReviewReason(season, "2026-01-20", 0, 0), null);
  assert.equal(chapterReviewReason({ ...season, status: "completed" }, "2026-02-01", 16, 16), null);
});

test("chapter dates reject passed and near targets and retain a long-term goal", () => {
  assert.equal(planningLeg("2026-01-15", "2026-01-01").kind, "too-soon");
  assert.equal(planningLeg("2026-01-15", "2026-01-28").kind, "too-soon");
  assert.equal(planningLeg("2026-01-15", "2026-01-29").kind, "valid");
  assert.equal(planningLeg("2026-01-15", "2026-08-01").kind, "first-leg");
  const accepted = planningLeg("2026-01-15", "2026-08-01", true);
  assert.equal(accepted.kind, "valid");
  if (accepted.kind === "valid") { assert.equal(accepted.target, "2026-08-01"); assert.equal(accepted.length, 112); }
});

test("optional reflection applies goal safety and scrubs contact information", () => {
  assert.equal(reflectionProblem(["", "", "", ""]), null);
  assert.equal(reflectionProblem(["ok", "", "", ""]), null);
  assert.match(reflectionProblem(["I want to kill myself"]) ?? "", /support/i);
  assert.ok(reflectionProblem(["I want to starve myself"]));
  assert.match(reflectionContext(["Reach me at person@example.com"])[0].answer, /redacted-email/);
});

test("chapter history describes the chosen season even without completed days", () => {
  const snapshot = { seasons: [{ id: "chapter", created_at: "2026-01-01", started_on: "2026-01-01", ends_on: "2026-01-15", season_length_days: 14 }], events: [], practices: [], reviews: [] } as unknown as DailySnapshot;
  assert.equal(planHistory(snapshot), null);
  assert.equal(planHistory(snapshot, "chapter")?.days_practised, 0);
});

test("failed AI cannot silently become an approved local alternative", () => {
  assert.equal(chapterDraftIsUsable(false, "seed-engine", "local"), false);
  assert.equal(chapterDraftIsUsable(false, "edge-ai", "local"), false);
  assert.equal(chapterDraftIsUsable(false, "edge-ai", "mixed"), true);
  assert.equal(chapterDraftIsUsable(true, "seed-engine", "local"), true);
});
