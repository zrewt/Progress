import type { GeneratedNode, OnboardingAnswers } from "./types";
import { assessGoal, validatePracticeText, CRISIS_RESOURCES } from "./safety-rules";

export interface GoalSafetyAssessment {
  safe: boolean;
  reason?: string;
  suggestion?: string;
  coachingNote?: string;
  /** Set when the goal needs support rather than a plan. */
  support?: "self-harm" | "recovery";
}

/**
 * Strips emails, phone numbers and @handles from a goal before it is ever sent
 * to an external model. This reduces accidental sharing; it is not anonymisation.
 */
export function scrubGoalForPrivacy(goal: string): string {
  return goal
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]")
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/(^|\s)@[a-zA-Z0-9_.-]+/g, "$1[person]")
    .trim();
}

/** Safety decision for a goal, in the shape the onboarding screens already use. */
export function assessGoalSafety(rawGoal: string): GoalSafetyAssessment {
  const verdict = assessGoal(rawGoal);
  if (verdict.kind === "decline") {
    return { safe: false, reason: verdict.message, suggestion: verdict.reframe };
  }
  if (verdict.kind === "support" && verdict.support === "self-harm") {
    return { safe: false, reason: verdict.message, support: "self-harm" };
  }
  if (verdict.kind === "support") {
    return { safe: true, support: "recovery", coachingNote: verdict.message };
  }
  return {
    safe: true,
    coachingNote:
      "Every practice has a version you could do on your hardest day, and it always fits the time you chose.",
  };
}

export { CRISIS_RESOURCES };

function maxMinutesForBudget(budget: string) {
  if (budget === "5") return 5;
  if (budget === "15") return 15;
  return 30;
}

export function clampDurationToBudget(duration: string, tier: number, budget: string): string {
  const cap = tier === 0 ? Math.min(3, maxMinutesForBudget(budget)) : maxMinutesForBudget(budget);
  const match = duration.match(/(\d+)/);
  const parsed = match ? parseInt(match[1], 10) : tier === 0 ? 2 : 10;
  const safeMinutes = Math.max(1, Math.min(parsed || 2, cap));
  return `${safeMinutes} min`;
}

/** Replaces any generated node whose text fails the shared output validation. */
export function sanitizeGeneratedNode(
  candidate: GeneratedNode,
  fallback: GeneratedNode,
  tier: number,
  answers: OnboardingAnswers,
): GeneratedNode {
  const combined = `${candidate.title} ${candidate.description} ${candidate.instructions.join(" ")}`;
  if (!validatePracticeText(combined).ok) {
    return { ...fallback, duration: clampDurationToBudget(fallback.duration, tier, answers.timeBudget) };
  }
  return {
    title: candidate.title.slice(0, 60),
    duration: clampDurationToBudget(candidate.duration, tier, answers.timeBudget),
    description: candidate.description.slice(0, 180),
    instructions: candidate.instructions.map((step) => step.slice(0, 120)).slice(0, 4),
  };
}

/** A two-minute version of any practice, for the onboarding preview. */
export function twoMinuteSeedVersion(node: { title: string; instructions: string[] }) {
  const firstStep = node.instructions[0] ?? `Set a two-minute timer and begin ${node.title.toLowerCase()}.`;
  return {
    duration: "2 min",
    instructions: [
      firstStep,
      "Do only two calm minutes — stop while it still feels easy.",
      "Bank the repetition. Showing up keeps the branch alive.",
    ],
    note: "Shrunk to a two-minute version: protects your consistency on a hard day.",
  };
}
