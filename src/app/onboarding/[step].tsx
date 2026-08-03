import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  Image as RNImage,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { FadeSlideIn, PressableScale } from '@/components/motion';
import {
  EXPERIENCE_IMAGES,
  QUESTION_STEP_COUNT,
  readyLines,
  resolveWeightUnit,
  STEPS,
  stepImageSource,
} from '@/components/onboarding/config';
import { DayPicker } from '@/components/onboarding/DayPicker';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { ProgressRail } from '@/components/onboarding/ProgressRail';
import { SuggestionChips } from '@/components/onboarding/SuggestionChips';
import { TextField } from '@/components/onboarding/TextField';
import { WeightInput } from '@/components/onboarding/WeightInput';
import { AppButton } from '@/components/primitives';
import { defaultLanguage } from '@/lib/locale';
import { markObStepReached, markOnboardingCompleted, setObStepCount } from '@/lib/funnel';
import {
  isExperience,
  isGoal,
  isSessionFeel,
  normalizeDayMask,
  parseBodyWeight,
  toggleDay,
} from '@/lib/onboarding';
import {
  markOnboardingDone,
  setBodyWeightKg,
  setExperience,
  setGoal,
  setName,
  setObLanguage,
  setObTracker,
  setPrimaryLift,
  setRestSeconds,
  setSessionFeel,
  setUsualDays,
  setWeightUnit,
} from '@/lib/prefs';
import { alpha, color, HIT, ink, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useOnboardingAnswers } from '@/state/onboarding';

/**
 * The illustrated onboarding renderer — ONE screen for every entry of
 * `components/onboarding/config.ts` (welcome, thirteen steps, Ready echo),
 * keyed by the `[step]` route param (1-based). Each step is a full-bleed 9:16
 * illustration; a gradient to paper carries the copy. The Mobbin pass (29 Jul:
 * Breathwrk / Alma / GO Club / Opal) set the layout language: bold question,
 * options lifted into the lower-middle band, a calm empty strip under them.
 *
 * Steps slide in natively from the right (`slide_from_right`) and the content
 * staggers up inside the new screen — reveal on arrival, not decoration.
 *
 * Answering writes to the persisted store and advances after a short beat so
 * the selected state is seen. The next step's image prefetches on mount —
 * never everything at once — and the gender step also warms both experience
 * variants, because which one that step shows depends on the answer given
 * here.
 *
 * This flow IS the funnel (the old fourteen-screen flow was deleted 30 Jul,
 * owner's yes): the dispatcher sends anyone not yet onboarded to
 * `/onboarding/<resume step>`, and the Ready step completes — every answer
 * with a validated home written through prefs, done + completed marked —
 * then leads to /paywall. Per §5.1 no OS permission is requested here; the
 * notifications answer is intent, asked for real when the first recap exists.
 */

const ADVANCE_DELAY_MS = 180;
const STAGGER_MS = 60;
const RISE_PX = 12;
const GRADIENT_HEIGHT_RATIO = 0.7;

/** Transparent → 85% at the middle stop → solid paper under the options. */
const GRADIENT_COLORS = [alpha(color.bg, 0), alpha(color.bg, 0.85), color.bg] as const;
const GRADIENT_LOCATIONS = [0, 0.35, 1] as const;

/** Bundled assets resolve to a URI for expo-image's prefetch (dev server URL
 * in development, the packaged asset in release). */
function prefetchImage(source: ImageSourcePropType) {
  const uri = RNImage.resolveAssetSource(source)?.uri;
  if (uri) void Image.prefetch(uri);
}

/**
 * The end of the flow. Every answer with a validated, consequence-bearing
 * home is written through it — goal reaches the engine's fallback range,
 * experience the level of explanation, tracker the §2.1 import fast path,
 * session feel the composer vocabulary, the day mask the weekly rhythm, the
 * rest choice the toolbar timer, the name and priority movement their
 * greeting and Lifts pin, and the typed weight (converted to metric exactly
 * once, here) the You screen's body context. Language and display unit come
 * from the device locale (§5: derivable answers are not worth a screen).
 * Only the notifications intent stays in the store, waiting for §12.1.
 */
function completeFlow() {
  const { answers } = useOnboardingAnswers.getState();

  const name = answers.name?.trim();
  if (name) setName(name);
  if (isGoal(answers.goal)) setGoal(answers.goal);
  if (isExperience(answers.experience)) setExperience(answers.experience);
  const tracker = answers.tracker;
  if (tracker === 'strong' || tracker === 'hevy' || tracker === 'notes' || tracker === 'none') {
    setObTracker(tracker);
  }
  if (isSessionFeel(answers.sessionFeel)) setSessionFeel(answers.sessionFeel);
  const days = normalizeDayMask(answers.trainingDays);
  if (days > 0) setUsualDays(days);
  const lift = answers.primaryLift?.trim();
  if (lift) setPrimaryLift(lift);
  const rest = Number.parseInt(answers.restSeconds ?? '', 10);
  if (Number.isInteger(rest) && rest > 0) setRestSeconds(rest);
  const unit = resolveWeightUnit(answers);
  setWeightUnit(unit);
  const kg = parseBodyWeight(answers.bodyweight ?? '', unit);
  if (kg != null) setBodyWeightKg(kg);
  setObLanguage(defaultLanguage());

  setObStepCount(STEPS.length);
  markOnboardingDone();
  markOnboardingCompleted(); // the denominator of every step's drop-off (E7)
}

