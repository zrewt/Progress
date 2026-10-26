import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { User } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { generateTree, type TreeSource } from "./gemini";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { AccountScope, DailyData } from "./daily-data";
import { dailyPlanFromTree, presentation, DAILY_XP } from "./daily-adapter";
import type { DailySnapshot, EventInput, DailyPlan } from "./daily-types";
import type { AppUser, AuthResult, Celebration, GeneratedTree, OnboardingAnswers, Profile, TreeNode } from "./types";

interface GameContextValue {
  loading: boolean; authBusy: boolean; cloudEnabled: boolean; user: AppUser | null;
  profile: Profile | null; nodes: TreeNode[]; treeSource: TreeSource | null;
  snapshot: DailySnapshot | null; loadFailed: boolean; error: string | null; celebration: Celebration | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>; retryLoad: () => Promise<void>;
  submitOnboarding: (answers: OnboardingAnswers, pregenerated?: { tree: GeneratedTree; source: TreeSource }) => Promise<void>;
  startSeason: (plan: DailyPlan) => Promise<boolean>;
  recordEvent: (input: Omit<EventInput, "client_event_id" | "occurred_at">) => Promise<boolean>;
  undoEvent: (id: string) => Promise<boolean>;
  completeNode: (id: string) => Promise<boolean>;
  dismissCelebration: () => void; clearError: () => void;
}
const GameContext = createContext<GameContextValue | null>(null);
const account = (u: User): AppUser => ({ id: u.id, email: u.email ?? "", name: typeof u.user_metadata?.display_name === "string" ? u.user_metadata.display_name : undefined });

