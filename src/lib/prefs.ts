import { getMeta, setMeta } from '@/lib/db/index';
import { markObStepReached } from '@/lib/funnel';
import {
  isExperience,
  isGoal,
  isSessionFeel,
  isTrainingStyle,
  normalizeDayMask,
  type Experience,
  type Goal,
  type SessionFeel,
  type TrainingStyle,
} from '@/lib/onboarding';
import type { ScheduleMode } from '@/lib/plan/resolve';

/**
 * User preferences from onboarding (product-direction §5), stored in the local
 * meta KV — scoped per account on this device (ensureLocalUser wipes meta on
 * user switch). Every answer must DO something real in the product: the goal
 * tailors copy and the engine's fallback range, the training style decides
 * which examples lead, the smallest plate feeds roundToPlate so a suggestion
 * always lands on loads the gym can rack.
 *
 * EVERY KEY HERE IS `pref_*` ON PURPOSE. `export-json.ts` carries every
 * `pref_%` row and `account/delete.ts` drops the whole `meta` table, so an
 * answer added here is covered by §12's export and deletion guarantees for
 * free — including the optional body context, which §12 names as personal data
 * deserving exactly the same treatment as a workout.
 *
 * The ANSWER MODEL lives in `lib/onboarding.ts`, which is pure and tested. This
 * file is storage only: it validates on the way out and never decides meaning.
 */
export type { Experience, Goal, SessionFeel, TrainingStyle };
export type LogSource = 'none' | 'paper' | 'app';
/** OB_03 — where the user's training history lives today. */
export type ObTracker = 'strong' | 'hevy' | 'notes' | 'none';
/** OB_04 — the language(s) the user writes workouts in. */
export type ObLanguage = 'en' | 'slo' | 'both';
/** OB_05 — display unit for loads. Storage stays kg everywhere. */
export type WeightUnit = 'kg' | 'lb';
/** OB_07 — the saved first action, remembered through checkout. */
export type FirstAction = 'import' | 'write';

const KEYS = {
  onboardingDone: 'onboarding_done',
  name: 'pref_name',
  goal: 'pref_goal',
  logSource: 'pref_log_source',
  smallestPlate: 'pref_smallest_plate_kg',
  restSeconds: 'pref_rest_seconds',
  barWeight: 'pref_bar_weight_kg',
  obStep: 'pref_ob_step',
  obTracker: 'pref_ob_tracker',
  obLanguage: 'pref_ob_language',
  weightUnit: 'pref_weight_unit',
  firstAction: 'pref_first_action',
  scheduleMode: 'pref_schedule_mode',
  finishedOnce: 'pref_finished_once',
  ghostHintSeen: 'pref_ghost_hint_seen',
  primaryLift: 'pref_primary_lift',
  liftsPinned: 'pref_lifts_pinned_done',
  coachRingDone: 'pref_coach_ring_done',
  tourDone: 'pref_tour_done',
  // --- §5's new answers (step 2) ---
  experience: 'pref_experience',
  trainingStyle: 'pref_training_style',
  sessionFeel: 'pref_session_feel',
  usualDays: 'pref_usual_days',
  bodyWeightKg: 'pref_body_weight_kg',
  bodyHeightCm: 'pref_body_height_cm',
  importOffered: 'pref_import_offered',
} as const;

export function isOnboardingDone(): boolean {
  return getMeta(KEYS.onboardingDone) === '1';
}

export function markOnboardingDone() {
  setMeta(KEYS.onboardingDone, '1');
}

/** OB name — an optional first name used to personalize the flow ("Ready,
 * Marko?"). Purely for warmth; every screen degrades gracefully to no name. */
export function setName(name: string) {
  setMeta(KEYS.name, name.trim());
}

export function getName(): string | null {
  const v = getMeta(KEYS.name)?.trim();
  return v ? v : null;
}

export function setGoal(goal: Goal) {
  setMeta(KEYS.goal, goal);
}

export function getGoal(): Goal | null {
  const v = getMeta(KEYS.goal);
  return isGoal(v) ? v : null;
}

// --- §5's new answers. Each one changes something, named in its own comment. ---

/** Screen 4 — changes how much a surface explains itself, never a number. */
export function setExperience(value: Experience) {
  setMeta(KEYS.experience, value);
}

export function getExperience(): Experience | null {
  const v = getMeta(KEYS.experience);
  return isExperience(v) ? v : null;
}

