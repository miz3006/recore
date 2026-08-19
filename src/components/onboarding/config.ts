import {
  COMMIT_WEEKS,
  committedSessions,
  dayCount,
  daysPerWeek,
  normalizeDayMask,
  parseLiftLoads,
  parseList,
  projectedTarget,
  toPlate,
} from '@/lib/onboarding';
import { defaultWeightUnit } from '@/lib/locale';
import type { WeightUnit } from '@/lib/prefs';
import type { AnswerKey, Answers } from '@/state/onboarding';

import type { OnboardingSlug } from './illustration-layout';

/**
 * THE onboarding flow — one ordered config array, one renderer
 * (`app/onboarding/[step].tsx`). Reordering, adding or removing a screen is an
 * edit to `STEPS` and nothing else: the progress bar derives its segment count
 * from here, the store persists every answer, and the projection reads those
 * answers back.
 *
 * ## The v3 design import (owner's board, 18 August 2026)
 *
 * Fourteen screens, which is what CLAUDE.md §6 step 2 asked for all along
 * ("the fourteen-screen personalised funnel"). The twenty-one-screen build it
 * replaces is gone from the array: the building checklist, the answers summary,
 * the product-truth list, the founder note and the trial timeline are no longer
 * screens of the flow. Their components stay in the tree, unmounted, the way
 * every other rolled-back surface in this repository does — if the owner wants
 * one back it is a line in this array, not a rebuild.
 *
 * What the design changed, screen for screen:
 *
 *  · The welcome leads with the promise and carries a Sign in link for anyone
 *    who already has an account.
 *  · The current tracker moved to SECOND, before anything is explained: it is
 *    the one answer that decides what the whole flow is competing with.
 *  · A new OBSTACLES screen (multi-select) — the person names the friction, and
 *    the demo two screens later lands as the answer to what they just said.
 *  · Goal, experience and the recap question carry an emoji and a second line
 *    (product-direction §12: "Emoji may appear sparingly as an onboarding
 *    choice label when they improve scanning").
 *  · Name and gender share ONE screen; days and plan-style share another. Two
 *    weak screens became two halves of a strong one.
 *  · The priority movement became KEY LIFTS: up to three, with the load they
 *    work with now — the only numeric input left in the flow, and the input the
 *    last screen is built out of.
 *  · Commitment is a HOLD, not a tap, against a count of sessions computed from
 *    the person's own week.
 *  · The flow ends on a PROJECTION rather than a receipt.
 *
 * Rest length and bodyweight are no longer asked. Their answer keys stay in the
 * store and their writers stay in `completeFlow`, so the app keeps its defaults
 * and putting either screen back costs one entry here.
 *
 * Illustrations are NOT referenced here: every screen renders
 * `<IllustrationSlot slug={step.slug} />` and assets land in `illustrations.ts`
 * by slug.
 *
 * This file lives in `components/onboarding/`, NOT in `app/onboarding/`,
 * because expo-router registers EVERY file under app/ as a route (only
 * `_layout` is special): a config file there would become a phantom route.
 */

export type StepOption = {
  id: string;
  label: string;
  /** The quiet second line under the label. */
  detail?: string;
  /**
   * A leading glyph. Sanctioned by product-direction §12 — "Emoji may appear
   * sparingly as an onboarding choice label when they improve scanning" — and
   * used on the three screens the design draws them on, never anywhere else in
   * the app.
   */
  emoji?: string;
};

export type StepKind =
  /** The welcome: no progress bar, no back, its own centred register. */
  | 'intro'
  /** 2–5 radio options + Continue. */
  | 'choice'
  /** 2–5 checkbox options + Continue. */
  | 'multi'
  /** The parse demo — the one screen that shows instead of telling. */
  | 'demo'
  /** Paragraphs of copy + Continue. */
  | 'essay'
  /** Name field and gender, one page. */
  | 'about-you'
  /** Day circles, the week they add up to, and how it is followed. */
  | 'days'
  /** Key-lift chips and a starting load for each. */
  | 'lifts'
  /** The overload lesson and its last-week / this-week card. */
  | 'overload'
  /** The session count and the hold that commits to it. */
  | 'commitment'
  /** The recap question, over a preview of the notification itself. */
  | 'recap'
  /** The projected lifts — the flow's last screen. */
  | 'projection';

