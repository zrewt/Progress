import { PILLARS } from "../pillars";
import { PROGRESSION } from "../progression";
import type { DailyPlan, PracticeDraft, Variant } from "../daily-types";
import type { BlockerId, IdentityId, PillarId } from "../types";
import { THEMES_A } from "./themes-a";
import { THEMES_B } from "./themes-b";
import { BRANCH_ALTERNATIVES } from "./alternatives";
import type { PlanTheme, ThemeId, ThemePractice } from "./types";

export type { PlanTheme, ThemeId, ThemePractice } from "./types";
export { BRANCH_ALTERNATIVES } from "./alternatives";

/** Curated themes, most specific first so ties resolve predictably. */
export const THEMES: PlanTheme[] = [
  ...THEMES_B.filter((theme) => theme.id === "writing"),
  ...THEMES_B.filter((theme) => theme.id === "coding"),
  ...THEMES_A.filter((theme) => theme.id === "running"),
  ...THEMES_A.filter((theme) => theme.id === "strength"),
  ...THEMES_A.filter((theme) => theme.id === "sleep"),
  ...THEMES_A.filter((theme) => theme.id === "nutrition"),
  ...THEMES_A.filter((theme) => theme.id === "study"),
  ...THEMES_B.filter((theme) => theme.id === "mindfulness"),
  ...THEMES_B.filter((theme) => theme.id === "connection"),
  ...THEMES_B.filter((theme) => theme.id === "consistency"),
];

export const THEME_MAP = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme]),
) as Record<ThemeId, PlanTheme>;

export const BUDGETS = [5, 15, 30] as const;
export type Budget = (typeof BUDGETS)[number];

/**
 * A variant may hold at most five steps. This is the same limit the database
 * enforces in start_next_season/update_plan ("Invalid variant") and the Edge
 * Function applies to generated instructions, so the three cannot drift apart.
 */
export const MAX_VARIANT_STEPS = 5;

/** Lowercase, strip punctuation and fold simple word forms so order does not matter. */
export function normalizeGoal(goal: string): string[] {
  return goal
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(stem);
}

export function stem(word: string): string {
  if (word.length <= 3) return word;
  let value = word;
  if (/(ing|ed)$/.test(value) && value.length > 5) value = value.replace(/(ing|ed)$/, "");
  else if (/ies$/.test(value)) value = `${value.slice(0, -3)}y`;
  else if (/(ches|shes|xes|ses)$/.test(value)) value = value.slice(0, -2);
  else if (/s$/.test(value) && !/(ss|us|is)$/.test(value)) value = value.slice(0, -1);
  if (/([bdfglmnprt])\1$/.test(value)) value = value.slice(0, -1);
  return value;
}

function termsMatch(tokens: string[], term: string) {
  const wanted = normalizeGoal(term);
  return wanted.length > 0 && wanted.every((part) => tokens.includes(part));
}

/** Deterministic weighted keyword score. Strong terms weigh three. */
export function scoreTheme(goal: string, theme: PlanTheme) {
  const tokens = normalizeGoal(goal);
  // Deduplicate after stemming so "learn" and "learning" count once.
  const hits = (terms: string[]) =>
    new Set(
      terms.filter((term) => termsMatch(tokens, term)).map((term) => normalizeGoal(term).join(" ")),
    ).size;
  return hits(theme.strong) * 3 + hits(theme.weak);
}

export function detectTheme(goal: string): PlanTheme {
  const tokens = normalizeGoal(goal);
  let best = THEME_MAP.consistency;
  let bestScore = 0;
  for (const theme of THEMES) {
    if (theme.id === "consistency") continue;
    const score = scoreTheme(goal, theme);
    if (score > bestScore) {
      best = theme;
      bestScore = score;
    }
  }
  // A goal made entirely of stop-words still deserves the universal fallback.
  if (!tokens.length) return THEME_MAP.consistency;
  return best;
}

export function variantFor(practice: ThemePractice, budget: Budget, kind: "full" | "easy"): Variant {
  if (kind === "easy") {
    return { title: practice.easyTitle, minutes: Math.min(2, budget), steps: [...practice.easy] };
  }
  const steps =
    budget >= 15 && practice.deep
      ? [...practice.full, ...practice.deep].slice(0, MAX_VARIANT_STEPS)
      : [...practice.full];
  return { title: practice.title, minutes: budget, steps };
}

export function practiceDraft(
  practice: ThemePractice,
  role: PracticeDraft["role"],
  budget: Budget,
): PracticeDraft {
  return {
    branch: practice.branch,
    title: practice.title,
    why: practice.why,
    role,
    cadence: role === "primary" ? "daily" : "weekly",
    cadence_n: 1,
    full_variant: variantFor(practice, budget, "full"),
    easy_variant: variantFor(practice, budget, "easy"),
  };
}

