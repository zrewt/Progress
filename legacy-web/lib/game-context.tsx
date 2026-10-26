"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  Celebration,
  NodeStatus,
  OnboardingAnswers,
  PillarId,
  Profile,
  TreeNode,
} from "./types";

type StorageMode = "cloud" | "local";

interface GameContextValue {
  loading: boolean;
  authBusy: boolean;
  cloudEnabled: boolean;
  mode: StorageMode;
  user: AppUser | null;
  profile: Profile | null;
  nodes: TreeNode[];
  treeSource: TreeSource | null;
  error: string | null;
  celebration: Celebration | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  submitOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  completeNode: (id: string) => Promise<void>;
  dismissCelebration: () => void;
  clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const LS_USER = "vitality:user";
const localProfileKey = (userId: string) => `vitality:${userId}:profile`;
const localNodesKey = (userId: string) => `vitality:${userId}:nodes`;

function readLocal<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be full or blocked — in-memory state still works */
  }
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  friction: string | null;
  time_budget: string | null;
  space: string | null;
  level: number | null;
  xp: number | null;
  streak: number | null;
  last_completed_date: string | null;
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
    friction: row.friction ?? "",
    timeBudget: row.time_budget ?? "15",
    space: row.space ?? "bodyweight",
    xp: row.xp ?? 0,
    level: levelStats(row.xp ?? 0).level,
    streak: row.streak ?? 0,
    lastCompletedDate: row.last_completed_date ?? null,
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
    friction: profile.friction,
    time_budget: profile.timeBudget,
    space: profile.space,
    level: profile.level,
    xp: profile.xp,
    streak: profile.streak,
    last_completed_date: profile.lastCompletedDate,
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
      titleCase(user.email?.split("@")[0] ?? "Athlete"),
  };
}

