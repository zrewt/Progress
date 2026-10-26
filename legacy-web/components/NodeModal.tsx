"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Loader2, Lock, X } from "lucide-react";
import { PILLAR_MAP, ROMAN } from "@/lib/pillars";
import type { TreeNode } from "@/lib/types";
import { PillarIcon } from "./PillarIcon";

interface NodeModalProps {
  node: TreeNode | null;
  onClose: () => void;
  onComplete: (id: string) => Promise<void>;
}

export function NodeModal({ node, onClose, onComplete }: NodeModalProps) {
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [node, onClose]);

  if (!node) return null;

  const pillar = PILLAR_MAP[node.pillar];
  const completed = node.status === "completed";
  const locked = node.status === "locked";
  const nextTier = ROMAN[node.tier + 1];

  async function handleComplete() {
    if (!node) return;
    setBusy(true);
    try {
      await onComplete(node.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close practice details"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/85"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-modal-title"
        aria-describedby="node-modal-description"
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full animate-rise flex-col border-t border-bone/15 bg-canvas shadow-2xl shadow-black/50 outline-none sm:max-w-[540px] sm:border sm:rounded-xs"
      >
        <div
          aria-hidden="true"
          className="h-[2px] w-full shrink-0"
          style={{
            background: `linear-gradient(90deg, ${pillar.accent} 0%, ${pillar.accent}55 38%, transparent 100%)`,
          }}
        />

        <div className="overflow-y-auto px-5 pb-7 pt-5 sm:px-8 sm:pt-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <PillarIcon
                pillar={node.pillar}
                className="h-3.5 w-3.5"
                style={{ color: pillar.accent }}
              />
              <p className="text-[10.5px] text-sage">
                {pillar.name} · Tier {ROMAN[node.tier]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="focus-ring -mr-2 -mt-2 flex h-11 w-11 items-center justify-center text-sage transition-colors hover:text-bone"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>

          <h2
            id="node-modal-title"
            className="mt-5 text-balance font-display text-[32px] leading-[1.06] tracking-[-0.02em] text-bone sm:text-[36px]"
          >
            {node.title}
          </h2>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.11em]">
            <span className="flex items-center gap-1.5 text-sage">
              <Clock className="h-3 w-3" strokeWidth={1.5} />
              {node.duration}
            </span>
            <span className="text-sage-deep">·</span>
            <span className={completed ? "text-lichen" : "text-copper-light"}>
              +50 XP
            </span>
            <span className="text-sage-deep">·</span>
            <span
              className={
                completed
                  ? "text-lichen"
                  : locked
                    ? "text-sage-deep"
                    : "text-bone"
              }
            >
              {completed ? "Complete" : locked ? "Locked" : "Ready"}
            </span>
          </div>

          <p id="node-modal-description" className="mt-5 text-[14px] leading-6 text-sage">
            {node.description}
          </p>

          <div className="my-7 h-px bg-bone/10" />

          {completed ? (
            <div className="flex items-start gap-3 border-l-2 border-lichen bg-lichen/[0.05] px-4 py-3.5">
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-lichen"
                strokeWidth={2.5}
              />
              <div>
                <p className="text-[12px] font-medium text-bone">
                  This practice is complete.
                </p>
                <p className="mt-1 text-[12.5px] leading-5 text-sage">
                  Revisit it whenever you like — the XP has already been banked,
                  and the branch ahead is open.
                </p>
              </div>
            </div>
          ) : null}

          <div className={completed ? "mt-7" : ""}>
            <p className="text-[11px] font-medium text-sage">
              {completed ? "The practice, again" : "The practice"}
            </p>
            <ol className="mt-3">
              {node.instructions.map((step, index) => (
                <li
                  key={index}
                  className="grid grid-cols-[28px_1fr] gap-3 border-b border-bone/[0.07] py-3 last:border-b-0"
                >
                  <span className="pt-0.5 font-mono text-[10px] text-copper-light">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[13.5px] leading-6 text-bone-dim">
                    {step}
                  </span>
                </li>
              ))}
              {node.instructions.length === 0 && (
                <li className="py-3 text-[13.5px] leading-6 text-sage">
                  Move slowly, stay within a pain-free range, and breathe.
                </li>
              )}
            </ol>
          </div>

          <p className="mt-6 border-l border-bone/15 pl-4 font-display text-[13px] italic leading-6 text-sage-dim">
            Quality over quantity. Stop at sharp pain, and let your breath set
            the pace.
          </p>
        </div>

        <div className="safe-bottom shrink-0 border-t border-bone/10 bg-canvas px-5 pt-4 sm:px-8 pb-4">
          {completed ? (
            <button type="button" onClick={onClose} className="btn-quiet w-full">
              Back to the tree
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={busy || locked}
                className="btn-primary w-full justify-between"
              >
                <span className="flex items-center gap-2.5">
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  )}
                  {busy ? "Saving practice" : "Mark complete"}
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-ink-900/70">
                  +50 XP
                </span>
              </button>
              <p className="mt-2.5 text-center text-[10px] text-sage">
                {nextTier
                  ? `Opens Tier ${nextTier} of ${pillar.name}`
                  : "Completes the capstone of this branch"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
