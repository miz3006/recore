import { dayCount, daysLabel, normalizeDayMask } from '@/lib/onboarding';
import { defaultWeightUnit } from '@/lib/locale';
import type { WeightUnit } from '@/lib/prefs';
import type { AnswerKey, Answers } from '@/state/onboarding';

/**
 * THE onboarding flow — one ordered config array, one renderer
 * (`app/onboarding/[step].tsx`). Reordering, adding or removing a screen is an
 * edit to `STEPS` and nothing else: the progress bar derives its segment count
 * from here, the store persists every answer, and the summary + paywall read
 * those answers back.
 *
 * This is the 21-screen rebuild (owner's spec, 11 Aug 2026). Twenty screens
 * live in this config; the paywall is screen 21 and stays its own route —
 * completion hands to the dispatcher, which routes a fresh user there. The
 * progress bar excludes the welcome and the paywall by the owner's rule, which
 * the `kind !== 'intro'` filter encodes.
 *
 * Illustrations are NOT referenced here: every screen renders
 * `<IllustrationSlot slug={step.slug} />` and assets land in
 * `illustrations.ts` by slug. The old full-bleed illustration fields are gone
 * with the layout they served.
 *
 * This file lives in `components/onboarding/`, NOT in `app/onboarding/`,
 * because expo-router registers EVERY file under app/ as a route (only
 * `_layout` is special): a config file there would become a phantom route.
 */

export type StepOption = {
  id: string;
  label: string;
};

export type Step = {
  /** Stable identifier; also the illustration-registry key. */
  slug: string;
  /**
   * 'intro' — the welcome (no progress bar, no back, custom CTA).
   * 'question' — 2–4 radio options; answering advances after a short beat.
   * 'text' — optional single-line answer + Continue (empty = skip).
   * 'explainer' — copy + illustration + Continue.
   * 'days' — the seven-circle multi-select day picker + Continue.
   * 'weight' — typed bodyweight + kg/lb toggle + Continue.
   * 'building' — the processing checklist; advances itself, no controls.
   * 'summary' — answers echoed verbatim as bullets + Continue.
   * 'proof' — the product-truth lines + Continue.
   * 'timeline' — the trial timeline + Continue.
   * 'founder' — the personal note + Continue (behind `FOUNDER_NOTE_ENABLED`).
   */
  kind:
    | 'intro'
    | 'question'
    | 'text'
    | 'explainer'
    | 'days'
    | 'weight'
    | 'building'
    | 'summary'
    | 'proof'
    | 'timeline'
    | 'founder';
  /** The question, top-aligned. A function when an answer personalises it. */
  headline: string | ((answers: Answers) => string);
  /** A quiet mono section label above the headline ("ABOUT YOU") — the
   * archival eyebrow voice, giving the flow structure without a counter
   * (Evernote's GET STARTED / NEARLY THERE pattern on Mobbin). */
  eyebrow?: string;
  /** One muted line under the headline. */
  subtext?: string;
  /** 2–4 radio options; question steps only. */
  options?: StepOption[];
  storeKey?: AnswerKey;
  /** Placeholder for 'text' steps. */
  placeholder?: string;
  /** Quick-pick chips under a 'text' field — tapping one answers and
   * advances; the field stays for anything not on the list. */
  suggestions?: string[];
  /** question steps: option id → the line shown briefly under the options
   * after that answer, before the flow advances. */
  affirm?: Record<string, string>;
  /** CTA label where a button advances (default 'Continue'). */
  cta?: string;
};

/**
 * Shown after a commitment answer. Both long horizons get the same line, as
 * they always have.
 *
 * The three-month line used to read "Three months is where most lifters see
 * their first real PRs." That is an invented statistic about other people's
 * training, which CLAUDE.md §2 rule 2 and §3 both forbid, and it was the kind
 * of confident unsourced number that makes a flow read as machine-written.
 * These say something about the person's own answer instead, or nothing much
 * at all — which is what a person actually says here.
 */
