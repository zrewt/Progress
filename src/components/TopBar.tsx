import { Pressable, StyleSheet, Text, View } from "react-native";
import { LogOut } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { levelStats } from "../lib/tree";
import { alpha, colors, fonts, hairline } from "../theme";
import { BrandMark } from "./BrandMark";
import { Display } from "./Type";

export function TopBar() {
  const { profile, signOut } = useGame();
  if (!profile) return null;

  const stats = levelStats(profile.xp);
  const xpInto = `${stats.into}/${stats.needed}`;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <BrandMark size={22} />
          <Display style={styles.brandName}>Vitality Tree</Display>
        </View>

        <View style={styles.right}>
          <View style={styles.stats}>
            <Text style={styles.statValue}>Lv {stats.level}</Text>
            <Text style={styles.statDivider}>·</Text>
            <Text style={styles.statValue}>{profile.streak}d</Text>
            <Text style={styles.statDivider}>·</Text>
            <Text style={styles.statValue}>{profile.xp} XP</Text>
          </View>

          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            hitSlop={10}
            style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.55 : 1 }]}
          >
            <LogOut size={15} strokeWidth={1.6} color={colors.sage} />
          </Pressable>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.max(1, stats.progress * 100)}%` },
          ]}
        />
      </View>
      <Text style={styles.xpNote} accessibilityLabel={`${xpInto} XP this level`}>
        {xpInto} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
    backgroundColor: alpha(colors.canvas, 0.92),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    height: 56,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  brandName: { fontSize: 17, letterSpacing: -0.35 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  stats: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  statValue: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.bone },
  statDivider: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.sageDeep },
  signOut: {
    paddingLeft: 10,
    marginLeft: 2,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: alpha(colors.bone, 0.14),
    height: 24,
    justifyContent: "center",
  },
  progressTrack: { height: 1, backgroundColor: alpha(colors.bone, 0.07) },
  progressFill: { height: 1, backgroundColor: alpha(colors.copper, 0.75) },
  xpNote: { display: "none" },
});
