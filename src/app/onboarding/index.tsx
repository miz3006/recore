import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getPredictionForOpen } from '@/lib/db/predictions';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import {
  markOnboardingDone,
  setGoal,
  setLogSource,
  setSmallestPlateKg,
  type Goal,
  type LogSource,
} from '@/lib/prefs';
import { scheduleSync } from '@/lib/sync/index';
import {
  alpha,
  color,
  CONTROL_HEIGHT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Onboarding (CLAUDE.md §10) — five steps that end inside the note. Each step
 * has ONE psychological job on the way to a paying user:
 *
 *   0  WHY — convince them logging matters at all (progress = beating last
 *      time; memory fails; tracking is the best-proven training habit).
 *   1  GOAL — Duolingo's goal-first: a micro-commitment that tailors the
 *      pitch and makes the product feel built for them.
 *   2  HOW THEY LOG TODAY — segmentation: each answer gets the differentiator
 *      that beats THEIR current alternative (memory / paper / Hevy-Strong),
 *      and the Hevy/Strong path imports history right here — the endowment
 *      move that makes predictions real on day one.
 *   3  PLATE — one practical answer that visibly changes the product
 *      (roundToPlate), proving the questions weren't theater.
 *   4  THE GHOST — show the moat. With an import it's REAL (their next
 *      session from their own history); otherwise a clearly-labeled example.
 *      One quiet line plants Recore Pro. No prices, no timers, no tricks —
 *      the paywall itself arrives with billing, after the ghost has been
 *      right a few times.
 *
 * Every question is skippable (Continue works with nothing selected); the
 * aha stays < 60 s away. Tone: quiet, serious, monochrome — no confetti.
 */
const STEP_COUNT = 5;

type GoalOption = { value: Goal; label: string; response: string };
const GOAL_OPTIONS: GoalOption[] = [
  {
    value: 'strength',
    label: 'Strength',
    response: 'Strength grows when you beat last time. Recore always shows you last time.',
  },
  {
    value: 'muscle',
    label: 'Muscle',
    response: 'Growth needs volume that climbs. Recore counts it while you write.',
  },
  {
    value: 'both',
    label: 'Both — lifting and engine',
    response: 'Lifts and engine work, one page. Recore reads both.',
  },
];

type SourceOption = { value: LogSource; label: string; response: string };
const SOURCE_OPTIONS: SourceOption[] = [
  {
    value: 'none',
    label: "I don't — I remember",
    response: 'Memory drops the details progress is made of. One written sentence per session keeps them.',
  },
  {
    value: 'paper',
    label: 'Paper or a notes app',
    response: 'Keep writing exactly as you do. This page counts, compares, and predicts.',
  },
  {
    value: 'app',
    label: 'Hevy or Strong',
    response: 'Bring your history — comparisons and predictions start smart on day one.',
  },
];

const PLATE_OPTIONS = [0.5, 1.25, 2.5] as const;

const SAMPLE_GHOST = ['pull day', 'weighted pull-ups 3×6 +20', 'barbell row 3×8 92.5', 'face pulls 3×15'];
const SAMPLE_REASON = 'Last time you had two in reserve at 90 — so +2.5.';

