import { BLOCKER_MAP, PILLARS, labelForIdentity } from "./pillars";
import {
  assessGoalSafety,
  clampDurationToBudget,
  sanitizeGeneratedNode,
  scrubGoalForPrivacy,
} from "./safety";
import { getSupabase } from "./supabase";
import type {
  BlockerId,
  GeneratedNode,
  GeneratedTree,
  IdentityId,
  OnboardingAnswers,
  PillarId,
} from "./types";

export type TreeSource = "edge-ai" | "seed-engine";

export interface TreeResult {
  tree: GeneratedTree;
  source: TreeSource;
}

type GoalTheme =
  | "running"
  | "strength"
  | "sleep"
  | "nutrition"
  | "coding"
  | "writing"
  | "reading"
  | "speaking"
  | "language"
  | "general";

function detectGoalTheme(goal: string, identity: IdentityId): GoalTheme {
  const lower = goal.toLowerCase();
  if (
    /\b(eat|eating|snack|snacking|sugar|junk|diet|kitchen|meal|late[- ]?night|water|hydrat)\b/.test(
      lower,
    )
  ) {
    return "nutrition";
  }
  if (/\b(run|5k|10k|jog|cardio|mile|marathon|walk)\b/.test(lower)) {
    return "running";
  }
  if (/\b(sleep|recover|rest|wake|bed|insomnia)\b/.test(lower)) {
    return "sleep";
  }
  if (/\b(strength|strong|lift|push-?up|gym|workout|muscle|move my body)\b/.test(lower)) {
    return "strength";
  }
  if (/\b(code|coding|program|app|project|ship|software|build|launch)\b/.test(lower)) {
    return "coding";
  }
  if (/\b(writ(e|ing)|journal|blog|essay|publish|post|content|sketch|draw|create)\b/.test(lower)) {
    return "writing";
  }
  if (/\b(read|book|study|course|exam|learn)\b/.test(lower)) {
    return "reading";
  }
  if (/\b(speak|class|social|confiden|talk|present|voice)\b/.test(lower)) {
    return "speaking";
  }
  if (/\b(language|spanish|french|japanese|vocab|fluency)\b/.test(lower)) {
    return "language";
  }
  if (identity === "athlete") return "strength";
  if (identity === "scholar") return "reading";
  if (identity === "builder") return "coding";
  return "writing";
}

function blockerStep(blocker: BlockerId): string {
  switch (blocker) {
    case "distraction":
      return "Set your phone in another room or face-down out of reach before starting.";
    case "overthinking":
      return "Do not plan or edit — start the timer and take the very first action within 10 seconds.";
    case "energy":
      return "Keep the effort at 60% so you finish with more energy than you started with.";
    case "time":
      return "Attach the practice to a slot you already keep — after a meal or before a shower — never to leftover time.";
    case "stress":
      return "Keep the easiest version ready for low days; a two-minute day still counts completely.";
    case "perfectionism":
      return "Stop at two minutes even when it is going well, so finishing stays easy to repeat.";
    case "consistency":
    default:
      return "Stop on time while it still feels easy so tomorrow's repetition is automatic.";
  }
}

interface ThemeBranchTemplate {
  focus: string;
  nodes: {
    title: string;
    minutes: number;
    description: string;
    steps: [string, string];
  }[];
}

