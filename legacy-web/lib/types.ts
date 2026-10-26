export type PillarId = "mobility" | "endurance" | "strength" | "recovery";

export type NodeStatus = "locked" | "active" | "completed";

export type SpaceId = "bodyweight" | "home-gym" | "full-gym";

export interface PillarMeta {
  id: PillarId;
  name: string;
  subtitle: string;
  icon: "mobility" | "endurance" | "strength" | "recovery";
  accent: string;
  soft: string;
  roman: string;
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
}

export interface Profile {
  displayName: string;
  friction: string;
  timeBudget: string;
  space: string;
  level: number;
  xp: number;
  streak: number;
  lastCompletedDate: string | null;
}

export interface OnboardingAnswers {
  friction: string;
  timeBudget: string;
  space: string;
}

export interface GeneratedNode {
  title: string;
  duration: string;
  description: string;
  instructions: string[];
}

export interface GeneratedTree {
  pillars: {
    pillar: PillarId;
    nodes: GeneratedNode[];
  }[];
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
