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
import { generateTree, type FallbackReason, type TreeResult } from "../lib/gemini";
import { dailyPlanFromTree } from "../lib/daily-adapter";
import {
  BLOCKERS,
  IDENTITIES,
  PILLAR_MAP,
  TIME_OPTIONS,
  goalsForIdentity,
} from "../lib/pillars";
import { assessGoalSafety } from "../lib/safety";
import { planHistory } from "../lib/engine/history";
import type { BlockerId, IdentityId, OnboardingAnswers } from "../lib/types";
import { alpha, colors, fonts, hairline } from "../theme";
import { BotanicalBranch } from "./BotanicalBranch";
import { ConsentSheet } from "./ConsentSheet";
import { BrandMark } from "./BrandMark";
import { Field, PrimaryButton, Rule } from "./Controls";
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
    label: "The 30-day goal",
    question: "What changes in 30 days?",
    helper:
      "Pick a starting goal or write your own, then name what usually gets in the way so your plan counters it.",
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

const FALLBACK_COPY: Record<FallbackReason, string> = {
  off: "AI suggestions are off, so this plan comes from the app's own library rather than the model.",
  limit: "Today's AI drafts are used up, so this plan comes from the app's own library.",
  rejected: "The AI draft did not pass the safety and shape checks, so this plan comes from the app's own library.",
  unavailable: "The AI could not be reached, so this plan comes from the app's own library.",
};

export function Onboarding() {
  const { user, submitOnboarding, authBusy, signOut, error, aiAllowed, recordConsent, snapshot } = useGame();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingAnswers>>({
    blocker: "consistency",
  });
  const [preview, setPreview] = useState<TreeResult | null>(null);
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
  const suggestedGoals = goalsForIdentity(answers.identity ?? "creator");
  const customGoal = suggestedGoals.includes(goal) ? "" : (answers.goal ?? "");
  const safety = assessGoalSafety(goal);
  const previewPlan =
    preview && answers.identity && answers.goal && answers.timeBudget
      ? dailyPlanFromTree(
          { identity: answers.identity, goal: answers.goal, blocker: answers.blocker ?? "consistency", timeBudget: answers.timeBudget },
          preview.tree,
          preview.source,
        )
      : null;

  const canContinue =
    step === 0
      ? Boolean(answers.identity)
      : step === 1
        ? goal.length >= 3 && safety.safe && Boolean(answers.blocker)
        : step === 2
          ? Boolean(answers.timeBudget)
          : Boolean(preview);

  function chooseIdentity(identity: IdentityId) {
    setPreview(null);
    setAnswers((value) => {
      const suggested = goalsForIdentity(value.identity ?? identity);
      return {
        ...value,
        identity,
        goal: value.goal && suggested.includes(value.goal) ? "" : value.goal,
      };
    });
  }

  function fullAnswers(overrideBudget?: string): OnboardingAnswers {
    return {
      identity: answers.identity ?? "creator",
      goal: goal.slice(0, 120),
      blocker: (answers.blocker as BlockerId) ?? "consistency",
      timeBudget: overrideBudget ?? answers.timeBudget ?? "15",
    };
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
      await buildPreview(allowAi ?? aiAllowed);
      return;
    }
    if (step === 3 && preview) {
      setPlanting(true);
      try {
        await submitOnboarding(fullAnswers(), preview);
      } finally {
        setPlanting(false);
      }
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
      setStep(3);
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
            {current.key} <Text style={{ color: colors.sageDeep }}>/ 04</Text>
          </Micro>
          <Text style={styles.stepLabel}>{current.label}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]}
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
              <View style={styles.goalChips}>
                {suggestedGoals.map((option) => (
                  <GoalChip
                    key={option}
                    label={option}
                    selected={goal === option}
                    onSelect={() => {
                      setPreview(null);
                      setAnswers((value) => ({
                        ...value,
                        goal: value.goal === option ? "" : option,
                      }));
                    }}
                  />
                ))}
              </View>

              <View style={styles.goalField}>
                <Field
                  label="Or write your own"
                  value={customGoal}
                  onChangeText={(text) => {
                    setPreview(null);
                    setAnswers((value) => ({ ...value, goal: text }));
                  }}
                  placeholder="e.g. Speak up in class without overthinking"
                  autoCapitalize="sentences"
                  maxLength={120}
                  returnKeyType="done"
                />
                <Micro style={styles.goalHint}>
                  One change · 30 days · your words
                </Micro>
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

          {step === 3 && preview && previewPlan ? (
            <View style={styles.previewWrap}>
              <View style={styles.previewSummaryCard}>
                <View style={styles.previewBadgeRow}>
                  <Micro style={{ color: colors.copperLight }}>
                    {preview.source === "edge-ai" ? "Drafted with AI" : "Built on this device"}
                  </Micro>
                  <Micro style={{ color: colors.lichen }}>4 practices</Micro>
                </View>
                <Text style={styles.previewSummaryText}>{previewPlan.plan_summary}</Text>{preview.source === "seed-engine" ? <Micro style={{ marginTop: 8, textTransform: "none", letterSpacing: 0.3, color: colors.sage }}>{FALLBACK_COPY[preview.reason ?? "unavailable"]}</Micro> : null}
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

              <Label style={{ marginTop: 18, marginBottom: 8 }}>
                Your first week
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
                    <Display style={styles.seedTitle}>{practice.title}</Display>{practice.role === "primary" && practice.full_variant.steps[0] ? <Text style={styles.seedDesc}>First action: {practice.full_variant.steps[0]}</Text> : null}{practice.full_variant.ladder && practice.full_variant.ladder.length > 0 ? <Text style={styles.seedDesc}>By week 4: {practice.full_variant.ladder[practice.full_variant.ladder.length - 1].title}</Text> : null}
                    <Text style={styles.seedDesc}>{practice.why}</Text>
                    <Text style={styles.seedDesc}>
                      Easier version: {practice.easy_variant.minutes} min — {practice.easy_variant.title.toLowerCase()}
                    </Text>
                  </View>
                );
              })}

              {preview.source === "seed-engine" && aiAllowed ? (<Pressable onPress={() => void buildPreview(true)} disabled={generating} accessibilityRole="button" accessibilityLabel="Ask the AI to draft the plan again" style={styles.gentlerBtn}><Text style={styles.gentlerBtnText}>Ask the AI to draft this again</Text></Pressable>) : null}{answers.timeBudget !== "5" ? (
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
                ? "Build my seed plan"
                : step === 3
                  ? "Grow my tree"
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
