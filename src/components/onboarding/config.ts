import type { ImageSourcePropType } from 'react-native';

import {
  daysLabel,
  formatBodyWeight,
  normalizeDayMask,
  parseBodyWeight,
} from '@/lib/onboarding';
import { defaultWeightUnit } from '@/lib/locale';
import type { WeightUnit } from '@/lib/prefs';
import type { AnswerKey, Answers } from '@/state/onboarding';

/**
 * The illustrated onboarding flow — config-driven steps, one renderer
 * (`app/onboarding/[step].tsx`). No per-step screen components.
 *
 * FIFTEEN entries: a welcome intro, thirteen steps, and a Ready echo. Aligned
 * with product-direction §5 on 30 Jul (owner's yes): company and commitment
 * were DELETED (no consumer — §5's removal criterion), routine became the
 * session-feel question (screen 10, feeds the composer), rest became a length
 * choice (feeds the toolbar timer), name and priority movement were added
 * (screens 2 and 9 — both have live consumers), and the flow now ends with the
 * §5 screen-14 echo instead of jumping straight to the paywall. Language and
 * display unit are DERIVED from the device locale (`lib/locale.ts`), not
 * asked. The notifications step records intent only — §5.1: no permission
 * prompt belongs in onboarding.
 *
 * This file lives in `components/onboarding/`, NOT in `app/onboarding/`,
 * because expo-router registers EVERY file under app/ as a route (only
 * `_layout` is special): an `_config.ts` there would become a phantom route.
 *
 * ASSET MAPPING (owner's spec, follow exactly — the filenames are not
 * self-explanatory):
 *  - `08-walking.png` (training days — farmer's carry + bar chart) and
 *    `10-walking.png` (the welcome — gym bag + timeline) are DIFFERENT
 *    illustrations despite the shared "walking" name.
 *  - `11-Notifications.png` has a capital N. The iOS simulator is
 *    case-insensitive; a real device is not. Keep the exact casing.
 *  - Two deliberate reuses, far apart: 11-Notifications (name + reminders)
 *    and 13-progression (lesson + Ready).
 */

export type StepOption = {
  id: string;
  label: string;
  emoji?: string;
};

export type Step = {
  id: string;
  /**
   * 'intro' — the welcome hero (no rail, Get started CTA).
   * 'question' — 2–4 radio options, answer advances.
   * 'text' — optional single-line answer + Continue (empty = skip).
   * 'days' — the seven-circle day picker + Continue.
   * 'weight' — typed bodyweight + kg/lb toggle + Continue.
   * 'lesson' — copy only + Continue.
   * 'ready' — the §5 screen-14 echo of meaningful answers + See plans.
   */
  kind: 'intro' | 'question' | 'text' | 'lesson' | 'days' | 'weight' | 'ready';
  /** Static asset, or a function of the answers (the experience variant). */
  image: ImageSourcePropType | ((answers: Answers) => ImageSourcePropType);
  /** Vertical anchor for the full-bleed cover crop. */
  focus: 'top' | 'center';
  title: string;
  subtitle?: string;
  /** 2–4 radio options; question steps only. */
  options?: StepOption[];
  storeAs?: AnswerKey;
  /** Placeholder for 'text' steps. */
  placeholder?: string;
  /** Quick-pick chips under a 'text' field — tapping one answers and
   * advances; the field stays for anything not on the list. */
  suggestions?: string[];
};

/**
 * Both experience-level variants, exported so the gender step can prefetch
 * them before the answer exists (which variant the experience step shows is
 * decided by the gender answer).
 *
 * VARIANT RULE (owner's spec — counter-intuitive, follow literally):
 *   'female' → 03-experience.png, 'male' → 03-experience_v2.png,
 *   anything else or skipped → 03-experience.png.
 */
export const EXPERIENCE_IMAGES = {
  base: require('../../../assets/onboarding/03-experience.png') as ImageSourcePropType,
  v2: require('../../../assets/onboarding/03-experience_v2.png') as ImageSourcePropType,
} as const;

