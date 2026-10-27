import { test } from "node:test";
import assert from "node:assert/strict";
import { planHistory } from "../src/lib/engine/history";
import type { CompletionEvent, DailySnapshot, Practice, Season, WeeklyReview } from "../src/lib/daily-types";

const season = (overrides: Partial<Season> = {}): Season =>
  ({
    id: "season-1",
    user_id: "user-1",
    goal: "Build the habit tracker",
    identity: "builder",
    blocker: "time",
    minutes_budget: 15,
    plan_version: 1,
    plan_source: "ai",
    plan_summary: "One screen at a time.",
    safety_note: "Go gently.",
    branch_labels: { body: "Energy", mind: "Focus", craft: "The app", connection: "Support" },
    started_on: "2026-09-01",
    ends_on: "2026-10-01",
    status: "completed",
    week_mode: "same",
    week_mode_until: null,
    created_at: "2026-09-01T12:00:00Z",
    ended_at: "2026-10-01T12:00:00Z",
    ...overrides,
  }) as Season;

const practice = (id: string, role: "primary" | "supporting", title: string): Practice =>
  ({
    id,
    season_id: "season-1",
    user_id: "user-1",
    branch: "craft",
    title,
    why: "Because it matters.",
    role,
    cadence: role === "primary" ? "daily" : "weekly",
    cadence_n: 1,
    active: true,
    replaced_by: null,
    sort_order: 0,
    full_variant: { title, minutes: 15, steps: ["One"] },
    easy_variant: { title: "Two minutes", minutes: 2, steps: ["One"] },
  }) as Practice;

const event = (
  date: string,
  practiceId: string | null,
  overrides: Partial<CompletionEvent> = {},
): CompletionEvent =>
  ({
    id: `${date}-${practiceId}`,
    user_id: "user-1",
    season_id: "season-1",
    practice_id: practiceId,
    client_event_id: `${date}-${practiceId}`,
    kind: "full",
    occurred_at: `${date}T12:00:00Z`,
    local_date: date,
    minutes_actual: 15,
    effort: 3,
    note: null,
    undone_at: null,
    created_at: `${date}T12:00:00Z`,
    source: "app",
    ...overrides,
  }) as CompletionEvent;

const review = (note: string, weekStart: string): WeeklyReview =>
  ({
    id: `review-${weekStart}`,
    user_id: "user-1",
    season_id: "season-1",
    week_start: weekStart,
    difficulty: 3,
    note,
    adherence: 0.5,
    decision: "same",
    applied_at: null,
    created_at: `${weekStart}T20:00:00Z`,
  }) as WeeklyReview;

const snapshot = (overrides: Partial<DailySnapshot> = {}): DailySnapshot => ({
  profile: { id: "user-1", display_name: "Ada", timezone: "UTC", blocker: "time", ai_consent_version: "v1", ai_consent_at: "2026-09-01T12:00:00Z" },
  seasons: [season()],
  practices: [practice("p1", "primary", "Open the habit row screen"), practice("p2", "supporting", "Sketch the data model")],
  milestones: [],
  events: [],
  reviews: [],
  progress: null,
  ...overrides,
});

test("a first season has nothing to learn from yet", () => {
  assert.equal(planHistory(snapshot()), null);
  assert.equal(planHistory(null), null);
});

test("what stuck, what never happened, and how hard it felt", () => {
  const history = planHistory(
    snapshot({
      events: [
        event("2026-09-02", "p1", { effort: 4 }),
        event("2026-09-03", "p1", { effort: 2 }),
        event("2026-09-04", "p1", { kind: "easy", effort: 1 }),
        event("2026-09-05", "p1", { effort: 5 }),
        // A supporting practice that was tried once is not "never happened".
        event("2026-09-06", "p2"),
        event("2026-09-07", "p2", { kind: "skipped" }),
        event("2026-09-08", "p1", { kind: "rest", practice_id: null }),
        event("2026-09-09", "p1", { undone_at: "2026-09-09T20:00:00Z" }),
      ],
      reviews: [review("Harder than I thought in week one.", "2026-09-03")],
    }),
  );
  assert.ok(history);
  assert.equal(history.days_practised, 5);
  assert.equal(history.days_planned, 30);
  assert.deepEqual(history.kept, ["Open the habit row screen"]);
  assert.deepEqual(history.dropped, []);
  assert.equal(history.average_effort, 3);
  assert.equal(history.last_review, "Harder than I thought in week one.");
});

test("a practice that never happens is reported so it can be replaced", () => {
  const history = planHistory(
    snapshot({ events: [event("2026-09-02", "p1"), event("2026-09-03", "p1"), event("2026-09-04", "p1")] }),
  );
  assert.ok(history);
  assert.deepEqual(history.kept, ["Open the habit row screen"]);
  assert.deepEqual(history.dropped, ["Sketch the data model"]);
  assert.equal(history.average_effort, 3);
  assert.equal(history.last_review, null);
});

test("a season of only skips and rest days teaches nothing to keep", () => {
  const history = planHistory(
    snapshot({
      events: [
        event("2026-09-02", "p1", { kind: "skipped" }),
        event("2026-09-03", "p1", { kind: "rest", practice_id: null }),
      ],
    }),
  );
  assert.equal(history, null);
});

test("the most recent lived-in season is the one described", () => {
  const older = season({ id: "season-0", created_at: "2026-08-01T12:00:00Z", started_on: "2026-08-01", ends_on: "2026-08-31" });
  const active = season({ id: "season-2", status: "active", created_at: "2026-10-02T12:00:00Z", started_on: "2026-10-02", ends_on: "2026-11-01" });
  const history = planHistory(
    snapshot({
      seasons: [older, season(), active],
      events: [
        event("2026-08-05", "p1"),
        event("2026-09-02", "p1"),
        event("2026-10-05", "p1", { season_id: "season-2" }),
      ],
    }),
  );
  assert.ok(history);
  assert.equal(history.seasons, 3);
  assert.equal(history.days_practised, 1);
});

test("long notes and titles are clipped before they reach the network", () => {
  const longTitle = `Open the screen ${"with every single label ".repeat(6)}`;
  const history = planHistory(
    snapshot({
      practices: [practice("p1", "primary", longTitle), practice("p2", "supporting", "Sketch")],
      events: [event("2026-09-02", "p1"), event("2026-09-03", "p1"), event("2026-09-04", "p1")],
      reviews: [review("x".repeat(400), "2026-09-03")],
    }),
  );
  assert.ok(history);
  assert.equal(history.kept[0].length, 60);
  assert.equal(history.last_review?.length, 140);
});
