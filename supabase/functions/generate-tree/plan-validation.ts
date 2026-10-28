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

/** The optional two-minute version, at branch or node level. */
export function validEasyVersion(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const easy = raw as { title?: unknown; steps?: unknown };
  if (typeof easy.title !== "string" || easy.title.trim().length < 3 || easy.title.length > 70) return false;
  if (!Array.isArray(easy.steps) || easy.steps.length < 1 || easy.steps.length > 3) return false;
  if (easy.steps.some((step) => typeof step !== "string" || !step.trim() || step.length > 180)) return false;
  return validatePracticeText(`${easy.title} ${easy.steps.join(" ")}`).ok && validateStepsWithinBudget(easy.steps as string[], 2).ok;
}

/**
 * A two-minute version is a bonus, not the plan. If the model writes one that is
 * unsafe or malformed, remove it and let the client derive one from the first
 * step; never reject every practice because of it. Missing is allowed.
 */
export function dropInvalidEasyVersions(raw: unknown): void {
  const pillars = (raw as { pillars?: unknown } | null)?.pillars;
  if (!Array.isArray(pillars)) return;
  for (const pillar of pillars) {
    if (!pillar || typeof pillar !== "object") continue;
    const entry = pillar as { easy?: unknown; nodes?: unknown };
    if ("easy" in entry && !validEasyVersion(entry.easy)) delete entry.easy;
    if (!Array.isArray(entry.nodes)) continue;
    for (const node of entry.nodes) {
      if (!node || typeof node !== "object") continue;
      const practice = node as { easy?: unknown };
      if ("easy" in practice && !validEasyVersion(practice.easy)) delete practice.easy;
    }
  }
}

export interface Stage { start: string; end: string; title: string; outcome: string }

export function stageCount(length: number): number {
  return length <= 28 ? 3 : length <= 56 ? 4 : 5;
}

/** The same ranges the app uses; dates are arithmetic, never model judgement. */
export function stageRanges(start: string, length: number): { start: string; end: string }[] {
  const count = stageCount(length);
  const base = Math.floor(length / count);
  const extra = length % count;
  let offset = 0;
  return Array.from({ length: count }, (_, index) => {
    const from = offset;
    offset += base + (index < extra ? 1 : 0);
    const date = (n: number) => {
      const d = new Date(`${start}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    };
    return { start: date(from), end: date(offset) };
  });
}

function cleanStageText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ").slice(0, max);
  if (text.length < 3 || !validatePracticeText(text).ok) return null;
  return text;
}

/**
 * Places the model's stage titles and outcomes on the canonical calendar for
 * this leg. A model date or count that is off by a day used to reject the whole
 * draft and substitute the starter library; the dates were never the model's to
 * decide, so they are rewritten here and only the text is kept.
 *
 * Missing or unsafe entries fall back to a neutral label for that range rather
 * than dropping a stage, so the outline always tiles the leg exactly.
 */
export function normaliseStages(raw: unknown, start: string, length: number): Stage[] {
  const provided = Array.isArray(raw) ? raw : [];
  return stageRanges(start, length).map((range, index) => {
    const entry = provided[index] as { title?: unknown; outcome?: unknown } | undefined;
    return {
      ...range,
      title: cleanStageText(entry?.title, 80) ?? `Stage ${index + 1}`,
      outcome: cleanStageText(entry?.outcome, 200) ?? "Review this part of the goal at this checkpoint.",
    };
  });
}

export function validRealityCheck(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as { level?: unknown; explanation?: unknown };
  return ["comfortable", "stretch", "very tight"].includes(String(r.level)) && typeof r.explanation === "string" && r.explanation.trim().length >= 3 && r.explanation.length <= 240 && validatePracticeText(r.explanation).ok;
}
