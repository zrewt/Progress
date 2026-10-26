import type { DailyPlan, DailySnapshot } from "./daily-types";
import type { GeneratedTree, OnboardingAnswers, PillarId, Profile, TreeNode } from "./types";
import { PROGRESSION } from "./progression";
import { buildPlan, detectTheme } from "./plans";
import type { TreeSource } from "./gemini";

/**
 * A generated tree may supply the narrative, but the daily plan always comes from
 * the curated library so every practice has a bounded full and easy version.
 */
export function dailyPlanFromTree(answers: OnboardingAnswers, tree: GeneratedTree, source: TreeSource): DailyPlan {
  const budget = Number(answers.timeBudget);
  const base = buildPlan({
    goal: answers.goal,
    identity: answers.identity,
    blocker: answers.blocker,
    minutes_budget: budget === 5 || budget === 30 ? budget : 15,
    plan_source: source === "edge-ai" ? "ai" : "local",
    plan_summary: tree.summary,
    safety_note: tree.safetyNote,
    theme: detectTheme(answers.goal),
  });
  const labels = { ...base.branch_labels };
  for (const pillar of tree.pillars) {
    if (pillar.focus) labels[pillar.pillar] = pillar.focus.slice(0, 60);
  }
  return { ...base, branch_labels: labels };
}

export function presentation(snapshot: DailySnapshot): { profile: Profile | null; nodes: TreeNode[] } {
  const season = snapshot.seasons.find((s) => s.status === "active") ?? snapshot.seasons[0];
  const progress = snapshot.progress;
  if (!season || !progress) return { profile: null, nodes: [] };
  const practices = snapshot.practices.filter((p) => p.season_id === season.id && p.active);
  const nodes: TreeNode[] = snapshot.milestones
    .filter((m) => m.season_id === season.id && practices.some((p) => p.id === m.practice_id))
    .map((m) => {
      const practice = practices.find((p) => p.id === m.practice_id);
      const unlocked = progress.unlocked_milestones.includes(m.id);
      const branchLabel = (season.branch_labels as Record<PillarId, string> | null)?.[m.branch];
      return {
        id: practice?.id ?? m.practice_id,
        pillar: m.branch,
        tier: m.tier - 1,
        title: practice?.title ?? m.title,
        duration: `${practice?.full_variant.minutes ?? 2} min`,
        description: practice?.why ?? "",
        instructions: practice?.full_variant.steps ?? [],
        status: unlocked ? "completed" : "active",
        completedAt: unlocked ? m.unlocked_at : null,
        branchLabel,
      };
    });
  return {
    profile: {
      displayName: snapshot.profile?.display_name ?? "",
      identity: season.identity,
      goal: season.goal,
      blocker: season.blocker,
      timeBudget: String(season.minutes_budget),
      xp: progress.xp,
      level: progress.level,
      streak: progress.current_streak,
      lastCompletedDate: null,
      seasonStartedAt: `${season.started_on}T12:00:00Z`,
    },
    nodes,
  };
}

/** Rebuild the plan a season is running, for editing or continuing it. */
export function planFromSeason(snapshot: DailySnapshot, seasonId: string): DailyPlan | null {
  const season = snapshot.seasons.find((item) => item.id === seasonId);
  if (!season) return null;
  const practices = snapshot.practices.filter((practice) => practice.season_id === seasonId && practice.active);
  if (!practices.length) return null;
  return {
    goal: season.goal,
    identity: season.identity,
    blocker: season.blocker,
    minutes_budget: season.minutes_budget,
    plan_version: season.plan_version,
    plan_source: season.plan_source,
    plan_summary: season.plan_summary,
    safety_note: season.safety_note,
    branch_labels: season.branch_labels,
    practices: practices
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((practice) => ({
        branch: practice.branch,
        title: practice.title,
        why: practice.why,
        role: practice.role,
        cadence: practice.cadence,
        cadence_n: practice.cadence_n,
        full_variant: practice.full_variant,
        easy_variant: practice.easy_variant,
      })),
  };
}

export const DAILY_XP = PROGRESSION.xpPerCompletion;
