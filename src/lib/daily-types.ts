import type { BlockerId, IdentityId, PillarId, PersonalizationAnswer } from "./types";

/** One week of a practice. Week 1 is the variant itself; later weeks are its ladder. */
export interface Rung { title: string; minutes: number; steps: string[] }
/**
 * `ladder` holds the following weeks of the same practice, so a plan deepens
 * instead of repeating its first step for 30 days. It lives inside the variant
 * jsonb, which is why no migration is needed and older plans still read fine.
 */
export interface Variant extends Rung { ladder?: Rung[] }
export interface PracticeDraft {
  branch: PillarId;
  title: string;
  why: string;
  role: "primary" | "supporting";
  cadence: "daily" | "weekly";
  cadence_n: number;
  full_variant: Variant;
  easy_variant: Variant;
}
export interface DailyPlan {
  goal: string;
  identity: IdentityId;
  blocker: BlockerId;
  minutes_budget: 5 | 15 | 30;
  plan_version: number;
  plan_source: "ai" | "local" | "mixed" | "unknown";
  personalization_context?: PersonalizationAnswer[];
  plan_summary: string;
  safety_note: string;
  branch_labels: Record<PillarId, string>;
  practices: PracticeDraft[];
}
export interface Season extends Omit<DailyPlan, "practices"> {
  /** Older and individually edited plans have no reliable practice-level provenance. */
  plan_source_verified?: boolean;
  id: string;
  user_id: string;
  started_on: string;
  ends_on: string;
  status: "active" | "completed" | "archived";
  week_mode: "same" | "lighter";
  week_mode_until: string | null;
  created_at: string;
  ended_at: string | null;
}
export interface WeeklyReview {
  id: string;
  user_id: string;
  season_id: string;
  week_start: string;
  difficulty: number;
  note: string | null;
  adherence: number | string;
  decision: "lighter" | "same" | "harder";
  applied_at: string | null;
  created_at: string;
}
export interface SeasonHistoryEntry {
  id: string;
  goal: string;
  status: "completed" | "archived";
  started_on: string;
  ends_on: string;
  days_practiced: number;
  xp: number;
  summary: string;
}
export interface Practice extends PracticeDraft {
  id: string;
  user_id: string;
  season_id: string;
  active: boolean;
  replaced_by: string | null;
  sort_order: number;
}
export type EventKind = "full" | "easy" | "skipped" | "rest";
export interface CompletionEvent {
  id: string;
  user_id: string;
  season_id: string;
  practice_id: string | null;
  client_event_id: string;
  kind: EventKind;
  occurred_at: string;
  local_date: string;
  minutes_actual: number | null;
  effort: number | null;
  note: string | null;
  undone_at: string | null;
  created_at: string;
  source: "app" | "migrated";
}
export interface Milestone {
  id: string;
  season_id: string;
  user_id: string;
  branch: PillarId;
  tier: number;
  title: string;
  practice_id: string;
  required_days: number;
  unlocked_at: string | null;
}
export interface Progress {
  xp: number;
  season_xp: number;
  level: number;
  current_streak: number;
  best_streak: number;
  practiced_days: number;
  branch_growth: Record<PillarId, number>;
  unlocked_milestones: string[];
}
export interface DailyProfile {
  id: string;
  display_name: string | null;
  timezone: string;
  blocker: BlockerId | null;
  ai_consent_version: string | null;
  ai_consent_at: string | null;
}
export interface DailySnapshot {
  profile: DailyProfile | null;
  seasons: Season[];
  practices: Practice[];
  milestones: Milestone[];
  events: CompletionEvent[];
  reviews: WeeklyReview[];
  progress: Progress | null;
}
export interface EventInput {
  season_id: string;
  practice_id: string | null;
  kind: EventKind;
  client_event_id: string;
  occurred_at: string;
  minutes_actual?: number;
  effort?: number;
  note?: string;
}
