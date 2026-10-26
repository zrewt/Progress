// Supabase Edge Function: generate-tree
// Runs server-side on Deno so GEMINI_API_KEY never touches the mobile or web bundle.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your_key_here
//   supabase functions deploy generate-tree

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface RequestPayload {
  identity?: string;
  goal?: string;
  blocker?: string;
  timeBudget?: string;
}

const UNSAFE_GOAL_PATTERN =
  /\b(starv(e|ing|ation)|0 calories|zero calories|500 calories|purge|purging|self[- ]?harm|hurt myself|cut myself|suicid|kill myself|(?:stop|not) eating\s+(?:anything|at all|food|ever))\b/i;

function scrubPii(input: string): string {
  return input
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted-email]")
    .replace(
      /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[redacted-phone]",
    )
    .replace(/(^|\s)@[a-zA-Z0-9_.-]+/g, "$1[person]")
    .trim();
}

function buildServerPrompt(payload: Required<RequestPayload>) {
  return `You are an expert behavioral scientist and self-improvement coach designing a safe, personalized 30-day Starting Seed Tree for a young adult.

User profile:
- Identity they are becoming: ${payload.identity}
- 30-day goal: "${payload.goal}"
- Main friction / obstacle: ${payload.blocker}
- Daily time budget: ${payload.timeBudget} minutes

How to structure the response:
1. "summary": One warm, specific sentence explaining how this 4-branch Starting Seed Plan helps them achieve "${payload.goal}" while overcoming "${payload.blocker}".
2. "safetyNote": One short sentence reminding them of safe pacing (e.g., starting with 2-minute seeds, protecting rest, never pushing through sharp pain or burnout).
3. "pillars": Exactly 4 branches in this order:
   - "body" (energy, movement, rest that supports "${payload.goal}")
   - "mind" (focus, learning, calm that overcomes "${payload.blocker}")
   - "craft" (direct skill practice and output for "${payload.goal}")
   - "connection" (accountability, environment, and people supporting "${payload.goal}")
   For each branch, include:
   - "focus": A 2-4 word goal-tailored subtitle (e.g., "Voice & Breath", "Daily Code Output").
   - "nodes": Exactly 4 progressive actions from Tier 0 (Seed) to Tier 3 (Canopy):
     * Tier 0 (Seed): 1-3 minute micro-action that is impossible to fail on a low-energy day.
     * Tier 1 (Root): 3-8 minute foundational habit.
     * Tier 2 (Branch): 5-15 minute deliberate practice (never exceeding ${payload.timeBudget} min).
     * Tier 3 (Canopy): Capstone ritual within ${payload.timeBudget} min.

Safety & Quality Rules:
- Never prescribe extreme dieting, sleep deprivation, unsafe exertion, substances, gambling, or medical advice.
- Every action must directly support "${payload.goal}" and counter "${payload.blocker}".
- Instructions must be 3 concrete, immediately actionable steps (max 18 words each).

Return ONLY valid JSON matching this exact shape:
{
  "summary": "...",
  "safetyNote": "...",
  "pillars": [
    {
      "pillar": "body",
      "focus": "...",
      "nodes": [
        {
          "title": "...",
          "duration": "2 min",
          "description": "...",
          "instructions": ["step 1", "step 2", "step 3"]
        }
      ]
    }
  ]
}`;
}

// @ts-expect-error Deno global is provided by Supabase Edge Runtime
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = (await req.json()) as RequestPayload;
    const identity = String(body.identity ?? "creator").slice(0, 32);
    const goal = scrubPii(String(body.goal ?? "").trim()).slice(0, 140);
    const blocker = String(body.blocker ?? "consistency").slice(0, 40);
    const timeBudget = ["5", "15", "30"].includes(String(body.timeBudget))
      ? String(body.timeBudget)
      : "15";

    if (goal.length < 3 || UNSAFE_GOAL_PATTERN.test(goal)) {
      return new Response(
        JSON.stringify({
          error:
            "Goal did not pass safety check. Please choose a safe, constructive 30-day goal.",
        }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // @ts-expect-error Deno env
    const apiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
    // @ts-expect-error Deno env
    const preferredModel = Deno.env.get("GEMINI_MODEL")?.trim();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: "GEMINI_API_KEY secret is not set on the Edge Function.",
        }),
        { status: 501, headers: CORS_HEADERS },
      );
    }

    // Free-tier compatible lightweight Flash models in priority order.
    const candidateModels = [
      ...(preferredModel ? [preferredModel] : []),
      "gemini-3.8-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
    ];

    const requestBody = JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildServerPrompt({
                identity,
                goal,
                blocker,
                timeBudget,
              }),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    let geminiRes: Response | null = null;
    let lastErrorText = "";

    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
      if (res.ok) {
        geminiRes = res;
        break;
      }
      lastErrorText = await res.text();
      // If rate-limited (429) or unauthorized (401/403), stop trying other models and let client use Seed Engine.
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        geminiRes = res;
        break;
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Upstream model error (${geminiRes?.status ?? 502})`,
          details: lastErrorText.slice(0, 200),
        }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    const data = await geminiRes.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = rawText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Failed to generate tree",
      }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
