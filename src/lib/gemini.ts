import { PILLARS } from "./pillars";
import {
  assessGoalSafety,
  clampDurationToBudget,
  sanitizeGeneratedNode,
  scrubGoalForPrivacy,
} from "./safety";
import { classifyGoal, preparationTree, requiresPreparation, safeForCategory, validatePracticeText, validateStepsWithinBudget } from "./safety-rules";
import type { Practice, PracticeDraft } from "./daily-types";
import { stageRanges } from "./engine/schedule";
import { addDays } from "./progression";
import { validateWeeklyDraft, type WeeklyDraft } from "../../supabase/functions/generate-tree/plan-validation";
import { fallbackReason, type FallbackReason } from "./engine/fallback";
import { GENERAL_QUESTIONS, validateQuestions } from "../../supabase/functions/generate-tree/questions";
import type {
  BlockerId,
  GeneratedEasy,
  GeneratedNode,
  GeneratedTree,
  IdentityId,
  OnboardingAnswers,
  PillarId,
  PlanHistory,
  PersonalizationQuestion,
} from "./types";

export { fallbackReason };
export type { FallbackReason };

export type TreeSource = "edge-ai" | "seed-engine";

export interface TreeResult {
  tree: GeneratedTree;
  source: TreeSource;
  reason?: FallbackReason;
  /** The server's own short reason, when it has one worth reading. */
  detail?: string;
}

type GoalTheme =
  | "running"
  | "strength"
  | "sleep"
  | "nutrition"
  | "coding"
  | "writing"
  | "reading"
  | "speaking"
  | "language"
  | "general";

function detectGoalTheme(goal: string, identity: IdentityId): GoalTheme {
  const lower = goal.toLowerCase();
  if (
    /\b(eat|eating|snack|snacking|sugar|junk|diet|kitchen|meal|late[- ]?night|water|hydrat)\b/.test(
      lower,
    )
  ) {
    return "nutrition";
  }
  if (/\b(run|5k|10k|jog|cardio|mile|marathon|walk)\b/.test(lower)) {
    return "running";
  }
  if (/\b(sleep|recover|rest|wake|bed|insomnia)\b/.test(lower)) {
    return "sleep";
  }
  if (
    /\b(strength|strong|lift|push-?up|gym|workout|muscle|move my body|tennis|soccer|football|basketball|hockey|swim|swimming|cycl\w*|bike|climb\w*|golf|badminton|volleyball|rugby|cricket|boxing|martial arts|sprint\w*|sport\w*|athlet\w*)\b/.test(
      lower,
    )
  ) {
    return "strength";
  }
  if (/\b(code|coding|program|app|project|ship|software|build|launch)\b/.test(lower)) {
    return "coding";
  }
  if (/\b(writ(e|ing)|journal|blog|essay|publish|post|content|sketch|draw|create)\b/.test(lower)) {
    return "writing";
  }
  if (/\b(read|book|study|course|exam|learn)\b/.test(lower)) {
    return "reading";
  }
  if (/\b(speak|class|social|confiden|talk|present|voice)\b/.test(lower)) {
    return "speaking";
  }
  if (/\b(language|spanish|french|japanese|vocab|fluency)\b/.test(lower)) {
    return "language";
  }
  if (identity === "athlete") return "strength";
  if (identity === "scholar") return "reading";
  if (identity === "builder") return "coding";
  return "writing";
}

function blockerStep(blocker: BlockerId): string {
  switch (blocker) {
    case "distraction":
      return "Set your phone in another room or face-down out of reach before starting.";
    case "overthinking":
      return "Do not plan or edit — start the timer and take the very first action within 10 seconds.";
    case "energy":
      return "Keep the effort at 60% so you finish with more energy than you started with.";
    case "time":
      return "Attach the practice to a slot you already keep — after a meal or before a shower — never to leftover time.";
    case "stress":
      return "Keep the easiest version ready for low days; a two-minute day still counts completely.";
    case "perfectionism":
      return "Stop at two minutes even when it is going well, so finishing stays easy to repeat.";
    case "consistency":
    default:
      return "Stop on time while it still feels easy so tomorrow's repetition is automatic.";
  }
}

interface ThemeBranchTemplate {
  focus: string;
  nodes: {
    title: string;
    minutes: number;
    description: string;
    steps: [string, string];
  }[];
}

/**
 * The four stages of making something, for the on-device library.
 *
 * The model writes its own arc from the person's goal. This is the honest
 * version when it cannot be reached: find out, make the smallest real thing,
 * put it in front of someone, respond. Four different acts on purpose, because
 * "work on it" four weeks in a row is not a plan.
 */
