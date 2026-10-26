import { Brain, Dumbbell, Hammer, Users } from "lucide-react-native";
import type { PillarId } from "../lib/types";
import { colors } from "../theme";

const ICONS = {
  body: Dumbbell,
  mind: Brain,
  craft: Hammer,
  connection: Users,
};

export function PillarIcon({
  pillar,
  size = 16,
  color = colors.sage,
  strokeWidth = 1.5,
}: {
  pillar: PillarId;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Icon = ICONS[pillar];
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}
