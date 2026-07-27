import { getMeta, setMeta } from '@/lib/db/index';

/**
 * User preferences from onboarding (CLAUDE.md §10), stored in the local meta
 * KV — scoped per account on this device (ensureLocalUser wipes meta on user
 * switch). Every answer must DO something real in the product: the goal
 * tailors copy, the log source picks the pitch, the smallest plate feeds
 * roundToPlate so a suggestion always lands on loads the gym can rack.
 */
export type Goal = 'strength' | 'muscle' | 'both';
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
  weeklyTarget: 'pref_weekly_target',
  finishedOnce: 'pref_finished_once',
  composerDemoSeen: 'pref_composer_demo_seen',
  ghostHintSeen: 'pref_ghost_hint_seen',
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
  return v === 'strength' || v === 'muscle' || v === 'both' ? v : null;
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

// --- Weekly split (pre-plan) — the schedule model. Default ROTATION ("do the
// --- next one when you train"); WEEKDAY pins days to the calendar (opt-in).
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

/**
 * The self-writing composer demo (§8.9) — *"It runs exactly once per install."*
 * A demo that replays is a demo that is in the way; by the second session the
 * user knows what the app does.
 */
export function markComposerDemoSeen() {
  setMeta(KEYS.composerDemoSeen, '1');
}

export function hasSeenComposerDemo(): boolean {
  return getMeta(KEYS.composerDemoSeen) === '1';
}

/**
 * Sessions in a normal week (CLAUDE.md §11.3) — the ONLY input to the streak
 * (§15.3, ratified as D3). It counts weeks in which the user met their own
 * target, never consecutive days: rest days are training, and a daily streak
 * punishes them. Default 3, the most common lifting frequency.
 */
export function getWeeklyTarget(): number {
  const raw = getMeta(KEYS.weeklyTarget);
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= 7 ? n : 3;
}

export function setWeeklyTarget(sessions: number): void {
  setMeta(KEYS.weeklyTarget, String(Math.max(1, Math.min(7, Math.round(sessions)))));
}