function craftStages(theme: GoalTheme, goal: string): ThemeBranchTemplate["nodes"] {
  if (theme === "coding") {
    return [
      {
        title: "Draw the One Screen It Opens To",
        minutes: 2,
        description: `Every app starts as one screen someone opens to do one thing, and "${goal}" needs that screen named before anything is built.`,
        steps: [
          "Sketch that screen on paper and list the three things on it.",
          "Write the single sentence under the title that says what it does.",
        ],
      },
      {
        title: "Make That One Screen Work End to End",
        minutes: 10,
        description: "One screen that loads real data and saves it is a working app; three unfinished screens are not.",
        steps: [
          "Show one real saved item on that screen, unstyled is fine.",
          "Make adding that item save, and survive a reload.",
        ],
      },
      {
        title: "Put It in Front of Three People",
        minutes: 10,
        description: "Their stuck point becomes the next thing you build; without them it is a guess.",
        steps: [
          "Send the build or a 60-second recording to three people with the problem.",
          "Ask each to do the one core action, and note where they stop.",
        ],
      },
      {
        title: "Fix the Step They Got Stuck On",
        minutes: 15,
        description: "Fixing the first place two of three testers stopped beats any new feature you could add.",
        steps: [
          "Change that step so it needs no explanation.",
          "Send build 2 to the same three people and ask whether it worked.",
        ],
      },
    ];
  }
  if (theme === "reading" || theme === "language") {
    return [
      {
        title: "Find the Sentence That Does Not Make Sense",
        minutes: 2,
        description: "Reading on past the unclear sentence wastes the rest of the session.",
        steps: [
          "Open the chapter you have been avoiding and find the first sentence you cannot explain.",
          "Write it in your own words, badly, with the book closed.",
        ],
      },
      {
        title: "Read Only That Section, Pen Down",
        minutes: 10,
        description: "One section understood beats ten pages skimmed.",
        steps: [
          "Read that section once without taking notes.",
          "Close the book and write what it said from memory.",
        ],
      },
      {
        title: "Say It Out Loud to One Person",
        minutes: 10,
        description: "Explaining it exposes the part you only half know.",
        steps: [
          "Explain the idea in three sentences, with no notes.",
          "Ask them to repeat it back; their version shows the gap.",
        ],
      },
      {
        title: "Use It in a Real Sentence or Problem",
        minutes: 15,
        description: "Knowledge you have used once is knowledge you keep.",
        steps: [
          "Use the new structure in your own writing, or in one practice problem.",
          "Mark where you still hesitated and take that back to the book.",
        ],
      },
    ];
  }
  if (theme === "speaking") {
    return [
      {
        title: "Record 60 Seconds on the Real Topic",
        minutes: 2,
        description: "You cannot improve a talk you have never heard yourself give.",
        steps: [
          "Record one minute on the thing you actually have to say.",
          "Listen once and note the first sentence that lost you.",
        ],
      },
      {
        title: "Rebuild the Opening Line",
        minutes: 10,
        description: "The first ten words decide whether the rest is heard.",
        steps: [
          "Write the opening so it makes one claim, in ten words.",
          "Record it three times and keep the clearest take.",
        ],
      },
      {
        title: "Say It to One Person",
        minutes: 10,
        description: "A face tells you more than a recording does.",
        steps: [
          "Give the opening to one person and watch their face, not your notes.",
          "Ask what they think you are claiming.",
        ],
      },
      {
        title: "Deliver the Whole Thing Once",
        minutes: 15,
        description: "Finishing once, badly, is what makes the second time possible.",
        steps: [
          "Deliver it end to end without stopping, even when a line goes wrong.",
          "Note the two places you rushed, and fix only those.",
        ],
      },
    ];
  }
  return [
    {
      title: "Write the One Sentence It Argues",
      minutes: 2,
      description: `If the claim of "${goal}" cannot fit in one sentence, the draft will wander.`,
      steps: [
        "Write the single claim of the piece in one sentence.",
        "List the three things a reader would need to believe it.",
      ],
    },
    {
      title: "Draft Three Hundred Bad Words",
      minutes: 10,
      description: "Three hundred finished words beat a perfect page you never wrote.",
      steps: [
        "Write 300 words on the first point without editing.",
        "Stop at 300 even if it is going well.",
      ],
    },
    {
      title: "Read It to One Person",
      minutes: 10,
      description: "The confused face is the edit list, and it costs nothing.",
      steps: [
        "Read the draft aloud to one person without explaining it first.",
        "Write down the first place they looked confused.",
      ],
    },
    {
      title: "Cut What They Skipped",
      minutes: 15,
      description: "Cutting the weak part is the work, not a failure of it.",
      steps: [
        "Cut or rewrite the part they stumbled on, and nothing else.",
        "Read the piece end to end once, then stop.",
      ],
    },
  ];
}

