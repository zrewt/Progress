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
const MAX_BODY_BYTES = 4096;
const DAILY_LIMIT = 20;
const TIMEOUT_MS = 15_000;

interface RequestPayload { identity?: string; goal?: string; blocker?: string; timeBudget?: string }

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

function buildPrompt(p: Required<RequestPayload>) {
  return `You are designing a gentle 30-day plan for a self-improvement app. Return JSON only.

Person:
- Becoming: ${p.identity}
- Goal: "${p.goal}"
- Usual obstacle: ${p.blocker}
- Daily budget: ${p.timeBudget} minutes

Return exactly:
{"summary":"...","safetyNote":"...","pillars":[{"pillar":"body","focus":"...","nodes":[{"title":"...","duration":"5 min","description":"...","instructions":["...","...","..."]}]}]}

Rules:
- Exactly 4 pillars: body, mind, craft, connection, in that order, 4 nodes each.
- Each node's duration must not exceed ${p.timeBudget} minutes.
- Steps are concrete actions of at most 18 words. Never state a time longer than the budget.
- No calorie numbers, weight targets, fasting, sleep restriction, substances, or medical advice.
- No shaming, no "discipline", no "no excuses".`;
}

function validateTree(raw: unknown, budget: number): string | null {
  if (!raw || typeof raw !== "object") return "not an object";
  const tree = raw as { summary?: unknown; safetyNote?: unknown; pillars?: unknown };
  if (typeof tree.summary !== "string" || tree.summary.length < 10 || tree.summary.length > 300) return "bad summary";
  if (typeof tree.safetyNote !== "string" || tree.safetyNote.length > 240) return "bad safety note";
  if (!Array.isArray(tree.pillars) || tree.pillars.length !== 4) return "wrong pillar count";
  const order = ["body", "mind", "craft", "connection"];
  for (const [index, rawPillar] of tree.pillars.entries()) {
    const pillar = rawPillar as { pillar?: unknown; focus?: unknown; nodes?: unknown };
    if (pillar?.pillar !== order[index]) return "wrong pillar order";
    if (typeof pillar.focus !== "string" || pillar.focus.length > 48) return "bad focus";
    if (!Array.isArray(pillar.nodes) || pillar.nodes.length !== 4) return "wrong node count";
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
  const prompt = buildPrompt({ identity, goal, blocker, timeBudget });
  const budget = Number(timeBudget);

  // One controlled retry, then the client falls back to the local library.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let tree: unknown = null;
    try { tree = await callModel(prompt, apiKey, model); } catch { tree = null; }
    if (tree) {
      const problem = validateTree(tree, budget);
      if (!problem) return respond(tree, 200);
      console.error("Rejected model output", { problem });
    }
  }

  return respond({ error: "The plan could not be drafted safely. A local plan is ready instead." }, 502);
});
