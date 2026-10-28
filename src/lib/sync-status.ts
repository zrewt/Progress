/**
 * What the dashboard is allowed to say about saved entries.
 *
 * "unsaved" exists so a failed write can never be described as saved: the
 * storage layer reports its own failure and this is the only wording the UI
 * shows for it.
 */
export type SyncState = "idle" | "pending" | "syncing" | "error" | "unsaved";

export interface SyncMessage {
  text: string;
  retry: boolean;
}

export function syncMessage(state: SyncState, count: number): SyncMessage {
  const entries = count === 1 ? "entry" : "entries";
  switch (state) {
    case "pending":
      return {
        text:
          count === 1
            ? "Saved on this device, will sync."
            : `${count} ${entries} saved on this device, will sync.`,
        retry: true,
      };
    case "syncing":
      return { text: `Sending ${count} ${entries}…`, retry: false };
    case "error":
      return { text: `${count} ${count === 1 ? "entry is" : "entries are"} waiting to sync.`, retry: true };
    case "unsaved":
      return {
        text: "This entry is not on this device yet. Check your connection and try again.",
        retry: false,
      };
    default:
      return { text: "Everything is saved.", retry: false };
  }
}
