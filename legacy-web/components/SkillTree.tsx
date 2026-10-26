"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Lock, Play } from "lucide-react";
import { PILLARS, ROMAN } from "@/lib/pillars";
import { firstActiveNode, pillarProgress } from "@/lib/tree";
import type { NodeStatus, PillarId, TreeNode } from "@/lib/types";
import { BrandMark } from "./BrandMark";
import { PillarIcon } from "./PillarIcon";

const VIEW_W = 1000;
const VIEW_H = 640;
const ROOT_Y = 612;

const LANES = [
  { x: 148, ys: [520, 404, 296, 184], offsets: [0, -24, 17, -11] },
  { x: 388, ys: [476, 372, 260, 164], offsets: [13, -11, 20, 0] },
  { x: 612, ys: [492, 368, 280, 156], offsets: [-13, 11, -20, 0] },
  { x: 852, ys: [508, 396, 288, 176], offsets: [0, 24, -17, 11] },
];

const STATUS_LABEL: Record<NodeStatus, string> = {
  locked: "Locked",
  active: "Ready",
  completed: "Complete",
};

const STROKE = {
  completed: "rgba(198,203,156,0.92)",
  active: "rgba(217,154,104,0.88)",
  locked: "rgba(233,226,208,0.3)",
} as const;

function NodeGlyph({ status }: { status: NodeStatus }) {
  if (status === "completed") {
    return <Check className="h-5 w-5" strokeWidth={2.25} />;
  }
  if (status === "active") {
    return <Play className="h-4 w-4 translate-x-px fill-current" />;
  }
  return <Lock className="h-3.5 w-3.5" strokeWidth={1.6} />;
}

interface TreeProps {
  nodes: TreeNode[];
  onSelect: (node: TreeNode) => void;
}