function templatesForTheme(
  theme: GoalTheme,
  goal: string,
): Record<PillarId, ThemeBranchTemplate> {
  const shortGoal = goal.trim() || "your 30-day goal";

  const commonBody: ThemeBranchTemplate = {
    focus: "Energy & Physical Readiness",
    nodes: [
      {
        title: "Two-Minute Posture & Breath Reset",
        minutes: 2,
        description: `Wake up your nervous system so you have clean energy for "${shortGoal}".`,
        steps: [
          "Stand up, roll your shoulders back, and take 4 slow nasal breaths.",
          "Reach overhead for 20 seconds, then shake out your hands and jaw.",
        ],
      },
      {
        title: "Ten-Minute Daylight Walk",
        minutes: 10,
        description: `A brisk walk outside to clear mental fog before working on "${shortGoal}".`,
        steps: [
          "Step outside for a 10-minute walk at a conversational pace.",
          "Keep your eyes on the horizon and let your mind settle on today's single priority.",
        ],
      },
      {
        title: "Steady Movement Circuit",
        minutes: 12,
        description: "Build baseline stamina so your body supports your daily focus.",
        steps: [
          "Cycle through 8 squats, 6 incline push-ups, and a 20-second plank for 3 easy rounds.",
          "Breathe steadily through your nose and keep 2 reps in reserve.",
        ],
      },
      {
        title: "Evening Wind-Down & Recovery",
        minutes: 15,
        description: "Protect tomorrow's energy with a deliberate physical off-switch.",
        steps: [
          "Dim the lights and spend 5 minutes stretching your hips, back, and neck.",
          "Drink a glass of water and set out what you need for tomorrow morning.",
        ],
      },
    ],
  };

  if (theme === "nutrition") {
    return {
      body: {
        focus: "Evening Reset & Steady Energy",
        nodes: [
          {
            title: "Kitchen-Closed Herbal Tea or Water Seed",
            minutes: 2,
            description: `A calm 2-minute physical cue that closes the kitchen and supports "${shortGoal}".`,
            steps: [
              "Pour a glass of water or warm caffeine-free tea after your final meal.",
              "Turn off the bright kitchen light as a clear signal that eating is done for the night.",
            ],
          },
          {
            title: "Brush & Floss Right After Dinner",
            minutes: 5,
            description: "Use a clean-mouth cue early in the evening so late cravings lose their pull.",
            steps: [
              "Brush and floss within 20 minutes of finishing dinner instead of waiting until bedtime.",
              "Take 3 slow breaths and notice how fresh and settled your body feels.",
            ],
          },
          {
            title: "Ten-Minute Post-Dinner Digestion Walk",
            minutes: 10,
            description: "Settle blood sugar and evening restlessness with an easy walk.",
            steps: [
              "Step outside or walk around your space for 10 unhurried minutes after eating.",
              "Keep your pace easy and let your shoulders drop.",
            ],
          },
          {
            title: "Balanced Daytime Fuel Check",
            minutes: 15,
            description: "Make sure you eat enough protein and fiber earlier so night cravings fade naturally.",
            steps: [
              "Prep a satisfying daytime meal or afternoon snack so you never arrive at night starving.",
              "Eat your meal seated without scrolling.",
            ],
          },
        ],
      },
      mind: {
        focus: "Craving Surfing & Calm",
        nodes: [
          {
            title: "90-Second Craving Wave Pause",
            minutes: 2,
            description: "Distinguish real hunger from boredom, stress, or tired scrolling.",
            steps: [
              "When an evening urge hits, pause for 90 seconds and ask: 'Am I hungry, bored, or tired?'",
              "Take 5 slow exhales before deciding your next move.",
            ],
          },
          {
            title: "Stress-to-Snack Trigger Note",
            minutes: 5,
            description: `Spot the exact moment "${shortGoal}" usually gets tested.`,
            steps: [
              "Jot down the time and mood when late-night cravings usually appear.",
              "Pick one non-food reward (a warm shower, a chapter, a stretch) for that window.",
            ],
          },
          {
            title: "Screen-Off Wind-Down Block",
            minutes: 10,
            description: "Late-night scrolling triggers late-night snacking; calm both together.",
            steps: [
              "Put your phone on its charger outside the kitchen 30 minutes before bed.",
              "Dim the room lights so your brain shifts into sleep mode.",
            ],
          },
          {
            title: "30-Day Evening Rhythm Review",
            minutes: 10,
            description: "Notice how much better your mornings feel when your evenings stay calm.",
            steps: [
              "Rate your morning energy and sleep quality compared to Day 1.",
              "Lock in the single evening cue that helped the most.",
            ],
          },
        ],
      },
      craft: {
        focus: "Environment & Evening Design",
        nodes: [
          {
            title: "Clear Countertop 2-Minute Reset",
            minutes: 2,
            description: "Out of sight, out of mind — make the default choice the easy choice.",
            steps: [
              "Put snack bags and treats inside a high cabinet or opaque container before 8 PM.",
              "Wipe down the counter so the kitchen looks closed for the night.",
            ],
          },
          {
            title: "Prep Tomorrow's Morning Anchor",
            minutes: 6,
            description: "Shift your focus from late-night grazing to a great breakfast.",
            steps: [
              "Set out your morning coffee, tea, or breakfast bowl before leaving the kitchen.",
              "Fill your water bottle for the nightstand.",
            ],
          },
          {
            title: "Replacement Ritual Setup",
            minutes: 10,
            description: "Give your hands and mind something better to do at night.",
            steps: [
              "Set a book, sketchbook, or cozy activity on the couch before dinner.",
              "Spend 10 minutes on it during your usual snacking window.",
            ],
          },
          {
            title: "Personal Evening Blueprint",
            minutes: 15,
            description: `Turn "${shortGoal}" into an effortless house rule.`,
            steps: [
              "Define your ideal kitchen-closed time and your go-to evening drink.",
              "Write a simple 'grace rule' for social nights out so one late meal never breaks your streak.",
            ],
          },
        ],
      },
      connection: {
        focus: "Supportive Space & Boundaries",
        nodes: [
          {
            title: "Share Your Kitchen-Closed Cue",
            minutes: 2,
            description: "Let the people around you know your new evening rhythm.",
            steps: [
              "Tell a roommate, partner, or friend about your 30-day evening goal.",
              "Ask them to join you for tea or a quick chat instead of late snacks.",
            ],
          },
          {
            title: "Evening Check-In Text",
            minutes: 5,
            description: "Replace solo boredom grazing with a quick human connection.",
            steps: [
              "Send a quick voice note or text to a friend during your toughest evening hour.",
              "Share one small win from today.",
            ],
          },
          {
            title: "Phone-Free Dinner Presence",
            minutes: 15,
            description: "Eating slowly and present at dinner prevents rebound hunger at 10 PM.",
            steps: [
              "Put screens away during your evening meal.",
              "Eat at an unhurried pace so fullness signals actually register.",
            ],
          },
          {
            title: "Shared Wind-Down Ritual",
            minutes: 15,
            description: "Anchor your evening around connection or calm instead of the pantry.",
            steps: [
              "Plan an evening walk, call, or board/reading hour with someone you care about.",
              "Celebrate keeping your evening promise.",
            ],
          },
        ],
      },
    };
  }

  if (theme === "running" || theme === "strength") {
    return {
      body: {
        focus: theme === "running" ? "Stride & Aerobic Base" : "Progressive Strength",
        nodes: [
          {
            title: "Shoes-On Doorstep Seed",
            minutes: 2,
            description: `Lace up and do 2 minutes of ankle, hip, and calf prep for "${shortGoal}".`,
            steps: [
              "Put on your movement shoes and step outside or onto your mat.",
              "Do 10 slow calf raises, 8 leg swings per side, and 5 deep squats.",
            ],
          },
          {
            title: theme === "running" ? "Easy Nose-Breathing Pace" : "Foundational Bodyweight Set",
            minutes: 10,
            description: `Build consistency toward "${shortGoal}" without soreness or burnout.`,
            steps: [
              theme === "running"
                ? "Alternate 90 seconds of easy jogging with 60 seconds of walking."
                : "Complete 3 controlled sets of squats, push-ups, and glute bridges.",
              "Keep the pace easy enough that you could speak in full sentences.",
            ],
          },
          {
            title: theme === "running" ? "Steady Cadence Session" : "Progressive Overload Block",
            minutes: 18,
            description: `A focused main session that moves "${shortGoal}" forward safely.`,
            steps: [
              theme === "running"
                ? "Warm up 3 minutes, then hold a smooth, relaxed rhythm for the main block."
                : "Add 1–2 quality reps to each set while keeping your form crisp.",
              "Finish with 2 minutes of slow walking and nasal breathing.",
            ],
          },
          {
            title: "Signature Endurance Milestone",
            minutes: 25,
            description: `Your capstone session celebrating 30 days of showing up for "${shortGoal}".`,
            steps: [
              "Start unhurried for the first 5 minutes and settle into your strongest sustainable rhythm.",
              "Cool down gently and record how much easier the baseline feels now.",
            ],
          },
        ],
      },
      mind: {
        focus: "Pacing & Mental Grit",
        nodes: [
          {
            title: "60-Second Pre-Session Intention",
            minutes: 2,
            description: "Quiet the excuse voice before it talks you out of starting.",
            steps: [
              "Write one sentence: what 'showing up today' looks like at minimum.",
              "Take three slow exhales and begin immediately.",
            ],
          },
          {
            title: "Rhythm Over Mood Check-In",
            minutes: 5,
            description: "Separate how you feel from the small promise you made today.",
            steps: [
              "Rate your energy 1–5 without judgment and pick the matching effort level.",
              "Remind yourself: a gentle session still grows the branch.",
            ],
          },
          {
            title: "Ten-Minute Unplugged Reset",
            minutes: 10,
            description: "Lower stress hormones so your body can actually adapt and recover.",
            steps: [
              "Sit or lie down for 10 minutes with eyes closed and no audio.",
              "Lengthen your exhale to 6 seconds whenever your mind races.",
            ],
          },
          {
            title: "30-Day Athlete Reflection",
            minutes: 12,
            description: "Review the sessions you kept and lock in your next baseline.",
            steps: [
              "List 3 moments this month where you showed up despite low motivation.",
              "Choose the single anchor habit you will carry into next season.",
            ],
          },
        ],
      },
      craft: {
        focus: "Technique & Preparation",
        nodes: [
          {
            title: "Lay Out Tomorrow's Gear",
            minutes: 2,
            description: "Remove all morning friction so starting takes zero decisions.",
            steps: [
              "Set your shoes, clothes, and water bottle in plain sight tonight.",
              "Pick the exact 15-minute window on tomorrow's calendar.",
            ],
          },
          {
            title: "Form & Mobility Drill",
            minutes: 6,
            description: `Practice the mechanics that keep "${shortGoal}" pain-free.`,
            steps: [
              "Spend 6 minutes rehearsing tall posture, core bracing, and smooth breathing.",
              "Film or check 1 set to notice where tension creeps in.",
            ],
          },
          {
            title: "Fuel & Hydration Prep",
            minutes: 10,
            description: "Prep a simple whole-food meal or hydration bottle to back your training.",
            steps: [
              "Fill a full bottle of water and prep one protein-rich snack or meal.",
              "Eat without a screen so you notice real fullness and energy.",
            ],
          },
          {
            title: "Personal Training Blueprint",
            minutes: 15,
            description: "Design a repeatable 3-day weekly template you can keep all year.",
            steps: [
              "Map out your 3 non-negotiable movement days and 2 active recovery days.",
              "Write your 'minimum viable session' rule for busy weeks.",
            ],
          },
        ],
      },
      connection: {
        focus: "Accountability & Shared Energy",
        nodes: [
          {
            title: "Declare Your Seed Goal",
            minutes: 2,
            description: `Tell one trusted person what you are building with "${shortGoal}".`,
            steps: [
              "Send a 1-sentence text to a friend sharing your 30-day goal.",
              "Ask them to check in with you once at the end of the week.",
            ],
          },
          {
            title: "Invite a Side-by-Side Walk",
            minutes: 10,
            description: "Combine movement with real conversation.",
            steps: [
              "Ask a friend, family member, or classmate for a 10-minute walk.",
              "Keep phones pocketed the entire time.",
            ],
          },
          {
            title: "Share an Honest Progress Note",
            minutes: 10,
            description: "Share what worked this week without waiting for a 'perfect' result.",
            steps: [
              "Send a quick note or photo from today's session to someone rooting for you.",
              "Name one thing that felt easier than Day 1.",
            ],
          },
          {
            title: "Anchor a Weekly Ritual",
            minutes: 15,
            description: "Turn solo effort into a shared weekly rhythm.",
            steps: [
              "Schedule a recurring weekly walk, run, or workout check-in with one person.",
              "Agree on a simple rain-or-shine backup plan.",
            ],
          },
        ],
      },
    };
  }

  return {
    body: commonBody,
    mind: {
      focus: "Focus & Calm Attention",
      nodes: [
        {
          title: "Two-Minute Clear-the-Deck Reset",
          minutes: 2,
          description: `Empty mental tabs before you touch "${shortGoal}".`,
          steps: [
            "Close every unrelated browser tab and write down any nagging to-do on paper.",
            "Take 3 slow breaths before starting your main craft step.",
          ],
        },
        {
          title: "Ten Minutes of Deep Input",
          minutes: 10,
          description: `Feed your mind quality material connected to "${shortGoal}".`,
          steps: [
            "Read or study one focused source for 10 minutes with notifications off.",
            "Write down one single idea you can apply today.",
          ],
        },
        {
          title: "Single-Tab Focus Sprint",
          minutes: 15,
          description: "Train the attention span that makes real skill growth possible.",
          steps: [
            "Set a 15-minute timer and keep only one workspace open.",
            "If you feel the urge to switch tasks, pause and take one breath instead.",
          ],
        },
        {
          title: "Evening Shutdown Ritual",
          minutes: 8,
          description: "End the day cleanly so your brain rests without guilt.",
          steps: [
            "Write down the exact first step you will take tomorrow for your goal.",
            "Close your workspace and put screens away 30 minutes before bed.",
          ],
        },
      ],
    },
    craft: {
      focus:
        theme === "coding"
          ? "Daily Shipping & Code"
          : theme === "reading" || theme === "language"
            ? "Deliberate Study & Recall"
            : theme === "speaking"
              ? "Voice & Brave Reps"
              : "Daily Making & Output",
      nodes: [
        {
          title:
            theme === "coding"
              ? "Open the Editor & Write 5 Lines"
              : theme === "reading" || theme === "language"
                ? "Read Two Pages With a Pen"
                : theme === "speaking"
                  ? "Two-Minute Out-Loud Rep"
                  : "Three-Sentence Ugly Draft",
          minutes: 2,
          description: `The 2-minute Seed version of "${shortGoal}" — small enough to never skip.`,
          steps: [
            theme === "coding"
              ? "Open your project file and write or refactor one tiny block."
              : theme === "reading" || theme === "language"
                ? "Open your book or lesson and complete 2 focused pages or 5 flashcards."
                : theme === "speaking"
                  ? "Speak one clear thought out loud for 90 seconds without stopping."
                  : "Open a blank note and write 3 raw sentences or sketch for 2 minutes.",
            "Save your progress immediately — the seed is planted.",
          ],
        },
        {
          title: "Ten-Minute Core Practice Block",
          minutes: 10,
          description: `One unhurried block directly advancing "${shortGoal}".`,
          steps: [
            `Pick one concrete micro-piece of "${shortGoal}" you can finish in 10 minutes.`,
            "Work straight through the timer without judging the quality.",
          ],
        },
        {
          title: "Twenty-Minute Deep Craft Session",
          minutes: 20,
          description: `Move "${shortGoal}" from rough start to a tangible artifact.`,
          steps: [
            "Build, write, or practice the hardest part first while your focus is fresh.",
            "Leave a 1-line note at the end marking where to pick up next time.",
          ],
        },
        {
          title: "Ship & Archive the Proof",
          minutes: 20,
          description: `Finish one complete unit of "${shortGoal}" you can point to with pride.`,
          steps: [
            "Polish only what matters and call the piece done.",
            "Save or publish it into your 30-day proof folder.",
          ],
        },
      ],
    },
    connection: {
      focus: "Environment & Honest Sharing",
      nodes: [
        {
          title: "Tell One Person Your 30-Day Promise",
          minutes: 2,
          description: `Make "${shortGoal}" real outside your own head.`,
          steps: [
            "Message one supportive friend with your 30-day goal in plain words.",
            "Tell them you are starting with a 2-minute daily seed.",
          ],
        },
        {
          title: "Ask One Real Question",
          minutes: 8,
          description: "Connect with someone who is also building or learning.",
          steps: [
            "Reach out to one peer or mentor and ask one specific question.",
            "Listen or read their reply without rushing to prove yourself.",
          ],
        },
        {
          title: "Share a Work-in-Progress",
          minutes: 12,
          description: `Show a small piece of "${shortGoal}" before it feels perfect.`,
          steps: [
            "Pick one draft, note, or milestone from this week.",
            "Send it to one trusted person and ask for one honest observation.",
          ],
        },
        {
          title: "Co-Working or Shared Check-In",
          minutes: 15,
          description: "Build a repeatable social anchor around your growth.",
          steps: [
            "Set up a 15-minute body-doubling session or weekly progress swap with a friend.",
            "Celebrate what you both kept consistent this week.",
          ],
        },
      ],
    },
  };
}

