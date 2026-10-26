"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Armchair,
  BatteryLow,
  Building2,
  Check,
  Clock3,
  Feather,
  Footprints,
  Hourglass,
  House,
  Loader2,
  PersonStanding,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useGame } from "@/lib/game-context";
import {
  FRICTION_OPTIONS,
  SPACE_OPTIONS,
  TIME_OPTIONS,
  type ChoiceIcon,
} from "@/lib/pillars";
import type { OnboardingAnswers } from "@/lib/types";
import { BotanicalBranch } from "./BotanicalBranch";
import { BrandMark } from "./BrandMark";

const STEPS = [
  {
    key: "01",
    label: "The friction",
    question: "What is your main daily friction?",
    helper:
      "Your first season will lean toward this. You can reshape the tree later.",
  },
  {
    key: "02",
    label: "The time",
    question: "How much time can you give each day?",
    helper:
      "A practice you can repeat beats a plan you cannot keep. Choose honestly.",
  },
  {
    key: "03",
    label: "The space",
    question: "What space do you have available?",
    helper: "We will only prescribe work you can do where you already are.",
  },
] as const;

const GENERATING_MESSAGES = [
  "Balancing four branches around your day",
  "Writing sixteen small practices",
  "Weighting the tree toward your friction",
  "Setting your first node in place",
];

const CHOICE_ICONS: Record<ChoiceIcon, LucideIcon> = {
  armchair: Armchair,
  battery: BatteryLow,
  posture: PersonStanding,
  feather: Feather,
  timer: Timer,
  clock: Clock3,
  hourglass: Hourglass,
  bodyweight: Footprints,
  home: House,
  gym: Building2,
};

function ChoiceRow({
  icon,
  label,
  sub,
  selected,
  name,
  onSelect,
}: {
  icon: ChoiceIcon;
  label: string;
  sub: string;
  selected: boolean;
  name: string;
  onSelect: () => void;
}) {
  const Icon = CHOICE_ICONS[icon];
  return (
    <label className="group relative block cursor-pointer">
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={`relative flex min-h-[72px] items-center gap-4 border-b border-bone/10 px-1 py-4 transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-copper ${
          selected
            ? "bg-bone/[0.035]"
            : "hover:bg-bone/[0.02]"
        }`}
      >
        {selected && (
          <span className="absolute bottom-3 left-0 top-3 w-px bg-copper" />
        )}
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
            selected
              ? "border-copper/60 text-copper-light"
              : "border-bone/15 text-sage group-hover:border-bone/30"
          }`}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={1.4} />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[14px] font-medium ${
              selected ? "text-bone" : "text-bone-dim"
            }`}
          >
            {label}
          </span>
          <span className="mt-1 block text-[12.5px] leading-5 text-sage">
            {sub}
          </span>
        </span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
            selected
              ? "border-copper bg-copper text-ink-950"
              : "border-bone/25 text-transparent"
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </span>
    </label>
  );
}

