import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn, ProgressBar, ReadingArc, Stagger } from '@/components/motion';
import { AppButton, Eyebrow, Rating, Testimonial } from '@/components/primitives';
import { tap, tapMedium } from '@/lib/haptics';
import {
  getFirstAction,
  getGoal,
  getName,
  getObLanguage,
  getObStep,
  getObTracker,
  getSmallestPlateKg,
  getWeightUnit,
  markOnboardingDone,
  setFirstAction,
  setGoal,
  setName,
  setObLanguage,
  setObStep,
  setObTracker,
  setSmallestPlateKg,
  setWeightUnit,
  type FirstAction,
  type Goal,
  type ObLanguage,
  type ObTracker,
  type WeightUnit,
} from '@/lib/prefs';
import {
  makeStyles,
  MAX_FONT_SCALE,
  moderateScale,
  mono,
  radius,
  spacing,
  spring,
  type,
  useTheme,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * Onboarding — the CONVERSION funnel (2026-07-23 redesign). The account is
 * deferred to the very end, so a first-time signed-out user lands here and
 * invests before ever being asked to sign in — the structure every
 * top-converting fitness app uses (Centr, Calm, Cal AI). One decision per
 * screen, a thin progress spine, staggered reveals; the personalization builds
 * commitment, an "analyzing" beat builds anticipation, and a personalized
 * "your ledger is ready" reveal + social proof hands off to the paywall.
 *
 *   0 welcome     — the promise + a settling specimen + the 77% hook.
 *   1 name        — an optional first name that personalizes the rest.
 *   2 focus       — training goal (persists the EXISTING goal pref).
 *   3 tracker     — where training lives today (obTracker).
 *   4 language    — the writing language, honestly measured (obLanguage).
 *   5 units       — display unit + smallest bar increment (smallest plate).
 *   6 how it works— the parser reads a note into a ledger, live. No inputs.
 *   7 analyzing   — "building your ledger" — reflects the answers, auto-advances.
 *   8 ready       — the personalized setup echo + social proof; → /paywall.
 *
 * The palette stays monochrome; the premium is carried by type + motion + the
 * one restrained shadow on the hero cards.
 */
const STEP_COUNT = 9;
const LAST_STEP = STEP_COUNT - 1;
/** The passive anticipation beat — no footer, auto-advances to the reveal. */
const ANALYZING_STEP = 7;

const SECONDARY_H = moderateScale(44);
const TAG_RADIUS = 4;
const CHIP_RADIUS = 8;

const LB_PER_KG = 2.2046226218;
const INCREMENTS_KG = [0.5, 1, 1.25, 2.5, 5] as const;
const INCREMENTS_LB = [1, 2.5, 5, 10] as const;
const DEFAULT_INCREMENT_KG = 2.5;
const DEFAULT_INCREMENT_LB = 5;
const MAX_CUSTOM_INCREMENT = 50;

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtNum = (n: number) => String(round2(n));

function nearestIndex(ladder: readonly number[], value: number): number {
  let best = 0;
  for (let i = 1; i < ladder.length; i++) {
    if (Math.abs(ladder[i]! - value) < Math.abs(ladder[best]! - value)) best = i;
  }
  return best;
}

function snapToLadder(ladder: readonly number[], value: number): number {
  return ladder[nearestIndex(ladder, value)]!;
}

export default function Onboarding() {
  const styles = useStyles();
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);

  const [step, setStepState] = useState(() => {
    const s = getObStep();
    return s != null && s < STEP_COUNT ? s : 0;
  });
  const [name, setNameState] = useState(() => getName() ?? '');
  const [goal, setGoalState] = useState<Goal>(() => getGoal() ?? 'both');
  const [tracker, setTrackerState] = useState<ObTracker | null>(() => getObTracker());
  const [language, setLanguageState] = useState<ObLanguage>(() => getObLanguage() ?? 'en');
  const [unit, setUnitState] = useState<WeightUnit>(() => getWeightUnit() ?? 'kg');
  const [incrementStored, setIncrementStored] = useState(() => getSmallestPlateKg() != null);
  const [increment, setIncrementState] = useState<number>(() => {
    const plate = getSmallestPlateKg();
    const u = getWeightUnit() ?? 'kg';
    if (plate == null) return u === 'kg' ? DEFAULT_INCREMENT_KG : DEFAULT_INCREMENT_LB;
    const kg = plate * 2;
    return u === 'kg' ? round2(kg) : snapToLadder(INCREMENTS_LB, kg * LB_PER_KG);
  });
  const [action, setActionState] = useState<FirstAction | null>(() => getFirstAction());

  // Which way the funnel is travelling. A step that always rises into place
  // makes Back feel like another Continue: if something left downward, the eye
  // expects it to come back from below. Reversing the entrance is the whole
  // difference between "I moved back" and "I moved on again".
  const direction = useRef<1 | -1>(1);

  const goTo = (n: number) => {
    direction.current = n < step ? -1 : 1;
    setStepState(n);
    setObStep(n);
  };

  const back = () => {
    tap();
    goTo(Math.max(step - 1, 0));
  };

  /** Skip setup: defaults for the unanswered, straight to the final step.
   * Units/increment intentionally stay unset → repeat-only predictions. */
  const skipSetup = () => {
    tap();
    if (getGoal() == null) setGoal(goal);
    if (getObTracker() == null) setObTracker(tracker ?? 'none');
    if (getObLanguage() == null) setObLanguage(language);
    goTo(LAST_STEP);
  };

  const commitIncrement = (u: WeightUnit, value: number) => {
    setUnitState(u);
    setIncrementState(value);
    setIncrementStored(true);
    setWeightUnit(u);
    const kg = u === 'kg' ? value : value / LB_PER_KG;
    setSmallestPlateKg(Math.round((kg / 2) * 1000) / 1000);
  };

  const continueFrom = () => {
    tapMedium();
    if (step === 1) setName(name); // stored trimmed; empty clears it
    if (step === 2) setGoal(goal);
    if (step === 3) {
      const t = tracker ?? 'none';
      setTrackerState(t);
      setObTracker(t);
    }
    if (step === 4) setObLanguage(language);
    if (step === 5) commitIncrement(unit, increment);
    goTo(Math.min(step + 1, LAST_STEP));
  };

  const fromSetup = tracker === 'hevy' || tracker === 'strong';
  const effectiveAction: FirstAction = action ?? (fromSetup ? 'import' : 'write');

  const finish = () => {
    tapMedium();
    setFirstAction(effectiveAction);
    markOnboardingDone();
    if (userId) hydrate(userId);
    router.push('/paywall');
  };

  const progress = (step + 1) / STEP_COUNT;
  const canSkip = step >= 1 && step < LAST_STEP && step !== ANALYZING_STEP;

  return (
    <SafeAreaView style={styles.root}>
      <Chrome step={step} progress={progress} canSkip={canSkip} onBack={back} onSkip={skipSetup} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <FadeSlideIn key={step} distance={14 * direction.current}>
          {step === 0 ? (
            <StepWelcome />
          ) : step === 1 ? (
            <StepName name={name} onChange={setNameState} onSubmit={continueFrom} />
          ) : step === 2 ? (
            <StepFocus
              name={name}
              goal={goal}
              onPick={(g) => {
                tap();
                setGoalState(g);
                setGoal(g);
              }}
            />
          ) : step === 3 ? (
            <StepTracker
              tracker={tracker}
              onPick={(t) => {
                tap();
                setTrackerState(t);
                setObTracker(t);
              }}
            />
          ) : step === 4 ? (
            <StepLanguage
              language={language}
              onPick={(l) => {
                tap();
                setLanguageState(l);
                setObLanguage(l);
              }}
            />
          ) : step === 5 ? (
            <StepUnits
              unit={unit}
              increment={increment}
              onUnit={(u) => {
                if (u === unit) return;
                tap();
                const kg = unit === 'kg' ? increment : increment / LB_PER_KG;
                const next =
                  u === 'kg'
                    ? snapToLadder(INCREMENTS_KG, kg)
                    : snapToLadder(INCREMENTS_LB, kg * LB_PER_KG);
                commitIncrement(u, next);
              }}
              onStep={(dir) => {
                tap();
                const ladder = unit === 'kg' ? INCREMENTS_KG : INCREMENTS_LB;
                const i = nearestIndex(ladder, increment);
                const next = ladder[Math.min(ladder.length - 1, Math.max(0, i + dir))]!;
                commitIncrement(unit, next);
              }}
              onCustom={(value) => commitIncrement(unit, value)}
            />
          ) : step === 6 ? (
            <StepHowItWorks />
          ) : step === 7 ? (
            <StepAnalyzing
              name={name}
              goal={goal}
              tracker={tracker}
              language={language}
              increment={incrementStored ? increment : null}
              unit={unit}
              onDone={() => goTo(LAST_STEP)}
            />
          ) : (
            <StepReady
              name={name}
              goal={goal}
              tracker={tracker}
              language={language}
              unit={unit}
              increment={incrementStored ? increment : null}
              action={effectiveAction}
              fromSetup={fromSetup}
              onPick={(a) => {
                tap();
                setActionState(a);
                setFirstAction(a);
              }}
            />
          )}
        </FadeSlideIn>
      </ScrollView>

      {step === ANALYZING_STEP ? null : (
        <View style={styles.footer}>
          {step === 0 ? (
            <>
              <AppButton label="Get started" onPress={continueFrom} />
              {!userId && (
                <AppButton
                  label="Already use Recore?  Sign in"
                  variant="ghost"
                  compact
                  onPress={() => {
                    tap();
                    router.push('/sign-in');
                  }}
                />
              )}
              <Text style={styles.footCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {'A minute of setup, then a 7-day trial choice.\nNo account needed until the very end.'}
              </Text>
            </>
          ) : step === LAST_STEP ? (
            <AppButton label="See plans & start trial" onPress={finish} />
          ) : (
            <>
              <AppButton label={step === 1 && !name.trim() ? 'Skip for now' : 'Continue'} onPress={continueFrom} />
              {step === 1 ? (
                <Text style={styles.footCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Only used to address you — never shared. Saved on this iPhone.
                </Text>
              ) : step === 3 ? (
                <Text style={styles.footCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Import stays available in Settings whatever you pick.
                </Text>
              ) : step === 4 ? (
                <Text style={styles.footCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Editable later in Settings.
                </Text>
              ) : null}
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

/** Top chrome: the wordmark on welcome, Back elsewhere; a progress spine in the
 * middle; a genuine Skip on the setup + content steps. */
function Chrome({
  step,
  progress,
  canSkip,
  onBack,
  onSkip,
}: {
  step: number;
  progress: number;
  canSkip: boolean;
  onBack: () => void;
  onSkip: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.chrome}>
      <View style={styles.chromeSide}>
        {step === 0 ? (
          <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Recore
          </Text>
        ) : (
          <Pressable onPress={onBack} hitSlop={spacing.md} style={({ pressed }) => pressed && styles.pressedDim}>
            <Text style={styles.backLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              <Text style={styles.backChevron}>{'‹ '}</Text>Back
            </Text>
          </Pressable>
        )}
      </View>

      <ProgressBar progress={progress} style={styles.progress} />

      <View style={[styles.chromeSide, styles.chromeRight]}>
        {canSkip ? (
          <Pressable onPress={onSkip} hitSlop={spacing.md} style={({ pressed }) => pressed && styles.pressedDim}>
            <Text style={styles.skipLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ————————————————————————————————————————————————————————————— steps

/** 0 — the promise, stated with the ledger's own specimen settling in. */
function StepWelcome() {
  const styles = useStyles();
  return (
    <View>
      <Eyebrow tone="secondary" style={styles.kicker}>
        A training ledger
      </Eyebrow>
      <Text style={styles.hero} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {'The training log\nyou’ll actually keep.'}
      </Text>
      <Text style={styles.heroSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Write your session in plain words — any shorthand, any language. Recore reads it into a
        clean record. No forms, no pickers, no taps.
      </Text>

      <View style={styles.specimen}>
        <Stagger initialDelay={180} step={120}>
          <SpecimenRow tag="WRITTEN" text={<Text style={styles.specimenText}>bench 5×5 100kg</Text>} />
          <SpecimenRow
            tag="RECORDED"
            text={
              <Text style={styles.specimenText}>
                Bench Press · <Text style={styles.specimenMono}>100 kg × 5·5·5</Text>
              </Text>
            }
          />
          <SpecimenRow
            tag="PLANNED"
            quiet
            text={
              <Text style={styles.specimenTextQuiet}>
                Next: <Text style={styles.specimenPlanned}>102.5 kg × 5·5·5</Text>
              </Text>
            }
          />
        </Stagger>
        <View style={styles.specimenFooter}>
          <Text style={styles.specimenFootText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Example — plans appear only once your recorded history supports them.
          </Text>
        </View>
      </View>
    </View>
  );
}

function SpecimenRow({ tag, text, quiet }: { tag: string; text: React.ReactNode; quiet?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.specimenRow}>
      <Tag label={tag} fixed />
      <Text style={quiet ? styles.specimenTextQuiet : styles.specimenText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

/** 1 — the name. Optional, one tap to skip. Personalizes every screen after. */
function StepName({ name, onChange, onSubmit }: { name: string; onChange: (t: string) => void; onSubmit: () => void }) {
  const styles = useStyles();
  const t = useTheme();
  return (
    <StepFrame
      eyebrow="Step 01"
      title="First — what should we call you?"
      sub="So the app can address you by name. Totally optional — tap Skip to stay anonymous.">
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        autoFocus
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
        placeholder="Your name"
        placeholderTextColor={t.inkFaint}
        selectionColor={t.ink}
        cursorColor={t.ink}
        keyboardAppearance="light"
        maxLength={24}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      />
    </StepFrame>
  );
}

/** 2 — training focus. Persists the EXISTING goal pref. */
function StepFocus({ name, goal, onPick }: { name: string; goal: Goal; onPick: (g: Goal) => void }) {
  const who = name.trim();
  return (
    <StepFrame
      eyebrow="Step 02"
      title={who ? `What are you training for, ${who}?` : 'What are you training for?'}
      sub="This only tunes examples and wording. Recore never prescribes a program — you write your own.">
      <OptionRow title="Strength" subtitle="Heavy top sets, low reps" selected={goal === 'strength'} onPress={() => onPick('strength')} />
      <OptionRow title="Hypertrophy" subtitle="Volume work in rep ranges" selected={goal === 'muscle'} onPress={() => onPick('muscle')} />
      <OptionRow title="Hybrid / Hyrox" subtitle="Lifting mixed with engine work" selected={goal === 'both'} onPress={() => onPick('both')} />
    </StepFrame>
  );
}

/** 3 — where training lives today. Nothing imports pre-entitlement. */
function StepTracker({ tracker, onPick }: { tracker: ObTracker | null; onPick: (t: ObTracker) => void }) {
  return (
    <StepFrame
      eyebrow="Step 03"
      title="Where does your training live now?"
      sub="This picks the most useful first step once you're in — nothing is imported yet.">
      <OptionRow title="Strong" meta="CSV import" selected={tracker === 'strong'} onPress={() => onPick('strong')} />
      <OptionRow title="Hevy" meta="CSV import" selected={tracker === 'hevy'} onPress={() => onPick('hevy')} />
      <OptionRow title="Notes or a spreadsheet" meta="paste later" selected={tracker === 'notes'} onPress={() => onPick('notes')} />
      <OptionRow title="Nowhere yet" meta="start fresh" selected={tracker === 'none'} onPress={() => onPick('none')} />
    </StepFrame>
  );
}

/** 4 — writing language. Two measured languages, verbatim for the rest. */
function StepLanguage({ language, onPick }: { language: ObLanguage; onPick: (l: ObLanguage) => void }) {
  const styles = useStyles();
  return (
    <StepFrame
      eyebrow="Step 04"
      title="Which language do you write in?"
      sub="English and Slovenian are the languages Recore's reading is measured on today.">
      <OptionRow title="English" meta={'“bench 3x5 80”'} selected={language === 'en'} onPress={() => onPick('en')} />
      <OptionRow title="Slovenščina" meta={'“potisk 3x8 60”'} selected={language === 'slo'} onPress={() => onPick('slo')} />
      <OptionRow title="Both" selected={language === 'both'} onPress={() => onPick('both')} />
      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Other languages are always saved exactly as written and read on a best-effort basis.
      </Text>
    </StepFrame>
  );
}

/** 4 — units + smallest bar increment (stored as the smallest plate). */
function StepUnits({
  unit,
  increment,
  onUnit,
  onStep,
  onCustom,
}: {
  unit: WeightUnit;
  increment: number;
  onUnit: (u: WeightUnit) => void;
  onStep: (dir: 1 | -1) => void;
  onCustom: (value: number) => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');

  const commitCustom = () => {
    const n = Number.parseFloat(customText.replace(',', '.'));
    if (Number.isFinite(n) && n > 0 && n <= MAX_CUSTOM_INCREMENT) onCustom(round2(n));
    setCustomOpen(false);
    setCustomText('');
  };

  return (
    <StepFrame
      eyebrow="Step 05"
      title="Units and smallest jump"
      sub="Gives future load suggestions a safe step. Started from your locale; change anytime in Settings.">
      <View style={styles.segmentWrap}>
        {(['kg', 'lb'] as const).map((u) => (
          <Pressable key={u} onPress={() => onUnit(u)} style={[styles.segment, unit === u && styles.segmentSelected]}>
            <Text style={[styles.segmentLabel, unit === u && styles.segmentLabelSelected]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {u}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.incrementCard}>
        <View style={styles.incrementRow}>
          <View style={styles.incrementText}>
            <Text style={styles.incrementTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Smallest bar increment
            </Text>
            <Text style={styles.incrementSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`Two ${fmtNum(increment / 2)} ${unit} plates = ${fmtNum(increment)} ${unit}`}
            </Text>
          </View>
          <View style={styles.stepper}>
            <Pressable onPress={() => onStep(-1)} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressedFill]}>
              <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                −
              </Text>
            </Pressable>
            <Text style={styles.stepValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${fmtNum(increment)} ${unit}`}
            </Text>
            <Pressable onPress={() => onStep(1)} style={({ pressed }) => [styles.stepBtn, pressed && styles.pressedFill]}>
              <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                +
              </Text>
            </Pressable>
          </View>
        </View>
        {customOpen ? (
          <TextInput
            style={styles.customInput}
            value={customText}
            onChangeText={setCustomText}
            keyboardType="decimal-pad"
            autoFocus
            placeholder={`in ${unit}`}
            placeholderTextColor={t.inkFaint}
            onSubmitEditing={commitCustom}
            onBlur={commitCustom}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
        ) : (
          <Pressable onPress={() => { tap(); setCustomOpen(true); }} style={({ pressed }) => [styles.customRow, pressed && styles.pressedFill]}>
            <Text style={styles.customLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Enter a custom value…
            </Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Optional. Without it, Recore repeats verified loads instead of guessing a jump.
      </Text>
    </StepFrame>
  );
}

/** 5 — the app, doing its one job: reading a note into a ledger, live. */
function StepHowItWorks() {
  const styles = useStyles();
  return (
    <StepFrame
      eyebrow="How it works"
      title="You write. It reads."
      sub="Type a session the way you'd text it to a friend. Recore turns it into a clean record in the background — no forms, no taps.">
      <LedgerDemo />
      <View style={styles.pointList}>
        <Point text="Any words, any language — your shorthand stays yours." />
        <Point text="Nothing to tap: no exercise pickers, no dropdowns." />
        <Point text="Your words are never rewritten. The raw note is always kept." />
      </View>
    </StepFrame>
  );
}

/** 7 — the anticipation beat. A short "building your ledger" pass whose rows
 * echo the user's OWN answers (their language, goal, jump, tracker), then it
 * auto-advances to the reveal. Passive — no button, no friction; it just makes
 * the setup feel like it produced something. reduceMotion → a brief hold. */
function StepAnalyzing({
  name,
  goal,
  tracker,
  language,
  increment,
  unit,
  onDone,
}: {
  name: string;
  goal: Goal;
  tracker: ObTracker | null;
  language: ObLanguage;
  increment: number | null;
  unit: WeightUnit;
  onDone: () => void;
}) {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const who = name.trim();

  const items = [
    language === 'slo'
      ? 'Reading Slovenian shorthand'
      : language === 'both'
        ? 'Reading English + Slovenian'
        : 'Reading your shorthand',
    goal === 'strength'
      ? 'Tuning for heavy top sets'
      : goal === 'muscle'
        ? 'Tuning for rep-range volume'
        : 'Tuning for hybrid training',
    increment != null ? `Setting ${fmtNum(increment)} ${unit} jumps` : 'Repeating verified loads',
    tracker === 'hevy' ? 'Ready to import your Hevy log' : tracker === 'strong' ? 'Ready to import your Strong log' : 'Preparing your record book',
  ];

  const [progress, setProgress] = useState(reduce ? 1 : 0);
  const [doneCount, setDoneCount] = useState(reduce ? items.length : 0);

  useEffect(() => {
    if (reduce) {
      const t = setTimeout(onDone, 650);
      return () => clearTimeout(t);
    }
    const T = 2600;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const e = Math.min(1, (Date.now() - start) / T);
      setProgress(e);
      setDoneCount(Math.min(items.length, Math.floor(e * items.length + 1e-6)));
      if (e < 1) raf = requestAnimationFrame(tick);
      else {
        setDoneCount(items.length);
        setTimeout(onDone, 520);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <View>
      <Eyebrow tone="secondary" style={styles.kicker}>
        Almost there
      </Eyebrow>
      <Text style={styles.stepTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {who ? `Building your ledger, ${who}…` : 'Building your ledger…'}
      </Text>

      <View style={styles.analyzeHead}>
        <Text style={styles.analyzePercent} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {Math.round(progress * 100)}%
        </Text>
        <ProgressBar progress={progress} style={styles.analyzeBar} height={4} />
      </View>

      <View style={styles.analyzeCard}>
        {items.map((label, i) => {
          const complete = i < doneCount;
          return (
            <View key={label} style={[styles.analyzeRow, i > 0 && styles.demoRowRule]}>
              {complete ? (
                <View style={styles.demoCheck}>
                  <Text style={styles.demoCheckMark}>✓</Text>
                </View>
              ) : (
                <View style={styles.demoHollow} />
              )}
              <Text
                style={[styles.analyzeLabel, !complete && styles.analyzeLabelPending]}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 8 — the payoff. The setup echoed back as a ready ledger, social proof to
 * carry the hand-off, and the first paid action decided (remembered through
 * checkout). → the footer's "See plans & start trial" opens the paywall. */
function StepReady({
  name,
  goal,
  tracker,
  language,
  unit,
  increment,
  action,
  fromSetup,
  onPick,
}: {
  name: string;
  goal: Goal;
  tracker: ObTracker | null;
  language: ObLanguage;
  unit: WeightUnit;
  increment: number | null;
  action: FirstAction;
  fromSetup: boolean;
  onPick: (a: FirstAction) => void;
}) {
  const styles = useStyles();
  const who = name.trim();
  const goalChip = goal === 'both' ? 'hybrid / hyrox' : goal === 'muscle' ? 'hypertrophy' : 'strength';
  const trackerChip =
    tracker === 'hevy' ? 'hevy' : tracker === 'strong' ? 'strong' : tracker === 'notes' ? 'notes' : 'fresh start';
  const languageChip = language === 'both' ? 'en + slo' : language;
  const unitChip = increment != null ? `${unit} · +${fmtNum(increment)}` : unit;

  const sourceName = tracker === 'hevy' ? 'Hevy' : tracker === 'strong' ? 'Strong' : 'Hevy/Strong';
  const importSub = `Years of sessions become the evidence behind your next ones. ≈ 2 min with ${
    fromSetup ? `a ${sourceName} CSV` : 'a CSV export'
  }.`;
  const testimonial =
    goal === 'both'
      ? { quote: 'Types like notes, reads like a spreadsheet. Sled pushes and wall balls land in the log too.', who: 'Elena · Hyrox' }
      : { quote: 'I stopped “managing an app” and just wrote my sets. First tracker I’ve kept past a month.', who: 'Marko · powerlifting' };

  return (
    <StepFrame eyebrow="You're set" title={who ? `Your ledger is ready, ${who}.` : 'Your ledger is ready.'}>
      <View style={styles.chips}>
        {[goalChip, trackerChip, languageChip, unitChip].map((c) => (
          <View key={c} style={styles.chip}>
            <Text style={styles.chipText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {c}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.readyProof}>
        <Rating score={4.9} countLabel="loved by early lifters" align="flex-start" />
      </View>

      <View style={styles.choices}>
        <ChoiceCard
          title={`Import your ${sourceName} history`}
          subtitle={importSub}
          note={fromSetup ? 'picked from your setup' : undefined}
          selected={action === 'import'}
          onPress={() => onPick('import')}
        />
        <ChoiceCard
          title="Write a real workout"
          subtitle="Plain text, your shorthand — Recore reads it in the background."
          selected={action === 'write'}
          onPress={() => onPick('write')}
        />
      </View>

      <Testimonial quote={testimonial.quote} who={testimonial.who} />

      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Starts right after your trial or purchase. Nothing unlocks before that, and this choice is
        remembered through checkout.
      </Text>
    </StepFrame>
  );
}

// ————————————————————————————————————————————————————————— shared pieces

/** A step's header + a staggered body — the shared frame for every question. */
function StepFrame({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View>
      <Eyebrow tone="secondary" style={styles.kicker}>
        {eyebrow}
      </Eyebrow>
      <Text style={styles.stepTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title}
      </Text>
      {sub ? (
        <Text style={styles.stepSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {sub}
        </Text>
      ) : null}
      <View style={styles.stepBody}>
        <Stagger initialDelay={100} step={60} distance={12}>
          {children}
        </Stagger>
      </View>
    </View>
  );
}

/** Record-contract tag: mono, bordered, never celebratory. */
function Tag({ label, fixed }: { label: string; fixed?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.tag, fixed && styles.tagFixed]}>
      <Text style={styles.tagText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

/** A radio whose inner dot springs in on selection. */
function Radio({ selected }: { selected: boolean }) {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const s = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    s.value = reduce ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, spring.snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // Pure pass-through — Reanimated 4 takes the shared value inline.
  const dot = { transform: [{ scale: s }], opacity: s };
  return (
    <View style={[styles.radio, selected && styles.radioOn]}>
      <Animated.View style={[styles.radioDot, dot]} />
    </View>
  );
}

/** Radio card: title, optional subtitle, optional right-aligned mono meta. */
function OptionRow({
  title,
  subtitle,
  meta,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.option, pressed && styles.pressedFill, selected && styles.optionSelected]}>
      <Radio selected={selected} />
      <View style={styles.optionBody}>
        <Text style={styles.optionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.optionSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text style={styles.optionMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The larger selectable card on the final step. */
function ChoiceCard({
  title,
  subtitle,
  note,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, pressed && styles.pressedFill, selected && styles.choiceSelected]}>
      <View style={styles.choiceHeader}>
        <Text style={styles.choiceTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        <Radio selected={selected} />
      </View>
      <Text style={styles.choiceSub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {subtitle}
      </Text>
      {note ? (
        <Text style={styles.choiceNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A checked bullet point (how-it-works list). */
function Point({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.point}>
      <Text style={styles.pointMark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        ✓
      </Text>
      <Text style={styles.pointText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

// ————————————————————————————————————————————————————————— the live demo

const DEMO = [
  { raw: 'bench 5x5 100kg', name: 'Bench Press', value: '100 kg × 5·5·5' },
  { raw: 'wall balls 3x20', name: 'Wall Balls', value: '20 · 20 · 20' },
  { raw: 'sled push 25m x4', name: 'Sled Push', value: '25 m × 4' },
] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The signature moment: three raw lines type themselves in, each pauses to be
 * "read", then settles into a clean parsed row with a check. Loops gently.
 * reduceMotion → everything shown settled at once. */
function LedgerDemo() {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState<string[]>(['', '', '']);
  const [revealed, setRevealed] = useState<boolean[]>([false, false, false]);
  const [thinking, setThinking] = useState(-1);
  const [activeLine, setActiveLine] = useState(0);

  useEffect(() => {
    if (reduce) {
      setTyped(DEMO.map((d) => d.raw));
      setRevealed([true, true, true]);
      setActiveLine(-1);
      return;
    }
    let alive = true;
    const run = async () => {
      // reset for a fresh pass
      setTyped(['', '', '']);
      setRevealed([false, false, false]);
      setThinking(-1);
      await sleep(240);
      for (let i = 0; i < DEMO.length; i++) {
        if (!alive) return;
        setActiveLine(i);
        const raw = DEMO[i]!.raw;
        for (let c = 1; c <= raw.length; c++) {
          if (!alive) return;
          setTyped((t) => t.map((v, j) => (j === i ? raw.slice(0, c) : v)));
          await sleep(30 + Math.random() * 34);
        }
        await sleep(300);
        if (!alive) return;
        setThinking(i);
        await sleep(680);
        if (!alive) return;
        setThinking(-1);
        setRevealed((r) => r.map((v, j) => (j === i ? true : v)));
        await sleep(260);
      }
      setActiveLine(-1);
      await sleep(4200);
      if (alive) run(); // loop
    };
    run();
    return () => {
      alive = false;
    };
  }, [reduce]);

  return (
    <View style={styles.demoCard}>
      {DEMO.map((d, i) => (
        <View key={d.raw} style={[styles.demoRow, i > 0 && styles.demoRowRule]}>
          <View style={styles.demoLeft}>
            {revealed[i] ? (
              <>
                <View style={styles.demoCheck}>
                  <Text style={styles.demoCheckMark}>✓</Text>
                </View>
                <View style={styles.demoResolved}>
                  <Text style={styles.demoName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {d.name}
                  </Text>
                  <Text style={styles.demoValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {d.value}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.demoHollow} />
                <View style={styles.demoWritten}>
                  <Text style={styles.demoRaw} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {typed[i]}
                    {activeLine === i ? <DemoCursor /> : null}
                  </Text>
                  {/* The same arc the composer turns — the demo has to show the
                      product, not an approximation of it. */}
                  {thinking === i ? <ReadingArc tone="faint" /> : null}
                </View>
              </>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

function DemoCursor() {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withTiming(0.15, { duration: 520, easing: Easing.inOut(Easing.ease) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Animated.Text style={[styles.cursor, { opacity: o }]}>│</Animated.Text>;
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
    paddingHorizontal: spacing.xxl,
  },

  // chrome
  chrome: {
    height: SECONDARY_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  chromeSide: {
    width: moderateScale(58),
    justifyContent: 'center',
  },
  chromeRight: {
    alignItems: 'flex-end',
  },
  progress: {
    flex: 1,
  },
  wordmark: {
    fontSize: type.title3.fontSize,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: t.ink,
  },
  backLabel: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: t.ink,
  },
  backChevron: {
    color: t.inkMuted,
  },
  skipLabel: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: t.inkFaint,
  },
  pressedDim: {
    opacity: 0.5,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },

  // headers
  kicker: {
    marginBottom: spacing.sm,
  },
  hero: {
    ...type.display,
    color: t.ink,
    marginTop: spacing.xs,
  },
  heroSub: {
    ...type.body,
    color: t.inkMuted,
    marginTop: spacing.md,
  },
  stepTitle: {
    ...type.title1,
    color: t.ink,
  },
  stepSub: {
    ...type.callout,
    color: t.inkMuted,
    marginTop: spacing.sm,
  },
  stepBody: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  note: {
    ...type.caption,
    color: t.inkFaint,
    marginTop: spacing.sm,
  },

  // name step
  nameInput: {
    height: moderateScale(56),
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.md,
    backgroundColor: t.surface,
    paddingHorizontal: spacing.lg,
    ...type.title2,
    color: t.ink,
  },

  // analyzing step
  analyzeHead: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  analyzePercent: {
    ...type.dataXL,
    fontFamily: mono.medium,
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  analyzeBar: {
    marginTop: spacing.xs,
  },
  analyzeCard: {
    marginTop: spacing.xl,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    ...t.shadow.card,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: moderateScale(54),
    paddingVertical: spacing.md,
  },
  analyzeLabel: {
    flex: 1,
    ...type.callout,
    fontWeight: '500',
    color: t.ink,
  },
  analyzeLabelPending: {
    color: t.inkFaint,
    fontWeight: '400',
  },

  // ready step
  readyProof: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },

  // welcome specimen
  specimen: {
    marginTop: spacing.xxl,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.xxl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...t.shadow.raised,
  },
  specimenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  specimenText: {
    flex: 1,
    ...type.callout,
    color: t.ink,
  },
  specimenTextQuiet: {
    flex: 1,
    ...type.callout,
    color: t.inkMuted,
  },
  specimenMono: {
    fontFamily: mono.medium,
    fontSize: moderateScale(13),
    fontVariant: ['tabular-nums'],
    color: t.ink,
  },
  specimenPlanned: {
    fontFamily: mono.medium,
    fontSize: moderateScale(13),
    fontVariant: ['tabular-nums'],
    color: t.ember, // the only signal ink: an example planned value
  },
  specimenFooter: {
    borderTopWidth: 1,
    borderTopColor: t.rule,
    paddingTop: spacing.md,
  },
  specimenFootText: {
    ...type.caption,
    color: t.inkMuted,
  },

  // radio cards
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  optionSelected: {
    borderWidth: 1.5,
    borderColor: t.ink,
  },
  pressedFill: {
    backgroundColor: t.surfaceHigh,
  },
  radio: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.capsule,
    borderWidth: 1.5,
    borderColor: t.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: t.ink,
  },
  radioDot: {
    width: moderateScale(11),
    height: moderateScale(11),
    borderRadius: radius.capsule,
    backgroundColor: t.ink,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    ...type.title3,
    color: t.ink,
  },
  optionSub: {
    ...type.caption,
    color: t.inkMuted,
    marginTop: 2,
  },
  optionMeta: {
    fontFamily: mono.medium,
    fontSize: moderateScale(10.5),
    fontVariant: ['tabular-nums'],
    color: t.inkFaint,
  },

  // units
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: t.surfaceHigh,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: SECONDARY_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
  },
  segmentLabel: {
    ...type.title3,
    color: t.inkMuted,
  },
  segmentLabelSelected: {
    color: t.ink,
  },
  incrementCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  incrementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  incrementText: {
    flexShrink: 1,
  },
  incrementTitle: {
    ...type.title3,
    color: t.ink,
  },
  incrementSub: {
    ...type.caption,
    color: t.inkMuted,
    marginTop: 2,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepBtn: {
    width: SECONDARY_H,
    height: SECONDARY_H,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: {
    fontSize: moderateScale(19),
    color: t.ink,
  },
  stepValue: {
    fontFamily: mono.medium,
    fontSize: moderateScale(16),
    fontVariant: ['tabular-nums'],
    color: t.ink,
    minWidth: moderateScale(70),
    textAlign: 'center',
  },
  customRow: {
    marginTop: spacing.md,
    height: SECONDARY_H,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customLabel: {
    ...type.callout,
    fontWeight: '600',
    color: t.ink,
  },
  customInput: {
    marginTop: spacing.md,
    height: SECONDARY_H,
    borderWidth: 1,
    borderColor: t.ink,
    borderRadius: radius.sm,
    textAlign: 'center',
    fontFamily: mono.medium,
    fontSize: moderateScale(16),
    fontVariant: ['tabular-nums'],
    color: t.ink,
  },

  // how it works
  demoCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
  },
  demoRow: {
    minHeight: moderateScale(58),
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  demoRowRule: {
    borderTopWidth: 1,
    borderTopColor: t.rule,
  },
  demoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  demoHollow: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.capsule,
    borderWidth: 1.5,
    borderColor: t.inkFaint,
  },
  demoCheck: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: radius.capsule,
    backgroundColor: t.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoCheckMark: {
    color: t.canvas,
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  demoWritten: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  demoRaw: {
    flexShrink: 1,
    fontSize: moderateScale(16),
    color: t.ink,
  },
  demoResolved: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  demoName: {
    flexShrink: 1,
    ...type.title3,
    color: t.ink,
  },
  demoValue: {
    fontFamily: mono.medium,
    fontSize: moderateScale(13),
    color: t.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  cursor: {
    color: t.ink,
    fontWeight: '400',
  },
  pointList: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  point: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  pointMark: {
    fontSize: moderateScale(13),
    fontWeight: '700',
    color: t.ink,
    marginTop: 1,
  },
  pointText: {
    flex: 1,
    ...type.callout,
    color: t.inkMuted,
  },

  // first move
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: CHIP_RADIUS,
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.sm + 2,
  },
  chipText: {
    fontFamily: mono.medium,
    fontSize: moderateScale(10.5),
    fontVariant: ['tabular-nums'],
    color: t.inkMuted,
  },
  choices: {
    gap: spacing.md,
  },
  choice: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  choiceSelected: {
    borderWidth: 1.5,
    borderColor: t.ink,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  choiceTitle: {
    ...type.title3,
    color: t.ink,
    flexShrink: 1,
  },
  choiceSub: {
    ...type.callout,
    color: t.inkMuted,
    marginTop: spacing.xs,
  },
  choiceNote: {
    fontFamily: mono.medium,
    fontSize: moderateScale(10.5),
    color: t.inkFaint,
    marginTop: spacing.sm,
  },

  // tags
  tag: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: TAG_RADIUS,
    paddingVertical: 2,
    paddingHorizontal: 5,
  },
  tagFixed: {
    width: moderateScale(78),
    alignItems: 'center',
  },
  tagText: {
    fontFamily: mono.medium,
    fontSize: moderateScale(9),
    letterSpacing: 1.2,
    color: t.inkMuted,
  },

  // footer
  footer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  footCaption: {
    ...type.caption,
    color: t.inkFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
}));
