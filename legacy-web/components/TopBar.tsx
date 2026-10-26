"use client";

import { LogOut } from "lucide-react";
import { useGame } from "@/lib/game-context";
import { levelStats } from "@/lib/tree";
import { BrandMark } from "./BrandMark";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-sage">
        {label}
      </span>
      <span className="font-mono text-[12px] text-bone">{value}</span>
    </span>
  );
}

export function TopBar() {
  const { profile, signOut } = useGame();
  if (!profile) return null;

  const stats = levelStats(profile.xp);

  return (
    <header className="sticky top-0 z-30 border-b border-bone/10 bg-canvas">
      <div className="page flex h-16 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="h-7 w-7 shrink-0 text-bone" />
          <span className="truncate font-display text-[18px] tracking-tight text-bone">
            Vitality Tree
          </span>
          <span className="hidden border-l border-bone/10 pl-3 text-[11px] text-sage xl:inline">
            Season I
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden items-center gap-5 sm:flex">
            <Stat label="Level" value={`0${stats.level}`.slice(-2)} />
            <span className="h-3 w-px bg-bone/10" />
            <Stat label="Streak" value={`${profile.streak}d`} />
            <span className="h-3 w-px bg-bone/10" />
            <Stat label="XP" value={profile.xp.toLocaleString()} />
          </div>

          <div className="flex items-center gap-2 font-mono text-[10.5px] text-sage sm:hidden">
            <span className="text-bone">Lv {stats.level}</span>
            <span className="text-sage-deep">·</span>
            <span className="text-bone">{profile.streak}d</span>
            <span className="text-sage-deep">·</span>
            <span className="text-bone">{profile.xp} XP</span>
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="focus-ring ml-1 flex min-h-11 items-center gap-2 border-l border-bone/10 pl-3 text-sage transition-colors hover:text-bone"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span className="hidden text-[11px] md:inline">Sign out</span>
          </button>
        </div>
      </div>

      <div className="h-px w-full bg-bone/[0.06]">
        <div
          className="h-px bg-copper/70 transition-all duration-700 ease-out"
          style={{
            width: `${Math.max(1, stats.progress * 100)}%`,
          }}
        />
      </div>
    </header>
  );
}
