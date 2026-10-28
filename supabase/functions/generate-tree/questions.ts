export interface PersonalizationQuestion {
  question: string;
  options: string[];
}

export interface PersonalizationAnswer {
  question: string;
  answer: string;
}

// Do not solicit diagnoses, medications, symptoms or other sensitive health details.
const SENSITIVE_QUESTION = /\b(diagnos\w*|medic(?:al|ation|ine)\w*|symptom\w*|disabilit\w*|disorder\w*|disease\w*|illness\w*|injur(?:y|ies|ed)|pregnan\w*|therapy|therapist|treatment|prescription\w*|weight|calories|body mass|mental health|health history)\b/i;

export function validateQuestions(raw: unknown): PersonalizationQuestion[] | null {
  if (!raw || typeof raw !== "object") return null;
  const questions = (raw as { questions?: unknown }).questions;
  // Five is the ceiling everywhere: this validator, the Edge context slice and
  // the database's context check. Raising it in one place alone would make a
  // valid answer set fail to save.
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 5) return null;
  const result: PersonalizationQuestion[] = [];
  for (const item of questions) {
    if (!item || typeof item !== "object") return null;
    const { question, options } = item as { question?: unknown; options?: unknown };
    if (typeof question !== "string" || question.trim().length < 8 || question.trim().length > 140 || SENSITIVE_QUESTION.test(question)) return null;
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) return null;
    if (options.some((option) => typeof option !== "string" || option.trim().length < 1 || option.trim().length > 70 || SENSITIVE_QUESTION.test(option))) return null;
    // Skip and custom answers are supplied by the app itself. Discard redundant
    // model-generated versions instead of rejecting an otherwise valid question.
    const choices = (options as string[]).map((option) => option.trim())
      .filter((option) => !/^(?:skip|other|custom|prefer not to (?:say|answer))$/i.test(option));
    if (choices.length < 2 || new Set(choices.map((option) => option.toLowerCase())).size !== choices.length) return null;
    result.push({ question: question.trim(), options: choices });
  }
  if (new Set(result.map((item) => item.question.toLowerCase())).size !== result.length) return null;
  return result;
}

export const GENERAL_QUESTIONS: PersonalizationQuestion[] = [
  { question: "Where are you starting with this goal?", options: ["Just starting", "Some experience", "Already working on it"] },
  { question: "What would help you most right now?", options: ["Know what to do first", "Practice a skill", "Finish something I started"] },
  { question: "What resources can you use?", options: ["Only what I already have", "I have some tools or support", "I am not sure yet"] },
  { question: "What makes this easier to keep up?", options: ["A set time each day", "A shorter version on busy days", "Someone to check in with"] },
  { question: "How do you like to work?", options: ["Follow a clear plan", "Try things and adjust", "Work alongside someone"] },
];
