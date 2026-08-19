import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearTransition, useReducedMotion } from 'react-native-reanimated';

import {
  commitmentCount,
  liftProjections,
  MAX_KEY_LIFTS,
  PROGRESS_TOTAL,
  progressFilled,
  resolveWeightUnit,
  STEPS,
  stepHeadline,
  stepSubtext,
} from '@/components/onboarding/config';
import { DayPicker } from '@/components/onboarding/DayPicker';
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
import { ParseDemo } from '@/components/onboarding/ParseDemo';
import { ProjectionCard, ProjectionRow } from '@/components/onboarding/ProjectionCard';
import { SuggestionChips } from '@/components/onboarding/SuggestionChips';
import { TextField } from '@/components/onboarding/TextField';
import { BLUE, PUSH_MS } from '@/components/onboarding/tokens';
import { markObStepReached, markOnboardingCompleted, setObStepCount } from '@/lib/funnel';
import { defaultLanguage } from '@/lib/locale';
import { DUR } from '@/lib/motion';
import {
  COMMIT_WEEKS,
  dayCount,
  isExperience,
  isGoal,
  isSessionFeel,
  loadStep,
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
  setObTracker,
  setPrimaryLift,
  setRecapIntent,
  setRestSeconds,
  setSessionFeel,
  setUsualDays,
  setWeightUnit,
} from '@/lib/prefs';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useOnboardingAnswers } from '@/state/onboarding';

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
 * returns to Today. Per §5.1 no OS permission is requested here — the recap
 * answer is intent, asked for real when the first recap exists.
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

  const answers = useOnboardingAnswers((s) => s.answers);
  const setAnswer = useOnboardingAnswers((s) => s.setAnswer);
  const setStep = useOnboardingAnswers((s) => s.setStep);

  // Record the position so a killed app resumes on this step, and the funnel's
  // high-water mark (1-based in this flow) so drop-off is measurable.
  useEffect(() => {
    setStep(stepNumber);
    markObStepReached(stepNumber);
  }, [stepNumber, setStep]);

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
  }, [stepNumber, router]);

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

  const chosenLifts = useMemo(() => parseList(answers.keyLifts), [answers.keyLifts]);
  const liftLoads = useMemo(() => parseLiftLoads(answers.liftLoads), [answers.liftLoads]);
  const projections = useMemo(
    () => (step.kind === 'projection' ? liftProjections(answers) : []),
    [step.kind, answers],
  );

  const setLiftLoad = (lift: string, value: number) => {
    setAnswer('liftLoads', serializeLiftLoads({ ...liftLoads, [lift]: value }));
  };

  const toggleObstacle = (id: string) => {
    const current = parseList(answers.obstacles);
    if (id === EXCLUSIVE_OBSTACLE) {
      setAnswer('obstacles', current.includes(id) ? '' : id);
      return;
    }
    const withoutExclusive = serializeList(current.filter((v) => v !== EXCLUSIVE_OBSTACLE));
    setAnswer('obstacles', toggleInList(withoutExclusive, id));
  };

  const toggleLift = (lift: string) => {
    const next = toggleInList(answers.keyLifts, lift);
    setAnswer('keyLifts', next);
    // A lift dropped from the set takes its load with it: leaving an orphaned
    // number in the map would put a lift nobody chose on the projection screen.
    if (!parseList(next).includes(lift) && liftLoads[lift] != null) {
      const rest = { ...liftLoads };
      delete rest[lift];
      setAnswer('liftLoads', serializeLiftLoads(rest));
    }
  };

  // What sits in the content band, how many staggered items it holds (the CTA
  // lands one beat after the last of them), and what the button does.
  let content: React.ReactNode = null;
  let contentCount = 1;
  let cta: { label: string; onPress: () => void; disabled?: boolean } | null = {
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
              onPress={() => step.storeKey && setAnswer(step.storeKey, option.id)}
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
              selected={chosen.includes(option.id)}
              onPress={() => toggleObstacle(option.id)}
            />
          </Enter>
        ))}
      </View>
    );
  } else if (step.kind === 'demo') {
    contentCount = 2;
    content = (
      <Enter delay={contentDelay(0)}>
        <ParseDemo />
      </Enter>
    );
  } else if (step.kind === 'essay') {
    const body = step.body ?? [];
    contentCount = body.length;
    content = (
      <View style={styles.prose}>
        {body.map((paragraph, i) => (
          <Enter key={paragraph} delay={contentDelay(i)}>
            <Paragraph>{paragraph}</Paragraph>
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
        <View
          style={styles.stack}
          accessibilityRole="radiogroup"
          accessibilityLabel={secondary.label}>
          {secondary.options.map((option, i) => (
            <Enter
              key={option.id}
              delay={contentDelay(2 + i)}
>
              <OptionRow
                label={option.label}
                selected={answers[secondary.storeKey] === option.id}
                onPress={() => setAnswer(secondary.storeKey, option.id)}
              />
            </Enter>
          ))}
        </View>
      </View>
    );
  } else if (step.kind === 'days') {
    const secondary = step.secondary!;
    const picked = dayCount(dayMask);
    contentCount = 3 + secondary.options.length;
    content = (
      <View style={styles.stack}>
        <Enter delay={contentDelay(0)}>
          <DayPicker
            mask={dayMask}
            onToggle={(day) => setAnswer('trainingDays', String(toggleDay(dayMask, day)))}
          />
        </Enter>
        <Enter delay={contentDelay(1)}>
          {/* The week read straight back. Nothing here counts a miss (§11) —
              it is the shape of a week, not a target. */}
          <View>
            <Text style={styles.derived} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {picked > 0 ? `${picked} ${picked === 1 ? 'day' : 'days'} a week` : 'Pick your days'}
            </Text>
            <Text style={styles.derivedBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {picked > 0
                ? 'Recore builds your Next tab around this rhythm.'
                : 'Roughly is fine — you can change it any time.'}
            </Text>
          </View>
        </Enter>
        <Enter delay={contentDelay(2)}>
          <View style={styles.section}>
            <SectionLabel>{secondary.label}</SectionLabel>
          </View>
        </Enter>
        <View
          style={styles.stack}
          accessibilityRole="radiogroup"
          accessibilityLabel={secondary.label}>
          {secondary.options.map((option, i) => (
            <Enter
              key={option.id}
              delay={contentDelay(3 + i)}
>
              <OptionRow
                label={option.label}
                selected={answers[secondary.storeKey] === option.id}
                onPress={() => setAnswer(secondary.storeKey, option.id)}
              />
            </Enter>
          ))}
        </View>
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
    const body = step.body ?? [];
    const example = overloadExample(chosenLifts[0], liftLoads[chosenLifts[0] ?? ''], unit);
    contentCount = body.length + 2;
    content = (
      <View style={styles.prose}>
        {body.map((paragraph, i) => (
          <Enter key={paragraph} delay={contentDelay(i)}>
            <Paragraph>{paragraph}</Paragraph>
          </Enter>
        ))}
        <Enter delay={contentDelay(body.length)}>
          <OverloadCard
            lift={example.lift}
            last={example.last}
            next={example.next}
            unit={unit}
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
    const body = step.body ?? [];
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
            goNext();
          }}
        />
      </View>
    );
  } else if (step.kind === 'recap' && step.options) {
    // A VISIBLE DEFAULT. Recap intent is not a permission — §5.1 keeps the OS
    // prompt for the moment the first recap exists — so a preselected "yes" is
    // honest here in a way it would never be for a system dialog, and Continue
    // writes whatever the screen is showing rather than nothing at all.
    const recap = selected ?? 'yes';
    cta = { label: step.cta ?? 'Continue', onPress: () => {
      setAnswer('notifications', recap);
      goNext();
    } };
    contentCount = 1 + step.options.length;
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
        ) : (
          // No starting load was typed, so there is nothing to project FROM.
          // The screen says that rather than inventing a lift and a number —
          // §5.1: never a fake progression before a session is logged.
          <Enter delay={contentDelay(0)}>
            <Paragraph>
              {`You skipped the starting numbers, so there is nothing to project from yet. Your first ${COMMIT_WEEKS} weeks will build it from what you actually lift.`}
            </Paragraph>
          </Enter>
        )}
        {step.footnote && lead ? (
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
 * The overload card's two lines. It uses the person's OWN first key lift and
 * the load they set for it whenever both exist — which is why the key-lift
 * screen comes two screens earlier — and otherwise falls back to a named
 * example. The jump is always `loadStep`, the smallest real plate change, which
 * is the fact the whole screen is about.
 */
function overloadExample(
  lift: string | undefined,
  load: number | undefined,
  unit: 'kg' | 'lb',
): { lift: string; last: string; next: string } {
  const step = loadStep(unit);
  const fallbackLoad = unit === 'lb' ? 135 : 60;
  const start = load != null && load > 0 ? load : fallbackLoad;
  return {
    lift: lift ?? 'Bench press',
    last: formatLoad(start),
    next: formatLoad(start + step),
  };
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
    color: BLUE,
  },
  pressed: {
    opacity: 0.6,
  },
});
