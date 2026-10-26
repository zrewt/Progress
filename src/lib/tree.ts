import { PILLARS } from "./pillars";
import type {
  GeneratedTree,
  IdentityId,
  NodeStatus,
  PillarId,
  TreeNode,
} from "./types";

export const NODE_XP = 50;
export const XP_PER_LEVEL = 200;
export const TIERS_PER_PILLAR = 4;
export const SEASON_DAYS = 30;

export const TIER_MILESTONES = ["Seed", "Root", "Branch", "Canopy"] as const;

export function milestoneForTier(tier: number) {
  return TIER_MILESTONES[tier] ?? TIER_MILESTONES[TIER_MILESTONES.length - 1];
}

export function levelStats(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const level = Math.floor(safeXp / XP_PER_LEVEL) + 1;
  const into = safeXp % XP_PER_LEVEL;
  return {
    level,
    into,
    needed: XP_PER_LEVEL,
    progress: into / XP_PER_LEVEL,
    toNext: XP_PER_LEVEL - into,
  };
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function yesterdayKey(date = new Date()) {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  return todayKey(prev);
}

/** Streak rules: same day keeps it, yesterday extends it, otherwise restarts at 1. */
export function nextStreak(lastCompletedDate: string | null, streak: number) {
  const today = todayKey();
  if (lastCompletedDate === today) return Math.max(1, streak);
  if (lastCompletedDate === yesterdayKey()) return Math.max(1, streak) + 1;
  return 1;
}

export function nodeId(pillar: string, tier: number) {
  return `${pillar}-${tier}`;
}

export function buildNodes(tree: GeneratedTree): TreeNode[] {
  return PILLARS.flatMap((pillar) => {
    const generated =
      tree.pillars.find((p) => p.pillar === pillar.id)?.nodes ?? [];
    return generated.slice(0, TIERS_PER_PILLAR).map((node, tier) => ({
      id: nodeId(pillar.id, tier),
      pillar: pillar.id,
      tier,
      title: node.title,
      duration: node.duration,
      description: node.description,
      instructions: node.instructions,
      status: (tier === 0 ? "active" : "locked") as NodeStatus,
      completedAt: null,
    }));
  });
}

export function firstActiveNode(nodes: TreeNode[]) {
  return (
    nodes.find((n) => n.status === "active") ??
    nodes.find((n) => n.status !== "completed") ??
    null
  );
}

/** The branch that most directly expresses each identity. */
const SIGNATURE_BRANCH: Record<IdentityId, PillarId> = {
  creator: "craft",
  athlete: "body",
  scholar: "mind",
  builder: "craft",
};

/**
 * The next best action: the active practice in the least-grown branch, so the
 * tree stays balanced instead of sprinting down one limb. Ties go to the
 * branch that expresses the user's identity, then to the earlier tier.
 */
export function nextBestNode(nodes: TreeNode[], identity?: IdentityId) {
  const active = nodes.filter((node) => node.status === "active");
  if (!active.length) return firstActiveNode(nodes);

  const grown = (pillar: string) =>
    nodes.filter(
      (node) => node.pillar === pillar && node.status === "completed",
    ).length;
  const signature = identity ? SIGNATURE_BRANCH[identity] : null;

  return [...active].sort((a, b) => {
    const diff = grown(a.pillar) - grown(b.pillar);
    if (diff !== 0) return diff;
    if (signature && a.pillar !== b.pillar) {
      if (a.pillar === signature) return -1;
      if (b.pillar === signature) return 1;
    }
    return a.tier - b.tier;
  })[0];
}

export function completedCount(nodes: TreeNode[]) {
  return nodes.filter((n) => n.status === "completed").length;
}

export function pillarProgress(nodes: TreeNode[], pillarId: string) {
  const branch = nodes.filter((n) => n.pillar === pillarId);
  return {
    done: branch.filter((n) => n.status === "completed").length,
    total: branch.length,
  };
}

/**
 * Completes a node and unlocks the next tier in the same pillar.
 * Returns the next node array plus the unlocked node (if any).
 */
export function completeNodeInTree(nodes: TreeNode[], id: string) {
  const target = nodes.find((n) => n.id === id);
  if (!target || target.status !== "active") {
    return { nodes, unlocked: null as TreeNode | null, target: null };
  }

  const unlockedTier = target.tier + 1;
  const next: TreeNode = {
    ...target,
    status: "completed",
    completedAt: new Date().toISOString(),
  };

  const nextNode =
    nodes.find(
      (node) =>
        node.pillar === target.pillar &&
        node.tier === unlockedTier &&
        node.status === "locked",
    ) ?? null;

  const updated = nodes.map((node) => {
    if (node.id === id) return next;
    if (nextNode && node.id === nextNode.id) {
      return { ...node, status: "active" as NodeStatus };
    }
    return node;
  });

  return {
    nodes: updated,
    unlocked: nextNode
      ? { ...nextNode, status: "active" as NodeStatus }
      : null,
    target: next,
  };
}

/** Day N of the 30-day season, based on when onboarding was completed. */
export function seasonProgress(seasonStartedAt: string | null) {
  if (!seasonStartedAt) {
    return {
      day: 1,
      total: SEASON_DAYS,
      remaining: SEASON_DAYS,
      complete: false,
    };
  }

  const started = new Date(seasonStartedAt);
  if (Number.isNaN(started.getTime())) {
    return {
      day: 1,
      total: SEASON_DAYS,
      remaining: SEASON_DAYS,
      complete: false,
    };
  }

  const elapsed = Math.floor((Date.now() - started.getTime()) / 86_400_000) + 1;
  const day = Math.max(1, Math.min(SEASON_DAYS, elapsed));
  return {
    day,
    total: SEASON_DAYS,
    remaining: Math.max(0, SEASON_DAYS - elapsed),
    complete: elapsed > SEASON_DAYS,
  };
}

/** Actions completed in the last seven days, including today. */
export function weekSummary(nodes: TreeNode[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const completed = nodes.filter((node) => {
    if (!node.completedAt) return false;
    const at = new Date(node.completedAt);
    return !Number.isNaN(at.getTime()) && at >= start;
  });

  const activeDays = new Set(
    completed.map((node) => todayKey(new Date(node.completedAt as string))),
  ).size;

  return { completed: completed.length, activeDays, days: 7 };
}
