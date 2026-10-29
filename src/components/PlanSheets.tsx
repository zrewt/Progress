import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, X } from "lucide-react-native";
import { useGame, planVersionOf } from "../lib/game-context";
import { dailyPlanFromTree, planFromSeason, presentation } from "../lib/daily-adapter";
import { generateTree } from "../lib/gemini";
import { planningLeg } from "../lib/engine/schedule";
import { addDays, daysBetween, localDate } from "../lib/progression";
import { planHistory } from "../lib/engine/history";
import { classifyGoal } from "../lib/safety-rules";
import { PhysicalScreening } from "./PhysicalScreening";
import { assessGoalSafety } from "../lib/safety";
import { BUDGETS, type Budget } from "../lib/plans";
import type { DailyPlan } from "../lib/daily-types";
import type { OnboardingAnswers } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";
import { SkillTree } from "./SkillTree";

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
  const { today, snapshot, editPlan, authBusy, aiAllowed } = useGame();
  const plan = today && snapshot ? planFromSeason(snapshot, today.season.id) : null;
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [budget, setBudget] = useState<Budget>((plan?.minutes_budget ?? 15) as Budget);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<DailyPlan | null>(null);
  const [screening, setScreening] = useState<boolean | null>(null);
  const [acceptedScreening, setAcceptedScreening] = useState(false);
  if (!visible || !plan || !today) return null;
  const safety = assessGoalSafety(goal);
  const valid = goal.trim().length >= 3 && goal.trim().length <= 140 && safety.safe && (classifyGoal(goal) === "ordinary" || screening === false || (screening === true && acceptedScreening));

  async function save() {
    if (!plan) return;
    setBusy(true);
    try {
      // A new version goes back through the engine rather than the shared
      // templates: the steps have to be rewritten for the new goal and the new
      // daily size, and the season so far is the best briefing it can get.
      const answers: OnboardingAnswers = {
        conservativeMode: !!plan.conservative_mode || !!snapshot?.profile?.conservative_mode || screening === true,
        identity: plan.identity,
        goal,
        blocker: plan.blocker,
        timeBudget: String(budget),
        context: plan.personalization_context ?? [],
        ...(plan.target_date && today ? { targetDate: plan.target_date, legEnd: today.season.ends_on, daysRemaining: Math.max(1, daysBetween(today.today, today.season.ends_on)) } : {}),
      };
      const built = await generateTree(answers, { allowAi: aiAllowed, history: planHistory(snapshot) });
      const next = dailyPlanFromTree(answers, built.tree, built.source);
      setDraft({ ...next, target_date: plan.target_date, season_length_days: plan.season_length_days, stages: plan.stages, plan_version: plan.plan_version + 1 });
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!draft) return;
    setBusy(true);
    try {
      if (await editPlan(draft)) { setDraft(null); onClose(); }
    } finally { setBusy(false); }
  }

  return (
    <SheetFrame title="Edit your plan" onClose={() => { setDraft(null); onClose(); }}>
      <Body style={styles.lead}>
        Changing the goal or the daily size starts a new version. Everything you have already done stays in your history.
      </Body>
      <Label style={{ marginTop: 6 }}>Your goal</Label>
      <TextInput
        value={goal}
        onChangeText={(value) => { setGoal(value); setDraft(null); setScreening(null); setAcceptedScreening(false); }}
        maxLength={140}
        accessibilityLabel="Your goal"
        selectionColor={colors.copper}
        style={styles.input}
      />
      {!safety.safe ? <Body>{safety.reason}</Body> : null}
      <PhysicalScreening goal={goal} answer={screening} accepted={acceptedScreening} onAnswer={v => { setScreening(v); setAcceptedScreening(false); setDraft(null); }} onAccept={() => setAcceptedScreening(true)} minor={snapshot?.profile?.age_bracket === "13_17"} />
      <Label style={{ marginTop: 16 }}>Minutes a day</Label>
      <BudgetChips value={budget} onChange={(value) => { setBudget(value); setDraft(null); }} />
      <Micro style={{ marginTop: 10, textTransform: "none", letterSpacing: 0.3 }}>
        Generate a draft, then review and approve it before your plan changes.
      </Micro>
      {draft ? <View style={{ gap: 8, marginTop: 12 }}>
        <Label>{draft.plan_source === "ai" ? "AI draft" : draft.plan_source === "mixed" ? "AI and starter practices" : "Starter plan"}</Label>
        <Body>{draft.plan_summary}</Body>
        {draft.practices.map((practice) => <Body key={practice.branch}>{practice.role === "primary" ? "Daily" : "Weekly"}: {practice.title} — {practice.why}{"\n"}{practice.full_variant.steps.join("\n")}</Body>)}
        <PrimaryButton label="Approve this plan" onPress={() => void approve()} loading={busy} disabled={busy || authBusy} />
        <QuietButton label="Try another draft" onPress={() => void save()} disabled={busy || authBusy} />
      </View> : <PrimaryButton
        label={busy ? "Building" : "Generate a draft"}
        onPress={() => void save()}
        loading={busy}
        disabled={!valid || busy || authBusy}
        style={{ marginTop: 18 }}
      />}
    </SheetFrame>
  );
}