/** Screen 5 — the branch key for §5.1: gym content, sport language, or both. */
export function setTrainingStyle(value: TrainingStyle) {
  setMeta(KEYS.trainingStyle, value);
}

export function getTrainingStyle(): TrainingStyle | null {
  const v = getMeta(KEYS.trainingStyle);
  return isTrainingStyle(v) ? v : null;
}

/** Screen 10 — composer examples and vocabulary. Never a programme. */
export function setSessionFeel(value: SessionFeel) {
  setMeta(KEYS.sessionFeel, value);
}

export function getSessionFeel(): SessionFeel | null {
  const v = getMeta(KEYS.sessionFeel);
  return isSessionFeel(v) ? v : null;
}

/**
 * Screen 8 — the usual training days, as a Monday-first 7-bit mask.
 *
 * An EXPECTATION, never a target (§11). Nothing counts a miss against it, and
 * nothing may: "never turn a rest or missed day into a broken streak, warning,
 * or guilt message."
 */
export function setUsualDays(mask: number) {
  setMeta(KEYS.usualDays, String(normalizeDayMask(mask)));
}

export function getUsualDays(): number {
  return normalizeDayMask(getMeta(KEYS.usualDays));
}

/**
 * Screen 7 — optional body context, stored metric like every other load.
 *
 * Passing null CLEARS it, which is what makes the field genuinely optional:
 * someone who filled it in during onboarding can empty it again from You and
 * nothing else in the app changes (§5.1).
 */
export function setBodyWeightKg(kg: number | null) {
  setMeta(KEYS.bodyWeightKg, kg == null ? null : String(kg));
}