function localUserFromEmail(email: string, name?: string): AppUser {
  return {
    id: `local-${email.trim().toLowerCase()}`,
    email: email.trim().toLowerCase(),
    name: name?.trim() || titleCase(email.split("@")[0]) || "Athlete",
  };
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
  if (lower.includes("password")) {
    return message;
  }
  return message;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [cloudEnabled] = useState(() => isSupabaseConfigured());
  const [mode, setMode] = useState<StorageMode>(() =>
    isSupabaseConfigured() ? "cloud" : "local",
  );
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

  const reflectLocal = useCallback(
    (userId: string | null, nextProfile: Profile | null, nextNodes: TreeNode[]) => {
      if (!userId) return;
      writeLocal(localProfileKey(userId), nextProfile);
      writeLocal(localNodesKey(userId), nextNodes);
    },
    [],
  );

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
        setError(
          `Could not load your Supabase profile (${profileError.message}). Check the database schema and RLS policies.`,
        );
        setProfile(null);
        setNodes([]);
        setLoading(false);
        return;
      }

      if (!row) {
        setProfile(null);
        setNodes([]);
        setLoading(false);
        return;
      }

      const loadedProfile = profileFromRow(row as ProfileRow);
      let loadedNodes: TreeNode[] = [];

      const { data: nodeData, error: nodesError } = await sb
        .from("nodes")
        .select("*")
        .eq("user_id", nextUser.id)
        .order("tier", { ascending: true });

      if (nodesError) {
        setError(
          `Could not load your skill tree (${nodesError.message}). Check that the "nodes" table exists.`,
        );
      } else if (nodeData && nodeData.length) {
        loadedNodes = nodesFromRows(nodeData as NodeRow[]);
      }

      if (!loadedNodes.length) {
        const generated = await generateTree({
          friction: loadedProfile.friction,
          timeBudget: loadedProfile.timeBudget,
          space: loadedProfile.space,
        });
        loadedNodes = buildNodes(generated.tree);
        setTreeSource(generated.source);
        await sb
          .from("nodes")
          .upsert(nodeRowsFor(nextUser.id, loadedNodes), {
            onConflict: "user_id,node_id",
          });
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
      const cachedUser = readLocal<AppUser>(LS_USER);
      if (cachedUser) {
        setUser(cachedUser);
        const cachedProfile = readLocal<Profile>(localProfileKey(cachedUser.id));
        const cachedNodes = readLocal<TreeNode[]>(localNodesKey(cachedUser.id));
        if (cachedProfile && cachedNodes && cachedNodes.length) {
          setProfile(cachedProfile);
          setNodes(cachedNodes);
        }
      }
      setLoading(false);
      return;
    }

    let mounted = true;
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

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
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

      setAuthBusy(true);
      setError(null);
      try {
        const sb = getSupabase();
        if (!sb) {
          const local = localUserFromEmail(cleanEmail);
          writeLocal(LS_USER, local);
          setUser(local);
          const cachedProfile = readLocal<Profile>(localProfileKey(local.id));
          const cachedNodes = readLocal<TreeNode[]>(localNodesKey(local.id));
          if (cachedProfile && cachedNodes?.length) {
            setProfile(cachedProfile);
            setNodes(cachedNodes);
          } else {
            setProfile(null);
            setNodes([]);
          }
          setMode("local");
          return {};
        }

        const { data, error: signInError } =
          await sb.auth.signInWithPassword({
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

      setAuthBusy(true);
      setError(null);
      try {
        const sb = getSupabase();
        if (!sb) {
          const local = localUserFromEmail(cleanEmail, name);
          writeLocal(LS_USER, local);
          setUser(local);
          setProfile(null);
          setNodes([]);
          setMode("local");
          return {};
        }

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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LS_USER);
      }
      hydrationRef.current = null;
      setUser(null);
      setProfile(null);
      setNodes([]);
      setCelebration(null);
      setError(null);
    }
  }, []);

  const saveTree = useCallback(
    async (nextProfile: Profile, nextNodes: TreeNode[]) => {
      reflectLocal(user?.id ?? null, nextProfile, nextNodes);
      if (!user || mode !== "cloud") return;
      const sb = getSupabase();
      if (!sb) return;

      const { error: profileError } = await sb
        .from("profiles")
        .upsert(profilePayload(user.id, nextProfile), { onConflict: "id" });
      if (profileError) {
        setError(
          `Supabase couldn't save your profile (${profileError.message}). Progress is kept on this device.`,
        );
        setMode("local");
        return;
      }

      const { error: nodesError } = await sb
        .from("nodes")
        .upsert(nodeRowsFor(user.id, nextNodes), {
          onConflict: "user_id,node_id",
        });
      if (nodesError) {
        setError(
          `Supabase couldn't save your tree (${nodesError.message}). Progress is kept on this device.`,
        );
        setMode("local");
      }
    },
    [mode, reflectLocal, user],
  );

  const submitOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      if (!user) return;
      setAuthBusy(true);
      setError(null);
      try {
        const generated = await generateTree(answers);
        const built = buildNodes(generated.tree);
        const nextProfile: Profile = {
          displayName: user.name || user.email.split("@")[0] || "Athlete",
          friction: answers.friction,
          timeBudget: answers.timeBudget,
          space: answers.space,
          level: 1,
          xp: 0,
          streak: 0,
          lastCompletedDate: null,
        };
        setTreeSource(generated.source);
        setProfile(nextProfile);
        setNodes(built);
        await saveTree(nextProfile, built);
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
      if (!profile) return;
      const result = completeNodeInTree(nodes, id);
      if (!result.target) return;

      const stats = levelStats(profile.xp + NODE_XP);
      const nextProfile: Profile = {
        ...profile,
        xp: profile.xp + NODE_XP,
        level: stats.level,
        streak: nextStreak(profile.lastCompletedDate, profile.streak),
        lastCompletedDate: todayKey(),
      };

      setProfile(nextProfile);
      setNodes(result.nodes);        setCelebration({
        id: Date.now(),
        title: result.target.title,
        xp: NODE_XP,
        levelUp: stats.level > profile.level ? stats.level : undefined,
        unlocked: Boolean(result.unlocked),
        nextTitle: result.unlocked?.title ?? null,
      });

      await saveTree(nextProfile, result.nodes);
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
        mode,
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
