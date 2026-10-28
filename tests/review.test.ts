import { test } from "node:test";
import assert from "node:assert/strict";
import { adherenceFor, alignedWeeks, nextReviewWeek, reviewDecision, weekLabel } from "../src/lib/review";
import { todayState, isSupportingDue } from "../src/lib/today";
import { presentation } from "../src/lib/daily-adapter";
import type { CompletionEvent, DailySnapshot, Practice, Season } from "../src/lib/daily-types";

const season = {
  id: "season-1",
  user_id: "user-1",
  goal: "Write every day",
  identity: "creator",
  blocker: "consistency",
  minutes_budget: 15,
  plan_version: 1,
  plan_source: "local",
  plan_summary: "A small daily practice.",
  safety_note: "Go gently.",
  branch_labels: { body: "Energy", mind: "Focus", craft: "Writing", connection: "Support" },
  started_on: "2026-10-10",
  ends_on: "2026-11-09",
  status: "active",
  week_mode: "same",
  week_mode_until: null,
  created_at: "2026-10-10T12:00:00Z",
  ended_at: null,
} as Season;

const practice = (id: string, role: "primary" | "supporting", branch: Practice["branch"], cadence: "daily" | "weekly" = "daily") =>
  ({
    id, season_id: season.id, user_id: season.user_id, branch, title: `Practice ${id}`, why: "Why it matters.",
    role, cadence, cadence_n: 1, active: true, replaced_by: null, sort_order: 0,
    full_variant: { title: `Full ${id}`, minutes: 15, steps: ["One", "Two", "Three"] },
    easy_variant: { title: "The two-minute version", minutes: 2, steps: ["One", "Two"] },
  }) as Practice;

const event = (date: string, kind: CompletionEvent["kind"] = "full", practiceId: string | null = "p1"): CompletionEvent =>
  ({
    id: `${date}-${kind}`, user_id: season.user_id, season_id: season.id, practice_id: practiceId,
    client_event_id: `${date}-${kind}`, kind, occurred_at: `${date}T12:00:00Z`, local_date: date,
    minutes_actual: 15, effort: null, note: null, undone_at: null, created_at: `${date}T12:00:00Z`, source: "app",
  }) as CompletionEvent;

function snapshot(overrides: Partial<DailySnapshot> = {}): DailySnapshot {
  return {
    profile: { id: "user-1", display_name: "Ada", timezone: "UTC", blocker: "consistency", ai_consent_version: null, ai_consent_at: null },
    seasons: [season],
    practices: [practice("p1", "primary", "craft"), practice("p2", "supporting", "body", "weekly")],
    milestones: [],
    events: [],
    reviews: [],
    progress: { xp: 120, season_xp: 30, level: 1, current_streak: 3, best_streak: 5, practiced_days: 3, branch_growth: { body: 1, mind: 0, craft: 2, connection: 0 }, unlocked_milestones: [] },
    ...overrides,
  };
}

test("review thresholds match the SQL rules at their boundaries", () => {
  assert.equal(reviewDecision(0.42, 2), "lighter");
  assert.equal(reviewDecision(0.99, 4), "lighter");
  assert.equal(reviewDecision(0.5, 3), "same");
  assert.equal(reviewDecision(0.86, 2), "harder");
  assert.equal(reviewDecision(0.71, 3), "same");
  assert.equal(reviewDecision(1, 1), "harder");
});

test("adherence counts distinct practised days in the aligned week", () => {
  const events = [event("2026-10-10"), event("2026-10-10", "easy"), event("2026-10-11"), event("2026-10-17"), event("2026-10-18")];
  assert.deepEqual(adherenceFor(events, "2026-10-10"), { practiced: 2, adherence: 2 / 7, denominator: 7 });
  assert.deepEqual(adherenceFor([event("2026-10-10", "full", null)], "2026-10-10"), { practiced: 1, adherence: 1 / 7, denominator: 7 });
});

