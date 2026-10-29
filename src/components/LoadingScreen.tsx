import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { BrandMark } from "./BrandMark";
import { Body } from "./Type";

export function LoadingScreen() {
  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityLabel="Preparing your practice">
      <BrandMark size={46} />
      <Body style={styles.copy}>Preparing your practice</Body>
      <ActivityIndicator color={colors.copper} style={styles.indicator} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  copy: { marginTop: 20 },
  indicator: { marginTop: 16 },
});
