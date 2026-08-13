/**
 * Is a session still HAPPENING? — PURE, runs under `node --test`.
 *
 * Today's bottom pill and the end-of-session reflection row ask the same
 * question from opposite sides, so the rule lives once here rather than twice
 * in two components that would drift apart (owner, 11 Aug 2026).
 *
 * A session is ACTIVE while the athlete is still in the gym: something has been
 * logged, the note was touched within the last hour and a half, and Finish has
 * not been pressed. Everything else — a finished session, yesterday's record, a
 * day the note was opened and left alone — is SETTLED.
 *
 * NO TIMER RUNS AGAINST THE ATHLETE. Nothing expires, nothing is lost and
 * nothing is judged at the boundary; the only thing that changes is which of
 * two true sentences the pill says (the live set, or the day's totals), and
 * whether the quiet "add a note about this session" row has appeared yet
 * (§20 — no countdown pressure, no daily goals).
 */

/**
 * How long after the last written set a session still reads as live. Ninety
 * minutes is long enough to cover a heavy squat session's rest periods and
 * short enough that a morning workout has settled by lunch.
 */
export const SESSION_IDLE_MS = 90 * 60 * 1000;

export interface SessionActivity {
  /** Sets are on the record for this day. */
  hasSets: boolean;
  /** Epoch ms of the last write to the note, or null when nothing was written. */
  lastActivityAt: number | null;
  /** The athlete pressed Finish on this session. */
  finished: boolean;
}

/** Still in the gym: work logged, recently touched, not finished. */
export function isSessionActive(a: SessionActivity, now: number): boolean {
  if (!a.hasSets || a.finished || a.lastActivityAt == null) return false;
  return now - a.lastActivityAt < SESSION_IDLE_MS;
}

/**
 * When does an active session go quiet? Returns the delay in ms until the
 * activity answer could change, or null when nothing is pending — so a screen
 * can schedule ONE timeout at the exact boundary instead of polling the clock.
 */
export function msUntilSettled(a: SessionActivity, now: number): number | null {
  if (!isSessionActive(a, now)) return null;
  return Math.max(0, a.lastActivityAt! + SESSION_IDLE_MS - now);
}
