import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { FadeSlideIn } from '@/components/motion';
import { BuildingChecklist } from '@/components/onboarding/BuildingChecklist';
import {
  buildingLines,
  FOUNDER_NOTE,
  PROGRESS_TOTAL,
  progressFilled,
  PROOF_LINES,
  resolveWeightUnit,
  STEPS,
  stepHeadline,
  summaryLines,
  TRIAL_TIMELINE,
} from '@/components/onboarding/config';
import { DayPicker } from '@/components/onboarding/DayPicker';
import { setFlowDirection } from '@/components/onboarding/direction';
import { FounderNote } from '@/components/onboarding/FounderNote';
import { contentDelay, OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { OptionRow } from '@/components/onboarding/OptionRow';
import { ParseDemo } from '@/components/onboarding/ParseDemo';
import { SuggestionChips } from '@/components/onboarding/SuggestionChips';
import { TextField } from '@/components/onboarding/TextField';
import { BLUE, ENTER_MS, INK_TRACK, RISE_PX } from '@/components/onboarding/tokens';
import { WeightInput } from '@/components/onboarding/WeightInput';
import { defaultLanguage } from '@/lib/locale';
import { markObStepReached, markOnboardingCompleted, setObStepCount } from '@/lib/funnel';
import { DUR, EASE } from '@/lib/motion';
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
  setRecapIntent,
  setRestSeconds,
  setSessionFeel,
  setUsualDays,
  setWeightUnit,
} from '@/lib/prefs';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useOnboardingAnswers } from '@/state/onboarding';

/**
 * The onboarding renderer — ONE screen for every entry of
 * `components/onboarding/config.ts`, keyed by the `[step]` route param
 * (1-based).
 *
 * **12 Aug 2026 — the mascot-led restyle (owner's spec).** The page itself is
 * no longer described here: `OnboardingScreen` owns the template and its fixed
 * zones (chrome row → illustration on bare paper → eyebrow, headline, subtext →
 * content → the blue CTA pinned to the bottom), and this file only decides what
 * goes in the content band and what the button does. That is why the flow's
 * geometry cannot drift screen to screen — there is one place it is written.
 *
 * What the restyle changed here:
 *
 * · Recore blue is the flow's one accent (selected answers, the progress fill,
 *   the CTA, an emphasised value). Selection used to sweep a row to solid ink.
 * · The illustration is drawn straight onto the paper — no card, no border.
 * · The NOTIFICATIONS step is a switch rather than two radio rows. Both option
 *   labels are still the step's own copy and the stored answer is still
 *   'yes'/'no'; the difference is that a switch can be turned back off, so the
 *   screen carries a Continue instead of auto-advancing on first touch.
 * · An optional FOUNDER NOTE sits after the product truths
 *   (`FOUNDER_NOTE_ENABLED`).
 *
 * Single-select answers write to the persisted store and advance after ~250 ms
 * — the option's blue check springs in first, so the choice is seen; the
 * commitment step holds longer to show its affirming line. Text, number and
 * multi-select screens advance with the CTA, and the optional inputs keep
 * empty-means-skip. The building screen advances itself (with `replace`, so
 * Back from the summary lands on a question, not a replay).
 *
 * This flow IS the funnel: the dispatcher sends anyone not yet onboarded to
 * `/onboarding/<resume step>`, and the trial-timeline step completes — every
 * answer with a validated home written through prefs, done + completed marked
 * — then hands back to the dispatcher (a fresh user meets the paywall there;
 * an entitled replay returns to Today). Per §5.1 no OS permission is requested
 * here; the notifications answer is intent, asked for real when the first
 * recap exists.
 */

/** Long enough for the blue check to land before the screen slides away. */
const ADVANCE_DELAY_MS = 250;
/**
 * The commitment step's affirming line gets a longer hold than a plain answer
 * — but a hold is a thing to READ, never a thing to wait out. 900 ms leaves the
 * line on screen well past its fade-in, and tapping the same answer again skips
 * the rest, so the slowest path is a choice rather than a wall.
 */
const AFFIRM_DELAY_MS = 900;

