import type { GeneratedNode, OnboardingAnswers } from "./types";

export interface GoalSafetyAssessment {
  safe: boolean;
  reason?: string;
  suggestion?: string;
  coachingNote?: string;
}

interface SafetyRule {
  pattern: RegExp;
  reason: string;
  suggestion: string;
}

const BLOCKED_GOAL_RULES: SafetyRule[] = [
  {
    pattern:
      /\b(starv(e|ing|ation)|0 calories|zero calories|500 calories|purge|purging|throw up|laxative|(?:stop|not) eating\s+(?:anything|at all|food|for \d+ days|ever))\b/i,
    reason:
      "Safety check: extreme restriction harms your energy and long-term growth. Normal habits like stopping late-night snacking or cutting junk food are totally fine!",
    suggestion: "Stop late-night snacking and eat balanced meals during the day",
  },
  {
    pattern:
      /\b(self[- ]?harm|hurt myself|cut myself|punish my body|bleed|suicid|kill myself|end my life)\b/i,
    reason:
      "Safety check: Vitality Tree only supports safe, life-affirming practices. If you are in distress, please reach out to 988 or a trusted person right now.",
    suggestion: "Take care of my body and talk to one person I trust each day",
  },
  {
    pattern:
      /\b(sleep (0|1|2|3) hours|all[- ]?nighter every day|never sleep)\b/i,
    reason:
      "Counter-goal check: extreme sleep deprivation causes burnout within days.",
    suggestion: "Get to bed on time and protect a steady sleep schedule",
  },
  {
    pattern:
      /\b(steroids|peds|anavar|tren|meth|heroin|cocaine|fentanyl)\b/i,
    reason:
      "Safety check: we can't build a growth tree around unsafe substances or compounds.",
    suggestion: "Build a clean daily routine that boosts natural energy",
  },
];

const GENTLE_COACHING_PATTERNS: { pattern: RegExp; note: string }[] = [
  {
    pattern:
      /\b(100 miles|marathon tomorrow|every single hour|4 hours a day|5 hours a day|no rest days|work 16 hours|work 18 hours)\b/i,
    note: "Ambitious goal! We scaled your starting seeds to fit your daily time budget so you build consistency without burning out.",
  },
  {
    pattern: /\b(eat|eating|snack|sugar|junk food|diet|fasting|night)\b/i,
    note: "Nutrition & evening habit goal: we'll focus on calm evening cues, hydration, and steady daytime energy.",
  },
];

/**
 * Strips emails, phone numbers, and @handles from a goal string before it is
 * ever sent to an external AI model, protecting user privacy on free-tier keys.
 */
export function scrubGoalForPrivacy(goal: string): string {
  return goal
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]")
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/(^|\s)@[a-zA-Z0-9_.-]+/g, "$1[person]")
    .trim();
}

/**
 * Evaluates a user's 30-day goal before any tree is generated.
 * Blocks unsafe, self-harmful, or burnout-inducing goals and suggests a healthy reframe.
 */
export function assessGoalSafety(rawGoal: string): GoalSafetyAssessment {
  const clean = rawGoal.trim();
  if (clean.length < 3) {
    return {
      safe: false,
      reason: "Write at least a few words describing the change you want in 30 days.",
    };
  }

  for (const rule of BLOCKED_GOAL_RULES) {
    if (rule.pattern.test(clean)) {
      return {
        safe: false,
        reason: rule.reason,
        suggestion: rule.suggestion,
      };
    }
  }

  for (const item of GENTLE_COACHING_PATTERNS) {
    if (item.pattern.test(clean)) {
      return {
        safe: true,
        coachingNote: item.note,
      };
    }
  }

  return {
    safe: true,
    coachingNote:
      "Safety & pacing verified: every tier starts with a 2-minute seed and stays inside your daily time budget.",
  };
}

const UNSAFE_NODE_WORDS =
  /\b(starve|skip meals|fast for 24|push through sharp pain|ignore pain|sleep less|all-nighter|punish|vape|gamble|bet|max out until failure)\b/i;

function maxMinutesForBudget(budget: string) {
  if (budget === "5") return 5;
  if (budget === "15") return 15;
  return 30;
}

export function clampDurationToBudget(
  duration: string,
  tier: number,
  budget: string,
): string {
  const cap = tier === 0 ? Math.min(3, maxMinutesForBudget(budget)) : maxMinutesForBudget(budget);
  const match = duration.match(/(\d+)/);
  const parsed = match ? parseInt(match[1], 10) : tier === 0 ? 2 : 10;
  const safeMinutes = Math.max(1, Math.min(parsed || 2, cap));
  return `${safeMinutes} min`;
}

/**
 * Scrubs any AI-generated node so it never prescribes unsafe actions,
 * medical claims, or durations that violate the user's time budget.
 */
export function sanitizeGeneratedNode(
  candidate: GeneratedNode,
  fallback: GeneratedNode,
  tier: number,
  answers: OnboardingAnswers,
): GeneratedNode {
  const combined = `${candidate.title} ${candidate.description} ${candidate.instructions.join(" ")}`;
  if (UNSAFE_NODE_WORDS.test(combined)) {
    return {
      ...fallback,
      duration: clampDurationToBudget(fallback.duration, tier, answers.timeBudget),
    };
  }

  return {
    title: candidate.title.slice(0, 60),
    duration: clampDurationToBudget(candidate.duration, tier, answers.timeBudget),
    description: candidate.description.slice(0, 180),
    instructions: candidate.instructions.map((step) => step.slice(0, 120)).slice(0, 4),
  };
}

/**
 * Generates a 2-minute "Seed version" of any practice for low-energy days,
 * so the user never has to break their rhythm or push into burnout.
 */
export function twoMinuteSeedVersion(node: {
  title: string;
  instructions: string[];
}): { duration: string; instructions: string[]; note: string } {
  const firstStep =
    node.instructions[0] ?? `Set a 2-minute timer and begin ${node.title.toLowerCase()}.`;
  return {
    duration: "2 min",
    instructions: [
      firstStep,
      "Do only two calm minutes — stop while it still feels easy.",
      "Bank the repetition. Showing up keeps the branch alive.",
    ],
    note: "Shrunk to a 2-minute seed: protects your consistency on a hard day.",
  };
}