function templatesForTheme(
  theme: GoalTheme,
  goal: string,
): Record<PillarId, ThemeBranchTemplate> {
  const shortGoal = goal.trim() || "your goal";

  // One practice for the body that actually serves a sitting, thinking goal:
  // leave the screen, move, and come back with the next step decided. Each node
  // is the same act one step further, so the four weeks form a ramp rather than
  // four unrelated exercises.
  const commonBody: ThemeBranchTemplate = {
    focus: "A body that can stay with the work",
    nodes: [
      {
        title: "Two minutes away from the screen",
        minutes: 2,
        description: `Leave the screen before you start "${shortGoal}", so you begin with your own attention rather than the last thing you read.`,
        steps: [
          "Stand and walk to the far side of the room without your phone.",
          "Name the first thing you will do when you sit back down.",
        ],
      },
      {
        title: "The short walk that solves it",
        minutes: 10,
        description: `Movement is where the next step usually appears, not more staring at "${shortGoal}".`,
        steps: [
          "Walk outside or the length of your space until you can say the problem in one sentence.",
          "Decide the one thing you will try first when you get back.",
        ],
      },
      {
        title: "Walk, decide, then do the first thing",
        minutes: 15,
        description: "The walk only pays off if the first action happens before the day gets loud.",
        steps: [
          "Walk until the next step is clear, then come straight back in.",
          "Do that one action before you open anything else.",
        ],
      },
      {
        title: "End the day on your feet",
        minutes: 10,
        description: `Close "${shortGoal}" with your body, not another screen.`,
        steps: [
          "Walk outside without your phone and let the day settle.",
          "Set out what you need for tomorrow's first step, then stop.",
        ],
      },
    ],
  };

  if (theme === "nutrition") {
    return {
      body: {
        focus: "Evening Reset & Steady Energy",
        nodes: [
          {
            title: "Kitchen-Closed Herbal Tea or Water Seed",
            minutes: 2,
            description: `A calm 2-minute physical cue that closes the kitchen and supports "${shortGoal}".`,
            steps: [
              "Pour a glass of water or warm caffeine-free tea after your final meal.",
              "Turn off the bright kitchen light as a clear signal that eating is done for the night.",
            ],
          },
          {
            title: "Brush & Floss Right After Dinner",
            minutes: 5,
            description: "Use a clean-mouth cue early in the evening so late cravings lose their pull.",
            steps: [
              "Brush and floss within 20 minutes of finishing dinner instead of waiting until bedtime.",
              "Take 3 slow breaths and notice how fresh and settled your body feels.",
            ],
          },
          {
            title: "Ten-Minute Post-Dinner Digestion Walk",
            minutes: 10,
            description: "Settle blood sugar and evening restlessness with an easy walk.",
            steps: [
              "Step outside or walk around your space for 10 unhurried minutes after eating.",
              "Keep your pace easy and let your shoulders drop.",
            ],
          },
          {
            title: "Balanced Daytime Fuel Check",
            minutes: 15,
            description: "Make sure you eat enough protein and fiber earlier so night cravings fade naturally.",
            steps: [
              "Prep a satisfying daytime meal or afternoon snack so you never arrive at night starving.",
              "Eat your meal seated without scrolling.",
            ],
          },
        ],
      },
      mind: {
        focus: "Craving Surfing & Calm",
        nodes: [
          {
            title: "90-Second Craving Wave Pause",
            minutes: 2,
            description: "Distinguish real hunger from boredom, stress, or tired scrolling.",
            steps: [
              "When an evening urge hits, pause for 90 seconds and ask: 'Am I hungry, bored, or tired?'",
              "Take 5 slow exhales before deciding your next move.",
            ],
          },
          {
            title: "Stress-to-Snack Trigger Note",
            minutes: 5,
            description: `Spot the exact moment "${shortGoal}" usually gets tested.`,
            steps: [
              "Jot down the time and mood when late-night cravings usually appear.",
              "Pick one non-food reward (a warm shower, a chapter, a stretch) for that window.",
            ],
          },
          {
            title: "Screen-Off Wind-Down Block",
            minutes: 10,
            description: "Late-night scrolling triggers late-night snacking; calm both together.",
            steps: [
              "Put your phone on its charger outside the kitchen 30 minutes before bed.",
              "Dim the room lights so your brain shifts into sleep mode.",
            ],
          },
          {
            title: "30-Day Evening Rhythm Review",
            minutes: 10,
            description: "Notice how much better your mornings feel when your evenings stay calm.",
            steps: [
              "Rate your morning energy and sleep quality compared to Day 1.",
              "Lock in the single evening cue that helped the most.",
            ],
          },
        ],
      },
      craft: {
        focus: "Environment & Evening Design",
        nodes: [
          {
            title: "Clear Countertop 2-Minute Reset",
            minutes: 2,
            description: "Out of sight, out of mind — make the default choice the easy choice.",
            steps: [
              "Put snack bags and treats inside a high cabinet or opaque container before 8 PM.",
              "Wipe down the counter so the kitchen looks closed for the night.",
            ],
          },
          {
            title: "Prep Tomorrow's Morning Anchor",
            minutes: 6,
            description: "Shift your focus from late-night grazing to a great breakfast.",
            steps: [
              "Set out your morning coffee, tea, or breakfast bowl before leaving the kitchen.",
              "Fill your water bottle for the nightstand.",
            ],
          },
          {
            title: "Replacement Ritual Setup",
            minutes: 10,
            description: "Give your hands and mind something better to do at night.",
            steps: [
              "Set a book, sketchbook, or cozy activity on the couch before dinner.",
              "Spend 10 minutes on it during your usual snacking window.",
            ],
          },
          {
            title: "Personal Evening Blueprint",
            minutes: 15,
            description: `Turn "${shortGoal}" into an effortless house rule.`,
            steps: [
              "Define your ideal kitchen-closed time and your go-to evening drink.",
              "Write a simple 'grace rule' for social nights out so one late meal never breaks your streak.",
            ],
          },
        ],
      },
      connection: {
        focus: "Supportive Space & Boundaries",
        nodes: [
          {
            title: "Share Your Kitchen-Closed Cue",
            minutes: 2,
            description: "Let the people around you know your new evening rhythm.",
            steps: [
              "Tell a roommate, partner, or friend about your evening goal and checkpoint.",
              "Ask them to join you for tea or a quick chat instead of late snacks.",
            ],
          },
          {
            title: "Evening Check-In Text",
            minutes: 5,
            description: "Replace solo boredom grazing with a quick human connection.",
            steps: [
              "Send a quick voice note or text to a friend during your toughest evening hour.",
              "Share one small win from today.",
            ],
          },
          {
            title: "Phone-Free Dinner Presence",
            minutes: 15,
            description: "Eating slowly and present at dinner prevents rebound hunger at 10 PM.",
            steps: [
              "Put screens away during your evening meal.",
              "Eat at an unhurried pace so fullness signals actually register.",
            ],
          },
          {
            title: "Shared Wind-Down Ritual",
            minutes: 15,
            description: "Anchor your evening around connection or calm instead of the pantry.",
            steps: [
              "Plan an evening walk, call, or board/reading hour with someone you care about.",
              "Celebrate keeping your evening promise.",
            ],
          },
        ],
      },
    };
  }

  if (theme === "running" || theme === "strength") {
    return {
      body: {
        focus: theme === "running" ? "Stride & Aerobic Base" : "Progressive Strength",
        nodes: [
          {
            title: "Shoes-On Doorstep Seed",
            minutes: 2,
            description: `Lace up and do 2 minutes of ankle, hip, and calf prep for "${shortGoal}".`,
            steps: [
              "Put on your movement shoes and step outside or onto your mat.",
              "Do 10 slow calf raises, 8 leg swings per side, and 5 deep squats.",
            ],
          },
          {
            title: theme === "running" ? "Easy Nose-Breathing Pace" : "Foundational Bodyweight Set",
            minutes: 10,
            description: `Build consistency toward "${shortGoal}" without soreness or burnout.`,
            steps: [
              theme === "running"
                ? "Alternate 90 seconds of easy jogging with 60 seconds of walking."
                : "Complete 3 controlled sets of squats, push-ups, and glute bridges.",
              "Keep the pace easy enough that you could speak in full sentences.",
            ],
          },
          {
            title: theme === "running" ? "Steady Cadence Session" : "Progressive Overload Block",
            minutes: 18,
            description: `A focused main session that moves "${shortGoal}" forward safely.`,
            steps: [
              theme === "running"
                ? "Warm up 3 minutes, then hold a smooth, relaxed rhythm for the main block."
                : "Add 1–2 quality reps to each set while keeping your form crisp.",
              "Finish with 2 minutes of slow walking and nasal breathing.",
            ],
          },
          {
            title: "Signature Endurance Milestone",
            minutes: 25,
            description: `Your capstone session marking this planning checkpoint for "${shortGoal}".`,
            steps: [
              "Start unhurried for the first 5 minutes and settle into your strongest sustainable rhythm.",
              "Cool down gently and record how much easier the baseline feels now.",
            ],
          },
        ],
      },
      mind: {
        focus: "Pacing & Mental Grit",
        nodes: [
          {
            title: "60-Second Pre-Session Intention",
            minutes: 2,
            description: "Quiet the excuse voice before it talks you out of starting.",
            steps: [
              "Write one sentence: what 'showing up today' looks like at minimum.",
              "Take three slow exhales and begin immediately.",
            ],
          },
          {
            title: "Rhythm Over Mood Check-In",
            minutes: 5,
            description: "Separate how you feel from the small promise you made today.",
            steps: [
              "Rate your energy 1–5 without judgment and pick the matching effort level.",
              "Remind yourself: a gentle session still grows the branch.",
            ],
          },
          {
            title: "Ten-Minute Unplugged Reset",
            minutes: 10,
            description: "Lower stress hormones so your body can actually adapt and recover.",
            steps: [
              "Sit or lie down for 10 minutes with eyes closed and no audio.",
              "Lengthen your exhale to 6 seconds whenever your mind races.",
            ],
          },
          {
            title: "30-Day Athlete Reflection",
            minutes: 12,
            description: "Review the sessions you kept and lock in your next baseline.",
            steps: [
              "List 3 moments this month where you showed up despite low motivation.",
              "Choose the single anchor habit you will carry into next season.",
            ],
          },
        ],
      },
      craft: {
        focus: "Technique & Preparation",
        nodes: [
          {
            title: "Lay Out Tomorrow's Gear",
            minutes: 2,
            description: "Remove all morning friction so starting takes zero decisions.",
            steps: [
              "Set your shoes, clothes, and water bottle in plain sight tonight.",
              "Pick the exact 15-minute window on tomorrow's calendar.",
            ],
          },
          {
            title: "Form & Mobility Drill",
            minutes: 6,
            description: `Practice the mechanics that keep "${shortGoal}" pain-free.`,
            steps: [
              "Spend 6 minutes rehearsing tall posture, core bracing, and smooth breathing.",
              "Film or check 1 set to notice where tension creeps in.",
            ],
          },
          {
            title: "Fuel & Hydration Prep",
            minutes: 10,
            description: "Prep a simple whole-food meal or hydration bottle to back your training.",
            steps: [
              "Fill a full bottle of water and prep one protein-rich snack or meal.",
              "Eat without a screen so you notice real fullness and energy.",
            ],
          },
          {
            title: "Personal Training Blueprint",
            minutes: 15,
            description: "Design a repeatable 3-day weekly template you can keep all year.",
            steps: [
              "Map out your 3 non-negotiable movement days and 2 active recovery days.",
              "Write your 'minimum viable session' rule for busy weeks.",
            ],
          },
        ],
      },
      connection: {
        focus: "Accountability & Shared Energy",
        nodes: [
          {
            title: "Declare Your Seed Goal",
            minutes: 2,
            description: `Tell one trusted person what you are building with "${shortGoal}".`,
            steps: [
              "Send a 1-sentence text to a friend sharing your goal and checkpoint.",
              "Ask them to check in with you once at the end of the week.",
            ],
          },
          {
            title: "Invite a Side-by-Side Walk",
            minutes: 10,
            description: "Combine movement with real conversation.",
            steps: [
              "Ask a friend, family member, or classmate for a 10-minute walk.",
              "Keep phones pocketed the entire time.",
            ],
          },
          {
            title: "Share an Honest Progress Note",
            minutes: 10,
            description: "Share what worked this week without waiting for a 'perfect' result.",
            steps: [
              "Send a quick note or photo from today's session to someone rooting for you.",
              "Name one thing that felt easier than Day 1.",
            ],
          },
          {
            title: "Anchor a Weekly Ritual",
            minutes: 15,
            description: "Turn solo effort into a shared weekly rhythm.",
            steps: [
              "Schedule a recurring weekly walk, run, or workout check-in with one person.",
              "Agree on a simple rain-or-shine backup plan.",
            ],
          },
        ],
      },
    };
  }

  return {
    body: commonBody,
    mind: {
      focus: "Focus & Calm Attention",
      nodes: [
        {
          title: "Two-Minute Clear-the-Deck Reset",
          minutes: 2,
          description: `Empty mental tabs before you touch "${shortGoal}".`,
          steps: [
            "Close every unrelated browser tab and write down any nagging to-do on paper.",
            "Take 3 slow breaths before starting your main craft step.",
          ],
        },
        {
          title: "Ten Minutes of Deep Input",
          minutes: 10,
          description: `Feed your mind quality material connected to "${shortGoal}".`,
          steps: [
            "Read or study one focused source for 10 minutes with notifications off.",
            "Write down one single idea you can apply today.",
          ],
        },
        {
          title: "Single-Tab Focus Sprint",
          minutes: 15,
          description: "Train the attention span that makes real skill growth possible.",
          steps: [
            "Set a 15-minute timer and keep only one workspace open.",
            "If you feel the urge to switch tasks, pause and take one breath instead.",
          ],
        },
        {
          title: "Evening Shutdown Ritual",
          minutes: 8,
          description: "End the day cleanly so your brain rests without guilt.",
          steps: [
            "Write down the exact first step you will take tomorrow for your goal.",
            "Close your workspace and put screens away 30 minutes before bed.",
          ],
        },
      ],
    },
    craft: {
      focus:
        theme === "coding"
          ? "The Build Itself"
          : theme === "reading" || theme === "language"
            ? "Deliberate Study & Recall"
            : theme === "speaking"
              ? "Voice & Brave Reps"
              : "Daily Making & Output",
      // Four stages, not four repeats of one act: find out, make the smallest
      // real thing, put it in front of someone, respond. Without the arc a local
      // plan is "work on it" four times, which is what made it useless.
      nodes: craftStages(theme, shortGoal),
    },
    connection: {
      focus: "Environment & Honest Sharing",
      nodes: [
        {
          title: "Name Your Goal and Checkpoint",
          minutes: 2,
          description: `Make "${shortGoal}" real outside your own head.`,
          steps: [
            "Write your goal and the next checkpoint in plain words.",
            "Tell them you are starting with a 2-minute daily seed.",
          ],
        },
        {
          title: "Ask One Real Question",
          minutes: 8,
          description: "Connect with someone who is also building or learning.",
          steps: [
            "Reach out to one peer or mentor and ask one specific question.",
            "Listen or read their reply without rushing to prove yourself.",
          ],
        },
        {
          title: "Share a Work-in-Progress",
          minutes: 12,
          description: `Show a small piece of "${shortGoal}" before it feels perfect.`,
          steps: [
            "Pick one draft, note, or milestone from this week.",
            "Send it to one trusted person and ask for one honest observation.",
          ],
        },
        {
          title: "Co-Working or Shared Check-In",
          minutes: 15,
          description: "Build a repeatable social anchor around your growth.",
          steps: [
            "Set up a 15-minute body-doubling session or weekly progress swap with a friend.",
            "Celebrate what you both kept consistent this week.",
          ],
        },
      ],
    },
  };
}

