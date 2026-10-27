import type { Practice, Rung, Variant } from "../daily-types";
import { daysBetween } from "../progression";

/**
 * A 30-day season is four weeks of one practice that keeps getting a little
 * more real. The tree already writes four nodes per branch; week one is the
 * first node and weeks two to four are the rest, so nothing the model wrote is
 * thrown away and the person is not asked to repeat the same first step for a
 * month.
 */
export const PLAN_WEEKS = 4;

/** Which week of the season a date falls in: 1-4, clamped at both ends. */
export function planWeek(startedOn: string, today: string): number {
  const dayIndex = daysBetween(startedOn, today);
  if (!Number.isFinite(dayIndex)) return 1;
  return Math.max(1, Math.min(PLAN_WEEKS, Math.floor(Math.max(0, dayIndex) / 7) + 1));
}

/** A practice's variant for one week. Week 1 is the variant; later weeks are its ladder. */
export function rungFor(variant: Variant | null | undefined, week: number): Rung {
  const base: Rung = {
    title: variant?.title ?? "",
    minutes: variant?.minutes ?? 2,
    steps: variant?.steps ?? [],
  };
  const ladder = (variant?.ladder ?? []).filter((step) => step.steps.length > 0);
  if (week <= 1 || ladder.length === 0) return base;
  // A short ladder holds its last real step rather than inventing one, so a
  // plan never jumps backwards or forward to an empty week.
  const index = Math.min(ladder.length - 1, Math.min(PLAN_WEEKS, week) - 2);
  const rung = ladder[Math.max(0, index)];
  return { title: rung.title || base.title, minutes: rung.minutes, steps: rung.steps };
}

/** How many weeks this practice actually has content for. */
export function ladderWeeks(variant: Variant | null | undefined): number {
  return 1 + (variant?.ladder?.filter((rung) => rung.steps.length > 0).length ?? 0);

}

/** The week's version of a practice, for a screen that already knows the date. */
export function practiceThisWeek(practice: Practice, week: number): Rung {
  return rungFor(practice.full_variant, week);
}
