import { test } from "node:test";
import assert from "node:assert/strict";
import { startingPointFor } from "../src/lib/engine/stage";
import { genericFiller, repeatedStep } from "../src/lib/safety-rules";

test("a goal with no artefact yet is planned from nothing", () => {
  assert.equal(startingPointFor("build an app that helps people eat healthier"), "nothing");
  assert.equal(startingPointFor("start a podcast about local history"), "nothing");
  assert.equal(startingPointFor("build an app from scratch"), "nothing");
  assert.equal(startingPointFor("build my first app"), "nothing");
});

test("a goal about something they already have starts from it", () => {
  assert.equal(startingPointFor("get 100 users for my health app"), "exists");
  assert.equal(startingPointFor("finish my book"), "exists");
  assert.equal(startingPointFor("launch my newsletter"), "exists");
  assert.equal(startingPointFor("publish the prototype"), "exists");
});

test("a goal that is not about making something is a practice", () => {
  assert.equal(startingPointFor("run 5K without stopping"), "practice");
  assert.equal(startingPointFor("eat healthier"), "practice");
  assert.equal(startingPointFor("learn Spanish"), "practice");
});

test("placeholder wording is rejected, specific wording is not", () => {
  assert.equal(genericFiller("Open the editor and write 5 lines."), "write five lines");
  assert.equal(genericFiller("Work on your project for 15 minutes."), "work on your project");
  assert.equal(genericFiller("Reset your shoulders between sessions."), "reset your shoulders");
  assert.equal(genericFiller("Make some progress on the app."), "make progress");

  assert.equal(
    genericFiller("Sketch the one screen the app opens to and list the three things on it."),
    null,
  );
  assert.equal(
    genericFiller("Message three people who used a food-tracking app and ask what made them stop."),
    null,
  );
  // A breathing practice is a real action when the goal calls for it.
  assert.equal(genericFiller("Take 3 slow breaths with a longer exhale."), null);
});

test("a step copied onto another branch is caught, short instructions are not", () => {
  const repeated = repeatedStep([
    { name: "the body branch", steps: ["Walk for ten minutes and decide the first step for tomorrow."] },
    { name: "the mind branch", steps: ["Walk for ten minutes and decide the first step for tomorrow."] },
  ]);
  assert.ok(repeated);
  assert.equal(repeated?.branches.length, 2);

  assert.equal(
    repeatedStep([
      { name: "the body branch", steps: ["Set a timer."] },
      { name: "the mind branch", steps: ["Set a timer."] },
    ]),
    null,
  );
  assert.equal(
    repeatedStep([
      { name: "the craft branch", steps: ["Set a 15-minute timer and open the meal-log screen."] },
      { name: "the mind branch", steps: ["Read the Supabase auth docs on refresh tokens."] },
    ]),
    null,
  );
});
