/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { localDate, addDays, streaks, requiredDays, canUndo, PROGRESSION } from "../src/lib/progression";
import { AccountScope } from "../src/lib/daily-data";

test("date derivation across spring DST, fall DST, date line and leap day", () => {
  for (const [at, tz, date] of [
    ["2026-03-08T06:59:00Z", "America/New_York", "2026-03-08"],
    ["2026-03-08T07:01:00Z", "America/New_York", "2026-03-08"],
    ["2026-11-01T05:30:00Z", "America/New_York", "2026-11-01"],
    ["2026-11-01T06:30:00Z", "America/New_York", "2026-11-01"],
    ["2026-01-01T02:00:00Z", "America/Los_Angeles", "2025-12-31"],
    ["2026-01-01T12:00:00Z", "Pacific/Kiritimati", "2026-01-02"],
  ]) assert.equal(localDate(at, tz), date);
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.throws(() => localDate("2026-01-01", "not-a-timezone"));
});
const event = (date: string, kind: "full" | "easy" | "rest" | "skipped" = "full", undone_at: string | null = null) => ({ local_date: date, kind, undone_at });
test("easy and full count equally; undone and skipped do not keep streaks", () => {
  assert.deepEqual(streaks([event("2026-01-01"), event("2026-01-02", "easy")], "2026-01-03"), { current: 2, best: 2 });
  assert.deepEqual(streaks([event("2026-01-01"), event("2026-01-02", "skipped")], "2026-01-03"), { current: 0, best: 1 });
  assert.deepEqual(streaks([event("2026-01-01"), event("2026-01-02", "full", "undone")], "2026-01-03"), { current: 0, best: 1 });
});
test("two rest-only dates per rolling week preserve, third breaks; rest cannot start", () => {
  assert.deepEqual(streaks([event("2026-01-01", "rest")], "2026-01-01"), { current: 0, best: 0 });
  const events = [event("2026-01-01"), event("2026-01-02", "rest"), event("2026-01-03", "rest")];
  assert.deepEqual(streaks(events, "2026-01-03"), { current: 3, best: 3 });
  assert.deepEqual(streaks([...events, event("2026-01-04", "rest")], "2026-01-04"), { current: 0, best: 3 });
  assert.deepEqual(streaks([...events, event("2026-01-04", "rest"), event("2026-01-04", "easy")], "2026-01-04"), { current: 4, best: 4 });
});
test("thresholds are calendar-day goals capped to the season", () => {
  assert.deepEqual([1, 2, 3, 4].map((t) => requiredDays(t)), [...PROGRESSION.milestoneDays]);
  assert.equal(requiredDays(4, 10), 10);
});
test("undo uses current profile zone and same stored calendar date; migrated records immutable", () => {
  const e = { local_date: "2026-01-01", undone_at: null, source: "app" as const };
  assert.equal(canUndo(e, "2026-01-02T01:00:00Z", "America/New_York"), true);
  assert.equal(canUndo(e, "2026-01-02T01:00:00Z", "UTC"), false);
  assert.equal(canUndo({ ...e, source: "migrated" }, "2026-01-01T15:00:00Z", "UTC"), false);
});
test("late requests cannot restore account A after sign-out, B, or a new A session", () => {
  const scope = new AccountScope(); const a = scope.switch("A");
  assert.equal(scope.isCurrent(a), true); scope.switch(null); assert.equal(scope.isCurrent(a), false);
  scope.switch("B"); assert.equal(scope.isCurrent(a), false);
  scope.switch("A"); assert.equal(scope.isCurrent(a), false);
});
