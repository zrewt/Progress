// GENERATED FILE. Edit src/lib/safety-rules.ts and run `npm run safety:sync`.
/**
 * Canonical safety rules. Dependency-free so the Supabase Edge Function can run
 * an identical copy. Edit this file, then run `npm run safety:sync`.
 *
 * NEEDS REVIEW: the crisis resources below must be checked for each launch region.
 */

export type SafetyKind = "ok" | "decline" | "support";

export interface GoalSafety {
  kind: SafetyKind;
  /** Plain-language explanation shown to the user. */
  message?: string;
  /** A gentle alternative goal, offered on decline. */
  reframe?: string;
  /** Which support path applies. */
  support?: "self-harm" | "recovery";
}

export const NEEDS_REVIEW = true;

export const CRISIS_RESOURCES = {
  // NEEDS REVIEW: launch regions, local numbers and translation.
  selfHarm: {
    region: "US",
    name: "988 Suicide & Crisis Lifeline",
    contact: "Call or text 988",
  },
  international: {
    region: "International",
    name: "Find A Helpline",
    contact: "findahelpline.com",
  },
} as const;

const SELF_HARM = /\b(self[- ]?harm(ing|ed)?|hurt(ing)? myself|cut(ting)? myself|suicid(e|al)|kill(ing)? myself|end(ing)? my life|want to die|don’t want to be here|don't want to be here)\b/i;

const RECOVERY = /\b(quit|quitting|stop|stopping|give up|giving up|get off|getting off|sober|sobriety|recover(y|ing)?|clean from)\b[^.!,;]{0,40}\b(cocaine|heroin|meth|methamphetamine|fentanyl|opioids?|pills|drugs|drinking|alcohol|weed|marijuana|vaping|vape|smoking|nicotine|porn)\b/i;

const SUBSTANCE_USE = /\b(steroids?|anabolic|peds|anavar|trenbolone|clenbuterol|meth|methamphetamine|heroin|cocaine|crack|fentanyl|mdma|ecstasy)\b/i;

const STARVATION = /\b(starve|starving|starvation|anorexi\w*|bulimi\w*|purge|purging|throw up|laxatives?)\b/i;

const CALORIE_TARGET = /\b(\d{1,4})\s*(calories|kcal|cal)\b/gi;

const FASTING = /\b(water fast|dry fast|fast(ing)? (for )?(\d+|two|three|four|five|seven|ten)[ -]?days?|\d{1,2}[- ]hour fast|intermittent fasting (extreme|all day))\b/i;

const SLEEP_DEPRIVATION = /\b(never sleep|no sleep|sleep (0|1|2|3|4) hours?|(0|1|2|3|4) hours? (of )?sleep|all[- ]nighters?|polyphasic sleep)\b/i;

const EXTREME_LOAD = /\b(no rest days|train every day for (\d+|two|three|four|five) hours|work(ing)? (16|18|20) hours|100 miles|marathon tomorrow)\b/i;

/** A negation directly before a risky phrase makes it a warning, not advice. */
function negated(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 24), index).toLowerCase();
  return /\b(do not|don't|dont|never|avoid|without|stop|no)\s*(ever\s*)?$/.test(before);
}

function firstRisk(text: string) {
  for (const [pattern, problem] of [
    [STARVATION, "starving"],
    [FASTING, "extreme fasting"],
    [SLEEP_DEPRIVATION, "sleep deprivation"],
  ] as const) {
    if (pattern.test(text)) return problem;
  }
  for (const match of text.matchAll(CALORIE_TARGET)) {
    if (Number(match[1]) < 1500) return "an extreme calorie target";
  }
  const load = text.match(EXTREME_LOAD);
  if (load && !negated(text, load.index ?? 0)) return "training through rest and pain";
  return null;
}

/**
 * Decide how to treat a goal before any plan is made.
 * Recovery goals are supported, never treated as errors.
 */
export function assessGoal(raw: string): GoalSafety {
  const goal = raw.trim();
  if (goal.length < 3) {
    return { kind: "decline", message: "Write a few words about the change you want in 30 days." };
  }

  if (SELF_HARM.test(goal)) {
    return {
      kind: "support",
      support: "self-harm",
      message: `You deserve real support, and this app is not the right place for that today. ${CRISIS_RESOURCES.selfHarm.name}: ${CRISIS_RESOURCES.selfHarm.contact}. Outside the US, ${CRISIS_RESOURCES.international.name}: ${CRISIS_RESOURCES.international.contact}.`,
    };
  }

  if (RECOVERY.test(goal)) {
    return {
      kind: "support",
      support: "recovery",
      message:
        "That is a real and difficult thing to take on. This plan will only offer gentle, non-medical habits such as routine, connection and rest. It is not treatment, and a clinician or support group should be part of it.",
    };
  }

  if (SUBSTANCE_USE.test(goal)) {
    return {
      kind: "decline",
      message: "This app cannot build a plan around using substances or performance compounds.",
      reframe: "Build a steady routine that supports my energy and sleep",
    };
  }

  const risk = firstRisk(goal);
  if (risk) {
    return {
      kind: "decline",
      message: `This goal asks your body to run on too little. A plan built around ${risk} would harm you, so this app will not make one.`,
      reframe: "Eat regular meals and keep a calm evening routine",
    };
  }

  return { kind: "ok" };
}

/** Output validation for any generated or curated practice text. */
export function validatePracticeText(text: string): { ok: boolean; problem?: string } {
  if (SELF_HARM.test(text)) return { ok: false, problem: "self-harm content" };
  if (STARVATION.test(text)) return { ok: false, problem: "starvation language" };
  if (FASTING.test(text)) return { ok: false, problem: "extreme fasting" };
  if (SLEEP_DEPRIVATION.test(text)) return { ok: false, problem: "sleep deprivation" };

  for (const match of text.matchAll(CALORIE_TARGET)) {
    if (Number(match[1]) < 1500) return { ok: false, problem: "an extreme calorie target" };
  }

  if (SUBSTANCE_USE.test(text) && !negated(text, text.search(SUBSTANCE_USE))) {
    return { ok: false, problem: "substance use" };
  }

  const load = text.match(EXTREME_LOAD);
  if (load && !negated(text, load.index ?? 0)) return { ok: false, problem: "training through rest" };

  return { ok: true };
}

export const MINUTES_IN_TEXT = /\b(\d+)\s*(?:min|mins|minute|minutes|hr|hrs|hour|hours)\b/gi;

/** Every step must fit inside the daily budget. */
export function validateStepsWithinBudget(steps: string[], budget: number): { ok: boolean; problem?: string } {
  for (const step of steps) {
    for (const match of step.matchAll(MINUTES_IN_TEXT)) {
      if (Number(match[1]) > budget) return { ok: false, problem: "a step exceeds the time budget" };
    }
    const safety = validatePracticeText(step);
    if (!safety.ok) return safety;
  }
  return { ok: true };
}
