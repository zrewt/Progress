import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { Check, Clock, Lock, Play } from "lucide-react-native";
import { PILLARS, ROMAN } from "../lib/pillars";
import { firstActiveNode, pillarProgress } from "../lib/tree";
import type { NodeStatus, PillarId, TreeNode } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { BrandMark } from "./BrandMark";
import { PillarIcon } from "./PillarIcon";
import { Breathe, Body, Display, DisplayItalic, Label, Micro } from "./Type";

const VIEW_W = 1000;
const VIEW_H = 640;
const ROOT_Y = 612;

const LANES = [
  { x: 148, ys: [520, 404, 296, 184], offsets: [0, -24, 17, -11] },
  { x: 388, ys: [476, 372, 260, 164], offsets: [13, -11, 20, 0] },
  { x: 612, ys: [492, 368, 280, 156], offsets: [-13, 11, -20, 0] },
  { x: 852, ys: [508, 396, 288, 176], offsets: [0, 24, -17, 11] },
];

const STATUS_LABEL: Record<NodeStatus, string> = {
  locked: "Locked",
  active: "Ready",
  completed: "Complete",
};

const STROKE: Record<NodeStatus, string> = {
  completed: colors.lichen,
  active: colors.copper,
  locked: alpha(colors.bone, 0.3),
};

function NodeGlyph({ status, size = 18 }: { status: NodeStatus; size?: number }) {
  if (status === "completed") {
    return <Check size={size} strokeWidth={2.3} color={colors.ink950} />;
  }
  if (status === "active") {
    return <Play size={size - 2} strokeWidth={2} color={colors.ink950} />;
  }
  return <Lock size={size - 5} strokeWidth={1.6} color={colors.sageDim} />;
}