export function SeasonSummarySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { today, snapshot, finishSeason, authBusy, aiAllowed } = useGame();
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [nextPlan, setNextPlan] = useState<DailyPlan | null>(null);
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState<Budget>(15);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState("");
  const [firstLeg, setFirstLeg] = useState(false);
  const [screening, setScreening] = useState<boolean | null>(null);
  const [acceptedScreening, setAcceptedScreening] = useState(false);
  if (!visible || !today || !snapshot) return null;
  const date = localDate(new Date(), snapshot.profile?.timezone ?? "UTC");
  const leg = planningLeg(date, target, firstLeg);
  const plan = planFromSeason(snapshot, today.season.id);
  const progress = snapshot.progress;
  const grown = progress?.unlocked_milestones.length ?? 0;
  const total = snapshot.milestones.filter((milestone) => milestone.season_id === today.season.id).length;
  const practiced = progress?.practiced_days ?? 0;
  const seasonXp = progress?.season_xp ?? 0;
  const safety = assessGoalSafety(goal);

  async function keepGoing() {
    if (!plan) return;
    setBusy(true);
    await finishSeason(planVersionOf({ ...plan, target_date: null, season_length_days: null, stages: undefined, reality_check: undefined }, plan.plan_version + 1));
    setBusy(false);
    onClose();
  }

  async function beginNew() {
    if (!plan || leg.kind !== "valid") return;
    setBusy(true);
    try {
      const answers: OnboardingAnswers = { conservativeMode: !!snapshot?.profile?.conservative_mode || screening === true, identity: plan.identity, goal: goal.trim(), blocker: plan.blocker, timeBudget: String(budget), targetDate: leg.target, legEnd: leg.end, daysRemaining: leg.length };
      const built = await generateTree(answers, { allowAi: aiAllowed, history: planHistory(snapshot) });
      setNextPlan(dailyPlanFromTree(answers, built.tree, built.source));
    } finally { setBusy(false); }
  }

  async function approveNew() {
    if (!nextPlan) return;
    setBusy(true);
    try { if (await finishSeason(nextPlan)) { setNextPlan(null); onClose(); } }
    finally { setBusy(false); }
  }

  return (
    <SheetFrame title="Your season so far" onClose={() => { setNextPlan(null); onClose(); }}>
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
          <Label>Tell it what you want and by when</Label>
          <TextInput
            value={goal}
            onChangeText={(value) => { setGoal(value); setNextPlan(null); setScreening(null); setAcceptedScreening(false); }}
            maxLength={140}
            placeholder="One clear change"
            placeholderTextColor={colors.sageDeep}
            selectionColor={colors.copper}
            accessibilityLabel="New goal"
            style={styles.input}
          />
          <Label>Target date (YYYY-MM-DD)</Label>
          <TextInput accessibilityLabel="Target date" value={target} maxLength={10} onChangeText={v => { setTarget(v); setFirstLeg(false); setNextPlan(null); }} style={styles.input} />
          <QuietButton label="Choose four weeks from today" onPress={() => { setTarget(addDays(date, 28)); setFirstLeg(false); }} />
          {leg.kind === "too-soon" ? <Body>The earliest available date is {leg.earliest}.</Body> : null}
          {leg.kind === "first-leg" ? <><Body>Keep your target and start with a 112-day leg ending {leg.checkpoint}.</Body><QuietButton label="Plan this first leg" onPress={() => setFirstLeg(true)} /></> : null}
          {!safety.safe ? <Body>{safety.reason}</Body> : null}
          <PhysicalScreening goal={goal} answer={screening} accepted={acceptedScreening} onAnswer={v => { setScreening(v); setAcceptedScreening(false); setNextPlan(null); }} onAccept={() => setAcceptedScreening(true)} minor={snapshot?.profile?.age_bracket === "13_17"} />
          <Label style={{ marginTop: 14 }}>Minutes a day</Label>
          <BudgetChips value={budget} onChange={(value) => { setBudget(value); setNextPlan(null); }} />
          {nextPlan ? <View style={{ gap: 8, marginTop: 12 }}>
            <Label>{nextPlan.plan_source === "ai" ? "AI draft" : nextPlan.plan_source === "mixed" ? "AI and starter practices" : "Starter plan"}</Label>
            <Body>{nextPlan.plan_summary}</Body>
            {nextPlan.practices.map((practice) => <Body key={practice.branch}>{practice.role === "primary" ? "Daily" : "Weekly"}: {practice.title} — {practice.why}{"\n"}{practice.full_variant.steps.join("\n")}</Body>)}
            <PrimaryButton label="Approve and begin" onPress={() => void approveNew()} loading={busy} disabled={busy || authBusy} />
            <QuietButton label="Try another draft" onPress={() => void beginNew()} disabled={busy || authBusy} />
          </View> : <PrimaryButton
            label={busy ? "Building" : "Generate a draft"}
            onPress={() => void beginNew()}
            loading={busy}
            disabled={busy || authBusy || goal.trim().length < 3 || !safety.safe || leg.kind !== "valid" || (classifyGoal(goal) !== "ordinary" && screening !== false && !(screening && acceptedScreening))}
            style={{ marginTop: 16 }}
          />}
          <QuietButton label="Back" onPress={() => { setNextPlan(null); setNewGoalOpen(false); }} disabled={busy} />
        </>
      ) : (
        <>
          {!today.season.season_length_days ? <PrimaryButton
            label={busy ? "Beginning" : "Continue the legacy 30-day plan"}
            onPress={() => void keepGoing()}
            loading={busy}
            disabled={busy || authBusy}
            icon={busy ? undefined : <ArrowRight size={15} strokeWidth={2} color={colors.ink950} />}
            style={{ marginTop: 8 }}
          />
          : null}
          <QuietButton label="Choose a goal and target date" onPress={() => { setGoal(plan?.goal ?? ""); setNewGoalOpen(true); }} disabled={busy} />
        </>
      )}
      <Micro style={{ marginTop: 6, textAlign: "center", textTransform: "none", letterSpacing: 0.3 }}>
        Your past seasons stay readable below.
      </Micro>
    </SheetFrame>
  );
}