test("reviews are offered for finished weeks only, once each", () => {
  assert.deepEqual(alignedWeeks("2026-10-10", "2026-10-24"), ["2026-10-10", "2026-10-17", "2026-10-24"]);
  assert.equal(nextReviewWeek("2026-10-10", "2026-10-24", []), "2026-10-17");
  assert.equal(nextReviewWeek("2026-10-10", "2026-10-24", ["2026-10-17"]), "2026-10-10");
  assert.equal(nextReviewWeek("2026-10-10", "2026-10-16", []), null);
  assert.equal(weekLabel("2026-10-17", "2026-10-10"), "Week 2");
});

test("today shows the daily practice, a welcome back after a gap, and the last seven days", () => {
  const now = new Date("2026-10-24T09:00:00Z");
  const view = todayState(snapshot({ events: [event("2026-10-19"), event("2026-10-18", "easy")] }), now);
  assert.ok(view);
  assert.equal(view.today, "2026-10-24");
  assert.equal(view.primary.id, "p1");
  assert.equal(view.missedDays, 4);
  assert.equal(view.welcomeBack, true);
  assert.equal(view.countedToday, false);
  assert.equal(view.dayNumber, 15);
  assert.equal(view.recent.length, 7);
  assert.equal(view.recent[0].date, "2026-10-24");
  assert.equal(view.recent[5].counted, true);
  assert.equal(view.reviewWeek, "2026-10-17");
  assert.equal(view.streak, 3);
});

test("today respects the timezone, the lighter week and today's completion", () => {
  const now = new Date("2026-10-24T02:00:00Z");
  const view = todayState(
    snapshot({
      profile: { id: "user-1", display_name: "Ada", timezone: "America/Los_Angeles", blocker: null, ai_consent_version: null, ai_consent_at: null },
      seasons: [{ ...season, week_mode: "lighter", week_mode_until: "2026-10-30" }],
      events: [event("2026-10-23")],
    }),
    now,
  );
  assert.ok(view);
  assert.equal(view.today, "2026-10-23");
  assert.equal(view.countedToday, true);
  assert.equal(view.easierByDefault, true);
  assert.equal(view.welcomeBack, false);
});

test("pain pause selects the easy next practice independently of weekly mode", () => {
  const view = todayState(snapshot({ seasons: [{ ...season, progression_paused: true }] }), new Date("2026-10-24T09:00:00Z"));
  assert.equal(view?.easierByDefault, true);
});

test("a weekly support is due only once per week", () => {
  const support = practice("p2", "supporting", "body", "weekly");
  assert.equal(isSupportingDue(support, [], "2026-10-24"), true);
  assert.equal(isSupportingDue(support, [event("2026-10-22", "full", "p2")], "2026-10-24"), false);
  assert.equal(isSupportingDue(support, [event("2026-10-11", "full", "p2")], "2026-10-24"), true);
});

test("an empty journal has no Today rather than an invented one", () => {
  assert.equal(todayState({ ...snapshot(), seasons: [], practices: [] }), null);
});

// The tree draws sixteen nodes from four practices: each practice backs one
// milestone per tier, so practice id alone is not a unique identity.
test("every tree node can be told apart from the others", () => {
  const branches = ["body", "mind", "craft", "connection"] as const;
  const practices = branches.map((branch, index) =>
    practice(`p${index}`, index === 0 ? "primary" : "supporting", branch, index === 0 ? "daily" : "weekly"),
  );
  const milestones = branches.flatMap((branch, index) =>
    [1, 2, 3, 4].map((tier) => ({
      id: `m-${index}-${tier}`,
      season_id: season.id,
      user_id: season.user_id,
      branch,
      tier,
      title: `Tier ${tier}`,
      practice_id: `p${index}`,
      required_days: tier * 3,
      unlocked_at: null,
    })),
  );
  const view = presentation(snapshot({ practices, milestones }));
  assert.equal(view.nodes.length, 16);
  const keys = view.nodes.map((node) => `${node.id}-${node.tier}`);
  assert.equal(new Set(keys).size, 16, "tree node keys must be unique");
});
