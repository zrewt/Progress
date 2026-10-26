import { GoogleGenerativeAI } from "@google/generative-ai";
import { PILLARS, labelForFriction, labelForSpace } from "./pillars";
import type {
  GeneratedNode,
  GeneratedTree,
  OnboardingAnswers,
  PillarId,
} from "./types";

export type TreeSource = "gemini" | "fallback";

export interface TreeResult {
  tree: GeneratedTree;
  source: TreeSource;
}

interface MockNode extends GeneratedNode {
  minutes: number;
}

const MOCK: Record<PillarId, Omit<MockNode, "duration">[]> = {
  mobility: [
    {
      title: "90/90 Hip Opener",
      minutes: 2,
      description:
        "Release the hip tightness that builds up from long hours of sitting.",
      instructions: [
        "Sit tall with your front leg bent 90° in front and the back leg bent 90° behind you.",
        "Brace your hands behind you and gently lean toward the front shin for 30 seconds.",
        "Switch sides and repeat twice, breathing slowly through the nose.",
      ],
    },
    {
      title: "Wall Angel Flow",
      minutes: 3,
      description: "Re-teach your upper back and shoulders to stack over your ribs.",
      instructions: [
        "Stand with your back near a wall, ribs down and chin gently tucked.",
        "Keep forearms on the wall and slide them overhead, then back down.",
        "Move slowly for 8 reps, then pause for 20 seconds and repeat.",
      ],
    },
    {
      title: "Thoracic Bridge",
      minutes: 3,
      description: "Open a stiff mid-back and wake up the glutes at the same time.",
      instructions: [
        "Lie on your back with knees bent and feet flat, arms resting overhead.",
        "Press your hips up while reaching your arms long overhead, exhaling fully.",
        "Lower one vertebra at a time and repeat 8 slow reps.",
      ],
    },
    {
      title: "Full-Body CARs",
      minutes: 5,
      description:
        "Controlled articular rotations: lubricate every major joint with intent.",
      instructions: [
        "Move your neck, shoulders, hips and ankles slowly through their full pain-free range.",
        "Draw 3 controlled circles in each direction per joint, keeping the rest of the body still.",
        "Never force the end range — stop where tension, not pain, begins.",
      ],
    },
  ],
  endurance: [
    {
      title: "Box Breathing Reset",
      minutes: 2,
      description: "Down-regulate your nervous system and sharpen focus in 2 minutes.",
      instructions: [
        "Sit tall and inhale through the nose for 4 seconds.",
        "Hold for 4, exhale for 4, hold empty for 4.",
        "Repeat 8 rounds, letting your shoulders stay relaxed.",
      ],
    },
    {
      title: "Standing March Intervals",
      minutes: 4,
      description: "Raise your heart rate gently without needing any space.",
      instructions: [
        "March in place with high knees and a strong arm swing for 40 seconds.",
        "Recover with easy breathing for 20 seconds.",
        "Repeat 4 rounds, keeping your posture tall the whole time.",
      ],
    },
    {
      title: "Step-Up Finisher",
      minutes: 5,
      description: "Build everyday stamina on a stair, step or low box.",
      instructions: [
        "Step up with one foot, stand tall, then step down with control.",
        "Work for 40 seconds and rest 20 seconds.",
        "Complete 5 rounds, alternating the leading leg each round.",
      ],
    },
    {
      title: "Zone-2 Walk",
      minutes: 10,
      description:
        "The most underrated health habit: easy, conversational aerobic work.",
      instructions: [
        "Walk briskly enough that you can talk in short sentences but not sing.",
        "Breathe only through your nose if possible, keeping shoulders relaxed.",
        "Finish with one minute of slow walking and three deep exhales.",
      ],
    },
  ],
  strength: [
    {
      title: "Glute Bridge Set",
      minutes: 3,
      description: "Switch on the glutes that desk sitting has put to sleep.",
      instructions: [
        "Lie on your back, feet flat and heels close to your hips.",
        "Press through your heels and lift your hips until knees, hips and shoulders align.",
        "Squeeze for 3 seconds at the top, then lower; complete 3 sets of 10.",
      ],
    },
    {
      title: "Incline Push-Up Ladder",
      minutes: 4,
      description: "Build pressing strength with a desk, counter or chair.",
      instructions: [
        "Place your hands on a stable surface and set a straight line from head to heels.",
        "Perform 5 reps, rest 15 seconds, then add one rep each round up to 8.",
        "Keep elbows at about 45° and lower with control.",
      ],
    },
    {
      title: "Split Squat Series",
      minutes: 5,
      description: "Single-leg strength that carries over to stairs and walking.",
      instructions: [
        "Step one foot forward into a long stance and keep your torso tall.",
        "Lower until the back knee nearly touches the floor, then drive up.",
        "Do 8 reps per leg, hold the bottom for 2 seconds on each rep.",
      ],
    },
    {
      title: "Hollow Hold + Carry",
      minutes: 6,
      description: "Lock in core control, then load it with a real-world carry.",
      instructions: [
        "Lie on your back and lift shoulders and legs slightly, lower back pressed down.",
        "Hold for 20 seconds, rest 20, repeat 3 times.",
        "Finish with a 30-second farmer carry on each side using a bag or weight.",
      ],
    },
  ],
  recovery: [
    {
      title: "Legs-Up-the-Wall",
      minutes: 4,
      description: "Flip your circulation and calm your nervous system.",
      instructions: [
        "Lie on your back and rest your legs vertically against a wall.",
        "Let your arms fall open and take long, slow exhales.",
        "Stay for 4 minutes — no phone, no agenda.",
      ],
    },
    {
      title: "Neck & Jaw Release",
      minutes: 2,
      description: "Undo the screen-time tension you carry in your neck and jaw.",
      instructions: [
        "Do 8 slow chin tucks, gliding your head straight back.",
        "Tilt one ear toward your shoulder and breathe for 20 seconds per side.",
        "Massage your jaw muscles in small circles with your fingertips.",
      ],
    },
    {
      title: "Downshift Breathwork",
      minutes: 3,
      description: "A long-exhale practice to switch from wired to rested.",
      instructions: [
        "Inhale through the nose for 4 seconds and exhale for 8 seconds.",
        "Keep your jaw and shoulders soft through every round.",
        "Complete 12 rounds, then rest with normal breathing for 30 seconds.",
      ],
    },
    {
      title: "Evening Wind-Down Ritual",
      minutes: 5,
      description: "Signal to your body that the day is officially over.",
      instructions: [
        "Dim the lights and put screens out of reach.",
        "Take 10 slow breaths, then write down one thing that went well today.",
        "Spend the remaining minutes reading or stretching before bed.",
      ],
    },
  ],
};

