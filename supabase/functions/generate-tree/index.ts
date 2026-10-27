// Supabase Edge Function: generate-tree
// Deploy ONLY after approval:
//   supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-flash
//   supabase functions deploy generate-tree
// Never put keys in this file or in the app bundle.

import {
  assessGoal,
  genericFiller,
  repeatedStep,
  validatePracticeText,
  validateStepsWithinBudget,
} from "./safety-rules.ts";

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
  focus?: string;
  branch?: string;
  startingPoint?: string;
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

const STAGES: Record<string, string> = {
  nothing:
    "starting from nothing — the first version does not exist yet. Week 1 has to remove the biggest unknown before anything is built.",
  exists:
    "something already exists — it is unfinished, unlaunched or not yet used. Week 1 starts from what they have, not from a blank page.",
  practice:
    "no artefact to make; they want to do more of something, do it better, or feel different. Week 1 measures where they are now.",
};
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

/**
 * The spine of a making goal, spelled out by artefact. Without this the model
 * writes four weeks of "work on it", which is why plans read as advice about
 * being productive rather than a plan for the thing being made.
 */
const ARTEFACT_ARCS = `
- app / website / software: the problem and the people who have it, then one screen working end to end, then five people using it, then fixing the one thing that stopped them and putting a build somewhere it can be installed.
- book / essay / newsletter: the promise and who it is for, then five hundred finished words, then one honest reader, then the revision their notes demand.
- course / podcast / channel: the promise and the audience, then the first lesson or episode finished, then three real listeners, then fixing the weakest part and publishing on a schedule.
- business / service / product: ten people with the problem, then the offer written on one page, then one pilot or paying customer, then delivering it and fixing the promise that was hardest to keep.
- skill being learned: a baseline test, then the repeatable session, then using it in front of somebody, then teaching it back or passing the real test.`;

function buildingBlock(branch: string) {
  if (branch !== "craft") return "";
  return `
THE ARC FOR WHAT THEY ARE MAKING — pick the line that matches, and make the four craft stages its four steps
${ARTEFACT_ARCS}
For a building goal the other three branches keep the job they have: body is the routine that makes a thirty-day build survivable, mind is the research and the decisions, connection is the people it is for. A step is only useful if it would change what the person does today.
`;
}


