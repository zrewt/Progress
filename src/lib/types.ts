export type PillarId = "body" | "mind" | "craft" | "connection";

export type NodeStatus = "locked" | "active" | "completed";

export type IdentityId = "creator" | "athlete" | "scholar" | "builder";

export type BlockerId =
  | "consistency"
  | "distraction"
  | "overthinking"
  | "energy"
  | "time"
  | "stress"
  | "perfectionism";

export interface PillarMeta {
  id: PillarId;
  name: string;
  subtitle: string;
  icon: PillarId;
  accent: string;
  soft: string;
  roman: string;
}

export interface IdentityMeta {
  id: IdentityId;
  name: string;
  subtitle: string;
  accent: string;
  icon: "sparkles" | "dumbbell" | "book" | "hammer";
  goals: string[];
}

export interface BlockerMeta {
  id: BlockerId;
  label: string;
  subtitle: string;
  strategy: string;
}

export interface TreeNode {
  id: string;
  pillar: PillarId;
  tier: number;
  title: string;
  duration: string;
  description: string;
  instructions: string[];
  status: NodeStatus;
  completedAt?: string | null;
  branchLabel?: string;
}

export interface Profile {
  displayName: string;
  identity: IdentityId;
  goal: string;
  blocker?: BlockerId;
  timeBudget: string;
  level: number;
  xp: number;
  streak: number;
  lastCompletedDate: string | null;
  seasonStartedAt: string | null;
}

export interface OnboardingAnswers {
  identity: IdentityId;
  goal: string;
  blocker: BlockerId;
  timeBudget: string;
}

export interface GeneratedNode {
  title: string;
  duration: string;
  description: string;
  instructions: string[];
}

export interface GeneratedEasy {
  title: string;
  steps: string[];
}

export interface GeneratedTree {
  summary: string;
  safetyNote: string;
  pillars: {
    pillar: PillarId;
    focus?: string;
    /** The model's own two-minute version of the branch's week-one practice. */
    easy?: GeneratedEasy;
    nodes: GeneratedNode[];
  }[];
}

/** What the last season actually looked like, sent so the next plan can adapt. */
export interface PlanHistory {
  seasons: number;
  days_practised: number;
  days_planned: number;
  kept: string[];
  dropped: string[];
  average_effort: number | null;
  last_review: string | null;
}

export interface Celebration {
  id: number;
  title: string;
  xp: number;
  levelUp?: number;
  unlocked: boolean;
  nextTitle: string | null;
}

export interface AppUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResult {
  error?: string;
  info?: string;
}
