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

export type GoalCategory = "ordinary" | "physical" | "high-risk";
/** Conservative flags only add restrictions; an AI result cannot remove one. */
export function classifyGoal(goal: string, aiFlag?: GoalCategory): GoalCategory {
  const creation = /\b(build|make|create|design|write|develop|launch)\b/i.test(goal) && /\b(app|website|book|novel|podcast|software|game)\b/i.test(goal) && !/\b(and|also|then)\b/i.test(goal);
  const high = !creation && /\b(climb\w*|mountaineer\w*|matterhorn|everest|div(?:e|es|er|ers|ing)|scuba|ultramarathon|ultra-endurance|triathlon|ironman|marathon|skydiv\w*|parachut\w*|base jump\w*)\b/i.test(goal);
  const physical = !creation && /\b(run\w*|jog\w*|walk\w*|tennis|swim\w*|cycl\w*|bike|fitness|exercise|workout|strength|lift\w*|sport\w*|football|soccer|basketball|hike|hiking|yoga|gym)\b/i.test(goal);
  return high || aiFlag === "high-risk" ? "high-risk" : physical || aiFlag === "physical" ? "physical" : "ordinary";
}
export function safetyInstructions(category: GoalCategory, conservative: boolean): string {
  return `${category === "high-risk" ? "Preparation only. Get qualified instruction. Never provide routes, climbing/diving techniques, equipment selection or equipment safety instructions. Limit actions to finding qualified instruction, confirming prerequisites with that professional and nontechnical preparation." : ""} ${conservative ? "Conservative mode: gentle progression only, no extreme physical actions. For physical goals recommend a trusted adult when under 18 and qualified professional guidance. Never infer medical details." : ""}`;
}
export function safeForCategory(text: string, category: GoalCategory): boolean {
  if (!validatePracticeText(text).ok) return false;
  return category !== "high-risk" || !/\b(hornli|hörnli|summit route|climb the|rope up|tie (?:a |the )?knot|belay|rappel|abseil|crampon|oxygen tank|decompression|dive to|ascend to|descend to|harness|carabiner)\b/i.test(text);
}
export function requiresPreparation(category: GoalCategory, conservative: boolean): boolean {
  return category === "high-risk" || (category === "physical" && conservative);
}
/** Conservative physical plans use nontechnical preparation, not unverified exercise prescriptions. */
export function preparationTree<T extends { pillars: { pillar: string; nodes: unknown[] }[] }>(tree: T): T {
  const actions: Record<string, [string, string, string]> = {
    craft: ["Find qualified instruction", "Find the contact page of a qualified instructor for this goal.", "Write one question about suitable supervised preparation."],
    body: ["Plan a rest window", "Choose a comfortable rest window in your calendar.", "Leave that window free from physical training."],
    mind: ["Prepare a prerequisite question", "Write down what you do not yet know about supervised prerequisites.", "Save that question for a qualified professional, without trying the activity."],
    connection: ["Identify a support person", "Write the name of a trusted adult or support person you could ask for help.", "Draft a short request for help finding qualified guidance."],
  };
  return { ...tree, primaryBranch: "craft", safetyNote: "Preparation only. Get qualified instruction before physical activity. Involve a trusted adult if you are under 18.", pillars: tree.pillars.map(p => {
    const [title, first, second] = actions[p.pillar] ?? actions.craft;
    return { ...p, focus: "Nontechnical preparation", localRepair: true, hasAiContent: false, nodes: p.nodes.map((_, i) => ({ title, duration: "2 min", description: "Start with qualified guidance, not a self-directed physical activity.", instructions: i ? [second, first] : [first, second], easy: { title, steps: [first] } })) };
  }) };
}
export const PAIN_MESSAGE = "Stop and rest for now. If pain continues, contact a qualified health professional. The next practice will use the easy version.";

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
    return { kind: "decline", message: "Write a few words about the change you want." };
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

/**
 * Wording that fits every goal and therefore helps none. A plan that says
 * "open the editor and write five lines" has not been written for this person.
 * These are rejected rather than discouraged, because a prompt that only asks
 * for specificity gets ignored on the day the model is lazy.
 */
export const GENERIC_STEP_PATTERNS: [RegExp, string][] = [
  [/\bedit (a|the|your) (file|code)\b/i, "edit a file"],
  [/\bwrite (5|five|a few) lines\b/i, "write five lines"],
  [/\bopen (the|your) (code )?editor\b/i, "open the editor"],
  [/\bwork on (your|the) (project|goal|app|thing)\b/i, "work on your project"],
  [/\bmake (some |a little )?progress\b/i, "make progress"],
  [/\bdo some research\b/i, "do some research"],
  [/\breset your (shoulders|body|mind)\b/i, "reset your shoulders"],
  [/\bcheck in with yourself\b/i, "check in with yourself"],
  [/\breflect on (your|the) (progress|day|journey|week)\b/i, "reflect on your progress"],
  [/\breview your notes\b/i, "review your notes"],
  [/\bsave your progress\b/i, "save your progress"],
  [/\bthe seed is planted\b/i, "the seed is planted"],
  [/\bcelebrate (your|the) (win|wins|progress|promise|success)\b/i, "celebrate"],
  [/\bkeep going\b/i, "keep going"],
  [/\bstay (motivated|consistent|positive|focused)\b/i, "stay motivated"],
  [/\bbe kind to yourself\b/i, "be kind to yourself"],
  [/\bdo your best\b/i, "do your best"],
];

/** The placeholder this text uses, or null when it names something real. */
export function genericFiller(text: string): string | null {
  return GENERIC_STEP_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function comparableStep(step: string): string {
  return step
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A step copied onto two branches is a step written for no branch. Short
 * instructions are skipped because "Set a timer" is legitimately shared.
 */
export function repeatedStep(
  branches: { name: string; steps: string[] }[],
): { step: string; branches: string[] } | null {
  const seen = new Map<string, { text: string; branches: Set<string> }>();
  for (const branch of branches) {
    for (const step of branch.steps) {
      const key = comparableStep(step);
      if (key.length < 20) continue;
      const entry = seen.get(key) ?? { text: step, branches: new Set<string>() };
      entry.branches.add(branch.name);
      seen.set(key, entry);
    }
  }
  for (const entry of seen.values()) {
    if (entry.branches.size > 1) {
      return { step: entry.text, branches: [...entry.branches] };
    }
  }
  return null;
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
