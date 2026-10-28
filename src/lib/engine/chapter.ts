import type { Season } from "../daily-types";
import { assessGoalSafety, scrubGoalForPrivacy } from "../safety";

export const REFLECTION_QUESTIONS = [
  "What went well?",
  "What felt difficult or didn't fit?",
  "What would you like to do differently?",
  "Does this goal still fit?",
] as const;
export type ChapterReflection = [string, string, string, string];

export function chapterReviewReason(season: Pick<Season, "status" | "ends_on">, today: string, milestoneCount: number, completedCount: number): "ended" | "grown" | null {
  if (season.status !== "active") return null;
  if (today >= season.ends_on) return "ended";
  return milestoneCount > 0 && completedCount >= milestoneCount ? "grown" : null;
}

/** Empty answers and short responses are valid; never send self-harm or declined text. */
export function reflectionProblem(answers: readonly string[]): string | null {
  for (const answer of answers) {
    const text = answer.trim();
    if (!text) continue;
    if (text.length > 160) return "Keep each answer to 160 characters or less.";
    const result = assessGoalSafety(text.length < 3 ? `${text}...` : text);
    if (!result.safe) return result.reason ?? "Please change this answer before continuing.";
  }
  return null;
}

export function chapterDraftIsUsable(localRequested: boolean, source: string, planSource: string): boolean {
  return localRequested || (source === "edge-ai" && planSource !== "local");
}

export function reflectionContext(answers: readonly string[]) {
  return REFLECTION_QUESTIONS.flatMap((question, index) => {
    const answer = scrubGoalForPrivacy(answers[index] ?? "");
    return answer ? [{ question, answer }] : [];
  });
}