/**
 * The end of the flow. Every answer with a validated, consequence-bearing
 * home is written through it — goal reaches the engine's fallback range,
 * experience the level of explanation, tracker the §2.1 import fast path,
 * session feel the composer vocabulary, the day mask the weekly rhythm, the
 * rest choice the toolbar timer, the name and key lift their greeting and
 * Lifts pin, the typed weight (converted to metric exactly once, here) the
 * You screen's body context, and the notifications answer the §12.1 recap
 * intent. Gender and commitment stay in the answers store — they personalise
 * the flow's own copy and illustrations. Language and display unit come from
 * the device locale (§5: derivable answers are not worth a screen).
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
  // The §12.1 recap intent — read when the first recap exists (its card offers
  // the notification only to a yes) and by the You row's default. Intent only:
  // no permission prompt happens here (§5.1).
  const notif = answers.notifications;
  if (notif === 'yes' || notif === 'no') setRecapIntent(notif);
  setObLanguage(defaultLanguage());

  setObStepCount(STEPS.length);
  markOnboardingDone();
  markOnboardingCompleted(); // the denominator of every step's drop-off (E7)
}

/** The blue check of the summary card and the product-truth rows. */
function CheckMark({ size, stroke }: { size: number; stroke: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path
        d="M3 8.5L6.5 12 13 4.5"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** The connecting rail between two timeline nodes, DRAWN downward (scaleY
 * from the top) once its upper node has landed — the trial's path unfolding
 * in order rather than appearing pre-printed. Reduce Motion shows it whole. */
function TimelineConnector({ delay }: { delay: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!reduce) {
      p.value = withDelay(delay, withTiming(1, { duration: DUR.slow, easing: EASE.emphasized }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: p.value }] }));

  return <Animated.View style={[styles.tlLine, animatedStyle]} />;
}

/**
 * One trial-timeline node mark. All three are OUTLINED ink circles carrying a
 * monochrome glyph (design import, 13 Aug 2026) — the unlocked padlock of
 * today, the reminder bell, the billing card. The first node used to be a
 * filled blue disc; it made "today" look like a step already completed on a
 * screen that is describing three things that have not happened yet, and it
 * spent the flow's accent on the one screen that must read as plain fact.
 * No emoji anywhere in this flow.
 */
function TimelineNode({ glyph }: { glyph: 'start' | 'bell' | 'card' }) {
  return (
    <View style={styles.tlNode}>
      <Icon
        name={glyph === 'start' ? 'unlock' : glyph}
        size={moderateScale(16)}
        tint={color.textPrimary}
      />
    </View>
  );
}