export default function OnboardingStep() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // A malformed or out-of-range param renders the nearest real step — never a
  // crash, never a redirect loop.
  const raw = Number.parseInt(String(stepParam ?? ''), 10);
  const stepNumber = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), STEPS.length) : 1;
  const step = STEPS[stepNumber - 1]!;
  const isIntro = step.kind === 'intro';

  const answers = useOnboardingAnswers((s) => s.answers);
  const setAnswer = useOnboardingAnswers((s) => s.setAnswer);
  const setStep = useOnboardingAnswers((s) => s.setStep);

  // Record the position so a killed app resumes on this step, and the funnel's
  // high-water mark (1-based in this flow) so drop-off is measurable.
  useEffect(() => {
    setStep(stepNumber);
    markObStepReached(stepNumber);
  }, [stepNumber, setStep]);

  // Warm exactly what the next screen needs. STEPS is 0-based, stepNumber is
  // 1-based, so STEPS[stepNumber] is the step AFTER this one. The gender step
  // also warms both experience variants — its answer decides which one shows.
  useEffect(() => {
    const next = STEPS[stepNumber];
    if (next) prefetchImage(stepImageSource(next, useOnboardingAnswers.getState().answers));
    if (step.id === 'gender') {
      prefetchImage(EXPERIENCE_IMAGES.base);
      prefetchImage(EXPERIENCE_IMAGES.v2);
    }
  }, [stepNumber, step.id]);

  const source = useMemo(() => stepImageSource(step, answers), [step, answers]);
  const selected = step.storeAs ? answers[step.storeAs] : null;

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const goNext = () => {
    if (stepNumber < STEPS.length) {
      router.push(`/onboarding/${stepNumber + 1}`);
    } else {
      // The Ready echo is the last screen: complete, then the paywall gate.
      completeFlow();
      router.replace('/paywall');
    }
  };

  const goBack = () => {
    // After a cold-start resume there is no history behind this screen —
    // walking to the previous step keeps Back honest instead of dead.
    if (router.canGoBack()) router.back();
    else router.replace(`/onboarding/${stepNumber - 1}`);
  };

  const onSelect = (optionId: string) => {
    if (advanceTimer.current) return; // an answer is already on its way forward
    if (step.storeAs) setAnswer(step.storeAs, optionId);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      goNext();
    }, ADVANCE_DELAY_MS);
  };

  // The day picker's mask, the text fields and the weight field all live in
  // the same persisted answers as every radio choice.
  const dayMask = normalizeDayMask(answers.trainingDays);
  const textValue = step.storeAs ? (answers[step.storeAs] ?? '') : '';
  const weightText = answers.bodyweight ?? '';
  const weightUnit = resolveWeightUnit(answers);
  // Empty means skip (§5: body context is optional); non-empty must parse.
  const weightInvalid =
    weightText.trim().length > 0 && parseBodyWeight(weightText, weightUnit) == null;
  const echo = useMemo(
    () => (step.kind === 'ready' ? readyLines(answers) : []),
    [step.kind, answers],
  );

  // The delay ladder: title, then subtitle (when present), then the controls.
  const optionsDelay = (step.subtitle ? 2 : 1) * STAGGER_MS;

  return (
    <View style={styles.root}>
      {/* Forward always arrives from the right; the iOS back-swipe stays live. */}
      <Stack.Screen options={{ animation: 'slide_from_right', gestureEnabled: true }} />

      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={step.focus === 'top' ? 'top' : 'center'}
        cachePolicy="memory-disk"
        transition={200}
        accessibilityIgnoresInvertColors
      />

      <LinearGradient
        pointerEvents="none"
        colors={GRADIENT_COLORS}
        locations={GRADIENT_LOCATIONS}
        style={[styles.gradient, { height: screenHeight * GRADIENT_HEIGHT_RATIO }]}
      />

      {isIntro ? null : (
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <ProgressRail
            total={QUESTION_STEP_COUNT}
            completed={stepNumber - 1}
            style={styles.rail}
          />
          <PressableScale
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}>
            <Icon name="chevron-back" size={22} tint={color.textPrimary} />
          </PressableScale>
        </View>
      )}

      {/* The keyboard-avoider matters on the typed steps (name, movement,
          weight); it is inert everywhere else, so every step shares one tree. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}>
        <View style={styles.contentWrap} pointerEvents="box-none">
          <View
            style={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xxxl },
            ]}>
            <FadeSlideIn delay={0} distance={RISE_PX}>
              <Text
                style={isIntro ? styles.heroTitle : styles.title}
                accessibilityRole="header"
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {step.title}
              </Text>
            </FadeSlideIn>

            {step.subtitle ? (
              <FadeSlideIn delay={STAGGER_MS} distance={RISE_PX}>
                <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {step.subtitle}
                </Text>
              </FadeSlideIn>
            ) : null}

            {step.kind === 'question' && step.options ? (
              <View
                style={styles.options}
                accessibilityRole="radiogroup"
                accessibilityLabel={step.title}>
                {step.options.map((option, i) => (
                  <FadeSlideIn
                    key={option.id}
                    delay={optionsDelay + i * STAGGER_MS}
                    distance={RISE_PX}>
                    <OptionRow
                      label={option.label}
                      emoji={option.emoji}
                      selected={selected === option.id}
                      onPress={() => onSelect(option.id)}
                    />
                  </FadeSlideIn>
                ))}
              </View>
            ) : null}

            {step.kind === 'text' && step.storeAs ? (
              <View style={styles.options}>
                <FadeSlideIn delay={optionsDelay} distance={RISE_PX}>
                  <TextField
                    value={textValue ?? ''}
                    onChangeText={(text) => setAnswer(step.storeAs!, text)}
                    placeholder={step.placeholder ?? ''}
                    onSubmit={goNext}
                    accessibilityLabel={step.title}
                  />
                </FadeSlideIn>
                {step.suggestions ? (
                  <FadeSlideIn delay={optionsDelay + STAGGER_MS} distance={RISE_PX}>
                    {/* A chip answers-and-advances like a radio option. */}
                    <SuggestionChips
                      suggestions={step.suggestions}
                      current={textValue ?? ''}
                      onPick={onSelect}
                    />
                  </FadeSlideIn>
                ) : null}
                <FadeSlideIn
                  delay={optionsDelay + (step.suggestions ? 2 : 1) * STAGGER_MS}
                  distance={RISE_PX}>
                  <AppButton label="Continue" onPress={goNext} />
                </FadeSlideIn>
              </View>
            ) : null}

            {step.kind === 'days' ? (
              <View style={styles.options}>
                <FadeSlideIn delay={optionsDelay} distance={RISE_PX}>
                  <DayPicker
                    mask={dayMask}
                    onToggle={(day) => setAnswer('trainingDays', String(toggleDay(dayMask, day)))}
                  />
                </FadeSlideIn>
                <FadeSlideIn delay={optionsDelay + STAGGER_MS} distance={RISE_PX}>
                  <AppButton label="Continue" onPress={goNext} />
                </FadeSlideIn>
              </View>
            ) : null}

            {step.kind === 'weight' ? (
              <View style={styles.options}>
                <FadeSlideIn delay={optionsDelay} distance={RISE_PX}>
                  <WeightInput
                    value={weightText}
                    unit={weightUnit}
                    onChangeText={(text) => setAnswer('bodyweight', text)}
                    onChangeUnit={(u) => setAnswer('weightUnit', u)}
                    onSubmit={() => {
                      if (!weightInvalid) goNext();
                    }}
                  />
                </FadeSlideIn>
                <FadeSlideIn delay={optionsDelay + STAGGER_MS} distance={RISE_PX}>
                  <AppButton label="Continue" onPress={goNext} disabled={weightInvalid} />
                </FadeSlideIn>
              </View>
            ) : null}

            {step.kind === 'ready' ? (
              <View style={styles.options}>
                {echo.map((line, i) => (
                  <FadeSlideIn key={line} delay={optionsDelay + i * STAGGER_MS} distance={RISE_PX}>
                    <View style={styles.echoRow}>
                      <View style={styles.echoDot} />
                      <Text style={styles.echoText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {line}
                      </Text>
                    </View>
                  </FadeSlideIn>
                ))}
                <FadeSlideIn
                  delay={optionsDelay + echo.length * STAGGER_MS}
                  distance={RISE_PX}
                  style={styles.echoCta}>
                  <AppButton label="See plans" onPress={goNext} />
                </FadeSlideIn>
              </View>
            ) : null}

            {step.kind === 'intro' || step.kind === 'lesson' ? (
              <FadeSlideIn delay={optionsDelay} distance={RISE_PX} style={styles.options}>
                <AppButton label={isIntro ? 'Get started' : 'Continue'} onPress={goNext} />
              </FadeSlideIn>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  rail: {
    marginHorizontal: spacing.xxl,
  },
  back: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    marginLeft: spacing.md,
  },
  contentWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: spacing.xxl,
  },
  title: {
    ...type.question,
    color: color.textPrimary,
  },
  /** The welcome headline — the marketing register, one notch up. */
  heroTitle: {
    ...type.display,
    color: color.textPrimary,
  },
  subtitle: {
    ...type.body,
    color: alpha(color.textPrimary, ink.echo),
    marginTop: spacing.md,
  },
  options: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  echoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  echoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: color.textSecondary,
    marginTop: spacing.sm,
  },
  echoText: {
    ...type.subhead,
    color: alpha(color.textPrimary, ink.delta),
    flexShrink: 1,
  },
  echoCta: {
    marginTop: spacing.md,
  },
});
