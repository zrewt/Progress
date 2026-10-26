import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Clock, Feather, ShieldCheck, X } from "lucide-react-native";
import { PILLAR_MAP, ROMAN } from "../lib/pillars";
import { twoMinuteSeedVersion } from "../lib/safety";
import { milestoneForTier } from "../lib/tree";
import type { TreeNode } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { PillarIcon } from "./PillarIcon";
import { PrimaryButton, QuietButton, Rule } from "./Controls";
import { Body, Display, Label, Micro, Mono } from "./Type";

interface NodeModalProps {
  node: TreeNode | null;
  goal?: string;
  onClose: () => void;
  onComplete: (id: string) => Promise<boolean>;
}

export function NodeModal({ node, goal, onClose, onComplete }: NodeModalProps) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [seedMode, setSeedMode] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (node) {
      setBusy(false);
      setSeedMode(false);
      setSaveError(null);
    }
  }, [node]);

  if (!node) return null;

  const pillar = PILLAR_MAP[node.pillar];
  const completed = node.status === "completed";
  const locked = node.status === "locked";
  const nextTier = ROMAN[node.tier + 1];
  const shrunk = twoMinuteSeedVersion(node);
  const activeDuration = seedMode ? shrunk.duration : node.duration;
  const activeInstructions = seedMode ? shrunk.instructions : node.instructions;
  const canShrink = !completed && !locked && node.duration !== "2 min";

  async function handleComplete() {
    if (!node) return;
    setBusy(true);
    setSaveError(null);
    try {
      const saved = await onComplete(node.id);
      if (saved) {
        onClose();
      } else {
        setSaveError(
          "Could not save this practice to Supabase. Check your connection and try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close practice details"
        />

        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
        >
          <LinearGradient
            colors={[pillar.accent, alpha(pillar.accent, 0.33), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.headerRow}>
              <View style={styles.eyebrowRow}>
                <PillarIcon
                  pillar={node.pillar}
                  size={14}
                  color={pillar.accent}
                />
                <Text style={styles.pillarLabel}>
                  {pillar.name} · {milestoneForTier(node.tier)}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
              >
                <X size={18} strokeWidth={1.6} color={colors.sage} />
              </Pressable>
            </View>

            <Display style={styles.title}>{node.title}</Display>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={12} strokeWidth={1.6} color={colors.sage} />
                <Text style={styles.metaText}>{activeDuration}</Text>
              </View>
              <Text style={styles.metaDivider}>·</Text>
              <Text
                style={[
                  styles.metaText,
                  { color: completed ? colors.lichen : colors.copperLight },
                ]}
              >
                +50 XP
              </Text>
              <Text style={styles.metaDivider}>·</Text>
              <Text
                style={[
                  styles.metaText,
                  {
                    color: completed
                      ? colors.lichen
                      : locked
                        ? colors.sageDeep
                        : colors.bone,
                  },
                ]}
              >
                {completed
                  ? "Complete"
                  : locked
                    ? "Locked"
                    : seedMode
                      ? "2-Min Seed"
                      : "Ready"}
              </Text>
            </View>

            <Body style={styles.description}>{node.description}</Body>

            {goal ? (
              <View style={styles.goalTieBox}>
                <ShieldCheck
                  size={13}
                  strokeWidth={1.8}
                  color={colors.lichen}
                />
                <Text style={styles.goalTieText}>
                  Supports your 30-day goal:{" "}
                  <Text style={{ color: colors.bone }}>“{goal}”</Text>
                </Text>
              </View>
            ) : null}

            <Rule style={{ marginVertical: 20 }} />

            {completed ? (
              <View style={styles.completedNotice}>
                <Check size={16} strokeWidth={2.5} color={colors.lichen} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completedTitle}>
                    This practice is complete.
                  </Text>
                  <Text style={styles.completedBody}>
                    Revisit it whenever you like — the XP has already been
                    banked, and the branch ahead is open.
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.practiceHeaderRow}>
              <Label style={{ marginTop: completed ? 22 : 0 }}>
                {completed
                  ? "The practice, again"
                  : seedMode
                    ? "The 2-minute seed version"
                    : "The practice"}
              </Label>

              {canShrink ? (
                <Pressable
                  onPress={() => setSeedMode((value) => !value)}
                  accessibilityRole="button"
                  style={styles.shrinkToggle}
                >
                  <Feather
                    size={11}
                    strokeWidth={1.8}
                    color={colors.copperLight}
                  />
                  <Text style={styles.shrinkToggleText}>
                    {seedMode ? "Restore full duration" : "Low energy? 2-min seed"}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ marginTop: 8 }}>
              {activeInstructions.length ? (
                activeInstructions.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <Mono style={styles.stepNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </Mono>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.stepText, { paddingVertical: 10 }]}>
                  Do the smallest version you can repeat tomorrow.
                </Text>
              )}
            </View>

            <Text style={styles.note}>
              {seedMode
                ? shrunk.note
                : "Safety guardrail: stop at sharp pain or exhaustion. Consistency grows the branch; intensity does not."}
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            {saveError ? (
              <Text style={styles.saveError}>{saveError}</Text>
            ) : null}
            {completed ? (
              <QuietButton label="Back to the tree" onPress={onClose} />
            ) : (
              <>
                <PrimaryButton
                  label={
                    busy
                      ? "Saving practice"
                      : seedMode
                        ? "Complete 2-min seed"
                        : "Mark complete"
                  }
                  onPress={() => void handleComplete()}
                  disabled={busy || locked}
                  loading={busy}
                  iconPosition="left"
                  icon={
                    busy ? undefined : (
                      <Check size={16} strokeWidth={2.5} color={colors.ink950} />
                    )
                  }
                  trailing={
                    <Text style={styles.xpTrailing}>
                      {busy ? "" : "+50 XP"}
                    </Text>
                  }
                />
                <Micro style={styles.footerNote}>
                  {nextTier
                    ? `Opens ${milestoneForTier(node.tier + 1)} in ${pillar.name}`
                    : `Completes the ${pillar.name} branch`}
                </Micro>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(11,13,9,0.86)",
  },
  sheet: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: colors.canvas,
    borderTopWidth: 1,
    borderTopColor: alpha(colors.bone, 0.16),
  },
  accentBar: { height: 2, width: "100%" },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillarLabel: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
  title: { marginTop: 16, fontSize: 30, lineHeight: 32, letterSpacing: -0.7 },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.sage,
  },
  metaDivider: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    color: colors.sageDeep,
  },
  description: { marginTop: 14, lineHeight: 22 },
  goalTieBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: alpha(colors.lichen, 0.06),
    borderLeftWidth: 2,
    borderLeftColor: colors.lichen,
  },
  goalTieText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.sage,
  },
  completedNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.lichen,
    backgroundColor: alpha(colors.lichen, 0.05),
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  completedTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.bone,
  },
  completedBody: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.sage,
  },
  practiceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  shrinkToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.copper, 0.55),
    backgroundColor: alpha(colors.copper, 0.08),
    borderRadius: 2,
  },
  shrinkToggleText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    color: colors.copperLight,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.bone, 0.07),
  },
  stepNumber: {
    width: 24,
    paddingTop: 2,
    fontSize: 9.5,
    color: colors.copperLight,
  },
  stepText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 22,
    color: colors.boneDim,
  },
  note: {
    marginTop: 18,
    paddingLeft: 14,
    borderLeftWidth: 1,
    borderLeftColor: alpha(colors.bone, 0.15),
    fontFamily: fonts.displayItalic,
    fontSize: 13,
    lineHeight: 21,
    color: colors.sageDim,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  xpTrailing: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: alpha(colors.ink950, 0.7),
  },
  footerNote: { textAlign: "center", textTransform: "none", letterSpacing: 0.3 },
  saveError: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.clay,
    textAlign: "center",
  },
});
