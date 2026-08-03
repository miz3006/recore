/**
 * The trial clock — PURE, zero imports, zero I/O, so it is unit-tested under
 * plain `node --test` like the prediction engine.
 *
 * It exists because of the promise on the paywall (product-direction §2.2): the
 * timeline says a reminder arrives before the charge, and a user who relies on
 * that and gets charged anyway is a refund, a chargeback and a one-star review
 * in one move. The IN-APP reminder is the floor — it needs no permission, so it
 * stays true for a user who denies notifications. A local notification is the
 * upgrade on top of this, never the whole thing.
 *
 * THE CHARGE INSTANT COMES FROM THE STORE (29 Jul 2026). `trialClockAt` takes
 * the expiry Apple reported for the entitlement, because that is the only date
 * that is true: sandbox trials are compressed to minutes, storefronts differ,
 * and a locally derived "start + 7 days" drifts away from the real charge the
 * first time any of that bites. `trialClock` keeps the local derivation for the
 * ONE surface that has no store answer yet — the paywall preview, before
 * anything has been bought.
 *
 * Everything here is an INSTANT, not a calendar day: the store charges 7×24h
 * after the trial starts, wherever the user flies in between.
 */
// Zero imports on purpose (like predict/engine.ts): it runs under `node --test`.
const DAY_MS = 86_400_000;

/** Seven days. Ruled twice — not one month, not fourteen days. */
export const TRIAL_DAYS = 7;

/**
 * How long before the charge the reminder is owed. Two days, which on a
 * seven-day trial is day 5 — the row the paywall's own timeline promises.
 *
 * Expressed as a LEAD TIME rather than a day number so it stays correct if the
 * store ever reports a trial of a different length; the promise is "before the
 * charge", not "on day five".
 */
export const REMINDER_LEAD_DAYS = 2;

/** Kept for the day the reminder lands on a standard seven-day trial. */
export const REMINDER_DAY = TRIAL_DAYS - REMINDER_LEAD_DAYS;

export type TrialPhase =
  /** Before the reminder window. Nothing to say. */
  | 'running'
  /** Inside the lead time — the reminder is owed. */
  | 'reminder'
  /** The charge instant has passed; the store has charged (or the user cancelled). */
  | 'charged';

export interface TrialClock {
  phase: TrialPhase;
  /** Whole days elapsed since the trial started. Day 0 is the first day. */
  day: number;
  /** The instant the store charges. */
  chargeAtMs: number;
  /** Whole days from now to the charge, rounded up, never below zero. */
  daysUntilCharge: number;
}

/**
 * The clock, from the two instants the store actually reports: when the trial
 * period began and when it expires. This is the form every shipped surface
 * uses once there is a real subscription.
 */
export function trialClockAt(startedAtMs: number, chargeAtMs: number, nowMs: number): TrialClock {
  const elapsed = nowMs - startedAtMs;
  // A clock skewed backwards (or a start stamped in the future) reads as day 0
  // rather than a negative day — the reminder is never owed early.
  const day = Math.max(0, Math.floor(elapsed / DAY_MS));
  const daysUntilCharge = Math.max(0, Math.ceil((chargeAtMs - nowMs) / DAY_MS));

  const phase: TrialPhase =
    nowMs >= chargeAtMs
      ? 'charged'
      : daysUntilCharge <= REMINDER_LEAD_DAYS
        ? 'reminder'
        : 'running';

  return { phase, day, chargeAtMs, daysUntilCharge };
}

/**
 * The clock derived from a start instant and a trial length. The paywall's
 * preview of "what happens if you start today" is the only caller that has no
 * store answer to use instead.
 */
export function trialClock(startedAtMs: number, nowMs: number, trialDays = TRIAL_DAYS): TrialClock {
  return trialClockAt(startedAtMs, startedAtMs + trialDays * DAY_MS, nowMs);
}

/**
 * Whether the in-app reminder is owed on this open. Shown ONCE: a user who
 * opens on day 6 having missed day 5 still gets it, and a user who has already
 * seen it is not nagged (§2.2 — one notice, no repetition).
 */
export function shouldShowTrialReminder(
  clock: TrialClock | null,
  alreadyShown: boolean,
): boolean {
  if (clock == null) return false;
  if (alreadyShown) return false;
  return clock.phase === 'reminder';
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "4 Aug 2026" — the one date format for a charge, wherever it is stated. */
export function formatChargeDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}