/**
 * Deterministic, goal-tailored Starting Seed Tree generator.
 * Used as the instant local seed engine and as the safety repair baseline for Edge AI responses.
 */
export function buildSeedPlan(answers: OnboardingAnswers): GeneratedTree {
  const safety = assessGoalSafety(answers.goal);
  const safeGoal = safety.safe
    ? answers.goal.trim()
    : safety.suggestion ?? "Build a calm, consistent daily practice";

  const theme = detectGoalTheme(safeGoal, answers.identity);
  const templates = templatesForTheme(theme, safeGoal);
  const blockerMeta = BLOCKER_MAP[answers.blocker] ?? BLOCKER_MAP.consistency;
  const antiBlockerInstruction = blockerStep(answers.blocker);

  return {
    summary: `Built for a ${labelForIdentity(
      answers.identity,
    )} working toward "${safeGoal}" (${answers.timeBudget} min/day), with built-in guardrails for ${blockerMeta.label.toLowerCase()}.`,
    safetyNote:
      safety.coachingNote ??
      "Safety & pacing active: start with 2-minute seeds, stay inside your time budget, and rest when needed.",
    pillars: PILLARS.map((pillar) => {
      const branch = templates[pillar.id];
      return {
        pillar: pillar.id,
        focus: branch.focus,
        nodes: branch.nodes.map((node, tier) => ({
          title: node.title,
          duration: clampDurationToBudget(
            `${node.minutes} min`,
            tier,
            answers.timeBudget,
          ),
          description: node.description,
          instructions: [node.steps[0], node.steps[1], antiBlockerInstruction],
        })),
      };
    }),
  };
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asInstructions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const steps = value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, 4);
  return steps.length >= 2 ? steps : fallback;
}

