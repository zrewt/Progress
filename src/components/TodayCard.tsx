import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, Clock, Feather } from "lucide-react-native";
import type { Practice } from "../lib/daily-types";
import { useGame } from "../lib/game-context";
import { PILLAR_MAP } from "../lib/pillars";
import { isSupportingDue } from "../lib/today";
import { ladderWeeks, rungFor } from "../lib/engine/week";
import { alpha, colors, fonts, hairline } from "../theme";
import { PillarIcon } from "./PillarIcon";
import { PrimaryButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function TodayCard({ onBegin }: { onBegin: (practice: Practice) => void }) {
  const { today, snapshot } = useGame();
  if (!today) return null;

  const { primary, season, countedToday, easierByDefault, supporting, week } = today;
  const pillar = PILLAR_MAP[primary.branch];
  // The same practice, a step further each week: the plan deepens instead of
  // asking for the identical first action every day.
  const rung = rungFor(primary.full_variant, week);
  const weeks = ladderWeeks(primary.full_variant);
  const countedEvent = today.todayEvents.find((event) => event.kind === "full" || event.kind === "easy");
  const doneEasily = countedEvent?.kind === "easy";
  const seasonEvents = (snapshot?.events ?? []).filter((event) => !event.undone_at && event.season_id === season.id);
  const dueSupporting = supporting.filter((practice) => isSupportingDue(practice, seasonEvents, today.today, season));

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.eyebrowRow}>
          <PillarIcon pillar={primary.branch} size={14} color={pillar.accent} />
          <Label style={{ color: pillar.accent }}>
            {pillar.name} · {season.branch_labels?.[primary.branch] ?? "Your practice"}
          </Label>
        </View>
        <Micro>Day {today.dayNumber}</Micro>
      </View>

      {countedToday ? (
        <>
          <Display style={styles.title}>{doneEasily ? "You showed up gently today." : "Today is recorded."}</Display>
          <Body style={styles.body}>
            {doneEasily
              ? "The easier version counts completely. Nothing is owed because of it."
              : "One practice was enough. The rest of the day is yours."}
          </Body>
          {countedEvent ? (
            <Pressable
              onPress={() => onBegin(primary)}
              accessibilityRole="button"
              accessibilityLabel="Record again or read the practice"
              style={({ pressed }) => [styles.againRow, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.againText}>Read the practice again</Text>
              <ArrowRight size={12} strokeWidth={1.8} color={colors.sage} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <Display style={styles.title}>{rung.title}</Display>
          <Body style={styles.body}>{primary.why}</Body>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={11} strokeWidth={1.6} color={colors.sageDim} />
              <Text style={styles.metaText}>{rung.minutes} min</Text>
            </View>
            <Text style={styles.metaDivider}>·</Text>
            <View style={styles.metaItem}>
              <Feather size={11} strokeWidth={1.8} color={colors.copperLight} />
              <Text style={[styles.metaText, { color: colors.copperLight }]}>
                Easier version: {primary.easy_variant.minutes} min
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <PrimaryButton
              label="Begin today’s practice"
              onPress={() => onBegin(primary)}
              icon={<ArrowRight size={15} strokeWidth={2} color={colors.ink950} />}
            />
          </View>
          <Micro style={styles.hint}>
            {easierByDefault
              ? "Your review asked for a lighter week, so the easier version is offered first."
              : "Two minutes is a real practice. Choose the easier version any day."}
          </Micro>
          {weeks > 1 || today.continuation ? (
            <Micro style={styles.weekNote}>
              {today.continuation ? "Continuation of your approved practice — later detail has not been accepted." : `Week ${week} — approved practice detail.`}
            </Micro>
          ) : null}
        </>
      )}

      {dueSupporting.length ? (
        <View style={styles.supporting}>
          <Micro style={{ color: colors.lichenDim }}>Also available this week</Micro>
          {dueSupporting.map((practice) => {
            const accent = PILLAR_MAP[practice.branch];
            return (
              <Pressable
                key={practice.id}
                onPress={() => onBegin(practice)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${practice.title}`}
                style={({ pressed }) => [styles.supportRow, pressed && { backgroundColor: alpha(colors.bone, 0.04) }]}
              >
                <PillarIcon pillar={practice.branch} size={13} color={accent.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportTitle}>{practice.title}</Text>
                  <Text style={styles.supportMeta}>{accent.name} · {practice.full_variant.minutes} min · optional</Text>
                </View>
                <ArrowRight size={13} strokeWidth={1.6} color={colors.sageDim} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    backgroundColor: alpha(colors.ink850, 0.6),
    padding: 20,
  },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  title: { marginTop: 16, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  body: { marginTop: 9, lineHeight: 21 },
  metaRow: { marginTop: 14, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1, textTransform: "uppercase", color: colors.sageDim },
  metaDivider: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.sageDeep },
  actions: { marginTop: 18 },
  hint: { marginTop: 10, textTransform: "none", letterSpacing: 0.3, lineHeight: 15 },
  weekNote: { marginTop: 6, textTransform: "none", letterSpacing: 0.3, lineHeight: 15, color: colors.copperLight },
  againRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  againText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage },
  supporting: { marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline, gap: 4 },
  supportRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 2 },
  supportTitle: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone },
  supportMeta: { marginTop: 2, fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
});
