import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, hairline, alpha } from "../theme";
import { BotanicalBranch } from "./BotanicalBranch";
import { BrandMark } from "./BrandMark";
import { Rule } from "./Controls";
import { Body, Display, DisplayItalic, Label, Micro } from "./Type";

const STEPS = [
  {
    key: "01",
    title: "Create the database",
    body: "In your Supabase project, open SQL Editor → New query and run supabase/schema.sql.",
  },
  {
    key: "02",
    title: "Add the credentials",
    body: "Put EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.",
  },
  {
    key: "03",
    title: "Restart and check",
    body: "Restart with npx expo start -c, then run npm run db:check to confirm the tables exist.",
  },
];

/**
 * Supabase is the only store for profiles and trees, so the app cannot open
 * without credentials. This replaces the old offline demo mode.
 */
export function SetupRequired() {
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View pointerEvents="none" style={styles.branch}>
        <BotanicalBranch height={320} opacity={0.09} />
      </View>

      <View style={styles.brandRow}>
        <BrandMark size={26} />
        <Display style={styles.brandName}>Vitality Tree</Display>
      </View>

      <View style={styles.hero}>
        <Label style={{ color: colors.copperLight }}>Setup required</Label>
        <Display style={styles.headline}>
          Connect your{"\n"}
          <DisplayItalic style={{ color: colors.lichen, fontSize: 40, lineHeight: 44 }}>
            Supabase project.
          </DisplayItalic>
        </Display>
        <Body style={styles.copy}>
          Your profile, tree and practice history live in Supabase. There is no
          offline copy on the phone — only your signed-in session is kept here.
        </Body>
      </View>

      <View style={styles.card}>
        {STEPS.map((step, index) => (
          <View key={step.key} style={[styles.step, index === STEPS.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.stepKey}>{step.key}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Rule style={{ marginTop: 26 }} />

      <Text style={styles.footnote}>
        Open <Text style={styles.code}>supabase/schema.sql</Text> for the full
        database setup, including row-level security. Then reload this app.
      </Text>
      <Micro style={{ marginTop: 14 }}>One account · one tree · one season</Micro>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 32,
  },
  branch: { position: "absolute", right: -100, top: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, letterSpacing: -0.4 },
  hero: { marginTop: 46 },
  headline: { marginTop: 14, fontSize: 40, lineHeight: 44 },
  copy: { marginTop: 16, maxWidth: 350, lineHeight: 22 },
  card: {
    marginTop: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    backgroundColor: alpha(colors.ink850, 0.6),
    paddingHorizontal: 16,
  },
  step: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
  },
  stepKey: {
    paddingTop: 2,
    width: 22,
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: colors.copperLight,
  },
  stepTitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.bone },
  stepBody: {
    marginTop: 4,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 19,
    color: colors.sage,
  },
  footnote: {
    marginTop: 16,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 19,
    color: colors.sageDim,
  },
  code: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.sage },
});