export function buildPractices(theme: PlanTheme, budget: Budget): PracticeDraft[] {
  return [
    practiceDraft(theme.primary, "primary", budget),
    ...theme.supporting.map((practice) => practiceDraft(practice, "supporting", budget)),
  ];
}

/** Alternatives for replacing a practice: same branch, up to three, minus what is already in the plan. */
export function alternativesFor(branch: PillarId, inUse: string[] = []): ThemePractice[] {
  return (BRANCH_ALTERNATIVES[branch] ?? []).filter(
    (practice) => !inUse.includes(practice.key),
  ).slice(0, 3);
}

export function branchLabels(theme: PlanTheme): Record<PillarId, string> {
  const labels = {} as Record<PillarId, string>;
  for (const branch of PILLARS) {
    const practice = [theme.primary, ...theme.supporting].find((item) => item.branch === branch.id);
    labels[branch.id] = practice?.title ?? branch.name;
  }
  return labels;
}

export interface PlanInput {
  goal: string;
  identity: IdentityId;
  blocker: BlockerId;
  minutes_budget: Budget;
  plan_source?: DailyPlan["plan_source"];
  plan_version?: number;
  safety_note?: string;
  plan_summary?: string;
  theme?: PlanTheme;
}

export function buildPlan(input: PlanInput): DailyPlan {
  const theme = input.theme ?? detectTheme(input.goal);
  const budget = BUDGETS.includes(input.minutes_budget) ? input.minutes_budget : 15;
  return {
    goal: input.goal.trim(),
    identity: input.identity,
    blocker: input.blocker,
    minutes_budget: budget,
    plan_version: input.plan_version ?? 1,
    plan_source: input.plan_source ?? "local",
    plan_summary:
      input.plan_summary ??
      `${theme.label}: one daily practice, plus three lighter practices across the week. Every version fits inside ${budget} minutes.`,
    safety_note:
      input.safety_note ??
      "Go at a pace you could repeat tomorrow. Stop at sharp pain or exhaustion; a smaller day still counts.",
    branch_labels: branchLabels(theme),
    practices: buildPractices(theme, budget),
  };
}

const TIME_IN_STEP = /\b(\d+)\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)\b/gi;

/** Problems a plan would have in production; empty means it is usable. */
export function validatePlan(plan: DailyPlan): string[] {
  const problems: string[] = [];
  const budget = plan.minutes_budget;
  const primaries = plan.practices.filter((practice) => practice.role === "primary");
  const supporting = plan.practices.filter((practice) => practice.role === "supporting");
  if (primaries.length !== 1) problems.push("A plan needs exactly one daily practice.");
  if (supporting.length > 3) problems.push("A plan may have at most three supporting practices.");
  if (!plan.practices.length) problems.push("A plan needs at least one practice.");

  for (const practice of plan.practices) {
    if (!practice.title.trim() || !practice.why.trim()) problems.push(`${practice.title || "Practice"} is missing its title or reason.`);
    if (practice.branch !== "body" && practice.branch !== "mind" && practice.branch !== "craft" && practice.branch !== "connection") {
      problems.push(`${practice.title} is on an unknown branch.`);
    }
    for (const [kind, variant] of [["full", practice.full_variant], ["easy", practice.easy_variant]] as const) {
      if (!variant || !variant.title.trim()) problems.push(`${practice.title} has no ${kind} title.`);
      if (!variant?.steps?.length) problems.push(`${practice.title} has no ${kind} steps.`);
      if ((variant?.steps?.length ?? 0) > MAX_VARIANT_STEPS) {
        problems.push(`${practice.title} has more than ${MAX_VARIANT_STEPS} ${kind} steps.`);
      }
      if (!variant || variant.minutes < 1 || variant.minutes > budget) {
        problems.push(`${practice.title} ${kind} exceeds the ${budget} minute budget.`);
      }
      if (kind === "easy" && variant && variant.minutes > 2) {
        problems.push(`${practice.title} easy version is not about two minutes.`);
      }
      for (const step of variant?.steps ?? []) {
        if (step.length > 180) problems.push(`${practice.title} has an overlong step.`);
        for (const match of step.matchAll(TIME_IN_STEP)) {
          if (Number(match[1]) > budget) problems.push(`${practice.title} asks for more time than the budget in "${step}".`);
        }
      }
    }
  }
  if (plan.plan_version < 1) problems.push("Plan version must be positive.");
  return problems;
}

export const PLAN_XP = PROGRESSION.xpPerCompletion;