/**
 * Deterministic, goal-tailored Starting Seed Tree generator.
 * Used as the instant local seed engine and as the safety repair baseline for Edge AI responses.
 */
export function buildSeedPlan(answers: OnboardingAnswers): GeneratedTree {
  const safety = assessGoalSafety(answers.goal);
  const safeGoal = safety.safe
    ? answers.goal.trim()
    : safety.suggestion ?? "Build a calm, consistent daily practice";

  const theme = detectGoalTheme(safeGoal, answers.identity);
  const templates = templatesForTheme(theme, safeGoal);
  const antiBlockerInstruction = blockerStep(answers.blocker);

  const result: GeneratedTree = {
    summary: `Your next ${answers.daysRemaining ?? 30} days: ${safeGoal}. One ${answers.timeBudget}-minute practice a day, plus three lighter ones across the week, and a smaller version for the days it does not fit.`,
    stages: answers.legEnd && answers.daysRemaining ? stageRanges(addDays(answers.legEnd, -answers.daysRemaining), answers.daysRemaining).map((range, i) => ({ ...range, title: `Stage ${i + 1}`, outcome: "Review this part of your goal at the checkpoint." })) : undefined,
    realityCheck: answers.daysRemaining ? { level: "stretch", explanation: "This local starter cannot assess the deadline; review the first actions and adjust your goal or date if needed." } : undefined,
    safetyNote:
      safety.coachingNote ??
      "Safety & pacing active: start with 2-minute seeds, stay inside your time budget, and rest when needed.",
    pillars: PILLARS.map((pillar) => {
      const branch = templates[pillar.id];
      return {
        pillar: pillar.id,
        focus: branch.focus,
        nodes: branch.nodes.slice(0, answers.daysRemaining ? 2 : 4).map((node, tier) => ({
          title: node.title,
          duration: clampDurationToBudget(
            `${node.minutes} min`,
            tier,
            answers.timeBudget,
          ),
          description: node.description,
          instructions: [node.steps[0], node.steps[1], antiBlockerInstruction],
        })),
      };
    }),
  };
  return requiresPreparation(classifyGoal(answers.goal), !!answers.conservativeMode) ? preparationTree(result) : result;
}




