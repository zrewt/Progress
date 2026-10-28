import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADAPT_RULES,
  hardRatingsThisWeek,
  midWeekOffers,
  skippedRunBefore,
  type AdaptEvent,
  type AdaptSeason,
} from "../src/lib/adapt";

const season: AdaptSeason = {
  id: "s1",
  started_on: "2026-10-05",
  ends_on: "2026-11-02",
  week_mode: "same",
  week_mode_until: null,
  progression_paused: false,
};

const skipped = (date: string): AdaptEvent => ({
  kind: "skipped", undone_at: null, season_id: "s1", local_date: date, effort: null,
});
const rating = (date: string, effort: number, kind: "full" | "easy" = "full"): AdaptEvent => ({
  kind, undone_at: null, season_id: "s1", local_date: date, effort,
});
const rest = (date: string): AdaptEvent => ({
  kind: "rest", undone_at: null, season_id: "s1", local_date: date, effort: null,
});

test("two consecutive skipped days trigger the easy offer and one does not", () => {
  const today = "2026-10-14";
  assert.equal(skippedRunBefore([skipped("2026-10-13")], season, today), 1);
  assert.equal(
    skippedRunBefore([skipped("2026-10-13"), skipped("2026-10-12")], season, today),
    2,
  );
  const one = midWeekOffers([skipped("2026-10-13")], season, today);
  assert.equal(one.some((offer) => offer.kind === "easy_today"), false);
  const two = midWeekOffers([skipped("2026-10-13"), skipped("2026-10-12")], season, today);
  assert.equal(two.some((offer) => offer.kind === "easy_today"), true);
});

test("a rest day breaks the skipped run, so rest is never treated as skipping", () => {
  const today = "2026-10-14";
  const events = [skipped("2026-10-13"), rest("2026-10-12"), skipped("2026-10-11")];
  assert.equal(skippedRunBefore(events, season, today), 1);
  assert.equal(midWeekOffers(events, season, today).length, 0);
});

test("an undone or previous-season skip does not count", () => {
  const today = "2026-10-14";
  const events: AdaptEvent[] = [
    skipped("2026-10-13"),
    { ...skipped("2026-10-12"), undone_at: "2026-10-12T20:00:00Z" },
    { ...skipped("2026-10-11"), season_id: "older" },
  ];
  assert.equal(skippedRunBefore(events, season, today), 1);
});

test("three hard ratings in the current seven-day block offer a lighter week", () => {
  const today = "2026-10-14"; // day 10 of the season, so the block started 2026-10-12
  const two = [rating("2026-10-13", 4), rating("2026-10-14", 5)];
  assert.equal(hardRatingsThisWeek(two, season, today), 2);
  assert.equal(midWeekOffers(two, season, today).some((offer) => offer.kind === "lighter_week"), false);

  const three = [...two, rating("2026-10-12", ADAPT_RULES.hardEffort)];
  assert.equal(hardRatingsThisWeek(three, season, today), 3);
  assert.equal(midWeekOffers(three, season, today).some((offer) => offer.kind === "lighter_week"), true);
});

test("steady or easy effort never triggers the lighter offer, and last week does not count", () => {
  const today = "2026-10-14";
  const steady = [rating("2026-10-12", 3), rating("2026-10-13", 2), rating("2026-10-14", 1)];
  assert.equal(hardRatingsThisWeek(steady, season, today), 0);
  const lastWeek = [rating("2026-10-05", 5), rating("2026-10-06", 5), rating("2026-10-07", 5)];
  assert.equal(hardRatingsThisWeek(lastWeek, season, today), 0);
});

test("offers are not repeated while the lighter mode already applies", () => {
  const today = "2026-10-14";
  const events = [skipped("2026-10-13"), skipped("2026-10-12")];
  const lighter: AdaptSeason = { ...season, week_mode: "lighter", week_mode_until: "2026-10-20" };
  assert.deepEqual(midWeekOffers(events, lighter, today), []);
  const paused: AdaptSeason = { ...season, progression_paused: true };
  assert.deepEqual(midWeekOffers(events, paused, today), []);
  const expired: AdaptSeason = { ...season, week_mode: "lighter", week_mode_until: "2026-10-01" };
  assert.equal(midWeekOffers(events, expired, today).length, 1);
});

test("both offers can appear together and their wording stays free of judgement", () => {
  const today = "2026-10-14";
  const events = [skipped("2026-10-13"), skipped("2026-10-12"), rating("2026-10-12", 5), rating("2026-10-13", 4), rating("2026-10-14", 4)];
  const offers = midWeekOffers(events, season, today);
  assert.deepEqual(offers.map((offer) => offer.kind), ["easy_today", "lighter_week"]);
  for (const offer of offers) {
    assert.doesNotMatch(`${offer.title} ${offer.body}`, /discipline|no excuses|failure|lazy/i);
  }
});
