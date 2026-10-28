import { validatePracticeText, validateStepsWithinBudget } from "./safety-rules.ts";

export interface WeekVariant { title: string; minutes: number; steps: string[] }
export interface WeeklyPractice { practice_id: string; title: string; why: string; full_variant: WeekVariant; easy_variant: WeekVariant }
export interface WeeklyDraft { effective_week: number; expected_version: number; practices: WeeklyPractice[]; source: "ai" | "local" }

/** This caps duration only, not difficulty; physical safety needs separate rules. */
export function durationCap(previous: number, budget: number): number {
  return Math.min(budget, Math.floor(previous + Math.max(2, previous * 0.2)));
}

export function validVariant(raw: unknown, cap: number, easy = false): raw is WeekVariant {
  if (!raw || typeof raw !== "object") return false;
  const v = raw as WeekVariant;
  return typeof v.title === "string" && v.title.trim().length >= 3 && v.title.length <= 80 &&
    Number.isInteger(v.minutes) && v.minutes >= 1 && v.minutes <= Math.min(cap, easy ? 2 : cap) &&
    Array.isArray(v.steps) && v.steps.length >= 1 && v.steps.length <= (easy ? 3 : 5) &&
    v.steps.every(s => typeof s === "string" && s.trim().length > 0 && s.length <= 180) &&
    validatePracticeText(`${v.title} ${v.steps.join(" ")}`).ok && validateStepsWithinBudget(v.steps, v.minutes).ok;
}

export function validateWeeklyDraft(raw: unknown, current: { id: string; minutes: number }[], budget: number): raw is WeeklyDraft {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as WeeklyDraft;
  if (!Number.isInteger(d.effective_week) || d.effective_week < 2 || d.effective_week > 16 || !Number.isInteger(d.expected_version) || d.expected_version < 1 || !["ai", "local"].includes(d.source) || !Array.isArray(d.practices) || d.practices.length !== current.length) return false;
  const ids = new Set<string>();
  return d.practices.every(p => {
    if (!p || ids.has(p.practice_id)) return false;
    ids.add(p.practice_id);
    const old = current.find(v => v.id === p.practice_id);
    return !!old && typeof p.title === "string" && p.title.trim().length >= 3 && p.title.length <= 80 &&
      typeof p.why === "string" && p.why.trim().length >= 3 && p.why.length <= 280 &&
      validatePracticeText(`${p.title} ${p.why}`).ok && validVariant(p.full_variant, durationCap(old.minutes, budget)) && validVariant(p.easy_variant, budget, true);
  });
}

export function validOutline(raw: unknown, start: string, length: number): boolean {
  if (!Array.isArray(raw)) return false;
  const count = length <= 28 ? 3 : length <= 56 ? 4 : 5;
  if (raw.length !== count) return false;
  let offset = 0;
  const date = (n: number) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  return raw.every((s, i) => {
    const from = offset;
    offset += Math.floor(length / count) + (i < length % count ? 1 : 0);
    return s && s.start === date(from) && s.end === date(offset) && typeof s.title === "string" && s.title.trim().length >= 3 && s.title.length <= 80 && typeof s.outcome === "string" && s.outcome.trim().length >= 3 && s.outcome.length <= 200 && validatePracticeText(`${s.title} ${s.outcome}`).ok;
  });
}

export function validRealityCheck(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as { level?: unknown; explanation?: unknown };
  return ["comfortable", "stretch", "very tight"].includes(String(r.level)) && typeof r.explanation === "string" && r.explanation.trim().length >= 3 && r.explanation.length <= 240 && validatePracticeText(r.explanation).ok;
}
