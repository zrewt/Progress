import type { EventInput } from "./daily-types";

export interface QueuedEvent extends EventInput {
  queued_at: string;
  attempts: number;
}

export interface QueueStore {
  read(userId: string): Promise<QueuedEvent[]>;
  write(userId: string, events: QueuedEvent[]): Promise<void>;
}

export const QUEUE_LIMIT = 200;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 5 * 60_000;

/** Adds an event once. A repeated client_event_id replaces the older copy. */
export function enqueue(queue: QueuedEvent[], event: EventInput, now = new Date()): QueuedEvent[] {
  const item: QueuedEvent = { ...event, queued_at: now.toISOString(), attempts: 0 };
  const without = queue.filter((entry) => entry.client_event_id !== event.client_event_id);
  return [...without, item].slice(-QUEUE_LIMIT);
}

export function nextBatch(queue: QueuedEvent[], limit = 5): QueuedEvent[] {
  return queue.slice(0, Math.max(1, Math.min(limit, queue.length)));
}

/** Exponential backoff with a cap, no jitter so behaviour stays testable. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts));
}

export function isReady(event: QueuedEvent, now = Date.now()): boolean {
  return now - Date.parse(event.queued_at) >= backoffMs(event.attempts);
}

export function markFailed(queue: QueuedEvent[], clientEventId: string): QueuedEvent[] {
  return queue.map((event) =>
    event.client_event_id === clientEventId
      ? { ...event, attempts: event.attempts + 1, queued_at: new Date().toISOString() }
      : event,
  );
}

export function removeSent(queue: QueuedEvent[], sentIds: string[]): QueuedEvent[] {
  const sent = new Set(sentIds);
  return queue.filter((event) => !sent.has(event.client_event_id));
}

export interface ReplayResult {
  sent: string[];
  remaining: QueuedEvent[];
  failure: string | null;
}

/** Replays in order and stops at the first failure, keeping the rest for later. */
export async function replay(
  queue: QueuedEvent[],
  send: (event: QueuedEvent) => Promise<void>,
): Promise<ReplayResult> {
  let remaining = [...queue];
  const sent: string[] = [];
  for (const event of nextBatch(queue)) {
    try {
      await send(event);
      sent.push(event.client_event_id);
      remaining = removeSent(remaining, [event.client_event_id]);
    } catch {
      remaining = markFailed(remaining, event.client_event_id);
      return { sent, remaining, failure: "Some entries are still waiting to sync." };
    }
  }
  return { sent, remaining, failure: null };
}