export default function OnboardingStep() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();

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

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  /** The commitment step's affirming line, shown under the options once an
   * answer is in and until the flow advances. */
  const [affirmLine, setAffirmLine] = useState<string | null>(null);

  // When the affirm line appears it pushes the option rows up a touch; the
  // layout transition turns that jump into a glide. Reduce Motion keeps the
  // instant reflow.
  const reduce = useReducedMotion();
  const listLayout = reduce ? undefined : LinearTransition.duration(DUR.base);

  const goNext = useCallback(
    (mode: 'push' | 'replace' = 'push') => {
      setFlowDirection(1);
      if (stepNumber < STEPS.length) {
        const href = `/onboarding/${stepNumber + 1}` as const;
        if (mode === 'replace') router.replace(href);
        else router.push(href);
      } else {
        // The trial-timeline is the last config screen: complete, then hand
        // back to the dispatcher. A fresh user meets the paywall gate there;
        // an entitled subscriber replaying setup walks straight back into the
        // app instead of being asked to buy again.
        completeFlow();
        router.replace('/');
      }
    },
    [stepNumber, router],
  );

  /** Drop a pending advance and the line it was holding for. A cancelled
   * advance must leave nothing armed behind it, or the in-flight guard in
   * `onSelect` locks the screen for good. */
  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
    setAffirmLine(null);
  }, []);

  const goBack = () => {
    // Leaving cancels any advance still in flight. Without this the timer fires
    // 900 ms later from a screen the user already left and pushes them forward
    // again — and the armed ref would still be blocking taps if they returned.
    cancelAdvance();
    setFlowDirection(-1);
    // After a cold-start resume there is no history behind this screen —
    // walking to the previous step keeps Back honest instead of dead.
    if (router.canGoBack()) router.back();
    else router.replace(`/onboarding/${stepNumber - 1}`);
  };

  const onSelect = (optionId: string) => {
    if (advanceTimer.current) {
      // An answer is already on its way forward. Tapping the SAME one again
      // means "read it, go" — the affirm hold is readable, not compulsory.
      // A different option inside the window is ignored: the check has already
      // landed on that row and swapping the line mid-flight reads as a glitch.
      if (selected === optionId) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
        goNext();
      }
      return;
    }
    if (step.storeKey) setAnswer(step.storeKey, optionId);
    const affirm = step.affirm?.[optionId] ?? null;
    if (affirm) setAffirmLine(affirm);
    advanceTimer.current = setTimeout(
      () => {
        advanceTimer.current = null;
        goNext();
      },
      affirm ? AFFIRM_DELAY_MS : ADVANCE_DELAY_MS,
    );
  };

  // The building screen advances itself; `replace` keeps it off the stack so
  // Back from the summary lands on the question before it, not on a replay.
  const onBuilt = useCallback(() => {
    if (advanceTimer.current) return;
    goNext('replace');
  }, [goNext]);

  // The day picker's mask, the text fields and the weight field all live in
  // the same persisted answers as every radio choice.
  const selected = step.storeKey ? answers[step.storeKey] : null;
  const dayMask = normalizeDayMask(answers.trainingDays);
  const textValue = step.storeKey ? (answers[step.storeKey] ?? '') : '';
  const weightText = answers.bodyweight ?? '';
  const weightUnit = resolveWeightUnit(answers);
  // Empty means skip (§5: body context is optional); non-empty must parse.
  const weightInvalid =
    weightText.trim().length > 0 && parseBodyWeight(weightText, weightUnit) == null;

  const headline = stepHeadline(step, answers);
  const checklist = useMemo(
    () => (step.kind === 'building' ? buildingLines(answers) : []),
    [step.kind, answers],
  );
  const summary = useMemo(
    () => (step.kind === 'summary' ? summaryLines(answers) : []),
    [step.kind, answers],
  );

  /**
   * The notifications step is the one question drawn as a PAIR OF FULL-HEIGHT
   * CHOICES rather than a list (Claude Design canvas, 13 Aug 2026): a filled
   * blue row for yes, an outlined row for no. Its two labels are the step's own
   * config copy and the stored answer is still 'yes' / 'no'.
   *
   * It is also the one question in the flow whose answer a person may want to
   * change their mind about before moving on, so it does NOT auto-advance —
   * Continue writes whatever the screen is showing. Unanswered reads as yes,
   * and the filled row says which one that is before the button commits it.
   * Recap intent is not a permission — §5.1 keeps the OS prompt for the moment
   * the first recap actually exists — so a visible default is honest here in a
   * way it would not be for a system dialog.
   */
  const isNotifications = step.slug === 'notifications';
  const notificationsAnswer = answers.notifications ?? 'yes';

  // What sits in the content band, and how many staggered items it holds (the
  // CTA lands one beat after the last of them).
  let content: React.ReactNode = null;
  let contentCount = 1;
  let cta: { label: string; onPress: () => void; disabled?: boolean } | null = null;

  if (step.kind === 'question' && step.options) {
    if (isNotifications) {
      contentCount = step.options.length;
      content = (
        <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={headline}>
          {step.options.map((option, i) => (
            <FadeSlideIn
              key={option.id}
              delay={contentDelay(i)}
              distance={RISE_PX}
              duration={ENTER_MS}>
              <OptionRow
                label={option.label}
                selected={notificationsAnswer === option.id}
                onPress={() => setAnswer('notifications', option.id)}
                variant={option.id === 'yes' ? 'primary' : 'outline'}
              />
            </FadeSlideIn>
          ))}
        </View>
      );
      cta = {
        label: step.cta ?? 'Continue',
        onPress: () => {
          // Continue always writes what the screen is showing, so a person who
          // never touched a row still gets the answer they could read.
          setAnswer('notifications', notificationsAnswer);
          goNext();
        },
      };
    } else {
      contentCount = step.options.length;
      content = (
        <View
          style={styles.stack}
          accessibilityRole="radiogroup"
          accessibilityLabel={headline}>
          {step.options.map((option, i) => (
            <FadeSlideIn
              key={option.id}
              delay={contentDelay(i)}
              distance={RISE_PX}
              duration={ENTER_MS}
              layout={listLayout}>
              <OptionRow
                label={option.label}
                selected={selected === option.id}
                onPress={() => onSelect(option.id)}
              />
            </FadeSlideIn>
          ))}
          {affirmLine ? (
            <FadeSlideIn delay={0} distance={RISE_PX} duration={ENTER_MS}>
              <Text style={styles.affirm} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {affirmLine}
              </Text>
            </FadeSlideIn>
          ) : null}
        </View>
      );
    }
  } else if (step.kind === 'text' && step.storeKey) {
    contentCount = step.suggestions ? 2 : 1;
    content = (
      <View style={styles.stack}>
        <FadeSlideIn delay={contentDelay(0)} distance={RISE_PX} duration={ENTER_MS}>
          <TextField
            value={textValue ?? ''}
            onChangeText={(text) => setAnswer(step.storeKey!, text)}
            placeholder={step.placeholder ?? ''}
            onSubmit={() => goNext()}
            accessibilityLabel={headline}
          />
        </FadeSlideIn>
        {step.suggestions ? (
          <FadeSlideIn delay={contentDelay(1)} distance={RISE_PX} duration={ENTER_MS}>
            {/* A chip answers-and-advances like a radio option. */}
            <SuggestionChips
              suggestions={step.suggestions}
              current={textValue ?? ''}
              onPick={onSelect}
            />
          </FadeSlideIn>
        ) : null}
      </View>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.kind === 'days') {
    content = (
      <FadeSlideIn delay={contentDelay(0)} distance={RISE_PX} duration={ENTER_MS}>
        <DayPicker
          mask={dayMask}
          onToggle={(day) => setAnswer('trainingDays', String(toggleDay(dayMask, day)))}
        />
      </FadeSlideIn>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.kind === 'weight') {
    content = (
      <FadeSlideIn delay={contentDelay(0)} distance={RISE_PX} duration={ENTER_MS}>
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
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext(), disabled: weightInvalid };
  } else if (step.kind === 'building') {
    content = (
      <FadeSlideIn delay={contentDelay(0)} distance={RISE_PX} duration={ENTER_MS}>
        <BuildingChecklist lines={checklist} onDone={onBuilt} />
      </FadeSlideIn>
    );
  } else if (step.kind === 'summary') {
    // A plain list, not a card (design import, 13 Aug 2026). Every line is
    // already the person's own answer read back; boxing them made the screen
    // look like a receipt from the app rather than a page of their own.
    contentCount = summary.length;
    content = (
      <View style={styles.summaryList}>
        {summary.map((line, i) => (
          <FadeSlideIn key={line} delay={contentDelay(i)} distance={RISE_PX} duration={ENTER_MS}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryDisc}>
                <CheckMark size={moderateScale(11)} stroke="#FFFFFF" />
              </View>
              <Text style={styles.summaryText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {line}
              </Text>
            </View>
          </FadeSlideIn>
        ))}
      </View>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.kind === 'proof') {
    // Ruled lines, no marks (design import, 13 Aug 2026): these are statements
    // about the product, and a check beside each one reads as a feature list
    // ticking itself off. The rule is the ledger's own device.
    contentCount = PROOF_LINES.length;
    content = (
      <View>
        {PROOF_LINES.map((line, i) => (
          <FadeSlideIn key={line} delay={contentDelay(i)} distance={RISE_PX} duration={ENTER_MS}>
            <View style={[styles.proofRow, i < PROOF_LINES.length - 1 && styles.proofRuled]}>
              <Text style={styles.proofText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {line}
              </Text>
            </View>
          </FadeSlideIn>
        ))}
      </View>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.kind === 'timeline') {
    contentCount = TRIAL_TIMELINE.length;
    content = (
      <View>
        {TRIAL_TIMELINE.map((node, i) => (
          <FadeSlideIn
            key={node.title}
            delay={contentDelay(i)}
            distance={RISE_PX}
            duration={ENTER_MS}>
            <View style={styles.tlRow}>
              <View style={styles.tlRail}>
                <TimelineNode glyph={node.glyph} />
                {i < TRIAL_TIMELINE.length - 1 ? (
                  <TimelineConnector delay={contentDelay(i) + 160} />
                ) : null}
              </View>
              <View style={[styles.tlText, i < TRIAL_TIMELINE.length - 1 && styles.tlTextPad]}>
                <Text style={styles.tlTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {node.title}
                </Text>
                <Text style={styles.tlBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {node.body}
                </Text>
              </View>
            </View>
          </FadeSlideIn>
        ))}
      </View>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.kind === 'founder') {
    contentCount = FOUNDER_NOTE.length + 1;
    content = <FounderNote />;
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else if (step.slug === 'demo') {
    // The one explainer that DEMONSTRATES instead of describing: the typed line
    // and the record the parser makes of it, revealed once (§9 of the design's
    // motion sheet — "the core promise, animated once").
    contentCount = 2;
    content = (
      <FadeSlideIn delay={contentDelay(0)} distance={RISE_PX} duration={ENTER_MS}>
        <ParseDemo />
      </FadeSlideIn>
    );
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  } else {
    // 'intro' and the remaining explainers — the illustration and the copy are
    // the screen.
    contentCount = 0;
    cta = { label: step.cta ?? 'Continue', onPress: () => goNext() };
  }

  return (
    <>
      {/* Forward always arrives from the right; the iOS back-swipe stays live.
          The zones inside slide and crossfade on top of it a beat later, which
          is the other half of the design's 350 ms transition — see
          `OnboardingScreen`. The native animation is kept (rather than driven
          by hand) precisely because it is what carries the interactive
          edge-swipe, and a wizard you cannot swipe out of is a worse screen
          than one whose transition we authored ourselves. */}
      <Stack.Screen
        options={{ animation: 'slide_from_right', animationDuration: 350, gestureEnabled: true }}
      />
      <OnboardingScreen
        slug={step.slug}
        eyebrow={step.eyebrow}
        headline={headline}
        subtext={step.subtext}
        hero={isIntro}
        progress={
          isIntro ? null : { total: PROGRESS_TOTAL, completed: progressFilled(stepNumber) }
        }
        // The building screen has no way back on purpose: it is already writing
        // the record it narrates, and there is nothing to undo.
        onBack={isIntro || step.kind === 'building' ? null : goBack}
        cta={cta}
        contentCount={contentCount}>
        {content}
      </OnboardingScreen>
    </>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  affirm: {
    ...type.subhead,
    fontWeight: '500',
    lineHeight: lineFor(21),
    color: color.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // The answers read back as a plain list, each line marked with a small blue
  // disc — the flow's accent used once per line, at the size of a bullet.
  summaryList: {
    gap: spacing.md + 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  summaryDisc: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: radius.pill,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(1),
  },
  summaryText: {
    flex: 1,
    ...type.subhead,
    fontWeight: '500',
    lineHeight: lineFor(21),
    color: color.textPrimary,
  },
  proofRow: {
    paddingVertical: spacing.lg - 1,
  },
  proofRuled: {
    borderBottomWidth: 1,
    borderBottomColor: INK_TRACK,
  },
  proofText: {
    ...type.headline,
    fontWeight: '500',
    lineHeight: lineFor(24),
    color: color.textPrimary,
  },
  tlRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  tlRail: {
    alignItems: 'center',
  },
  tlNode: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: INK_TRACK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tlLine: {
    width: 1.5,
    flex: 1,
    marginVertical: spacing.xs,
    backgroundColor: INK_TRACK,
    transformOrigin: 'top',
  },
  tlText: {
    flex: 1,
    paddingTop: moderateScale(4),
  },
  tlTextPad: {
    paddingBottom: spacing.xl,
  },
  tlTitle: {
    ...type.headline,
    color: color.textPrimary,
  },
  tlBody: {
    marginTop: 2,
    ...type.subhead,
    lineHeight: lineFor(21),
    color: color.textSecondary,
  },
});
