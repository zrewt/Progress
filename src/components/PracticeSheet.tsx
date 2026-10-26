import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Clock, Feather, X } from "lucide-react-native";
import type { Practice } from "../lib/daily-types";
import { useGame } from "../lib/game-context";
import { PILLAR_MAP } from "../lib/pillars";
import { SKIP_REASONS, EFFORT_LABELS } from "../lib/today";
import { alternativesFor, practiceDraft, type Budget } from "../lib/plans";
import { alpha, colors, fonts, hairline } from "../theme";
import { PillarIcon } from "./PillarIcon";
import { Micro, Body, Display, Label, Mono } from "./Type";
import { PrimaryButton, QuietButton } from "./Controls";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PracticeSheet({
  practice,
  defaultEasy = false,
  onClose,
}: {
  practice: Practice | null;
  defaultEasy?: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { today, snapshot, recordEvent, replacePractice, authBusy } = useGame();
  const [easy, setEasy] = useState(defaultEasy);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [effort, setEffort] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);

  useEffect(() => {
    if (startedAt === null) return;
    // Recompute from the timestamp so a backgrounded app still shows the true time.
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  if (!practice) return null;

  const variant = easy ? practice.easy_variant : practice.full_variant;
  const pillar = PILLAR_MAP[practice.branch];
  const budget = (today?.season.minutes_budget ?? 15) as Budget;
  const inUse = (snapshot?.practices ?? [])
    .filter((item) => item.season_id === practice.season_id && item.active)
    .map((item) => item.title);
  const options = alternativesFor(practice.branch, inUse);

  async function complete() {
    if (!today) return;
    setBusy(true); setFailure(null);
    const saved = await recordEvent({
      season_id: today.season.id,
      practice_id: practice!.id,
      kind: easy ? "easy" : "full",
      minutes_actual: variant.minutes,
      effort: effort ?? undefined,
      note: note.trim() ? note.trim() : undefined,
    });
    setBusy(false);
    if (saved) onClose();
    else setFailure("This could not be saved. Your entry is kept and a retry will not count it twice.");
  }

  async function skip(reason?: string) {
    if (!today) return;
    setBusy(true);
    const saved = await recordEvent({ season_id: today.season.id, practice_id: practice!.id, kind: "skipped", note: (reason ?? note.trim()) || undefined });
    setBusy(false);
    if (saved) onClose();
  }

  async function rest() {
    if (!today) return;
    setBusy(true);
    const saved = await recordEvent({ season_id: today.season.id, practice_id: null, kind: "rest" });
    setBusy(false);
    if (saved) onClose();
  }

  async function swap(key: string) {
    const option = options.find((item) => item.key === key);
    if (!option) return;
    setBusy(true);
    const saved = await replacePractice(practice!.id, practiceDraft(option, practice!.role, budget));
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close practice" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={[styles.accentBar, { backgroundColor: pillar.accent }]} />
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.headerRow}>
              <View style={styles.eyebrowRow}>
                <PillarIcon pillar={practice.branch} size={14} color={pillar.accent} />
                <Text style={styles.pillarLabel}>{pillar.name} · {practice.role === "primary" ? "Daily" : "Weekly"}</Text>
              </View>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <X size={18} strokeWidth={1.6} color={colors.sage} />
              </Pressable>
            </View>

            <Display style={styles.title}>{variant.title}</Display>
            <Body style={styles.why}>{practice.why}</Body>

            <View style={styles.metaRow}>
              <Clock size={12} strokeWidth={1.6} color={colors.sage} />
              <Text style={styles.metaText}>{variant.minutes} min</Text>
              <Text style={styles.metaDivider}>·</Text>
              <Text style={styles.metaText}>{easy ? "Easier version" : "Full version"}</Text>
            </View>

            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: easy }}
              accessibilityLabel={easy ? "Use the full version instead" : "Use the easier version"}
              onPress={() => setEasy((value) => !value)}
              style={({ pressed }) => [styles.easyToggle, easy && styles.easyToggleOn, pressed && { opacity: 0.8 }]}
            >
              <Feather size={13} strokeWidth={1.8} color={easy ? colors.lichen : colors.copperLight} />
              <Text style={[styles.easyToggleText, easy && { color: colors.lichen }]}>
                {easy ? "Easier version selected — switch back" : `Easier version (${practice.easy_variant.minutes} min)`}
              </Text>
            </Pressable>

            <View style={styles.steps}>
              {variant.steps.map((step, index) => (
                <View key={`${index}-${step}`} style={styles.stepRow}>
                  <Mono style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Mono>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            <View style={styles.timerRow}>
              <QuietButton
                label={startedAt === null ? "Start a timer" : elapsed > 0 ? `Timer ${formatElapsed(elapsed)}` : "Timer running"}
                onPress={() => setStartedAt(startedAt === null ? Date.now() : null)}
                style={{ flexGrow: 1 }}
              />
              {startedAt !== null ? (
                <Pressable onPress={() => { setStartedAt(null); setElapsed(0); }} accessibilityRole="button" accessibilityLabel="Reset timer" hitSlop={10} style={styles.reset}>
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
            <Micro style={styles.timerNote}>No timer needed. It is here if it helps you begin.</Micro>

            <Label style={{ marginTop: 18 }}>How did it feel? Optional.</Label>
            <View style={styles.chipRow}>
              {EFFORT_LABELS.map((label, index) => {
                const value = index + 1;
                const selected = effort === value;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setEffort(selected ? null : value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={label}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, selected && { color: colors.ink950 }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Label style={{ marginTop: 16 }}>A short note? Optional.</Label>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={280}
              multiline
              placeholder="Anything worth remembering about today."
              placeholderTextColor={colors.sageDeep}
              selectionColor={colors.copper}
              accessibilityLabel="Practice note"
              style={styles.input}
            />

            <Pressable onPress={() => setSwapping((value) => !value)} accessibilityRole="button" style={styles.swapLink}>
              <Text style={styles.swapText}>{swapping ? "Keep this practice" : "This practice does not fit — swap it"}</Text>
            </Pressable>

            {swapping ? (
              <View style={styles.alternatives}>
                {options.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => void swap(option.key)}
                    disabled={busy || authBusy}
                    accessibilityRole="button"
                    accessibilityLabel={`Replace with ${option.title}`}
                    style={({ pressed }) => [styles.alternative, pressed && { opacity: 0.7 }]}
                  >
                    <Text style={styles.alternativeTitle}>{option.title}</Text>
                    <Text style={styles.alternativeWhy}>{option.why}</Text>
                  </Pressable>
                ))}
                <Micro style={{ marginTop: 8 }}>Your history stays. Only the next practices change.</Micro>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {failure ? <Text style={styles.failure} accessibilityRole="alert">{failure}</Text> : null}
            <PrimaryButton
              label={busy ? "Saving" : easy ? "I did the easier version" : "I did this today"}
              onPress={() => void complete()}
              loading={busy}
              disabled={busy || authBusy}
              icon={busy ? undefined : <Check size={16} strokeWidth={2.5} color={colors.ink950} />}
              iconPosition="left"
            />
            {skipOpen ? (
              <View style={styles.skipReasons}>
                <Micro style={{ textTransform: "none", letterSpacing: 0.3 }}>A reason helps your weekly review. Optional.</Micro>
                <View style={styles.chipRow}>
                  {SKIP_REASONS.map((reason) => (
                    <Pressable key={reason} onPress={() => void skip(reason)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Skip because ${reason}`} style={styles.chip}>
                      <Text style={styles.chipText}>{reason}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.secondaryRow}>
                <QuietButton label="Skip today" onPress={() => setSkipOpen(true)} disabled={busy} style={{ flex: 1 }} />
                <QuietButton label="Rest day" onPress={() => void rest()} disabled={busy} style={{ flex: 1 }} />
              </View>
            )}
            <Micro style={styles.footerNote}>A skipped or rested day never erases what you have grown.</Micro>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,13,9,0.86)" },
  sheet: { width: "100%", maxHeight: "92%", backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: alpha(colors.bone, 0.16) },
  accentBar: { height: 2, width: "100%" },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillarLabel: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
  title: { marginTop: 16, fontSize: 29, lineHeight: 32, letterSpacing: -0.7 },
  why: { marginTop: 10, lineHeight: 21 },
  metaRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  metaText: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: colors.sage },
  metaDivider: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.sageDeep },
  easyToggle: {
    marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.copper, 0.55), backgroundColor: alpha(colors.copper, 0.08),
  },
  easyToggleOn: { borderColor: alpha(colors.lichen, 0.6), backgroundColor: alpha(colors.lichen, 0.1) },
  easyToggleText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.copperLight },
  steps: { marginTop: 18 },
  stepRow: { flexDirection: "row", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: alpha(colors.bone, 0.07) },
  stepNumber: { width: 24, paddingTop: 2, fontSize: 9.5, color: colors.copperLight },
  stepText: { flex: 1, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 22, color: colors.boneDim },
  timerRow: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  reset: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  resetText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.sage },
  timerNote: { marginTop: 6, textTransform: "none", letterSpacing: 0.3 },
  chipRow: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 11, borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.18) },
  chipOn: { backgroundColor: colors.lichen, borderColor: colors.lichen },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.boneDim },
  input: {
    marginTop: 8, minHeight: 68, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.18),
    borderRadius: 2, padding: 11, color: colors.bone, fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 20,
    textAlignVertical: "top",
  },
  swapLink: { marginTop: 16, minHeight: 44, justifyContent: "center" },
  swapText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.sage, textDecorationLine: "underline" },
  alternatives: { gap: 8 },
  alternative: { borderWidth: StyleSheet.hairlineWidth, borderColor: hairline, padding: 12, borderRadius: 2, backgroundColor: alpha(colors.ink850, 0.6) },
  alternativeTitle: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone },
  alternativeWhy: { marginTop: 4, fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.sage },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline, paddingHorizontal: 20, paddingTop: 14, gap: 9 },
  secondaryRow: { flexDirection: "row", gap: 9 },
  footerNote: { textAlign: "center", textTransform: "none", letterSpacing: 0.3 },
  skipReasons: { gap: 4 },
  failure: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.clay, textAlign: "center" },
});