function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** The model's own two-minute version, accepted only if it stays short and safe. */
function asEasy(value: unknown): GeneratedEasy | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim().slice(0, 80) : "";
  const steps = Array.isArray(record.steps)
    ? record.steps
        .filter((step): step is string => typeof step === "string" && step.trim().length > 0)
        .map((step) => step.trim().slice(0, 180))
        .slice(0, 3)
    : [];
  if (!title || steps.length === 0) return undefined;
  if (!validatePracticeText(`${title} ${steps.join(" ")}`).ok) return undefined;
  return { title, steps };
}

function asInstructions(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const steps = value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, 4);
  return steps.length >= 2 ? steps : fallback;
}

/**
 * Validates and sanitizes any raw response from the server-side Edge Function
 * against our safety rules and the deterministic Seed Plan baseline.
 */
export function normalizeTree(
  raw: unknown,
  answers: OnboardingAnswers,
): GeneratedTree {
  const fallback = buildSeedPlan(answers);
  if (!raw || typeof raw !== "object") return { ...fallback, pillars: fallback.pillars.map((pillar) => ({ ...pillar, localRepair: true, hasAiContent: false })) };

  const root = raw as {
    primaryBranch?: unknown;
    summary?: unknown;
    safetyNote?: unknown;
    stages?: unknown;
    realityCheck?: unknown;
    pillars?: unknown;
  };
  const list = Array.isArray(root.pillars) ? root.pillars : null;
  if (!list) return { ...fallback, pillars: fallback.pillars.map((pillar) => ({ ...pillar, localRepair: true, hasAiContent: false })) };

  const result: GeneratedTree = {
    primaryBranch: typeof root.primaryBranch === "string" && PILLARS.some((p) => p.id === root.primaryBranch)
      ? root.primaryBranch as PillarId : undefined,
    stages: Array.isArray(root.stages) ? root.stages as GeneratedTree["stages"] : fallback.stages,
    realityCheck: root.realityCheck && typeof root.realityCheck === "object" ? root.realityCheck as GeneratedTree["realityCheck"] : undefined,
    summary: asString(root.summary, fallback.summary).slice(0, 220),
    safetyNote: asString(root.safetyNote, fallback.safetyNote).slice(0, 180),
    pillars: PILLARS.map((meta) => {
      const fallbackBranch = fallback.pillars.find(
        (p) => p.pillar === meta.id,
      )!;
      const entry = list.find((item) => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        const key = String(record.pillar ?? record.id ?? "").toLowerCase();
        return key === meta.id;
      }) as Record<string, unknown> | undefined;

      const rawNodes = Array.isArray(entry?.nodes) ? entry!.nodes : [];
      let localRepair = !entry;
      let hasAiContent = false;
      const nodes: GeneratedNode[] = [];
      for (let tier = 0; tier < (answers.daysRemaining ? 2 : 4); tier += 1) {
        const candidate = rawNodes[tier] as Record<string, unknown> | undefined;
        const base = fallbackBranch.nodes[tier];
        if (!candidate || typeof candidate !== "object") {
          localRepair = true;
          nodes.push(base);
          continue;
        }
        const safeCandidate = validatePracticeText(`${String(candidate.title ?? "")} ${String(candidate.description ?? "")} ${Array.isArray(candidate.instructions) ? candidate.instructions.join(" ") : ""}`).ok;
        if (![candidate.title, candidate.duration, candidate.description].every((value) => typeof value === "string" && value.trim()) ||
            !Array.isArray(candidate.instructions) || candidate.instructions.filter((value) => typeof value === "string" && value.trim()).length < 2 || !safeCandidate) {
          localRepair = true;
        }
        if (safeCandidate) hasAiContent = true;
        const rawCandidate: GeneratedNode = {
          title: asString(candidate.title, base.title),
          duration: asString(candidate.duration, base.duration),
          description: asString(candidate.description, base.description),
          instructions: asInstructions(
            candidate.instructions,
            base.instructions,
          ),
        };
        nodes.push({ ...sanitizeGeneratedNode(rawCandidate, base, tier, answers), easy: asEasy(candidate.easy) });
      }
      return {
        pillar: meta.id,
        focus: asString(entry?.focus, fallbackBranch.focus ?? meta.subtitle).slice(
          0,
          48,
        ),
        easy: asEasy(entry?.easy),
        localRepair,
        hasAiContent,
        nodes,
      };
    }),
  };
  return requiresPreparation(classifyGoal(answers.goal), !!answers.conservativeMode) ? preparationTree(result) : result;
}




