import type { DailyPlan, DailySnapshot, PracticeDraft, Rung } from "./daily-types";
import type { GeneratedEasy, GeneratedNode, GeneratedTree, OnboardingAnswers, PillarId, Profile, TreeNode } from "./types";
import { PILLARS } from "./pillars";
import { PROGRESSION } from "./progression";
import { buildPlan, detectTheme, validatePlan, MAX_VARIANT_STEPS, type Budget } from "./plans";
import { rungFor } from "./engine/week";
import type { TreeSource } from "./gemini";

/**
 * The plan is built from the tree's own words, all of them.
 *
 * A generated tree carries four nodes per branch, written for this person's
 * goal. The first node becomes week one of that branch's practice and the other
 * three become weeks two to four, so the practice deepens along the model's own
 * ramp instead of repeating its opening step for a month. The model's two-minute
 * version is taken with it.
 *
 * The curated library is still the safety net: it supplies any branch the tree
 * did not cover, and the whole plan if the result would not survive the server's
 * validation.
 */

function budgetOf(answers: OnboardingAnswers): Budget {
  const value = Number(answers.timeBudget);
  return value === 5 || value === 30 ? value : 15;
}

/** Minutes named on a node, kept inside the chosen budget. */
function nodeMinutes(duration: string, budget: Budget) {
  const found = Number(duration.match(/(\d+)/)?.[1] ?? 0);
  if (!Number.isFinite(found) || found < 1) return budget;
  return Math.min(found, budget);
}

function rungFromNode(node: GeneratedNode, budget: Budget): Rung | null {
  const title = node.title.trim().slice(0, 80);
  const steps = node.instructions
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_VARIANT_STEPS);
  if (!title || steps.length === 0) return null;
  return { title, minutes: nodeMinutes(node.duration, budget), steps };
}

function easyFromTree(easy: GeneratedEasy | undefined, firstStep: string): Rung {
  const steps = (easy?.steps ?? [])
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, 3);
  const title = easy?.title?.trim().slice(0, 80);
  if (title && steps.length > 0) return { title, minutes: 2, steps };
  return {
    title: "The two-minute version",
    minutes: 2,
    steps: [firstStep, "Stop there — a day that small is a complete day."],
  };
}

function practiceFromNodes(
  nodes: GeneratedNode[],
  branch: PillarId,
  role: PracticeDraft["role"],
  budget: Budget,
  easy: GeneratedEasy | undefined,
): PracticeDraft | null {
  const week1 = nodes[0] ? rungFromNode(nodes[0], budget) : null;
  const why = nodes[0]?.description.trim().slice(0, 280) ?? "";
  if (!week1 || !why) return null;
  // Weeks two to four are the model's own next steps for the same practice.
  const ladder = nodes
    .slice(1, 4)
    .map((node) => rungFromNode(node, budget))
    .filter((rung): rung is Rung => Boolean(rung));

  return {
    branch,
    title: week1.title,
    why,
    role,
    cadence: role === "primary" ? "daily" : "weekly",
    cadence_n: 1,
    full_variant: ladder.length ? { ...week1, ladder } : week1,
    easy_variant: easyFromTree(easy, week1.steps[0]),
  };
}

export function dailyPlanFromTree(
  answers: OnboardingAnswers,
  tree: GeneratedTree,
  source: TreeSource,
): DailyPlan {
  const budget = budgetOf(answers);
  const theme = detectTheme(answers.goal);
  const mainBranch = theme.primary.branch;

  // The curated plan is both the base for narrative fields and the fallback.
  const base = buildPlan({
    goal: answers.goal,
    identity: answers.identity,
    blocker: answers.blocker,
    minutes_budget: budget,
    plan_source: source === "edge-ai" ? "ai" : "local",
    plan_summary: tree.summary,
    safety_note: tree.safetyNote,
    theme,
  });

  const labels = { ...base.branch_labels };
  for (const pillar of tree.pillars) {
    if (pillar.focus) labels[pillar.pillar] = pillar.focus.slice(0, 60);
  }

  const practices = PILLARS.map((pillar) => {
    const role: PracticeDraft["role"] = pillar.id === mainBranch ? "primary" : "supporting";
    const entry = tree.pillars.find((item) => item.pillar === pillar.id);
    const built = entry?.nodes?.length
      ? practiceFromNodes(entry.nodes, pillar.id, role, budget, entry.easy)
      : null;
    return built ?? base.practices.find((practice) => practice.branch === pillar.id);
  }).filter((practice): practice is PracticeDraft => Boolean(practice));

  // Roles are assigned by branch so a fallback practice cannot create a second
  // daily obligation or leave the plan without one.
  const normalised = practices.map((practice) => ({
    ...practice,
    role: practice.branch === mainBranch ? ("primary" as const) : ("supporting" as const),
    cadence: practice.branch === mainBranch ? ("daily" as const) : ("weekly" as const),
    cadence_n: 1,
  }));

  const candidate: DailyPlan = { ...base, branch_labels: labels, practices: normalised };
  return validatePlan(candidate).length ? { ...base, branch_labels: labels } : candidate;
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
      // Each tier shows that week's real step, so the tree grows deeper rather
      // than repeating the same opening node four times.
      const rung = rungFor(practice?.full_variant, m.tier);
      return {
        id: practice?.id ?? m.practice_id,
        pillar: m.branch,
        tier: m.tier - 1,
        title: rung.title || practice?.title || m.title,
        duration: `${rung.minutes} min`,
        description: practice?.why ?? "",
        instructions: rung.steps,
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
