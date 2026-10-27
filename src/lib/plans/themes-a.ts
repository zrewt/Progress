import type { PlanTheme } from "./types";

/**
 * Movement, rest and learning themes. Every theme covers all four branches once
 * so a season grows the whole tree rather than one limb of it.
 */
export const THEMES_A: PlanTheme[] = [
  {
    id: "running",
    label: "Running & cardio",
    strong: ["run", "running", "jog", "jogging", "cardio", "marathon", "5k", "10k"],
    weak: ["walk", "walking", "move", "moving", "outside", "outdoors"],
    primary: {
      key: "run-easy-effort",
      branch: "body",
      title: "The day's run or walk",
      why: "Showing up at a pace you can hold is what builds the habit; the distance can wait.",
      full: [
        "Put your shoes on and step outside before deciding how the session will go.",
        "Start with an easy walk, then settle into a pace where you could still speak in sentences.",
        "Turn back while you still feel like you could keep going.",
        "Notice one thing on the way home and remember it.",
      ],
      deep: [
        "Add a few gentle pickups where the ground is even, easing back down between them.",
        "Finish with an easy walk and a slower breath through the nose.",
      ],
      easyTitle: "The two-minute version",
      easy: [
        "Step outside and walk to the end of the street.",
        "Turn around and come back, however slowly.",
      ],
    },
    supporting: [
      {
        key: "run-route-not-result",
        branch: "mind",
        title: "Plan the route, not the result",
        why: "Deciding the path in advance removes the negotiation that usually ends in staying home.",
        full: [
          "Choose the route you will actually use this week and write it down.",
          "Name the shorter loop you will take on a low day.",
          "Leave both somewhere you will see them before you leave.",
        ],
        easyTitle: "The two-minute version",
        easy: [
          "Write the short loop you will use when energy is low.",
          "Close the note. The decision is made.",
        ],
      },
      {
        key: "run-simple-log",
        branch: "craft",
        title: "Keep a simple run log",
        why: "A plain record of what you did is proof of progress that no missed day can erase.",
        full: [
          "Write the date and what you did in one line.",
          "Add a word about the weather or how your legs felt.",
          "Note what you would repeat next time.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Open your log and write today's date.", "Add one word for how it went."],
      },
      {
        key: "run-with-someone",
        branch: "connection",
        title: "Move with someone",
        why: "A standing appointment with another person is easier to keep than a promise to yourself.",
        full: [
          "Message one person you would genuinely like to move with.",
          "Suggest the easy version, not the impressive one.",
          "Agree on a time and a place you both know.",
        ],
        easyTitle: "The two-minute version",
        easy: [
          "Send a short message inviting someone for a walk.",
          "Leave it at that; no planning needed yet.",
        ],
      },
    ],
  },
  {
    id: "strength",
    label: "Strength",
    strong: ["strength", "strong", "stronger", "gym", "lift", "lifting", "weights", "workout", "muscle", "squat", "pushup", "deadlift", "fitness", "fitter", "in shape", "tennis", "soccer", "football", "basketball", "hockey", "swim", "swimming", "cycle", "cycling", "bike", "climb", "climbing", "golf", "badminton", "volleyball", "rugby", "cricket", "boxing", "martial arts", "sprint", "sport", "sports", "athletic", "athlete"],
    weak: ["train", "training", "exercise", "move", "body"],
    primary: {
      key: "strength-small-set",
      branch: "body",
      title: "The day's strength set",
      why: "A short set done with care beats a long one you keep postponing.",
      full: [
        "Set out the space and anything you plan to hold.",
        "Warm up with easy movement until your joints feel ready.",
        "Work through movements you already know, stopping well before your form slips.",
        "Finish with a slow stretch and a glass of water.",
      ],
      deep: [
        "Add one more round of the movement that feels steadiest today.",
        "Finish with slow breathing while you stand still.",
      ],
      easyTitle: "The two-minute version",
      easy: [
        "Do one set of the movement you know best.",
        "Stop there and mark the day done.",
      ],
    },
    supporting: [
      {
        key: "strength-notice-effort",
        branch: "mind",
        title: "Notice effort without judging it",
        why: "Reading your own effort kindly keeps training something you return to.",
        full: [
          "Before you start, notice how your body feels without deciding it is good or bad.",
          "During the set, name the effort in plain words.",
          "Afterwards, write one sentence about what felt steady.",
        ],
        easyTitle: "The two-minute version",
        easy: [
          "Stand still and notice where your body holds tension.",
          "Let one of those places soften.",
        ],
      },
      {
        key: "strength-simple-note",
        branch: "craft",
        title: "Keep a simple strength note",
        why: "Remembering what worked last time saves you from starting over every week.",
        full: [
          "Write what you did and how it felt.",
          "Mark the movement you want to repeat.",
          "Leave the note where you train.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Write one line about today's session.", "Put it where you will see it next time."],
      },
      {
        key: "strength-ask-company",
        branch: "connection",
        title: "Ask someone to join or spot",
        why: "Company makes the session feel like part of a life rather than a test.",
        full: [
          "Ask one person whether they would train alongside you.",
          "Offer to follow their pace rather than yours.",
          "Agree on the simplest version you can both do.",
        ],
        easyTitle: "The two-minute version",
        easy: [
          "Send one message asking someone to join you.",
          "That counts as today's connection.",
        ],
      },
    ],
  },
  // NEEDS DOMAIN REVIEW: a clinician should check the wind-down wording before release.
  {
    id: "sleep",
    label: "Sleep & wind-down",
    strong: ["sleep", "sleeping", "asleep", "bedtime", "bed", "bedroom", "insomnia", "wake", "waking", "tired", "rest", "dream", "midnight", "oversleep"],
    weak: ["evening", "night", "routine", "wind", "calm"],
    needsDomainReview: true,
    primary: {
      key: "sleep-wind-down",
      branch: "body",
      title: "The wind-down before bed",
      why: "A repeated quiet hour tells your body the day is finished, whatever the day was like.",
      full: [
        "Dim the lights and put your phone somewhere you cannot reach it from bed.",
        "Set out tomorrow's first small thing so morning needs no decisions.",
        "Do something quiet with your hands or a page until you feel sleepy.",
        "Lie down and let the day finish without replaying it.",
      ],
      deep: [
        "Write down tomorrow's one priority and close the notebook.",
        "Step outside for a moment of cool air before you settle.",
      ],
      easyTitle: "The two-minute version",
      easy: [
        "Turn off one bright light and put your phone out of reach.",
        "Get into bed and let that be enough.",
      ],
    },
    supporting: [
      {
        key: "sleep-park-thoughts",
        branch: "mind",
        title: "Park tomorrow's thoughts",
        why: "Writing worries down gives them somewhere to wait, so they stop circling at night.",
        full: [
          "Write the things you are afraid of forgetting.",
          "Next to each, note whether it can wait until morning.",
          "Close the page and leave it outside the bedroom.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Write one thing you are holding in your head.", "Tell yourself it can wait until morning."],
      },
      {
        key: "sleep-tidy-landing",
        branch: "craft",
        title: "Tidy the landing place",
        why: "A clear surface in the morning is a small kindness you leave for yourself.",
        full: [
          "Clear one surface you will see first tomorrow.",
          "Put away the things that belong somewhere else.",
          "Leave out only what you will need.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Move three things off the surface you see first.", "Stop there."],
      },
      {
        key: "sleep-say-goodnight",
        branch: "connection",
        title: "Say goodnight properly",
        why: "A warm end to the day is easier to rest after than a screen.",
        full: [
          "Think of one person you are glad to have in your life.",
          "Send them a short, honest message if the hour allows.",
          "Put the phone down before you read the reply.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Send one short goodnight message.", "Put the phone away afterwards."],
      },
    ],
  },
  // NEEDS DOMAIN REVIEW: nutrition wording must be checked for restrictive or medical claims.
  {
    id: "nutrition",
    label: "Food & evening habits",
    strong: ["eat", "eating", "meal", "meals", "food", "snack", "snacking", "sugar", "diet", "nutrition", "cook", "cooking", "kitchen", "hunger"],
    weak: ["night", "evening", "late", "drink", "water", "cravings"],
    needsDomainReview: true,
    primary: {
      key: "nutrition-steady-meal",
      branch: "body",
      title: "One steady meal",
      why: "Regular, ordinary meals are the foundation; hunger is information, not failure.",
      full: [
        "Choose something you can make without a recipe.",
        "Put it on a plate and sit down to eat it.",
        "Notice when you have had enough and let the rest wait.",
        "Have some water alongside it.",
      ],
      deep: [
        "Make enough for another meal and put it away while you eat.",
        "Eat the first few bites without doing anything else.",
      ],
      easyTitle: "The two-minute version",
      easy: [
        "Put something you already have on a plate.",
        "Sit down to eat it, even briefly.",
      ],
    },
    supporting: [
      {
        key: "nutrition-eat-without-screen",
        branch: "mind",
        title: "Eat without a screen",
        why: "Paying attention to a meal makes it easier to notice what you actually want.",
        full: [
          "Put your phone in another room before you sit down.",
          "Take the first few bites without doing anything else.",
          "When your attention drifts, come back to the food without scolding yourself.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Put your phone out of reach for one meal.", "Take one bite before you pick it up again."],
      },
      {
        key: "nutrition-kitchen-ready",
        branch: "craft",
        title: "Keep the kitchen ready",
        why: "A kitchen that is easy to walk into makes an ordinary meal the easy choice.",
        full: [
          "Clear the surface you cook on.",
          "Put the things you reach for most where you can see them.",
          "Leave one simple option ready for a tired evening.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Clear one patch of counter.", "Put one thing back where it belongs."],
      },
      {
        key: "nutrition-share-a-meal",
        branch: "connection",
        title: "Share a meal or a note",
        why: "Eating with someone, or simply telling them about your day, makes food part of a life.",
        full: [
          "Ask someone to eat with you, in person or on a call.",
          "Keep the invitation simple and the timing flexible.",
          "Put the phone away while you are together.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Send someone a message about what you ate today.", "Ask them what they had."],
      },
    ],
  },
  {
    id: "study",
    label: "Study & languages",
    strong: ["study", "studying", "learn", "learning", "language", "spanish", "french", "german", "italian", "japanese", "read", "reading", "book", "course", "exam", "memorize", "vocabulary"],
    weak: ["skill", "pages", "chapter", "notes", "revision"],
    primary: {
      key: "study-next-small-piece",
      branch: "mind",
      title: "The day's study block",
      why: "Learning sticks when you return to the same thread often, not when you read everything at once.",
      full: [
        "Open the material to the exact place you stopped.",
        "Work through the next small piece once, slowly.",
        "Close it and say the main idea out loud from memory.",
        "Mark where to begin tomorrow.",
      ],
      deep: [
        "Write down the questions you still cannot answer.",
        "Test yourself on yesterday's piece before adding anything new.",
      ],
      easyTitle: "The two-minute version",
      easy: [
        "Open to where you stopped and read one page.",
        "Close it and say one thing you remember.",
      ],
    },
    supporting: [
      {
        key: "study-sit-so-you-can-stay",
        branch: "body",
        title: "Sit so you can stay",
        why: "A body that is comfortable enough stops interrupting the work.",
        full: [
          "Set up your chair and desk before you open the material.",
          "Put water within reach.",
          "Pause once to stretch your shoulders and jaw.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Adjust your chair and put your feet flat.", "Roll your shoulders once and begin."],
      },
      {
        key: "study-notes-you-reuse",
        branch: "craft",
        title: "Make notes you will reuse",
        why: "A short note in your own words is worth more than a page copied from the book.",
        full: [
          "Write the idea in your own words, without looking.",
          "Add one example you could explain to someone else.",
          "Leave a question at the bottom for next time.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Write one sentence in your own words.", "Add a question underneath it."],
      },
      {
        key: "study-explain-it",
        branch: "connection",
        title: "Explain it to someone",
        why: "Trying to explain something shows you exactly where your understanding stops.",
        full: [
          "Choose one person who would listen for a moment.",
          "Explain the idea in plain words, without notes.",
          "Notice the part you stumbled on and write it down.",
        ],
        easyTitle: "The two-minute version",
        easy: ["Say the idea out loud as if explaining it.", "Note the part that felt unclear."],
      },
    ],
  },
];
