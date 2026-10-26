import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors, fonts, hairline } from "../theme";
import { Label } from "./Type";

export function PrimaryButton({
  label,
  onPress,
  icon,
  iconPosition = "right",
  trailing,
  loading = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  trailing?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primary,
        trailing ? styles.primaryBetween : styles.primaryCenter,
        isDisabled && styles.primaryDisabled,
        pressed && !isDisabled && { backgroundColor: colors.copperLight },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.ink950} />
      ) : (
        <>
          <View style={styles.primaryLabelRow}>
            {iconPosition === "left" ? icon : null}
            <Text style={styles.primaryLabel}>{label}</Text>
            {iconPosition === "right" ? icon : null}
          </View>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

export function QuietButton({
  label,
  onPress,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quiet,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { backgroundColor: "rgba(233,226,208,0.05)" },
        style,
      ]}
    >
      <Text style={styles.quietLabel}>{label}</Text>
    </Pressable>
  );
}

export function LinkButton({
  label,
  onPress,
  icon,
  color = colors.sage,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[styles.linkLabel, { color }]}>{label}</Text>
      {icon}
    </Pressable>
  );
}

export function Field({
  label,
  right,
  onFocus,
  onBlur,
  style,
  ...props
}: TextInputProps & {
  label: string;
  right?: ReactNode;
  style?: TextInputProps["style"];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ width: "100%" }}>
      <Label style={{ marginBottom: 7 }}>{label}</Label>
      <View style={styles.fieldRow}>
        <TextInput
          {...props}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={colors.sageDeep}
          selectionColor={colors.copper}
          cursorColor={colors.copper}
          style={[
            styles.input,
            { borderBottomColor: focused ? colors.copper : "rgba(233,226,208,0.2)" },
            style,
          ]}
        />
        {right ? <View style={styles.fieldAccessory}>{right}</View> : null}
      </View>
    </View>
  );
}

/** Convenience for callers that only need a phone-friendly keyboard. */
export type FieldKeyboard = KeyboardTypeOptions;

export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.rule, style]} />;
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 50,
    paddingHorizontal: 22,
    paddingVertical: 13,
    backgroundColor: colors.copper,
    borderRadius: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  primaryBetween: { justifyContent: "space-between" },
  primaryCenter: { justifyContent: "center" },
  primaryDisabled: { opacity: 0.4 },
  primaryLabelRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  primaryLabel: {
    fontFamily: fonts.sansSemi,
    fontSize: 13.5,
    letterSpacing: 0.2,
    color: colors.ink950,
  },
  quiet: {
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(233,226,208,0.2)",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  quietLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.bone,
    letterSpacing: 0.2,
  },
  link: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 6 },
  linkLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  fieldRow: { position: "relative", justifyContent: "center" },
  input: {
    width: "100%",
    paddingVertical: 11,
    paddingRight: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.bone,
    borderBottomWidth: 1,
  },
  fieldAccessory: {
    position: "absolute",
    right: 0,
    height: 44,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: hairline },
});
