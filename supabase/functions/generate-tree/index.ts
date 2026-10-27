// Supabase Edge Function: generate-tree
// Deploy ONLY after approval:
//   supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash
//   supabase functions deploy generate-tree
// Never put keys in this file or in the app bundle.

import { assessGoal, validatePracticeText, validateStepsWithinBudget } from "./safety-rules.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const MAX_BODY_BYTES = 8192;
const DAILY_LIMIT = 20;
const TIMEOUT_MS = 15_000;

interface RequestPayload {
  identity?: string;
  goal?: string;
  blocker?: string;
  timeBudget?: string;
  history?: unknown;
}

interface History {
  seasons: number;
  daysPractised: number;
  daysPlanned: number;
  kept: string[];
  dropped: string[];
  averageEffort: number | null;
  lastReview: string | null;
}

/** Everything the client sends is untrusted: clamp it to a fixed, small shape. */
function readHistory(raw: unknown): History | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const count = (input: unknown, max: number) => {
    const number = Number(input);
    return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.round(number))) : 0;
  };
  const titles = (input: unknown) =>
    Array.isArray(input)
      ? input
          .filter((item): item is string => typeof item === "string")
          .map((item) => scrubPii(item).slice(0, 60))
          .slice(0, 2)
      : [];
  const effort = Number(value.average_effort);
  const daysPractised = count(value.days_practised, 400);
  if (!daysPractised) return null;
  return {
    seasons: Math.max(1, count(value.seasons, 50)),
    daysPractised,
    daysPlanned: Math.max(1, count(value.days_planned, 400)),
    kept: titles(value.kept),
    dropped: titles(value.dropped),
    averageEffort:
      Number.isFinite(effort) && effort >= 1 && effort <= 5 ? Math.round(effort * 10) / 10 : null,
    lastReview:
      typeof value.last_review === "string" ? scrubPii(value.last_review).slice(0, 140) : null,
  };
}

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
function scrubPii(input: string): string {
  return input
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]")
    .replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted-phone]")
    .replace(/(^|\s)@[a-zA-Z0-9_.-]+/g, "$1[person]")
    .trim();
}

// @ts-expect-error Deno global is provided by the Edge Runtime
const env = (key: string) => Deno.env.get(key)?.trim() ?? "";

async function verifyCaller(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: authorization },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === "string" ? { id: user.id as string, authorization } : null;
}