const COMMITMENT_AFFIRM: Record<string, string> = {
  '2w': 'Fair enough. Start there.',
  '3m': 'Long enough to stop guessing.',
  '1y': 'Then the charts will have something to say.',
  forever: 'Then the charts will have something to say.',
};

/**
 * The founder note, added by the 12 Aug restyle — a personal screen between the
 * product truths and the trial explanation. Flag it off and the flow is exactly
 * the twenty screens it was; the progress bar, the resume position and the
 * funnel's step count all follow the array, so nothing else has to change.
 */
export const FOUNDER_NOTE_ENABLED = true;

const FOUNDER_STEP: Step = {
  slug: 'founder-note',
  eyebrow: 'FROM THE MAKER',
  kind: 'founder',
  headline: 'A note from Edis',
  cta: 'Sounds good',
};

/**
 * PLACEHOLDER COPY — the owner's own words go here before release.
 *
 * TODO(owner): replace these three paragraphs. They are written in the first
 * person and signed with a real name, so shipping them as they stand would put
 * invented words in a real person's mouth on a store-facing screen. They claim
 * nothing about ratings, reviews or user numbers, and their replacement must
 * not either (CLAUDE.md §3).
 */
export const FOUNDER_NOTE: readonly string[] = [
  'I built this because I kept quitting other trackers. Logging a set took longer than doing the set.',
  'So Recore is one text field. Write the session however you write it, and you get something you can still read a year from now.',
  'It is early and I read everything that comes in. If it gets something wrong, tell me.',
];

/** Who signs the note. Kept beside the copy it belongs to. */
export const FOUNDER_SIGNATURE = { name: 'Edis', role: 'Developer' } as const;

