import { inWrittenUnit, parseDemoEntry, type DemoEntry } from '@/lib/demo-parse';
import { projectionHeadline, recapSubtext, whyWrittenBody } from '@/lib/onboarding-copy';
import {
  COMMIT_WEEKS,
  committedSessions,
  dayCount,
  daysPerWeek,
  loadStep,
  normalizeDayMask,
  parseLiftLoads,
  parseList,
  projectedTarget,
  projectionRate,
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
 *  · Goal and experience carry an emoji and a second line (product-direction
 *    §12: "Emoji may appear sparingly as an onboarding choice label when they
 *    improve scanning"). Only those two — see `StepOption.emoji`.
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
   * sparingly as an onboarding choice label when they improve scanning".
   *
   * TWO SCREENS CARRY ONE, AND NO OTHERS (owner, 23 Aug 2026): **goal** and
   * **experience**. The 20 Aug ruling put a glyph on every option of every
   * screen that asks something, and on a device that is what "sparingly" stops
   * meaning: eight screens of pictograms in a row, where a spreadsheet, a
   * snail and a padlock are each standing in for a word that was already
   * written next to them.
   *
   * The two that stay are the two where the glyph does the job the §12 clause
   * names — SCANNING. Goal and experience are the flow's ladders (strength →
   * muscle → both → hybrid; under a year → 1–3 → 3+), the answers people
   * arrive already knowing, and a glyph per rung is how the eye finds its own
   * rung without reading four labels. Everywhere else — what you track today,
   * what stops you, your gender, how you follow a week, where you found us,
   * whether you want a Sunday message — the label IS the answer and a picture
   * beside it is decoration.
   *
   * Still nowhere the app REPORTS: not on the lesson screens, not on the day
   * cells or the load steppers, not on the commitment, the projection or the
   * paywall. That half of the rule is unchanged.
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
  /**
   * Paragraphs in the content band — the two lesson screens. A FUNCTION when an
   * earlier answer changes one of them: the "what gets written" essay opens on
   * the tracker the person actually uses (`lib/onboarding-copy.ts`).
   */
  body?: readonly string[] | ((answers: Answers) => readonly string[]);
  /** A last quiet line under the content band. */
  footnote?: string;
  options?: readonly StepOption[];
  /**
   * How a `choice` screen draws its answers. `rows` is the flow's own
   * full-width option row and the default; `chips` is the wrapped pill grid
   * (`ChoiceChips`) for a LIGHT question — many short answers, none of which
   * changes what the app does. Exactly one screen asks for it: attribution.
   */
  layout?: 'rows' | 'chips';
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
    // THIS SCREEN IS THE TODAY PAGE (owner, 23 Aug 2026). It is the one step
    // that does not render inside `OnboardingScreen`: `DemoToday` draws the
    // canvas, the wordmark row and the composer, and lines settle into records
    // as they are written. See that file for why the template is set aside here
    // and nowhere else.
    //
    // IT HAS NO SUBTEXT, and the headline is not printed (owner, 23 Aug 2026:
    // "grey 'write your training' with an example in brackets — the rest is not
    // needed"). The instruction is the composer's PLACEHOLDER, which is the one
    // place a person about to write is already looking, and the example in it —
    // `DEMO_EXAMPLE` — is the exact shape `parse-eval-cases.json` covers ("rep
    // list commas after weight"), so the screen cannot demonstrate a syntax the
    // parser rejects.
    //
    // The headline is still resolved, and `DemoToday` gives it to VoiceOver as
    // the composer's label: a screen may lose its printed question without
    // losing what it is asking.
    //
    // The screen asks for TWO OR THREE exercises because the flow after it is
    // built out of them — up to three key-lift chips with their loads, the
    // overload card, the projection, and after signup the first real session in
    // the record. Skip is in the chrome row for anyone with nothing to write.
    slug: 'demo',
    kind: 'demo',
    headline: "Write it like you'd say it",
    cta: "That's the whole app",
  },
  {
    // THE TRACKER ANSWER LANDS HERE. Screen two asks what they are switching
    // from and, until 20 Aug 2026, nothing ever said it back — which is the
    // state §5 deletes a question for. The first paragraph is now addressed to
    // the thing they actually use; the argument under it is unchanged.
    slug: 'why-written',
    kind: 'essay',
    headline: 'What gets written gets stronger.',
    body: (answers) => whyWrittenBody(answers.tracker),
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
      { id: 'new', emoji: '\u{23F3}', label: 'Under a year', detail: 'still learning the lifts' },
      {
        id: 'building',
        emoji: '\u{1F4C8}',
        label: '1–3 years',
        detail: 'the numbers still move most months',
      },
      {
        id: 'experienced',
        emoji: '\u{1F9F1}',
        label: '3+ years',
        detail: 'progress is slower and earned',
      },
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
    /**
     * THE SEVEN DISCS STAY (owner, 23 Aug 2026). A week card with wider cells
     * and a segmented sub-question was built and taken straight back out on the
     * owner's ruling: this screen keeps the design it had. `WeekPicker.tsx` and
     * `Segmented.tsx` stay on disk, unmounted, the way every other rolled-back
     * surface here does.
     *
     * What survived is COPY, not layout: `weekReadback` answers a person who
     * trains on no fixed days ("No fixed days — Recore follows what you write")
     * instead of leaving "Pick your days" under an answered screen, and the
     * subtext no longer calls a rhythm a target (§11).
     */
    slug: 'days',
    kind: 'days',
    headline: 'When do you train?',
    subtext: 'Tap the days you usually train — a rhythm, never a target.',
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
     * rule 2 and §3 both forbid on a store-facing screen. The lines below say
     * something about THIS person's own record instead, which is checkable.
     *
     * "After four written sessions" is a FLOOR, not a threshold the app is
     * holding something back until: `recachePrediction` runs on the first parse
     * and Progress opens a lift's card at three sessions
     * (`MIN_SESSIONS_FOR_CARD`). By four there is a prescription with real
     * history behind it, which is the promise the sentence makes.
     */
    body: [
      'After four written sessions, Recore starts telling you what to lift.',
      'Hold the button and it stops being an intention.',
    ],
    cta: 'Hold to commit',
    storeKey: 'commitment',
  },
  {
    /**
     * WHERE THEY FOUND RECORE — the one question in the flow that changes
     * nothing the person will see.
     *
     * It was deleted on 29 July 2026 for exactly that reason, and it is back on
     * the owner's ruling of 20 August with the two things that were missing:
     * a POSITION that earns it — after the commitment and the projection, where
     * a question reads as a company keeping its own books rather than as
     * marketing — and a CONSUMER, `pref_ob_source`, which the funnel snapshot
     * has been reading (and finding empty) ever since.
     *
     * Distribution is ASO-first: the store shows which keyword was searched and
     * nothing at all about the video, the thread or the friend behind an
     * install. This answer is the only place that difference exists.
     *
     * Skippable, and never required — Continue does not wait for it, and an
     * unanswered screen stores null rather than "other".
     *
     * IT IS DRAWN AS CHIPS (23 Aug 2026), not as six full-width rows: the
     * weight of a control should match the weight of the question, and this is
     * the lightest question in the flow (`ChoiceChips`).
     */
    slug: 'attribution',
    kind: 'choice',
    layout: 'chips',
    headline: 'Where did you find Recore?',
    subtext: "One tap. It helps us know what's working.",
    options: [
      { id: 'appstore', label: 'App Store search' },
      { id: 'video', label: 'TikTok / Reels / Shorts' },
      { id: 'x', label: 'X / Twitter' },
      { id: 'reddit', label: 'Reddit' },
      { id: 'friend', label: 'A friend' },
      { id: 'other', label: 'Somewhere else' },
    ],
    storeKey: 'attribution',
    cta: 'Continue',
  },
  {
    slug: 'recap',
    kind: 'recap',
    headline: 'Want a recap every Sunday?',
    // THE OS PROMPT HAPPENS HERE (owner, 23 Aug 2026), on Continue, and only
    // for a yes. It reverses §5.1's "no permission prompt in onboarding": the
    // rule exists so nobody is asked before the reason is on the glass, and on
    // this screen the reason is the whole screen — the message is drawn above
    // the question, in the words of the obstacle the person named themselves.
    // The footnote says the dialog is coming, so the system sheet is never a
    // surprise. `lib/recap.ts` holds the rest of the argument.
    //
    // THE OBSTACLES ANSWER LANDS HERE: someone who said they forget to log is
    // told what the message is for, in their own words.
    subtext: (answers) => recapSubtext(parseList(answers.obstacles)),
    footnote: 'Choosing yes asks iOS for permission on the next tap.',
    options: [
      {
        id: 'yes',
        label: 'Yes, send it',
        detail: 'one message a week, nothing else',
      },
      {
        id: 'no',
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
    // The name and the GOAL, in one line: "Marko — your next 12 weeks of load".
    // One word class from the goal, never a rewrite (`projectionHeadline`).
    headline: (answers) => projectionHeadline(answers.name, answers.goal),
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

/** A lesson screen's paragraphs, resolved the same way. */
export function stepBody(step: Step, answers: Answers): readonly string[] {
  if (typeof step.body === 'function') return step.body(answers);
  return step.body ?? [];
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

  // Nothing typed on the key-lift screen, but a load WAS written on the demo
  // screen — a movement the chips do not offer, most often ("incline db press
  // 30kg 12,12"). It is the person's own number either way, so the last screen
  // of the flow uses it rather than showing them nothing.
  if (out.length === 0) {
    const demo = demoProjection(answers, experience, unit);
    if (demo) out.push(demo);
  }
  return out;
}

/**
 * THE PROJECTION WITH NO NUMBER TO START FROM.
 *
 * Someone can reach the last screen having named a lift and skipped every
 * load — the footnote on the key-lift screen says they may. The old screen
 * answered that with a paragraph of apology; the design's answer was a fake
 * 65 kg, which §5.1 forbids outright ("never show a fake progression chart
 * before a session is logged") and which would also be the first number in the
 * app that nobody typed.
 *
 * So the projection goes RELATIVE: the rate itself, over the horizon, drawn as
 * a shape with no axis. It is the same arithmetic the absolute card runs
 * (`projectionRate` — the experience ladder), minus the one thing that is
 * missing, and the caption says exactly what is missing and how it arrives.
 *
 * A PERCENTAGE AND NOT "+7.5 kg" ON PURPOSE. A kilogram delta is a share of a
 * starting load, so printing one without a starting load means inventing the
 * load and hiding it — which is the fabrication this whole variant exists to
 * avoid (CLAUDE.md §2 rule 3). The number below is the only honest one the
 * screen has.
 */
export type RelativeProjection = {
  lift: string;
  /** Whole percent added over `COMMIT_WEEKS`, from the experience ladder. */
  percent: number;
};

export function relativeProjection(answers: Answers): RelativeProjection | null {
  const lift =
    parseList(answers.keyLifts)[0] ?? parseDemoEntry(answers.demoEntry)?.exerciseName ?? null;
  if (!lift) return null;
  const experience =
    answers.experience === 'new' ||
    answers.experience === 'building' ||
    answers.experience === 'experienced'
      ? answers.experience
      : null;
  const percent = Math.round(projectionRate(experience) * 100);
  if (percent <= 0) return null;
  return { lift, percent };
}

/** The demo line as a projection, or null when it carried no load. */
function demoProjection(
  answers: Answers,
  experience: 'new' | 'building' | 'experienced' | null,
  unit: WeightUnit,
): LiftProjection | null {
  const demo = parseDemoEntry(answers.demoEntry);
  if (!demo || demo.weightKg == null || demo.weightKg <= 0) return null;
  const start = inWrittenUnit(demo.weightKg, unit);
  if (start <= 0) return null;
  const target = projectedTarget(start, experience, unit);
  return { lift: demo.exerciseName, start, target, gain: toPlate(target - start, unit), unit };
}

/**
 * THE OVERLOAD LESSON'S TWO LINES, built out of what the person has already
 * told the app.
 *
 * In order of preference: the key lift they set a load for two screens ago, the
 * line they wrote on the demo screen, and only then a named example. The FIRST
 * two are their own training; the third is a barbell fact (a 2.5 kg jump on a
 * 60 kg bench) and never a claim about anybody.
 *
 * The sets and reps come from the demo line when there is one — "3 × 5" for
 * `bench 100kg 5,5,4` — because that line is what they said they last did. With
 * no line to read, the card keeps the generic 3 × 8.
 */
export type OverloadExample = {
  lift: string;
  sets: number;
  reps: number;
  start: number;
  next: number;
  unit: WeightUnit;
};

export function overloadExample(answers: Answers): OverloadExample {
  const unit = resolveWeightUnit(answers);
  const step = loadStep(unit);
  const demo = parseDemoEntry(answers.demoEntry);

  const chosen = parseList(answers.keyLifts)[0];
  const loads = parseLiftLoads(answers.liftLoads);
  const chosenLoad = chosen ? loads[chosen] : undefined;

  const demoLoad =
    demo?.weightKg != null && demo.weightKg > 0 ? inWrittenUnit(demo.weightKg, unit) : null;

  const fallbackLoad = unit === 'lb' ? 135 : 60;
  const start =
    chosenLoad != null && chosenLoad > 0 ? chosenLoad : demoLoad != null ? demoLoad : fallbackLoad;
  const lift = chosen ?? demo?.exerciseName ?? 'Bench press';
  const shape = demoShape(demo);

  return { lift, sets: shape.sets, reps: shape.reps, start, next: start + step, unit };
}

/** A written line's shape — how many sets, and the reps it kept coming back to.
 * The MODE rather than the maximum: `5,5,4` is a three-by-five session with a
 * last set that dropped, and that is how a person would say it back. */
function demoShape(demo: DemoEntry | null): { sets: number; reps: number } {
  const reps = demo?.reps ?? [];
  if (reps.length === 0) return { sets: 3, reps: 8 };
  const counts = new Map<number, number>();
  for (const r of reps) counts.set(r, (counts.get(r) ?? 0) + 1);
  let best = reps[0]!;
  for (const [value, count] of counts) {
    const bestCount = counts.get(best) ?? 0;
    if (count > bestCount || (count === bestCount && value > best)) best = value;
  }
  return { sets: reps.length, reps: best };
}
