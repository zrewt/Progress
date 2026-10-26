import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Linking } from "react-native";
import type { User } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import { generateTree, type TreeSource } from "./gemini";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { AccountScope, DailyData } from "./daily-data";
import { dailyPlanFromTree, presentation, DAILY_XP } from "./daily-adapter";
import { todayState, type TodayView } from "./today";
import { AI_CONSENT_VERSION, RESET_REDIRECT } from "./config";
import { parseRecoveryLink } from "./auth-links";
import { deviceQueue } from "./offline-store";
import { enqueue, replay } from "./offline-queue";
import type { DailyPlan, DailySnapshot, EventInput, SeasonHistoryEntry } from "./daily-types";
import type { AppUser, AuthResult, Celebration, GeneratedTree, OnboardingAnswers, Profile, TreeNode } from "./types";

interface PendingUndo { eventId: string; label: string; kind: "counted" | "rest" | "skipped" }
interface GameContextValue {
  loading: boolean; authBusy: boolean; cloudEnabled: boolean; user: AppUser | null;
  profile: Profile | null; nodes: TreeNode[]; treeSource: TreeSource | null;
  snapshot: DailySnapshot | null; today: TodayView | null; loadFailed: boolean; error: string | null; celebration: Celebration | null;
  undoOffer: PendingUndo | null; history: SeasonHistoryEntry[] | null;
  aiAllowed: boolean; recovering: boolean;
  queueCount: number; syncState: "idle" | "pending" | "syncing" | "error";
  syncNow: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>; retryLoad: () => Promise<void>;
  submitOnboarding: (answers: OnboardingAnswers, pregenerated?: { tree: GeneratedTree; source: TreeSource }) => Promise<void>;
  startSeason: (plan: DailyPlan) => Promise<boolean>;
  recordEvent: (input: Omit<EventInput, "client_event_id" | "occurred_at">) => Promise<boolean>;
  undoEvent: (id: string) => Promise<boolean>;
  dismissUndo: () => void;
  editPlan: (plan: DailyPlan) => Promise<boolean>;
  replacePractice: (practiceId: string, draft: DailyPlan["practices"][number]) => Promise<boolean>;
  submitReview: (weekStart: string, difficulty: number, note: string | null, apply: boolean) => Promise<string | null>;
  finishSeason: (plan: DailyPlan) => Promise<boolean>;
  loadHistory: () => Promise<void>;
  recordConsent: () => Promise<boolean>;
  withdrawConsent: () => Promise<boolean>;
  setTimezone: (timezone: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resendConfirmation: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  cancelRecovery: () => void;
  deleteAccount: () => Promise<AuthResult>;
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
  const [undoOffer, setUndoOffer] = useState<PendingUndo | null>(null), [history, setHistory] = useState<SeasonHistoryEntry[] | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [syncState, setSyncState] = useState<"idle" | "pending" | "syncing" | "error">("idle");
  const [scope] = useState(() => new AccountScope());
  const currentUser = useRef<AppUser | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const retryEvents = useRef(new Map<string, EventInput>());
  const undoTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = getSupabase();
  const data = useMemo(() => sb ? new DailyData(sb) : null, [sb]);
  const { profile, nodes } = useMemo(() => snapshot ? presentation(snapshot) : { profile: null, nodes: [] }, [snapshot]);
  const today = useMemo(() => snapshot ? todayState(snapshot) : null, [snapshot]);
  const activeSeason = snapshot?.seasons.find((s) => s.status === "active") ?? snapshot?.seasons[0];

  const dismissUndo = useCallback(() => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    undoTimeout.current = null;
    setUndoOffer(null);
  }, []);

  const offerUndo = useCallback((offer: PendingUndo) => {
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
    setUndoOffer(offer);
    undoTimeout.current = setTimeout(() => setUndoOffer(null), 10_000);
  }, []);

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
        currentUser.current = nextAccount; setUser(nextAccount); setSnapshot(null); setCelebration(null); setUndoOffer(null); setHistory(null);
        setLoadFailed(false); setError(null);
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

  useEffect(() => () => { if (undoTimeout.current) clearTimeout(undoTimeout.current); }, []);

  const syncNow = useCallback(async () => {
    const account = currentUser.current;
    if (!data || !account) return;
    const token = scope.token();
    const queued = await deviceQueue.read(account.id);
    if (!queued.length) { if (scope.isCurrent(token)) { setQueueCount(0); setSyncState("idle"); } return; }
    if (scope.isCurrent(token)) { setQueueCount(queued.length); setSyncState("syncing"); }
    const result = await replay(queued, async (event) => { await data.record(event); });
    await deviceQueue.write(account.id, result.remaining);
    if (!scope.isCurrent(token)) return;
    setQueueCount(result.remaining.length);
    setSyncState(result.failure ? "error" : result.remaining.length ? "pending" : "idle");
    if (result.sent.length) await retryLoad();
  }, [data, retryLoad, scope]);

