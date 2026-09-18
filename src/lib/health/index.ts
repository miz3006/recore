import { Platform } from 'react-native';

import { track } from '@/lib/analytics';
import {
  clearHealthWrites,
  healthLedger,
  markHealthWritten,
  pendingHealthSessions,
  type PendingHealthSession,
} from '@/lib/db/health-writes';
import { devLog, errorText } from '@/lib/log';
import { isHealthWriteEnabled, setHealthWriteEnabled } from '@/lib/prefs';

import { planHealthWorkout, type HealthActivity, type HealthWorkoutPlan } from './plan';

/**
 * APPLE HEALTH, ONE DIRECTION: finished sessions go out as workouts.
 *
 * This file is the only thing in the repository that touches HealthKit. The
 * rules it acts on are in `./plan.ts` — pure, unit-tested, and the place to
 * read about WHY a session is or is not eligible and why no energy figure is
 * ever written. This half is the plumbing: permission, the sweep, and the
 * promises the settings screen is allowed to make.
 *
 * ## Nothing here may delay a screen, a keystroke, or a finish
 *
 * CLAUDE.md §2 rule 1: the app "never blocks a keystroke or workout finish on a
 * model, sync, purchase, or entitlement check". HealthKit is the same kind of
 * dependency and gets the same treatment — every entry point is
 * fire-and-forget, every failure is swallowed into the ledger (the session
 * simply stays unwritten and the next sweep tries again), and the sweep is
 * never awaited by a component.
 *
 * ## The module is loaded LAZILY, and that is deliberate
 *
 * `@kingstinct/react-native-healthkit` is a Nitro module: importing it wires up
 * native HybridObjects at module scope. On a JS bundle running against a binary
 * that predates the pod — an OTA update landing on an older build, which is
 * exactly what `eas update` does — that import throws, and a throw at module
 * scope takes down whatever imported it. Here that would be the You tab.
 *
 * So it is a dynamic `import()` inside a try/catch, resolved once and cached.
 * A build without the native side reports `unavailable` and the screen says so,
 * which is the same outcome as an iPad without HealthKit and needs no second
 * code path.
 *
 * ## Android
 *
 * There is none. HealthKit is Apple's, `Platform.OS` gates every call, and the
 * library's own non-iOS shim returns falsy defaults rather than throwing. Health
 * Connect is a different API, a different permission model and a different
 * product decision; nothing here pretends to be it.
 */

/** What the settings screen has to be able to say out loud. */
export type HealthState =
  /** Not an iPhone, or a build with no HealthKit in it. */
  | 'unavailable'
  /** Available, and nobody has been asked yet. */
  | 'not-asked'
  /** Asked, and Health is letting Recore write. */
  | 'granted'
  /** Asked, and Health is not letting Recore write. Only Settings can undo it. */
  | 'denied';

export interface HealthStatus {
  /** The switch in You. True does not mean anything is moving — see `state`. */
  enabled: boolean;
  state: HealthState;
  /** Sessions of this record that this device has put in Health. */
  written: number;
  /** When the last one went. Null when none has. */
  lastAt: string | null;
  /** Finished sessions that are eligible and still waiting to go across. */
  pending: number;
}

/**
 * HOW MANY SESSIONS ONE SWEEP WRITES.
 *
 * Each one is a native round-trip, and the first sweep after somebody turns the
 * switch on is the big one — a full training history. Fifty at a time keeps
 * that off the main thread's back while still clearing a year of training in a
 * handful of passes, and `sweepHealth` reports whether more is waiting so the
 * screen can say "still going" instead of looking finished.
 */
const BATCH = 50;

/** Recore's own record of what it typed, not what a sensor measured. */
const USER_ENTERED = { HKWasUserEntered: true } as const;

/**
 * Health's numbers for the two kinds of session `plan.ts` will name.
 * `traditionalStrengthTraining` = 50, `mixedCardio` = 73 — Apple's own values,
 * restated here so this file does not have to import the library's enum just to
 * describe itself. `toActivityType` maps through the library's enum at the call
 * site, where the types are checked.
 */
const ACTIVITY_LABEL: Record<HealthActivity, string> = {
  strength: 'Strength training',
  cardio: 'Cardio',
};