const BASE_STEPS: readonly Step[] = [
  {
    slug: 'welcome',
    kind: 'intro',
    headline: 'Every session, in your own words',
    subtext: 'Type what you did the way you would say it. Recore does the filing.',
    cta: 'Start',
  },
  {
    // The example is the exact shape `parse-eval-cases.json` covers ("rep list
    // commas after weight"), so the screen shows a line the parser genuinely
    // reads — a demo of a syntax that did not work would be the worst possible
    // first impression.
    slug: 'demo',
    eyebrow: 'HOW IT WORKS',
    kind: 'explainer',
    headline: 'You type "bench 100kg 5,5,4"',
    subtext:
      'Recore reads three sets of Bench Press at 100 kg, and keeps the drop to four on the last one. There is no dropdown to open.',
    cta: 'Got it',
  },
  {
    slug: 'name',
    eyebrow: 'ABOUT YOU',
    kind: 'text',
    headline: "What's your name?",
    subtext: 'Skip it if you would rather not.',
    placeholder: 'First name',
    storeKey: 'name',
  },
  {
    slug: 'gender',
    eyebrow: 'ABOUT YOU',
    kind: 'question',
    headline: "What's your gender?",
    subtext: 'Wording and drawings only.',
    options: [
      { id: 'female', label: 'Female' },
      { id: 'male', label: 'Male' },
      { id: 'other', label: 'Prefer not to say' },
    ],
    storeKey: 'gender',
  },
  {
    slug: 'goal',
    eyebrow: 'TRAINING',
    kind: 'question',
    headline: 'What are you training for?',
    options: [
      { id: 'strength', label: 'Get stronger' },
      { id: 'muscle', label: 'Build muscle' },
      { id: 'fitness', label: 'General fitness' },
      { id: 'both', label: 'Strength and muscle' },
    ],
    storeKey: 'goal',
  },
  {
    slug: 'experience',
    eyebrow: 'TRAINING',
    kind: 'question',
    headline: 'How long have you been lifting?',
    options: [
      { id: 'new', label: 'Just started' },
      { id: 'building', label: 'On and off' },
      { id: 'experienced', label: 'A few years now' },
    ],
    storeKey: 'experience',
  },
  {
    slug: 'tracker',
    eyebrow: 'RIGHT NOW',
    kind: 'question',
    headline: 'What are you using now?',
    subtext: 'A Strong or Hevy export can come across after you sign in.',
    options: [
      { id: 'strong', label: 'Strong' },
      { id: 'hevy', label: 'Hevy' },
      { id: 'notes', label: 'Notes app or paper' },
      { id: 'none', label: 'Nothing yet' },
    ],
    storeKey: 'tracker',
  },
  {
    // This screen used to assert "Lifters who keep a record progress faster",
    // which is a behavioural claim with nothing behind it (§2 rule 2). It now
    // says something about memory, which is checkable by anyone reading it.
    slug: 'why-tracking',
    eyebrow: 'WHY',
    kind: 'explainer',
    headline: "You won't remember what you lifted",
    subtext:
      "Last Tuesday's top set is gone by Thursday. Written down, it is there when you need to beat it.",
  },
  {
    slug: 'style',
    eyebrow: 'TRAINING',
    kind: 'question',
    headline: 'How do you like to train?',
    subtext: 'Sets the examples you see. You are never locked into a plan.',
    options: [
      { id: 'structured', label: 'To a plan' },
      { id: 'flexible', label: 'By feel' },
      { id: 'hybrid', label: 'Bit of both' },
    ],
    storeKey: 'sessionFeel',
  },
  {
    slug: 'days',
    eyebrow: 'TRAINING',
    kind: 'days',
    headline: 'Which days do you usually train?',
    subtext: 'Roughly is fine. Nothing here counts a missed day.',
    storeKey: 'trainingDays',
  },
  {
    slug: 'key-lift',
    eyebrow: 'TRAINING',
    kind: 'text',
    headline: 'Which lift do you care about most?',
    subtext: 'It goes to the top of your Lifts, or skip this one.',
    placeholder: 'Or type another',
    // Names the parser's canon resolves (`findExerciseByName`), so the pinned
    // lift connects to real history the moment it exists.
    suggestions: ['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Pull-ups', 'Row'],
    storeKey: 'primaryLift',
  },
  {
    slug: 'rest-timer',
    eyebrow: 'DEFAULTS',
    kind: 'question',
    headline: 'How long do you rest between sets?',
    subtext: 'Where the timer starts. Change it mid-session whenever.',
    options: [
      { id: '60', label: 'A minute' },
      { id: '90', label: '90 seconds' },
      { id: '120', label: 'Two minutes' },
      { id: '180', label: 'Three or more' },
    ],
    storeKey: 'restSeconds',
  },
  {
    slug: 'bodyweight',
    eyebrow: 'ABOUT YOU',
    kind: 'weight',
    headline: 'How much do you weigh?',
    // §5: optional, and it says what it is for. Never a calorie target, a body
    // score or a health judgement — "and nothing else" is that promise.
    subtext: 'For bodyweight-relative numbers, nothing else. Blank is fine.',
    storeKey: 'bodyweight',
  },
  {
    // No unit in the headline: a lb user reading "one more kilo" would be
    // reading someone else's app.
    slug: 'overload',
    eyebrow: 'WHY',
    kind: 'explainer',
    headline: (answers) =>
      answers.goal === 'strength'
        ? 'A little heavier than last time'
        : answers.goal === 'muscle'
          ? 'One more rep than last time'
          : 'A little more than last time',
    subtext:
      'That is the whole trick. The hard part is remembering what last time was, and Recore has it on screen before you start.',
    cta: 'Got it',
  },
  {
    slug: 'commitment',
    eyebrow: 'ONE MORE',
    kind: 'question',
    headline: 'How long are you giving this?',
    subtext: 'No wrong answer.',
    options: [
      { id: '2w', label: 'Two weeks' },
      { id: '3m', label: 'Three months' },
      { id: '1y', label: 'A year' },
      { id: 'forever', label: 'For good' },
    ],
    affirm: COMMITMENT_AFFIRM,
    storeKey: 'commitment',
  },
  {
    // The two labels read as STATES, because the renderer shows one of them
    // beside a switch rather than both as rows.
    slug: 'notifications',
    eyebrow: 'DEFAULTS',
    kind: 'question',
    headline: 'A recap once a week?',
    // §5.1: no permission prompt belongs in onboarding, and this line is the
    // promise that keeps it.
    subtext: 'No permission prompt yet. That comes when there is a first recap to send.',
    options: [
      { id: 'yes', label: 'Yes, send it' },
      { id: 'no', label: 'No, thanks' },
    ],
    storeKey: 'notifications',
  },
  {
    slug: 'building',
    eyebrow: 'SETTING UP',
    kind: 'building',
    headline: 'Setting your defaults',
  },
  {
    slug: 'summary',
    eyebrow: 'DONE',
    kind: 'summary',
    headline: (answers) => {
      const name = answers.name?.trim();
      return name ? `That's you set up, ${name}` : "That's you set up";
    },
    subtext: 'All of it is editable later, in You.',
  },
  {
    // "Why lifters switch to Recore" implied other people were switching, with
    // nothing behind it. The lines below are product truths and the headline
    // now says only that (§3: no fabricated social proof, anywhere).
    slug: 'social-proof',
    eyebrow: 'WHY RECORE',
    kind: 'proof',
    headline: 'The short version',
  },
  {
    slug: 'trial-timeline',
    eyebrow: 'YOUR TRIAL',
    kind: 'timeline',
    headline: 'How the free trial works',
  },
] as const;

