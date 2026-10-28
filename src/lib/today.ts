import type { CompletionEvent, DailySnapshot, Practice, Season } from "./daily-types";
import { addDays, daysBetween, isCounted, localDate } from "./progression";
import { planWeek } from "./engine/week";
import { nextReviewWeek } from "./review";
import { detailFor, paceLine } from "./engine/rolling";

export interface TodayView {
  today: string;
  continuation: boolean;
  pace: string;
  season: Season;
  primary: Practice;
  supporting: Practice[];
  todayEvents: CompletionEvent[];
  countedToday: boolean;
  restedToday: boolean;
  skippedToday: boolean;
  streak: number;
  bestStreak: number;
  dayNumber: number;
  /** Week of the four-week ladder this date belongs to. */
  week: number;
  missedDays: number;
  welcomeBack: boolean;
  easierByDefault: boolean;
  reviewWeek: string | null;
  recent: { date: string; events: CompletionEvent[]; counted: boolean; rest: boolean }[];
  lastCountedDate: string | null;
}

function seasonFor(snapshot: DailySnapshot): Season | null {
  return snapshot.seasons.find((season) => season.status === "active") ?? snapshot.seasons[0] ?? null;
}

/** Consecutive days before today with neither a counted practice nor a rest day. */
function missedDaysBefore(events: CompletionEvent[], season: Season, today: string) {
  const qualifying = new Set(
    events.filter((event) => !event.undone_at && (isCounted(event) || event.kind === "rest")).map((event) => event.local_date),
  );
  let missed = 0;
  for (let offset = 1; offset <= (season.season_length_days ?? 30); offset += 1) {
    const date = addDays(today, -offset);
    if (date < season.started_on) break;
    if (qualifying.has(date)) break;
    missed += 1;
  }
  return missed;
}

export function todayState(snapshot: DailySnapshot, now: Date = new Date()): TodayView | null {
  const season = seasonFor(snapshot);
  if (!season) return null;
  const timezone = snapshot.profile?.timezone || "UTC";
  let today: string;
  try {
    today = localDate(now, timezone);
  } catch {
    today = localDate(now, "UTC");
  }
  const practices = snapshot.practices.filter(
    (practice) => practice.season_id === season.id && practice.active,
  );
  const original = practices.find((practice) => practice.role === "primary") ?? practices[0];
  if (!original) return null;
  const week = planWeek(season.started_on, today, season.season_length_days);
  const detail = detailFor(snapshot, season, original, week);
  const primary = detail.practice;
  const events = snapshot.events.filter((event) => event.season_id === season.id && !event.undone_at);
  const todayEvents = events.filter((event) => event.local_date === today);
  const countedToday = todayEvents.some(isCounted);
  const restedToday = todayEvents.some((event) => event.kind === "rest");
  const skippedToday = todayEvents.some((event) => event.kind === "skipped");
  const missedDays = missedDaysBefore(events, season, today);
  const lastCounted = [...events].filter(isCounted).sort((a, b) => b.local_date.localeCompare(a.local_date))[0]?.local_date ?? null;
  const reviewed = (snapshot.reviews ?? []).filter((review) => review.season_id === season.id).map((review) => review.week_start);

  const recent = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, -index);
    const dayEvents = events.filter((event) => event.local_date === date);
    return {
      date,
      events: dayEvents,
      counted: dayEvents.some(isCounted),
      rest: dayEvents.some((event) => event.kind === "rest"),
    };
  });

  return {
    today,
    season,
    continuation: detail.continuation,
    pace: paceLine(snapshot, season, today),
    primary,
    supporting: practices.filter((practice) => practice.id !== primary.id).map(p => detailFor(snapshot, season, p, week).practice),
    todayEvents,
    countedToday,
    restedToday,
    skippedToday,
    streak: snapshot.progress?.current_streak ?? 0,
    bestStreak: snapshot.progress?.best_streak ?? 0,
    dayNumber: Math.max(1, Math.min(season.season_length_days ?? 30, daysBetween(season.started_on, today) + 1)),
    week,
    missedDays,
    welcomeBack: missedDays >= 2 && !countedToday,
    easierByDefault: season.week_mode === "lighter" && (!season.week_mode_until || today <= season.week_mode_until),
    reviewWeek: nextReviewWeek(season.started_on, today, reviewed, season.season_length_days ? season.ends_on : undefined),
    recent,
    lastCountedDate: lastCounted,
  };
}

/** The practice to show for today: the daily one, or the first weekly one due. */
export function isSupportingDue(practice: Practice, events: CompletionEvent[], today: string, season?: Season) {
  if (practice.cadence === "daily") return true;
  const weekStart = season?.season_length_days ? addDays(season.started_on, Math.floor(daysBetween(season.started_on, today) / 7) * 7) : addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const doneThisWeek = events.filter(
    (event) => event.practice_id === practice.id && isCounted(event) && event.local_date >= weekStart,
  ).length;
  return doneThisWeek < Math.max(1, practice.cadence_n);
}

export const EFFORT_LABELS = ["Very easy", "Easy", "Steady", "Hard", "Very hard"] as const;

export const SKIP_REASONS = ["Not enough time", "Low energy", "Life got in the way", "I forgot"] as const;
