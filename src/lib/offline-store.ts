import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueueStore, QueuedEvent } from "./offline-queue";

const key = (userId: string) => `vitality:queue:${userId}`;

/** One queue per account, so signing out or switching users cannot replay another account's events. */
export const deviceQueue: QueueStore = {
  async read(userId) {
    try {
      const raw = await AsyncStorage.getItem(key(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
    } catch {
      return [];
    }
  },
  async write(userId, events) {
    try {
      if (!events.length) await AsyncStorage.removeItem(key(userId));
      else await AsyncStorage.setItem(key(userId), JSON.stringify(events));
      return true;
    } catch {
      // The caller decides what to tell the person; never report a failed write as saved.
      return false;
    }
  },
};

export async function clearQueue(userId: string) {
  return deviceQueue.write(userId, []);
}
