import type { CompletionEvent } from "./daily-types";
import { isCounted, addDays, daysBetween } from "./progression";

/** Mirrors submit_weekly_review; unit tests pin the shared thresholds. */
export const REVIEW_RULES = { lightIfBelow: 0.5, lightIfDifficulty: 4, harderIfAtLeast: 0.85, harderIfDifficulty: 2 } as const;

export type ReviewDecision = "lighter" | "same" | "harder";

export function reviewDecision(adherence: number, difficulty: number): ReviewDecision {
  if (adherence < REVIEW_RULES.lightIfBelow || difficulty >= REVIEW_RULES.lightIfDifficulty) return "lighter";
  if (adherence >= REVIEW_RULES.harderIfAtLeast && difficulty <= REVIEW_RULES.harderIfDifficulty) return "harder";
  return "same";
}

export function adherenceFor(events: Pick<CompletionEvent, "kind" | "undone_at" | "local_date">[], weekStart: string) {
  const weekEnd = addDays(weekStart, 6);
  const days = new Set(
    events
      .filter((event) => isCounted(event) && event.local_date >= weekStart && event.local_date <= weekEnd)
      .map((event) => event.local_date),
  );
  return { practiced: days.size, adherence: Math.min(1, days.size / 7) };
}

export function reviewProposal(decision: ReviewDecision) {
  if (decision === "lighter") {
    return {
      title: "A lighter week would serve you better",
      detail:
        "The easy version will be offered first for the next seven days. Your plan does not change and nothing is taken away.",
      confirm: "Use the lighter week",
    };
  }
  if (decision === "harder") {
    return {
      title: "You have room for a little more",
      detail:
        "You could add a few minutes to your daily practice next week. Nothing changes unless you choose it, and you can edit it back any time.",
      confirm: "Keep the same plan",
    };
  }
  return {
    title: "Keep the same size",
    detail: "This pace is working. The same plan continues next week, with the easy version always available.",
    confirm: "Keep this plan",
  };
}

/** Weeks are anchored to the season's first day, seven days each. */
export function alignedWeeks(startedOn: string, today: string) {
  const length = Math.max(0, daysBetween(startedOn, today) + 1);
  const weeks: string[] = [];
  for (let index = 0; index < Math.ceil(length / 7); index += 1) weeks.push(addDays(startedOn, index * 7));
  return weeks;
}

/** The most recent finished week that has no review yet, or null. */
export function nextReviewWeek(startedOn: string, today: string, reviewed: string[]) {
  const finished = alignedWeeks(startedOn, today).filter((weekStart) => addDays(weekStart, 6) < today);
  return [...finished].reverse().find((weekStart) => !reviewed.includes(weekStart)) ?? null;
}

export function weekLabel(weekStart: string, startedOn: string) {
  return `Week ${Math.floor(daysBetween(startedOn, weekStart) / 7) + 1}`;
}