export const STEPS: readonly Step[] = [
  {
    id: 'welcome',
    kind: 'intro',
    image: require('../../../assets/onboarding/10-walking.png'),
    focus: 'top',
    title: 'Welcome to Recore',
    subtitle:
      'Thanks for downloading. Write your training in your own words — Recore reads it, tracks every set, and shows the progress you earn.',
  },
  {
    id: 'name',
    kind: 'text',
    image: require('../../../assets/onboarding/11-Notifications.png'),
    focus: 'top',
    title: 'What should we call you?',
    subtitle: 'Optional — it makes the record feel like yours.',
    placeholder: 'Your first name',
    storeAs: 'name',
  },
  {
    id: 'gender',
    kind: 'question',
    image: require('../../../assets/onboarding/01-spol.png'),
    focus: 'top',
    title: "What's your gender?",
    subtitle: 'We tailor the wording and illustrations to you.',
    options: [
      { id: 'female', label: 'Female' },
      { id: 'male', label: 'Male' },
      { id: 'other', label: 'Prefer not to say' },
    ],
    storeAs: 'gender',
  },
  {
    id: 'goals',
    kind: 'question',
    image: require('../../../assets/onboarding/02-cilji.png'),
    focus: 'top',
    title: "What's your main goal?",
    options: [
      { id: 'strength', label: 'Get stronger' },
      { id: 'muscle', label: 'Build muscle' },
      { id: 'fitness', label: 'General fitness' },
      { id: 'both', label: 'Strength and muscle' },
    ],
    storeAs: 'goal',
  },
  {
    id: 'experience',
    kind: 'question',
    image: (answers) => (answers.gender === 'male' ? EXPERIENCE_IMAGES.v2 : EXPERIENCE_IMAGES.base),
    focus: 'top',
    title: 'How much lifting experience do you have?',
    options: [
      { id: 'new', label: 'Just starting out' },
      { id: 'building', label: 'I train on and off' },
      { id: 'experienced', label: "I've trained for years" },
    ],
    storeAs: 'experience',
  },
  {
    id: 'how-recore-works',
    kind: 'lesson',
    image: require('../../../assets/onboarding/12-explain-recore.png'),
    focus: 'center',
    title: 'Recore is your training record',
    subtitle:
      'Write your workout in your own words. Recore understands it, tracks the load, and shows your progress.',
  },
  {
    id: 'tracker',
    kind: 'question',
    image: require('../../../assets/onboarding/04-planning.png'),
    focus: 'top',
    title: 'Where do you track workouts today?',
    options: [
      { id: 'strong', label: 'Strong' },
      { id: 'hevy', label: 'Hevy' },
      { id: 'notes', label: 'Notes or paper' },
      { id: 'none', label: 'Nowhere' },
    ],
    storeAs: 'tracker',
  },
  {
    id: 'session-feel',
    kind: 'question',
    image: require('../../../assets/onboarding/06-routine.png'),
    focus: 'top',
    title: 'How do you want training to feel?',
    subtitle: 'It shapes the examples and vocabulary — never a locked programme.',
    options: [
      { id: 'structured', label: 'Structured — I follow a plan' },
      { id: 'flexible', label: 'Flexible — I go by feel' },
      { id: 'hybrid', label: 'A bit of both' },
    ],
    storeAs: 'sessionFeel',
  },
  {
    id: 'training-days',
    kind: 'days',
    image: require('../../../assets/onboarding/08-walking.png'),
    focus: 'top',
    title: 'Which days do you usually train?',
    subtitle: 'An expected rhythm, not an obligation.',
    storeAs: 'trainingDays',
  },
  {
    id: 'movement',
    kind: 'text',
    image: require('../../../assets/onboarding/05-training-alone.png'),
    focus: 'top',
    title: 'Which lift matters most to you?',
    subtitle: 'It leads your Lifts and your first examples. Optional.',
    placeholder: 'Type your own…',
    // Names the parser's canon resolves (`findExerciseByName`), so the pinned
    // lift connects to real history the moment it exists.
    suggestions: ['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Pull-ups', 'Row'],
    storeAs: 'primaryLift',
  },
  {
    id: 'rest-length',
    kind: 'question',
    image: require('../../../assets/onboarding/07-rest-time.png'),
    focus: 'top',
    title: 'How long do you rest between sets?',
    subtitle: 'Sets the timer default — change it anytime.',
    options: [
      { id: '60', label: 'About a minute' },
      { id: '90', label: 'Around 90 seconds' },
      { id: '120', label: 'Two minutes' },
      { id: '180', label: 'Three or more' },
    ],
    storeAs: 'restSeconds',
  },
  {
    id: 'why-progression',
    kind: 'lesson',
    image: require('../../../assets/onboarding/13-progression.png'),
    focus: 'center',
    title: 'Progress is gradual overload',
    subtitle:
      'Small, consistent steps — one more kilo, one more rep. Recore tracks them for you.',
  },
  {
    id: 'bodyweight',
    kind: 'weight',
    image: require('../../../assets/onboarding/09-weight.png'),
    focus: 'top',
    title: 'How much do you weigh?',
    subtitle: 'Helps put your lifts in context. Leave it empty to skip.',
    storeAs: 'bodyweight',
  },
  {
    id: 'notifications',
    kind: 'question',
    image: require('../../../assets/onboarding/11-Notifications.png'),
    focus: 'top',
    title: 'Want a weekly recap of your training?',
    subtitle: "We'll ask for permission once your first recap is ready — not before.",
    options: [
      { id: 'yes', label: 'Yes, keep me posted' },
      { id: 'no', label: 'No notifications' },
    ],
    storeAs: 'notifications',
  },
  {
    id: 'ready',
    kind: 'ready',
    image: require('../../../assets/onboarding/13-progression.png'),
    focus: 'center',
    title: 'Ready for your record',
    subtitle: 'Here is what your answers set up.',
  },
] as const;