export function Onboarding() {
  const { user, submitOnboarding, authBusy, signOut, error } = useGame();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({});
  const [generating, setGenerating] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(
      () => setMessageIndex((index) => (index + 1) % GENERATING_MESSAGES.length),
      1500,
    );
    return () => window.clearInterval(timer);
  }, [generating]);

  const current = STEPS[step];
  const selection =
    step === 0
      ? answers.friction
      : step === 1
        ? answers.timeBudget
        : answers.space;
  const canContinue = Boolean(selection);

  async function handleContinue() {
    if (!canContinue) return;
    if (step < 2) {
      setStep((value) => value + 1);
      return;
    }
    setGenerating(true);
    setMessageIndex(0);
    try {
      await submitOnboarding({
        friction: answers.friction ?? "",
        timeBudget: answers.timeBudget ?? "15",
        space: answers.space ?? "bodyweight",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-bone/10">
        <div className="page flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark className="h-7 w-7 text-bone" />
            <span className="font-display text-[18px] tracking-tight text-bone">
              Vitality Tree
            </span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="focus-ring flex min-h-11 items-center gap-2 text-[11px] text-sage transition-colors hover:text-bone"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="page grid flex-1 gap-14 py-10 sm:py-14 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-20 lg:py-16">
        <aside className="hidden lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-[11px] font-medium text-sage">Your first season</p>
            <ol className="mt-7 space-y-6">
              {STEPS.map((item, index) => {
                const state =
                  index === step ? "current" : index < step ? "done" : "next";
                return (
                  <li key={item.key} className="flex items-start gap-4">
                    <span
                      className={`mt-0.5 font-mono text-[10px] tracking-[0.1em] ${
                        state === "current"
                          ? "text-copper-light"
                          : state === "done"
                            ? "text-lichen"
                            : "text-sage-deep"
                      }`}
                    >
                      {state === "done" ? "✓" : item.key}
                    </span>
                    <span
                      className={`text-[12.5px] leading-5 ${
                        state === "current"
                          ? "text-bone"
                          : state === "done"
                            ? "text-sage"
                            : "text-sage-deep"
                      }`}
                    >
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="relative mt-20 hidden max-w-[190px] lg:block">
              <BotanicalBranch className="h-[280px] w-auto text-bone/[0.28]" />
              <p className="mt-5 border-t border-bone/10 pt-4 font-display text-[19px] italic leading-7 text-sage">
                “A good plan is one you can repeat.”
              </p>
            </div>
          </div>

          <p className="mt-10 text-[11px] leading-5 text-sage">
            {user?.name ? `For ${user.name}` : "A practice, not a prescription"}
          </p>
        </aside>

        <section className="mx-auto w-full max-w-[620px]">
          <div className="flex items-end justify-between">
            <p className="micro text-sage">
              {current.key} <span className="text-sage-deep">/ 03</span>
            </p>
            <p className="text-[11px] text-sage">
              {current.label}
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={1}
            aria-valuemax={3}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of 3`}
            className="mt-3 h-px w-full bg-bone/10"
          >
            <div
              className="h-px bg-copper transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
          </div>

          <div key={step} className="animate-rise">
            <h1 className="mt-8 max-w-[560px] text-balance font-display text-[34px] leading-[1.06] tracking-[-0.02em] text-bone sm:text-[42px]">
              {current.question}
            </h1>
            <p className="mt-4 max-w-[470px] text-[14px] leading-6 text-sage">
              {current.helper}
            </p>

            <fieldset className="mt-8">
              <legend className="sr-only">{current.question}</legend>
              {step === 0 &&
                FRICTION_OPTIONS.map((option) => (
                  <ChoiceRow
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    sub={option.hint}
                    name="friction"
                    selected={answers.friction === option.value}
                    onSelect={() =>
                      setAnswers((value) => ({ ...value, friction: option.value }))
                    }
                  />
                ))}
              {step === 1 &&
                TIME_OPTIONS.map((option) => (
                  <ChoiceRow
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    sub={option.sub}
                    name="timeBudget"
                    selected={answers.timeBudget === option.value}
                    onSelect={() =>
                      setAnswers((value) => ({
                        ...value,
                        timeBudget: option.value,
                      }))
                    }
                  />
                ))}
              {step === 2 &&
                SPACE_OPTIONS.map((option) => (
                  <ChoiceRow
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    sub={option.sub}
                    name="space"
                    selected={answers.space === option.value}
                    onSelect={() =>
                      setAnswers((value) => ({ ...value, space: option.value }))
                    }
                  />
                ))}
            </fieldset>

            {error && (
              <p
                role="alert"
                className="mt-5 border-l-2 border-clay bg-clay/[0.07] px-3.5 py-2.5 text-[13px] leading-5 text-bone"
              >
                {error}
              </p>
            )}
          </div>

          <div className="mt-9 flex items-center gap-5">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={authBusy}
                className="focus-ring inline-flex items-center gap-2 py-2 text-[12px] text-sage transition-colors hover:text-bone"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}

            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!canContinue || authBusy || generating}
              className="btn-primary ml-auto flex-1 disabled:bg-bone/[0.06] disabled:text-sage-deep disabled:opacity-100 sm:flex-none sm:min-w-[200px]"
            >
              {step === 2 ? "Plant the tree" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-5 text-[11px] leading-5 text-sage">
            Your answers shape the tree. Nothing here is permanent.
          </p>
        </section>
      </main>

      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas px-6">
          <svg
            viewBox="0 0 120 120"
            fill="none"
            className="h-28 w-28 text-lichen"
            aria-hidden="true"
          >
            <circle
              cx="60"
              cy="60"
              r="57"
              stroke="currentColor"
              strokeOpacity="0.14"
            />
            <path
              d="M60 108V47"
              stroke="currentColor"
              strokeWidth="1.1"
              pathLength="1"
              className="branch-line"
            />
            <path
              d="M60 79C45 79 37 70 37 55c15 0 23 9 23 24Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
              pathLength="1"
              className="branch-line"
              style={{ animationDelay: "0.35s" }}
            />
            <path
              d="M60 64c0-15 8-24 23-24 0 15-8 24-23 24Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
              pathLength="1"
              className="branch-line"
              style={{ animationDelay: "0.65s" }}
            />
            <path
              d="M60 100C50 100 44 95 42 86c9 0 15 4 18 14Z"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinejoin="round"
              strokeOpacity="0.7"
              pathLength="1"
              className="branch-line"
              style={{ animationDelay: "0.5s" }}
            />
          </svg>

          <div className="mt-8 text-center">
            <p className="text-[11px] font-medium text-copper-light">One moment</p>
            <p className="mt-3 font-display text-[30px] leading-tight text-bone sm:text-[36px]">
              Planting your first season.
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-sage">
              <Loader2 className="h-3 w-3 animate-spin text-lichen" />
              {GENERATING_MESSAGES[messageIndex]}
            </p>
          </div>

          <div className="mt-10 h-px w-48 overflow-hidden bg-bone/10">
            <div className="h-px w-1/3 animate-scan bg-lichen" />
          </div>
        </div>
      )}
    </div>
  );
}
