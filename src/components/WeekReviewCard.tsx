import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useGame } from "../lib/game-context";
import { adherenceFor, reviewDecision, reviewProposal, weekLabel } from "../lib/review";
import { suggestReviewPractice, suggestWeeklyDetail } from "../lib/gemini";
import { checkpointWeek, localWeeklyAlternative } from "../lib/engine/rolling";
import { daysBetween } from "../lib/progression";
import type { WeeklyDraft } from "../../supabase/functions/generate-tree/plan-validation";
import type { PracticeDraft } from "../lib/daily-types";
import { alpha, colors, fonts } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function WeekReviewCard() {
  const { today, snapshot, submitReview, replacePractice, acceptWeek, aiAllowed } = useGame();
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDraft | null>(null);
  const [suggestion, setSuggestion] = useState<PracticeDraft | null>(null);

  if (!today?.reviewWeek || dismissed) return null;
  const week = today.reviewWeek;
  const { practiced, adherence, denominator } = adherenceFor((snapshot?.events ?? []).filter(e => e.season_id === today.season.id), week, today.season.season_length_days ? today.season.ends_on : undefined);
  const effectiveWeek = checkpointWeek(today.season, today.today);
  const currentPractices = [today.primary, ...today.supporting];
  const proposal = decision ? reviewProposal(decision as "lighter" | "same" | "harder") : null;

  async function propose() {
    if (!today || !difficulty) return;
    setBusy(true); setFailure(null);
    setDecision(reviewDecision(adherence, difficulty));
    if (today.season.season_length_days && effectiveWeek) {
      const season = today.season;
      const draft = await suggestWeeklyDetail({ identity: season.identity, goal: season.goal, blocker: season.blocker, timeBudget: String(season.minutes_budget), targetDate: season.target_date ?? undefined, legEnd: season.ends_on, daysRemaining: Math.max(0, daysBetween(today.today, season.ends_on)), context: season.personalization_context ?? [] }, season.id, currentPractices, effectiveWeek, season.plan_version, note, difficulty, aiAllowed);
      setWeekly(draft);
      if (!draft) setFailure("Weekly detail is unavailable. Your approved practice continues. Retry or choose the local easy alternative.");
    } else if (aiAllowed && note.trim() && !today.season.season_length_days) {
      const season = today.season;
      const draft = await suggestReviewPractice({ identity: season.identity, goal: season.goal, blocker: season.blocker, timeBudget: String(season.minutes_budget), context: season.personalization_context ?? [] }, today.primary, note, practiced, true);
      setSuggestion(draft);
      if (!draft) setFailure("A suggested change was unavailable. You can keep your current practice.");
    }
    setBusy(false);
  }

  async function acceptSuggestion() {
    if (!today || !suggestion) return;
    setBusy(true); setFailure(null);
    const replaced = await replacePractice(today.primary.id, suggestion);
    setBusy(false);
    if (replaced) { setSuggestion(null); setFailure("Practice changed. Save your review below."); }
    else setFailure("The practice could not be changed. Your plan is unchanged.");
  }

  async function apply() {
    if (!decision) return;
    setBusy(true); setFailure(null);
    const saved = await submitReview(week, difficulty ?? 3, note.trim() || null, true);
    setBusy(false);
    if (saved) setDismissed(true); else setFailure("This could not be saved. Your plan has not changed.");
  }

  return (
    <View style={styles.card}>
      <Label style={{ color: colors.copperLight }}>{weekLabel(week, today.season.started_on)} · your review</Label>
      <Display style={styles.title}>How did this week feel?</Display>
      <Body style={styles.body}>
        You practised on {practiced} of {denominator} days. One question is enough; nothing changes until you choose it.
      </Body>

      {proposal ? (
        <>
          <View style={styles.proposal}>
            <Display style={styles.proposalTitle}>{proposal.title}</Display>
            <Text style={styles.proposalBody}>{proposal.detail}</Text>
          </View>
          {today.season.season_length_days && effectiveWeek ? <View style={styles.proposal}>
            <Body>Week {effectiveWeek}: {weekly?.source === "local" ? "Local easy alternative" : "AI proposal — not yet applied"}</Body>
            {weekly?.practices.map(p => <View key={p.practice_id} style={{ gap: 6 }}><Body>Current: {currentPractices.find(c => c.id === p.practice_id)?.full_variant.steps.join("; ")}</Body><Body>Proposed: {p.title} ({p.full_variant.minutes} min){"\n"}{p.full_variant.steps.join("\n")}{"\n"}Easy: {p.easy_variant.steps.join("; ")}</Body></View>)}
            {weekly ? <QuietButton label="Accept proposed week" disabled={busy || (weekly.source === "ai" && !aiAllowed)} onPress={() => { setBusy(true); void acceptWeek(weekly).then(ok => { if (ok) { setWeekly(null); setFailure("Week accepted. Save your review below."); } else setFailure("Nothing changed. Refresh and retry."); }).finally(() => setBusy(false)); }} /> : null}
            <QuietButton label="Retry weekly detail" disabled={busy || !aiAllowed} onPress={() => void propose()} />
            <QuietButton label="Preview local easy alternative" disabled={busy} onPress={() => setWeekly(localWeeklyAlternative(currentPractices, effectiveWeek, today.season.plan_version))} />
            <QuietButton label="Keep approved practices" disabled={busy} onPress={() => setWeekly(null)} />
          </View> : null}
          {suggestion ? <View style={styles.proposal}>
            <Body>Current: {today.primary.title}{"\n"}{today.primary.full_variant.steps.join("\n")}</Body>
            <Body>Suggested: {suggestion.title}{"\n"}{suggestion.why}</Body>
            {suggestion.full_variant.steps.map((step, index) => <Body key={index}>{step}</Body>)}
            <QuietButton label="Use suggested practice" onPress={() => void acceptSuggestion()} disabled={busy} />
            <QuietButton label="Keep current practice" onPress={() => setSuggestion(null)} disabled={busy} />
          </View> : null}
          {failure ? <Text style={styles.failure} accessibilityRole="alert">{failure}</Text> : null}
          <PrimaryButton label={proposal.confirm} onPress={() => void apply()} loading={busy} disabled={busy} />
          <QuietButton label="Go back" onPress={() => { setSuggestion(null); setDecision(null); }} disabled={busy} />
        </>
      ) : (
        <>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map((value) => {
              const selected = difficulty === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setDifficulty(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Difficulty ${value} of 5`}
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  <Text style={[styles.chipText, selected && { color: colors.ink950 }]}>{value}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.scaleRow}>
            <Micro>Easy</Micro>
            <Micro>Very hard</Micro>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            maxLength={280}
            placeholder="What made this easier or harder? Avoid sensitive health details."
            placeholderTextColor={colors.sageDeep}
            selectionColor={colors.copper}
            accessibilityLabel="Weekly review note"
            style={styles.input}
          />
          <PrimaryButton
            label="See what fits next week"
            onPress={() => void propose()}
            loading={busy}
            disabled={!difficulty || busy}
          />
          <Pressable onPress={() => setDismissed(true)} accessibilityRole="button" accessibilityLabel="Review later" style={styles.later}>
            <Text style={styles.laterText}>Not now</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.copper, 0.4),
    backgroundColor: alpha(colors.copper, 0.06), padding: 18, gap: 10,
  },
  title: { fontSize: 22, lineHeight: 26 },
  body: { lineHeight: 20 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.2) },
  chipOn: { backgroundColor: colors.lichen, borderColor: colors.lichen },
  chipText: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.bone },
  scaleRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  input: {
    minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.18),
    borderRadius: 2, padding: 10, color: colors.bone, fontFamily: fonts.sans, fontSize: 13,
  },
  proposal: { borderLeftWidth: 2, borderLeftColor: colors.lichen, paddingLeft: 12, gap: 6 },
  proposalTitle: { fontSize: 20, lineHeight: 24 },
  proposalBody: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 19, color: colors.sage },
  later: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  laterText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.sage },
  failure: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.clay },
});
