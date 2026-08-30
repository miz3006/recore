import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import {
  commitmentCount,
  liftProjections,
  MAX_KEY_LIFTS,
  overloadExample,
  PROGRESS_TOTAL,
  progressFilled,
  relativeProjection,
  resolveWeightUnit,
  STEPS,
  stepBody,
  stepHeadline,
  stepSubtext,
  type Step,
} from '@/components/onboarding/config';
import { ChoiceChips } from '@/components/onboarding/ChoiceChips';
import { DayPicker } from '@/components/onboarding/DayPicker';
import { DemoToday } from '@/components/onboarding/DemoToday';
import { Enter } from '@/components/onboarding/Enter';
import { HoldHint, HoldToCommit } from '@/components/onboarding/HoldToCommit';
import { formatLoad, LiftLoadRow } from '@/components/onboarding/LiftLoadRow';
import { contentDelay, OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { OptionRow } from '@/components/onboarding/OptionRow';
import {
  Footnote,
  OverloadCard,
  Paragraph,
  RecapPreview,
  SectionLabel,
  StatCard,
} from '@/components/onboarding/panels';
import {
  ProjectionCard,
  ProjectionRow,
  RelativeProjectionCard,
} from '@/components/onboarding/ProjectionCard';
import { SuggestionChips } from '@/components/onboarding/SuggestionChips';
import { TextField } from '@/components/onboarding/TextField';
import { PUSH_MS } from '@/components/onboarding/tokens';
import { setUserProperty, track } from '@/lib/analytics';
import {
  inWrittenUnit,
  leadDemoEntry,
  matchKeyLift,
  parseDemoEntries,
  parseDemoEntry,
  serializeDemoEntries,
  serializeDemoEntry,
  type DemoEntry,
} from '@/lib/demo-parse';
import { markObStepReached, markOnboardingCompleted, setObStepCount } from '@/lib/funnel';
import { defaultLanguage } from '@/lib/locale';
import { requestRecapInOnboarding } from '@/lib/recap';
import { DUR } from '@/lib/motion';
import { weekReadback } from '@/lib/onboarding-copy';
import {
  COMMIT_WEEKS,
  dayCount,
  isExperience,
  isGoal,
  isSessionFeel,
  normalizeDayMask,
  parseBodyWeight,
  parseLiftLoads,
  parseList,
  serializeLiftLoads,
  serializeList,
  toggleDay,
  toggleInList,
} from '@/lib/onboarding';
import {
  markOnboardingDone,
  setBodyWeightKg,
  setExperience,
  setGoal,
  setName,
  setObLanguage,
  setObSource,
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
  MAX_FONT_SCALE,
  spacing,
  type,
} from '@/lib/theme';
import { useOnboardingAnswers, type AnswerKey } from '@/state/onboarding';

/**
 * The onboarding renderer — ONE screen for every entry of
 * `components/onboarding/config.ts`, keyed by the `[step]` route param
 * (1-based).
 *
 * `OnboardingScreen` owns the template and its fixed zones (chrome row →
 * illustration on bare paper → eyebrow, headline, subtext → content → the blue
 * CTA pinned to the bottom); this file only decides what goes in the content
 * band and what the button does. That is why the flow's geometry cannot drift
 * screen to screen — there is one place it is written.
 *
 * ## The v3 design import (18 August 2026)
 *
 * **Nothing auto-advances any more.** Every question carries Continue. The old
 * flow moved on ~250 ms after a tap, which reads well on a recording and badly
 * in a hand: a mis-tap on a five-row list was unrecoverable without Back, and
 * two of the new screens (about-you, days) ask two things at once, which an
 * auto-advance cannot express at all. The check landing on the row is the
 * feedback; the button is the commitment.
 *
 * **Required versus optional is explicit.** Three answers change deterministic
 * behaviour downstream — the tracker (§2.1 import fast path), the goal (the
 * engine's fallback range) and the experience (the projection's rate) — and
 * their Continue stays inert until one is chosen. Everything else may be
 * skipped, because §5 says a skipped question must change nothing essential,
 * and every screen below honours that with a real fallback rather than a nag.
 *
 * The flow ends on the PROJECTION, which completes (every answer with a
 * validated home written through prefs, done + completed marked) and hands back
 * to the dispatcher: a fresh user meets the paywall there; an entitled replay
 * returns to Today.
 *
 * ONE OS PROMPT NOW LIVES IN THE FLOW (owner, 23 Aug 2026): the recap screen's
 * Continue asks iOS for notification permission when the answer is yes. It is
 * the only one — the microphone is still asked on the mic tap, and nothing else
 * here asks for anything. See the recap branch and `lib/recap.ts` for why the
 * §5.1 rule it reverses is satisfied rather than ignored.
 */

/**
 * The end of the flow. Every answer with a validated, consequence-bearing home
 * is written through it — goal reaches the engine's fallback range, experience
 * the level of explanation, tracker the §2.1 import fast path, session feel the
 * composer vocabulary, the day mask the weekly rhythm, the name its greeting,
 * the first key lift the Lifts pin, and the recap answer the §12.1 intent.
 *
 * Rest length and bodyweight are no longer asked (the v3 flow dropped both
 * screens); their writers stay because their answer keys are still in the store
 * and putting either screen back must not need a second edit here.
 *
 * Gender and commitment stay in the answers store — they personalise the flow's
 * own copy and illustrations. Language and display unit come from the device
 * locale (§5: derivable answers are not worth a screen).
 */
function completeFlow() {
  const { answers } = useOnboardingAnswers.getState();

  const name = answers.name?.trim();
  if (name) setName(name);
  if (isGoal(answers.goal)) setGoal(answers.goal);
  if (isExperience(answers.experience)) setExperience(answers.experience);

  // 'sheet' is a v3 answer with no home in `ObTracker`, and it does not need
  // one: a spreadsheet, a notes app and a paper log are the same thing to the
  // import fast path — none of them hands Recore a file it can read. Mapping it
  // to 'notes' keeps the stored vocabulary honest instead of widening a type
  // that three other screens read.
  const tracker = answers.tracker === 'sheet' ? 'notes' : answers.tracker;
  if (tracker === 'strong' || tracker === 'hevy' || tracker === 'notes' || tracker === 'none') {
    setObTracker(tracker);
  }

  if (isSessionFeel(answers.sessionFeel)) setSessionFeel(answers.sessionFeel);
  const days = normalizeDayMask(answers.trainingDays);
  if (days > 0) setUsualDays(days);

  // The FIRST key lift is the pin, because it is the one the person reached for
  // first on a screen that let them choose three.
  const lift = parseList(answers.keyLifts)[0]?.trim();
  if (lift) setPrimaryLift(lift);

  const rest = Number.parseInt(answers.restSeconds ?? '', 10);
  if (Number.isInteger(rest) && rest > 0) setRestSeconds(rest);
  const unit = resolveWeightUnit(answers);
  setWeightUnit(unit);
  const kg = parseBodyWeight(answers.bodyweight ?? '', unit);
  if (kg != null) setBodyWeightKg(kg);

  const notif = answers.notifications;
  if (notif === 'yes' || notif === 'no') setRecapIntent(notif);

  // Where they found Recore — an option id or nothing at all. A skipped screen
  // writes NOTHING rather than "other": the funnel's denominator has to be able
  // to tell "did not say" from "somewhere else".
  const source = answers.attribution?.trim();
  if (source) setObSource(source);
  setObLanguage(defaultLanguage());

  setObStepCount(STEPS.length);
  markOnboardingDone();
  markOnboardingCompleted(); // the denominator of every step's drop-off (E7)
}

/**
 * The three answers whose absence changes what the app DOES, rather than what
 * it says. Their Continue waits. Everything else is skippable by §5.
 */
const REQUIRED: readonly string[] = ['tracker', 'goal', 'experience'];

/**
 * The obstacles screen's exclusive answer: "Nothing — I'm just starting" is not
 * a fourth complaint, it is the absence of complaints, so it clears the others
 * and any other choice clears it. Without this the screen accepts "nothing
 * stops me" alongside "I forget to log it", which is not an answer.
 */
const EXCLUSIVE_OBSTACLE = 'none';

export default function OnboardingStep() {
  const router = useRouter();
  const { step: stepParam } = useLocalSearchParams<{ step?: string }>();

  // A malformed or out-of-range param renders the nearest real step — never a
  // crash, never a redirect loop.
  const raw = Number.parseInt(String(stepParam ?? ''), 10);
  const stepNumber = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), STEPS.length) : 1;
  const step = STEPS[stepNumber - 1]!;
  const isIntro = step.kind === 'intro';

  /** True only while the iOS notification dialog is on the glass (recap step). */
  const [asking, setAsking] = useState(false);

  const answers = useOnboardingAnswers((s) => s.answers);
  const setAnswer = useOnboardingAnswers((s) => s.setAnswer);
  const setStep = useOnboardingAnswers((s) => s.setStep);

  /**
   * THE DEMO PAGE, STORED (23 Aug 2026 — the demo screen is Today now).
   *
   * Three writes, because the page is three things to the flow: the LEAD entry
   * every screen after it was already built out of (`demoEntry`), every line
   * that read (`demoEntries` — the key-lift screen pre-selects from it), and
   * the raw page verbatim (`demoText`), which is what becomes the first real
   * session after signup. The reading is not the record; the words are.
   *
   * Memoised because `DemoToday` hands the page up from an effect: an unstable
   * callback would make that effect run on every keystroke.
   */
  const onDemoPage = useCallback(
    ({ entries, text }: { entries: DemoEntry[]; text: string }) => {
      const lead = leadDemoEntry(entries);
      setAnswer('demoEntry', lead ? serializeDemoEntry(lead) : '');
      setAnswer('demoEntries', serializeDemoEntries(entries));
      setAnswer('demoText', text);
    },
    [setAnswer],
  );

  // Record the position so a killed app resumes on this step, the funnel's
  // high-water mark (1-based in this flow) so drop-off is measurable, and the
  // §13 screen view.
  //
  // THE VIEW IS EMITTED HERE AND NOWHERE ELSE. Every screen of the flow is this
  // one component, so the one place that knows which screen is on the glass is
  // also the only place that has to say so — no per-screen boilerplate to
  // forget on the next screen somebody adds.
  useEffect(() => {
    setStep(stepNumber);
    markObStepReached(stepNumber);
    track('onboarding_screen_view', { step_id: step.slug, step_index: stepNumber });
  }, [stepNumber, setStep, step.slug]);

  // Adding a lift row pushes the ones under it down; the layout transition
  // turns that jump into a glide. Reduce Motion keeps the instant reflow.
  const reduce = useReducedMotion();
  const listLayout = reduce ? undefined : LinearTransition.duration(DUR.base);

  /**
   * THE step-to-step transition, and the only one: a real push on the native
   * stack. Every step of this funnel is its own route, so moving forward is a
   * `router.push` and the platform animates it — off the main thread, in the
   * same 350 ms every other app on the phone uses, with the interactive back
   * swipe intact. Nothing in JavaScript slides a screen (`OnboardingScreen`'s
   * per-zone horizontal slide was deleted 19 Aug 2026); the JS entrance only
   * settles the CONTENTS of a page the platform has already delivered.
   *
   * `animationMatchesGesture` is the half that is easy to forget. Without it
   * the back-swipe runs iOS's default push in reverse instead of the animation
   * configured here, so dragging back looks like a different app than tapping
   * forward. It matters more here than almost anywhere, because Back is a real
   * part of this flow rather than an escape hatch.
   *
   * Reduce Motion swaps the slide for a fade: a full-screen horizontal
   * translation is exactly what the setting is asking to be spared, and the
   * cross-fade still says "a new page", which is the part that must survive.
   */
  const stackOptions = useMemo(
    () =>
      ({
        animation: reduce ? ('fade' as const) : ('slide_from_right' as const),
        animationDuration: reduce ? DUR.base : PUSH_MS,
        animationMatchesGesture: true,
        gestureEnabled: true,
      }),
    [reduce],
  );

  const goNext = useCallback(() => {
    track('onboarding_screen_complete', { step_id: step.slug, step_index: stepNumber });
    if (stepNumber < STEPS.length) {
      router.push(`/onboarding/${stepNumber + 1}`);
      return;
    }
    // The projection is the last config screen: complete, then hand back to the
    // dispatcher. A fresh user meets the paywall gate there; an entitled
    // subscriber replaying setup walks straight back into the app instead of
    // being asked to buy again.
    completeFlow();
    router.replace('/');
  }, [stepNumber, router, step.slug]);

  const goBack = () => {
    // After a cold-start resume there is no history behind this screen —
    // walking to the previous step keeps Back honest instead of dead.
    if (router.canGoBack()) router.back();
    else router.replace(`/onboarding/${stepNumber - 1}`);
  };

  const unit = resolveWeightUnit(answers);
  const dayMask = normalizeDayMask(answers.trainingDays);
  const selected = step.storeKey ? answers[step.storeKey] : null;
  const headline = stepHeadline(step, answers);
  const subtext = stepSubtext(step, answers);

  /**
   * The demo page's readings. `demoEntries` since 23 Aug 2026; the lone
   * `demoEntry` is the fallback so a flow resumed from a snapshot written by
   * the previous build still arrives with its line.
   */
  const demoEntries = useMemo(() => {
    const page = parseDemoEntries(answers.demoEntries);
    if (page.length > 0) return page;
    const lone = parseDemoEntry(answers.demoEntry);
    return lone ? [lone] : [];
  }, [answers.demoEntries, answers.demoEntry]);

  /**
   * THE DEMO PAGE ARRIVES ON THE KEY-LIFT SCREEN.
   *
   * Somebody who wrote `deadlift 140kg 5,5,5` four screens ago has already
   * answered "which lifts matter most" and "what do you work with now" — asking
   * again is the questionnaire the flow is trying to stop being. So the chips
   * are lit and the steppers are loaded when the screen opens, and every part
   * of it is still theirs to change.
   *
   * Up to three of them now (`MAX_KEY_LIFTS`), because the demo screen asks for
   * two or three exercises and the chips it can answer are the same six the
   * screen offers. A movement the chips do not carry ("incline db press") is
   * simply skipped here — it is still on the page and still in the record.
   *
   * ONCE, and only on an untouched screen: `keyLifts` is null until the person
   * has been here, and the seed writes it, so this cannot fight a choice — not
   * even the choice to clear the screen (which leaves an empty string, not null).
   */
  useEffect(() => {
    if (step.kind !== 'lifts' || answers.keyLifts != null || demoEntries.length === 0) return;
    const unitNow = resolveWeightUnit(answers);
    const max = step.maxChoices ?? MAX_KEY_LIFTS;
    const lifts: string[] = [];
    const loads: Record<string, number> = {};
    for (const entry of demoEntries) {
      const lift = matchKeyLift(entry.exerciseName, step.suggestions ?? []);
      if (!lift || lifts.includes(lift)) continue;
      lifts.push(lift);
      if (entry.weightKg != null && entry.weightKg > 0) {
        loads[lift] = inWrittenUnit(entry.weightKg, unitNow);
      }
      if (lifts.length >= max) break;
    }
    if (lifts.length === 0) return;
    setAnswer('keyLifts', serializeList(lifts));
    if (Object.keys(loads).length > 0) setAnswer('liftLoads', serializeLiftLoads(loads));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind, answers.keyLifts, demoEntries]);

  const chosenLifts = useMemo(() => parseList(answers.keyLifts), [answers.keyLifts]);
  const liftLoads = useMemo(() => parseLiftLoads(answers.liftLoads), [answers.liftLoads]);
  const projections = useMemo(
    () => (step.kind === 'projection' ? liftProjections(answers) : []),
    [step.kind, answers],
  );
  /** No load anywhere to project FROM — the honest relative variant (§5.1). */
  const relative = useMemo(
    () => (step.kind === 'projection' && projections.length === 0 ? relativeProjection(answers) : null),
    [step.kind, projections.length, answers],
  );

  /**
   * Store an answer AND count it (§13).
   *
   * `answerValue` is the guard that matters: an event queued today may be sent
   * tomorrow, so nothing a person WROTE goes into one — a name is recorded as
   * written-or-not and the demo line as parsed-or-not, never as its text
   * (§7.3, §12). Everything else here is an option id.
   */
  const answer = (key: AnswerKey, value: string, stepId: string) => {
    setAnswer(key, value);
    track('onboarding_answer', { step_id: stepId, value: answerValue(key, value) });
  };

  /** A single-select answer. The attribution screen also lands as its own
   * event and as a user property — it is the only answer that describes the
   * PERSON's arrival rather than a moment in the flow. */
  const chooseOption = (key: AnswerKey, id: string) => {
    answer(key, id, step.slug);
    if (step.slug === 'attribution') {
      track('onboarding_attribution', { value: id });
      setUserProperty('attribution', id);
    }
  };

  const setLiftLoad = (lift: string, value: number) => {
    setAnswer('liftLoads', serializeLiftLoads({ ...liftLoads, [lift]: value }));
  };

  const toggleObstacle = (id: string) => {
    const current = parseList(answers.obstacles);
    if (id === EXCLUSIVE_OBSTACLE) {
      answer('obstacles', current.includes(id) ? '' : id, 'obstacles');
      return;
    }
    const withoutExclusive = serializeList(current.filter((v) => v !== EXCLUSIVE_OBSTACLE));
    answer('obstacles', toggleInList(withoutExclusive, id), 'obstacles');
  };

  const toggleLift = (lift: string) => {
    const next = toggleInList(answers.keyLifts, lift);
    answer('keyLifts', next, 'key-lifts');
    // A lift dropped from the set takes its load with it: leaving an orphaned
    // number in the map would put a lift nobody chose on the projection screen.
    if (!parseList(next).includes(lift) && liftLoads[lift] != null) {
      const rest = { ...liftLoads };
      delete rest[lift];
      setAnswer('liftLoads', serializeLiftLoads(rest));
    }
  };

  /**
   * THE ONE STEP THAT IS NOT THE TEMPLATE (owner, 23 Aug 2026).
   *
   * The parse demo is the Today page now — the canvas, the wordmark row, the
   * blank page, records settling as lines are written (`DemoToday`). It returns
   * before `OnboardingScreen` is built because what it demonstrates IS a page,
   * and a page inside another page's content band is a screenshot. It keeps the
   * flow's back circle, its progress rail and its CTA, so nothing about being
   * inside a funnel is lost.
   */
  if (step.kind === 'demo') {
    return (
      <>
        <Stack.Screen options={stackOptions} />
        <DemoToday
          headline={headline}
          written={answers.demoText ?? undefined}
          progress={{ total: PROGRESS_TOTAL, completed: progressFilled(stepNumber) }}
          onBack={goBack}
          onSkip={goNext}
          onContinue={goNext}
          onPage={onDemoPage}
          cta={step.cta ?? 'Continue'}
        />
      </>
    );
  }

  /**
   * THE SECOND QUESTION ON A PAGE — the flow's own option rows, one per line,
   * on both screens that ask two things (about-you, days).
   *
   * One function rather than two copies of the same JSX. A segmented control
   * was tried here on 23 Aug and taken back out the same day (owner: the days
   * screen keeps its earlier design); `Segmented.tsx` stays on disk, unmounted.
   */
  const secondaryQuestion = (secondary: NonNullable<Step['secondary']>, from: number) => (
    <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={secondary.label}>
      {secondary.options.map((option, i) => (
        <Enter key={option.id} delay={contentDelay(from + i)}>
          <OptionRow
            label={option.label}
            emoji={option.emoji}
            selected={answers[secondary.storeKey] === option.id}
            onPress={() =>
              answer(secondary.storeKey, option.id, `${step.slug}.${secondary.storeKey}`)
            }
          />
        </Enter>
      ))}
    </View>
  );

  // What sits in the content band, how many staggered items it holds (the CTA
  // lands one beat after the last of them), and what the button does.
  let content: React.ReactNode = null;
  let contentCount = 1;
  let cta: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean } | null = {
    label: step.cta ?? 'Continue',
    onPress: goNext,
    disabled: REQUIRED.includes(step.slug) && !selected,
  };
  let ctaSlot: React.ReactNode = null;
  let footer: React.ReactNode = null;

  if (step.kind === 'intro') {
    contentCount = 0;
    footer = (
      <Pressable
        onPress={() => router.push('/sign-in')}
        accessibilityRole="link"
        accessibilityLabel="Already have an account? Sign in"
        style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.signIn} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Already have an account? <Text style={styles.signInLink}>Sign in</Text>
        </Text>
      </Pressable>
    );
  } else if (step.kind === 'choice' && step.options && step.layout === 'chips') {
    // A light question, drawn light: the whole grid arrives on one beat rather
    // than staggering six pills, because a wrapped row is one object.
    contentCount = 1;
    content = (
      <Enter delay={contentDelay(0)}>
        <ChoiceChips
          options={step.options}
          value={selected}
          accessibilityLabel={headline}
          onChange={(id) => step.storeKey && chooseOption(step.storeKey, id)}
        />
      </Enter>
    );
  } else if (step.kind === 'choice' && step.options) {
    contentCount = step.options.length;
    content = (
      <View style={styles.stack} accessibilityRole="radiogroup" accessibilityLabel={headline}>
        {step.options.map((option, i) => (
          <Enter key={option.id} delay={contentDelay(i)}>
            <OptionRow
              label={option.label}
              detail={option.detail}
              emoji={option.emoji}
              selected={selected === option.id}
              onPress={() => step.storeKey && chooseOption(step.storeKey, option.id)}
            />
          </Enter>
        ))}
      </View>
    );
  } else if (step.kind === 'multi' && step.options) {
    const chosen = parseList(answers.obstacles);
    contentCount = step.options.length;
    content = (
      <View style={styles.stack}>
        {step.options.map((option, i) => (
          <Enter key={option.id} delay={contentDelay(i)}>
            <OptionRow
              multi
              label={option.label}
              detail={option.detail}
              emoji={option.emoji}
              selected={chosen.includes(option.id)}
              onPress={() => toggleObstacle(option.id)}
            />
          </Enter>
        ))}
      </View>
    );
  } else if (step.kind === 'essay') {
    const body = stepBody(step, answers);
    contentCount = body.length;
    content = (
      <View style={styles.prose}>
        {body.map((paragraph, i) => (
          <Enter key={paragraph} delay={contentDelay(i)}>
            {/* The opening line leads; the argument under it is body copy. */}
            <Paragraph lede={i === 0}>{paragraph}</Paragraph>
          </Enter>
        ))}
      </View>
    );
  } else if (step.kind === 'about-you') {
    const secondary = step.secondary!;
    contentCount = 2 + secondary.options.length;
    content = (
      <View style={styles.stack}>
        <Enter delay={contentDelay(0)}>
          <View>
            <SectionLabel>{step.sectionLabel ?? ''}</SectionLabel>
            <TextField
              value={answers.name ?? ''}
              onChangeText={(text) => setAnswer('name', text)}
              placeholder={step.placeholder ?? ''}
              hint="Optional"
              // The "optional" fact lives in the LABEL, not only in the
              // decorative hint inside the field, so VoiceOver hears it too.
              accessibilityLabel="Your first name, optional"
            />
          </View>
        </Enter>
        <Enter delay={contentDelay(1)}>
          <View style={styles.section}>
            <SectionLabel>{secondary.label}</SectionLabel>
          </View>
        </Enter>
        {secondaryQuestion(secondary, 2)}
      </View>
    );
  } else if (step.kind === 'days') {
    const secondary = step.secondary!;
    // The card's own two lines, and the one place the empty week is answered
    // rather than nagged (`weekReadback`).
    const readback = weekReadback(dayCount(dayMask), answers[secondary.storeKey]);
    contentCount = 3 + secondary.options.length;
    content = (
      <View style={styles.stack}>
        <Enter delay={contentDelay(0)}>
          <DayPicker
            mask={dayMask}
            onToggle={(day) => {
              const next = toggleDay(dayMask, day);
              setAnswer('trainingDays', String(next));
              // The COUNT, never the days themselves: how many times a week is
              // the number the funnel reads, and which days is the person's.
              track('onboarding_answer', { step_id: 'days', value: dayCount(next) });
            }}
          />
        </Enter>
        <Enter delay={contentDelay(1)}>
          {/* The week read straight back. Nothing here counts a miss (§11) —
              it is the shape of a week, not a target, and `weekReadback` has
              its own words for a person who trains on no fixed days. */}
          <View>
            <Text style={styles.derived} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {readback.title}
            </Text>
            <Text style={styles.derivedBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {readback.detail}
            </Text>
          </View>
        </Enter>
        <Enter delay={contentDelay(2)}>
          <View style={styles.section}>
            <SectionLabel>{secondary.label}</SectionLabel>
          </View>
        </Enter>
        {secondaryQuestion(secondary, 3)}
      </View>
    );
  } else if (step.kind === 'lifts') {
    contentCount = 2 + chosenLifts.length;
    content = (
      <View style={styles.stack}>
        <Enter delay={contentDelay(0)}>
          <SuggestionChips
            suggestions={step.suggestions ?? []}
            selected={chosenLifts}
            onToggle={toggleLift}
            max={step.maxChoices ?? MAX_KEY_LIFTS}
          />
        </Enter>
        {chosenLifts.length > 0 ? (
          <>
            <Enter delay={contentDelay(1)}>
              <View style={styles.section}>
                <SectionLabel>{step.sectionLabel ?? ''}</SectionLabel>
              </View>
            </Enter>
            {chosenLifts.map((lift, i) => (
              <Enter
                key={lift}
                delay={contentDelay(2 + i)}
                layout={listLayout}>
                <LiftLoadRow
                  lift={lift}
                  value={liftLoads[lift] ?? null}
                  unit={unit}
                  onChange={(next) => setLiftLoad(lift, next)}
                />
              </Enter>
            ))}
            {step.footnote ? (
              <Enter
                delay={contentDelay(2 + chosenLifts.length)}
>
                <Footnote>{step.footnote}</Footnote>
              </Enter>
            ) : null}
          </>
        ) : null}
      </View>
    );
  } else if (step.kind === 'overload') {
    const body = stepBody(step, answers);
    const example = overloadExample(answers);
    contentCount = body.length + 2;
    content = (
      <View style={styles.prose}>
        {body.map((paragraph, i) => (
          <Enter key={paragraph} delay={contentDelay(i)}>
            <Paragraph lede={i === 0}>{paragraph}</Paragraph>
          </Enter>
        ))}
        <Enter delay={contentDelay(body.length)}>
          <OverloadCard
            lift={example.lift}
            sets={example.sets}
            reps={example.reps}
            last={formatLoad(example.start)}
            next={formatLoad(example.next)}
            unit={example.unit}
          />
        </Enter>
        {step.footnote ? (
          <Enter
            delay={contentDelay(body.length + 1)}
>
            <Footnote>{step.footnote}</Footnote>
          </Enter>
        ) : null}
      </View>
    );
  } else if (step.kind === 'commitment') {
    const body = stepBody(step, answers);
    const sessions = commitmentCount(answers);
    contentCount = body.length + 1;
    content = (
      <View style={styles.prose}>
        <Enter delay={contentDelay(0)}>
          <StatCard value={sessions} caption="sessions between now and the end of it" />
        </Enter>
        {body.map((paragraph, i) => (
          <Enter
            key={paragraph}
            delay={contentDelay(1 + i)}
>
            <Paragraph>{paragraph}</Paragraph>
          </Enter>
        ))}
      </View>
    );
    cta = null;
    ctaSlot = (
      <View>
        <HoldHint>Press and hold</HoldHint>
        <HoldToCommit
          label={step.cta ?? 'Hold to commit'}
          onComplete={() => {
            setAnswer('commitment', `${COMMIT_WEEKS}w`);
            track('onboarding_commit_held', { weeks: COMMIT_WEEKS, sessions });
            goNext();
          }}
        />
      </View>
    );
  } else if (step.kind === 'recap' && step.options) {
    /**
     * A VISIBLE DEFAULT, and since 23 Aug 2026 A REAL PERMISSION PROMPT.
     *
     * The preselected "yes" is honest because the screen is showing exactly
     * what it will send. Continue writes whatever the screen shows and then, if
     * that is yes, opens the iOS dialog (`requestRecapInOnboarding`) — the
     * owner's reversal of §5.1's no-prompt-in-onboarding rule, on the grounds
     * that this screen IS the context the rule asks for.
     *
     * The flow never waits on the answer being GRANTED: a denial advances
     * exactly like a grant, the intent is stored either way, and You keeps the
     * row. The button shows its loading state only for the moment the system
     * dialog is up, so nobody taps Continue twice into a modal they cannot see
     * behind.
     */
    const recap = selected ?? 'yes';
    cta = {
      label: step.cta ?? 'Continue',
      loading: asking,
      onPress: () => {
        if (asking) return;
        setAnswer('notifications', recap);
        if (recap !== 'yes') {
          track('onboarding_notifications_choice', { value: recap });
          goNext();
          return;
        }
        setAsking(true);
        void requestRecapInOnboarding()
          .then((granted) => {
            track('onboarding_notifications_choice', { value: recap, granted });
          })
          .finally(() => {
            setAsking(false);
            goNext();
          });
      },
    };
    contentCount = 2 + step.options.length;
    content = (
      <View style={styles.stack}>
        <Enter delay={contentDelay(0)}>
          <RecapPreview
            title="Your week"
            body="What moved, what stalled, and the one number worth beating."
          />
        </Enter>
        <View
          style={[styles.stack, styles.section]}
          accessibilityRole="radiogroup"
          accessibilityLabel={headline}>
          {step.options.map((option, i) => (
            <Enter
              key={option.id}
              delay={contentDelay(1 + i)}
>
              <OptionRow
                label={option.label}
                detail={option.detail}
                emoji={option.emoji}
                selected={recap === option.id}
                onPress={() => setAnswer('notifications', option.id)}
              />
            </Enter>
          ))}
        </View>
        {/* The system sheet is never a surprise: the screen says it is coming
            before the finger is on the button that opens it. Only under a yes —
            "Not now" opens nothing. */}
        {step.footnote && recap === 'yes' ? (
          <Enter delay={contentDelay(1 + step.options.length)}>
            <Footnote>{step.footnote}</Footnote>
          </Enter>
        ) : null}
      </View>
    );
  } else if (step.kind === 'projection') {
    const [lead, ...rest] = projections;
    contentCount = projections.length + 1;
    content = (
      <View style={styles.stack}>
        {lead ? (
          <>

            <Enter delay={contentDelay(0)}>
              <ProjectionCard
                lift={lead.lift}
                start={lead.start}
                target={lead.target}
                gain={lead.gain}
                unit={lead.unit}
              />
            </Enter>
            {rest.map((p, i) => (
              <Enter
                key={p.lift}
                delay={contentDelay(1 + i)}
>
                <ProjectionRow
                  lift={p.lift}
                  start={p.start}
                  target={p.target}
                  unit={p.unit}
                />
              </Enter>
            ))}
          </>
        ) : relative ? (
          // A lift was named and no load was ever typed. The projection goes
          // relative rather than absolute — the rate is real, the starting
          // number would have to be invented, and §5.1 forbids inventing it.
          <Enter delay={contentDelay(0)}>
            <RelativeProjectionCard lift={relative.lift} percent={relative.percent} />
          </Enter>
        ) : (
          // Not even a lift was named, so there is nothing to project at all.
          // The screen says that rather than inventing one.
          <Enter delay={contentDelay(0)}>
            <Paragraph>
              {`You skipped the starting numbers, so there is nothing to project from yet. Your first ${COMMIT_WEEKS} weeks will build it from what you actually lift.`}
            </Paragraph>
          </Enter>
        )}
        {/* The disclaimer belongs to BOTH variants: a relative projection is
            just as much an estimate from answers as an absolute one. */}
        {step.footnote && (lead || relative) ? (
          <Enter
            delay={contentDelay(1 + rest.length)}
>
            <Footnote>{step.footnote}</Footnote>
          </Enter>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={stackOptions} />
      <OnboardingScreen
        slug={step.slug}
        eyebrow={step.eyebrow}
        eyebrowTone={step.eyebrowTone}
        kicker={step.kicker}
        headline={headline}
        subtext={subtext}
        // THE WELCOME IS THE ONE HERO (23 Aug 2026). The template has carried a
        // `hero` register — `type.display`, 38 pt — since the 12 Aug restyle and
        // nothing ever passed it, so screen one of the funnel was set at exactly
        // the same size as "how long have you been lifting?". The first thing a
        // person sees is the one line in the flow that is a promise rather than
        // a question, and the scale is what says so.
        hero={isIntro}
        centered={isIntro}
        progress={
          isIntro ? null : { total: PROGRESS_TOTAL, completed: progressFilled(stepNumber) }
        }
        onBack={isIntro ? null : goBack}
        cta={cta}
        ctaSlot={ctaSlot}
        footer={footer}
        contentCount={contentCount}>
        {content}
      </OnboardingScreen>
    </>
  );
}

/**
 * An answer as an EVENT sees it.
 *
 * The two answers that are the person's own words never travel as text: a name
 * is written-or-not and the demo line is parsed-or-not. Everything else is an
 * option id, or a list of them with the store's unit separator swapped for a
 * comma so the value is readable wherever it ends up.
 */
function answerValue(key: AnswerKey, value: string): string {
  if (key === 'name') return value.trim().length > 0 ? 'written' : 'empty';
  if (key === 'demoEntry') return value.length > 0 ? 'parsed' : 'none';
  return serializeList(parseList(value)).split(String.fromCharCode(31)).join(',') || 'none';
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  /** Paragraphs breathe wider than option rows do. */
  prose: {
    gap: spacing.lg,
  },
  /** The gap above a second labelled group on the same page. */
  section: {
    marginTop: spacing.sm,
  },
  /** The week read back — a headline-weight fact, not a caption. */
  derived: {
    ...type.title2,
    color: color.textPrimary,
  },
  derivedBody: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: 2,
  },
  signIn: {
    ...type.subhead,
    color: color.textSecondary,
  },
  signInLink: {
    fontWeight: '600',
    color: color.brand,
  },
  pressed: {
    opacity: 0.6,
  },
});