export type Step = {
  /**
   * Stable identifier; also the illustration-registry key. Typed against the
   * manifest's slug list (`illustration-layout.ts`) so a screen added here
   * without an illustration entry is a compile error, not a blank band.
   */
  slug: OnboardingSlug;
  kind: StepKind;
  /** The question, top-aligned. A function when an answer personalises it. */
  headline: string | ((answers: Answers) => string);
  /**
   * A quiet mono section label above the headline. `tone: 'accent'` draws it in
   * Recore blue, which the design reserves for the three screens that hand
   * something back rather than ask for something.
   */
  eyebrow?: string;
  eyebrowTone?: 'muted' | 'accent';
  /** A sentence-case line above the headline — the welcome only. */
  kicker?: string;
  /** One or two muted lines under the headline. */
  subtext?: string | ((answers: Answers) => string);
  /** Paragraphs in the content band — the two lesson screens. */
  body?: readonly string[];
  /** A last quiet line under the content band. */
  footnote?: string;
  options?: readonly StepOption[];
  storeKey?: AnswerKey;
  /** A second, labelled question on the same page (about-you, days). */
  secondary?: {
    label: string;
    options: readonly StepOption[];
    storeKey: AnswerKey;
  };
  /** Small caps label over the primary control. */
  sectionLabel?: string;
  /** Placeholder for the one text field left in the flow. */
  placeholder?: string;
  /** The key-lift chips. */
  suggestions?: readonly string[];
  /** How many of them may be chosen. */
  maxChoices?: number;
  /** CTA label (default 'Continue'). */
  cta?: string;
};

/**
 * The lifts the key-lift screen offers, in the design's own order. Every name
 * is one the parser's canon resolves (`findExerciseByName`), so a pinned lift
 * connects to real history the moment it exists.
 */
const KEY_LIFTS = [
  'Bench press',
  'Squat',
  'Deadlift',
  'Overhead press',
  'Pull-ups',
  'Barbell row',
] as const;

export const MAX_KEY_LIFTS = 3;