/**
 * The function answers with a `code` as well as an error message. Reading it is
 * what lets the app say "drafting is not switched on" instead of guessing that
 * the network was down.
 */
async function functionFailure(
  error: unknown,
): Promise<{ code: string | null; detail: string | null }> {
  const context = (error as { context?: unknown } | null | undefined)?.context as
    | { json?: () => Promise<unknown>; clone?: () => unknown }
    | undefined;
  if (!context || typeof context.json !== "function") return { code: null, detail: null };
  try {
    const source = typeof context.clone === "function" ? context.clone() : context;
    const body = (await (source as { json: () => Promise<unknown> }).json()) as
      | { code?: unknown; detail?: unknown }
      | null;
    return {
      code: typeof body?.code === "string" ? body.code : null,
      detail: typeof body?.detail === "string" && body.detail.trim() ? body.detail.slice(0, 160) : null,
    };
  } catch {
    return { code: null, detail: null };
  }
}

export type QuestionResult =
  | { questions: PersonalizationQuestion[]; source: "ai" }
  | { questions: PersonalizationQuestion[]; source: "general"; reason: "off" | "consent" | "limit" | "unavailable" | "invalid" | "outdated" };

/** Recognize older functions that return a plan instead of the requested questions. */
export function questionResponse(data: unknown): QuestionResult {
  const questions = validateQuestions(data);
  if (questions) return { questions, source: "ai" };
  const isTree = !!data && typeof data === "object" && Array.isArray((data as { pillars?: unknown }).pillars);
  return { questions: GENERAL_QUESTIONS, source: "general", reason: isTree ? "outdated" : "invalid" };
}

