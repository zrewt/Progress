import type { DailySnapshot } from "./daily-types";
import { addDays, daysBetween, isCounted, localDate } from "./progression";
import { detailFor } from "./engine/rolling";
import { planWeek, rungFor } from "./engine/week";

export const validReminderTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

/** Convert a wall-clock appointment in the account zone, not elapsed 24-hour steps (DST). */
export function zonedReminder(date: string, time: string, timezone: string): Date | null {
  const wanted = Date.parse(`${date}T${time}:00Z`);
  let guess = wanted;
  for (let i = 0; i < 4; i++) {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
    const get = (key: string) => p.find(v => v.type === key)?.value;
    const actual = Date.parse(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:00Z`);
    if (actual === wanted) return new Date(guess);
    guess += wanted - actual;
  }
  // Nonexistent wall time at a DST jump: skip that date rather than send at a surprising time.
  return null;
}

export function nextReminder(snapshot: DailySnapshot, time: string, now = new Date()) {
  if (!validReminderTime(time)) return null;
  const season = snapshot.seasons.find(s => s.status === "active");
  const primary = snapshot.practices.find(p => p.season_id === season?.id && p.active && p.role === "primary");
  if (!season || !primary) return null;
  const timezone = snapshot.profile?.timezone ?? "UTC";
  const today = localDate(now, timezone);
  // Only one known occurrence is returned; no repeating notification and no background guessing.
  for (let offset = 0; offset < 3; offset++) {
    const date = addDays(today, offset);
    if (date < season.started_on || date >= season.ends_on) continue;
    if (snapshot.events.some(e => e.season_id === season.id && e.local_date === date && isCounted(e))) continue;
    const at = zonedReminder(date, time, timezone);
    if (!at || at <= now) continue;
    const week = planWeek(season.started_on, date, season.season_length_days);
    const practice = detailFor(snapshot, season, primary, week).practice;
    const title = rungFor(practice.full_variant, week).title;
    return { date, at, title, daysRemaining: daysBetween(date, season.ends_on) };
  }
  return null;
}
