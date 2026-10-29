import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowRight, Clock, Feather } from "lucide-react-native";
import type { Practice } from "../lib/daily-types";
import type { MidWeekOffer } from "../lib/adapt";
import { useGame } from "../lib/game-context";
import { PILLAR_MAP } from "../lib/pillars";
import { isSupportingDue } from "../lib/today";
import { ladderWeeks, rungFor } from "../lib/engine/week";
import { alpha, colors, fonts, hairline } from "../theme";
import { PillarIcon } from "./PillarIcon";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function TodayCard({
  onBegin,
}: {
  onBegin: (practice: Practice, options?: { easy?: boolean }) => void;
}) {
  const { today, snapshot, setLighterWeek } = useGame();
  const [dismissed, setDismissed] = useState<MidWeekOffer["kind"][]>([]);
  const [lighterBusy, setLighterBusy] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [showSupporting, setShowSupporting] = useState(false);
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
  const offers = today.offers.filter(
    (offer) => !dismissed.includes(offer.kind) && (offer.kind === "lighter_week" || !countedToday),
  );

  function dismiss(offer: MidWeekOffer) {
    setDismissed((previous) => [...previous, offer.kind]);
  }

  async function accept(offer: MidWeekOffer) {
    if (offer.kind === "easy_today") {
      dismiss(offer);
      onBegin(primary, { easy: true });
      return;
    }
    setLighterBusy(true);
    setOfferError(null);
    const saved = await setLighterWeek();
    setLighterBusy(false);
    if (saved) dismiss(offer);
    else setOfferError("A lighter week could not be saved just now. Nothing has changed.");
  }

  return (
    <View style={[styles.card, countedToday && styles.cardComplete]}>
      <View style={styles.head}>
        <View style={styles.eyebrowRow}>
          <PillarIcon pillar={primary.branch} size={16} color={colors.copper} />
          <Label style={{ color: colors.copper }}>
            {countedToday ? "Today · Complete" : `Your next step · ${pillar.name}`}
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

      {offers.map((offer) => (
        <View key={offer.kind} style={styles.offer}>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.offerBody}>{offer.body}</Text>
          {offerError && offer.kind === "lighter_week" ? (
            <Text style={styles.offerError} accessibilityRole="alert">{offerError}</Text>
          ) : null}
          <View style={styles.offerActions}>
            <QuietButton
              label={lighterBusy && offer.kind === "lighter_week" ? "Saving" : offer.confirm}
              onPress={() => void accept(offer)}
              disabled={lighterBusy}
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={() => dismiss(offer)}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              hitSlop={8}
              style={styles.offerDismiss}
            >
              <Text style={styles.offerDismissText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {dueSupporting.length ? (
        <View style={styles.supporting}>
          <Pressable onPress={() => setShowSupporting((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showSupporting }} style={styles.supportToggle}>
            <Text style={styles.supportToggleText}>Optional practices this week ({dueSupporting.length})</Text>
            <Text style={styles.supportToggleText}>{showSupporting ? "Hide" : "View"}</Text>
          </Pressable>
          {showSupporting ? dueSupporting.map((practice) => {
            const accent = PILLAR_MAP[practice.branch];
            return (
              <Pressable
                key={practice.id}
                onPress={() => onBegin(practice)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${practice.title}`}
                style={({ pressed }) => [styles.supportRow, pressed && { backgroundColor: alpha(colors.bone, 0.04) }]}
              >
                <PillarIcon pillar={practice.branch} size={14} color={colors.sage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.supportTitle}>{practice.title}</Text>
                  <Text style={styles.supportMeta}>{accent.name} · {practice.full_variant.minutes} min · optional</Text>
                </View>
                <ArrowRight size={13} strokeWidth={1.6} color={colors.sageDim} />
              </Pressable>
            );
          }) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.focusBorder,
    borderRadius: 18,
    backgroundColor: colors.focusSurface,
    padding: 20,
  },
  cardComplete: { backgroundColor: colors.ink850, borderColor: hairline },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  title: { marginTop: 16, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
  body: { marginTop: 9, lineHeight: 21 },
  metaRow: { marginTop: 14, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: alpha(colors.ink950, 0.65) },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage },
  metaDivider: { fontFamily: fonts.mono, fontSize: 9.5, color: colors.sageDeep },
  actions: { marginTop: 18 },
  hint: { marginTop: 10, lineHeight: 17 },
  weekNote: { marginTop: 6, textTransform: "none", letterSpacing: 0.3, lineHeight: 15, color: colors.copperLight },
  againRow: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 },
  againText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage },
  offer: {
    marginTop: 16, padding: 14, gap: 6,
    borderLeftWidth: 2, borderLeftColor: colors.copperLight, backgroundColor: alpha(colors.copper, 0.06),
  },
  offerTitle: { fontFamily: fonts.sansMedium, fontSize: 12.5, lineHeight: 18, color: colors.bone },
  offerBody: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.sage },
  offerError: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 16, color: colors.clay },
  offerActions: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 10 },
  offerDismiss: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  offerDismissText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.sage },
  supporting: { marginTop: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline, gap: 4 },
  supportToggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  supportToggleText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.copper },
  supportRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 2 },
  supportTitle: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone },
  supportMeta: { marginTop: 2, fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
});