/**
 * THE flow. The founder note is spliced in after the product truths when its
 * flag is on; everything downstream — the progress total, the resume position,
 * the funnel's step count — derives from this array, so the flag is the only
 * thing that has to be flipped.
 */
export const STEPS: readonly Step[] = BASE_STEPS.flatMap((step) =>
  FOUNDER_NOTE_ENABLED && step.slug === 'social-proof' ? [step, FOUNDER_STEP] : [step],
);

/**
 * Segment count of the progress bar: one per onboarding screen, excluding the
 * welcome and the paywall (the paywall is not in `STEPS`). Derived, never
 * hardcoded — adding or removing a screen updates the bar by itself.
 */
export const PROGRESS_TOTAL = STEPS.filter((s) => s.kind !== 'intro').length;

/** Segments filled while viewing `stepNumber` (1-based): every non-intro
 * screen already left behind. The last config screen fills the bar. */
export function progressFilled(stepNumber: number): number {
  return STEPS.slice(0, stepNumber - 1).filter((s) => s.kind !== 'intro').length;
}

/** A step's headline, resolved against the current answers. */
export function stepHeadline(step: Step, answers: Answers): string {
  return typeof step.headline === 'function' ? step.headline(answers) : step.headline;
}

/** One resolution for the display unit — the weight step, the summary and
 * completion must never disagree about it. Unset derives from the locale. */
export function resolveWeightUnit(answers: Answers): WeightUnit {
  return answers.weightUnit === 'lb' || answers.weightUnit === 'kg'
    ? answers.weightUnit
    : defaultWeightUnit();
}

/** The label the person actually tapped, for the verbatim summary rules. */
function optionLabel(slug: string, id: string | null): string | null {
  if (!id) return null;
  const step = STEPS.find((s) => s.slug === slug);
  return step?.options?.find((o) => o.id === id)?.label ?? null;
}

/** Rest option id → the clock the toolbar timer will actually show. */
const REST_CLOCK: Record<string, string> = {
  '60': '1:00',
  '90': '1:30',
  '120': '2:00',
  '180': '3:00',
};

const TRACKER_NAMES: Record<string, string> = { strong: 'Strong', hevy: 'Hevy' };

