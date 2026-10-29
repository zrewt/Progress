import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGame } from "../lib/game-context";
import { dailyPlanFromTree } from "../lib/daily-adapter";
import { generateTree } from "../lib/gemini";
import { planHistory } from "../lib/engine/history";
import { planningLeg } from "../lib/engine/schedule";
import { chapterDraftIsUsable, REFLECTION_QUESTIONS, reflectionContext, reflectionProblem } from "../lib/engine/chapter";
import { localDate } from "../lib/progression";
import { assessGoalSafety } from "../lib/safety";
import { classifyGoal } from "../lib/safety-rules";
import type { DailyPlan } from "../lib/daily-types";
import { alpha, colors, fonts } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { PhysicalScreening } from "./PhysicalScreening";
import { ConsentSheet } from "./ConsentSheet";
import { Body, Display, Label } from "./Type";

type Path = "continue" | "change" | "finish" | null;
export function ChapterReview({ onClose }: { onClose: () => void }) {
  const { today, snapshot, aiAllowed, recordConsent, recordChapterConsent, approveChapter, finishChapter, authBusy } = useGame();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState(["", "", "", ""]);
  const [path, setPath] = useState<Path>(null);
  const [goal, setGoal] = useState(today?.season.goal ?? "");
  const [target, setTarget] = useState(today?.season.target_date ?? "");
  const [firstLeg, setFirstLeg] = useState(false);
  const [screening, setScreening] = useState<boolean | null>(null);
  const [screeningAccepted, setScreeningAccepted] = useState(false);
  const [permission, setPermission] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [draft, setDraft] = useState<DailyPlan | null>(null);
  const [draftVersion, setDraftVersion] = useState<number | null>(null);
  const [draftSeason, setDraftSeason] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!today || !snapshot) return null;
  const season = today.season;
  const paused = !!season.progression_paused;
  const date = localDate(new Date(), snapshot.profile?.timezone ?? "UTC");
  const leg = planningLeg(date, target, firstLeg);
  const reflectionError = reflectionProblem(answers);
  const safety = assessGoalSafety(goal);
  const category = classifyGoal(goal);
  const screeningNeeded = path === "change" && category !== "ordinary";
  const valid = !paused && goal.trim().length >= 3 && goal.trim().length <= 140 && safety.safe && !reflectionError && leg.kind === "valid" && (!screeningNeeded || screening === false || (screening === true && screeningAccepted));

  async function generate(local: boolean) {
    if (!valid || leg.kind !== "valid") return;
    if (!local && !aiAllowed) { setMessage("AI permission is off. You can choose the local alternative or turn AI on in Settings."); return; }
    if (!local && !permission) { setMessage("Please choose whether to share your reflection before drafting with AI."); return; }
    setBusy(true); setMessage(null); setDraft(null);
    try {
      if (!local && !await recordChapterConsent()) { setMessage("Permission could not be saved. Your current chapter is unchanged."); return; }
      const input = { identity: season.identity, blocker: season.blocker, goal: goal.trim(), timeBudget: String(season.minutes_budget), context: path === "continue" ? season.personalization_context ?? [] : [], conservativeMode: !!season.conservative_mode || !!snapshot?.profile?.conservative_mode || screening === true, targetDate: leg.target, legEnd: leg.end, daysRemaining: leg.length };
      const result = await generateTree(input, { allowAi: !local, history: planHistory(snapshot, season.id), chapterReflection: local ? [] : reflectionContext(answers) });
      const next = dailyPlanFromTree(input, result.tree, result.source);
      if (!chapterDraftIsUsable(local, result.source, next.plan_source)) { setMessage("AI could not prepare this chapter. Retry or choose the local alternative. Your current plan is unchanged."); return; }
      setDraftVersion(season.plan_version); setDraftSeason(season.id); setDraftDate(date); setDraft(next);
    } catch { setMessage("The draft could not be prepared. Your current plan is unchanged."); }
    finally { setBusy(false); }
  }

  async function finish() {
    setBusy(true);
    try {
      if (await finishChapter(season.id, season.plan_version)) onClose();
      else setMessage("The chapter could not be closed. Refresh and try again.");
    } finally { setBusy(false); }
  }

  async function approve() {
    if (!draft || draftVersion === null || !draftSeason || !draftDate) return;
    if (date !== draftDate) { setDraft(null); setMessage("The date changed. Please generate a fresh draft."); return; }
    setBusy(true);
    const saved = await approveChapter(draftSeason, draftVersion, draft, draftDate);
    setBusy(false);
    if (saved) onClose();
    else { setDraft(null); setMessage("The chapter could not be confirmed. Refresh to see whether it was saved before trying again."); }
  }

  return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.backdrop}><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.header}><Display style={styles.title}>Your next chapter</Display><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chapter review" hitSlop={12}><X size={20} color={colors.sage} /></Pressable></View>
      <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Body>Take a moment to look back. Your answers are optional; please avoid sensitive health details.</Body>
        {paused ? <Body accessibilityRole="alert">Progression is paused because something hurt. Rest and use the easy practice before starting a new chapter. If pain continues, contact a qualified health professional.</Body> : null}
        {REFLECTION_QUESTIONS.map((question, index) => <View key={question} style={styles.field}><Label>{question}</Label><TextInput accessibilityLabel={question} value={answers[index]} onChangeText={value => { setAnswers(old => old.map((item, i) => i === index ? value : item)); setDraft(null); }} maxLength={160} multiline placeholder="Optional" placeholderTextColor={colors.sageDeep} style={styles.input} /></View>)}
        {reflectionError ? <Body accessibilityRole="alert">{reflectionError}</Body> : null}
        <Label>What would you like to do?</Label>
        <QuietButton label={path === "continue" ? "Selected: Continue this goal" : "Continue this goal"} onPress={() => { setGoal(season.goal); setPath("continue"); setDraft(null); }} />
        <QuietButton label={path === "change" ? "Selected: Change the goal" : "Change the goal"} onPress={() => { setPath("change"); setDraft(null); }} />
        <QuietButton label="Finish for now" onPress={() => { setPath("finish"); setDraft(null); }} />
        {path === "finish" ? <><Body>Your chapter will close without a new plan. Your tree and history remain available, and you can start a new goal later.</Body><PrimaryButton label="Close this chapter" onPress={() => void finish()} disabled={busy || authBusy} loading={busy} /><QuietButton label="Keep this chapter" onPress={() => setPath(null)} disabled={busy} /></> : null}
        {path === "continue" || path === "change" ? <>
          <Label>Your goal</Label>
          {path === "change" ? <TextInput accessibilityLabel="Your goal" value={goal} onChangeText={value => { setGoal(value); setScreening(null); setScreeningAccepted(false); setDraft(null); }} maxLength={140} style={styles.input} /> : <Body>{goal}</Body>}
          {!safety.safe ? <Body accessibilityRole="alert">{safety.reason}</Body> : null}
          {screeningNeeded ? <PhysicalScreening goal={goal} answer={screening} accepted={screeningAccepted} onAnswer={value => { setScreening(value); setScreeningAccepted(false); setDraft(null); }} onAccept={() => setScreeningAccepted(true)} minor={snapshot.profile?.age_bracket === "13_17"} /> : null}
          <Label>Confirm your target date (YYYY-MM-DD)</Label>
          <TextInput accessibilityLabel="Target date" value={target} onChangeText={value => { setTarget(value); setFirstLeg(false); setDraft(null); }} maxLength={10} style={styles.input} />
          {leg.kind === "invalid" ? <Body>Enter a valid date.</Body> : leg.kind === "too-soon" ? <Body>Choose a date on or after {leg.earliest} for this next chapter.</Body> : leg.kind === "first-leg" ? <><Body>Your target stays {target}. We can plan the first leg through {leg.checkpoint}.</Body><QuietButton label="Plan this first leg" onPress={() => setFirstLeg(true)} /></> : <Body>Planning checkpoint: {leg.end}</Body>}
          {aiAllowed ? <><Body>Your goal, progress summary and these four optional reflection answers will be sent to our server and Google Gemini to draft the next chapter. Avoid sensitive health details.</Body><QuietButton label={permission ? "Selected: Share reflection for AI drafting" : "Allow reflection for AI drafting"} onPress={() => setPermission(!permission)} /></> : <><Body>AI suggestions are off. You can use a clearly labelled local alternative.</Body><QuietButton label="Turn on AI suggestions" onPress={() => setConsentOpen(true)} /></>}
          {!draft ? <><PrimaryButton label="Generate AI draft" onPress={() => void generate(false)} disabled={!valid || busy || !aiAllowed || !permission} loading={busy} /><QuietButton label="Preview local alternative" onPress={() => void generate(true)} disabled={!valid || busy} /></> : <View style={styles.preview}>
            <Label>{draft.plan_source === "ai" ? "AI draft" : draft.plan_source === "mixed" ? "AI and local practices" : "Local alternative"}</Label>
            <Body>Goal: {draft.goal}{"\n"}Target: {draft.target_date}{"\n"}Checkpoint: {leg.kind === "valid" ? leg.end : ""}</Body>
            <Body>{draft.plan_summary}</Body>
            {draft.reality_check ? <Body>{draft.reality_check.level}: {draft.reality_check.explanation}</Body> : null}
            {draft.stages?.map(stage => <Body key={stage.start}>{stage.title}: {stage.outcome}</Body>)}
            {draft.practices.map(practice => <Body key={practice.branch}>{practice.role === "primary" ? "Daily" : "Weekly"}: {practice.title}{"\n"}Week 1: {practice.full_variant.steps.join("; ")}{"\n"}Easy: {practice.easy_variant.title} — {practice.easy_variant.steps.join("; ")}{"\n"}Week 2: {practice.full_variant.ladder?.[0]?.steps.join("; ")}{"\n"}Easy: {practice.easy_variant.ladder?.[0]?.title ?? practice.easy_variant.title} — {(practice.easy_variant.ladder?.[0]?.steps ?? practice.easy_variant.steps).join("; ")}</Body>)}
            <PrimaryButton label="Approve and begin this chapter" onPress={() => void approve()} disabled={busy || authBusy || (draft.plan_source !== "local" && !aiAllowed)} loading={busy} />
            <QuietButton label="Revise answers or try again" onPress={() => setDraft(null)} disabled={busy} />
          </View>}
        </> : null}
        {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
      </ScrollView>
    </View></View>
    <ConsentSheet visible={consentOpen} busy={busy} onAccept={() => { setBusy(true); void recordConsent().then(saved => { if (saved) setConsentOpen(false); }).finally(() => setBusy(false)); }} onDecline={() => setConsentOpen(false)} />
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,32,28,0.45)" },
  sheet: { maxHeight: "92%", backgroundColor: colors.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  header: { paddingHorizontal: 20, paddingTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 28, flex: 1 },
  content: { padding: 20, gap: 12 },
  field: { gap: 6 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: alpha(colors.bone, 0.2), borderRadius: 12, backgroundColor: colors.ink850, color: colors.bone, fontFamily: fonts.sans, fontSize: 14 },
  preview: { gap: 12, padding: 16, borderRadius: 14, backgroundColor: alpha(colors.lichen, 0.12) },
  message: { fontFamily: fonts.sans, color: colors.clay, fontSize: 13, lineHeight: 20 },
});