export function getBodyWeightKg(): number | null {
  const n = Number.parseFloat(getMeta(KEYS.bodyWeightKg) ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setBodyHeightCm(cm: number | null) {
  setMeta(KEYS.bodyHeightCm, cm == null ? null : String(cm));
}

export function getBodyHeightCm(): number | null {
  const n = Number.parseFloat(getMeta(KEYS.bodyHeightCm) ?? '');
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Has the post-trial import fast path been put in front of this person yet?
 * One-shot: §2.1 says skipping is one tap and never punished, which means
 * never asked twice either.
 */
export function markImportOffered() {
  setMeta(KEYS.importOffered, '1');
}

export function hasImportBeenOffered(): boolean {
  return getMeta(KEYS.importOffered) === '1';
}

export function setLogSource(source: LogSource) {
  setMeta(KEYS.logSource, source);
}

export function getLogSource(): LogSource | null {
  const v = getMeta(KEYS.logSource);
  return v === 'none' || v === 'paper' || v === 'app' ? v : null;
}

export function setSmallestPlateKg(kg: number) {
  setMeta(KEYS.smallestPlate, String(kg));
}

/** Feeds the prediction engine's plate rounding (CLAUDE.md §7). */
export function getSmallestPlateKg(): number | null {
  const v = getMeta(KEYS.smallestPlate);
  if (v == null) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Rest-timer length; the toolbar long-press cycles these. */
export const REST_OPTIONS_S = [60, 90, 120, 180] as const;
export const DEFAULT_REST_S = 120;

export function setRestSeconds(s: number) {
  setMeta(KEYS.restSeconds, String(s));
}

export function getRestSeconds(): number {
  const n = Number.parseFloat(getMeta(KEYS.restSeconds) ?? '');
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_S;
}

// --- Onboarding (OB_01–OB_07) — additive keys; setup persists on device so a
// --- relaunch resumes mid-flow. Wiped with meta on account switch, so the
// --- flow keeps its re-run-per-account semantics.

/** Last onboarding step reached (0-based). Relaunch resumes here. */
export function setObStep(step: number) {
  setMeta(KEYS.obStep, String(step));
  // The high-water mark, recorded here rather than at the call sites so no
  // future step can forget it (§2.1, PLAN D4 / E7).
  markObStepReached(step);
}

export function getObStep(): number | null {
  const n = Number.parseInt(getMeta(KEYS.obStep) ?? '', 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function setObTracker(tracker: ObTracker) {
  setMeta(KEYS.obTracker, tracker);
}

export function getObTracker(): ObTracker | null {
  const v = getMeta(KEYS.obTracker);
  return v === 'strong' || v === 'hevy' || v === 'notes' || v === 'none' ? v : null;
}

export function setObLanguage(language: ObLanguage) {
  setMeta(KEYS.obLanguage, language);
}

export function getObLanguage(): ObLanguage | null {
  const v = getMeta(KEYS.obLanguage);
  return v === 'en' || v === 'slo' || v === 'both' ? v : null;
}

export function setWeightUnit(unit: WeightUnit) {
  setMeta(KEYS.weightUnit, unit);
}

export function getWeightUnit(): WeightUnit | null {
  const v = getMeta(KEYS.weightUnit);
  return v === 'kg' || v === 'lb' ? v : null;
}

export function setFirstAction(action: FirstAction) {
  setMeta(KEYS.firstAction, action);
}

/** OB_07's choice — read post-entitlement to resume the saved start. */
export function getFirstAction(): FirstAction | null {
  const v = getMeta(KEYS.firstAction);
  return v === 'import' || v === 'write' ? v : null;
}

// --- Block E ------------------------------------------------------------------

/**
 * The lift the athlete says they care about most (block E, step 8).
 *
 * Stored as the words they typed, never as an exercise id: onboarding runs
 * before there is an account, so the local `exercises` table is empty and there
 * is nothing to resolve against yet. It is resolved read-only, through the real
 * `findExerciseByName`, at the two places it is used — and if it does not
 * resolve, the app says nothing and moves on (§1.1 invariant 6). **Naming a
 * movement never creates an exercise row**, here or in `/plan-day`.
 */
export function setPrimaryLift(name: string) {
  setMeta(KEYS.primaryLift, name.trim().slice(0, 60));
}

export function getPrimaryLift(): string | null {
  const v = getMeta(KEYS.primaryLift)?.trim();
  return v ? v : null;
}

/**
 * The primary lift sorts first in Lifts ON THE FIRST OPEN, and only then —
 * after that, recency is the truth and pinning would be the app overruling the
 * record. This is the one-shot flag that retires it.
 */
export function hasPinnedPrimaryLift(): boolean {
  return getMeta(KEYS.liftsPinned) === '1';
}

export function markPrimaryLiftPinned() {
  setMeta(KEYS.liftsPinned, '1');
}

// The install-source question was DELETED on 29 July 2026 (owner's ruling).
// Its own comment admitted it was "the one question in the flow that changes
// nothing the user will see", which is exactly the criterion §5 uses to remove
// a screen. Attribution is not worth a screen of a stranger's attention.

// --- Weekly split (pre-plan) — the schedule model. Default ROTATION ("do the
// --- next one when you train"); WEEKDAY pins days to the calendar (opt-in).
export function setScheduleMode(mode: ScheduleMode) {
  setMeta(KEYS.scheduleMode, mode);
}

export function getScheduleMode(): ScheduleMode {
  return getMeta(KEYS.scheduleMode) === 'weekday' ? 'weekday' : 'rotation';
}

/** The bar the plate math loads against (checklist long-press). */
export const DEFAULT_BAR_KG = 20;

export function setBarWeightKg(kg: number) {
  setMeta(KEYS.barWeight, String(kg));
}

export function getBarWeightKg(): number {
  const n = Number.parseFloat(getMeta(KEYS.barWeight) ?? '');
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BAR_KG;
}

// --- One-shot teaching flags. The record contract needs explaining exactly
// --- once; after the user has done the thing, the training wheels retire and
// --- the surface goes quiet (a serious lifter doesn't need the caption twice).

/** Set the first time a session is finished — retires the status-line tail. */
export function markFinishedOnce() {
  setMeta(KEYS.finishedOnce, '1');
}

export function hasFinishedOnce(): boolean {
  return getMeta(KEYS.finishedOnce) === '1';
}

/** Set the first time the ghost's how-to hint is shown — then it stays gone. */
export function markGhostHintSeen() {
  setMeta(KEYS.ghostHintSeen, '1');
}

export function hasSeenGhostHint(): boolean {
  return getMeta(KEYS.ghostHintSeen) === '1';
}

/** Set the first time the user works a settled card — toggles its ring or
 * long-presses into its history. Retires the first-session hint under the
 * ledger AND fills step two of the FIRST SESSION card, so the two surfaces
 * can never disagree. Earned by the real action, never by being shown. */
export function markCoachRingDone() {
  setMeta(KEYS.coachRingDone, '1');
}

export function hasCoachRingDone(): boolean {
  return getMeta(KEYS.coachRingDone) === '1';
}

/** Set when the first-open spotlight tour is finished OR skipped — either way
 * it was offered once and never returns (owner, 29 Jul). */
export function markTourDone() {
  setMeta(KEYS.tourDone, '1');
}

export function isTourDone(): boolean {
  return getMeta(KEYS.tourDone) === '1';
}
