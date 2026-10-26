import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useGame } from "../lib/game-context";
import { adherenceFor, reviewDecision, reviewProposal, weekLabel } from "../lib/review";
import { alpha, colors, fonts, hairline } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function WeekReviewCard() {
  const { today, snapshot, submitReview } = useGame();
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (!today?.reviewWeek || dismissed) return null;
  const week = today.reviewWeek;
  const { practiced, adherence } = adherenceFor(snapshot?.events ?? [], week);
  const proposal = decision ? reviewProposal(decision as "lighter" | "same" | "harder") : null;

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
        You practised on {practiced} of 7 days. One question is enough; nothing changes until you choose it.
      </Body>

      {proposal ? (
        <>
          <View style={styles.proposal}>
            <Display style={styles.proposalTitle}>{proposal.title}</Display>
            <Text style={styles.proposalBody}>{proposal.detail}</Text>
          </View>
          {failure ? <Text style={styles.failure} accessibilityRole="alert">{failure}</Text> : null}
          <PrimaryButton label={proposal.confirm} onPress={() => void apply()} loading={busy} disabled={busy} />
          <QuietButton label="Go back" onPress={() => setDecision(null)} disabled={busy} />
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
            placeholder="Anything the week taught you? Optional."
            placeholderTextColor={colors.sageDeep}
            selectionColor={colors.copper}
            accessibilityLabel="Weekly review note"
            style={styles.input}
          />
          <PrimaryButton
            label="See what fits next week"
            onPress={() => difficulty && setDecision(reviewDecision(adherence, difficulty))}
            disabled={!difficulty}
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
