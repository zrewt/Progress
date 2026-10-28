import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { useGame } from "../lib/game-context";
import { reminderPermission, reminderTime, type ReminderPermission } from "../lib/reminders";
import { validReminderTime } from "../lib/reminder-plan";
import { Body, Label } from "./Type";
import { Field, QuietButton } from "./Controls";

export function ReminderChoice({ onDone }: { onDone?: () => void }) {
  const { user, configureReminder } = useGame();
  const [time, setTime] = useState("18:00");
  const [permission, setPermission] = useState<ReminderPermission>("undetermined");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) { void reminderTime(user.id).then(t => { if (t) setTime(t); }).catch(() => setMessage("The reminder preference could not be read.")); void reminderPermission().then(setPermission).catch(() => setMessage("Notification settings could not be read.")); } }, [user]);
  async function save(value: string | null) {
    setBusy(true);
    const result = await configureReminder(value);
    setBusy(false);
    setMessage(result ? value ? "Reminder saved on this device." : "Reminders are off on this device." : "Reminder not enabled. Check permission or try again.");
    setPermission(await reminderPermission().catch(() => "denied" as const));
    if (result) onDone?.();
  }
  return <View style={{ gap: 8 }}>
    <Label>When should we nudge you?</Label>
    <Body>Allow a local notification naming your next practice; it may appear on your lock screen.</Body>
    <View style={{ flexDirection: "row", gap: 10 }}>{["08:00", "12:00", "18:00"].map(t => <QuietButton key={t} label={t} onPress={() => setTime(t)} disabled={busy} />)}</View>
    <Field label="Time (HH:MM, account time zone)" value={time} onChangeText={setTime} maxLength={5} />
    <QuietButton label="Enable reminder" onPress={() => void save(time)} disabled={busy || !validReminderTime(time)} />
    <QuietButton label={onDone ? "Skip reminders" : "Turn reminders off"} onPress={() => void save(null)} disabled={busy} />
    {permission === "denied" ? <><Body>Notifications are denied. You can enable them in system settings.</Body><QuietButton label="Open system settings" onPress={() => void Linking.openSettings().catch(() => setMessage("Open notification settings on your device."))} /></> : null}
    {permission === "unsupported" ? <Body>Local reminders need the iOS or Android app.</Body> : null}
    <Body>Only the next reminder is scheduled. Opening the app refreshes it. Other devices cannot cancel this device’s reminder until it reconnects.</Body>
    {message ? <Body>{message}</Body> : null}
  </View>;
}