// --- the native module, loaded once and never at import time -----------------

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

let loading: Promise<HealthKitModule | null> | null = null;

async function loadHealthKit(): Promise<HealthKitModule | null> {
  if (Platform.OS !== 'ios') return null;
  if (!loading) {
    loading = import('@kingstinct/react-native-healthkit')
      .then((mod) => mod)
      .catch((err: unknown) => {
        // A bundle running on a binary with no HealthKit in it. Said once, at
        // dev volume; the screen reports `unavailable` and nothing retries.
        devLog('healthkit unavailable in this build:', errorText(err));
        return null;
      });
  }
  return loading;
}

/** Is this even a device that could have Health? Cheap and synchronous, so the
 * settings row can decide whether to draw a switch before anything resolves. */
export function isHealthSupported(): boolean {
  return Platform.OS === 'ios';
}

// --- permission --------------------------------------------------------------

/**
 * What Health says about writing workouts, right now.
 *
 * Write status is a question HealthKit answers truthfully, which READ status is
 * not — Apple deliberately refuses to tell an app whether it was granted read
 * access, so that a refusal cannot be detected and nagged about. Recore only
 * writes, so this screen can be specific in a way a reading app could not be.
 */
export async function healthState(): Promise<HealthState> {
  const hk = await loadHealthKit();
  if (!hk) return 'unavailable';
  try {
    if (!hk.isHealthDataAvailable()) return 'unavailable';
    const status = hk.authorizationStatusFor(hk.WorkoutTypeIdentifier);
    if (status === hk.AuthorizationStatus.sharingAuthorized) return 'granted';
    if (status === hk.AuthorizationStatus.sharingDenied) return 'denied';
    return 'not-asked';
  } catch (err) {
    devLog('healthkit status failed:', errorText(err));
    return 'unavailable';
  }
}

/**
 * Turn the switch on: ask Health for permission to write workouts, and only
 * store the preference if it is actually granted.
 *
 * THE ORDER MATTERS. Writing the pref first and asking afterwards would leave a
 * switch sitting in the on position over a permission that was refused — the
 * app claiming to do something it cannot, which is the exact failure the old
 * "not connected" screen existed to avoid.
 *
 * `requestAuthorization` asks for `toShare` and nothing else. No `toRead` is
 * passed anywhere in this file, so the sheet iOS presents has only a write
 * section on it and there is no read permission for Recore to hold.
 *
 * iOS shows the permission sheet ONCE per type, ever. A second call after a
 * refusal resolves without showing anything, which is why the caller has to
 * send somebody to Settings rather than offering to ask again.
 */
export async function enableHealthWrite(): Promise<HealthState> {
  const hk = await loadHealthKit();
  if (!hk) return 'unavailable';

  try {
    if (!hk.isHealthDataAvailable()) return 'unavailable';
    await hk.requestAuthorization({ toShare: [hk.WorkoutTypeIdentifier] });
  } catch (err) {
    devLog('healthkit authorization failed:', errorText(err));
    return 'unavailable';
  }

  const state = await healthState();
  if (state !== 'granted') return state;

  setHealthWriteEnabled(true);
  track('health_write_enabled', {});
  return 'granted';
}

/**
 * Turn it off. It stops Recore adding to Health and it does nothing else —
 * what is already in somebody's Health app stays there, because deleting a
 * person's health records from under them is not a thing a settings toggle is
 * allowed to do. The screen says this in words.
 */
export function disableHealthWrite(): void {
  setHealthWriteEnabled(false);
  track('health_write_disabled', {});
}

// --- the sweep ---------------------------------------------------------------

export interface HealthSweepResult {
  /** Sessions handed to Health by this sweep. */
  written: number;
  /** Eligible sessions still waiting, because the batch filled up. */
  remaining: number;
  /** Why nothing moved, when nothing moved. Null on an ordinary pass. */
  blocked: HealthState | 'off' | null;
}

const IDLE: HealthSweepResult = { written: 0, remaining: 0, blocked: null };

