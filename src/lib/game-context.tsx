import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import { generateTree, type TreeSource } from "./gemini";
import { PILLARS } from "./pillars";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  NODE_XP,
  buildNodes,
  completeNodeInTree,
  levelStats,
  nextStreak,
  nodeId,
  todayKey,
} from "./tree";
import type {
  AppUser,
  AuthResult,
  BlockerId,
  Celebration,
  GeneratedTree,
  IdentityId,
  NodeStatus,
  OnboardingAnswers,
  PillarId,
  Profile,
  TreeNode,
} from "./types";

interface GameContextValue {
  loading: boolean;
  authBusy: boolean;
  cloudEnabled: boolean;
  user: AppUser | null;
  profile: Profile | null;
  nodes: TreeNode[];
  treeSource: TreeSource | null;
  error: string | null;
  celebration: Celebration | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  submitOnboarding: (
    answers: OnboardingAnswers,
    pregenerated?: { tree: GeneratedTree; source: TreeSource },
  ) => Promise<void>;
  completeNode: (id: string) => Promise<boolean>;
  dismissCelebration: () => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

interface ProfileRow {
  id: string;
  display_name: string | null;
  identity: string | null;
  goal: string | null;
  time_budget: string | null;
  level: number | null;
  xp: number | null;
  streak: number | null;
  last_completed_date: string | null;
  season_started_at: string | null;
}

interface NodeRow {
  node_id: string;
  pillar: string;
  tier: number;
  title: string;
  duration: string | null;
  description: string | null;
  instructions: string[] | null;
  status: string;
  completed_at: string | null;
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    displayName: row.display_name ?? "",
    identity: (row.identity as IdentityId) ?? "creator",
    goal: row.goal ?? "",
    timeBudget: row.time_budget ?? "15",
    xp: row.xp ?? 0,
    level: levelStats(row.xp ?? 0).level,
    streak: row.streak ?? 0,
    lastCompletedDate: row.last_completed_date ?? null,
    seasonStartedAt: row.season_started_at ?? null,
  };
}

function nodesFromRows(rows: NodeRow[]): TreeNode[] {
  return rows
    .filter((row) => PILLARS.some((p) => p.id === row.pillar))
    .map((row) => ({
      id: row.node_id ?? nodeId(row.pillar, row.tier),
      pillar: row.pillar as PillarId,
      tier: row.tier,
      title: row.title,
      duration: row.duration ?? "",
      description: row.description ?? "",
      instructions: Array.isArray(row.instructions) ? row.instructions : [],
      status: (["locked", "active", "completed"].includes(row.status)
        ? row.status
        : "locked") as NodeStatus,
      completedAt: row.completed_at,
    }))
    .sort((a, b) => a.tier - b.tier);
}

function nodeRowsFor(userId: string, nodes: TreeNode[]) {
  return nodes.map((node) => ({
    user_id: userId,
    node_id: node.id,
    pillar: node.pillar,
    tier: node.tier,
    title: node.title,
    duration: node.duration,
    description: node.description,
    instructions: node.instructions,
    status: node.status,
    completed_at: node.completedAt ?? null,
  }));
}

function profilePayload(userId: string, profile: Profile) {
  return {
    id: userId,
    display_name: profile.displayName,
    identity: profile.identity,
    goal: profile.goal,
    time_budget: profile.timeBudget,
    level: profile.level,
    xp: profile.xp,
    streak: profile.streak,
    last_completed_date: profile.lastCompletedDate,
    season_started_at: profile.seasonStartedAt,
  };
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function appUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      (user.user_metadata?.display_name as string | undefined) ??
      titleCase(user.email?.split("@")[0] ?? "Creator"),
  };
}

const MISSING_SCHEMA_CODES = ["PGRST205", "42P01"];

function isMissingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return (
    MISSING_SCHEMA_CODES.includes(error.code ?? "") ||
    /schema cache|does not exist|Could not find the table/i.test(error.message ?? "")
  );
}

function profileLoadError(error: { code?: string; message?: string } | null) {
  if (isMissingSchema(error)) {
    return "Supabase is connected, but its database tables are missing. Run supabase/schema.sql once in the Supabase SQL Editor, then reload the app.";
  }
  return `Could not load your Supabase profile (${error?.message ?? "unknown error"}). Check the database schema and RLS policies.`;
}

