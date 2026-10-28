import type { CompletionEvent, Season } from "./daily-types";
import { addDays, daysBetween } from "./progression";

/** Only the fields these rules read, so tests need no full season or event. */
export type AdaptEvent = Pick<CompletionEvent, "kind" | "undone_at" | "season_id" | "local_date" | "effort">;
export type AdaptSeason = Pick<
  Season,
  "id" | "started_on" | "ends_on" | "week_mode" | "week_mode_until" | "progression_paused"
>;

/**
 * Mid-week adaptation is deterministic, not model-driven. These thresholds are
 * the only triggers, so the same events always produce the same offer and a
 * model can never invent one.
 */
export const ADAPT_RULES = {
  skippedDaysBeforeEasy: 2,
  /** 1 = very easy … 5 = very hard, as recorded by the practice sheet. */
  hardEffort: 4,
  hardRatingsBeforeLighter: 3,
} as const;

export interface MidWeekOffer {
  kind: "easy_today" | "lighter_week";
  title: string;
  body: string;
  confirm: string;
}

/** Consecutive skipped days immediately before today, stopping at the season start. */
export function skippedRunBefore(events: AdaptEvent[], season: AdaptSeason, today: string): number {
  const skipped = new Set(
    events
      .filter((event) => !event.undone_at && event.season_id === season.id && event.kind === "skipped")
      .map((event) => event.local_date),
  );
  let run = 0;
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = addDays(today, -offset);
    if (date < season.started_on) break;
    if (!skipped.has(date)) break;
    run += 1;
  }
  return run;
}

/** Counted practices rated hard or very hard inside the current seven-day block. */
export function hardRatingsThisWeek(events: AdaptEvent[], season: AdaptSeason, today: string): number {
  const dayIndex = Math.max(0, daysBetween(season.started_on, today));
  const weekStart = addDays(season.started_on, Math.floor(dayIndex / 7) * 7);
  return events.filter(
    (event) =>
      !event.undone_at &&
      event.season_id === season.id &&
      event.local_date >= weekStart &&
      event.local_date <= today &&
      (event.kind === "full" || event.kind === "easy") &&
      (event.effort ?? 0) >= ADAPT_RULES.hardEffort,
  ).length;
}

/** The lighter mode is already on for today, so no offer is needed. */
function lighterAlreadyActive(season: AdaptSeason, today: string) {
  if (season.progression_paused) return true;
  return season.week_mode === "lighter" && (!season.week_mode_until || today <= season.week_mode_until);
}

export function midWeekOffers(events: AdaptEvent[], season: AdaptSeason, today: string): MidWeekOffer[] {
  if (lighterAlreadyActive(season, today)) return [];
  const offers: MidWeekOffer[] = [];
  if (skippedRunBefore(events, season, today) >= ADAPT_RULES.skippedDaysBeforeEasy) {
    offers.push({
      kind: "easy_today",
      title: "Two days were skipped. Would the easier version fit better?",
      body: "The easier version counts exactly the same, and your growth stays where it is.",
      confirm: "Use the easier version today",
    });
  }
  if (hardRatingsThisWeek(events, season, today) >= ADAPT_RULES.hardRatingsBeforeLighter) {
    offers.push({
      kind: "lighter_week",
      title: "Three practices felt hard this week.",
      body: "A lighter week offers the easier version first for the next seven days. Your plan, history and growth stay as they are.",
      confirm: "Make the next week lighter",
    });
  }
  return offers;
}
