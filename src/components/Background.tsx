import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

export function Background() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas }]} />;
}