/** The rail counts only the real steps — the intro is a doormat, not progress. */
export const QUESTION_STEP_COUNT = STEPS.length - 1;

/** Resolve a step's illustration against the current answers. */
export function stepImageSource(step: Step, answers: Answers): ImageSourcePropType {
  return typeof step.image === 'function' ? step.image(answers) : step.image;
}

/** One resolution for the display unit — the weight step, the Ready echo and
 * completion must never disagree about it. Unset derives from the locale. */
export function resolveWeightUnit(answers: Answers): WeightUnit {
  return answers.weightUnit === 'lb' || answers.weightUnit === 'kg'
    ? answers.weightUnit
    : defaultWeightUnit();
}

const GOAL_LINES: Record<string, string> = {
  strength: 'Training for strength — your progress view leads with load and repeatable sets.',
  muscle: 'Building muscle — your progress view leads with working sets and volume.',
  fitness: 'Training for fitness — a balanced view of your whole record.',
  both: 'Strength and muscle — both sides of your record in view.',
};

const REST_LINES: Record<string, string> = {
  '60': 'Rest timer set to 1:00.',
  '90': 'Rest timer set to 1:30.',
  '120': 'Rest timer set to 2:00.',
  '180': 'Rest timer set to 3:00.',
};

/**
 * The Ready echo (§5 screen 14): meaningful answers read back as one quiet
 * list, INSTANTLY — never behind an "analyzing" timer (§4.3 bans fake
 * loading; this repository already deleted one such screen as blocker B5).
 * Every line restates something the person actually chose; an unanswered
 * question earns silence, not a filler row.
 */
export function readyLines(answers: Answers): string[] {
  const lines: string[] = [];

  const goal = answers.goal ? GOAL_LINES[answers.goal] : undefined;
  if (goal) lines.push(goal);

  if (answers.experience === 'new') {
    lines.push('Every reading explains itself the first time it appears.');
  } else if (answers.experience === 'experienced') {
    lines.push('Explanations stay out of your way.');
  }

  const lift = answers.primaryLift?.trim();
  if (lift) lines.push(`${lift[0]!.toUpperCase()}${lift.slice(1)} leads your Lifts from day one.`);

  const mask = normalizeDayMask(answers.trainingDays);
  if (mask > 0) lines.push(`Your rhythm: ${daysLabel(mask)}.`);

  const rest = answers.restSeconds ? REST_LINES[answers.restSeconds] : undefined;
  if (rest) lines.push(rest);

  const unit = resolveWeightUnit(answers);
  const kg = parseBodyWeight(answers.bodyweight ?? '', unit);
  const weight = formatBodyWeight(kg, unit);
  if (weight) lines.push(`${weight} noted for context.`);

  if (answers.tracker === 'strong' || answers.tracker === 'hevy') {
    const app = answers.tracker === 'strong' ? 'Strong' : 'Hevy';
    lines.push(`Your ${app} history can come with you after sign-up.`);
  }

  return lines;
}
