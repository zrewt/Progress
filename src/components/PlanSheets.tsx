import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, X } from "lucide-react-native";
import { useGame, planVersionOf } from "../lib/game-context";
import { planFromSeason } from "../lib/daily-adapter";
import { buildPlan, detectTheme, BUDGETS, type Budget } from "../lib/plans";
import { alpha, colors, fonts, hairline } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

function BudgetChips({ value, onChange }: { value: Budget; onChange: (budget: Budget) => void }) {
  return (
    <View style={styles.chipRow}>
      {BUDGETS.map((budget) => {
        const selected = value === budget;
        return (
          <Pressable
            key={budget}
            onPress={() => onChange(budget)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${budget} minutes a day`}
            style={[styles.chip, selected && styles.chipOn]}
          >
            <Text style={[styles.chipText, selected && { color: colors.ink950 }]}>{budget} min</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SheetFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.sheetHead}>
            <Display style={styles.sheetTitle}>{title}</Display>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
              <X size={18} strokeWidth={1.6} color={colors.sage} />
            </Pressable>
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false} bounces={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function EditPlanSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { today, snapshot, editPlan, authBusy } = useGame();
  const plan = today && snapshot ? planFromSeason(snapshot, today.season.id) : null;
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [budget, setBudget] = useState<Budget>((plan?.minutes_budget ?? 15) as Budget);
  const [busy, setBusy] = useState(false);
  if (!visible || !plan || !today) return null;
  const theme = detectTheme(goal);
  const valid = goal.trim().length >= 3 && goal.trim().length <= 140;

  async function save() {
    setBusy(true);
    const sameGoal = goal.trim() === plan!.goal.trim();
    // A new goal needs a new plan. Keeping the same goal (a typo, or just a
    // different daily size) must not replace practices written for this person
    // with the shared library ones.
    const next = sameGoal
      ? {
          ...plan!,
          goal: goal.trim(),
          minutes_budget: budget,
          plan_version: plan!.plan_version + 1,
          practices: plan!.practices.map((practice) => ({
            ...practice,
            full_variant: {
              ...practice.full_variant,
              minutes: Math.min(practice.full_variant.minutes, budget),
            },
          })),
        }
      : buildPlan({
          goal,
          identity: plan!.identity,
          blocker: plan!.blocker,
          minutes_budget: budget,
          plan_source: plan!.plan_source,
          plan_version: plan!.plan_version + 1,
          theme,
        });
    const saved = await editPlan(next);
    setBusy(false);
    if (saved) onClose();
  }

  return (
    <SheetFrame title="Edit your plan" onClose={onClose}>
      <Body style={styles.lead}>
        Changing the goal or the daily size starts a new version. Everything you have already done stays in your history.
      </Body>
      <Label style={{ marginTop: 6 }}>Your 30-day goal</Label>
      <TextInput
        value={goal}
        onChangeText={setGoal}
        maxLength={140}
        accessibilityLabel="Your 30-day goal"
        selectionColor={colors.copper}
        style={styles.input}
      />
      <Label style={{ marginTop: 16 }}>Minutes a day</Label>
      <BudgetChips value={budget} onChange={setBudget} />
      <Micro style={{ marginTop: 10, textTransform: "none", letterSpacing: 0.3 }}>
        This reads as a {theme.label.toLowerCase()} plan. Every version fits inside {budget} minutes.
      </Micro>
      <PrimaryButton
        label={busy ? "Saving" : "Save this version"}
        onPress={() => void save()}
        loading={busy}
        disabled={!valid || busy || authBusy}
        style={{ marginTop: 18 }}
      />
    </SheetFrame>
  );
}

export function SeasonSummarySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { today, snapshot, finishSeason, authBusy } = useGame();
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState<Budget>(15);
  const [busy, setBusy] = useState(false);
  if (!visible || !today || !snapshot) return null;
  const plan = planFromSeason(snapshot, today.season.id);
  const progress = snapshot.progress;
  const grown = progress?.unlocked_milestones.length ?? 0;
  const total = snapshot.milestones.filter((milestone) => milestone.season_id === today.season.id).length;
  const practiced = progress?.practiced_days ?? 0;
  const seasonXp = progress?.season_xp ?? 0;

  async function keepGoing() {
    if (!plan) return;
    setBusy(true);
    await finishSeason(planVersionOf(plan, plan.plan_version + 1));
    setBusy(false);
    onClose();
  }

  async function beginNew() {
    if (!plan) return;
    setBusy(true);
    await finishSeason(
      buildPlan({
        goal,
        identity: plan.identity,
        blocker: plan.blocker,
        minutes_budget: budget,
        plan_source: "local",
        plan_version: 1,
      }),
    );
    setBusy(false);
    onClose();
  }

  return (
    <SheetFrame title="Your season so far" onClose={onClose}>
      <Body style={styles.lead}>
        Season {today.season.plan_version > 1 ? `${today.season.plan_version}` : ""} ends here. Nothing is lost when you close it.
      </Body>
      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Display style={styles.statNumber}>{practiced}</Display>
          <Micro>days practised</Micro>
        </View>
        <View style={styles.statBox}>
          <Display style={styles.statNumber}>{seasonXp}</Display>
          <Micro>season XP</Micro>
        </View>
        <View style={styles.statBox}>
          <Display style={styles.statNumber}>{grown}/{total || 16}</Display>
          <Micro>tree grown</Micro>
        </View>
        <View style={styles.statBox}>
          <Display style={styles.statNumber}>{today.bestStreak}</Display>
          <Micro>best streak</Micro>
        </View>
      </View>

      {newGoalOpen ? (
        <>
          <Label>What is the next 30 days about?</Label>
          <TextInput
            value={goal}
            onChangeText={setGoal}
            maxLength={140}
            placeholder="One clear change"
            placeholderTextColor={colors.sageDeep}
            selectionColor={colors.copper}
            accessibilityLabel="New goal"
            style={styles.input}
          />
          <Label style={{ marginTop: 14 }}>Minutes a day</Label>
          <BudgetChips value={budget} onChange={setBudget} />
          <Micro style={{ marginTop: 10, textTransform: "none", letterSpacing: 0.3 }}>
            This reads as a {detectTheme(goal).label.toLowerCase()} plan.
          </Micro>
          <PrimaryButton
            label={busy ? "Beginning" : "Begin a new 30 days"}
            onPress={() => void beginNew()}
            loading={busy}
            disabled={busy || authBusy || goal.trim().length < 3}
            style={{ marginTop: 16 }}
          />
          <QuietButton label="Back" onPress={() => setNewGoalOpen(false)} disabled={busy} />
        </>
      ) : (
        <>
          <PrimaryButton
            label={busy ? "Beginning" : "Continue this goal for 30 more days"}
            onPress={() => void keepGoing()}
            loading={busy}
            disabled={busy || authBusy}
            icon={busy ? undefined : <ArrowRight size={15} strokeWidth={2} color={colors.ink950} />}
            style={{ marginTop: 8 }}
          />
          <QuietButton label="Choose a new goal" onPress={() => setNewGoalOpen(true)} disabled={busy} />
        </>
      )}
      <Micro style={{ marginTop: 6, textAlign: "center", textTransform: "none", letterSpacing: 0.3 }}>
        Your past seasons stay readable below.
      </Micro>
    </SheetFrame>
  );
}

export function SeasonHistory() {
  const { history, loadHistory } = useGame();
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Pressable
        onPress={() => { setOpen(true); void loadHistory(); }}
        accessibilityRole="button"
        accessibilityLabel="Show past seasons"
        style={styles.historyLink}
      >
        <Text style={styles.historyLinkText}>Past seasons</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.history}>
      <View style={styles.historyHead}>
        <Micro style={{ color: colors.lichenDim }}>Past seasons</Micro>
        <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Hide past seasons" hitSlop={10}>
          <X size={13} strokeWidth={1.6} color={colors.sage} />
        </Pressable>
      </View>
      {history === null ? <Micro>Loading your history…</Micro> : null}
      {history?.length === 0 ? <Body style={{ fontSize: 12 }}>Your first season is still being written.</Body> : null}
      {history?.map((entry) => (
        <View key={entry.id} style={styles.historyRow}>
          <Text style={styles.historyGoal}>{entry.goal}</Text>
          <Text style={styles.historyMeta}>
            {entry.days_practiced} days · {entry.xp} XP · {entry.started_on} to {entry.ends_on}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,13,9,0.86)" },
  sheet: { width: "100%", maxHeight: "92%", backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: alpha(colors.bone, 0.16), paddingHorizontal: 20 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 18, paddingBottom: 12 },
  sheetTitle: { fontSize: 26, lineHeight: 29 },
  sheetBody: { paddingBottom: 14, gap: 12 },
  lead: { lineHeight: 20 },
  input: {
    marginTop: 8, minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.2),
    borderRadius: 2, paddingHorizontal: 11, paddingVertical: 10, color: colors.bone,
    fontFamily: fonts.sans, fontSize: 14,
  },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  chip: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.2) },
  chipOn: { backgroundColor: colors.lichen, borderColor: colors.lichen },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.bone },
  statGrid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: hairline },
  statBox: { width: "50%", paddingVertical: 12, gap: 2 },
  statNumber: { fontSize: 24, lineHeight: 27 },
  historyLink: { minHeight: 46, justifyContent: "center", marginTop: 10 },
  historyLinkText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage, textDecorationLine: "underline" },
  history: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline, paddingTop: 12, gap: 10 },
  historyHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyRow: { gap: 2, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
  historyGoal: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone },
  historyMeta: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.6, color: colors.sage, textTransform: "uppercase" },
});
