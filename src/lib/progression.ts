import type { CompletionEvent } from "./daily-types";

/** Mirrors private.progression_config; SQL tests enforce parity. Server results are authoritative. */
export const PROGRESSION = { xpPerCompletion: 10, xpPerLevel: 200, milestoneDays: [3, 7, 14, 21], restDaysPerWeek: 2, maxBackdateDays: 14 } as const;
export function localDate(at: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function daysBetween(a: string, b: string) { return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000); }
export function isCounted(event: Pick<CompletionEvent, "kind" | "undone_at">) { return !event.undone_at && (event.kind === "full" || event.kind === "easy"); }
export function streaks(events: Pick<CompletionEvent, "kind" | "undone_at" | "local_date">[], today: string) {
  const counted = new Set(events.filter(isCounted).map((e) => e.local_date));
  const rests = new Set(events.filter((e) => !e.undone_at && e.kind === "rest" && !counted.has(e.local_date)).map((e) => e.local_date));
  const dates = [...new Set([...counted, ...rests])].filter((date) => date <= today).sort();
  let previous: string | null = null, current = 0, best = 0;
  for (const date of dates) {
    const restCount = [...rests].filter((d) => d >= addDays(date, -6) && d <= date).length;
    const qualifies = counted.has(date) || restCount <= PROGRESSION.restDaysPerWeek;
    if (!qualifies) { current = 0; previous = date; continue; }
    const adjacent = previous !== null && addDays(previous, 1) === date;
    current = counted.has(date) ? (adjacent ? current + 1 : 1) : adjacent && current > 0 ? current + 1 : 0;
    best = Math.max(best, current);
    previous = date;
  }
  if (!previous || previous < addDays(today, -1)) current = 0;
  return { current, best };
}
export function requiredDays(tier: number, seasonLength = 30) { return Math.min(PROGRESSION.milestoneDays[tier - 1] ?? 21, seasonLength); }
export function canUndo(event: Pick<CompletionEvent, "local_date" | "undone_at" | "source">, now: string, timezone: string) { return event.source === "app" && !event.undone_at && event.local_date === localDate(now, timezone); }