  useEffect(() => {
    if (!user || loading || loadFailed) return;
    const timer = setTimeout(() => void syncNow(), 0);
    return () => clearTimeout(timer);
  }, [user, loading, loadFailed, syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

  useEffect(() => {
    if (!sb) return;
    const auth = sb.auth;
    let mounted = true;
    async function handle(url: string | null) {
      const link = parseRecoveryLink(url);
      if (!link.isRecovery && !link.accessToken && !link.code) return;
      try {
        if (link.accessToken && link.refreshToken) {
          await auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
        } else if (link.code) {
          await auth.exchangeCodeForSession(link.code);
        }
      } catch {
        if (mounted) setError("That reset link has expired. Request a new one and try again.");
      }
      if (mounted && link.isRecovery) setRecovering(true);
    }
    void Linking.getInitialURL().then(handle).catch(() => undefined);
    const subscription = Linking.addEventListener("url", (event) => void handle(event.url));
    return () => { mounted = false; subscription.remove(); };
  }, [sb]);

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
    setUser(null); setSnapshot(null); setCelebration(null); setUndoOffer(null); setHistory(null); setLoadFailed(false); setError(null);
    const result = await sb?.auth.signOut({ scope: "local" });
    if (result?.error) setError("Sign-out could not be confirmed. Please try again before sharing this device.");
  }
  async function startSeason(plan: DailyPlan) {
    if (!data || !currentUser.current || loadFailed || loading) return false;
    const token = scope.token(); setAuthBusy(true);
    try {
      await data.start(plan, snapshot?.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC", currentUser.current.name);
      if (!scope.isCurrent(token)) return false;
      setHistory(null);
      await retryLoad();
      return true;
    }
    catch { if (scope.isCurrent(token)) setError("Your season could not be saved. Please try again."); return false; }
    finally { if (scope.isCurrent(token)) setAuthBusy(false); }
  }
  async function submitOnboarding(answers: OnboardingAnswers, built?: { tree: GeneratedTree; source: TreeSource }) {
    const token = scope.token();
    const result = built ?? await generateTree(answers);
    if (!scope.isCurrent(token)) return;
    await startSeason(dailyPlanFromTree(answers, result.tree, result.source));
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
      if (result.credited) setCelebration({ id: Date.now(), title: input.kind === "easy" ? "Showing up counts" : "You showed up", xp: DAILY_XP, unlocked: false, nextTitle: null });
      if (result.event?.id) offerUndo({
        eventId: result.event.id,
        kind: input.kind === "rest" ? "rest" : input.kind === "skipped" ? "skipped" : "counted",
        label: input.kind === "rest" ? "Rest day noted" : input.kind === "skipped" ? "Skipped for today" : "Practice recorded",
      });
      await retryLoad(); return true;
    } catch {
      const account = currentUser.current;
      if (account && scope.isCurrent(token)) {
        // Keep the exact event, including its client_event_id, so a retry can never double-count.
        const queued = await deviceQueue.read(account.id);
        const next = enqueue(queued, event);
        await deviceQueue.write(account.id, next);
        setQueueCount(next.length);
        setSyncState("pending");
        setError("You seem to be offline. Today’s practice is saved on this device and will sync on its own.");
        return true;
      }
      return false;
    }
  }
  async function completeNode(id: string) {
    if (!activeSeason) return false;
    return recordEvent({ season_id: activeSeason.id, practice_id: id, kind: "full" });
  }
  async function undoEvent(id: string) {
    if (!data || !currentUser.current || loadFailed) return false;
    const token = scope.token();
    try { await data.undo(id); if (!scope.isCurrent(token)) return false; dismissUndo(); await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("This entry could not be undone. Undo is available on the same local day."); return false; }
  }
  async function editPlan(plan: DailyPlan) {
    if (!data || !activeSeason || loadFailed) return false;
    const token = scope.token(); setAuthBusy(true);
    try { await data.editPlan(activeSeason.id, plan); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("That change could not be saved. Your current plan is unchanged."); return false; }
    finally { if (scope.isCurrent(token)) setAuthBusy(false); }
  }
  async function replacePractice(practiceId: string, draft: DailyPlan["practices"][number]) {
    if (!data || !activeSeason || loadFailed) return false;
    const token = scope.token(); setAuthBusy(true);
    try { await data.replacePractice(activeSeason.id, practiceId, draft); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("That practice could not be replaced. Your plan is unchanged."); return false; }
    finally { if (scope.isCurrent(token)) setAuthBusy(false); }
  }
  async function submitReview(weekStart: string, difficulty: number, note: string | null, apply: boolean) {
    if (!data || !activeSeason || loadFailed) return null;
    const token = scope.token();
    try {
      const result = await data.review(activeSeason.id, weekStart, difficulty, note, apply);
      if (!scope.isCurrent(token)) return null;
      if (apply) await retryLoad();
      return result.decision;
    } catch { if (scope.isCurrent(token)) setError("Your review could not be saved. Nothing has changed."); return null; }
  }
  async function finishSeason(plan: DailyPlan) {
    const saved = await startSeason(plan);
    if (saved) setHistory(null);
    return saved;
  }
  async function loadHistory() {
    if (!data || !currentUser.current || loadFailed) return;
    const token = scope.token();
    try { const entries = await data.history(); if (scope.isCurrent(token)) setHistory(entries); }
    catch { if (scope.isCurrent(token)) setError("Past seasons could not be loaded. Try again."); }
  }
  async function recordConsent() {
    if (!data || !currentUser.current) return false;
    const token = scope.token();
    try { await data.recordConsent(AI_CONSENT_VERSION); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("Your choice could not be saved. You can still use a plan built on this device."); return false; }
  }
  async function withdrawConsent() {
    if (!data || !currentUser.current) return false;
    const token = scope.token();
    try { await data.withdrawConsent(); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("That change could not be saved. Try again."); return false; }
  }
  async function setTimezone(timezone: string) {
    if (!data || !currentUser.current) return false;
    const token = scope.token();
    try { await data.setTimezone(timezone); if (!scope.isCurrent(token)) return false; await retryLoad(); return true; }
    catch { if (scope.isCurrent(token)) setError("That time zone could not be saved. Try again."); return false; }
  }
  async function requestPasswordReset(email: string): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: "Enter the email address on your account." };
    try {
      await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_REDIRECT });
      return { info: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
    } catch { return { error: "Check your connection and try again." }; }
  }
  async function resendConfirmation(email: string): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return { error: "Enter the email address you signed up with." };
    try {
      await sb.auth.resend({ type: "signup", email: email.trim() });
      return { info: "If that address needs confirming, a new link is on its way." };
    } catch { return { error: "Check your connection and try again." }; }
  }
  async function updatePassword(password: string): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    if (password.length < 8) return { error: "Use at least eight characters." };
    try {
      const { error: failure } = await sb.auth.updateUser({ password });
      if (failure) return { error: "That link may have expired. Request a new reset email and try again." };
      setRecovering(false);
      return { info: "Your password has been changed. You are signed in." };
    } catch { return { error: "Check your connection and try again." }; }
  }
  async function deleteAccount(): Promise<AuthResult> {
    if (!sb) return { error: "Account access isn’t configured yet." };
    try {
      const { error: failure } = await sb.functions.invoke("delete-account", { body: { confirm: true } });
      if (failure) return { error: "Your account could not be deleted. Nothing has changed. Please try again or contact support." };
      await signOut();
      return { info: "Your account and journal have been deleted." };
    } catch { return { error: "Your account could not be deleted. Nothing has changed. Please try again or contact support." }; }
  }
  const cancelRecovery = useCallback(() => setRecovering(false), []);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const clearError = useCallback(() => setError(null), []);
  const value: GameContextValue = {
    loading: sb ? loading : false, authBusy, cloudEnabled: isSupabaseConfigured(), user, profile, nodes,
    treeSource: activeSeason?.plan_source === "ai" ? "edge-ai" : "seed-engine",
    snapshot, today, loadFailed, error, celebration, undoOffer, history,
    aiAllowed: Boolean(snapshot?.profile?.ai_consent_at) && snapshot?.profile?.ai_consent_version === AI_CONSENT_VERSION,
    recovering, queueCount, syncState, syncNow,
    signIn, signUp, signOut, retryLoad, submitOnboarding, startSeason, recordEvent, undoEvent, dismissUndo,
    editPlan, replacePractice, submitReview, finishSeason, loadHistory, recordConsent, withdrawConsent, setTimezone,
    requestPasswordReset, resendConfirmation, updatePassword, cancelRecovery, deleteAccount, completeNode, dismissCelebration, clearError,
  };
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
export function useGame() { const context = useContext(GameContext); if (!context) throw new Error("useGame must be used inside <GameProvider>"); return context; }

/** A new season keeps the same plan shape, with a fresh version number. */
export function planVersionOf(plan: DailyPlan, version: number): DailyPlan {
  return { ...plan, plan_version: version };
}

export type { TodayView };
