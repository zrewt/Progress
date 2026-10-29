import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { PersonalizationAnswer } from "../lib/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useGame } from "../lib/game-context";
import { APP_VERSION, PRIVACY_URL, SUPPORT_URL, isPlaceholderUrl } from "../lib/config";
import { alpha, colors, fonts, hairline } from "../theme";
import { PrimaryButton, QuietButton } from "./Controls";
import { Body, Display, Label, Micro } from "./Type";
import { ReminderChoice } from "./ReminderChoice";
import { ConsentSheet } from "./ConsentSheet";

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { snapshot, user, aiAllowed, recordConsent, withdrawConsent, setTimezone, setPersonalizationContext, signOut, deleteAccount } = useGame();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<PersonalizationAnswer[] | null>(null);
  if (!visible) return null;
  const timezone = snapshot?.profile?.timezone ?? "UTC";
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const activeSeason = snapshot?.seasons.find((season) => season.status === "active") ?? null;

  async function toggleAi() {
    if (!aiAllowed) { setConsentOpen(true); return; }
    setBusy(true); setNotice(null);
    const saved = await withdrawConsent();
    setBusy(false);
    setNotice(saved ? "AI suggestions are off. Plans are built on this device." : "That change could not be saved.");
  }

  async function acceptConsent() {
    setBusy(true);
    const saved = await recordConsent();
    setBusy(false);
    if (saved) { setConsentOpen(false); setNotice("AI suggestions are on. You can withdraw this any time."); }
    else setNotice("That choice could not be saved.");
  }

  async function saveContext() {
    if (!editingContext) return;
    setBusy(true); setNotice(null);
    const saved = await setPersonalizationContext(editingContext.filter((item) => item.answer.trim()).map((item) => ({ ...item, answer: item.answer.trim() })));
    setBusy(false);
    if (saved) { setEditingContext(null); setNotice("Your details were saved. Your existing practices are unchanged."); }
    else setNotice("Your details could not be saved.");
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
                  ? "On. Your goal, optional answers and a short progress summary may be sent to draft suggestions."
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
                  {!activeSeason.plan_source_verified
                    ? "This plan was created or edited before its exact source could be tracked. Its original source is not verified."
                    : activeSeason.plan_source === "ai"
                    ? "Drafted by AI for your goal, then checked against the safety and time limits."
                    : activeSeason.plan_source === "mixed" ? "This plan combines AI suggestions and starter practices."
                    : "Built on this device from the starter practices. No AI practices were used for it."}
                </Body>
                <Micro style={styles.muted}>
                  Plan version {activeSeason.plan_version}
                  {activeSeason.plan_source_verified && activeSeason.plan_source === "ai"
                    ? ""
                    : aiAllowed
                      ? " — save a new version from Edit plan to ask the AI for a fresh draft."
                      : " — AI suggestions are off, so plans stay on this device."}
                </Micro>
              </View>
            ) : null}

            {activeSeason ? (
              <View style={styles.block}>
                <Label>Your plan details</Label>
                <Body>Changing or removing details does not rewrite your existing plan. Answers may already be reflected in saved plan text.</Body>
                {editingContext ? editingContext.map((item, index) => (
                  <View key={`${index}-${item.question}`}>
                    <Body>{item.question}</Body>
                    <TextInput accessibilityLabel={item.question} value={item.answer} maxLength={160} onChangeText={(answer) => setEditingContext((old) => old?.map((entry, i) => i === index ? { ...entry, answer } : entry) ?? null)} style={styles.contextInput} />
                  </View>
                )) : (activeSeason.personalization_context ?? []).map((item, index) => <Body key={`${index}-${item.question}`}>{item.question} {item.answer}</Body>)}
                {!editingContext && !(activeSeason.personalization_context ?? []).length ? <Body>No extra details saved for this season.</Body> : null}
                {editingContext ? <><QuietButton label="Save details" onPress={() => void saveContext()} disabled={busy} /><QuietButton label="Cancel" onPress={() => setEditingContext(null)} disabled={busy} /></> : (activeSeason.personalization_context ?? []).length ? <QuietButton label="Change or remove details" onPress={() => setEditingContext((activeSeason.personalization_context ?? []).map((item) => ({ ...item })))} disabled={busy} /> : null}
              </View>
            ) : null}
            <View style={styles.block}><ReminderChoice /></View>
            <View style={styles.block}>
              <Label>Help and privacy</Label>
              {isPlaceholderUrl(SUPPORT_URL) ? (
                <Text style={styles.linkPending}>Support — page coming soon</Text>
              ) : (
                <Pressable onPress={() => void Linking.openURL(SUPPORT_URL)} accessibilityRole="link" accessibilityLabel="Open support page" style={styles.link}>
                  <Text style={styles.linkText}>Support</Text>
                </Pressable>
              )}
              {isPlaceholderUrl(PRIVACY_URL) ? (
                <Text style={styles.linkPending}>Privacy policy — page coming soon</Text>
              ) : (
                <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link" accessibilityLabel="Open privacy policy" style={styles.link}>
                  <Text style={styles.linkText}>Privacy policy</Text>
                </Pressable>
              )}
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
      <ConsentSheet visible={consentOpen} busy={busy} onAccept={() => void acceptConsent()} onDecline={() => setConsentOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,32,28,0.45)" },
  sheet: { width: "100%", maxHeight: "90%", backgroundColor: colors.canvas, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  title: { fontSize: 26, lineHeight: 29 },
  content: { paddingHorizontal: 20, paddingBottom: 12, gap: 18 },
  block: { gap: 7, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: hairline },
  muted: { textTransform: "none", letterSpacing: 0.3 },
  contextInput: { minHeight: 48, color: colors.bone, borderBottomWidth: 1, borderColor: hairline, fontFamily: fonts.sans, fontSize: 15 },
  link: { minHeight: 44, justifyContent: "center" },
  linkPending: { minHeight: 44, paddingVertical: 13, fontFamily: fonts.sans, fontSize: 12.5, color: colors.sageDim },
  linkText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone, textDecorationLine: "underline" },
  danger: { gap: 8, padding: 12, borderLeftWidth: 2, borderLeftColor: colors.clay, backgroundColor: alpha(colors.clay, 0.07) },
  notice: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 18, color: colors.boneDim },
  version: { textTransform: "none", letterSpacing: 0.3, textAlign: "center" },
});
