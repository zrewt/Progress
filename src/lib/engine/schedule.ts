import { addDays, daysBetween } from "../progression";
import { MAX_LEG_DAYS, MIN_LEG_DAYS } from "../config";

export interface StageRange { start: string; end: string }

/** All dates are local calendar dates, represented as YYYY-MM-DD. End dates are exclusive. */
export function planningLeg(today: string, target: string, acceptFirstLeg = false) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  if (!validDate(today) || !validDate(target)) return { kind: "invalid" as const };
  const days = daysBetween(today, target);
  if (days < MIN_LEG_DAYS) return { kind: "too-soon" as const, earliest: addDays(today, MIN_LEG_DAYS) };
  if (days > MAX_LEG_DAYS && !acceptFirstLeg) return { kind: "first-leg" as const, checkpoint: addDays(today, MAX_LEG_DAYS) };
  const length = Math.min(days, MAX_LEG_DAYS);
  return { kind: "valid" as const, target, end: addDays(today, length), length };
}

/** The first ranges receive any extra days; no day is lost or overlaps. */
export function stageRanges(start: string, length: number): StageRange[] {
  const count = length <= 28 ? 3 : length <= 56 ? 4 : 5;
  const base = Math.floor(length / count), extra = length % count;
  let offset = 0;
  return Array.from({ length: count }, (_, i) => {
    const from = offset;
    offset += base + (i < extra ? 1 : 0);
    return { start: addDays(start, from), end: addDays(start, offset) };
  });
}

/** Four tree tiers are independent of outline stages; coincident thresholds are valid. */
export function milestoneThresholds(length: number, cadence: "daily" | "weekly", cadenceN = 1): number[] {
  const occurrences = cadence === "daily" ? length : Math.ceil(length / 7) * cadenceN;
  return [0.1, 0.25, 0.5, 0.75].map((fraction) => Math.max(1, Math.ceil(occurrences * fraction)));
}
