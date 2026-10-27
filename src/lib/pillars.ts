import type {
  BlockerId,
  BlockerMeta,
  IdentityId,
  IdentityMeta,
  PillarId,
  PillarMeta,
} from "./types";

/**
 * The tree is a picture of a life, not a fitness plan. Each branch is a domain
 * of becoming: the body you live in, the mind you think with, the craft you
 * make, and the people you grow alongside.
 */
export const PILLARS: PillarMeta[] = [
  {
    id: "body",
    name: "Body",
    subtitle: "Strength, energy & rest",
    icon: "body",
    accent: "#C1876F",
    soft: "rgba(193,135,111,0.09)",
    roman: "I",
  },
  {
    id: "mind",
    name: "Mind",
    subtitle: "Focus, learning & calm",
    icon: "mind",
    accent: "#C1A473",
    soft: "rgba(193,164,115,0.09)",
    roman: "II",
  },
  {
    id: "craft",
    name: "Craft",
    subtitle: "Skill, work & making",
    icon: "craft",
    accent: "#B3A3B8",
    soft: "rgba(179,163,184,0.09)",
    roman: "III",
  },
  {
    id: "connection",
    name: "Connection",
    subtitle: "People, place & presence",
    icon: "connection",
    accent: "#92A89B",
    soft: "rgba(146,168,155,0.09)",
    roman: "IV",
  },
];

export const PILLAR_MAP = Object.fromEntries(
  PILLARS.map((p) => [p.id, p]),
) as Record<PillarId, PillarMeta>;

export const ROMAN = ["I", "II", "III", "IV"] as const;

export const IDENTITIES: IdentityMeta[] = [
  {
    id: "creator",
    name: "Creator",
    subtitle: "Make things worth sharing",
    accent: "#B3A3B8",
    icon: "sparkles",
    goals: [
      "Create something every day",
      "Publish one piece I'm proud of",
      "Build a daily writing habit",
    ],
  },
  {
    id: "athlete",
    name: "Athlete",
    subtitle: "Build strength and energy",
    accent: "#C1876F",
    icon: "dumbbell",
    goals: [
      "Move my body every day",
      "Get stronger, consistently",
      "Sleep and recover better",
    ],
  },
  {
    id: "scholar",
    name: "Scholar",
    subtitle: "Learn deeply, stay curious",
    accent: "#C1A473",
    icon: "book",
    goals: [
      "Read 10 minutes a day",
      "Finish a course I started",
      "Practice a language daily",
    ],
  },
  {
    id: "builder",
    name: "Builder",
    subtitle: "Ship work that matters",
    accent: "#92A89B",
    icon: "hammer",
    goals: [
      "Ship one small thing daily",
      "Do 30 minutes of deep work",
      "Launch my first project",
    ],
  },
];

export const IDENTITY_MAP = Object.fromEntries(
  IDENTITIES.map((identity) => [identity.id, identity]),
) as Record<IdentityId, IdentityMeta>;

export function labelForIdentity(id: string) {
  return IDENTITY_MAP[id as IdentityId]?.name ?? "Creator";
}

export function goalsForIdentity(id: IdentityId) {
  return IDENTITY_MAP[id]?.goals ?? IDENTITIES[0].goals;
}

export const BLOCKERS: BlockerMeta[] = [
  {
    id: "consistency",
    label: "Restarting every Monday",
    subtitle: "I start strong, miss a day, and lose momentum",
    strategy: "Anchor every branch with a 2-minute floor that is too small to skip.",
  },
  {
    id: "time",
    label: "No time left in the day",
    subtitle: "Work and home take the hours I meant to use",
    strategy: "Protect one fixed slot you already have instead of hunting for spare time.",
  },
  {
    id: "distraction",
    label: "Phone & scroll loops",
    subtitle: "My attention gets hijacked before I begin",
    strategy: "Put the phone out of reach first, then start a single timer.",
  },
  {
    id: "overthinking",
    label: "Not knowing what's next",
    subtitle: "I have 17 goals and stall on the first step",
    strategy: "Remove choice: define the exact tool, surface and first 60 seconds.",
  },
  {
    id: "energy",
    label: "Low energy at day's end",
    subtitle: "By the time I'm free, I'm too drained to push",
    strategy: "Keep actions restorative and front-load the smallest win early.",
  },
  {
    id: "stress",
    label: "Stress or a low mood",
    subtitle: "When I feel bad, the plan is the first thing to go",
    strategy: "Make the smallest version the default on hard days and count it fully.",
  },
  {
    id: "perfectionism",
    label: "All or nothing",
    subtitle: "If I can't do it properly, I skip it entirely",
    strategy: "Define done as two minutes, so a partial day is still a finished day.",
  },
];

export const BLOCKER_MAP = Object.fromEntries(
  BLOCKERS.map((b) => [b.id, b]),
) as Record<BlockerId, BlockerMeta>;

export function labelForBlocker(id?: string | null) {
  return BLOCKER_MAP[(id ?? "consistency") as BlockerId]?.label ?? BLOCKERS[0].label;
}

export const TIME_OPTIONS = [
  {
    label: "5 mins",
    value: "5",
    sub: "A micro-habit, kept daily",
    icon: "timer" as const,
  },
  {
    label: "15 mins",
    value: "15",
    sub: "A steady daily rhythm",
    icon: "clock" as const,
  },
  {
    label: "30 mins",
    value: "30",
    sub: "A deeper practice",
    icon: "hourglass" as const,
  },
] as const;

export type TimeIcon = (typeof TIME_OPTIONS)[number]["icon"];