function treeLoadError(error: { code?: string; message?: string } | null) {
  if (isMissingSchema(error)) {
    return "Supabase is connected, but its database tables are missing. Run supabase/schema.sql once in the Supabase SQL Editor, then reload the app.";
  }
  return `Could not load your growth tree (${error?.message ?? "unknown error"}). Check that the "nodes" table exists.`;
}

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email and password don't match. Try again or create an account.";
  }
  if (lower.includes("already registered")) {
    return "This email already has an account. Sign in instead.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox for the link.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Couldn't reach Supabase. Check your connection and try again.";
  }
  return message;
}

/** Removes progress saved by the old local-demo build. The Supabase session is untouched. */
async function clearLegacyLocalDemo() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter((key) => key.startsWith("vitality:"));
    if (legacy.length) await AsyncStorage.multiRemove(legacy);
  } catch {
    /* nothing to clean up */
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudEnabled] = useState(() => isSupabaseConfigured());
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [treeSource, setTreeSource] = useState<TreeSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const hydrationRef = useRef<{
    userId: string;
    promise: Promise<void>;
  } | null>(null);

  const hydrateCloudUser = useCallback(async (nextUser: User) => {
    if (hydrationRef.current?.userId === nextUser.id) {
      return hydrationRef.current.promise;
    }

    const promise = (async () => {
      const sb = getSupabase();
      if (!sb) return;
      setLoading(true);
      setUser(appUser(nextUser));

      const { data: row, error: profileError } = await sb
        .from("profiles")
        .select("*")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (profileError) {
        setError(profileLoadError(profileError));
        setProfile(null);
        setNodes([]);
        setLoading(false);
        return;
      }

      const profileRow = row as ProfileRow | null;

      // A row without an identity belongs to the old fitness-only build; send
      // that account through the new goal onboarding instead of guessing.
      if (!profileRow || !profileRow.identity) {
        setProfile(null);
        setNodes([]);
        setLoading(false);
        return;
      }

      const loadedProfile = profileFromRow(profileRow);
      let loadedNodes: TreeNode[] = [];

      const { data: nodeData, error: nodesError } = await sb
        .from("nodes")
        .select("*")
        .eq("user_id", nextUser.id)
        .order("tier", { ascending: true });

      if (nodesError) {
        setError(treeLoadError(nodesError));
      } else if (nodeData && nodeData.length) {
        loadedNodes = nodesFromRows(nodeData as NodeRow[]);
      }

      if (!loadedNodes.length) {
        const generated = await generateTree({
          identity: loadedProfile.identity,
          goal: loadedProfile.goal,
          blocker: loadedProfile.blocker ?? "consistency",
          timeBudget: loadedProfile.timeBudget,
        });
        loadedNodes = buildNodes(generated.tree);
        setTreeSource(generated.source);
        const { error: insertError } = await sb
          .from("nodes")
          .upsert(nodeRowsFor(nextUser.id, loadedNodes), {
            onConflict: "user_id,node_id",
          });
        if (insertError) {
          setError(
            `Could not save your generated tree to Supabase (${insertError.message}).`,
          );
        }
      }

      setProfile(loadedProfile);
      setNodes(loadedNodes);
      setLoading(false);
    })();

    hydrationRef.current = { userId: nextUser.id, promise };
    return promise;
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void clearLegacyLocalDemo();

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        void hydrateCloudUser(data.session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        void hydrateCloudUser(session.user);
      } else {
        hydrationRef.current = null;
        setUser(null);
        setProfile(null);
        setNodes([]);
        setLoading(false);
      }
    });

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        sb.auth.startAutoRefresh();
      } else {
        sb.auth.stopAutoRefresh();
      }
    };
    const appState = AppState.addEventListener("change", onAppStateChange);

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, [hydrateCloudUser]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const cleanEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { error: "Enter a valid email address." };
      }
      if (password.length < 6) {
        return { error: "Password must be at least 6 characters." };
      }

      const sb = getSupabase();
      if (!sb) return { error: "Supabase is not configured." };

      setAuthBusy(true);
      setError(null);
      try {
        const { data, error: signInError } = await sb.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInError) return { error: friendlyAuthError(signInError.message) };
        if (data.user) await hydrateCloudUser(data.user);
        return {};
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "Something went wrong. Try again.",
        };
      } finally {
        setAuthBusy(false);
      }
    },
    [hydrateCloudUser],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      const cleanEmail = email.trim();
      if (!name.trim()) return { error: "Tell us what to call you." };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { error: "Enter a valid email address." };
      }
      if (password.length < 6) {
        return { error: "Password must be at least 6 characters." };
      }

      const sb = getSupabase();
      if (!sb) return { error: "Supabase is not configured." };

      setAuthBusy(true);
      setError(null);
      try {
        const { data, error: signUpError } = await sb.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (signUpError) return { error: friendlyAuthError(signUpError.message) };
        if (data.session && data.user) {
          await hydrateCloudUser(data.user);
          return {};
        }
        return {
          info: "Account created. Check your inbox to confirm your email, then sign in.",
        };
      } catch (err) {
        return {
          error:
            err instanceof Error ? err.message : "Something went wrong. Try again.",
        };
      } finally {
        setAuthBusy(false);
      }
    },
    [hydrateCloudUser],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    try {
      if (sb) await sb.auth.signOut();
    } catch (err) {
      console.warn("[vitality-tree] sign out request failed", err);
    } finally {
      hydrationRef.current = null;
      setUser(null);
      setProfile(null);
      setNodes([]);
      setCelebration(null);
      setError(null);
    }
  }, []);

  /** Writes the whole profile and tree to Supabase. Returns false when the write fails. */
  const saveTree = useCallback(
    async (nextProfile: Profile, nextNodes: TreeNode[]) => {
      if (!user) return false;
      const sb = getSupabase();
      if (!sb) {
        setError("Supabase is not configured. Your progress cannot be saved.");
        return false;
      }

      const { error: profileError } = await sb
        .from("profiles")
        .upsert(profilePayload(user.id, nextProfile), { onConflict: "id" });
      if (profileError) {
        setError(
          isMissingSchema(profileError)
            ? profileLoadError(profileError)
            : `Supabase couldn't save your profile (${profileError.message}).`,
        );
        return false;
      }

      const { error: nodesError } = await sb
        .from("nodes")
        .upsert(nodeRowsFor(user.id, nextNodes), {
          onConflict: "user_id,node_id",
        });
      if (nodesError) {
        setError(
          isMissingSchema(nodesError)
            ? treeLoadError(nodesError)
            : `Supabase couldn't save your tree (${nodesError.message}).`,
        );
        return false;
      }

      return true;
    },
    [user],
  );

  const submitOnboarding = useCallback(
    async (
      answers: OnboardingAnswers,
      pregenerated?: { tree: GeneratedTree; source: TreeSource },
    ) => {
      if (!user) return;
      setAuthBusy(true);
      setError(null);
      try {
        const generated = pregenerated ?? (await generateTree(answers));
        const built = buildNodes(generated.tree);
        const nextProfile: Profile = {
          displayName: user.name || user.email.split("@")[0] || "Creator",
          identity: answers.identity,
          goal: answers.goal,
          blocker: answers.blocker,
          timeBudget: answers.timeBudget,
          level: 1,
          xp: 0,
          streak: 0,
          lastCompletedDate: null,
          seasonStartedAt: new Date().toISOString(),
        };

        const saved = await saveTree(nextProfile, built);
        if (!saved) return;

        setTreeSource(generated.source);
        setProfile(nextProfile);
        setNodes(built);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not generate your tree. Please try again.",
        );
      } finally {
        setAuthBusy(false);
      }
    },
    [saveTree, user],
  );

  const completeNode = useCallback(
    async (id: string) => {
      if (!profile) return false;
      const result = completeNodeInTree(nodes, id);
      if (!result.target) return false;

      const stats = levelStats(profile.xp + NODE_XP);
      const nextProfile: Profile = {
        ...profile,
        xp: profile.xp + NODE_XP,
        level: stats.level,
        streak: nextStreak(profile.lastCompletedDate, profile.streak),
        lastCompletedDate: todayKey(),
      };

      const saved = await saveTree(nextProfile, result.nodes);
      if (!saved) return false;

      setProfile(nextProfile);
      setNodes(result.nodes);
      setCelebration({
        id: Date.now(),
        title: result.target.title,
        xp: NODE_XP,
        levelUp: stats.level > profile.level ? stats.level : undefined,
        unlocked: Boolean(result.unlocked),
        nextTitle: result.unlocked?.title ?? null,
      });
      return true;
    },
    [nodes, profile, saveTree],
  );

  const dismissCelebration = useCallback(() => setCelebration(null), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <GameContext.Provider
      value={{
        loading,
        authBusy,
        cloudEnabled,
        user,
        profile,
        nodes,
        treeSource,
        error,
        celebration,
        signIn,
        signUp,
        signOut,
        submitOnboarding,
        completeNode,
        dismissCelebration,
        clearError,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside <GameProvider>");
  return context;
}
