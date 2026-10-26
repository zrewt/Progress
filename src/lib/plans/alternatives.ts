import type { PillarId } from "../types";
import type { ThemePractice } from "./types";

/**
 * Swappable practices, three per branch. They keep the promise small and are
 * deliberately general, so any plan can offer a different way to grow the same
 * branch without changing the goal.
 */
export const BRANCH_ALTERNATIVES: Record<PillarId, ThemePractice[]> = {
  body: [
    {
      key: "alt-body-walk",
      branch: "body",
      title: "Walk to the corner and back",
      why: "Easy movement outside is the most repeatable kind of showing up.",
      full: [
        "Put on whatever shoes are by the door.",
        "Walk at a pace that still lets you breathe through your nose.",
        "Notice two things you have not looked at before.",
        "Come back and drink some water.",
      ],
      deep: [
        "Take the longer way round if your body still feels easy.",
        "Finish with a slow stretch of the legs you used most.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Step outside and take ten slow steps.", "Come back in."],
    },
    {
      key: "alt-body-mobility",
      branch: "body",
      title: "A gentle mobility pass",
      why: "Loosening what sitting has tightened makes the next movement easier.",
      full: [
        "Stand and let your arms hang for a moment.",
        "Move your shoulders, hips and ankles through their comfortable range.",
        "Hold anywhere that feels stiff, without pushing into pain.",
        "Finish by standing tall and breathing out slowly.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Roll your shoulders three times each way.", "Stretch your arms overhead once."],
    },
    {
      key: "alt-body-water",
      branch: "body",
      title: "Drink water before anything else",
      why: "A body that is looked after early in the day asks less of you later.",
      full: [
        "Fill a glass of water and drink it standing up.",
        "Put the glass where you will see it again.",
        "Notice how your mouth and head feel afterwards.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Pour a glass of water.", "Drink half of it slowly."],
    },
  ],
  mind: [
    {
      key: "alt-mind-page",
      branch: "mind",
      title: "Empty the page",
      why: "Getting thoughts out of your head makes it easier to see what actually matters.",
      full: [
        "Set a blank page in front of you.",
        "Write whatever is asking for attention, without tidying it.",
        "Circle the one thing that is yours to do.",
        "Close the page and leave the rest for later.",
      ],
      deep: [
        "Read back what you wrote and underline anything repeated.",
        "Decide when that repeated thing gets your attention.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Write three things on your mind.", "Circle one you can act on."],
    },
    {
      key: "alt-mind-read",
      branch: "mind",
      title: "Read one page slowly",
      why: "A little unhurried reading returns attention to the thing in front of you.",
      full: [
        "Choose something you actually want to read.",
        "Read one page without checking anything else.",
        "Say one idea from it in your own words.",
        "Leave a marker where you stopped.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Open what you are reading.", "Read one paragraph and close it."],
    },
    {
      key: "alt-mind-breathe",
      branch: "mind",
      title: "Ten quiet breaths",
      why: "Slowing the breath is the quickest signal that there is no emergency right now.",
      full: [
        "Sit where you will not be interrupted.",
        "Let your breathing slow without forcing it.",
        "Count each breath out until you reach ten.",
        "Open your eyes and look around the room.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Take three slow breaths.", "Name one thing you can hear."],
    },
  ],
  craft: [
    {
      key: "alt-craft-tidy",
      branch: "craft",
      title: "Clear the surface you work on",
      why: "An uncluttered surface lowers the cost of starting tomorrow.",
      full: [
        "Choose the surface you use most.",
        "Put away everything that does not belong there.",
        "Leave out only what you will need next.",
        "Wipe the surface once.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Move three things back where they belong.", "Stop there."],
    },
    {
      key: "alt-craft-one-step",
      branch: "craft",
      title: "Take one real step",
      why: "Progress is a sequence of small, finished actions rather than a mood.",
      full: [
        "Name the project you are avoiding.",
        "Write the smallest next action in one sentence.",
        "Do only that action.",
        "Mark where you will start next time.",
      ],
      deep: [
        "Look at what you finished and name one thing it does well.",
        "Leave a note for tomorrow's first step.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Open the project.", "Do the smallest visible thing, then stop."],
    },
    {
      key: "alt-craft-note",
      branch: "craft",
      title: "Keep a working note",
      why: "A note written for tomorrow saves you from rebuilding today's thinking.",
      full: [
        "Write what you did and where you stopped.",
        "Note the question you would answer next.",
        "Add anything you would otherwise forget.",
        "Leave the note where you will start again.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Write one line about where you stopped.", "Add the next question."],
    },
  ],
  connection: [
    {
      key: "alt-connection-message",
      branch: "connection",
      title: "Send a message that asks about them",
      why: "Closeness is kept alive by small contact, not grand gestures.",
      full: [
        "Choose someone you have not spoken to lately.",
        "Write a message with a real question in it.",
        "Mention something specific you remember.",
        "Send it and let the reply come when it comes.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Send one short message.", "Ask how they are, and mean it."],
    },
    {
      key: "alt-connection-listen",
      branch: "connection",
      title: "Listen without preparing a reply",
      why: "Being properly heard is rarer than advice, and more useful.",
      full: [
        "Choose a conversation today.",
        "Ask one open question and let the answer finish.",
        "Repeat back what you understood.",
        "Only then say what you think.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Ask someone one real question.", "Let them answer without interrupting."],
    },
    {
      key: "alt-connection-thanks",
      branch: "connection",
      title: "Thank someone specifically",
      why: "Naming what someone did makes gratitude something they can keep.",
      full: [
        "Think of something someone did that helped you.",
        "Name the action rather than the feeling.",
        "Tell them, in person or in a message.",
        "Leave it there without asking for anything back.",
      ],
      easyTitle: "The two-minute version",
      easy: ["Send a two-line thank-you.", "Name the thing they did."],
    },
  ],
};
