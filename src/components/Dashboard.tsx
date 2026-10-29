import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { daysBetween } from "../lib/progression";
import { syncMessage } from "../lib/sync-status";
import { chapterReviewReason } from "../lib/engine/chapter";
import type { Practice } from "../lib/daily-types";
import type { TreeNode } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { BrandMark } from "./BrandMark";
import { QuietButton } from "./Controls";
import { Display, Label, Micro } from "./Type";
import { SkillTree } from "./SkillTree";
import { TodayCard } from "./TodayCard";
import { PracticeSheet } from "./PracticeSheet";
import { WeekReviewCard } from "./WeekReviewCard";
import { EditPlanSheet, SeasonHistory, SeasonSummarySheet } from "./PlanSheets";
import { TopBar } from "./TopBar";
import { ChapterReview } from "./ChapterReview";

export function Dashboard() {
  const { user, profile, nodes, today, error, clearError, undoOffer, undoEvent, dismissUndo, retryLoad, queueCount, syncState, syncNow } = useGame();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [active, setActive] = useState<Practice | null>(null);
  // Set only when the person accepted the fixed-rule offer to use the easier version.
  const [easyRequested, setEasyRequested] = useState(false);
  const [editing, setEditing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showTree, setShowTree] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chapterOpen, setChapterOpen] = useState(false);
  const [chapterDismissed, setChapterDismissed] = useState(false);

  if (!profile || !today) return null;

  const firstName = (profile.displayName || user?.name || "").split(" ")[0];
  const season = today.season;
  const daysLeft = Math.max(0, daysBetween(today.today, season.ends_on));
  const grown = nodes.filter((node) => node.status === "completed").length;
  const chapterReason = chapterReviewReason(season, today.today, nodes.length, grown);
  const sync = syncMessage(syncState, queueCount);
  const begin = (practice: Practice, options?: { easy?: boolean }) => {
    setEasyRequested(!!options?.easy);
    setActive(practice);
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: wide ? 32 : 20,
          paddingTop: wide ? 30 : 20,
          paddingBottom: Math.max(insets.bottom, 24) + 28,
          width: "100%",
          maxWidth: 1040,
          alignSelf: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
            <Pressable onPress={clearError} accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={12}>
              <X size={14} strokeWidth={1.6} color={colors.sage} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.seasonRow}>
          <Label>
            Season · Day {today.dayNumber} of {season.season_length_days ?? 30}
          </Label>
          <Micro>{daysLeft} days left</Micro>
        </View>

        <Display style={[styles.greeting, wide && styles.greetingWide]}>
          {firstName ? `Hello, ${firstName}.` : "Your next step."}
        </Display>
        <Text style={styles.goalLine}>{season.goal}</Text>
        {season.season_length_days ? <Micro style={{ marginTop: 8, textTransform: "none" }}>{today.pace}</Micro> : null}

        {today.welcomeBack ? (
          <View style={styles.welcome}>
            <Display style={styles.welcomeTitle}>Welcome back.</Display>
            <Text style={styles.welcomeBody}>
              A gap is not a failure, and nothing here has been taken away. The easiest version is waiting, and that is
              a complete day.
            </Text>
            <QuietButton label="Start again, gently" onPress={() => setActive(today.primary)} />
          </View>
        ) : null}

        {chapterReason && !chapterDismissed ? <View style={styles.chapterCard}>
          <Display style={styles.chapterTitle}>{chapterReason === "ended" ? "Ready to reflect on this chapter?" : "Your tree has grown. Would you like to review what’s next?"}</Display>
          <Text style={styles.chapterCopy}>Look back and choose what comes next. Your current plan stays until you decide.</Text>
          <QuietButton label="Review this chapter" onPress={() => setChapterOpen(true)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Review this chapter later" onPress={() => setChapterDismissed(true)} style={styles.chapterLater}><Text style={styles.chapterLaterText}>Not now</Text></Pressable>
        </View> : null}

        <TodayCard onBegin={begin} />

        <WeekReviewCard />

        <View style={styles.treeBlock}>
          <Pressable onPress={() => setShowTree((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showTree }} style={styles.disclosure}>
            <View style={styles.disclosureText}>
              <Text style={styles.disclosureTitle}>Your tree</Text>
              <Text style={styles.disclosureDetail}>{grown} of {nodes.length} milestones grown</Text>
            </View>
            {showTree ? <ChevronUp size={19} color={colors.sage} /> : <ChevronDown size={19} color={colors.sage} />}
          </Pressable>
          {showTree ? <SkillTree nodes={nodes} onSelect={(node: TreeNode) => {
            const practice = today.primary.id === node.id ? today.primary : today.supporting.find((item) => item.id === node.id);
            if (practice) setActive(practice);
          }} /> : null}
        </View>

        <View style={styles.historyBlock}>
          <Pressable onPress={() => setShowHistory((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showHistory }} style={styles.disclosure}>
            <View style={styles.disclosureText}>
              <Text style={styles.disclosureTitle}>Recent activity</Text>
              <Text style={styles.disclosureDetail}>Your last seven days</Text>
            </View>
            {showHistory ? <ChevronUp size={19} color={colors.sage} /> : <ChevronDown size={19} color={colors.sage} />}
          </Pressable>
          {showHistory ? today.recent.map((day) => {
            const counted = day.events.find((event) => event.kind === "full" || event.kind === "easy");
            const undone = day.events.length === 0;
            const label = counted
              ? counted.kind === "easy"
                ? "Easier version"
                : "Full practice"
              : day.rest
                ? "Rest day"
                : undone
                  ? "Nothing recorded"
                  : "Skipped";
            const accent = counted ? colors.lichen : day.rest ? colors.heather : colors.sageDeep;
            return (
              <View key={day.date} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: accent }]} />
                <Text style={styles.historyDate}>{day.date.slice(5)}</Text>
                <Text style={styles.historyLabel}>{label}</Text>
                {counted && counted.local_date === today.today ? (
                  <Pressable
                    onPress={() => void undoEvent(counted.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Undo ${label} on ${day.date}`}
                    hitSlop={10}
                    style={styles.undoLink}
                  >
                    <RotateCcw size={12} strokeWidth={1.8} color={colors.sage} />
                    <Text style={styles.undoText}>Undo</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          }) : null}
        </View>

        <View style={styles.footerBlock}>
          <View style={styles.footerActions}>
            <QuietButton label="Edit goal or time" onPress={() => setEditing(true)} style={{ flex: 1 }} />
            <QuietButton label="Finish this season" onPress={() => setFinishing(true)} style={{ flex: 1 }} />
          </View>
          <SeasonHistory />
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, { backgroundColor: syncState === "error" || syncState === "unsaved" ? colors.clay : syncState === "idle" ? colors.lichen : colors.ochre }]} />
            <Text style={styles.syncText} accessibilityRole="text">{sync.text}</Text>
            {!sync.retry ? null : (
              <Pressable onPress={() => void syncNow()} accessibilityRole="button" accessibilityLabel="Try syncing now" hitSlop={10} style={styles.syncRetry}>
                <Text style={styles.syncRetryText}>Try now</Text>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => void retryLoad()} accessibilityRole="button" accessibilityLabel="Refresh your journal" style={styles.refresh}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <BrandMark size={22} color={colors.sage} />
            <Display style={styles.footerName}>Vitality Tree</Display>
          </View>
          <Text style={styles.footerCopy}>Your life is the game · Your progress grows the tree</Text>
        </View>
      </ScrollView>

      {undoOffer ? (
        <View style={[styles.undoBar, { bottom: Math.max(insets.bottom, 14) }]} accessibilityRole="alert">
          <Text style={styles.undoBarText}>{undoOffer.label}</Text>
          <Pressable onPress={() => void undoEvent(undoOffer.eventId)} accessibilityRole="button" accessibilityLabel="Undo this entry" style={styles.undoBarButton}>
            <Text style={styles.undoBarButtonText}>Undo</Text>
          </Pressable>
          <Pressable onPress={dismissUndo} accessibilityRole="button" accessibilityLabel="Dismiss undo" hitSlop={10}>
            <X size={14} strokeWidth={1.8} color={colors.sage} />
          </Pressable>
        </View>
      ) : null}

      {active ? (
        <PracticeSheet
          key={active.id}
          practice={active}
          defaultEasy={(today.easierByDefault || easyRequested) && active.id === today.primary.id}
          onClose={() => { setActive(null); setEasyRequested(false); }}
        />
      ) : null}
      {chapterOpen ? <ChapterReview onClose={() => setChapterOpen(false)} /> : null}
      {editing ? <EditPlanSheet visible onClose={() => setEditing(false)} /> : null}
      {finishing ? <SeasonSummarySheet visible onClose={() => setFinishing(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chapterCard: { marginTop: 18, padding: 18, borderRadius: 16, backgroundColor: alpha(colors.copper, 0.12), gap: 10 },
  chapterTitle: { fontSize: 23, lineHeight: 28 },
  chapterCopy: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20, color: colors.sage },
  chapterLater: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  chapterLaterText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage },
  errorBanner: {
    marginBottom: 18, borderLeftWidth: 2, borderLeftColor: colors.clay, backgroundColor: alpha(colors.clay, 0.07),
    paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start", gap: 10,
  },
  errorText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 19, color: colors.bone },
  seasonRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  greeting: { marginTop: 12, fontSize: 32, lineHeight: 36, letterSpacing: -0.9 },
  greetingWide: { fontSize: 40, lineHeight: 44 },
  goalLine: { marginTop: 8, fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.boneDim },
  welcome: {
    marginTop: 16, padding: 16, gap: 9, borderLeftWidth: 2, borderLeftColor: colors.lichen,
    backgroundColor: alpha(colors.lichen, 0.06),
  },
  welcomeTitle: { fontSize: 22, lineHeight: 25 },
  welcomeBody: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 20, color: colors.sage },
  treeBlock: { marginTop: 24 },
  disclosure: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 18, backgroundColor: colors.ink850, borderRadius: 14, borderWidth: 1, borderColor: alpha(colors.bone, 0.14) },
  disclosureText: { flex: 1, gap: 4 },
  disclosureTitle: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.bone },
  disclosureDetail: { fontFamily: fonts.sans, fontSize: 12, color: colors.sage },
  historyBlock: { marginTop: 10 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
  historyDot: { height: 5, width: 5, borderRadius: 3 },
  historyDate: { width: 46, fontFamily: fonts.mono, fontSize: 10, color: colors.sageDim },
  historyLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.boneDim },
  undoLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 42, paddingHorizontal: 4 },
  undoText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.sage },
  footerBlock: { marginTop: 26 },
  footerActions: { flexDirection: "row", gap: 9 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 14 },
  syncDot: { height: 5, width: 5, borderRadius: 3 },
  syncText: { flex: 1, fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
  syncRetry: { minHeight: 36, justifyContent: "center", paddingHorizontal: 4 },
  syncRetryText: { fontFamily: fonts.sansMedium, fontSize: 10.5, color: colors.copperLight, textDecorationLine: "underline" },
  refresh: { minHeight: 44, justifyContent: "center", marginTop: 4 },
  refreshText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.sageDim },
  footer: { marginTop: 30, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hairline, gap: 8 },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  footerName: { fontSize: 16 },
  footerCopy: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 18, color: colors.sage },
  undoBar: {
    position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.ink700, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(colors.bone, 0.16),
  },
  undoBarText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.bone },
  undoBarButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 10, backgroundColor: colors.lichen, borderRadius: 2 },
  undoBarButtonText: { fontFamily: fonts.sansSemi, fontSize: 11.5, color: colors.ink950 },
});
