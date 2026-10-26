import type { PillarId, PillarMeta } from "./types";

export const PILLARS: PillarMeta[] = [
  {
    id: "mobility",
    name: "Mobility",
    subtitle: "Flexibility & Posture",
    icon: "mobility",
    accent: "#B3A3B8",
    soft: "rgba(179,163,184,0.09)",
    roman: "I",
  },
  {
    id: "endurance",
    name: "Endurance",
    subtitle: "Stamina & Breath",
    icon: "endurance",
    accent: "#C1A473",
    soft: "rgba(193,164,115,0.09)",
    roman: "II",
  },
  {
    id: "strength",
    name: "Strength",
    subtitle: "Functional Body Control",
    icon: "strength",
    accent: "#C1876F",
    soft: "rgba(193,135,111,0.09)",
    roman: "III",
  },
  {
    id: "recovery",
    name: "Recovery",
    subtitle: "Sleep & Energy",
    icon: "recovery",
    accent: "#92A89B",
    soft: "rgba(146,168,155,0.09)",
    roman: "IV",
  },
];

export const PILLAR_MAP = Object.fromEntries(
  PILLARS.map((p) => [p.id, p]),
) as Record<PillarId, PillarMeta>;

export const ROMAN = ["I", "II", "III", "IV"] as const;

export type ChoiceIcon =
  | "armchair"
  | "battery"
  | "posture"
  | "feather"
  | "timer"
  | "clock"
  | "hourglass"
  | "bodyweight"
  | "home"
  | "gym";

export const FRICTION_OPTIONS = [
  {
    label: "Desk Stiffness / Back Pain",
    value: "desk-stiffness",
    icon: "armchair" as ChoiceIcon,
    hint: "Unlock the hips, spine and shoulders",
  },
  {
    label: "Low Energy / Fatigue",
    value: "low-energy",
    icon: "battery" as ChoiceIcon,
    hint: "Rebuild breath and daily stamina",
  },
  {
    label: "Poor Posture",
    value: "poor-posture",
    icon: "posture" as ChoiceIcon,
    hint: "Open the chest, wake up the back",
  },
  {
    label: "General Weakness",
    value: "general-weakness",
    icon: "feather" as ChoiceIcon,
    hint: "Lay a foundation of functional strength",
  },
] as const;

export const TIME_OPTIONS = [
  {
    label: "5 mins",
    value: "5",
    sub: "A micro-habit, kept daily",
    icon: "timer" as ChoiceIcon,
  },
  {
    label: "15 mins",
    value: "15",
    sub: "A steady daily rhythm",
    icon: "clock" as ChoiceIcon,
  },
  {
    label: "30 mins",
    value: "30",
    sub: "A deeper practice",
    icon: "hourglass" as ChoiceIcon,
  },
] as const;

export const SPACE_OPTIONS = [
  {
    label: "Bodyweight / Desk",
    value: "bodyweight",
    sub: "No equipment needed",
    icon: "bodyweight" as ChoiceIcon,
  },
  {
    label: "Home Gym",
    value: "home-gym",
    sub: "Bands and light weights",
    icon: "home" as ChoiceIcon,
  },
  {
    label: "Full Gym",
    value: "full-gym",
    sub: "Everything available",
    icon: "gym" as ChoiceIcon,
  },
] as const;

export function labelForFriction(value: string) {
  return FRICTION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelForSpace(value: string) {
  return SPACE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
