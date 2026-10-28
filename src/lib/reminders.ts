import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { nextReminder, validReminderTime } from "./reminder-plan";
import type { DailySnapshot } from "./daily-types";

const key = (id: string) => `vitality:reminder:${id}`;
let serial: Promise<unknown> = Promise.resolve();
export type ReminderPermission = "granted" | "denied" | "undetermined" | "unsupported";
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

async function channel() {
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("practice", { name: "Practice reminders", importance: Notifications.AndroidImportance.DEFAULT });
}
export async function reminderPermission(request = false): Promise<ReminderPermission> {
  if (Platform.OS === "web") return "unsupported";
  await channel();
  let p = await Notifications.getPermissionsAsync();
  if (request && !p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
  const accepted = p.granted || [Notifications.IosAuthorizationStatus.AUTHORIZED, Notifications.IosAuthorizationStatus.PROVISIONAL, Notifications.IosAuthorizationStatus.EPHEMERAL].includes(p.ios?.status as Notifications.IosAuthorizationStatus);
  return accepted ? "granted" : p.status === "denied" ? "denied" : "undetermined";
}
export async function reminderTime(id: string): Promise<string | null> {
  const time = await AsyncStorage.getItem(key(id));
  return time && validReminderTime(time) ? time : null;
}
export async function saveReminderTime(id: string, time: string | null) {
  if (time && !validReminderTime(time)) throw new Error("Choose a time in HH:MM format.");
  if (time) await AsyncStorage.setItem(key(id), time); else await AsyncStorage.removeItem(key(id));
}
export function cancelReminders() {
  const task = serial.catch(() => undefined).then(async () => { if (Platform.OS !== "web") await Notifications.cancelAllScheduledNotificationsAsync(); });
  serial = task; return task;
}
export function rescheduleReminder(id: string, snapshot: DailySnapshot) {
  const task = serial.catch(() => undefined).then(async () => {
    if (Platform.OS === "web") return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const time = await reminderTime(id);
    if (!time || await reminderPermission() !== "granted") return;
    const next = nextReminder(snapshot, time);
    if (!next) return;
    await Notifications.scheduleNotificationAsync({ content: { title: "Your practice", body: next.title, sound: false }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: next.at, ...(Platform.OS === "android" ? { channelId: "practice" } : {}) } });
  });
  serial = task; return task;
}
