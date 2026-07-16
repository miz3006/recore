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

const KEYS = {
  onboardingDone: 'onboarding_done',
  goal: 'pref_goal',
  logSource: 'pref_log_source',
  smallestPlate: 'pref_smallest_plate_kg',
} as const;

export function isOnboardingDone(): boolean {
  return getMeta(KEYS.onboardingDone) === '1';
}

export function markOnboardingDone() {
  setMeta(KEYS.onboardingDone, '1');
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
