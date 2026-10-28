import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Eye, EyeOff } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { alpha, colors, fonts, hairline } from "../theme";
import { BotanicalBranch } from "./BotanicalBranch";
import { BrandMark } from "./BrandMark";
import { Field, PrimaryButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

type Tab = "signin" | "signup";

export function AuthScreen() {
  const { signIn, signUp, authBusy, requestPasswordReset, resendConfirmation } = useGame();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    const result =
      tab === "signin"
        ? await signIn(email, password)
        : await signUp(name, email, password);
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  }

  async function handleReset() {
    setError(null);
    setInfo(null);
    const result = await requestPasswordReset(email);
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    const result = await resendConfirmation(email);
    if (result.error) setError(result.error);
    if (result.info) setInfo(result.info);
  }

  function switchTab(next: Tab) {
    setTab(next);
    setError(null);
    setInfo(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 20 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none" style={styles.branchClip}>
          <View style={styles.branch}>
            <BotanicalBranch height={360} opacity={0.08} />
          </View>
        </View>

        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <BrandMark size={26} />
            <Display style={styles.brandName}>Vitality Tree</Display>
          </View>
          <Micro style={{ color: colors.sageDim }}>Vol. I</Micro>
        </View>

        <View style={styles.hero}>
          <Label style={{ color: colors.copperLight }}>
            {tab === "signin" ? "Member access" : "First season"}
          </Label>
          <Display style={styles.headline}>
            {tab === "signin" ? "Welcome\nback." : "Become\nyour future self."}
          </Display>
          <Body style={styles.heroCopy}>
            {tab === "signin"
              ? "Your branches are exactly where you left them."
              : "Tell it what you want and by when. Grow a tree from the practice you log."}
          </Body>
        </View>

        <View style={styles.tabs}>
          {(["signin", "signup"] as Tab[]).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => switchTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? colors.bone : colors.sage },
                  ]}
                >
                  {key === "signin" ? "Sign in" : "Create account"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.form}>
          {tab === "signup" ? (
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="What should we call you?"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
            />
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least six characters"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
            returnKeyType="go"
            onSubmitEditing={() => void handleSubmit()}
            right={
              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                hitSlop={10}
              >
                {showPassword ? (
                  <EyeOff size={17} color={colors.sageDim} strokeWidth={1.6} />
                ) : (
                  <Eye size={17} color={colors.sageDim} strokeWidth={1.6} />
                )}
              </Pressable>
            }
          />

          {tab === "signin" ? (
            <Pressable
              onPress={() => void handleReset()}
              accessibilityRole="button"
              accessibilityLabel="Send a password reset link to my email"
              hitSlop={8}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Forgot your password?</Text>
            </Pressable>
          ) : null}
          {tab === "signin" ? (
            <Pressable
              onPress={() => void handleResend()}
              accessibilityRole="button"
              accessibilityLabel="Resend the confirmation email"
              hitSlop={8}
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Resend confirmation email</Text>
            </Pressable>
          ) : null}

          {error ? (
            <View style={[styles.message, { borderLeftColor: colors.clay }]}>
              <Text style={styles.messageText}>{error}</Text>
            </View>
          ) : null}
          {info ? (
            <View style={[styles.message, { borderLeftColor: colors.lichen }]}>
              <Text style={styles.messageText}>{info}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label={tab === "signin" ? "Sign in" : "Create account"}
            onPress={() => void handleSubmit()}
            loading={authBusy}
            icon={<ArrowRight size={16} color={colors.ink950} strokeWidth={2} />}
            style={{ marginTop: 4 }}
          />
        </View>

        <View style={styles.modeRow}>
          <View style={[styles.dot, { backgroundColor: colors.lichen }]} />
          <Text style={styles.modeText}>
            Your progress is saved to your account
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Micro>Your life is the game.</Micro>
          <Micro>10 XP a practice</Micro>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  forgot: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  forgotText: { fontFamily: fonts.sansMedium, fontSize: 11.5, color: colors.sage, textDecorationLine: "underline" },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 20,
  },
  branchClip: {
    position: "absolute",
    top: 42,
    left: 0,
    right: 0,
    height: 370,
    overflow: "hidden",
  },
  branch: { position: "absolute", right: -96, top: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, letterSpacing: -0.4 },
  hero: { marginTop: 52 },
  headline: { marginTop: 14, fontSize: 44, lineHeight: 45 },
  heroCopy: { marginTop: 14, maxWidth: 320, lineHeight: 21 },
  tabs: {
    flexDirection: "row",
    gap: 26,
    marginTop: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
  },
  tab: {
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabActive: { borderBottomColor: colors.copper },
  tabLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  form: { marginTop: 22, gap: 20 },
  message: {
    borderLeftWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: alpha(colors.clay, 0.07),
  },
  messageText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.bone,
  },
  modeRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  modeText: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.sageDim },
  spacer: { flex: 1, minHeight: 32 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
    paddingTop: 16,
  },
});
