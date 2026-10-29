import { assessGoal, safeForCategory, type GoalCategory } from "./safety-rules.ts";

export const BRANCH_SLOTS = ["body", "mind", "craft", "connection"] as const;
export type BranchSlot = typeof BRANCH_SLOTS[number];
export interface MilestoneOutline { title: string; description: string }
export interface BranchOutline { name: string; milestones: MilestoneOutline[] }
export type ChapterOutlines = Record<BranchSlot, BranchOutline>;

// The same sensitive terms used for questions are also inappropriate in outlines.
const SENSITIVE = /\b(diagnos\w*|medic(?:al|ation|ine)\w*|symptom\w*|disabilit\w*|disorder\w*|disease\w*|illness\w*|injur(?:y|ies|ed)|pregnan\w*|therapy|therapist|treatment|prescription\w*|weight|calories|body mass|mental health|health history)\b/i;
const CLAIM = /\b(cure[sd]?|treats?|prevents? (?:disease|injury|illness)|diagnos\w*|guarantee[sd]?|discipline|no excuses)\b/i;
function safeText(value: unknown, min: number, max: number, category: GoalCategory): value is string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max || SENSITIVE.test(value) || CLAIM.test(value) || !safeForCategory(value, category) || (category === "high-risk" && /\b(climb(?:ing)?|div(?:e|ing)|summit|ascent|descent|rope|gear|equipment|route|expedition|train(?:ing)?)\b/i.test(value))) return false;
  const verdict = assessGoal(value);
  return verdict.kind === "ok";
}
export function validOutlines(raw: unknown, category: GoalCategory): raw is ChapterOutlines {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== 4) return false;
  const data = raw as Record<string, unknown>;
  const names = new Set<string>();
  for (const slot of BRANCH_SLOTS) {
    const branch = data[slot] as Partial<BranchOutline> | undefined;
    if (!branch || !safeText(branch.name, 3, 48, category) || !Array.isArray(branch.milestones) || branch.milestones.length !== 4) return false;
    const name = branch.name.trim().toLowerCase();
    if (names.has(name)) return false;
    names.add(name);
    const titles = new Set<string>();
    for (const item of branch.milestones) {
      if (!item || !safeText(item.title, 3, 70, category) || !safeText(item.description, 8, 180, category)) return false;
      const title = item.title.trim().toLowerCase();
      if (titles.has(title)) return false;
      titles.add(title);
    }
  }
  return true;
}

export function preparationOutlines(): ChapterOutlines {
  const names = ["Qualified guidance", "Prerequisites", "Support", "Planning"];
  return Object.fromEntries(BRANCH_SLOTS.map((slot, index) => [slot, { name: names[index], milestones: [
    { title: "Find guidance", description: "Identify a qualified professional to ask for guidance." },
    { title: "Prepare questions", description: "Write questions about supervised preparation." },
    { title: "Discuss prerequisites", description: "Ask the professional about appropriate prerequisites." },
    { title: "Review next steps", description: "Review the professional's advice before deciding what comes next." },
  ] }])) as ChapterOutlines;
}

/** Generic and explicitly local, never a claim of personalized AI output. */
export function localOutlines(): ChapterOutlines {
  const names = ["Getting started", "Making room", "Learning", "Reviewing progress"];
  return Object.fromEntries(BRANCH_SLOTS.map((slot, index) => [slot, {
    name: names[index],
    milestones: [
      { title: "Choose a starting point", description: "Identify a manageable place to begin." },
      { title: "Try a small step", description: "Explore an approach that fits your circumstances." },
      { title: "Notice what fits", description: "Review what is useful and what needs adjusting." },
      { title: "Choose what comes next", description: "Decide which small step to carry forward." },
    ],
  }])) as ChapterOutlines;
}
