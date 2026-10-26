import type { PillarId } from "../types";

/**
 * A practice template. Steps never prescribe a duration, so the same practice
 * can be offered at 5, 15 or 30 minutes without any step exceeding the budget.
 * `deep` steps are appended for the 15 and 30 minute variants.
 */
export interface ThemePractice {
  key: string;
  branch: PillarId;
  title: string;
  why: string;
  full: string[];
  deep?: string[];
  easyTitle: string;
  easy: string[];
}

export type ThemeId =
  | "running"
  | "strength"
  | "sleep"
  | "nutrition"
  | "study"
  | "coding"
  | "writing"
  | "mindfulness"
  | "connection"
  | "consistency";

export interface PlanTheme {
  id: ThemeId;
  label: string;
  /** Strong terms identify the theme; weak terms only break ties. */
  strong: string[];
  weak: string[];
  primary: ThemePractice;
  supporting: [ThemePractice, ThemePractice, ThemePractice];
  /** Set when the content needs a domain expert before release. */
  needsDomainReview?: boolean;
}
