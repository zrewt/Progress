import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { AI_CONSENT_COPY } from "../lib/config";
import { alpha, colors, fonts } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function ConsentSheet({
  visible,
  busy,
  onAccept,
  onDecline,
}: {
  visible: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDecline} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.head}>
              <Display style={styles.title}>{AI_CONSENT_COPY.title}</Display>
              <X size={18} strokeWidth={1.6} color={colors.sage} />
            </View>

            <Label style={{ marginTop: 4 }}>What is sent</Label>
            {AI_CONSENT_COPY.sent.map((item) => (
              <View key={item} style={styles.row}>
                <Check size={13} strokeWidth={2} color={colors.copperLight} />
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}

            <Label style={{ marginTop: 14 }}>What is never sent</Label>
            {AI_CONSENT_COPY.notSent.map((item) => (
              <View key={item} style={styles.row}>
                <Check size={13} strokeWidth={2} color={colors.lichen} />
                <Text style={styles.rowText}>{item}</Text>
              </View>
            ))}

            <Body style={styles.detail}>{AI_CONSENT_COPY.detail}</Body>
            <Body style={styles.detail}>{AI_CONSENT_COPY.alternative}</Body>

            <View style={styles.actions}>
              <PrimaryButton label={busy ? "Saving your choice" : "Use AI suggestions"} onPress={onAccept} loading={busy} disabled={busy} />
              <QuietButton label="Build the plan on this device" onPress={onDecline} disabled={busy} />
            </View>
            <Micro style={styles.footnote}>You can change this at any time in settings, and withdraw it later.</Micro>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,13,9,0.9)" },
  sheet: { width: "100%", maxHeight: "92%", backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: alpha(colors.bone, 0.16) },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 6 },
  head: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { flex: 1, fontSize: 26, lineHeight: 29 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 },
  rowText: { flex: 1, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 19, color: colors.boneDim },
  detail: { marginTop: 12, fontSize: 12, lineHeight: 19, color: colors.sage },
  actions: { marginTop: 18, gap: 9 },
  footnote: { marginTop: 8, textAlign: "center", textTransform: "none", letterSpacing: 0.3, lineHeight: 15 },
});
