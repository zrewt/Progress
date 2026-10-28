import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderUrl, missingLinkNames } from "../src/lib/config";

test("placeholder link detection covers the shipped defaults and the example template", () => {
  assert.equal(isPlaceholderUrl("https://example.com/vitality-tree/support"), true);
  assert.equal(isPlaceholderUrl("https://your-domain.example/support"), true);
  assert.equal(isPlaceholderUrl("not a url"), true);
  assert.equal(isPlaceholderUrl("http://vitalitytree.app/support"), true);
  assert.equal(isPlaceholderUrl(""), true);
  assert.equal(isPlaceholderUrl("https://vitalitytree.app/support"), false);
});

test("only links without a real page are reported, and none is required to start", () => {
  assert.deepEqual(missingLinkNames("https://example.com/vitality-tree/support", "https://example.com/vitality-tree/privacy"), [
    "EXPO_PUBLIC_SUPPORT_URL",
    "EXPO_PUBLIC_PRIVACY_URL",
  ]);
  assert.deepEqual(missingLinkNames("https://vitalitytree.app/support", "https://vitalitytree.app/privacy"), []);
  assert.deepEqual(missingLinkNames("https://vitalitytree.app/support", "https://example.com/privacy"), [
    "EXPO_PUBLIC_PRIVACY_URL",
  ]);
});