export function GameProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true), [authBusy, setAuthBusy] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null), [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false), [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [scope] = useState(() => new AccountScope());
  const currentUser = useRef<AppUser | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const retryEvents = useRef(new Map<string, EventInput>());
  const sb = getSupabase();
  const data = useMemo(() => sb ? new DailyData(sb) : null, [sb]);
  const { profile, nodes } = useMemo(() => snapshot ? presentation(snapshot) : { profile: null, nodes: [] }, [snapshot]);
  const activeSeason = snapshot?.seasons.find((s) => s.status === "active") ?? snapshot?.seasons[0];

  const retryLoad = useCallback(async () => {
    const next = currentUser.current;
    if (!data || !next) return;
    if (inflight.current) return inflight.current;
    const token = scope.token();
    setLoading(true);
    const task = (async () => {
      try {
        const result = await data.load(next.id);
        if (!scope.isCurrent(token)) return;
        setSnapshot(result); setLoadFailed(false); setError(null);
      } catch {
        if (scope.isCurrent(token)) { setLoadFailed(true); setError("We couldn’t load your journal. Nothing has been overwritten. Please try again."); }
      } finally {
        if (scope.isCurrent(token)) { setLoading(false); inflight.current = null; }
      }
    })();
    inflight.current = task;
    return task;
  }, [data, scope]);

  useEffect(() => {
    if (!sb) return;
    let mounted = true;
    function accept(next: User | undefined) {
      if (!mounted) return;
      const nextAccount = next ? account(next) : null;
      if (currentUser.current?.id !== nextAccount?.id) {
        scope.switch(nextAccount?.id ?? null); inflight.current = null; retryEvents.current.clear();
        currentUser.current = nextAccount; setUser(nextAccount); setSnapshot(null); setCelebration(null); setLoadFailed(false); setError(null);
      }
      if (nextAccount) void retryLoad(); else setLoading(false);
    }
    void sb.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) { setLoadFailed(true); setError("We couldn’t restore your session. Try again."); setLoading(false); } else accept(data.session?.user);
    }).catch(() => { if (mounted) { setLoadFailed(true); setLoading(false); setError("We couldn’t restore your session. Please sign in again."); } });
    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      // Do not await another Supabase call inside its auth callback lock.
      setTimeout(() => accept(session?.user), 0);
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { sb.auth.startAutoRefresh(); void retryLoad(); } else sb.auth.stopAutoRefresh();
    });
    return () => { mounted = false; scope.switch(null); listener.subscription.unsubscribe(); subscription.remove(); };
  }, [sb, retryLoad, scope]);

  async function signIn(email: string, password: string): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: "Enter a valid email address." };
    setAuthBusy(true);
    try { const result = await sb.auth.signInWithPassword({ email: email.trim(), password }); return result.error ? { error: "We couldn’t sign you in. Check your email and password, or confirm your email first." } : {}; }
    catch { return { error: "Check your connection and try again." }; } finally { setAuthBusy(false); }
  }
  async function signUp(name: string, email: string, password: string): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    if (!name.trim() || password.length < 6 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: "Add your name, a valid email, and a password of at least six characters." };
    setAuthBusy(true);
    try { const result = await sb.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() } } }); return result.error ? { error: "We couldn’t create your account. Please try again." } : result.data.session ? {} : { info: "Check your inbox to confirm your email, then sign in." }; }
    catch { return { error: "Check your connection and try again." }; } finally { setAuthBusy(false); }
  }
  async function signOut() {
    scope.switch(null); currentUser.current = null; inflight.current = null; retryEvents.current.clear();
    setUser(null); setSnapshot(null); setCelebration(null); setLoadFailed(false); setError(null);
    const result = await sb?.auth.signOut({ scope: "local" });
    if (result?.error) setError("Sign-out could not be confirmed. Please try again before sharing this device.");
  }
  async function startSeason(plan: DailyPlan) {
    if (!data || !currentUser.current || loadFailed || loading) return false;
    const token = scope.token(); setAuthBusy(true);
    try { await data.start(plan, snapshot?.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC", currentUser.current.name); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("Your season could not be saved. Please try again."); return false; }
    finally { if (scope.isCurrent(token)) setAuthBusy(false); }
  }
  async function submitOnboarding(answers: OnboardingAnswers, built?: { tree: GeneratedTree; source: TreeSource }) {
    const token = scope.token();
    const result = built ?? await generateTree(answers);
    if (scope.isCurrent(token)) await startSeason(dailyPlanFromTree(answers, result.tree, result.source));
  }
  async function recordEvent(input: Omit<EventInput, "client_event_id" | "occurred_at">) {
    if (!data || !currentUser.current || loadFailed || loading) return false;
    const token = scope.token();
    const key = `${input.season_id}:${input.practice_id}:${input.kind}`;
    const event = retryEvents.current.get(key) ?? { ...input, client_event_id: Crypto.randomUUID(), occurred_at: new Date().toISOString() };
    retryEvents.current.set(key, event);
    try {
      const result = await data.record(event);
      if (!scope.isCurrent(token)) return false;
      retryEvents.current.delete(key);
      if (result.credited) setCelebration({ id: Date.now(), title: "You showed up", xp: DAILY_XP, unlocked: false, nextTitle: null });
      await retryLoad(); return true;
    } catch { if (scope.isCurrent(token)) setError("Your practice could not be confirmed. Try again; a retry won’t count it twice."); return false; }
  }
  async function completeNode(id: string) { return activeSeason ? recordEvent({ season_id: activeSeason.id, practice_id: id, kind: "full" }) : false; }
  async function undoEvent(id: string) {
    if (!data || !currentUser.current || loadFailed) return false;
    const token = scope.token();
    try { await data.undo(id); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("This entry could not be undone. Undo is available on the same local day."); return false; }
  }
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const clearError = useCallback(() => setError(null), []);
  return <GameContext.Provider value={{ loading: sb ? loading : false, authBusy, cloudEnabled: isSupabaseConfigured(), user, profile, nodes, treeSource: activeSeason?.plan_source === "ai" ? "edge-ai" : "seed-engine", snapshot, loadFailed, error, celebration, signIn, signUp, signOut, retryLoad, submitOnboarding, startSeason, recordEvent, undoEvent, completeNode, dismissCelebration, clearError }}>{children}</GameContext.Provider>;
}
export function useGame() { const context = useContext(GameContext); if (!context) throw new Error("useGame must be used inside <GameProvider>"); return context; }
