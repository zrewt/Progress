import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGame } from "../lib/game-context";
import { colors, fonts } from "../theme";
import { BrandMark } from "./BrandMark";
import { Field, PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Micro } from "./Type";

export function ResetPasswordScreen() {
  const { updatePassword, cancelRecovery } = useGame();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function save() {
    setError(null); setInfo(null);
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={styles.brand}>
          <BrandMark size={26} />
          <Display style={styles.brandName}>Vitality Tree</Display>
        </View>
        <Display style={styles.title}>Choose a new password.</Display>
        <Body style={styles.lead}>
          You are here from a reset link. Choose something you have not used here before; eight characters is enough.
        </Body>

        <View style={styles.form}>
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
          <Field label="Repeat it" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" returnKeyType="go" onSubmitEditing={() => void save()} />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <PrimaryButton label={busy ? "Saving" : "Set new password"} onPress={() => void save()} loading={busy} disabled={busy || password.length < 8} />
          <QuietButton label="Back to sign in" onPress={cancelRecovery} />
        </View>

        <Micro style={styles.note}>If the link has expired, request a new one from the sign-in screen.</Micro>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 30, gap: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18 },
  title: { marginTop: 22, fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
  lead: { lineHeight: 21, maxWidth: 380 },
  form: { marginTop: 18, gap: 16 },
  error: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 19, color: colors.clay },
  info: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 19, color: colors.lichen },
  note: { marginTop: 16, textTransform: "none", letterSpacing: 0.3, lineHeight: 16 },
});
