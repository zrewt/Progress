import { View } from "react-native";
import { classifyGoal } from "../lib/safety-rules";
import { Body, Label } from "./Type";
import { QuietButton } from "./Controls";

/** The answer stays in component state. Only conservative_mode is persisted. */
export function PhysicalScreening({ goal, answer, accepted, onAnswer, onAccept, minor }: { goal: string; answer: boolean | null; accepted: boolean; onAnswer: (answer: boolean) => void; onAccept: () => void; minor: boolean }) {
  const category = classifyGoal(goal);
  if (category === "ordinary") return null;
  return <View style={{ gap: 10 }}><Label>Before physical activity</Label><Body>Has a doctor ever advised you to limit exercise?</Body><Body>If unsure, check with a doctor before starting. Only the conservative-mode flag is saved, not this answer.</Body><QuietButton label={answer === false ? "Selected: No" : "No"} onPress={() => onAnswer(false)} /><QuietButton label={answer ? "Selected: Yes" : "Yes"} onPress={() => onAnswer(true)} />{answer ? <><Body>Speak with a doctor first. Continue with gentler preparation, or change the goal above.</Body><QuietButton label={accepted ? "Conservative mode selected" : "Continue in conservative mode"} onPress={onAccept} /></> : null}{minor ? <Body>Involve a trusted adult. Your plan uses gentler progression and no extreme physical actions.</Body> : null}{category === "high-risk" ? <Body>Preparation only. Get qualified instruction. This app does not provide routes, techniques or equipment safety advice.</Body> : null}</View>;
}