function buildPrompt(
  p: {
    identity: string;
    goal: string;
    blocker: string;
    timeBudget: string;
    focus: string;
    branch: string;
    stage: string;
  },
  history: History | null,
) {
  return `You are the plan writer for a 30-day habit app. You are writing one specific person's plan, not a plan for a category of person. Return JSON only.

WHO THIS IS
- Becoming: ${p.identity}
- Their 30-day goal, in their own words: "${p.goal}"
- Where they are starting: ${p.stage}
- What gets in the way on a bad day: ${p.blocker}
- Time available per day: ${p.timeBudget} minutes. Nothing you write may ask for longer.
- This goal reads as: ${p.focus}
- The daily practice sits on the ${p.branch} branch${p.branch === "craft" ? " — they are making something, so the plan is about building it, not about their own health or habits" : ""}.
${historyBlock(history)}
STEP 1 — WORK OUT WHAT THIS GOAL ACTUALLY TAKES, BEFORE YOU WRITE A PRACTICE (returned as "brief")
Five short lines, each concrete, no encouragement:
- "outcome": what exists or is true on day 30 that is not true today.
- "method": how this is really done, named — the approach a good coach or practitioner would use for this exact goal (walk-run intervals for a first 5K; one screen tested by five people for an app; spaced recall for vocabulary). Use what is genuinely known. Never invent a statistic, study or citation: when you are unsure, name the action instead of asserting a fact.
- "week_one": what someone who has done this before would do in the first seven days, as acts.
- "trap": the specific way this goal usually fails, and the smallest countermeasure.
- "research": the two or three things they must find out for this plan to work, and exactly where to look — which documentation, which three people to ask, which competitor's onboarding, which coach or course. Empty only when the goal needs no research.

STEP 2 — THE BRIEF DRIVES THE PLAN
Outcome shapes week 4. Week_one shapes week 1. The trap shapes the two-minute version. The research becomes real steps on the mind branch, naming the source. If a step would still make sense under a different brief, it is filler: replace it.

STEP 3 — THE PRIMARY BRANCH IS THE SPINE: FOUR DELIBERATELY DIFFERENT STAGES
${p.branch.toUpperCase()} carries the goal itself, and its four nodes are the four stages below, each handing the next one something it needs. Never repeat stage 1 with a bigger number.
1. find out — the reading, decision, conversation or test that removes the biggest unknown. Name what to read, who to ask, what to try.
2. the smallest real version — the first thing that works end to end, small enough to finish in one week.
3. the real world — a tester, a reader, the actual distance, the coach's eyes, the first session in front of someone.
4. respond — fix the one thing stage 3 taught them, or finish the thing that now exists.
A goal with no artefact (train, practise, learn, feel better) keeps the same four stages: measure where you are, the repeatable session, the harder real-world version, proof that it held.
${buildingBlock(p.branch)}
THE OTHER THREE BRANCHES ARE SUPPORT: ONE PRACTICE, DEEPENING
Each is one honest practice that makes the spine possible — the same act one step further each week, never a different activity. Each node still fits inside ${p.timeBudget} minutes and is comfortable on a bad day.
- body: the physical side of this exact work — the walk that untangles the problem, forearm and shoulder work before a long session at the desk, the easy shake-out after a hard effort. Never a generic stretch.
- mind: attention and knowledge for this goal — the specific chapter, the specific documentation page, thirty minutes without a screen, an honest look at last week's actual work.
- connection: the real people — one tester, one honest reader, one training partner, one person who asks how it is going.
If a branch has no obvious link, find the honest one and still name their real materials. No step may be interchangeable with a step on another branch.

HOW A STEP IS WRITTEN — the difference from a generic plan is information, not tone
A step is one physical or on-screen action this person could take tomorrow with what they already have, in words they would use, at most 18 words.
Every step names the concrete thing: the screen, form, endpoint, file, chapter, route, lift, ingredient, person, place or number.
Apply this test to every step: could it appear in someone else's plan for a different goal? If yes, rewrite it until it could only be theirs.
Never write these, which fit any goal and therefore help nobody: "open the editor", "edit a file", "write five lines", "work on your project", "make progress", "do some research", "save your progress", "review your notes", "check in with yourself", "reflect on your progress", "stay consistent", "be kind to yourself", "reset your shoulders".
Never make "consider", "think about", "explore" or "try to" the action.
When the goal is to make something, the subject of the plan is that artefact. Do not convert it into the person's own diet, sleep or exercise routine just because the artefact mentions food, running or health.

WORKED PAIRS — a lazy draft and the same line written properly
Goal: build an app that helps people eat healthier.
- WRONG: "Open the editor and write 5 lines." RIGHT: "Sketch the one screen the app opens to and list the three things on it."
- WRONG: "Do some research on the market." RIGHT: "Message three people who used a food-tracking app and ask what made them stop."
- WRONG: "Work on your project for 15 minutes." RIGHT: "Fix the meal-logging step two of your three testers got stuck on, then send them build 2."
Goal: run 5K without stopping.
- WRONG: "Go for a run and push yourself." RIGHT: "Walk 2 minutes, jog 1, repeat six times, and stop while you could still talk."
- Week 4: "Run the full 5K route at easy pace and note where your breathing broke first."

EACH BRANCH ALSO NEEDS A TWO-MINUTE VERSION
"easy" is the smallest honest version of that branch's week-1 practice: one to three steps, no setup, no equipment, no decisions. Its own action, not the full node cut in half.

WHAT THE PERSON SEES FIRST
The summary is shown as the promise of the plan, above the practices. It must say what will exist at the end of these 30 days that does not exist now, plus the smallest daily act that gets them there — specific enough that a stranger could tell what they are building or training for. The first step of each branch is shown as "your first action", and the week-4 node as "where this leads", so both must stand alone.

JSON — exactly this shape, nothing around it. Write "brief" first: the plan must follow it.
{"brief":{"outcome":"max 140 characters","method":"max 160","week_one":"max 160","trap":"max 140","research":["one to three entries, max 120 each, or empty"]},
 "summary":"what will exist at the end of 30 days that does not exist now, plus the smallest daily act that gets them there; max 300 characters; plain language; no vague encouragement",
 "safetyNote":"max 240 characters; pacing and stopping; no medical advice",
 "pillars":[
  {"pillar":"body","focus":"max 48 characters — the specific angle this goal gives the body branch",
   "easy":{"title":"max 70 characters","steps":["one to three actions, max 18 words each"]},
   "nodes":[{"title":"max 70","duration":"N min","description":"the gain this act produces for their goal, named plainly; max 200 characters","instructions":["two to five actions, max 18 words each"]}, ...four nodes]},
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
  const branchSteps: { name: string; steps: string[] }[] = [];
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
      branchSteps.push({ name: `the ${order[index]} branch`, steps });
    }
  }
  // A step copied across branches was not written for either of them.
  const repeated = repeatedStep(branchSteps);
  if (repeated) return `repeated step: ${repeated.step}`;
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
  const focus = scrubPii(String(body.focus ?? "")).slice(0, 48);
  const branch = ["body", "mind", "craft", "connection"].includes(String(body.branch))
    ? String(body.branch)
    : "craft";
  const stageKey = String(body.startingPoint ?? "");
  // Anything the client sends is a hint, not a claim: unknown values fall back
  // to the one that makes no assumption about what already exists.
  const stage = STAGES[stageKey] ?? STAGES.nothing;

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
  const prompt = buildPrompt(
    { identity, goal, blocker, timeBudget, focus: focus || "a personal practice", branch, stage },
    readHistory(body.history),
  );
  const budget = Number(timeBudget);

  // One controlled retry. A draft rejected for placeholder wording or a step
  // reused across branches is retried with that named as a correction, because
  // resending the same prompt tends to reproduce the same wording. Any other
  // rejection is retried unchanged, then the client falls back to the local
  // library.
  const FILLER_PREFIX = "generic filler: ";
  const REPEAT_PREFIX = "repeated step: ";
  let correction = "";
  // Tells the client whether to say "the draft was rejected" or "we could not
  // reach the model", which are different problems for the person to act on.
  let sawDraft = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let tree: unknown = null;
    const attemptPrompt = correction ? `${prompt}\n\nCORRECTION FOR THIS ATTEMPT\n${correction}` : prompt;
    try { tree = await callModel(attemptPrompt, apiKey, model); } catch { tree = null; }
    if (tree) {
      sawDraft = true;
      const problem = validateTree(tree, budget);
      if (!problem) return respond(tree, 200);
      console.error("Rejected model output", { problem });
      if (problem.startsWith(FILLER_PREFIX)) {
        correction = `The previous draft used placeholder wording ("${problem.slice(FILLER_PREFIX.length)}"), which fits any goal and therefore helps nobody. Rewrite every practice and step so it names this person's actual screens, files, tools, subjects or people. Do not use that wording again.`;
      } else if (problem.startsWith(REPEAT_PREFIX)) {
        correction = `The previous draft reused the same instruction on more than one branch ("${problem.slice(REPEAT_PREFIX.length)}"). Each branch must do a different job: the primary branch advances the goal through its four stages, body serves the work, mind serves the knowledge, connection serves the people. Rewrite the duplicated branch.`;
      }
    }
  }

  return sawDraft
    ? respond({ error: "The plan could not be drafted safely. A local plan is ready instead." }, 502)
    : respond({ error: "Plan drafting is unavailable right now." }, 503);
});