export function SkillTree({
  nodes,
  onSelect,
  readOnly = false,
}: {
  nodes: TreeNode[];
  onSelect: (node: TreeNode) => void;
  readOnly?: boolean;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [selectedPillar, setSelectedPillar] = useState<PillarId>(
    () => firstActiveNode(nodes)?.pillar ?? PILLARS[0].id,
  );

  const branches = useMemo(
    () =>
      PILLARS.map((pillar) => ({
        pillar,
        nodes: nodes
          .filter((node) => node.pillar === pillar.id)
          .sort((a, b) => a.tier - b.tier),
      })),
    [nodes],
  );

  const mobileBranch =
    branches.find((branch) => branch.pillar.id === selectedPillar) ?? branches[0];
  const completed = nodes.filter((node) => node.status === "completed").length;

  return (
    <View>
      <View style={[styles.sectionHead, { marginTop: 20 }]}>
        <View style={{ flex: 1 }}>
          <Label>The progression</Label>
          <Display style={styles.sectionTitle}>The four branches</Display>
          <Body style={styles.sectionCopy}>
            {readOnly ? "This chapter’s milestones are shown as they were earned." : "Each branch holds four milestones. Your completed milestones stay grown."}
          </Body>
        </View>
        <View style={styles.countBlock}>
          <Display style={styles.countNumber}>{completed}</Display>
          <Text style={styles.countCaption}>/ {nodes.length} complete</Text>
        </View>
      </View>
      {wide ? <View style={styles.sectionRule} /> : null}

      {wide ? (
        <>
          <View style={styles.laneRow}>
            {branches.map(({ pillar, nodes: branchNodes }, lane) => {
              const progress = pillarProgress(branchNodes, pillar.id);
              return (
                <View
                  key={pillar.id}
                  style={[
                    styles.laneLabel,
                    { left: `${(LANES[lane].x / VIEW_W) * 100}%` },
                  ]}
                >
                  <DisplayItalic style={[styles.laneRoman, { color: colors.copper }]}>
                    {pillar.roman}
                  </DisplayItalic>
                  <Text style={styles.laneName}>{pillar.name}</Text>
                  <Text style={styles.laneMeta}>
                    {progress.done}/{progress.total} · {pillar.subtitle}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.tree}>
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <G fill="none" strokeLinecap="round">
                <Path
                  d="M500 616C492 556 506 496 499 436C493 382 505 328 500 268"
                  stroke={alpha(colors.bone, 0.32)}
                  strokeWidth={1.4}
                  vectorEffect="non-scaling-stroke"
                />
                <Path
                  d="M508 616C500 556 514 496 507 436C501 382 513 328 508 268"
                  stroke={alpha(colors.bone, 0.1)}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <Path
                  d="M500 616C487 622 475 626 463 632"
                  stroke={alpha(colors.bone, 0.12)}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <Path
                  d="M500 616C513 622 525 626 537 632"
                  stroke={alpha(colors.bone, 0.12)}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />

                {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                  const target = {
                    x: LANES[lane].x + LANES[lane].offsets[0],
                    y: LANES[lane].ys[0],
                  };
                  const first = branchNodes[0];
                  const state: NodeStatus =
                    first?.status === "completed"
                      ? "completed"
                      : first?.status === "active"
                        ? "active"
                        : "locked";
                  const path = `M500 ${ROOT_Y}C500 ${ROOT_Y - 28}, 500 556, 500 556C500 548, ${
                    target.x
                  } ${target.y + 50}, ${target.x} ${target.y + 28}`;
                  return (
                    <G key={pillar.id}>
                      {state !== "locked" ? (
                        <Path
                          d={path}
                          stroke={STROKE[state]}
                          strokeOpacity={0.18}
                          strokeWidth={6.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      <Path
                        d={path}
                        stroke={STROKE[state]}
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                    </G>
                  );
                })}

                {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                  const coords = LANES[lane].ys.map((y, tier) => ({
                    x: LANES[lane].x + LANES[lane].offsets[tier],
                    y,
                  }));
                  return coords.slice(0, 3).map((point, tier) => {
                    const above = coords[tier + 1];
                    const lower = branchNodes[tier];
                    const upper = branchNodes[tier + 1];
                    const state: NodeStatus =
                      lower?.status === "completed"
                        ? "completed"
                        : upper?.status === "active"
                          ? "active"
                          : "locked";
                    const path = `M${point.x} ${point.y - 30}C${point.x} ${
                      point.y - 64
                    }, ${above.x} ${above.y + 64}, ${above.x} ${above.y + 30}`;
                    return (
                      <G key={`${pillar.id}-${tier}`}>
                        {state !== "locked" ? (
                          <Path
                            d={path}
                            stroke={STROKE[state]}
                            strokeOpacity={0.11}
                            strokeWidth={6.5}
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : null}
                        <Path
                          d={path}
                          stroke={STROKE[state]}
                          strokeWidth={1.5}
                          vectorEffect="non-scaling-stroke"
                        />
                      </G>
                    );
                  });
                })}

                {branches.map(({ pillar, nodes: branchNodes }, lane) => {
                  const tip = LANES[lane];
                  const x = tip.x + tip.offsets[3];
                  const y = tip.ys[3] - 46;
                  const done = branchNodes[3]?.status === "completed";
                  return (
                    <G
                      key={`leaf-${pillar.id}`}
                      stroke={pillar.accent}
                      strokeWidth={1}
                      strokeOpacity={done ? 0.7 : 0.32}
                      fill={pillar.accent}
                      fillOpacity={done ? 0.13 : 0.05}
                    >
                      <Path
                        d={`M${x} ${y}C${x - 9} ${y - 8}, ${x - 10} ${
                          y - 24
                        }, ${x} ${y - 34}C${x + 10} ${y - 24}, ${x + 9} ${
                          y - 8
                        }, ${x} ${y}Z`}
                        vectorEffect="non-scaling-stroke"
                      />
                      <Path
                        d={`M${x + 2} ${y + 8}C${x + 13} ${y + 3}, ${x + 20} ${
                          y - 8
                        }, ${x + 15} ${y - 18}C${x + 6} ${y - 12}, ${x + 1} ${
                          y - 2
                        }, ${x + 2} ${y + 8}Z`}
                        vectorEffect="non-scaling-stroke"
                      />
                    </G>
                  );
                })}
              </G>
            </Svg>

            <View style={styles.rootMark}>
              <BrandMark size={24} color={colors.sage} />
            </View>

            {branches.map(({ pillar, nodes: branchNodes }, lane) =>
              branchNodes.map((node) => {
                const locked = node.status === "locked";
                const completedNode = node.status === "completed";
                const active = node.status === "active";
                const x = LANES[lane].x + LANES[lane].offsets[node.tier];
                const y = LANES[lane].ys[node.tier];

                return (
                  <Pressable
                    // Four tiers share one practice id, so the tier is what makes a node unique.
                    key={`${node.id}-${node.tier}`}
                    disabled={locked || readOnly}
                    onPress={() => onSelect(node)}
                    accessibilityRole="button"
                    accessibilityLabel={`${pillar.name}, tier ${
                      node.tier + 1
                    }: ${node.title} (${STATUS_LABEL[node.status]})`}
                    style={({ pressed }) => [
                      styles.treeNode,
                      {
                        left: `${(x / VIEW_W) * 100}%`,
                        top: `${(y / VIEW_H) * 100}%`,
                        opacity: pressed && !locked ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.nodeCircle,
                        completedNode
                          ? { borderColor: colors.lichen, backgroundColor: colors.lichen }
                          : active
                            ? { borderColor: colors.bone, backgroundColor: colors.bone }
                            : {
                                borderColor: alpha(colors.bone, 0.15),
                                backgroundColor: "transparent",
                              },
                      ]}
                    >
                      {active ? (
                        <Breathe
                          style={styles.activeRing}
                          scaleTo={1.04}
                          minOpacity={0.55}
                          duration={4500}
                        >
                          <View style={styles.activeRingInner} />
                        </Breathe>
                      ) : null}
                      <NodeGlyph status={node.status} />
                    </View>

                    <View style={styles.nodeLabel}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.nodeTitle,
                          { color: locked ? colors.sageDim : colors.bone },
                        ]}
                      >
                        {node.title}
                      </Text>
                      <Text
                        style={[
                          styles.nodeMeta,
                          {
                            color: active
                              ? colors.copperLight
                              : completedNode
                                ? colors.lichenDim
                                : colors.sageDeep,
                          },
                        ]}
                      >
                        {active
                          ? `BEGIN · ${node.duration}`
                          : completedNode
                            ? "COMPLETE"
                            : node.duration.toUpperCase()}
                      </Text>
                    </View>
                  </Pressable>
                );
              }),
            )}
          </View>
        </>
      ) : (
        <>
          <View style={[styles.tabs, wide ? null : { marginTop: 10 }]}>
            {PILLARS.map((pillar) => {
              const selected = pillar.id === mobileBranch.pillar.id;
              const progress = pillarProgress(nodes, pillar.id);
              return (
                <Pressable
                  key={pillar.id}
                  onPress={() => setSelectedPillar(pillar.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.tab,
                    selected && styles.tabSelected,
                    pressed && !selected && { backgroundColor: alpha(colors.bone, 0.02) },
                  ]}
                >
                  <DisplayItalic
                    style={[
                      styles.tabRoman,
                      { color: selected ? colors.copper : colors.sageDim },
                    ]}
                  >
                    {pillar.roman}
                  </DisplayItalic>
                  <Text
                    style={[
                      styles.tabName,
                      { color: selected ? colors.bone : colors.sage },
                    ]}
                  >
                    {pillar.name}
                  </Text>
                  <Text style={styles.tabCount}>
                    {progress.done}/{progress.total}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.branchPanel}>
            <View style={styles.branchHeader}>
              <View style={{ flex: 1 }}>
                <DisplayItalic
                  style={[styles.branchRoman, { color: colors.copper }]}
                >
                  Branch {mobileBranch.pillar.roman}
                </DisplayItalic>
                <Display style={styles.branchName}>
                  {mobileBranch.pillar.name}
                </Display>
                <Text style={styles.branchSub}>{mobileBranch.pillar.subtitle}</Text>
              </View>
              <View style={styles.branchIcon}>
                <PillarIcon
                  pillar={mobileBranch.pillar.id}
                  size={17}
                  color={colors.sage}
                />
              </View>
            </View>

            {mobileBranch.nodes.map((node, index) => {
              const locked = node.status === "locked";
              const completedNode = node.status === "completed";
              const active = node.status === "active";
              const isLast = index === mobileBranch.nodes.length - 1;

              return (
                <Pressable
                  key={`${node.id}-${node.tier}`}
                  disabled={locked || readOnly}
                  onPress={() => onSelect(node)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tier ${node.tier + 1}: ${node.title} (${STATUS_LABEL[node.status]})`}
                  style={({ pressed }) => [
                    styles.branchNode,
                    active && { backgroundColor: alpha(colors.bone, 0.035) },
                    completedNode && { backgroundColor: alpha(colors.lichen, 0.025) },
                    pressed && !locked && { backgroundColor: alpha(colors.bone, 0.05) },
                    isLast && { borderBottomWidth: 0 },
                  ]}
                >
                  {active ? <View style={styles.activeBar} /> : null}

                  <View style={styles.rail}>
                    {!isLast ? (
                      <View
                        style={[
                          styles.railLine,
                          {
                            backgroundColor: completedNode
                              ? alpha(colors.lichen, 0.3)
                              : alpha(colors.bone, 0.1),
                          },
                        ]}
                      />
                    ) : null}
                    <View
                      style={[
                        styles.railCircle,
                        completedNode
                          ? {
                              borderColor: colors.lichen,
                              backgroundColor: colors.lichen,
                            }
                          : active
                            ? { borderColor: colors.bone, backgroundColor: colors.bone }
                            : {
                                borderColor: alpha(colors.bone, 0.15),
                                backgroundColor: colors.canvas,
                              },
                      ]}
                    >
                      <NodeGlyph status={node.status} size={16} />
                    </View>
                  </View>

                  <View style={styles.branchCopy}>
                    <View style={styles.branchMetaRow}>
                      <Micro style={{ color: colors.sageDim }}>
                        Tier {ROMAN[node.tier]}
                      </Micro>
                      <Text
                        style={[
                          styles.branchStatus,
                          {
                            color: active
                              ? colors.copperLight
                              : completedNode
                                ? colors.lichenDim
                                : colors.sageDeep,
                          },
                        ]}
                      >
                        {STATUS_LABEL[node.status].toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.branchTitle,
                        { color: locked ? colors.sageDim : colors.bone },
                      ]}
                    >
                      {node.title}
                    </Text>
                    <View style={styles.branchDurationRow}>
                      <Clock
                        size={11}
                        strokeWidth={1.6}
                        color={colors.sage}
                      />
                      <Text style={styles.branchDuration}>{node.duration}</Text>
                      {active ? (
                        <Text style={styles.beginHint}>· Begin</Text>
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendReady} />
          <Text style={styles.legendText}>Ready</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDone} />
          <Text style={styles.legendText}>Complete</Text>
        </View>
        <Text style={styles.legendHint}>Every tier stays open</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: "row", alignItems: "flex-end", gap: 14 },
  sectionTitle: { marginTop: 6, fontSize: 28, lineHeight: 32 },
  sectionCopy: { marginTop: 6, maxWidth: 330, lineHeight: 20, fontSize: 12.5 },
  countBlock: { alignItems: "flex-end", paddingBottom: 2 },
  countNumber: { fontSize: 30, lineHeight: 30 },
  countCaption: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage, marginTop: 3 },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: hairline,
    marginTop: 18,
    marginBottom: 8,
  },

  laneRow: { height: 74, position: "relative" },
  laneLabel: {
    position: "absolute",
    top: 10,
    width: 172,
    marginLeft: -86,
    alignItems: "center",
  },
  laneRoman: { fontSize: 17, lineHeight: 18 },
  laneName: {
    marginTop: 2,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.bone,
  },
  laneMeta: { marginTop: 3, fontFamily: fonts.sans, fontSize: 10.5, color: colors.sageDim },

  tree: { height: 680, width: "100%", position: "relative" },
  rootMark: {
    position: "absolute",
    left: "50%",
    top: `${(ROOT_Y / VIEW_H) * 100}%`,
    marginLeft: -20,
    marginTop: -20,
    height: 40,
    width: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: alpha(colors.bone, 0.2),
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  treeNode: {
    position: "absolute",
    width: 150,
    marginLeft: -75,
    marginTop: -28,
    alignItems: "center",
  },
  nodeCircle: {
    height: 56,
    width: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeRing: { position: "absolute", top: -6, left: -6, right: -6, bottom: -6 },
  activeRingInner: {
    flex: 1,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: alpha(colors.copper, 0.55),
  },
  nodeLabel: { marginTop: 8, alignItems: "center", width: 158 },
  nodeTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    lineHeight: 14,
    textAlign: "center",
  },
  nodeMeta: {
    marginTop: 3,
    fontFamily: fonts.mono,
    fontSize: 8.5,
    lineHeight: 11,
    letterSpacing: 0.8,
    textAlign: "center",
  },

  tabs: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    marginTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  tabSelected: { borderBottomColor: colors.copper },
  tabRoman: { fontSize: 14, lineHeight: 15 },
  tabName: { fontFamily: fonts.sansMedium, fontSize: 10.5, lineHeight: 13 },
  tabCount: { fontFamily: fonts.mono, fontSize: 9, color: colors.sageDeep },

  branchPanel: {
    marginTop: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    borderRadius: 14,
    backgroundColor: colors.ink850,
    overflow: "hidden",
  },
  branchHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
  },
  branchRoman: { fontSize: 13 },
  branchName: { marginTop: 3, fontSize: 24, lineHeight: 27 },
  branchSub: { marginTop: 3, fontFamily: fonts.sans, fontSize: 10.5, color: colors.sageDim },
  branchIcon: {
    height: 34,
    width: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: alpha(colors.bone, 0.15),
    alignItems: "center",
    justifyContent: "center",
  },
  branchNode: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 13,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.bone, 0.08),
    position: "relative",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 1,
    backgroundColor: colors.copper,
  },
  rail: { width: 38, alignItems: "center" },
  railLine: { position: "absolute", top: 36, bottom: -26, width: 1 },
  railCircle: {
    marginTop: 2,
    height: 38,
    width: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  branchCopy: { flex: 1, paddingBottom: 2 },
  branchMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  branchStatus: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.1 },
  branchTitle: {
    marginTop: 5,
    fontFamily: fonts.sansMedium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  branchDurationRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  branchDuration: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.sage },
  beginHint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.copperLight },

  legend: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 16,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLocked: {
    height: 8,
    width: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: alpha(colors.bone, 0.4),
  },
  legendReady: {
    height: 8,
    width: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: alpha(colors.copper, 0.6),
    backgroundColor: alpha(colors.copper, 0.2),
  },
  legendDone: { height: 8, width: 8, borderRadius: 4, backgroundColor: colors.lichen },
  legendText: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sage },
  legendHint: {
    marginLeft: "auto",
    fontFamily: fonts.sans,
    fontSize: 10.5,
    color: colors.sageDim,
  },
});