export const STEPS: readonly Step[] = [
  {
    slug: 'welcome',
    kind: 'intro',
    kicker: 'Thanks for downloading',
    headline: "Write your training the way you'd say it.",
    subtext: 'Recore reads it, tracks every set, and shows the progress you earn.',
    cta: 'Get started',
  },
  {
    // FIRST question of the flow, before a word of explanation. What someone
    // is switching from is the one answer that changes what every screen after
    // it has to argue against — and it is the §2.1 import fast path's input.
    slug: 'tracker',
    kind: 'choice',
    headline: 'Where do you track today?',
    subtext: 'So Recore knows what you are switching from.',
    options: [
      { id: 'strong', label: 'Strong' },
      { id: 'hevy', label: 'Hevy' },
      { id: 'notes', label: 'Notes or paper' },
      { id: 'sheet', label: 'A spreadsheet' },
      { id: 'none', label: 'Nowhere yet' },
    ],
    storeKey: 'tracker',
  },
  {
    // The person names the friction in their own words before the demo claims
    // to fix it. Nothing here is a promise: every option is a thing the app
    // already does something about.
    slug: 'obstacles',
    kind: 'multi',
    headline: 'What stops you from tracking?',
    subtext: 'This decides what Recore fixes first.',
    options: [
      { id: 'slow', label: 'The grid is too slow between sets' },
      { id: 'forget', label: 'I forget to log it' },
      { id: 'shapes', label: "Supersets and dropsets don't fit" },
      { id: 'target', label: 'I never know what to beat' },
      { id: 'none', label: "Nothing — I'm just starting" },
    ],
    storeKey: 'obstacles',
  },
  {
    // The example is the exact shape `parse-eval-cases.json` covers ("rep list
    // commas after weight"), so the screen shows a line the parser genuinely
    // reads — a demo of a syntax that did not work would be the worst possible
    // first impression.
    //
    // The design's line reads "hold the mic"; the toolbar's mic is a TAP
    // toggle (`bottom-toolbar.tsx`), so the copy says tap. A screen that
    // teaches a gesture the app does not have is worse than one that says
    // nothing.
    slug: 'demo',
    kind: 'demo',
    headline: "Write it like you'd say it",
    subtext: 'Tap the line. Or tap the mic in the app and say it out loud.',
    cta: "That's the whole app",
  },
  {
    slug: 'why-written',
    kind: 'essay',
    headline: 'What gets written gets stronger.',
    body: [
      "You can't add weight to a number you can't remember. A written session turns last week's load into a fact instead of a guess.",
      "Most people don't quit logging because of discipline. They quit because of the tapping — exercise, sets, reps, weight, one field at a time.",
      'Recore takes a sentence instead.',
    ],
    cta: 'Makes sense',
  },
  {
    // Option ids ARE the `Goal` union (`lib/onboarding.ts`), so the answer
    // reaches the prediction engine's fallback range without a translation
    // table. 'sport' wears the label "Hybrid" because that is what the design
    // calls it and what the people choosing it call it.
    slug: 'goal',
    kind: 'choice',
    headline: "What's your main goal?",
    subtext: 'This decides how Recore adds weight for you.',
    options: [
      {
        id: 'strength',
        emoji: '\u{1F3CB}\u{FE0F}',
        label: 'Strength',
        detail: 'heavier lifts, bigger jumps',
      },
      { id: 'muscle', emoji: '\u{1F4AA}', label: 'Muscle', detail: 'more volume, steadier loads' },
      {
        id: 'both',
        emoji: '\u{2696}\u{FE0F}',
        label: 'Both, in that order',
        detail: 'strength first, size follows',
      },
      {
        id: 'sport',
        emoji: '\u{1F3C3}',
        label: 'Hybrid',
        detail: 'lifting plus running or Hyrox',
      },
    ],
    storeKey: 'goal',
  },
  {
    // Time only, never consistency — it sets the LEVEL OF EXPLANATION and the
    // rate the projection uses, and §5 forbids reading it as flattery or as a
    // different prescription.
    slug: 'experience',
    kind: 'choice',
    headline: 'How long have you been lifting?',
    subtext: 'This sets how fast Recore adds weight.',
    options: [
      { id: 'new', label: 'Under a year', detail: 'still learning the lifts' },
      { id: 'building', label: '1–3 years', detail: 'the numbers still move most months' },
      { id: 'experienced', label: '3+ years', detail: 'progress is slower and earned' },
    ],
    storeKey: 'experience',
  },
  {
    slug: 'about-you',
    kind: 'about-you',
    headline: 'A couple of details',
    subtext: 'Used for your weekly recap and for your starting numbers.',
    sectionLabel: 'YOUR NAME',
    placeholder: 'First name',
    storeKey: 'name',
    secondary: {
      label: 'YOU ARE',
      // §5: illustration variants and wording only. Never a different number,
      // never a different prescription.
      options: [
        { id: 'female', label: 'Female' },
        { id: 'male', label: 'Male' },
        { id: 'other', label: 'Prefer not to say' },
      ],
      storeKey: 'gender',
    },
  },
  {
    slug: 'days',
    kind: 'days',
    headline: 'When do you train?',
    subtext: 'Be honest — this sets your weekly target, not your ambition.',
    storeKey: 'trainingDays',
    secondary: {
      label: 'HOW YOU FOLLOW IT',
      options: [
        { id: 'structured', label: 'I follow a fixed plan' },
        { id: 'flexible', label: 'I decide on the day' },
      ],
      storeKey: 'sessionFeel',
    },
  },
  {
    slug: 'key-lifts',
    kind: 'lifts',
    headline: 'Which lifts matter most?',
    subtext: `Choose up to ${MAX_KEY_LIFTS}. Recore watches these closest.`,
    suggestions: KEY_LIFTS,
    maxChoices: MAX_KEY_LIFTS,
    sectionLabel: 'WHAT YOU WORK WITH NOW',
    footnote: "Roughly what you work with now. Skip if you're not sure.",
    storeKey: 'keyLifts',
  },
  {
    slug: 'overload',
    kind: 'overload',
    eyebrow: 'WHY WE ASKED',
    eyebrowTone: 'accent',
    headline: 'Strength is gradual overload.',
    body: [
      "Adding 2.5 kg to a lift you've done for weeks doesn't feel like progress. Over a year it is the whole difference.",
      "The hard part isn't effort — it's knowing what you did last time.",
    ],
    footnote: 'Recore names the smallest jump that still counts.',
    cta: 'Makes sense',
  },
  {
    slug: 'commitment',
    kind: 'commitment',
    eyebrow: 'YOUR COMMITMENT',
    eyebrowTone: 'accent',
    headline: (answers) =>
      `${COMMIT_WEEKS} weeks. ${daysPerWeek(normalizeDayMask(answers.trainingDays))} days a week.`,
    /**
     * The design's paragraph opened "Most people who log the first four
     * sessions are still logging in month three." That is a retention
     * statistic about other people with nothing behind it, which CLAUDE.md §2
     * rule 2 and §3 both forbid on a store-facing screen. The line below says
     * the same thing about THIS person's own record, which is checkable.
     */
    body: [
      'Four written sessions is the point where the record starts answering questions instead of collecting them.',
      'Hold the button and it stops being an intention.',
    ],
    cta: 'Hold to commit',
    storeKey: 'commitment',
  },
  {
    slug: 'recap',
    kind: 'recap',
    headline: 'Want a recap every Sunday?',
    // §5.1: no permission prompt belongs in onboarding. This answer is INTENT;
    // the OS prompt happens when the first recap actually exists (§12.1).
    subtext: 'One short read on what moved and what stalled. Nothing daily.',
    options: [
      {
        id: 'yes',
        emoji: '\u{1F4EC}',
        label: 'Yes, send it',
        detail: 'one message a week, nothing else',
      },
      {
        id: 'no',
        emoji: '\u{1F515}',
        label: 'Not now',
        detail: 'you can turn it on any time',
      },
    ],
    storeKey: 'notifications',
  },
  {
    slug: 'projection',
    kind: 'projection',
    eyebrow: 'YOUR PROJECTION',
    eyebrowTone: 'accent',
    headline: (answers) => {
      const name = answers.name?.trim();
      return name
        ? `${name} — your next ${COMMIT_WEEKS} weeks`
        : `Your next ${COMMIT_WEEKS} weeks`;
    },
    subtext: (answers) => projectionSummary(answers),
    footnote: 'An estimate from your answers, not a promise.',
    cta: 'See my plan',
  },
] as const;

