import { useMemo, useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDown, ArrowRight, Clock, X } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { IDENTITY_MAP, PILLARS, PILLAR_MAP, ROMAN } from "../lib/pillars";
import {
  completedCount,
  levelStats,
  milestoneForTier,
  nextBestNode,
  pillarProgress,
  seasonProgress,
  weekSummary,
} from "../lib/tree";
import type { TreeNode } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { BotanicalBranch } from "./BotanicalBranch";
import { BrandMark } from "./BrandMark";
import { PillarIcon } from "./PillarIcon";
import { PrimaryButton, LinkButton, Rule } from "./Controls";
import { Body, Display, DisplayItalic, Label, Micro, Mono } from "./Type";
import { SkillTree } from "./SkillTree";
import { NodeModal } from "./NodeModal";
import { TopBar } from "./TopBar";

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
    </View>
  );
}

export function Dashboard() {
  const {
    user,
    profile,
    nodes,
    treeSource,
    error,
    clearError,
    completeNode,
  } = useGame();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [treeY, setTreeY] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  if (!profile) return null;

  const stats = levelStats(profile.xp);
  const identity = IDENTITY_MAP[profile.identity];
  const season = seasonProgress(profile.seasonStartedAt);
  const week = weekSummary(nodes);
  const focus = nextBestNode(nodes, profile.identity);
  const focusPillar = focus ? PILLAR_MAP[focus.pillar] : null;
  const mastered = completedCount(nodes);
  const focusBranch = focus
    ? nodes.filter((node) => node.pillar === focus.pillar).sort((a, b) => a.tier - b.tier)
    : [];
  const nextInBranch = focus
    ? focusBranch.find((node) => node.tier === focus.tier + 1) ?? null
    : null;
  const firstName = (profile.displayName || user?.name || "Athlete").split(" ")[0];
  const bestPillar = PILLARS.map((pillar) => ({
    pillar,
    progress: pillarProgress(nodes, pillar.id),
  })).sort((a, b) => b.progress.done - a.progress.done)[0];

  function handleTreeLayout(event: LayoutChangeEvent) {
    setTreeY(event.nativeEvent.layout.y);
  }

  return (
    <View style={{ flex: 1 }}>
      <TopBar />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: wide ? 32 : 20,
          paddingTop: wide ? 34 : 24,
          paddingBottom: Math.max(insets.bottom, 24) + 24,
          width: "100%",
          maxWidth: 1040,
          alignSelf: "center",
        }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={clearError}
              accessibilityRole="button"
              accessibilityLabel="Dismiss message"
              hitSlop={12}
            >
              <X size={14} strokeWidth={1.6} color={colors.sage} />
            </Pressable>
          </View>
        ) : null}

        <View>
          <Label>
            Season I <Text style={{ color: colors.sageDeep }}>·</Text> Day{" "}
            {season.day} of {season.total}
          </Label>
          <Display style={[styles.hero, wide && styles.heroWide]}>
            You are becoming{"\n"}
            <DisplayItalic
              style={[
                { fontSize: 38, lineHeight: 42, color: colors.lichen },
                wide && { fontSize: 52, lineHeight: 55 },
              ]}
            >
              {identity ? identity.name.toLowerCase() : "your future self"}.
            </DisplayItalic>
          </Display>
          <Body style={styles.heroCopy}>
            Welcome back, {firstName}. Your tree grows from what you actually do,
            not what you plan. One action is enough today.
          </Body>

          <View style={styles.goalPanel}>
            <Micro style={{ color: colors.copperLight }}>Your 30-day goal</Micro>
            <Display style={styles.goalText}>{profile.goal || "One small change"}</Display>
            <View style={styles.chips}>
              <Text style={styles.chipText}>{profile.timeBudget} minutes a day</Text>
              <View style={styles.chipDot} />
              <Text style={styles.chipText}>
                {completedCount(nodes)} of {nodes.length} actions grown
              </Text>
              <View style={styles.chipDot} />
              <Text style={[styles.chipText, { color: colors.lichen }]}>
                {treeSource === "edge-ai"
                  ? "Server AI Plan · Key Hidden"
                  : "Starting Seed Plan · Key Hidden"}
              </Text>
            </View>
          </View>
        </View>

        <View style={wide ? styles.cardsRow : undefined}>
        <View style={[styles.practiceCard, wide && styles.practiceCardWide]}>
          <View pointerEvents="none" style={styles.watermark}>
            <BotanicalBranch height={220} opacity={0.07} />
          </View>

          <View style={styles.practiceHead}>
            <View style={{ flex: 1 }}>
              <Label style={{ color: colors.copperLight }}>
                The next best action
              </Label>
              <Text style={styles.practiceMeta}>
                {focusPillar ? focusPillar.name : "All branches"} · Tier{" "}
                {focus ? ROMAN[focus.tier] : "IV"}
                {focus ? ` · ${milestoneForTier(focus.tier)}` : ""}
              </Text>
            </View>
            {focusPillar ? (
              <DisplayItalic
                style={[styles.practiceRoman, { color: focusPillar.accent }]}
              >
                {focusPillar.roman}
              </DisplayItalic>
            ) : null}
          </View>

          {focus && focusPillar ? (
            <>
              <View style={styles.focusRow}>
                <View style={styles.focusIcon}>
                  <PillarIcon
                    pillar={focus.pillar}
                    size={20}
                    color={focusPillar.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Display style={styles.focusTitle}>{focus.title}</Display>
                  <Body style={styles.focusDescription}>{focus.description}</Body>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={11} strokeWidth={1.6} color={colors.sageDim} />
                  <Text style={styles.metaText}>{focus.duration}</Text>
                </View>
                <Text style={styles.metaDivider}>·</Text>
                <Text style={[styles.metaText, { color: colors.copperLight }]}>
                  +50 XP
                </Text>
                <Text style={styles.metaDivider}>·</Text>
                <Text style={styles.metaText}>
                  {focus.tier < 3
                    ? `Grows toward ${milestoneForTier(focus.tier + 1)}`
                    : "Completes this branch"}
                </Text>
              </View>

              <View style={styles.actions}>
                <PrimaryButton
                  label="Begin practice"
                  onPress={() => setSelectedId(focus.id)}
                  icon={
                    <ArrowRight size={15} strokeWidth={2} color={colors.ink950} />
                  }
                  style={wide ? { minWidth: 220 } : { flexGrow: 1 }}
                />
              </View>

              <LinkButton
                label="See the branch"
                color={colors.sage}
                icon={<ArrowDown size={12} strokeWidth={1.8} color={colors.sage} />}
                onPress={() =>
                  scrollRef.current?.scrollTo({
                    y: Math.max(0, treeY - 8),
                    animated: true,
                  })
                }
              />

              <DisplayItalic style={styles.quote}>
                You do not need a new plan. You need one more repetition.
              </DisplayItalic>

              <View style={styles.branchFooter}>
                <Text style={styles.branchFooterText}>
                  {focusPillar?.name ?? "Branch"}{" "}
                  {focusBranch.filter((node) => node.status === "completed").length}/
                  {focusBranch.length} grown
                </Text>
                <Text numberOfLines={1} style={styles.branchFooterText}>
                  {nextInBranch ? `Next — ${nextInBranch.title}` : "Capstone"}
                </Text>
              </View>
            </>
          ) : (
            <View style={{ marginTop: 18 }}>
              <Display style={{ fontSize: 30, lineHeight: 34 }}>
                The whole canopy is in leaf.
              </Display>
              <Body style={{ marginTop: 10 }}>
                Every practice in this season is complete. Revisit a branch above to
                keep the rhythm, or begin again with a new focus.
              </Body>
            </View>
          )}
        </View>

        <View style={[styles.seasonCard, wide && styles.seasonCardWide]}>
          <Label>Season I</Label>

          <View style={styles.masteredRow}>
            <Display style={styles.masteredNumber}>{season.day}</Display>
            <Text style={styles.masteredCaption}>/ {season.total} days</Text>
          </View>

          <View style={styles.masteredBarTrack}>
            <View
              style={[
                styles.masteredBar,
                { width: `${Math.min(100, (season.day / season.total) * 100)}%` },
              ]}
            />
          </View>

          <View style={styles.statList}>
            <StatRow
              label="Tree grown"
              value={`${mastered} / ${nodes.length} actions`}
            />
            <StatRow
              label="Streak"
              value={`${profile.streak} ${profile.streak === 1 ? "day" : "days"}`}
            />
            <StatRow label="Level" value={String(stats.level)} />
            <StatRow
              label="Strongest branch"
              value={
                bestPillar && bestPillar.progress.done > 0
                  ? bestPillar.pillar.name
                  : "Not yet"
              }
            />
          </View>

          <View style={styles.reviewBlock}>
            <Micro style={{ color: colors.lichenDim }}>This week</Micro>
            <Display style={styles.reviewLine}>
              {week.completed === 0
                ? "Your tree is waiting for its first touch this week."
                : `${week.completed} ${week.completed === 1 ? "action" : "actions"} across ${week.activeDays} ${week.activeDays === 1 ? "day" : "days"}.`}
            </Display>
            <Text style={styles.reviewCopy}>
              {week.completed === 0
                ? "Pick the next best action and begin. A missed day never erases a branch."
                : week.activeDays >= 4
                  ? "That is a rhythm, not a burst. Keep the same small size next week."
                  : "Two more days would make this a pattern. Choose the easiest branch tomorrow."}
            </Text>
          </View>

          <View style={styles.xpBlock}>
            <View style={styles.xpRow}>
              <Text style={styles.xpLabels}>
                {stats.into} / {stats.needed} XP
              </Text>
              <Text style={styles.xpLabels}>Level {stats.level + 1}</Text>
            </View>
            <View style={styles.xpTrack}>
              <View
                style={[
                  styles.xpFill,
                  { width: `${Math.max(2, stats.progress * 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={styles.syncRow}>
            <View style={[styles.syncDot, { backgroundColor: colors.lichen }]} />
            <Text style={styles.syncText}>Synced to Supabase</Text>
          </View>
        </View>

        </View>

        <View onLayout={handleTreeLayout} style={{ marginTop: 44 }}>
          <SkillTree nodes={nodes} onSelect={(node: TreeNode) => setSelectedId(node.id)} />
        </View>

        <View style={styles.footer}>
          <View style={styles.footerBrand}>
            <BrandMark size={22} color={colors.sage} />
            <Display style={styles.footerName}>Vitality Tree</Display>
          </View>
          <Text style={styles.footerCopy}>
            Your life is the game · Your progress grows the tree
          </Text>
        </View>
      </ScrollView>

      <NodeModal
        node={selectedNode}
        goal={profile.goal}
        onClose={() => setSelectedId(null)}
        onComplete={completeNode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    marginBottom: 22,
    borderLeftWidth: 2,
    borderLeftColor: colors.clay,
    backgroundColor: alpha(colors.clay, 0.07),
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.bone,
  },
  hero: { marginTop: 14, fontSize: 38, lineHeight: 42, letterSpacing: -1 },
  heroWide: { fontSize: 52, lineHeight: 55 },
  heroCopy: { marginTop: 14, maxWidth: 360, lineHeight: 21 },
  goalPanel: {
    marginTop: 20,
    borderLeftWidth: 1,
    borderLeftColor: alpha(colors.copper, 0.5),
    paddingLeft: 13,
  },
  goalText: { marginTop: 5, fontSize: 19, lineHeight: 24 },
  chips: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  chipText: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
  chipDot: {
    height: 3,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.sageDeep,
  },

  cardsRow: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
  practiceCardWide: { flex: 1.55 },
  seasonCardWide: { flex: 1, marginTop: 26 },
  practiceCard: {
    marginTop: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    backgroundColor: alpha(colors.ink850, 0.55),
    padding: 20,
    overflow: "hidden",
  },
  watermark: { position: "absolute", right: -30, bottom: 40 },
  practiceHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  practiceMeta: {
    marginTop: 5,
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.sage,
  },
  practiceRoman: { fontSize: 22, lineHeight: 24 },
  focusRow: { marginTop: 22, flexDirection: "row", gap: 14 },
  focusIcon: {
    height: 44,
    width: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: alpha(colors.bone, 0.15),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  focusTitle: { fontSize: 27, lineHeight: 30, letterSpacing: -0.8 },
  focusDescription: { marginTop: 9, fontSize: 13, lineHeight: 21 },
  metaRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.sageDim,
  },
  metaDivider: { fontFamily: fonts.mono, fontSize: 9, color: colors.sageDeep },
  actions: { marginTop: 20, flexDirection: "row" },
  quote: {
    marginTop: 22,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    fontSize: 15,
    lineHeight: 23,
    color: colors.sage,
    maxWidth: 330,
  },
  branchFooter: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  branchFooterText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.sageDeep,
  },

  seasonCard: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    padding: 20,
  },
  masteredRow: { marginTop: 16, flexDirection: "row", alignItems: "baseline", gap: 8 },
  masteredNumber: { fontSize: 48, lineHeight: 48 },
  masteredCaption: { fontFamily: fonts.sans, fontSize: 11, color: colors.sage },
  masteredBarTrack: {
    marginTop: 14,
    height: 1,
    backgroundColor: alpha(colors.bone, 0.15),
  },
  masteredBar: { height: 1, backgroundColor: colors.lichen },
  statList: {
    marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
  },
  statLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.sage },
  statValue: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.bone, flexShrink: 1 },
  xpBlock: { marginTop: 16 },
  xpRow: { flexDirection: "row", justifyContent: "space-between" },
  xpLabels: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.sage,
  },
  xpTrack: { marginTop: 7, height: 1, backgroundColor: alpha(colors.bone, 0.15) },
  xpFill: { height: 1, backgroundColor: colors.lichen },
  reviewBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
  },
  reviewLine: { marginTop: 6, fontSize: 17, lineHeight: 22 },
  reviewCopy: {
    marginTop: 6,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 18,
    color: colors.sage,
  },
  syncRow: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 7 },
  syncDot: { height: 4, width: 4, borderRadius: 2 },
  syncText: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },

  footer: {
    marginTop: 44,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    gap: 8,
  },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 9 },
  footerName: { fontSize: 16 },
  footerCopy: { fontFamily: fonts.sans, fontSize: 10.5, lineHeight: 18, color: colors.sage },
});
