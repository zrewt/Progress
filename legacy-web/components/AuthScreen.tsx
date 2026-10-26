"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useGame } from "@/lib/game-context";
import { PILLARS } from "@/lib/pillars";
import { BotanicalBranch } from "./BotanicalBranch";
import { BrandMark } from "./BrandMark";

type Tab = "signin" | "signup";

export function AuthScreen() {
  const { signIn, signUp, authBusy, cloudEnabled, mode } = useGame();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const result =
      tab === "signin"
        ? await signIn(email, password)
        : await signUp(name, email, password);
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  }

  async function handleDemo() {
    setError(null);
    setInfo(null);
    const result = await signIn("alex@vitalitytree.app", "vitality-demo");
    if (result.error) setError(result.error);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setInfo(null);
  }

  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative hidden overflow-hidden border-r border-bone/10 bg-ink-950/30 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-11 xl:px-20">
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark className="h-8 w-8 text-bone" />
          <span className="font-display text-[19px] tracking-tight text-bone">
            Vitality Tree
          </span>
        </div>

        <div className="relative z-10 max-w-[430px] py-16">
          <p className="text-[11px] font-medium text-sage">A daily practice · Vol. I</p>
          <p className="mt-7 font-display text-[58px] leading-[0.98] tracking-[-0.025em] text-bone xl:text-[66px]">
            Your body is a{" "}
            <span className="italic text-lichen">long game.</span>
          </p>
          <p className="mt-7 max-w-[330px] text-[14px] leading-7 text-sage">
            A skill tree for mobility, breath, strength and rest. Four branches,
            one small practice at a time — tracked like a ritual, not a race.
          </p>

          <BotanicalBranch className="pointer-events-none absolute -right-36 -top-24 -z-0 h-[620px] w-auto text-bone/[0.22] xl:-right-28" />
        </div>

        <div className="relative z-10">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 border-t border-bone/10 pt-6">
            {PILLARS.map((pillar) => (
              <div key={pillar.id} className="flex items-baseline gap-3">
                <span className="font-display text-[15px] italic text-copper-light">
                  {pillar.roman}
                </span>
                <span>
                  <span className="block text-[12px] font-medium text-bone">
                    {pillar.name}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-sage-dim">
                    {pillar.subtitle}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.13em] text-sage-deep">
            <span>A practice, not a prescription</span>
            <span>Est. MMXXVI</span>
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:px-14 lg:py-11 xl:px-20">
        <div className="flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-7 w-7 text-bone" />
            <span className="font-display text-[17px] tracking-tight text-bone">
              Vitality Tree
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-sage-dim">
            Vol. I
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14 lg:py-8">
          <div>
            <p className="text-[11px] font-medium text-copper-light">
              {tab === "signin" ? "Member access" : "First season"}
            </p>
            <h1 className="mt-4 font-display text-[42px] leading-[1.02] tracking-[-0.02em] text-bone sm:text-[48px]">
              {tab === "signin" ? (
                <>
                  Welcome
                  <br />
                  back.
                </>
              ) : (
                <>
                  Begin
                  <br />
                  here.
                </>
              )}
            </h1>
            <p className="mt-4 max-w-[330px] text-[13px] leading-6 text-sage">
              {tab === "signin"
                ? "Your branches are exactly where you left them."
                : "Three questions shape a tree around your day — then one small practice at a time."}
            </p>
          </div>

          <div className="mt-9 flex gap-7 border-b border-bone/10">
            <button
              type="button"
              onClick={() => switchTab("signin")}
              className={`focus-ring -mb-px border-b pb-2.5 text-[12px] font-medium transition-colors ${
                tab === "signin"
                  ? "border-copper text-bone"
                  : "border-transparent text-sage hover:text-bone"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => switchTab("signup")}
              className={`focus-ring -mb-px border-b pb-2.5 text-[12px] font-medium transition-colors ${
                tab === "signup"
                  ? "border-copper text-bone"
                  : "border-transparent text-sage hover:text-bone"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {tab === "signup" && (
              <label className="block">
                <span className="text-[11px] font-medium text-sage">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  autoComplete="name"
                  placeholder="What should we call you?"
                  className="field mt-2"
                />
              </label>
            )}

            <label className="block">
              <span className="text-[11px] font-medium text-sage">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="field mt-2"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-sage">Password</span>
              <div className="relative">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    tab === "signin" ? "current-password" : "new-password"
                  }
                  required
                  minLength={6}
                  placeholder="At least six characters"
                  className="field mt-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="focus-ring absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xs text-sage-dim transition-colors hover:text-bone"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p
                role="alert"
                className="border-l-2 border-clay bg-clay/[0.07] px-3.5 py-2.5 text-[12px] leading-5 text-bone"
              >
                {error}
              </p>
            )}
            {info && (
              <p
                role="status"
                className="border-l-2 border-lichen bg-lichen/[0.06] px-3.5 py-2.5 text-[12px] leading-5 text-bone"
              >
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="btn-primary mt-1 w-full"
            >
              {authBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {tab === "signin" ? "Sign in" : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {!cloudEnabled && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-bone/10" />
                <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-sage-deep">
                  or
                </span>
                <span className="h-px flex-1 bg-bone/10" />
              </div>

              <button
                type="button"
                onClick={() => void handleDemo()}
                disabled={authBusy}
                className="focus-ring mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-[12.5px] font-medium text-sage transition-colors hover:text-bone disabled:opacity-40"
              >
                Explore the local demo
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}

          <p className="mt-6 flex items-center justify-center gap-2 text-[10.5px] text-sage-dim">
            <span
              className={`h-1 w-1 rounded-full ${
                cloudEnabled && mode === "cloud" ? "bg-lichen" : "bg-copper"
              }`}
            />
            {cloudEnabled && mode === "cloud"
              ? "Cloud sync enabled"
              : "Local demo — progress stays in this browser"}
          </p>
        </div>

        <div className="hidden items-center justify-between border-t border-bone/10 pt-5 font-mono text-[10px] uppercase tracking-[0.13em] text-sage-deep lg:flex">
          <span>Move daily. Rest when needed.</span>
          <span>50 XP a practice</span>
        </div>
      </main>
    </div>
  );
}
