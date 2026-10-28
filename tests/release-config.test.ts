import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReleaseConfig, isPlaceholderUrl } from "../src/lib/config";

test("placeholder link detection covers the shipped defaults and the example template", () => {
  assert.equal(isPlaceholderUrl("https://example.com/vitality-tree/support"), true);
  assert.equal(isPlaceholderUrl("https://your-domain.example/support"), true);
  assert.equal(isPlaceholderUrl("not a url"), true);
  assert.equal(isPlaceholderUrl("http://vitalitytree.app/support"), true);
  assert.equal(isPlaceholderUrl(""), true);
  assert.equal(isPlaceholderUrl("https://vitalitytree.app/support"), false);
});

test("with no configured links the release check names both variables and refuses", () => {
  // The test runner does not load .env, so the defaults are still placeholders here.
  assert.throws(
    () => assertReleaseConfig(),
    /EXPO_PUBLIC_SUPPORT_URL and EXPO_PUBLIC_PRIVACY_URL/,
  );
});
