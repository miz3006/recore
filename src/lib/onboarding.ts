// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — the same pattern as
// streak.ts and plan/prescribe.ts.
import type { Focus } from './predict/engine.ts';

/**
 * The onboarding answer model — PURE, no React, no react-native, no database,
 * so every rule below is unit-tested under plain `node --test`
 * (product-direction §5, implementation order step 2).
 *
 * It exists because §5 makes one demand that is easy to say and easy to break:
 * **every question must change a later screen, a default, a summary, or a
 * personalised interpretation.** A question that changes nothing gets deleted.
 * Keeping the answers, their validation and their consequences in one testable
 * file is what stops the next screen from being added without a consequence.
 *
 * `prefs.ts` owns the storage; this file owns what the answers MEAN.
 */

// --- screen 3: what are you training for? ------------------------------------------

/**
 * Five answers (§5 screen 3), where V4 had three.
 *
 * THE ENGINE STILL HAS THREE, and that is the owner's ruling of 29 Jul 2026.
 * `Goal` is what the person said; `Focus` is what the prediction engine acts
 * on. Before this change they were deliberately the same union so a drift
 * would fail to compile — but §5 needs answers the engine has no opinion about,
 * and inventing a rep range for "general fitness" would be exactly the kind of
 * number CLAUDE.md §2 rule 3 says code must own and nobody may guess.
 *
 * So the mapping is explicit, in one place, and `focusForGoal` is the only
 * bridge. Adding a real range for `fitness` or `sport` later is a one-line
 * change here plus a number the owner supplies.
 */
export type Goal = 'strength' | 'muscle' | 'fitness' | 'sport' | 'both';

export const GOALS: readonly Goal[] = ['strength', 'muscle', 'fitness', 'sport', 'both'] as const;

export function isGoal(v: unknown): v is Goal {
  return typeof v === 'string' && (GOALS as readonly string[]).includes(v);
}

/**
 * What the engine should default to for a stated goal.
 *
 * `fitness` and `sport` resolve to the classic middle, the same as `both`:
 * a lifter who trains for general fitness or for a sport has no evidence-based
 * claim on a narrower range until they have actually trained, and the engine
 * overrides this the moment real reps exist anyway.
 */
export function focusForGoal(goal: Goal | null | undefined): Focus | null {
  switch (goal) {
    case 'strength':
      return 'strength';
    case 'muscle':
      return 'muscle';
    case 'fitness':
    case 'sport':
    case 'both':
      return 'both';
    default:
      return null;
  }
}

// --- screen 4: training experience ---------------------------------------------------

/**
 * How much training is behind this person (§5 screen 4). It changes the LEVEL
 * OF EXPLANATION and the confidence of early observations — never flattery,
 * never a judgement, and never a different prescription. A beginner and a
 * competitor lifting the same weight for the same reps get the same number.
 */
export type Experience = 'new' | 'building' | 'experienced';

export const EXPERIENCES: readonly Experience[] = ['new', 'building', 'experienced'] as const;

export function isExperience(v: unknown): v is Experience {
  return typeof v === 'string' && (EXPERIENCES as readonly string[]).includes(v);
}

/**
 * Whether a surface should still explain itself to this person. The one real
 * consequence of screen 4: an experienced lifter does not need the caption
 * twice, and a new lifter should not have to guess what "e1RM" means.
 */
export function wantsExplanation(experience: Experience | null): boolean {
  return experience !== 'experienced';
}

// --- screen 5: how do you train? ------------------------------------------------------

/**
 * The branch key for the whole flow (§5.1): "After fitness is chosen,
 * gym-specific content may follow. After sport or hybrid, language shifts to
 * training load, readiness, and the activity named."
 *
 * Before this change nothing in the app branched on activity type at all —
 * every person saw the same gym screens, which §5.1 forbids in as many words.
 */
export type TrainingStyle = 'gym' | 'sport' | 'hybrid';

export const TRAINING_STYLES: readonly TrainingStyle[] = ['gym', 'sport', 'hybrid'] as const;

export function isTrainingStyle(v: unknown): v is TrainingStyle {
  return typeof v === 'string' && (TRAINING_STYLES as readonly string[]).includes(v);
}