/**
 * Validates and sanitizes any raw response from the server-side Edge Function
 * against our safety rules and the deterministic Seed Plan baseline.
 */
export function normalizeTree(
  raw: unknown,
  answers: OnboardingAnswers,
): GeneratedTree {
  const fallback = buildSeedPlan(answers);
  if (!raw || typeof raw !== "object") return fallback;

  const root = raw as {
    summary?: unknown;
    safetyNote?: unknown;
    pillars?: unknown;
  };
  const list = Array.isArray(root.pillars) ? root.pillars : null;
  if (!list) return fallback;

  return {
    summary: asString(root.summary, fallback.summary).slice(0, 220),
    safetyNote: asString(root.safetyNote, fallback.safetyNote).slice(0, 180),
    pillars: PILLARS.map((meta) => {
      const fallbackBranch = fallback.pillars.find(
        (p) => p.pillar === meta.id,
      )!;
      const entry = list.find((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        const key = String(record.pillar ?? record.id ?? "").toLowerCase();
        return key === meta.id;
      }) as Record<string, unknown> | undefined;

      const rawNodes = Array.isArray(entry?.nodes) ? entry!.nodes : [];
      const nodes: GeneratedNode[] = [];
      for (let tier = 0; tier < 4; tier += 1) {
        const candidate = rawNodes[tier] as Record<string, unknown> | undefined;
        const base = fallbackBranch.nodes[tier];
        if (!candidate || typeof candidate !== "object") {
          nodes.push(base);
          continue;
        }
        const rawCandidate: GeneratedNode = {
          title: asString(candidate.title, base.title),
          duration: asString(candidate.duration, base.duration),
          description: asString(candidate.description, base.description),
          instructions: asInstructions(
            candidate.instructions,
            base.instructions,
          ),
        };
        nodes.push(sanitizeGeneratedNode(rawCandidate, base, tier, answers));
      }
      return {
        pillar: meta.id,
        focus: asString(entry?.focus, fallbackBranch.focus ?? meta.subtitle).slice(
          0,
          48,
        ),
        nodes,
      };
    }),
  };
}

