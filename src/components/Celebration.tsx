import { useEffect } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useGame } from "../lib/game-context";
import { alpha, colors, fonts } from "../theme";
import { Display, Label, Mono } from "./Type";

export function Celebration() {
  const { celebration, dismissCelebration } = useGame();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!celebration) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => undefined,
    );
    const timer = setTimeout(dismissCelebration, 4400);
    return () => clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: 14 + insets.bottom }]} accessibilityRole="alert">
        <View style={styles.toast}>
          <View style={styles.check}>
            <Check size={16} strokeWidth={2.6} color={colors.ink950} />
          </View>

          <View style={styles.copy}>
            <Label style={{ fontSize: 10.5 }}>Practice complete</Label>
            <Display numberOfLines={1} style={styles.title}>
              {celebration.title}
            </Display>

            <View style={styles.metaRow}>
              <Text style={styles.xp}>+{celebration.xp} XP</Text>
              <Text style={styles.metaDivider}>·</Text>
              <Mono numberOfLines={1} style={styles.next}>
                {celebration.unlocked
                  ? celebration.nextTitle
                    ? `Next — ${celebration.nextTitle}`
                    : "Next node open"
                  : "Branch complete"}
              </Mono>
            </View>

            {celebration.levelUp ? (
              <View style={styles.levelRow}>
                <View style={styles.lichenDot} />
                <Text style={styles.levelText}>
                  Level {celebration.levelUp} reached
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            onPress={dismissCelebration}
            accessibilityRole="button"
            accessibilityLabel="Dismiss completion note"
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <X size={14} strokeWidth={1.6} color={colors.sageDim} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
  },
  toast: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: colors.ink850,
    borderWidth: 1,
    borderColor: alpha(colors.lichen, 0.25),
    padding: 14,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  check: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: colors.lichen,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0 },
  title: { marginTop: 3, fontSize: 19, lineHeight: 23 },
  metaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  xp: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.copperLight },
  metaDivider: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.sageDeep },
  next: { fontSize: 10.5, color: colors.sage, flexShrink: 1 },
  levelRow: {
    marginTop: 7,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.bone, 0.1),
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lichenDot: { height: 3, width: 3, borderRadius: 2, backgroundColor: colors.lichen },
  levelText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: colors.lichen,
  },
});