/** Do gym-specific examples lead for this person? */
export function gymLeads(style: TrainingStyle | null): boolean {
  return style !== 'sport';
}

// --- screen 10: how do you want training to feel? --------------------------------------

/**
 * Composer vocabulary and reflection prompts (§5 screen 10). Explicitly NOT a
 * programme: §5 says "Never locks the person into a programme", so this
 * changes wording and examples and nothing about what is prescribed.
 */
export type SessionFeel = 'structured' | 'flexible' | 'sportLed' | 'hybrid';

export const SESSION_FEELS: readonly SessionFeel[] = [
  'structured',
  'flexible',
  'sportLed',
  'hybrid',
] as const;

export function isSessionFeel(v: unknown): v is SessionFeel {
  return typeof v === 'string' && (SESSION_FEELS as readonly string[]).includes(v);
}

// --- screen 8: which days do you usually train? -----------------------------------------

/**
 * A weekly rhythm as a 7-bit mask, Monday first (bit 0 = Mon … bit 6 = Sun) —
 * the same Monday-first convention as the calendar and `plan/resolve.ts`.
 *
 * IT IS AN EXPECTATION, NEVER A TARGET. §11: "Preferred training days may frame
 * expected rhythm, but never turn a rest or missed day into a broken streak,
 * warning, or guilt message." Nothing in this file counts a miss, and nothing
 * downstream may either.
 */
export const DAY_LABELS: readonly string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ALL_DAYS_MASK = 0b1111111;

export function hasDay(mask: number, day: number): boolean {
  if (!Number.isInteger(day) || day < 0 || day > 6) return false;
  return (mask & (1 << day)) !== 0;
}

export function toggleDay(mask: number, day: number): number {
  if (!Number.isInteger(day) || day < 0 || day > 6) return mask;
  return (mask ^ (1 << day)) & ALL_DAYS_MASK;
}

export function dayCount(mask: number): number {
  let n = 0;
  for (let i = 0; i < 7; i++) if (hasDay(mask, i)) n += 1;
  return n;
}

/** A mask read back as words: "Mon, Wed, Fri". Empty when nothing is chosen. */
export function daysLabel(mask: number): string {
  const out: string[] = [];
  for (let i = 0; i < 7; i++) if (hasDay(mask, i)) out.push(DAY_LABELS[i]!);
  return out.join(', ');
}

