import { test } from "node:test";
import assert from "node:assert/strict";
import { QUEUE_LIMIT, backoffMs, enqueue, markFailed, nextBatch, removeSent, replay, type QueuedEvent } from "../src/lib/offline-queue";
import type { EventInput } from "../src/lib/daily-types";

const event = (id: string, day = "2026-10-24"): EventInput => ({
  season_id: "s1", practice_id: "p1", kind: "full", client_event_id: id, occurred_at: `${day}T12:00:00Z`, minutes_actual: 15,
});

test("the same client_event_id is stored once, so a retry cannot double-count", () => {
  const first = enqueue([], event("a"));
  const second = enqueue(first, event("a"));
  assert.equal(second.length, 1);
  assert.equal(second[0].client_event_id, "a");
  assert.equal(second[0].attempts, 0);
  assert.equal(enqueue([], event("b")).length, 1);
  assert.equal(enqueue(first, event("b")).length, 2);
});

test("the queue stays bounded and keeps the newest entries", () => {
  let queue: QueuedEvent[] = [];
  for (let index = 0; index < QUEUE_LIMIT + 5; index += 1) queue = enqueue(queue, event(`e${index}`));
  assert.equal(queue.length, QUEUE_LIMIT);
  assert.equal(queue[queue.length - 1].client_event_id, `e${QUEUE_LIMIT + 4}`);
});

test("backoff grows and is capped", () => {
  assert.equal(backoffMs(0), 5000);
  assert.equal(backoffMs(1), 10_000);
  assert.equal(backoffMs(3), 40_000);
  assert.equal(backoffMs(99), 300_000);
  assert.equal(nextBatch([], 5).length, 0);
});

test("replay removes what was sent and keeps what failed", async () => {
  const queue = [enqueue([], event("a"))[0], enqueue([], event("b"))[0], enqueue([], event("c"))[0]];
  const sent: string[] = [];
  const result = await replay(queue, async (item) => {
    if (item.client_event_id === "b") throw new Error("offline");
    sent.push(item.client_event_id);
  });
  assert.deepEqual(sent, ["a"]);
  assert.deepEqual(result.sent, ["a"]);
  assert.equal(result.remaining.length, 2);
  assert.equal(result.remaining.find((item) => item.client_event_id === "b")?.attempts, 1);
  assert.ok(result.failure);
  assert.equal(result.remaining.find((item) => item.client_event_id === "c")?.attempts, 0);
});

test("a successful replay empties the queue and failures never drop entries", async () => {
  const queue = [enqueue([], event("a"))[0], enqueue([], event("b"))[0]];
  const result = await replay(queue, async () => undefined);
  assert.deepEqual(result.sent, ["a", "b"]);
  assert.deepEqual(result.remaining, []);
  assert.equal(result.failure, null);

  const afterFailure = markFailed(queue, "a");
  assert.equal(afterFailure.length, 2);
  assert.equal(afterFailure[0].attempts, 1);
  assert.equal(afterFailure[1].attempts, 0);
  assert.deepEqual(removeSent(queue, ["a"]).map((item) => item.client_event_id), ["b"]);
});
