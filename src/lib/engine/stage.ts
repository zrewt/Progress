/**
 * Where the person is starting from.
 *
 * A 30-day plan for "build an app that helps people eat healthier" is a
 * different plan if the app does not exist yet than if it is already in the
 * store and nobody uses it. The goal text usually says which, and the model
 * needs to know before it writes week 1. This is a hint, never a hard rule:
 * the plan writer is told to follow the goal if it says otherwise.
 */
export type StartingPoint = "nothing" | "exists" | "practice";

/** Things a person can be making, as opposed to things they just do more of. */
const ARTEFACT =
  /\b(app|application|website|site|game|book|novel|course|newsletter|podcast|business|product|tool|plugin|api|service|channel|portfolio|blog|essay|script|album|film|brand)\b/i;

/** Wording that only makes sense if there is already something to grow. */
const ALREADY_THERE =
  /\b(my|our|the) (app|application|website|site|game|book|novel|course|newsletter|podcast|business|product|tool|channel|portfolio|blog)\b|\b(already|existing|half[- ]?finished|unfinished|prototype|mvp|beta|first draft|first version|v1)\b/i;

/** Ambition aimed at an artefact that must therefore already exist. */
const GROWTH =
  /\b(users?|customers?|readers?|subscribers?|audience|downloads?|sales|revenue|sign ?ups?|testers?|followers?|clients?)\b|\blaunch(ed|ing)?\b|\bmarket(ing)?\b|\bship(ped|ping)?\b|\bpublish(ed|ing)?\b|\bmonetiz\w*|\bget (it|them) (out|to)\b/i;

/** A first version, explicitly. */
const FROM_SCRATCH =
  /\b(from scratch|starting (out|from)|never (made|built|written)|first ever|no idea where to start|beginner)\b|\b(my |the |a )?first (app|application|website|site|book|product|business|newsletter|podcast|course)\b/i;

export function startingPointFor(goal: string): StartingPoint {
  const text = goal.toLowerCase();
  if (FROM_SCRATCH.test(text)) return "nothing";
  if (ALREADY_THERE.test(text)) return "exists";
  if (ARTEFACT.test(text)) {
    // "get 100 users for a health app" implies the app exists; "build an app
    // and get users" does not, so a making verb wins over the growth words.
    if (GROWTH.test(text) && !/\b(build|make|create|start|write|design|develop)\b/.test(text)) {
      return "exists";
    }
    return "nothing";
  }
  return "practice";
}

/** The sentence handed to the plan writer, so it never has to guess. */
export function startingPointBrief(point: StartingPoint): string {
  switch (point) {
    case "exists":
      return "something already exists — it is unfinished, unlaunched or not yet used. Week 1 starts from what they have, not from a blank page.";
    case "nothing":
      return "starting from nothing — the first version does not exist yet. Week 1 has to remove the biggest unknown before anything is built.";
    case "practice":
      return "no artefact to make; they want to do more of something, do it better, or feel different. Week 1 measures where they are now.";
  }
}