export async function generateQuestions(answers: OnboardingAnswers, allowAi: boolean): Promise<QuestionResult> {
  if (!allowAi) return { questions: GENERAL_QUESTIONS, source: "general", reason: "off" };
  const { getSupabase } = await import("./supabase");
  const sb = getSupabase();
  if (sb && assessGoalSafety(answers.goal).safe) {
    try {
      const { data, error } = await sb.functions.invoke("generate-tree", {
        body: { mode: "questions", goal: scrubGoalForPrivacy(answers.goal), identity: answers.identity, blocker: answers.blocker, timeBudget: answers.timeBudget, conservativeMode: answers.conservativeMode, targetDate: answers.targetDate, legEnd: answers.legEnd, daysRemaining: answers.daysRemaining },
      });
      if (!error) return questionResponse(data);
      const failure = await functionFailure(error);
      const reason = fallbackReason(error, true, failure.code);
      return { questions: GENERAL_QUESTIONS, source: "general", reason: reason === "consent" || reason === "limit" ? reason : "unavailable" };
    } catch {
      // General questions remain available when the service cannot be reached.
    }
  }
  return { questions: GENERAL_QUESTIONS, source: "general", reason: "unavailable" };
}

export async function suggestWeeklyDetail(answers: OnboardingAnswers, seasonId: string, practices: Practice[], week: number, version: number, note: string, difficulty: number, allowAi: boolean): Promise<WeeklyDraft | null> {
  if (!allowAi || !assessGoalSafety(answers.goal).safe) return null;
  const { getSupabase } = await import("./supabase");
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.functions.invoke("generate-tree", { body: { mode: "weekly", seasonId, effectiveWeek: week, expectedVersion: version, note: scrubGoalForPrivacy(note), difficulty } });
    if (error || !safeForCategory(JSON.stringify(data), classifyGoal(answers.goal)) || !validateWeeklyDraft(data, practices.map(p => ({ id: p.id, minutes: p.full_variant.minutes })), Number(answers.timeBudget))) return null;
    return data;
  } catch { return null; }
}