/** Anything outside the seven bits is not a rhythm; treat it as unanswered. */
export function normalizeDayMask(v: unknown): number {
  const n = typeof v === 'number' ? v : Number.parseInt(String(v ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) return 0;
  return n & ALL_DAYS_MASK;
}

// --- screen 7: body context ---------------------------------------------------------------

/**
 * Optional weight and height (§5 screen 7). The rules are the interesting part:
 * "Never a calorie target, body-grade, or medical judgement", and "Skipping
 * them changes nothing essential."
 *
 * Storage is metric always, exactly like every load in the app — the display
 * unit is a display concern and converting at read time is how two screens end
 * up disagreeing about someone's bodyweight.
 */
export const LB_PER_KG = 2.2046226218;
export const CM_PER_INCH = 2.54;

/** Sane human bounds. Outside them the input is a typo, not a body. */
const MIN_KG = 25;
const MAX_KG = 400;
const MIN_CM = 100;
const MAX_CM = 260;

/**
 * Parse a typed bodyweight into kilograms, or null when it is not a usable
 * number. Null is a first-class answer here: the field is optional and a
 * refusal to guess is the correct behaviour.
 */
export function parseBodyWeight(text: string, unit: 'kg' | 'lb'): number | null {
  const n = Number.parseFloat(String(text).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const kg = unit === 'lb' ? n / LB_PER_KG : n;
  if (kg < MIN_KG || kg > MAX_KG) return null;
  return Math.round(kg * 10) / 10;
}

/** Parse a typed height into centimetres, or null. */
export function parseBodyHeight(text: string, unit: 'cm' | 'in'): number | null {
  const n = Number.parseFloat(String(text).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const cm = unit === 'in' ? n * CM_PER_INCH : n;
  if (cm < MIN_CM || cm > MAX_CM) return null;
  return Math.round(cm);
}

/** Kilograms shown in the person's own unit, for the You screen's value row. */
export function formatBodyWeight(kg: number | null, unit: 'kg' | 'lb'): string | null {
  if (kg == null) return null;
  const v = unit === 'lb' ? kg * LB_PER_KG : kg;
  return `${Math.round(v * 10) / 10} ${unit}`;
}

// --- the flow itself -------------------------------------------------------------------

/**
 * The fourteen screens of §5, in order. Exported so a test can assert the flow
 * against the specification rather than against itself — the shape of drift
 * this repository has actually suffered before.
 *
 * `question: true` marks the screens that ask something; the others explain,
 * demonstrate or settle, and each is the payoff for a question.
 */
export interface ObScreen {
  id: ObScreenId;
  /** The §5 table row this screen implements, 1-based. */
  spec: number;
  question: boolean;
}

export type ObScreenId =
  | 'welcome'
  | 'name'
  | 'focus'
  | 'experience'
  | 'style'
  | 'context'
  | 'body'
  | 'days'
  | 'lift'
  | 'feel'
  | 'tracker'
  | 'notice'
  | 'firstWeek'
  | 'ready';

export const OB_SCREENS: readonly ObScreen[] = [
  { id: 'welcome', spec: 1, question: false },
  { id: 'name', spec: 2, question: true },
  { id: 'focus', spec: 3, question: true },
  { id: 'experience', spec: 4, question: true },
  { id: 'style', spec: 5, question: true },
  { id: 'context', spec: 6, question: false },
  { id: 'body', spec: 7, question: true },
  { id: 'days', spec: 8, question: true },
  { id: 'lift', spec: 9, question: true },
  { id: 'feel', spec: 10, question: true },
  { id: 'tracker', spec: 11, question: true },
  { id: 'notice', spec: 12, question: false },
  { id: 'firstWeek', spec: 13, question: false },
  { id: 'ready', spec: 14, question: false },
] as const;

export const OB_STEP_COUNT = OB_SCREENS.length;

export function screenIndex(id: ObScreenId): number {
  return OB_SCREENS.findIndex((s) => s.id === id);
}

/** "03/09" — the bounded counter, over the screens that actually ask something. */
export function questionFraction(index: number): string | null {
  const screen = OB_SCREENS[index];
  if (!screen?.question) return null;
  const questions = OB_SCREENS.filter((s) => s.question);
  const i = questions.findIndex((s) => s.id === screen.id);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(i + 1)}/${pad(questions.length)}`;
}

// --- the import fast path (§2.1) ------------------------------------------------------

/**
 * Whether this person should be offered import as their first action after the
 * trial starts (§2.1).
 *
 * The rationale is in the spec and worth keeping next to the code: "an empty
 * history means an empty Progress tab on the day the trial decision is made.
 * Imported history is the single strongest lever on trial-to-paid conversion,
 * so it must not be buried in settings for these users."
 *
 * Three conditions, and each one exists to avoid a dead end:
 *
 *  · **A tracker Recore can actually read.** Someone who keeps training in
 *    notes has nothing to hand a CSV importer.
 *  · **Not already offered.** §2.1 allows one offer; "never punished" includes
 *    not being asked twice.
 *  · **They did not already say they would rather just write.** The last
 *    onboarding screen asks exactly that, and until this leg existed the answer
 *    was stored and read by nothing — which is the state §5 deletes a question
 *    for. Honouring it here is what makes that question real.
 */
export function wantsImportFastPath(
  tracker: string | null,
  alreadyOffered: boolean,
  firstAction: string | null,
): boolean {
  if (alreadyOffered) return false;
  if (firstAction === 'write') return false;
  return tracker === 'strong' || tracker === 'hevy';
}

/**
 * Row counts as coarse buckets (§13: "import … row count bucket (no lift
 * names)"). A bucket cannot identify anyone; an exact count from a small user
 * base starts to.
 */
export function rowCountBucket(rows: number): string {
  if (!Number.isFinite(rows) || rows <= 0) return '0';
  if (rows < 50) return '1-49';
  if (rows < 200) return '50-199';
  if (rows < 1000) return '200-999';
  if (rows < 5000) return '1000-4999';
  return '5000+';
}
