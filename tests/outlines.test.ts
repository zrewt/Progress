import { test } from "node:test";
import assert from "node:assert/strict";
import { BRANCH_SLOTS, localOutlines, preparationOutlines, validOutlines } from "../supabase/functions/generate-tree/outlines";

const sample = (names: string[]) => Object.fromEntries(BRANCH_SLOTS.map((slot, index) => [slot, {
  name: names[index],
  milestones: ["Starting point", "First attempts", "Building familiarity", "Review and adjust"].map(title => ({ title, description: `A checkpoint for ${names[index].toLowerCase()}.` })),
}]));

test("cycling and writing have distinct, valid goal-specific branches and four checkpoints", () => {
  for (const names of [["Riding practice", "Cycling technique", "Ride planning", "Rest and recovery"], ["Drafting", "Story structure", "Revision", "Reader feedback"]]) {
    const outlines = sample(names);
    assert.equal(validOutlines(outlines, names[0] === "Drafting" ? "ordinary" : "physical"), true);
  }
});
test("rejects duplicates, malformed content, unsafe text and shame", () => {
  const names = ["Riding practice", "Cycling technique", "Ride planning", "Rest and recovery"];
  const duplicate = sample(names); duplicate.mind.name = duplicate.body.name;
  assert.equal(validOutlines(duplicate, "physical"), false);
  const titles = sample(names); titles.body.milestones[1].title = titles.body.milestones[0].title;
  assert.equal(validOutlines(titles, "physical"), false);
  const malformed = sample(names); malformed.body.milestones.pop();
  assert.equal(validOutlines(malformed, "physical"), false);
  const sensitive = sample(names); sensitive.body.milestones[0].description = "Identify your diagnosis before cycling.";
  assert.equal(validOutlines(sensitive, "physical"), false);
  const shame = sample(names); shame.body.name = "No excuses";
  assert.equal(validOutlines(shame, "physical"), false);
  const risky = sample(names); risky.body.milestones[0].description = "Climb the route with a rope.";
  assert.equal(validOutlines(risky, "high-risk"), false);
});
test("local and preparation outlines are valid and preparation only for high-risk", () => {
  assert.equal(validOutlines(localOutlines(), "ordinary"), true);
  assert.equal(validOutlines(preparationOutlines(), "high-risk"), true);
  assert.match(JSON.stringify(preparationOutlines()), /qualified professional/i);
});