/**
 * Generates a personalized Starting Seed Plan.
 *
 * Security: Never uses a client-side Gemini API key. Instead, it invokes the
 * Supabase `generate-tree` Edge Function (where GEMINI_API_KEY lives in
 * server secrets) and falls back to the goal-tailored Starting Seed Engine
 * when the Edge Function isn't deployed yet.
 */
export async function generateTree(
  answers: OnboardingAnswers,
  options: { allowAi?: boolean } = {},
): Promise<TreeResult> {
  const safety = assessGoalSafety(answers.goal);
  if (!safety.safe) {
    throw new Error(
      safety.reason ??
        "Please choose a safe, constructive 30-day goal before generating your tree.",
    );
  }

  const sb = getSupabase();
  if (sb && options.allowAi !== false) {
    try {
      const { data, error } = await sb.functions.invoke("generate-tree", {
        body: {
          identity: answers.identity,
          goal: scrubGoalForPrivacy(answers.goal.trim()),
          blocker: answers.blocker,
          timeBudget: answers.timeBudget,
        },
      });

      if (!error && data && typeof data === "object") {
        return {
          tree: normalizeTree(data, answers),
          source: "edge-ai",
        };
      }
    } catch {
      // Edge function not deployed or unreachable — fall through to Starting Seed Engine.
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 450));
  return { tree: buildSeedPlan(answers), source: "seed-engine" };
}
