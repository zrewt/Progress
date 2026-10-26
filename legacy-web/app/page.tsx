"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Clock, X } from "lucide-react";
import { AuthScreen } from "@/components/AuthScreen";
import { BotanicalBranch } from "@/components/BotanicalBranch";
import { BrandMark } from "@/components/BrandMark";
import { Celebration } from "@/components/Celebration";
import { LoadingScreen } from "@/components/LoadingScreen";
import { NodeModal } from "@/components/NodeModal";
import { Onboarding } from "@/components/Onboarding";
import { PillarIcon } from "@/components/PillarIcon";
import { SkillTree } from "@/components/SkillTree";
import { TopBar } from "@/components/TopBar";
import { useGame } from "@/lib/game-context";
import {
  PILLAR_MAP,
  ROMAN,
  labelForFriction,
  labelForSpace,
} from "@/lib/pillars";
import {
  completedCount,
  firstActiveNode,
  levelStats,
  pillarProgress,
} from "@/lib/tree";

export default function HomePage() {
  const {
    loading,
    user,
    profile,
    nodes,
    error,
    clearError,
    completeNode,
    mode,
    cloudEnabled,
  } = useGame();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const closeModal = useCallback(() => setSelectedId(null), []);

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  if (!profile) return <Onboarding />;

  const stats = levelStats(profile.xp);
  const focus = firstActiveNode(nodes);
  const focusPillar = focus ? PILLAR_MAP[focus.pillar] : null;
  const mastered = completedCount(nodes);
  const focusBranch = focus
    ? nodes
        .filter((node) => node.pillar === focus.pillar)
        .sort((a, b) => a.tier - b.tier)
    : [];
  const nextInBranch = focus
    ? focusBranch.find((node) => node.tier === focus.tier + 1) ?? null
    : null;
  const firstName = (profile.displayName || user.name || "Athlete").split(" ")[0];
  const bestPillar = Object.values(PILLAR_MAP)
    .map((pillar) => ({
      pillar,
      progress: pillarProgress(nodes, pillar.id),
    }))
    .sort((a, b) => b.progress.done - a.progress.done)[0];

  return (
    <div className="min-h-screen">
      <TopBar />
      <Celebration />

      <main className="page pb-16 pt-10 sm:pt-14">
        {error && (
          <div
            role="alert"
            className="mb-8 flex items-start gap-3 border-l-2 border-clay bg-clay/[0.07] px-4 py-3 text-[12px] leading-5 text-bone"
          >
            <p className="flex-1">{error}</p>
            <button
              type="button"
              onClick={clearError}
              aria-label="Dismiss message"
              className="focus-ring -mr-1 -mt-0.5 p-1 text-sage transition-colors hover:text-bone"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <section className="animate-rise">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-medium text-sage">
                Daily practice <span className="text-sage-deep">·</span> Season I
              </p>
              <h1 className="mt-4 max-w-[720px] text-balance font-display text-[42px] leading-[0.98] tracking-[-0.025em] text-bone sm:text-[56px] lg:text-[62px]">
                Tend the body{" "}
                <span className="italic text-lichen">you live in.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[13.5px] leading-7 text-sage">
                Welcome back, {firstName}. Four branches, one body. One practice
                is enough for today.
              </p>
            </div>

            <div className="hidden pb-1 text-right lg:block">
              <p className="font-display text-[56px] leading-none text-bone">
                {String(mastered).padStart(2, "0")}
              </p>
              <p className="mt-2 text-[11px] text-sage">
                of {nodes.length} practices
              </p>
              <div className="ml-auto mt-3 h-px w-28 bg-bone/15">
                <div
                  className="h-px bg-lichen transition-all duration-700"
                  style={{
                    width: `${nodes.length ? (mastered / nodes.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-sage">
            <span>{labelForFriction(profile.friction)}</span>
            <span className="h-[3px] w-[3px] rounded-full bg-sage-deep" />
            <span>{profile.timeBudget} minutes a day</span>
            <span className="h-[3px] w-[3px] rounded-full bg-sage-deep" />
            <span>{labelForSpace(profile.space)}</span>
          </div>
        </section>

        <section className="mt-10 animate-rise [animation-delay:80ms]">
          <div className="grid border border-bone/10 bg-ink-850/50 lg:grid-cols-[1.6fr_1fr]">
            <article className="relative flex flex-col overflow-hidden p-6 sm:p-8 lg:p-10">
              <BotanicalBranch className="pointer-events-none absolute bottom-16 right-3 hidden h-40 w-auto text-bone/[0.05] lg:block" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium text-copper-light">
                    Today&apos;s practice
                  </p>
                  <p className="mt-1.5 text-[11px] text-sage">
                    {focusPillar ? focusPillar.name : "All branches"} · Tier{" "}
                    {focus ? ROMAN[focus.tier] : "IV"}
                  </p>
                </div>
                {focusPillar && (
                  <span
                    className="hidden font-display text-[22px] italic leading-none sm:block"
                    style={{ color: focusPillar.accent }}
                  >
                    {focusPillar.roman}
                  </span>
                )}
              </div>

              {focus && focusPillar ? (
                <>
                  <div className="mt-7 flex gap-5">
                    <span
                      className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-bone/15 sm:flex"
                      style={{ color: focusPillar.accent }}
                    >
                      <PillarIcon pillar={focus.pillar} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-balance font-display text-[30px] leading-[1.08] text-bone sm:text-[38px]">
                        {focus.title}
                      </h2>
                      <p className="mt-3 max-w-lg text-[14px] leading-6 text-sage">
                        {focus.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] text-sage-dim">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" strokeWidth={1.5} />
                          {focus.duration}
                        </span>
                        <span className="text-sage-deep">·</span>
                        <span className="text-copper-light">+50 XP</span>
                        <span className="text-sage-deep">·</span>
                        <span>Opens Tier {ROMAN[focus.tier + 1] ?? "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(focus.id)}
                      className="btn-primary w-full sm:w-auto"
                    >
                      Begin practice
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <a
                      href="#branches"
                      className="focus-ring flex items-center gap-1.5 py-2 text-[11px] text-sage transition-colors hover:text-bone"
                    >
                      See the branch
                      <ArrowDown className="h-3 w-3" />
                    </a>
                  </div>

                  <p className="mt-8 max-w-md border-t border-bone/10 pt-4 font-display text-[16px] italic leading-6 text-sage">
                    Small, repeated work is what changes a body.
                  </p>

                  <div aria-hidden="true" className="min-h-8 flex-1" />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-bone/10 pt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-sage-deep">
                    <span>
                      Branch{" "}
                      {focusBranch.filter((node) => node.status === "completed").length}
                      /{focusBranch.length} complete
                    </span>
                    <span className="truncate">
                      {nextInBranch ? `Next — ${nextInBranch.title}` : "Capstone"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-7 max-w-lg">
                  <h2 className="font-display text-[34px] leading-tight text-bone">
                    The whole canopy is in leaf.
                  </h2>
                  <p className="mt-3 text-[13px] leading-6 text-sage">
                    Every practice in this season is complete. Revisit a branch
                    above to keep the rhythm, or begin again with a new focus.
                  </p>
                </div>
              )}
            </article>

            <aside className="border-t border-bone/10 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              <p className="text-[11px] font-medium text-sage">The season</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-display text-[54px] leading-none text-bone">
                  {mastered}
                </span>
                <span className="text-[11px] text-sage">
                  / {nodes.length} practices
                </span>
              </div>

              <dl className="mt-7 divide-y divide-bone/10 border-y border-bone/10">
                <div className="flex items-baseline justify-between py-3.5">
                  <dt className="text-[11px] text-sage">Streak</dt>
                  <dd className="font-mono text-[12px] text-bone">
                    {profile.streak} {profile.streak === 1 ? "day" : "days"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between py-3.5">
                  <dt className="text-[11px] text-sage">Level</dt>
                  <dd className="font-mono text-[12px] text-bone">
                    {stats.level}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-3.5">
                  <dt className="text-[11px] text-sage">Strongest</dt>
                  <dd className="truncate font-mono text-[12px] text-bone">
                    {bestPillar && bestPillar.progress.done > 0
                      ? bestPillar.pillar.name
                      : "Not yet"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-sage">
                  <span>
                    {stats.into} / {stats.needed} XP
                  </span>
                  <span>Level {stats.level + 1}</span>
                </div>
                <div className="mt-2 h-px bg-bone/10">
                  <div
                    className="h-px bg-lichen transition-all duration-700"
                    style={{ width: `${Math.max(2, stats.progress * 100)}%` }}
                  />
                </div>
              </div>

              <p className="mt-7 flex items-center gap-2 text-[11px] text-sage">
                <span
                  className={`h-1 w-1 rounded-full ${
                    cloudEnabled && mode === "cloud" ? "bg-lichen" : "bg-copper"
                  }`}
                />
                {cloudEnabled && mode === "cloud"
                  ? "Synced to Supabase"
                  : "Saved on this device"}
              </p>
            </aside>
          </div>
        </section>

        <div className="mt-20 animate-rise [animation-delay:160ms]">
          <SkillTree nodes={nodes} onSelect={(node) => setSelectedId(node.id)} />
        </div>

        <footer className="mt-20 flex flex-col gap-4 border-t border-bone/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-6 w-6 text-sage" />
            <span className="font-display text-[17px] tracking-tight text-bone">
              Vitality Tree
            </span>
          </div>
          <p className="text-[11px] leading-5 text-sage">
            A practice, not a prescription · Season I
          </p>
        </footer>
      </main>

      <NodeModal
        node={selectedNode}
        onClose={closeModal}
        onComplete={completeNode}
      />
    </div>
  );
}