/**
 * Segment count of the progress bar: one per onboarding screen, excluding the
 * welcome and the paywall (the paywall is not in `STEPS`). Derived, never
 * hardcoded — adding or removing a screen updates the bar by itself.
 */
export const PROGRESS_TOTAL = STEPS.filter((s) => s.kind !== 'intro').length;

/**
 * Segments filled while viewing `stepNumber` (1-based): every non-intro screen
 * up to AND INCLUDING the one on screen.
 *
 * The screen being answered counts as ground covered, which is what the design
 * board draws — its first question already shows a sliver of blue, and its last
 * screen fills the bar. Excluding the current step (as this did until the v3
 * import) left the flow's final screen one segment short of full, which reads
 * as an unfinished job on the page that hands over to the paywall.
 */
export function progressFilled(stepNumber: number): number {
  return STEPS.slice(0, stepNumber).filter((s) => s.kind !== 'intro').length;
}

/** A step's headline, resolved against the current answers. */
export function stepHeadline(step: Step, answers: Answers): string {
  return typeof step.headline === 'function' ? step.headline(answers) : step.headline;
}

/** A step's subtext, resolved the same way. */
export function stepSubtext(step: Step, answers: Answers): string | undefined {
  return typeof step.subtext === 'function' ? step.subtext(answers) : step.subtext;
}

/** One resolution for the display unit — the lift steppers, the projection and
 * completion must never disagree about it. Unset derives from the locale. */
export function resolveWeightUnit(answers: Answers): WeightUnit {
  return answers.weightUnit === 'lb' || answers.weightUnit === 'kg'
    ? answers.weightUnit
    : defaultWeightUnit();
}

/** The label the person actually tapped — used by the projection's own line. */
function optionLabel(slug: OnboardingSlug, id: string | null): string | null {
  if (!id) return null;
  const step = STEPS.find((s) => s.slug === slug);
  return step?.options?.find((o) => o.id === id)?.label ?? null;
}

/**
 * The projection screen's one-line context — "Muscle · 4 days a week · 1–3
 * years lifting". Every part is an answer read back verbatim, and a part with
 * no answer is dropped rather than filled in.
 */
export function projectionSummary(answers: Answers): string {
  const parts: string[] = [];

  const goal = optionLabel('goal', answers.goal);
  if (goal) parts.push(goal);

  const mask = normalizeDayMask(answers.trainingDays);
  if (dayCount(mask) > 0) parts.push(`${dayCount(mask)} days a week`);

  const experience = optionLabel('experience', answers.experience);
  if (experience) parts.push(`${experience} lifting`);

  return parts.join(' · ');
}

/** The commitment screen's number: sessions between now and the horizon. */
export function commitmentCount(answers: Answers): number {
  return committedSessions(normalizeDayMask(answers.trainingDays));
}

/**
 * One projected lift: what they lift now, what the horizon could hold, and the
 * difference between the two. Nothing here is stored, shown as history, or
 * read by any other surface — see `projectedTarget`.
 */
export type LiftProjection = {
  lift: string;
  start: number;
  target: number;
  gain: number;
  unit: WeightUnit;
};

/**
 * The projections the last screen draws, in the order the lifts were chosen. A
 * lift with no load typed is SKIPPED rather than guessed: an invented starting
 * number would make the whole screen a fiction, and the empty case has its own
 * honest copy in the renderer.
 */
export function liftProjections(answers: Answers): LiftProjection[] {
  const unit = resolveWeightUnit(answers);
  const loads = parseLiftLoads(answers.liftLoads);
  const experience =
    answers.experience === 'new' ||
    answers.experience === 'building' ||
    answers.experience === 'experienced'
      ? answers.experience
      : null;

  const out: LiftProjection[] = [];
  for (const lift of parseList(answers.keyLifts)) {
    const start = loads[lift];
    if (!Number.isFinite(start) || !start || start <= 0) continue;
    const target = projectedTarget(start, experience, unit);
    out.push({ lift, start, target, gain: toPlate(target - start, unit), unit });
  }
  return out;
}
