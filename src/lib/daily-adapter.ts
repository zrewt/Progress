import type { DailyPlan, DailySnapshot } from "./daily-types";
import type { GeneratedTree, OnboardingAnswers, Profile, TreeNode } from "./types";
import { PROGRESSION } from "./progression";

/** Transitional plan conversion; replaced by the curated library in Stage 2. */
export function dailyPlanFromTree(answers: OnboardingAnswers, tree: GeneratedTree, source: "edge-ai" | "seed-engine"): DailyPlan {
  const primary = answers.identity === "athlete" ? "body" : answers.identity === "scholar" ? "mind" : "craft";
  return { goal: answers.goal, identity: answers.identity, blocker: answers.blocker, minutes_budget: Number(answers.timeBudget) as 5 | 15 | 30, plan_version: 1, plan_source: source === "edge-ai" ? "ai" : "local", plan_summary: tree.summary, safety_note: tree.safetyNote,
    branch_labels: Object.fromEntries(tree.pillars.map((p) => [p.pillar, p.focus ?? p.pillar])) as DailyPlan["branch_labels"],
    practices: tree.pillars.map((p) => { const node = p.nodes[0]; return { branch: p.pillar, title: node.title, why: node.description, role: p.pillar === primary ? "primary" : "supporting", cadence: p.pillar === primary ? "daily" : "weekly", cadence_n: 1,
      full_variant: { title: node.title, minutes: Math.min(Number(answers.timeBudget), Number(node.duration.match(/\d+/)?.[0] ?? 2)), steps: node.instructions },
      easy_variant: { title: "A gentle start", minutes: 2, steps: ["Prepare your space and the tool you need.", "Try one small part for two minutes, then stop."] } }; }) };
}
export function presentation(snapshot: DailySnapshot): { profile: Profile | null; nodes: TreeNode[] } {
  const season = snapshot.seasons.find((s) => s.status === "active") ?? snapshot.seasons[0];
  const progress = snapshot.progress;
  if (!season || !progress) return { profile: null, nodes: [] };
  const practices = snapshot.practices.filter((p) => p.season_id === season.id && p.active);
  const nodes: TreeNode[] = snapshot.milestones.filter((m) => m.season_id === season.id).map((m) => {
    const p = practices.find((p) => p.id === m.practice_id);
    const done = progress.unlocked_milestones.includes(m.id);
    return { id: p?.id ?? m.practice_id, pillar: m.branch, tier: m.tier - 1, title: p?.title ?? m.title, duration: `${p?.full_variant.minutes ?? 2} min`, description: p?.why ?? "", instructions: p?.full_variant.steps ?? [], status: done ? "completed" : "active" };
  });
  return { profile: { displayName: snapshot.profile?.display_name ?? "", identity: season.identity, goal: season.goal, blocker: season.blocker, timeBudget: String(season.minutes_budget), xp: progress.xp, level: progress.level, streak: progress.current_streak, lastCompletedDate: null, seasonStartedAt: `${season.started_on}T12:00:00Z` }, nodes };
}
export const DAILY_XP = PROGRESSION.xpPerCompletion;
