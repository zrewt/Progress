import { test } from "node:test";
import assert from "node:assert/strict";
import { fallbackReason } from "../src/lib/engine/fallback";

const httpError = (status: number) => ({ context: { status } });

test("no permission is the one reason that is not a failure", () => {
  assert.equal(fallbackReason(httpError(403), false), "off");
  assert.equal(fallbackReason(null, false), "off");
});

test("the quota and a rejected draft are told apart from being offline", () => {
  assert.equal(fallbackReason(httpError(429), true), "limit");
  assert.equal(fallbackReason(httpError(502), true), "rejected");
  assert.equal(fallbackReason(httpError(503), true), "unavailable");
  assert.equal(fallbackReason(httpError(401), true), "unavailable");
});

test("the function's own code distinguishes problems a status alone cannot", () => {
  assert.equal(fallbackReason(httpError(403), true, "consent"), "consent");
  assert.equal(fallbackReason(httpError(503), true, "no_key"), "setup");
  assert.equal(fallbackReason(httpError(503), true, "model"), "unavailable");
  assert.equal(fallbackReason(httpError(502), true, "rejected"), "rejected");
  assert.equal(fallbackReason(httpError(429), true, "quota"), "limit");
});

test("permission still wins over any code, so no call can look consented", () => {
  assert.equal(fallbackReason(httpError(429), false, "quota"), "off");
  assert.equal(fallbackReason(null, false, "consent"), "off");
});

test("an unreachable function or a thrown error is simply unavailable", () => {
  assert.equal(fallbackReason(new Error("network request failed"), true), "unavailable");
  assert.equal(fallbackReason(null, true), "unavailable");
  assert.equal(fallbackReason(undefined, true), "unavailable");
});
