import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { APP_VERSION, PRIVACY_URL, SUPPORT_URL } from "../lib/config";
import { alpha, colors, fonts, hairline } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { snapshot, user, aiAllowed, recordConsent, withdrawConsent, setTimezone, signOut, deleteAccount } = useGame();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!visible) return null;
  const timezone = snapshot?.profile?.timezone ?? "UTC";
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const activeSeason = snapshot?.seasons.find((season) => season.status === "active") ?? null;

  async function toggleAi() {
    setBusy(true); setNotice(null);
    const saved = aiAllowed ? await withdrawConsent() : await recordConsent();
    setBusy(false);
    setNotice(saved ? (aiAllowed ? "AI suggestions are off. Plans are built on this device." : "AI suggestions are on. You can withdraw this any time.") : "That change could not be saved.");
  }

  async function applyDeviceZone() {
    setBusy(true); setNotice(null);
    const saved = await setTimezone(deviceZone);
    setBusy(false);
    setNotice(saved ? `Time zone set to ${deviceZone}.` : "That time zone could not be saved.");
  }

  async function removeAccount() {
    setBusy(true); setNotice(null);
    const result = await deleteAccount();
    setBusy(false);
    if (result.error) setNotice(result.error);
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.head}>
            <Display style={styles.title}>Settings</Display>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close settings" hitSlop={12}>
              <X size={18} strokeWidth={1.6} color={colors.sage} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.block}>
              <Label>Signed in as</Label>
              <Body style={{ fontSize: 12.5 }}>{user?.email ?? "Your account"}</Body>
            </View>

            <View style={styles.block}>
              <Label>Time zone</Label>
              <Body style={{ fontSize: 12.5 }}>{timezone}</Body>
              {deviceZone !== timezone ? (
                <QuietButton label={`Use this device (${deviceZone})`} onPress={() => void applyDeviceZone()} disabled={busy} />
              ) : (
                <Micro style={styles.muted}>This matches your device.</Micro>
              )}
            </View>

            <View style={styles.block}>
              <Label>AI suggestions</Label>
              <Body style={{ fontSize: 12.5 }}>
                {aiAllowed
                  ? "On. Your goal, identity, time budget and blocker may be sent to draft suggestions. No name, email or history."
                  : "Off. Plans are built on this device from the same curated practices."}
              </Body>
              <QuietButton label={aiAllowed ? "Turn AI suggestions off" : "Turn AI suggestions on"} onPress={() => void toggleAi()} disabled={busy} />
            </View>

            {/* The stored plan records where it came from. Showing it here is the
                difference between "I think the AI ran" and knowing. */}
            {activeSeason ? (
              <View style={styles.block}>
                <Label>This plan</Label>
                <Body style={{ fontSize: 12.5 }}>
                  {activeSeason.plan_source === "ai"
                    ? "Drafted by AI for your goal, then checked against the safety and time limits."
                    : "Built on this device from the curated practices. No AI draft was used for it."}
                </Body>
                <Micro style={styles.muted}>
                  Plan version {activeSeason.plan_version}
                  {activeSeason.plan_source === "ai"
                    ? ""
                    : aiAllowed
                      ? " — save a new version from Edit plan to ask the AI for a fresh draft."
                      : " — AI suggestions are off, so plans stay on this device."}
                </Micro>
              </View>
            ) : null}

            <View style={styles.block}>
              <Label>Help and privacy</Label>
              <Pressable onPress={() => void Linking.openURL(SUPPORT_URL)} accessibilityRole="link" accessibilityLabel="Open support page" style={styles.link}>
                <Text style={styles.linkText}>Support</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link" accessibilityLabel="Open privacy policy" style={styles.link}>
                <Text style={styles.linkText}>Privacy policy</Text>
              </Pressable>
            </View>

            <View style={styles.block}>
              <Label>Account</Label>
              <QuietButton label="Sign out" onPress={() => void signOut()} disabled={busy} />
              {confirmDelete ? (
                <View style={styles.danger}>
                  <Body style={{ fontSize: 12.5, lineHeight: 19 }}>
                    This deletes your account, your seasons, every practice you have recorded and your tree. It cannot be
                    undone. Do you want to continue?
                  </Body>
                  <PrimaryButton label={busy ? "Deleting" : "Delete my account permanently"} onPress={() => void removeAccount()} loading={busy} disabled={busy} />
                  <QuietButton label="Keep my account" onPress={() => setConfirmDelete(false)} disabled={busy} />
                </View>
              ) : (
                <Pressable onPress={() => setConfirmDelete(true)} accessibilityRole="button" accessibilityLabel="Delete my account" style={styles.link}>
                  <Text style={[styles.linkText, { color: colors.clay }]}>Delete my account</Text>
                </Pressable>
              )}
            </View>

            {notice ? <Text style={styles.notice} accessibilityRole="alert">{notice}</Text> : null}
            <Micro style={styles.version}>Version {APP_VERSION}</Micro>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,13,9,0.88)" },
  sheet: { width: "100%", maxHeight: "90%", backgroundColor: colors.canvas, borderTopWidth: 1, borderTopColor: alpha(colors.bone, 0.16) },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  title: { fontSize: 26, lineHeight: 29 },
  content: { paddingHorizontal: 20, paddingBottom: 12, gap: 18 },
  block: { gap: 7, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
  muted: { textTransform: "none", letterSpacing: 0.3 },
  link: { minHeight: 44, justifyContent: "center" },
  linkText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone, textDecorationLine: "underline" },
  danger: { gap: 8, padding: 12, borderLeftWidth: 2, borderLeftColor: colors.clay, backgroundColor: alpha(colors.clay, 0.07) },
  notice: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.boneDim },
  version: { textTransform: "none", letterSpacing: 0.3, textAlign: "center" },
});
