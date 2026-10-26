import {
  Dumbbell,
  Moon,
  PersonStanding,
  Wind,
  type LucideProps,
} from "lucide-react";
import type { PillarId } from "@/lib/types";

const ICONS = {
  mobility: PersonStanding,
  endurance: Wind,
  strength: Dumbbell,
  recovery: Moon,
};

export function PillarIcon({
  pillar,
  ...props
}: { pillar: PillarId } & LucideProps) {
  const Icon = ICONS[pillar];
  return <Icon strokeWidth={1.5} {...props} />;
}