export default function Onboarding() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);

  const [step, setStep] = useState(0);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [source, setSourceState] = useState<LogSource | null>(null);
  const [plate, setPlateState] = useState<number | null>(null);
  const [importState, setImportState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const next = () => {
    tapMedium();
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  };

  const finish = () => {
    tapMedium();
    markOnboardingDone();
    if (userId) hydrate(userId); // streak + the (possibly real) ghost land on home
    router.replace('/');
  };

  const pickGoal = (value: Goal) => {
    tap();
    setGoalState(value);
    setGoal(value);
  };

  const pickSource = (value: LogSource) => {
    tap();
    setSourceState(value);
    setLogSource(value);
  };

  const pickPlate = (value: number) => {
    tap();
    setPlateState(value);
    setSmallestPlateKg(value);
  };

  const runImport = async () => {
    if (!userId || importState === 'busy') return;
    tap();
    setImportState('busy');
    setImportMessage(null);
    const outcome = await pickAndImportCsv(userId);
    if (outcome.status === 'cancelled') {
      setImportState('idle');
      return;
    }
    if (outcome.status === 'invalid') {
      setImportState('idle');
      setImportMessage('That file is not a Hevy or Strong CSV export.');
      return;
    }
    if (outcome.status === 'failed') {
      setImportState('idle');
      setImportMessage('Import failed — export a fresh CSV and try again.');
      return;
    }
    // The endowment moment: their history is here, their ghost becomes real.
    recachePredictionFromLatest(userId);
    scheduleSync();
    setImportState('done');
    setImportMessage(
      outcome.importedDays > 0
        ? `Imported ${outcome.importedDays} workouts · ${outcome.sets} sets`
        : 'Those days are already logged here.',
    );
  };

  // The step-4 ghost: real when history exists (import or prior use).
  const prediction = useMemo(() => {
    if (step !== STEP_COUNT - 1 || !userId) return null;
    return getPredictionForOpen(userId, shiftDayKey(todayKey(), 1));
  }, [step, userId]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.dots}>
        {Array.from({ length: STEP_COUNT }, (_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <FadeSlideIn key="s0">
            <Text style={styles.statement} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Progress is doing a little more than last time.
            </Text>
            <Text style={styles.counter} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              But nobody remembers last time.
            </Text>
            <TwoPaths />
            <Text style={styles.evidence} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Tracking progress is the most proven habit in training. Recore makes it one
              written sentence.
            </Text>
          </FadeSlideIn>
        ) : step === 1 ? (
          <FadeSlideIn key="s1">
            <Text style={styles.question} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              What are you training for?
            </Text>
            <View style={styles.options}>
              {GOAL_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  label={o.label}
                  selected={goal === o.value}
                  onPress={() => pickGoal(o.value)}
                />
              ))}
            </View>
            {goal ? (
              <Response key={goal} text={GOAL_OPTIONS.find((o) => o.value === goal)!.response} />
            ) : null}
          </FadeSlideIn>
        ) : step === 2 ? (
          <FadeSlideIn key="s2">
            <Text style={styles.question} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              How do you log today?
            </Text>
            <View style={styles.options}>
              {SOURCE_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  label={o.label}
                  selected={source === o.value}
                  onPress={() => pickSource(o.value)}
                />
              ))}
            </View>
            {source ? (
              <Response
                key={source}
                text={SOURCE_OPTIONS.find((o) => o.value === source)!.response}
              />
            ) : null}
            {source === 'app' ? (
              <FadeSlideIn key="import">
                <Pressable
                  disabled={importState !== 'idle'}
                  onPress={() => void runImport()}
                  style={({ pressed }) => [
                    styles.importButton,
                    pressed && styles.importPressed,
                    importState === 'done' && styles.importDone,
                  ]}>
                  <Text style={styles.importLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {importState === 'busy'
                      ? 'Importing…'
                      : importState === 'done'
                        ? 'History imported'
                        : 'Import your CSV now'}
                  </Text>
                </Pressable>
                {importMessage ? (
                  <Text
                    style={[styles.importMessage, importState === 'done' && styles.importMessageDone]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {importMessage}
                  </Text>
                ) : null}
              </FadeSlideIn>
            ) : null}
          </FadeSlideIn>
        ) : step === 3 ? (
          <FadeSlideIn key="s3">
            <Text style={styles.question} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Smallest plate in your gym?
            </Text>
            <View style={styles.plates}>
              {PLATE_OPTIONS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => pickPlate(p)}
                  style={({ pressed }) => [
                    styles.plate,
                    pressed && styles.platePressed,
                    plate === p && styles.plateSelected,
                  ]}>
                  <Text
                    style={[styles.plateLabel, plate === p && styles.plateLabelSelected]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {p} kg
                  </Text>
                </Pressable>
              ))}
            </View>
            {plate != null ? (
              <Response
                key={plate}
                text="Suggestions will only ever land on loads you can actually rack."
              />
            ) : null}
          </FadeSlideIn>
        ) : (
          <FadeSlideIn key="s4">
            <Text style={styles.question} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              On a training day, your session is already written.
            </Text>

            <View style={styles.ghostCard}>
              <Text style={styles.ghostLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {prediction ? 'YOUR NEXT SESSION' : 'EXAMPLE'}
              </Text>
              {(prediction ? prediction.ghost_text.split('\n') : SAMPLE_GHOST).map((line, i) => (
                <Text key={i} style={styles.ghostLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {line}
                </Text>
              ))}
              {(prediction ? prediction.reason : SAMPLE_REASON) ? (
                <View style={styles.reason}>
                  <Text style={styles.reasonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {prediction ? prediction.reason : SAMPLE_REASON}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.proSeed} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              The predictor is part of Recore Pro.
            </Text>
          </FadeSlideIn>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={step === STEP_COUNT - 1 ? finish : next}
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}>
          <Text style={styles.primaryLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {step === STEP_COUNT - 1 ? 'Start logging' : 'Continue'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Quiet mount transition — fade + 8px rise; instant under reduceMotion. */
function FadeSlideIn({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const shift = useSharedValue(reduceMotion ? 0 : 8);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    shift.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: shift.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

function OptionCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        pressed && styles.optionPressed,
        selected && styles.optionSelected,
      ]}>
      <Text style={styles.optionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The answer's payoff line — every question visibly means something. */
function Response({ text }: { text: string }) {
  return (
    <FadeSlideIn>
      <Text style={styles.response} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </FadeSlideIn>
  );
}

/**
 * Two 12-week paths: training by guessing (flat, faded) vs training against a
 * log (climbing, white). The app's own bar-chart language — no colors, no
 * cartoon.
 */
const PATH_BARS = 8;
const PATH_HEIGHT = moderateScale(72);

function TwoPaths() {
  return (
    <View style={styles.paths}>
      <View style={styles.path}>
        <View style={styles.pathBars}>
          {Array.from({ length: PATH_BARS }, (_, i) => (
            <View key={i} style={[styles.bar, styles.barFlat]} />
          ))}
        </View>
        <Text style={styles.pathCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          guessing
        </Text>
      </View>
      <View style={styles.path}>
        <View style={styles.pathBars}>
          {Array.from({ length: PATH_BARS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: PATH_HEIGHT * (0.25 + (0.75 * (i + 1)) / PATH_BARS),
                  backgroundColor:
                    i === PATH_BARS - 1 ? color.accent : alpha(color.accent, 0.55),
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.pathCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          knowing
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xxl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: radius.pill,
    backgroundColor: alpha(color.accent, 0.2),
  },
  dotActive: {
    backgroundColor: color.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },

  // step 0 — why
  statement: {
    ...type.title,
    color: color.textPrimary,
  },
  counter: {
    ...type.title,
    color: color.textMuted,
    marginTop: spacing.sm,
  },
  paths: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.huge,
  },
  path: {
    flex: 1,
  },
  pathBars: {
    height: PATH_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  barFlat: {
    height: PATH_HEIGHT * 0.3,
    backgroundColor: alpha(color.accent, 0.16),
  },
  pathCaption: {
    ...type.caption,
    color: color.textMuted,
    marginTop: spacing.sm,
  },
  evidence: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.huge,
  },

  // questions
  question: {
    ...type.title,
    color: color.textPrimary,
    marginBottom: spacing.xxl,
  },
  options: {
    gap: spacing.md,
  },
  option: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  optionPressed: {
    backgroundColor: color.surfaceHigh,
  },
  optionSelected: {
    borderColor: alpha(color.accent, 0.7),
  },
  optionLabel: {
    fontSize: type.body.fontSize,
    color: color.textPrimary,
  },
  response: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.xl,
  },

  // step 2 import
  importButton: {
    marginTop: spacing.xl,
    height: CONTROL_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPressed: {
    backgroundColor: color.surfaceHigh,
  },
  importDone: {
    borderColor: 'transparent',
    backgroundColor: color.surface,
  },
  importLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  importMessage: {
    ...type.caption,
    color: color.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  importMessageDone: {
    color: color.textPrimary,
  },

  // step 3 plates
  plates: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  plate: {
    flex: 1,
    height: CONTROL_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  platePressed: {
    backgroundColor: color.surfaceHigh,
  },
  plateSelected: {
    borderColor: alpha(color.accent, 0.7),
  },
  plateLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  plateLabelSelected: {
    color: color.textPrimary,
  },

  // step 4 ghost
  ghostCard: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
  },
  ghostLabel: {
    ...type.caption,
    letterSpacing: 1.2,
    color: color.textMuted,
    marginBottom: spacing.md,
  },
  ghostLine: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    color: color.textSecondary,
  },
  reason: {
    marginTop: spacing.lg,
    paddingLeft: spacing.md,
    borderLeftWidth: 1.5,
    borderLeftColor: alpha(color.accent, 0.7),
  },
  reasonText: {
    ...type.caption,
    color: color.textSecondary,
  },
  proSeed: {
    ...type.caption,
    color: color.textMuted,
    marginTop: spacing.xl,
    textAlign: 'center',
  },

  footer: {
    paddingBottom: spacing.xxl,
  },
  primary: {
    height: CONTROL_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryPressed: {
    opacity: 0.85,
  },
  primaryLabel: {
    fontSize: type.headline.fontSize,
    fontWeight: '600',
    color: color.bg,
  },
});
