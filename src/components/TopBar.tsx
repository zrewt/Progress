import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Settings } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { colors, hairline } from "../theme";
import { BrandMark } from "./BrandMark";
import { Display } from "./Type";
import { SettingsSheet } from "./SettingsSheet";

export function TopBar() {
  const { user, profile } = useGame();
  const [settingsOpen, setSettingsOpen] = useState(false);
  if (!profile && !user) return null;

  return (
    <View style={styles.header}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <BrandMark size={22} />
          <Display style={styles.brandName}>Vitality Tree</Display>
        </View>

        <View style={styles.right}>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            hitSlop={10}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Settings size={15} strokeWidth={1.6} color={colors.sage} />
          </Pressable>
        </View>
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
    backgroundColor: colors.canvas,
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
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