export function SkillTree({ nodes, onSelect }: TreeProps) {
  const [selectedPillar, setSelectedPillar] = useState<PillarId>(
    () => firstActiveNode(nodes)?.pillar ?? PILLARS[0].id,
  );

  const branches = useMemo(
    () =>
      PILLARS.map((pillar) => ({
        pillar,
        nodes: nodes
          .filter((node) => node.pillar === pillar.id)
          .sort((a, b) => a.tier - b.tier),
      })),
    [nodes],
  );

  const mobileBranch =
    branches.find((branch) => branch.pillar.id === selectedPillar) ??
    branches[0];
  const completed = nodes.filter((node) => node.status === "completed").length;

  return (
    <section id="branches" aria-labelledby="skill-tree-heading" className="scroll-mt-24">
      <div className="flex flex-col gap-4 border-b border-bone/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-sage">The progression</p>
          <h2
            id="skill-tree-heading"
            className="mt-2 font-display text-[32px] leading-tight text-bone sm:text-[38px]"
          >
            The four branches
          </h2>
          <p className="mt-2 max-w-md text-[13.5px] leading-6 text-sage">
            Each branch opens one practice at a time. Complete a node to grow the
            next.
          </p>
        </div>
        <p className="flex items-baseline gap-2 sm:justify-end">
          <span className="font-display text-[30px] leading-none text-bone">
            {completed}
          </span>
          <span className="text-[11px] text-sage">
            / {nodes.length} complete
          </span>
        </p>
      </div>

      {/* Desktop: an actual branching tree */}
      <div className="hidden md:block">
        <div className="relative mx-auto h-[78px] max-w-5xl">
          {branches.map(({ pillar, nodes: branchNodes }, lane) => {
            const progress = pillarProgress(branchNodes, pillar.id);
            return (
              <div
                key={pillar.id}
                className="absolute top-0 w-[172px] -translate-x-1/2 text-center"
                style={{ left: `${(LANES[lane].x / VIEW_W) * 100}%` }}
              >
                <p
                  className="font-display text-[17px] italic leading-none"
                  style={{ color: pillar.accent }}
                >
                  {pillar.roman}
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-bone">
                  {pillar.name}
                </p>
                <p className="mt-1 text-[10.5px] text-sage-dim">
                  {progress.done}/{progress.total} · {pillar.subtitle}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative mx-auto h-[600px] w-full max-w-5xl">
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <g fill="none" strokeLinecap="round">
              <path
                d="M500 616C492 556 506 496 499 436C493 382 505 328 500 268"
                stroke="rgba(233,226,208,0.32)"
                strokeWidth="1.4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M508 616C500 556 514 496 507 436C501 382 513 328 508 268"
                stroke="rgba(233,226,208,0.1)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M500 616C487 622 475 626 463 632"
                stroke="rgba(233,226,208,0.12)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M500 616C513 622 525 626 537 632"
                stroke="rgba(233,226,208,0.12)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />

              {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                const coords = LANES[lane].ys.map((y, tier) => ({
                  x: LANES[lane].x + LANES[lane].offsets[tier],
                  y,
                }));
                const first = branchNodes[0];
                const state =
                  first?.status === "completed"
                    ? "completed"
                    : first?.status === "active"
                      ? "active"
                      : "locked";
                const target = coords[0];
                const path = `M500 ${ROOT_Y}C500 ${ROOT_Y - 28}, 500 556, 500 556C500 548, ${
                  target.x
                } ${target.y + 50}, ${target.x} ${target.y + 28}`;
                return (
                  <g key={pillar.id}>
                    {state !== "locked" && (
                      <path
                        d={path}
                        stroke={STROKE[state]}
                        strokeOpacity="0.18"
                        strokeWidth="6.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                    <path
                      d={path}
                      stroke={STROKE[state]}
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}

              {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                const coords = LANES[lane].ys.map((y, tier) => ({
                  x: LANES[lane].x + LANES[lane].offsets[tier],
                  y,
                }));
                return coords.slice(0, 3).map((point, tier) => {
                  const above = coords[tier + 1];
                  const lower = branchNodes[tier];
                  const upper = branchNodes[tier + 1];
                  const state =
                    lower?.status === "completed"
                      ? "completed"
                      : upper?.status === "active"
                        ? "active"
                        : "locked";
                  const path = `M${point.x} ${point.y - 30}C${point.x} ${
                    point.y - 64
                  }, ${above.x} ${above.y + 64}, ${above.x} ${above.y + 30}`;
                  return (
                    <g key={`${pillar.id}-${tier}`}>
                      {state !== "locked" && (
                        <path
                          d={path}
                          stroke={STROKE[state]}
                          strokeOpacity="0.11"
                          strokeWidth="6.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <path
                        d={path}
                        stroke={STROKE[state]}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  );
                });
              })}

              {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                const tip = LANES[lane];
                const x = tip.x + tip.offsets[3];
                const y = tip.ys[3] - 46;
                const done = branchNodes[3]?.status === "completed";
                return (
                  <g
                    key={`leaf-${pillar.id}`}
                    stroke={pillar.accent}
                    strokeWidth="1"
                    strokeOpacity={done ? "0.7" : "0.32"}
                    fill={pillar.accent}
                    fillOpacity={done ? "0.13" : "0.05"}
                  >
                    <path
                      d={`M${x} ${y}C${x - 9} ${y - 8}, ${x - 10} ${
                        y - 24
                      }, ${x} ${y - 34}C${x + 10} ${y - 24}, ${x + 9} ${
                        y - 8
                      }, ${x} ${y}Z`}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      d={`M${x + 2} ${y + 8}C${x + 13} ${y + 3}, ${x + 20} ${
                        y - 8
                      }, ${x + 15} ${y - 18}C${x + 6} ${y - 12}, ${x + 1} ${
                        y - 2
                      }, ${x + 2} ${y + 8}Z`}
                      vectorEffect="non-scaling-stroke"
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          <div
            className="absolute left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-bone/20 bg-canvas text-sage"
            style={{ top: `${(ROOT_Y / VIEW_H) * 100}%` }}
            aria-hidden="true"
          >
            <BrandMark className="h-6 w-6" />
          </div>

          {branches.map(({ pillar, nodes: branchNodes }, lane) =>
            branchNodes.map((node) => {
              const locked = node.status === "locked";
              const completedNode = node.status === "completed";
              const active = node.status === "active";
              const x = LANES[lane].x + LANES[lane].offsets[node.tier];
              const y = LANES[lane].ys[node.tier];

              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(node)}
                  aria-label={`${pillar.name}, tier ${node.tier + 1}: ${node.title} (${STATUS_LABEL[node.status]})`}
                  title={
                    locked
                      ? "Complete the previous tier to open this node"
                      : `${node.title} · ${node.duration}`
                  }
                  className="focus-ring group absolute z-10 h-14 w-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full disabled:cursor-not-allowed"
                  style={{
                    left: `${(x / VIEW_W) * 100}%`,
                    top: `${(y / VIEW_H) * 100}%`,
                  }}
                >
                  <span
                    className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-200 ${
                      completedNode
                        ? "border-lichen bg-lichen text-ink-950"
                        : active
                          ? "border-bone bg-bone text-ink-950 group-hover:scale-[1.04]"
                          : "border-bone/15 bg-transparent text-sage-dim"
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute -inset-[6px] animate-breathe rounded-full border border-copper/55"
                      />
                    )}
                    <NodeGlyph status={node.status} />
                  </span>

                  <span className="pointer-events-none absolute left-1/2 top-full mt-2.5 w-[160px] -translate-x-1/2 text-center">
                    <span
                      className={`block text-[12.5px] font-medium leading-snug ${
                        locked
                          ? "text-sage-dim"
                          : completedNode
                            ? "text-bone"
                            : "text-bone"
                      }`}
                    >
                      {node.title}
                    </span>
                    <span
                      className={`mt-1 block font-mono text-[10px] uppercase tracking-[0.12em] ${
                        active
                          ? "text-copper-light"
                          : completedNode
                            ? "text-lichen-dim"
                            : "text-sage-deep"
                      }`}
                    >
                      {active
                        ? `Begin · ${node.duration}`
                        : completedNode
                          ? "Complete"
                          : node.duration}
                    </span>
                  </span>
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* Mobile: one branch, read as a vertical cutting */}
      <div className="md:hidden">
        <div
          className="mt-5 grid grid-cols-4 border-y border-bone/10"
          role="group"
          aria-label="Skill tree branches"
        >
          {PILLARS.map((pillar) => {
            const selected = pillar.id === mobileBranch.pillar.id;
            const progress = pillarProgress(nodes, pillar.id);
            return (
              <button
                key={pillar.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedPillar(pillar.id)}
                className={`focus-ring relative flex flex-col items-center gap-1 px-1 py-3 transition-colors ${
                  selected ? "text-bone" : "text-sage hover:text-bone-dim"
                }`}
              >
                <span
                  className="font-display text-[13px] italic"
                  style={{ color: selected ? pillar.accent : undefined }}
                >
                  {pillar.roman}
                </span>
                <span className="text-[11px] font-medium leading-none">
                  {pillar.name}
                </span>
                <span className="font-mono text-[10px] leading-none text-sage-dim">
                  {progress.done}/{progress.total}
                </span>
                {selected && (
                  <span className="absolute inset-x-0 bottom-0 h-px bg-copper" />
                )}
              </button>
            );
          })}
        </div>

        <div
          id="branch-panel"
          role="region"
          aria-label={`${mobileBranch.pillar.name} branch`}
          className="mt-6 border border-bone/10"
        >
          <div className="flex items-start justify-between gap-4 border-b border-bone/10 px-4 py-4">
            <div>
              <p
                className="font-display text-[14px] italic"
                style={{ color: mobileBranch.pillar.accent }}
              >
                Branch {mobileBranch.pillar.roman}
              </p>
              <p className="mt-1 font-display text-[26px] leading-none text-bone">
                {mobileBranch.pillar.name}
              </p>
              <p className="mt-1.5 text-[10.5px] text-sage-dim">
                {mobileBranch.pillar.subtitle}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-bone/15 text-sage">
              <PillarIcon pillar={mobileBranch.pillar.id} className="h-4 w-4" />
            </div>
          </div>

          <div>
            {mobileBranch.nodes.map((node, index) => {
              const locked = node.status === "locked";
              const completedNode = node.status === "completed";
              const active = node.status === "active";
              const isLast = index === mobileBranch.nodes.length - 1;

              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onSelect(node)}
                  aria-label={`Tier ${node.tier + 1}: ${node.title} (${STATUS_LABEL[node.status]})`}
                  className={`focus-ring group relative flex w-full items-stretch gap-4 border-b border-bone/[0.08] px-4 py-4 text-left transition-colors last:border-b-0 disabled:cursor-not-allowed ${
                    active
                      ? "bg-bone/[0.035]"
                      : completedNode
                        ? "bg-lichen/[0.025] hover:bg-lichen/[0.045]"
                        : "hover:bg-bone/[0.02]"
                  }`}
                >
                  {active && (
                    <span className="absolute bottom-3 left-0 top-3 w-px bg-copper" />
                  )}

                  <span className="relative flex w-10 shrink-0 justify-center self-stretch">
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-10 -bottom-4 left-1/2 w-px -translate-x-1/2 ${
                          completedNode ? "bg-lichen/30" : "bg-bone/10"
                        }`}
                      />
                    )}
                    <span
                      className={`relative z-10 mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border ${
                        completedNode
                          ? "border-lichen bg-lichen text-ink-950"
                          : active
                            ? "border-bone bg-bone text-ink-950"
                            : "border-bone/15 bg-canvas text-sage-dim"
                      }`}
                    >
                      <NodeGlyph status={node.status} />
                    </span>
                  </span>

                  <span className="min-w-0 flex-1 pb-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="micro-dim">Tier {ROMAN[node.tier]}</span>
                      <span
                        className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                          active
                            ? "text-copper-light"
                            : completedNode
                              ? "text-lichen-dim"
                              : "text-sage-deep"
                        }`}
                      >
                        {STATUS_LABEL[node.status]}
                      </span>
                    </span>
                    <span
                      className={`mt-1.5 block text-[14px] font-medium leading-snug ${
                        locked ? "text-sage-dim" : "text-bone"
                      }`}
                    >
                      {node.title}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2 text-[12px] text-sage">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      {node.duration}
                      {active && (
                        <span className="text-copper-light">· Begin</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-bone/10 pt-4">
        <span className="flex items-center gap-2 text-[10.5px] text-sage">
          <span className="h-2 w-2 rounded-full border border-bone/40" />
          Locked
        </span>
        <span className="flex items-center gap-2 text-[10.5px] text-sage">
          <span className="h-2 w-2 rounded-full border border-copper/60 bg-copper/20" />
          Ready
        </span>
        <span className="flex items-center gap-2 text-[10.5px] text-sage">
          <span className="h-2 w-2 rounded-full bg-lichen" />
          Complete
        </span>
        <span className="ml-auto hidden text-[10.5px] text-sage-dim sm:block">
          One node opens the next
        </span>
      </div>
    </section>
  );
}
