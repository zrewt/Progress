import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Dumbbell,
  Hammer,
  Hourglass,
  ShieldCheck,
  Sparkles,
  Timer,
  type LucideIcon,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGame } from "../lib/game-context";
import { generateQuestions, generateTree, type FallbackReason, type QuestionResult, type TreeResult } from "../lib/gemini";
import { dailyPlanFromTree } from "../lib/daily-adapter";
import {
  BLOCKERS,
  IDENTITIES,
  PILLAR_MAP,
  TIME_OPTIONS,
} from "../lib/pillars";
import { classifyGoal } from "../lib/safety-rules";
import { assessGoalSafety } from "../lib/safety";
import { planHistory } from "../lib/engine/history";
import { planningLeg } from "../lib/engine/schedule";
import { addDays, localDate } from "../lib/progression";
import type { BlockerId, IdentityId, OnboardingAnswers, PersonalizationQuestion } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { BotanicalBranch } from "./BotanicalBranch";
import { ConsentSheet } from "./ConsentSheet";
import { BrandMark } from "./BrandMark";
import { Field, PrimaryButton, QuietButton, Rule } from "./Controls";
import { PillarIcon } from "./PillarIcon";
import { Body, Breathe, Display, DisplayItalic, Label, Micro } from "./Type";

const STEPS = [
  {
    key: "01",
    label: "The identity",
    question: "Who are you becoming?",
    helper:
      "Choose the self you are growing into. It shapes your first tree — it does not limit the rest of your life.",
  },
  {
    key: "02",
    label: "Your goal and date",
    question: "Tell it what you want and by when",
    helper: "Describe your goal in your own words and choose a target date.",
  },
  {
    key: "03",
    label: "The time",
    question: "How much time each day?",
    helper:
      "A promise you can keep beats a plan you admire. Choose honestly — we will show you the first week next.",
  },
  {
    key: "04",
    label: "Your situation",
    question: "Make it yours.",
    helper: "Choose an answer, write your own, or skip. Avoid sensitive health details.",
  },
  {
    key: "05",
    label: "The seed plan",
    question: "Your first plan.",
    helper:
      "One daily practice and three lighter ones, each with a version you could do on your hardest day. Review it before you begin.",
  },
] as const;

const GENERATING_MESSAGES = [
  "Checking the plan is safe and gentle",
  "Shaping four branches around your goal",
  "Writing an easier version for hard days",
  "Preparing your first week",
];

const IDENTITY_ICONS: Record<IdentityId, LucideIcon> = {
  creator: Sparkles,
  athlete: Dumbbell,
  scholar: BookOpen,
  builder: Hammer,
};

const TIME_ICONS: Record<string, LucideIcon> = {
  timer: Timer,
  clock: Clock3,
  hourglass: Hourglass,
};

function ChoiceRow({
  Icon,
  label,
  sub,
  selected,
  onSelect,
}: {
  Icon: LucideIcon;
  label: string;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && !selected && { backgroundColor: alpha(colors.bone, 0.02) },
      ]}
    >
      {selected ? <View style={styles.choiceBar} /> : null}
      <View
        style={[
          styles.choiceIcon,
          {
            borderColor: selected
              ? alpha(colors.copper, 0.6)
              : alpha(colors.bone, 0.15),
          },
        ]}
      >
        <Icon
          size={17}
          strokeWidth={1.4}
          color={selected ? colors.copperLight : colors.sage}
        />
      </View>
      <View style={styles.choiceCopy}>
        <Text
          style={[
            styles.choiceLabel,
            { color: selected ? colors.bone : colors.boneDim },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.choiceSub}>{sub}</Text>
      </View>
      <View
        style={[
          styles.radio,
          selected
            ? { borderColor: colors.copper, backgroundColor: colors.copper }
            : { borderColor: alpha(colors.bone, 0.25) },
        ]}
      >
        {selected ? (
          <Check size={11} strokeWidth={3} color={colors.ink950} />
        ) : null}
      </View>
    </Pressable>
  );
}

function GoalChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.goalChip,
        selected && styles.goalChipSelected,
        pressed && !selected && { backgroundColor: alpha(colors.bone, 0.04) },
      ]}
    >
      {selected ? (
        <Check size={12} strokeWidth={2.4} color={colors.copperLight} />
      ) : null}
      <Text
        style={[
          styles.goalChipText,
          { color: selected ? colors.bone : colors.sage },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BlockerChip({
  label,
  subtitle,
  selected,
  onSelect,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.blockerCard,
        selected && styles.blockerCardSelected,
        pressed && !selected && { backgroundColor: alpha(colors.bone, 0.03) },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.blockerLabel,
            { color: selected ? colors.bone : colors.boneDim },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.blockerSub}>{subtitle}</Text>
      </View>
      <View
        style={[
          styles.radio,
          selected
            ? { borderColor: colors.copper, backgroundColor: colors.copper }
            : { borderColor: alpha(colors.bone, 0.25) },
        ]}
      >
        {selected ? (
          <Check size={11} strokeWidth={3} color={colors.ink950} />
        ) : null}
      </View>
    </Pressable>
  );
}

function ScanLine() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={styles.scanTrack}>
      <Animated.View
        style={[
          styles.scanBar,
          {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-48, 144],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function GeneratingOverlay({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <View style={styles.generating}>
      <Breathe scaleTo={1.06} duration={5200}>
        <BrandMark size={96} color={colors.lichen} />
      </Breathe>

      <View style={styles.generatingCopy}>
        <Label style={{ color: colors.copperLight }}>One moment</Label>
        <Display style={styles.generatingTitle}>{title}</Display>
        <Body style={styles.generatingMessage}>{message}</Body>
      </View>

      <ScanLine />
    </View>
  );
}

// Each reason names a different problem, because each one needs a different fix.
// "The AI could not be reached" used to cover all of them, which made a switch
// that was never turned on look like a network outage.
const FALLBACK_COPY: Record<FallbackReason, string> = {
  off: "AI suggestions are off, so the app's starter library wrote this from your goal words.",
  consent: "Your account has no AI permission recorded yet, so the starter library wrote this.",
  limit: "Today's AI drafts are used up, so the starter library wrote this.",
  rejected: "The AI draft failed the safety or shape checks, so the starter library wrote this.",
  setup: "AI drafting is not switched on for this app yet, so the starter library wrote this.",
  unavailable: "The AI could not be reached, so the starter library wrote this.",
};

export function Onboarding() {
  const { user, submitOnboarding, authBusy, signOut, error, aiAllowed, recordConsent, snapshot } = useGame();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({
    blocker: "consistency",
  });
  const [preview, setPreview] = useState<TreeResult | null>(null);
  const [questions, setQuestions] = useState<PersonalizationQuestion[]>([]);
  const [questionResult, setQuestionResult] = useState<QuestionResult | null>(null);
  const [responses, setResponses] = useState<string[]>([]);
  const [screening, setScreening] = useState<"yes" | "no" | null>(null);
  const [screeningAccepted, setScreeningAccepted] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [acceptFirstLeg, setAcceptFirstLeg] = useState(false);
  // Asked once, before the first question, so the plan appears the moment the
  // last answer is given instead of interrupting the payoff with a decision.
  const [consentOpen, setConsentOpen] = useState(!aiAllowed);
  const [consentBusy, setConsentBusy] = useState(false);
  const [allowAi, setAllowAi] = useState<boolean | null>(null);
  const [generating, setGenerating] = useState(false);
  const [planting, setPlanting] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (!generating && !planting) return;
    const timer = setInterval(
      () => setMessageIndex((index) => (index + 1) % GENERATING_MESSAGES.length),
      1500,
    );
    return () => clearInterval(timer);
  }, [generating, planting]);

  const current = STEPS[step];
  const goal = (answers.goal ?? "").trim();
  const timezone = snapshot?.profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const currentDate = localDate(new Date(), timezone);
  const leg = planningLeg(currentDate, targetDate, acceptFirstLeg);
  const safety = assessGoalSafety(goal);
  const category = classifyGoal(goal);
  const conservative = Boolean(snapshot?.profile?.conservative_mode) || screening === "yes" || category === "high-risk";
  const previewPlan =
    preview && answers.identity && answers.goal && answers.timeBudget
      ? dailyPlanFromTree(
          { identity: answers.identity, goal: answers.goal, blocker: answers.blocker ?? "consistency", timeBudget: answers.timeBudget, conservativeMode: conservative, context: questions.flatMap((q, i) => responses[i]?.trim() ? [{ question: q.question, answer: responses[i].trim() }] : []), ...(leg.kind === "valid" ? { targetDate: leg.target, legEnd: leg.end, daysRemaining: leg.length } : {}) },
          preview.tree,
          preview.source,
        )
      : null;

  const canContinue =
    step === 0
      ? Boolean(answers.identity)
      : step === 1
        ? goal.length >= 3 && safety.safe && Boolean(answers.blocker) && leg.kind === "valid"
        : step === 2
          ? Boolean(answers.timeBudget) && (category === "ordinary" || screening === "no" || (screening === "yes" && screeningAccepted))
          : step === 3 ? true : Boolean(preview);

  function chooseIdentity(identity: IdentityId) {
    setPreview(null);
    setAnswers((value) => ({ ...value, identity }));
  }

  function fullAnswers(overrideBudget?: string): OnboardingAnswers {
    return {
      conservativeMode: conservative,
      identity: answers.identity ?? "creator",
      goal: goal.slice(0, 120),
      blocker: (answers.blocker as BlockerId) ?? "consistency",
      timeBudget: overrideBudget ?? answers.timeBudget ?? "15",
      ...(leg.kind === "valid" ? { targetDate: leg.target, legEnd: leg.end, daysRemaining: leg.length } : {}),
      context: questions.flatMap((q, i) => responses[i]?.trim() ? [{ question: q.question, answer: responses[i].trim() }] : []),
    };
  }

  async function loadQuestions() {
    setGenerating(true);
    try {
      const result = await generateQuestions(fullAnswers(), allowAi ?? aiAllowed);
      setQuestions(result.questions);
      setQuestionResult(result);
      setResponses([]);
      setStep(3);
    } finally { setGenerating(false); }
  }

  async function handleContinue() {
    if (!canContinue) return;
    if (step < 2) {
      setStep((value) => value + 1);
      return;
    }
    if (step === 2) {
      // The choice was made up front, and an unanswered sheet can only be
      // dismissed into the on-device plan, so no AI call can precede a decision.
      await loadQuestions();
      return;
    }
    if (step === 3) { await buildPreview(allowAi ?? aiAllowed); return; }
    if (step === 4 && preview) {
      // A plan the model did not write is not silently accepted: the main action
      // becomes one more attempt, and using the starter plan is its own choice.
      if (previewPlan?.plan_source === "local" && (allowAi ?? aiAllowed)) {
        await buildPreview(true);
        return;
      }
      await handleUseStarter();
    }
  }

  async function handleUseStarter() {
    if (!preview || planting) return;
    setPlanting(true);
    try {
      await submitOnboarding(fullAnswers(), preview);
    } finally {
      setPlanting(false);
    }
  }

  async function buildPreview(useAi: boolean, overrideBudget?: string) {
    setGenerating(true);
    setMessageIndex(0);
    try {
      const built = await generateTree(fullAnswers(overrideBudget), {
        allowAi: useAi,
        history: planHistory(snapshot),
      });
      setPreview(built);
      setStep(4);
    } finally {
      setGenerating(false);
    }
  }

  async function handleMakeGentler() {
    const gentlerBudget = "5";
    setAnswers((value) => ({ ...value, timeBudget: gentlerBudget }));
    await buildPreview(allowAi ?? aiAllowed, gentlerBudget);
  }

  async function acceptConsent() {
    setConsentBusy(true);
    const saved = await recordConsent();
    setConsentBusy(false);
    setAllowAi(saved);
    setConsentOpen(false);
  }

  function declineConsent() {
    setAllowAi(false);
    setConsentOpen(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <BrandMark size={24} />
          <Display style={styles.brandName}>Vitality Tree</Display>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 36 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View pointerEvents="none" style={styles.branch}>
          <BotanicalBranch height={260} opacity={0.09} />
        </View>

        <View style={styles.stepRow}>
          <Micro>
            {current.key} <Text style={{ color: colors.sageDeep }}>/ 05</Text>
          </Micro>
          <Text style={styles.stepLabel}>{current.label}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${((step + 1) / 5) * 100}%` }]}
          />
        </View>

        <Display style={styles.question}>{current.question}</Display>
        <Body style={styles.helper}>{current.helper}</Body>

        <View style={styles.options}>
          {step === 0
            ? IDENTITIES.map((identity) => (
                <ChoiceRow
                  key={identity.id}
                  Icon={IDENTITY_ICONS[identity.id]}
                  label={identity.name}
                  sub={identity.subtitle}
                  selected={answers.identity === identity.id}
                  onSelect={() => chooseIdentity(identity.id)}
                />
              ))
            : null}

          {step === 1 ? (
            <View>
              <View style={styles.goalField}>
                <Field
                  label="Your goal"
                  value={answers.goal ?? ""}
                  onChangeText={(text) => {
                    setPreview(null);
                    setScreening(null); setScreeningAccepted(false);
                    setAnswers((value) => ({ ...value, goal: text }));
                  }}
                  placeholder="e.g. Speak up in class without overthinking"
                  autoCapitalize="sentences"
                  maxLength={120}
                  returnKeyType="done"
                />
                <Micro style={styles.goalHint}>Your goal, in your words.</Micro>
              </View>
              <View style={{ marginTop: 20, gap: 10 }}>
                <Label>Target date</Label>
                <View style={styles.goalChips}>
                  {[14, 28, 56, 112].map((days) => <GoalChip key={days} label={`${days} days`} selected={targetDate === addDays(currentDate, days)} onSelect={() => { setTargetDate(addDays(currentDate, days)); setAcceptFirstLeg(false); setPreview(null); }} />)}
                </View>
                <Field label="Or enter a date (YYYY-MM-DD)" value={targetDate} onChangeText={(value) => { setTargetDate(value); setAcceptFirstLeg(false); setPreview(null); }} placeholder="YYYY-MM-DD" maxLength={10} />
                {targetDate && leg.kind === "invalid" ? <Body>Enter a valid date in YYYY-MM-DD format.</Body> : null}
                {leg.kind === "too-soon" ? <Body>Choose at least two weeks. The earliest available date is {leg.earliest}.</Body> : null}
                {leg.kind === "first-leg" ? <><Body>That goal is further away. You can plan a first 112-day leg, with a checkpoint on {leg.checkpoint}.</Body><QuietButton label="Plan the first leg" onPress={() => setAcceptFirstLeg(true)} /></> : null}
                {leg.kind === "valid" && leg.target !== leg.end ? <Body>Your target is {leg.target}; this first leg ends {leg.end}.</Body> : null}
              </View>

              {goal.length >= 3 && !safety.safe ? (
                <View style={styles.safetyBlocked}>
                  <View style={styles.safetyHead}>
                    <AlertTriangle
                      size={15}
                      strokeWidth={1.8}
                      color={colors.clay}
                    />
                    <Text style={styles.safetyBlockedTitle}>
                      Goal needs a safer reframe
                    </Text>
                  </View>
                  <Text style={styles.safetyBlockedText}>{safety.reason}</Text>
                  {safety.suggestion ? (
                    <Pressable
                      onPress={() =>
                        setAnswers((value) => ({
                          ...value,
                          goal: safety.suggestion,
                        }))
                      }
                      accessibilityRole="button"
                      style={styles.safetySuggestionBtn}
                    >
                      <Text style={styles.safetySuggestionLabel}>
                        Use safe alternative: “{safety.suggestion}”
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {goal.length >= 3 && safety.safe ? (
                <View style={styles.safetyOk}>
                  <ShieldCheck
                    size={14}
                    strokeWidth={1.8}
                    color={colors.lichen}
                  />
                  <Text style={styles.safetyOkText}>{safety.coachingNote}</Text>
                </View>
              ) : null}

              <View style={styles.blockerSection}>
                <Label style={{ color: colors.boneDim }}>
                  What usually gets in the way?
                </Label>
                <View style={styles.blockerList}>
                  {BLOCKERS.map((blocker) => (
                    <BlockerChip
                      key={blocker.id}
                      label={blocker.label}
                      subtitle={blocker.subtitle}
                      selected={
                        (answers.blocker ?? "consistency") === blocker.id
                      }
                      onSelect={() => {
                        setPreview(null);
                        setAnswers((value) => ({
                          ...value,
                          blocker: blocker.id,
                        }));
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {step === 2 && category !== "ordinary" ? <View style={{ gap: 12 }}><Label>Before a physical goal</Label><Body>Has a doctor ever advised you to limit exercise?</Body><Body>If you are unsure, check with a doctor before starting.</Body><QuietButton label={screening === "no" ? "Selected: No" : "No"} onPress={() => { setScreening("no"); setScreeningAccepted(false); }} /><QuietButton label={screening === "yes" ? "Selected: Yes" : "Yes"} onPress={() => { setScreening("yes"); setScreeningAccepted(false); }} />{screening === "yes" ? <><Body>Speak with a doctor first. You can go back or continue with gentler, non-extreme preparation. We save only the conservative-mode flag, not your answer.</Body><QuietButton label={screeningAccepted ? "Conservative mode selected" : "Continue in conservative mode"} onPress={() => setScreeningAccepted(true)} /><QuietButton label="Go back" onPress={() => setStep(1)} /></> : null}{snapshot?.profile?.age_bracket === "13_17" ? <Body>For physical goals, involve a trusted adult. Your plan will use gentler progression and no extreme physical actions.</Body> : null}{category === "high-risk" ? <Body>This plan covers preparation only. Get qualified instruction; the app does not provide routes, techniques or equipment safety advice.</Body> : null}</View> : null}
          {step === 2
            ? TIME_OPTIONS.map((option) => (
                <ChoiceRow
                  key={option.value}
                  Icon={TIME_ICONS[option.icon]}
                  label={option.label}
                  sub={option.sub}
                  selected={answers.timeBudget === option.value}
                  onSelect={() => {
                    setPreview(null);
                    setAnswers((value) => ({
                      ...value,
                      timeBudget: option.value,
                    }));
                  }}
                />
              ))
            : null}

          {step === 3 ? (
            <View style={{ gap: 20 }}>
              <Body>{questionResult?.source === "ai" ? "Questions tailored to your goal" : questionResult?.reason === "off" ? "AI is off, so these are general questions." : questionResult?.reason === "outdated" ? "General questions: the server returned a plan instead of questions. The question feature may not be deployed yet." : questionResult?.reason === "consent" ? "General questions: AI permission could not be confirmed." : questionResult?.reason === "limit" ? "General questions: today's AI request limit was reached." : questionResult?.reason === "invalid" ? "General questions: the AI response could not be used safely." : "General questions: tailored questions could not be generated right now."}</Body>
              {questionResult?.source === "general" && questionResult.reason !== "off" ? <QuietButton label="Try tailored questions again" onPress={() => void loadQuestions()} disabled={generating || authBusy} /> : null}
              {questions.map((item, index) => (
                <View key={`${index}-${item.question}`} style={{ gap: 8 }}>
                  <Label>{item.question}</Label>
                  <View style={styles.goalChips}>
                    {item.options.map((option) => <GoalChip key={option} label={option} selected={responses[index] === option} onSelect={() => setResponses((old) => { const next = [...old]; next[index] = option; return next; })} />)}
                    <GoalChip label="Skip" selected={responses[index] === ""} onSelect={() => setResponses((old) => { const next = [...old]; next[index] = ""; return next; })} />
                  </View>
                  <Field label="Or write your own answer" accessibilityLabel={`Your answer: ${item.question}`} value={item.options.includes(responses[index]) ? "" : responses[index] ?? ""} onChangeText={(text) => setResponses((old) => { const next = [...old]; next[index] = text; return next; })} maxLength={160} placeholder="Optional" />
                </View>
              ))}
            </View>
          ) : null}
          {step === 4 && preview && previewPlan ? (
            <View style={styles.previewWrap}>
              <View style={styles.previewSummaryCard}>
                <View style={styles.previewBadgeRow}>
                  <Micro style={{ color: colors.copperLight }}>
                    {previewPlan.plan_source === "ai" ? "Drafted with AI" : previewPlan.plan_source === "mixed" ? "AI and starter practices" : "Starter plan"}
                  </Micro>
                  <Micro style={{ color: colors.lichen }}>4 practices</Micro>
                </View>
                <Text style={styles.previewSummaryText}>{previewPlan.plan_summary}</Text>
                {previewPlan.plan_source === "local" && (allowAi ?? aiAllowed) ? (
                  <View style={styles.starterCard}>
                    <Text style={styles.starterTitle}>This is not an AI plan</Text>
                    <Text style={styles.starterBody}>
                      {preview.source === "seed-engine" ? FALLBACK_COPY[preview.reason ?? "unavailable"] : "The AI draft could not be used safely, so this starter plan was built on this device."}
                    </Text>
                    {preview.detail ? (
                      <Text style={styles.starterDetail}>{preview.detail}</Text>
                    ) : null}
                    <Pressable
                      onPress={() => void handleUseStarter()}
                      disabled={planting || generating}
                      accessibilityRole="button"
                      accessibilityLabel="Use this starter plan"
                      style={styles.gentlerBtn}
                    >
                      <Text style={styles.gentlerBtnText}>
                        {planting ? "Planting" : "Use this starter plan instead"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
                <View style={styles.previewSafetyRow}>
                  <ShieldCheck
                    size={13}
                    strokeWidth={1.8}
                    color={colors.lichen}
                  />
                  <Text style={styles.previewSafetyText}>
                    {preview.tree.safetyNote}
                  </Text>
                </View>
              </View>

              {previewPlan.reality_check ? <View style={{ gap: 8 }}><Label>Reality check: {previewPlan.reality_check.level}</Label><Body>{previewPlan.reality_check.explanation}</Body><QuietButton label="Adjust goal or date" onPress={() => { setPreview(null); setStep(1); }} /></View> : null}
              {previewPlan.stages?.map((stage, index) => <Body key={index}>{stage.title} · {stage.start} to {stage.end} (end exclusive){"\n"}{stage.outcome}</Body>)}
              <Label style={{ marginTop: 18, marginBottom: 8 }}>
                Your first two weeks
              </Label>

              {previewPlan.practices.map((practice) => {
                const meta = PILLAR_MAP[practice.branch];
                return (
                  <View key={practice.branch} style={styles.seedCard}>
                    <View style={styles.seedHeader}>
                      <View style={styles.seedTitleRow}>
                        <PillarIcon pillar={practice.branch} size={14} color={meta.accent} />
                        <Text style={styles.seedBranchName}>
                          {meta.name} · {practice.role === "primary" ? "every day" : "once this week"}
                        </Text>
                      </View>
                      <Text style={styles.seedDuration}>{practice.full_variant.minutes} min</Text>
                    </View>
                    <Display style={styles.seedTitle}>{practice.title}</Display>{practice.role === "primary" && practice.full_variant.steps[0] ? <Text style={styles.seedDesc}>First action: {practice.full_variant.steps[0]}</Text> : null}{practice.full_variant.ladder && practice.full_variant.ladder.length > 0 ? <Text style={styles.seedDesc}>Next week: {practice.full_variant.ladder[practice.full_variant.ladder.length - 1].title}</Text> : null}
                    <Text style={styles.seedDesc}>{practice.why}</Text>
                    <Text style={styles.seedDesc}>
                      Easier version: {practice.easy_variant.minutes} min — {practice.easy_variant.title.toLowerCase()}
                    </Text>
                  </View>
                );
              })}

              {answers.timeBudget !== "5" ? (
                <Pressable
                  onPress={() => void handleMakeGentler()}
                  accessibilityRole="button"
                  style={styles.gentlerBtn}
                >
                  <Text style={styles.gentlerBtnText}>
                    Feels too heavy? Shrink all branches to a 5-minute daily cap
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {step > 0 ? (
            <Pressable
              onPress={() => setStep((value) => Math.max(0, value - 1))}
              disabled={authBusy || generating || planting}
              hitSlop={8}
              style={styles.back}
            >
              <ArrowLeft size={14} strokeWidth={1.8} color={colors.sage} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          ) : (
            <View />
          )}

          <PrimaryButton
            label={
              step === 2
                ? "Continue"
                : step === 3 ? "Build my plan" : step === 4
                  ? previewPlan?.plan_source === "local" && (allowAi ?? aiAllowed)
                    ? "Try the AI again"
                    : "Grow my tree"
                  : "Continue"
            }
            onPress={() => void handleContinue()}
            disabled={!canContinue || authBusy || generating || planting}
            loading={(authBusy && planting) || generating}
            icon={<ArrowRight size={16} strokeWidth={2} color={colors.ink950} />}
            style={step === 0 ? styles.continueFull : styles.continue}
          />
        </View>

        <Text style={styles.note}>
          Your answers are saved to your account and shape the plan. You can change
          the goal or the daily size at any time without losing what you have done.
        </Text>

        <Rule style={{ marginTop: 28 }} />
        <DisplayItalic style={styles.quote}>
          “Stop tracking the life you want. Start growing it.”
        </DisplayItalic>
        <Micro style={{ marginTop: 10 }}>
          {user?.name ? `For ${user.name}` : "Become your future self"}
        </Micro>
      </ScrollView>

      <ConsentSheet
        visible={consentOpen}
        busy={consentBusy}
        onAccept={() => void acceptConsent()}
        onDecline={declineConsent}
      />

      {generating || planting ? (
        <GeneratingOverlay
          title={
            planting
              ? "Planting your first\nseason."
              : "Shaping your\nfirst plan."
          }
          message={GENERATING_MESSAGES[messageIndex]}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 17.5, letterSpacing: -0.3 },
  signOut: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.sage },
  content: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 36 },
  branch: { position: "absolute", right: -110, top: 30 },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  stepLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.sage },
  progressTrack: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.bone, 0.1),
    marginTop: 12,
  },
  progressFill: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.copper,
  },
  question: { marginTop: 26, fontSize: 32, lineHeight: 36, letterSpacing: -0.7 },
  helper: { marginTop: 12, maxWidth: 340, lineHeight: 21 },
  options: { marginTop: 22 },
  choice: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: hairline,
    position: "relative",
  },
  choiceSelected: { backgroundColor: alpha(colors.bone, 0.035) },
  choiceBar: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 1,
    backgroundColor: colors.copper,
  },
  choiceIcon: {
    height: 40,
    width: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceCopy: { flex: 1, minWidth: 0 },
  choiceLabel: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  choiceSub: {
    marginTop: 3,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.sage,
  },
  radio: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  goalChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.bone, 0.22),
    borderRadius: 2,
  },
  goalChipSelected: {
    borderColor: alpha(colors.copper, 0.7),
    backgroundColor: alpha(colors.copper, 0.08),
  },
  goalChipText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    flexShrink: 1,
  },
  goalField: { marginTop: 24 },
  goalHint: {
    marginTop: 10,
    textTransform: "none",
    letterSpacing: 0.4,
    color: colors.sageDeep,
  },
  safetyBlocked: {
    marginTop: 16,
    borderLeftWidth: 2,
    borderLeftColor: colors.clay,
    backgroundColor: alpha(colors.clay, 0.08),
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
  },
  safetyHead: { flexDirection: "row", alignItems: "center", gap: 7 },
  safetyBlockedTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.bone,
  },
  safetyBlockedText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.boneDim,
  },
  safetySuggestionBtn: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.copper, 0.65),
    backgroundColor: alpha(colors.copper, 0.12),
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 2,
  },
  safetySuggestionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    color: colors.copperLight,
  },
  safetyOk: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: alpha(colors.lichen, 0.06),
    borderLeftWidth: 2,
    borderLeftColor: colors.lichen,
  },
  safetyOkText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.sage,
  },
  blockerSection: { marginTop: 24 },
  blockerList: { marginTop: 10, gap: 8 },
  blockerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    borderRadius: 2,
  },
  blockerCardSelected: {
    borderColor: alpha(colors.copper, 0.65),
    backgroundColor: alpha(colors.copper, 0.06),
  },
  blockerLabel: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  blockerSub: {
    marginTop: 2,
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.sage,
  },
  previewWrap: { gap: 10 },
  starterCard: {
    marginTop: 12,
    gap: 7,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.clay,
    backgroundColor: alpha(colors.clay, 0.07),
  },
  starterTitle: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.bone },
  starterBody: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 17, color: colors.boneDim },
  starterDetail: { fontFamily: fonts.mono, fontSize: 10.5, lineHeight: 15, color: colors.sage },
  previewSummaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.lichen, 0.35),
    backgroundColor: alpha(colors.ink850, 0.7),
    padding: 14,
    gap: 8,
  },
  previewBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewSummaryText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.bone,
  },
  previewSafetyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: hairline,
  },
  previewSafetyText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 16,
    color: colors.sage,
  },
  seedCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: hairline,
    backgroundColor: alpha(colors.bone, 0.02),
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  seedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seedTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  seedBranchName: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.sage,
  },
  seedDuration: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.copperLight,
  },
  seedTitle: { marginTop: 3, fontSize: 18, lineHeight: 22 },
  seedDesc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.sage,
  },
  gentlerBtn: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(colors.bone, 0.2),
    alignItems: "center",
  },
  gentlerBtnText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11.5,
    color: colors.copperLight,
  },
  error: {
    marginTop: 18,
    borderLeftWidth: 2,
    borderLeftColor: colors.clay,
    backgroundColor: alpha(colors.clay, 0.07),
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.bone,
  },
  actions: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
  },
  backLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.sage },
  continue: { minWidth: 172, flexGrow: 1, maxWidth: 240 },
  continueFull: { flex: 1 },
  note: {
    marginTop: 20,
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 18,
    color: colors.sage,
  },
  quote: { marginTop: 16, fontSize: 19, lineHeight: 27 },
  generating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  generatingCopy: { marginTop: 34, alignItems: "center" },
  generatingTitle: {
    marginTop: 12,
    fontSize: 32,
    lineHeight: 36,
    textAlign: "center",
  },
  generatingMessage: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 280,
  },
  scanTrack: {
    marginTop: 34,
    height: 1,
    width: 192,
    backgroundColor: alpha(colors.bone, 0.1),
    overflow: "hidden",
  },
  scanBar: { height: 1, width: 48, backgroundColor: colors.lichen },
});