/**
 * WRITE EVERY FINISHED SESSION THAT IS NOT IN HEALTH YET.
 *
 * A sweep rather than a single write at Finish, and the reason is that
 * eligibility arrives late. At the moment somebody presses Finish the note may
 * not have been read yet, so the app does not know what kind of training it
 * was (`plan.ts`, condition 2) — and a session that was ineligible for ten
 * seconds must not be ineligible forever. The same pass also picks up
 * everything a person already had when they turned the switch on, and anything
 * a failed HealthKit call left behind.
 *
 * It is safe to call from anywhere and at any frequency: `pendingHealthSessions`
 * excludes what the ledger already names, so a sweep with nothing to do is two
 * SQLite reads and no native calls at all.
 */
export async function sweepHealth(userId: string): Promise<HealthSweepResult> {
  if (!userId) return IDLE;
  if (!isHealthWriteEnabled()) return { ...IDLE, blocked: 'off' };

  const candidates = pendingHealthSessions(userId);
  const eligible = planAll(candidates);
  if (eligible.length === 0) return IDLE;

  const hk = await loadHealthKit();
  if (!hk) return { ...IDLE, remaining: eligible.length, blocked: 'unavailable' };

  const state = await healthState();
  if (state !== 'granted') {
    return { ...IDLE, remaining: eligible.length, blocked: state };
  }

  const batch = eligible.slice(0, BATCH);
  let written = 0;

  for (const { workoutId, plan } of batch) {
    try {
      await hk.saveWorkoutSample(
        toActivityType(hk, plan.activity),
        // No quantities and no totals: energy and distance are not derivable
        // from a written note, and Health adds whatever it is given to the
        // day's totals as though it had been measured. See `plan.ts`.
        [],
        new Date(plan.startIso),
        new Date(plan.endIso),
        undefined,
        USER_ENTERED,
      );
    } catch (err) {
      // One session failing is not a reason to abandon the rest, and it is not
      // a reason to tell anybody anything: the row stays out of the ledger, so
      // the next sweep tries it again.
      devLog('healthkit write failed:', errorText(err));
      continue;
    }
    markHealthWritten(workoutId, plan.startIso, plan.endIso, plan.activity);
    written += 1;
  }

  if (written > 0) {
    // A count and nothing else (§13, `lib/analytics.ts`): never a date, never
    // a duration, never a lift.
    track('health_sessions_written', { count: written });
    devLog(`apple health — ${written} session(s) written`);
  }

  return { written, remaining: Math.max(0, eligible.length - written), blocked: null };
}

/** Fire-and-forget, for call sites that must not wait: Finish, and the You tab
 * coming into focus. Swallows everything — `sweepHealth` already does. */
export function sweepHealthSoon(userId: string | null): void {
  if (!userId || !isHealthWriteEnabled()) return;
  void sweepHealth(userId).catch(() => {});
}

// --- what the screen reads ---------------------------------------------------

/**
 * Everything You needs in one synchronous call, except the permission, which
 * is native and therefore async (`healthState`). Split that way on purpose: the
 * counts come off SQLite and can be rendered on the first frame, and the
 * permission arrives a tick later without the numbers flickering.
 */
export function healthCounts(userId: string): Omit<HealthStatus, 'state'> {
  const ledger = healthLedger(userId);
  return {
    enabled: isHealthWriteEnabled(),
    written: ledger.written,
    lastAt: ledger.lastAt,
    pending: planAll(pendingHealthSessions(userId)).length,
  };
}

/** The one place the ledger is dropped; see `db/health-writes.ts` for why this
 * is not an undo. */
export function forgetHealthWrites(userId: string): number {
  return clearHealthWrites(userId);
}

export function healthActivityLabel(activity: HealthActivity): string {
  return ACTIVITY_LABEL[activity];
}

// --- internals ---------------------------------------------------------------

function planAll(
  candidates: readonly PendingHealthSession[],
): { workoutId: string; plan: HealthWorkoutPlan }[] {
  const out: { workoutId: string; plan: HealthWorkoutPlan }[] = [];
  for (const candidate of candidates) {
    const plan = planHealthWorkout({
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      modalities: candidate.modalities,
    });
    if (plan) out.push({ workoutId: candidate.workoutId, plan });
  }
  return out;
}

function toActivityType(hk: HealthKitModule, activity: HealthActivity) {
  return activity === 'cardio'
    ? hk.WorkoutActivityType.mixedCardio
    : hk.WorkoutActivityType.traditionalStrengthTraining;
}