export async function suggestReviewPractice(answers: OnboardingAnswers, practice: Practice, note: string, practiced: number, allowAi: boolean): Promise<PracticeDraft | null> {
  const { getSupabase } = await import("./supabase");
  const sb = getSupabase();
  if (!sb || !allowAi || !assessGoalSafety(answers.goal).safe) return null;
  try {
    const { data, error } = await sb.functions.invoke("generate-tree", { body: {
      mode: "review", conservativeMode: answers.conservativeMode, goal: scrubGoalForPrivacy(answers.goal), identity: answers.identity, blocker: answers.blocker, timeBudget: answers.timeBudget,
      context: (answers.context ?? []).map(({ question, answer }) => ({ question: scrubGoalForPrivacy(question), answer: scrubGoalForPrivacy(answer) })),
      review: { current: scrubGoalForPrivacy(`${practice.title}: ${practice.full_variant.steps.join(" ")}`), note: scrubGoalForPrivacy(note), practiced },
    } });
    const s = data?.suggestion;
    if (s && !safeForCategory(JSON.stringify(s), classifyGoal(answers.goal))) return null;
    if (error || !s || typeof s.title !== "string" || !s.title.trim() || s.title.length > 70 || typeof s.why !== "string" || !s.why.trim() || s.why.length > 200 || typeof s.easyTitle !== "string" || !s.easyTitle.trim() || s.easyTitle.length > 70 || !Array.isArray(s.steps) || !Array.isArray(s.easySteps) || s.steps.length < 1 || s.steps.length > 5 || s.easySteps.length < 1 || s.easySteps.length > 3 || [...s.steps, ...s.easySteps].some((v) => typeof v !== "string" || !v.trim() || v.length > 180)) return null;
    const budget = Number(answers.timeBudget);
    if (!validatePracticeText(`${s.title} ${s.why} ${s.easyTitle} ${s.steps.join(" ")} ${s.easySteps.join(" ")}`).ok || !validateStepsWithinBudget(s.steps, budget).ok || !validateStepsWithinBudget(s.easySteps, 2).ok) return null;
    return { branch: practice.branch, role: practice.role, cadence: practice.cadence, cadence_n: practice.cadence_n, title: s.title, why: s.why, full_variant: { title: s.title, minutes: budget, steps: s.steps }, easy_variant: { title: s.easyTitle, minutes: 2, steps: s.easySteps } };
  } catch { return null; }
}

/**
 * Generates a personalized Starting Seed Plan.
 *
 * Security: Never uses a client-side Gemini API key. Instead, it invokes the
 * Supabase `generate-tree` Edge Function (where GEMINI_API_KEY lives in
 * server secrets) and returns the local starter when the Edge Function fails.
 * Callers must identify that starter and let the person choose whether to use it.
 */
export async function generateTree(
  answers: OnboardingAnswers,
  options: { allowAi?: boolean; history?: PlanHistory | null } = {},
): Promise<TreeResult> {
  const safety = assessGoalSafety(answers.goal);
  if (!safety.safe) {
    throw new Error(
      safety.reason ??
        "Please choose a safe, constructive goal before generating your tree.",
    );
  }

  const { getSupabase } = await import("./supabase");
  const sb = getSupabase();
  let reason: FallbackReason = "off";
  let detail: string | undefined;
  if (sb && options.allowAi !== false) {
    reason = "unavailable";
    try {
      const { data, error } = await sb.functions.invoke("generate-tree", {
        body: {
          identity: answers.identity,
          goal: scrubGoalForPrivacy(answers.goal.trim()),
          blocker: answers.blocker,
          timeBudget: answers.timeBudget,
          history: options.history ?? null,
          context: (answers.context ?? []).map(({ question, answer }) => ({ question: scrubGoalForPrivacy(question), answer: scrubGoalForPrivacy(answer) })),
          conservativeMode: answers.conservativeMode, targetDate: answers.targetDate, legEnd: answers.legEnd, daysRemaining: answers.daysRemaining,
        },
      });

      if (!error && data && typeof data === "object" && Array.isArray(data.pillars) && data.pillars.length > 0) {
        return {
          tree: requiresPreparation(classifyGoal(answers.goal), !!answers.conservativeMode) ? preparationTree(normalizeTree(data, answers)) : normalizeTree(data, answers),
          source: "edge-ai",
        };
      }
      const failure = await functionFailure(error);
      reason = fallbackReason(error, true, failure.code);
      detail = failure.detail ?? undefined;
    } catch (caught) {
      // Edge function not deployed or unreachable — fall through to Starting Seed Engine.
      const failure = await functionFailure(caught);
      reason = fallbackReason(caught, true, failure.code);
      detail = failure.detail ?? undefined;
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 450));
  return { tree: buildSeedPlan(answers), source: "seed-engine", reason, detail };
}
