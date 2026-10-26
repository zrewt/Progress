"use client";

import { useEffect, type CSSProperties } from "react";
import { Check, X } from "lucide-react";
import { useGame } from "@/lib/game-context";

const LEAF_COLORS = ["#C6CB9C", "#D99A68", "#B3A3B8", "#92A89B"];

export function Celebration() {
  const { celebration, dismissCelebration } = useGame();

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(dismissCelebration, 4400);
    return () => window.clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;

  const leaves = Array.from({ length: 16 }, (_, index) => ({
    left: (index * 47 + 9) % 100,
    drift: ((index % 6) - 2.5) * 30,
    delay: (index % 7) * 0.09,
    duration: 2.1 + ((index * 11) % 6) * 0.16,
    size: 5 + (index % 3) * 2,
    color: LEAF_COLORS[index % LEAF_COLORS.length],
  }));

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
      >
        {leaves.map((leaf, index) => (
          <span
            key={`${celebration.id}-${index}`}
            className="absolute top-[18%] animate-leaf-fall"
            style={
              {
                left: `${leaf.left}%`,
                width: leaf.size,
                height: leaf.size * 1.6,
                backgroundColor: leaf.color,
                borderRadius: "100% 0 100% 0",
                animationDelay: `${leaf.delay}s`,
                animationDuration: `${leaf.duration}s`,
                "--drift": `${leaf.drift}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-4 bottom-4 z-[60] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[368px]"
      >
        <div className="animate-toast relative flex items-start gap-3.5 border border-lichen/25 bg-ink-850 p-4 shadow-2xl shadow-black/50">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lichen text-ink-950">
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-medium text-sage">Practice complete</p>
            <p className="mt-1 truncate font-display text-[20px] leading-tight text-bone">
              {celebration.title}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10.5px]">
              <span className="text-copper-light">+{celebration.xp} XP</span>
              <span className="text-sage-deep">·</span>
              <span className="truncate text-sage">
                {celebration.unlocked
                  ? celebration.nextTitle
                    ? `Next — ${celebration.nextTitle}`
                    : "Next node open"
                  : "Branch complete"}
              </span>
            </div>

            {celebration.levelUp && (
              <p className="mt-2 inline-flex items-center gap-2 border-t border-bone/10 pt-2 font-mono text-[10px] uppercase tracking-[0.11em] text-lichen">
                <span className="h-1 w-1 rounded-full bg-lichen" />
                Level {celebration.levelUp} reached
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={dismissCelebration}
            aria-label="Dismiss completion note"
            className="focus-ring -mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center text-sage-dim transition-colors hover:text-bone"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </>
  );
}
