import type { DailyPlan, DailySnapshot, PracticeDraft, Rung } from "./daily-types";
import type { GeneratedEasy, GeneratedNode, GeneratedTree, OnboardingAnswers, PillarId, Profile, TreeNode } from "./types";
import { classifyGoal } from "./safety-rules";
import { PILLARS } from "./pillars";
import { PROGRESSION } from "./progression";
import { BUDGETS, buildPlan, detectTheme, validatePlan, validatePractice, MAX_VARIANT_STEPS, type Budget } from "./plans";
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
  return (BUDGETS as readonly number[]).includes(value) ? (value as Budget) : 15;
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
    easy_variant: { ...easyFromTree(nodes[0]?.easy ?? easy, week1.steps[0]), ...(nodes[1]?.easy ? { ladder: [easyFromTree(nodes[1].easy, nodes[1].instructions[0])] } : {}) },
  };
}

export function dailyPlanFromTree(
  answers: OnboardingAnswers,
  tree: GeneratedTree,
  source: TreeSource,
): DailyPlan {
  const budget = budgetOf(answers);
  const theme = detectTheme(answers.goal);
  const mainBranch = source === "edge-ai" && tree.primaryBranch && tree.pillars.some((p) => p.pillar === tree.primaryBranch && p.nodes.length > 0)
    ? tree.primaryBranch : theme.primary.branch;

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

  // Branches that really came from the draft, recorded before any repair, so a
  // repaired plan cannot be labelled as drafted just because a library practice
  // filled the same branch.
  const drafted = new Set<PillarId>();
  const practices = PILLARS.map((pillar) => {
    const role: PracticeDraft["role"] = pillar.id === mainBranch ? "primary" : "supporting";
    const entry = tree.pillars.find((item) => item.pillar === pillar.id);
    const built = entry?.nodes?.length
      ? practiceFromNodes(entry.nodes, pillar.id, role, budget, entry.easy)
      : null;
    if (built && !entry?.localRepair) drafted.add(pillar.id);
    const fallback = base.practices.find((practice) => practice.branch === pillar.id);
    return built ?? (fallback ? { ...fallback, role, cadence: role === "primary" ? "daily" : "weekly" } : undefined);
  }).filter((practice): practice is PracticeDraft => Boolean(practice));

  // Roles are assigned by branch so a fallback practice cannot create a second
  // daily obligation or leave the plan without one.
  const normalised = practices.map((practice) => ({
    ...practice,
    role: practice.branch === mainBranch ? ("primary" as const) : ("supporting" as const),
    cadence: practice.branch === mainBranch ? ("daily" as const) : ("weekly" as const),
    cadence_n: 1,
  }));

  // Repair one branch rather than discarding all four. Before this, a single
  // step that named more minutes than the budget replaced the whole drafted plan
  // with the shared library — which is how a model plan silently became a
  // template, still labelled as drafted, with nothing on screen saying so.
  const repaired = normalised.map((practice) =>
    validatePractice(practice, budget).length
      ? { ...(base.practices.find((item) => item.branch === practice.branch) ?? practice), role: practice.role, cadence: practice.cadence }
      : practice,
  );
  const fromDraft = repaired.filter(
    (practice, index) => drafted.has(practice.branch) && practice === normalised[index],
  ).length;
  // A partly repaired branch can still contain AI text alongside its local text.
  const partiallyDrafted = repaired.some((practice, index) =>
    practice === normalised[index] && tree.pillars.some((entry) => entry.pillar === practice.branch && entry.localRepair && entry.hasAiContent),
  );
  const containsLocalRepair = repaired.some((practice, index) =>
    practice !== normalised[index] || !drafted.has(practice.branch),
  );
  const containsAi = fromDraft > 0 || partiallyDrafted;

  const candidate: DailyPlan = {
    ...base,
    // Where the plan came from is the source of the tree, not how much of it
    // survived: an on-device tree is local even when all four branches are used.
    plan_source: source !== "edge-ai" || !containsAi ? "local" : containsLocalRepair ? "mixed" : "ai",
    conservative_mode: !!answers.conservativeMode || classifyGoal(answers.goal) === "high-risk",
    goal_category: classifyGoal(answers.goal),
    personalization_context: answers.context ?? [],
    target_date: answers.targetDate ?? null,
    season_length_days: answers.daysRemaining ?? null,
    stages: tree.stages,
    reality_check: tree.realityCheck,
    branch_labels: labels,
    practices: repaired,
  };
  const problems = validatePlan(candidate);
  if (problems.length) {
    // Visible in the Metro logs, so "the plan looks like a template" can be told
    // apart from "the draft was thrown away" without guessing.
    console.warn("[plan] the drafted plan could not be saved as written:", problems);
    return { ...base, conservative_mode: !!answers.conservativeMode || classifyGoal(answers.goal) === "high-risk", goal_category: classifyGoal(answers.goal), plan_source: "local", personalization_context: answers.context ?? [], target_date: answers.targetDate ?? null, season_length_days: answers.daysRemaining ?? null, stages: tree.stages, reality_check: tree.realityCheck, branch_labels: labels };
  }
  if (fromDraft < repaired.length) {
    console.warn(`[plan] ${repaired.length - fromDraft} branch(es) fell back to the curated library`);
  }
  return candidate;
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
    conservative_mode: season.conservative_mode,
    goal_category: season.goal_category,
    goal: season.goal,
    identity: season.identity,
    blocker: season.blocker,
    minutes_budget: season.minutes_budget,
    plan_version: season.plan_version,
    plan_source: season.plan_source_verified ? season.plan_source : "unknown",
    personalization_context: season.personalization_context ?? [],
    target_date: season.target_date ?? null,
    season_length_days: season.season_length_days ?? null,
    stages: season.stages,
    reality_check: season.reality_check,
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