export function SeasonHistory() {
  const { history, loadHistory, snapshot } = useGame();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
  const selectedEntry = history?.find((entry) => entry.id === selected);
  const selectedSeason = snapshot?.seasons.find((season) => season.id === selected && season.status !== "active");
  const tree = snapshot && selectedSeason ? presentation(snapshot, selectedSeason.id).nodes : [];
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
        <Pressable key={entry.id} style={styles.historyRow} accessibilityRole="button" accessibilityState={{ selected: selected === entry.id }} onPress={() => setSelected(selected === entry.id ? null : entry.id)}>
          <Text style={styles.historyGoal}>{entry.goal}</Text>
          <Text style={styles.historyMeta}>
            {entry.days_practiced} days · {entry.xp} XP · {entry.started_on} to {entry.ends_on}
          </Text>
          <Text style={styles.historyMeta}>{selected === entry.id ? "Hide tree" : "View tree"}</Text>
        </Pressable>
      ))}
      {selectedEntry && selectedSeason ? <View style={{ gap: 8 }}>
        <Label>{selectedEntry.goal}</Label>
        <Body>Chapter: {selectedEntry.started_on} to {selectedEntry.ends_on}{selectedSeason.target_date ? ` · Target: ${selectedSeason.target_date}` : ""}</Body>
        <Body>{tree.filter(node => node.status === "completed").length} of {tree.length} milestones grown · Read-only</Body>
        <SkillTree key={selectedSeason.id} nodes={tree} readOnly onSelect={() => undefined} />
      </View> : null}
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