/**
 * The building screen's checklist — every line is generated from an answer the
 * person actually gave; an unanswered question earns silence, not a filler
 * row. The fallback line covers the (theoretical) fully-skipped run so the
 * screen never animates an empty list.
 */
export function buildingLines(answers: Answers): string[] {
  const lines: string[] = [];

  const goal = answers.goal;
  if (goal === 'strength') lines.push('Training for strength');
  else if (goal === 'muscle') lines.push('Training for muscle');
  else if (goal === 'fitness') lines.push('Training for general fitness');
  else if (goal === 'both') lines.push('Training for strength and muscle');

  const lift = answers.primaryLift?.trim();
  if (lift) lines.push(`${lift[0]!.toUpperCase()}${lift.slice(1)} pinned to the top`);

  const rest = REST_CLOCK[answers.restSeconds ?? ''];
  if (rest) lines.push(`Rest timer starts at ${rest}`);

  const mask = normalizeDayMask(answers.trainingDays);
  if (mask > 0) lines.push(`Week set to ${daysLabel(mask)}`);

  const tracker = TRACKER_NAMES[answers.tracker ?? ''];
  if (tracker) lines.push(`${tracker} import ready`);

  return lines.length > 0 ? lines : ['Defaults set'];
}

/**
 * The summary bullets — built VERBATIM from stored answers. Every line
 * contains the person's own answer; nothing generic, and an unanswered
 * question earns silence.
 */
export function summaryLines(answers: Answers): string[] {
  const lines: string[] = [];

  const goal = optionLabel('goal', answers.goal);
  if (goal) lines.push(`Goal: ${goal}.`);

  const lift = answers.primaryLift?.trim();
  if (lift) {
    lines.push(`${lift[0]!.toUpperCase()}${lift.slice(1)} sits at the top of your Lifts.`);
  }

  const rest = REST_CLOCK[answers.restSeconds ?? ''];
  if (rest) lines.push(`Rest timer starts at ${rest}.`);

  const mask = normalizeDayMask(answers.trainingDays);
  if (mask > 0) {
    const n = dayCount(mask);
    lines.push(`A ${n}-day week: ${daysLabel(mask)}.`);
  }

  // "comes with you after sign-up" promised an automatic import. It is offered
  // once, after sign-in, and it can be declined (`import-start.tsx`).
  const tracker = TRACKER_NAMES[answers.tracker ?? ''];
  if (tracker) lines.push(`Your ${tracker} history can come across once you sign in.`);

  return lines;
}

/**
 * Product truths, not reviews — there are no real reviews yet and inventing
 * one is an App Store violation and a CLAUDE.md §3 release blocker.
 */
// TODO: replace with real App Store reviews post-launch
export const PROOF_LINES: readonly string[] = [
  'One text field instead of a form.',
  'Your own words are kept, not just the numbers pulled out of them.',
  'Charts that answer one question: is this lift moving?',
];

/** The trial timeline nodes (owner's copy). The paywall itself keeps stating
 * the store's own trial and price — this screen explains the shape of it.
 * `glyph` picks the node mark (Brilliant / Centr's icon-node pattern on
 * Mobbin): 'start' = solid ink disc with a paper check (it begins now),
 * 'bell' = the reminder, 'card' = the charge. */
export const TRIAL_TIMELINE: readonly {
  title: string;
  body: string;
  glyph: 'start' | 'bell' | 'card';
}[] = [
  { title: 'Today', body: 'Everything is unlocked.', glyph: 'start' },
  // "We remind you" read like an email. The reminder is a sheet on the first
  // open inside the window (`trial-reminder-sheet.tsx`), which is what the
  // paywall's own timeline says too — one mechanism, described one way.
  { title: 'Day 5', body: 'Recore reminds you, in the app.', glyph: 'bell' },
  { title: 'Day 7', body: 'Billing starts unless you cancel before then.', glyph: 'card' },
];