function maxMinutesForBudget(budget: string) {
  if (budget === "5") return 5;
  if (budget === "15") return 12;
  return 20;
}

function mockTree(answers: OnboardingAnswers): GeneratedTree {
  const cap = maxMinutesForBudget(answers.timeBudget);
  return {
    pillars: PILLARS.map((pillar) => ({
      pillar: pillar.id,
      nodes: MOCK[pillar.id].map(({ minutes, ...node }) => ({
        ...node,
        duration: `${Math.min(minutes, cap)} min`,
      })),
    })),
  };
}

export function hasGeminiKey() {
  const key = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 10 && !key.includes("your"));
}

function stripFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asInstructions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const steps = value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, 5);
  return steps.length >= 2 ? steps : fallback;
}

/**
 * Gemini can return partial or malformed data — repair it against the
 * built-in plan so the user always gets a playable 4×4 tree.
 */
function normalizeTree(raw: unknown, answers: OnboardingAnswers): GeneratedTree {
  const fallback = mockTree(answers);
  const root = raw as { pillars?: unknown } | unknown[] | null;
  const list = Array.isArray(root) ? root : root?.pillars;
  if (!Array.isArray(list)) return fallback;

  return {
    pillars: PILLARS.map((meta) => {
      const fallbackNodes = fallback.pillars.find((p) => p.pillar === meta.id)!
        .nodes;
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
        const base = fallbackNodes[tier];
        if (!candidate || typeof candidate !== "object") {
          nodes.push(base);
          continue;
        }
        nodes.push({
          title: asString(candidate.title, base.title).slice(0, 60),
          duration: asString(candidate.duration, base.duration).slice(0, 20),
          description: asString(candidate.description, base.description).slice(
            0,
            180,
          ),
          instructions: asInstructions(
            candidate.instructions,
            base.instructions,
          ),
        });
      }
      return { pillar: meta.id, nodes };
    }),
  };
}

function buildPrompt(answers: OnboardingAnswers) {
  return `You are an expert strength, mobility and recovery coach designing a beginner-friendly daily movement skill tree.

User profile:
- Main daily friction: ${labelForFriction(answers.friction)}
- Daily time budget: ${answers.timeBudget} minutes
- Available space/equipment: ${labelForSpace(answers.space)}

Design exactly 4 nodes for each of these 4 pillars, ordered from easiest (tier 0) to hardest (tier 3):
1. mobility — flexibility & posture
2. endurance — stamina & breath
3. strength — functional body control
4. recovery — sleep & energy

Rules:
- Each node must be doable within the user's time budget and equipment.
- tier 0 must be a true 1-3 minute micro-action; later tiers can be slightly longer but never exceed the time budget.
- Instructions: 2-4 short, safe, concrete steps (max 18 words each).
- Avoid medical claims. No equipment unless the user selected a gym.
- Progressions must respect the stated friction (e.g. hip-friendly if back pain).

Return ONLY valid JSON in exactly this shape, no markdown:
{"pillars":[{"pillar":"mobility","nodes":[{"title":"...","duration":"2 min","description":"one sentence","instructions":["step 1","step 2","step 3"]}]},{"pillar":"endurance","nodes":[...]},{"pillar":"strength","nodes":[...]},{"pillar":"recovery","nodes":[...]}]}`;
}

export async function generateTree(
  answers: OnboardingAnswers,
): Promise<TreeResult> {
  if (!hasGeminiKey()) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    return { tree: mockTree(answers), source: "fallback" };
  }

  try {
    const client = new GoogleGenerativeAI(
      process.env.NEXT_PUBLIC_GEMINI_API_KEY as string,
    );
    const model = client.getGenerativeModel({
      model: process.env.NEXT_PUBLIC_GEMINI_MODEL?.trim() || "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(buildPrompt(answers));
    const text = stripFences(result.response.text());
    const parsed: unknown = JSON.parse(text);
    return { tree: normalizeTree(parsed, answers), source: "gemini" };
  } catch (error) {
    console.warn("[vitality-tree] Gemini generation failed, using fallback", error);
    return { tree: mockTree(answers), source: "fallback" };
  }
}

export { mockTree };