async function rest<T>(path: string, authorization: string, init: RequestInit = {}): Promise<T | null> {
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env("SUPABASE_ANON_KEY"),
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

/**
 * Placeholder steps that fit every goal therefore help none. They are the exact
 * wording the engine used to fall back on, and the reason plans read as generic.
 * Rejecting them makes "specific" a rule the server enforces, not a hope.
 */
const GENERIC_FILLER: [RegExp, string][] = [
  [/\bedit (a|the) file\b/i, "edit a file"],
  [/\bwork on your (project|goal)\b/i, "work on your project"],
  [/\b(reset|roll) your shoulders\b/i, "reset your shoulders"],
  [/\bcheck in with yourself\b/i, "check in with yourself"],
  [/\breflect on your (progress|day|journey)\b/i, "reflect on your progress"],
];

function genericFiller(text: string): string | null {
  return GENERIC_FILLER.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function historyBlock(history: History | null) {
  if (!history) return "- This is their first season. Write for someone starting from zero.\n";
  const lines = [
    "WHAT ACTUALLY HAPPENED LAST SEASON — adapt to it, never repeat it blindly",
    `- They practised ${history.daysPractised} of ${history.daysPlanned} days.`,
  ];
  if (history.kept.length) lines.push(`- Practices that stuck: ${history.kept.join("; ")}.`);
  if (history.dropped.length) lines.push(`- Practices that never happened: ${history.dropped.join("; ")}.`);
  if (history.averageEffort !== null) lines.push(`- Effort, 1 easy to 5 very hard: ${history.averageEffort}.`);
  if (history.lastReview) lines.push(`- In their own words: "${history.lastReview}".`);
  lines.push(
    history.daysPractised / Math.max(1, history.daysPlanned) < 0.4
      ? "- Few days happened. Make week 1 genuinely smaller than last time and name the one thing that blocked it."
      : "- Most days happened. Start at the level they earned and build up from there.",
    "- Keep what stuck, and replace or shrink anything that never happened. Do not offer the same practice again unchanged.",
  );
  return `${lines.join("\n")}\n`;
}

function buildPrompt(p: { identity: string; goal: string; blocker: string; timeBudget: string }, history: History | null) {
  return `You are the plan writer for a 30-day habit app. You are writing one specific person's plan, not a plan for a category of person. Return JSON only.

WHO THIS IS
- Becoming: ${p.identity}
- Their 30-day goal, in their words: "${p.goal}"
- What gets in the way on a bad day: ${p.blocker}
- Time available per day: ${p.timeBudget} minutes. Nothing you write may ask for longer.
${historyBlock(history)}
HOW TO WRITE A STEP — this is the whole job
A step is a physical or on-screen action this person could take tomorrow with things they already have, described in words they would use.
Every practice and every step must name the real thing: the actual screen, file, instrument, chapter, place or person.
Never write anything that would fit any goal: "edit a file", "work on your project", "reset your shoulders", "take a breath", "check in with yourself", "reflect on your progress", "review your notes". If you catch yourself writing a placeholder, replace it with the specific act a good coach would name for this goal.
If a branch does not obviously touch their goal, find the honest link and still name their real materials. For a mental, study or craft goal the Body practice must serve that goal — a walk while rehearsing the exact loop they have to write, ten minutes of posture work before a long session at their desk — never a generic stretch or breath. For a physical goal, Mind and Connection must still name their actual training, kit and people.

FOUR BRANCHES, FOUR WEEKS — the shape is a ramp
body, mind, craft, connection, in that order. Four nodes each.
- Node 1 is week 1: the smallest real version of that branch's practice. Repeatable tomorrow, comfortable on a bad day, inside ${p.timeBudget} minutes.
- Node 2 is week 2: the same practice, one concrete step further. Node 3 is week 3. Node 4 is week 4.
- Each node must be recognisably the same practice as the one before it, harder or more specific — never a different activity.
- Make the ramp visible: the week-4 node should be something they could not have done in week 1.

EACH BRANCH ALSO NEEDS A TWO-MINUTE VERSION
"easy" is the smallest honest version of that branch's week-1 practice: one to three steps, no setup, no equipment, no decisions. It is its own action, not the full node cut in half.

JSON — exactly this shape, nothing around it:
{"summary":"what these 30 days build and why it fits this person; max 300 characters; plain language",
 "safetyNote":"max 240 characters; pacing and stopping; no medical advice",
 "pillars":[
  {"pillar":"body","focus":"max 48 characters — the specific angle this goal gives the body branch",
   "easy":{"title":"max 70 characters","steps":["one to three actions, max 18 words each"]},
   "nodes":[{"title":"max 70","duration":"N min","description":"why this, for this person; max 200 characters","instructions":["two to five actions, max 18 words each"]}, ...four nodes]},
  ...mind, craft, connection]}

Hard limits: steps name actions only, never "consider", "think about", "reflect on" or "explore". No calorie counts, weight targets, fasting, sleep restriction, substances or medical advice. No shame, no "discipline", no "no excuses". Never describe yourself or the app. Output JSON only.`;
}

function validateTree(raw: unknown, budget: number): string | null {
  if (!raw || typeof raw !== "object") return "not an object";
  const tree = raw as { summary?: unknown; safetyNote?: unknown; pillars?: unknown };
  if (typeof tree.summary !== "string" || tree.summary.length < 10 || tree.summary.length > 300) return "bad summary";
  if (typeof tree.safetyNote !== "string" || tree.safetyNote.length > 240) return "bad safety note";
  if (!Array.isArray(tree.pillars) || tree.pillars.length !== 4) return "wrong pillar count";
  const order = ["body", "mind", "craft", "connection"];
  for (const [index, rawPillar] of tree.pillars.entries()) {
    const pillar = rawPillar as { pillar?: unknown; focus?: unknown; nodes?: unknown; easy?: unknown };
    if (pillar?.pillar !== order[index]) return "wrong pillar order";
    if (typeof pillar.focus !== "string" || pillar.focus.length > 48) return "bad focus";
    if (!Array.isArray(pillar.nodes) || pillar.nodes.length !== 4) return "wrong node count";
    // The two-minute version is validated when present. A model that omits it
    // still returns a usable, personalised ladder; the client then derives the
    // two-minute entry point from the first step instead of losing the whole plan.
    const easy = pillar.easy as { title?: unknown; steps?: unknown } | undefined;
    if (easy !== undefined && easy !== null) {
      if (typeof easy !== "object") return "bad easy version";
      if (typeof easy.title !== "string" || easy.title.length < 3 || easy.title.length > 70) return "bad easy title";
      if (!Array.isArray(easy.steps) || easy.steps.length < 1 || easy.steps.length > 3) return "bad easy steps";
      const easySteps = easy.steps.filter((step): step is string => typeof step === "string");
      if (easySteps.length !== easy.steps.length) return "bad easy step type";
      if (easySteps.some((step) => step.length > 180)) return "easy step too long";
      const easySafety = validateStepsWithinBudget(easySteps, Math.min(2, budget));
      if (!easySafety.ok) return easySafety.problem ?? "unsafe easy version";
    }
    for (const rawNode of pillar.nodes) {
      const node = rawNode as { title?: unknown; duration?: unknown; description?: unknown; instructions?: unknown };
      if (typeof node.title !== "string" || node.title.length < 3 || node.title.length > 70) return "bad title";
      if (typeof node.description !== "string" || node.description.length < 10 || node.description.length > 200) return "bad description";
      if (typeof node.duration !== "string") return "bad duration";
      const minutes = Number(node.duration.match(/(\d+)/)?.[1] ?? 0);
      if (!minutes || minutes > budget) return "duration over budget";
      if (!Array.isArray(node.instructions) || node.instructions.length < 2 || node.instructions.length > 5) return "bad steps";
      const steps = node.instructions.filter((step): step is string => typeof step === "string");
      if (steps.length !== node.instructions.length) return "bad step type";
      if (steps.some((step) => step.length > 180)) return "step too long";
      const safety = validatePracticeText(`${node.title} ${node.description} ${steps.join(" ")}`);
      if (!safety.ok) return safety.problem ?? "unsafe text";
      const filler = genericFiller(`${node.title} ${steps.join(" ")}`);
      if (filler) return `generic filler: ${filler}`;
      const budgetCheck = validateStepsWithinBudget(steps, budget);
      if (!budgetCheck.ok) return budgetCheck.problem ?? "steps over budget";
    }
  }
  return null;
}

async function callModel(prompt: string, apiKey: string, model: string) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch { return null; }
}

// @ts-expect-error Deno global is provided by the Edge Runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const caller = await verifyCaller(req).catch(() => null);
  if (!caller) return respond({ error: "Sign in to draft a plan." }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return respond({ error: "That request is too large." }, 413);

  let body: RequestPayload;
  try { body = JSON.parse(raw) as RequestPayload; } catch { return respond({ error: "Invalid request." }, 400); }

  const identity = String(body.identity ?? "creator").slice(0, 32);
  const goal = scrubPii(String(body.goal ?? "").trim()).slice(0, 140);
  const blocker = String(body.blocker ?? "consistency").slice(0, 40);
  const timeBudget = ["5", "15", "30"].includes(String(body.timeBudget)) ? String(body.timeBudget) : "15";

  const verdict = assessGoal(goal);
  if (verdict.kind === "decline") return respond({ error: verdict.message ?? "That goal cannot be supported." }, 400);
  if (verdict.kind === "support" && verdict.support === "self-harm") {
    return respond({ error: verdict.message ?? "Please reach out for support." }, 400);
  }

  const profile = await rest<{ ai_consent_version: string | null; ai_consent_at: string | null }[]>(
    `profiles?select=ai_consent_version,ai_consent_at&id=eq.${caller.id}`,
    caller.authorization,
  ).catch(() => null);
  if (!profile?.length || !profile[0].ai_consent_at || !profile[0].ai_consent_version) {
    return respond({ error: "AI suggestions need your permission first." }, 403);
  }

  const quota = await rest<boolean>("rpc/consume_generation_quota", caller.authorization, {
    method: "POST",
    body: JSON.stringify({ p_limit: DAILY_LIMIT }),
  }).catch(() => null);
  if (quota === false) return respond({ error: "You have reached today's plan limit. The on-device plan still works." }, 429);

  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) return respond({ error: "Plan drafting is unavailable right now." }, 503);

  const model = env("GEMINI_MODEL") || "gemini-2.5-flash";
  const prompt = buildPrompt({ identity, goal, blocker, timeBudget }, readHistory(body.history));
  const budget = Number(timeBudget);

  // One controlled retry. A rejected draft that failed on filler is retried with
  // that named as a correction, because resending the same prompt repeats the
  // same wording; any other rejection is retried unchanged, then the client falls
  // back to the local library.
  const FILLER_PREFIX = "generic filler: ";
  let correction = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let tree: unknown = null;
    const attemptPrompt = correction ? `${prompt}\n\nCORRECTION FOR THIS ATTEMPT\n${correction}` : prompt;
    try { tree = await callModel(attemptPrompt, apiKey, model); } catch { tree = null; }
    if (tree) {
      const problem = validateTree(tree, budget);
      if (!problem) return respond(tree, 200);
      console.error("Rejected model output", { problem });
      if (problem.startsWith(FILLER_PREFIX)) {
        correction = `The previous draft used placeholder wording ("${problem.slice(FILLER_PREFIX.length)}"), which fits any goal and therefore helps nobody. Rewrite every practice and step so it names this person's actual screens, files, tools, subjects or people. Do not use that wording again.`;
      }
    }
  }

  return respond({ error: "The plan could not be drafted safely. A local plan is ready instead." }, 502);
});
