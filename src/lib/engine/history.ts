import type { DailySnapshot } from "../daily-types";
import type { PlanHistory } from "../types";
import { daysBetween, isCounted } from "../progression";

/**
 * Turns what actually happened into the few facts a generator can act on.
 *
 * A plan that ignores a finished season repeats the same advice whether the
 * person practised 27 days or 3. This is deliberately small and plain: how much
 * they showed up, which practice stuck, which never happened, how hard it felt,
 * and the last thing they said in a review. No free text beyond the note, so
 * nothing unexpected reaches the model.
 */

const MAX_TITLE = 60;
const MAX_NOTE = 140;

function clip(value: string, limit: number) {
  const text = value.trim().replace(/\s+/g, " ");
  return text.length > limit ? text.slice(0, limit) : text;
}

export function planHistory(snapshot: DailySnapshot | null): PlanHistory | null {
  if (!snapshot) return null;
  const events = snapshot.events.filter((event) => !event.undone_at);
  // The season to learn from is the most recent one that was actually lived in.
  const seasons = [...snapshot.seasons].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const season = seasons.find((candidate) => events.some((event) => event.season_id === candidate.id));
  if (!season) return null;

  const seasonEvents = events.filter((event) => event.season_id === season.id);
  const counted = seasonEvents.filter(isCounted);
  const practisedDays = new Set(counted.map((event) => event.local_date));
  if (practisedDays.size === 0) return null;

  const practices = snapshot.practices.filter((practice) => practice.season_id === season.id);
  const daysFor = (id: string) =>
    new Set(counted.filter((event) => event.practice_id === id).map((event) => event.local_date)).size;
  const scored = practices
    .map((practice) => ({ practice, days: daysFor(practice.id) }))
    .sort((a, b) => b.days - a.days);

  const kept = scored
    .filter((entry) => entry.days >= 3)
    .slice(0, 2)
    .map((entry) => clip(entry.practice.title, MAX_TITLE));
  const dropped = scored
    .filter((entry) => entry.days === 0 && entry.practice.role === "supporting")
    .slice(0, 2)
    .map((entry) => clip(entry.practice.title, MAX_TITLE));

  const efforts = counted
    .map((event) => event.effort)
    .filter((effort): effort is number => typeof effort === "number");
  const averageEffort = efforts.length
    ? Math.round((efforts.reduce((total, effort) => total + effort, 0) / efforts.length) * 10) / 10
    : null;

  const lastReview = (snapshot.reviews ?? [])
    .filter((review) => review.season_id === season.id && review.note)
    .sort((a, b) => b.week_start.localeCompare(a.week_start))[0]?.note;

  return {
    seasons: Math.max(1, snapshot.seasons.length),
    days_practised: practisedDays.size,
    days_planned: Math.max(1, Math.min(season.season_length_days ?? 30, daysBetween(season.started_on, season.ends_on))),
    kept,
    dropped,
    average_effort: averageEffort,
    last_review: lastReview ? clip(lastReview, MAX_NOTE) : null,
  };
}
