import { nextAttemptAt, type ParseFailureKind } from '@/lib/parse/backoff';

import { getDb } from './index';

/**
 * THE PARSE RETRY'S MEMORY — the database half of `parse/backoff.ts`.
 *
 * The rule itself (how long, and why it never gives up) lives there, pure and
 * tested. This file is only the two columns it acts on: `parse_attempts`, the
 * consecutive failed readings of the CURRENT text, and `parse_next_at`, the
 * instant the queue may look at the note again. Both are LOCAL-ONLY, like every
 * other sync/parse flag on the row — never pushed, never pulled.
 *
 * ## What resets it
 *
 * The text changing (`saveRawText`), a reading landing (`parse/client.ts`),
 * text arriving from another device (the pull), and the owner-facing "clear
 * local cache" repair. All four mean "this is a different question now" — and
 * the first is the one that matters, because rewriting the line is how a person
 * actually fixes an unreadable one, and they must not then wait out a backoff
 * earned by the words they just deleted.
 *
 * ## What is NOT a failure
 *
 * Being offline and being signed out. Neither reached the model, neither cost
 * anything, and both are the ordinary state of a phone in a gym. Counting them
 * would push a perfectly readable note into a day-long wait for the sole
 * offence of having been written underground. `parse/client.ts` draws that line
 * on `FunctionsFetchError`.
 *
 * ## What KIND of failure it was
 *
 * A reply that did reach the model is still not necessarily about the note: a
 * 502 from a provider outage, a 429 from a window, a 402 from an entitlement.
 * `parse/client.ts` reads the status off the reply and names the kind; the
 * ladder that kind picks lives in `parse/backoff.ts`, with the reasoning. The
 * counter stays one number either way — the LAST failure chooses the ladder.
 */

/**
 * Record that a reading was attempted and did not land: bump the counter and
 * put the note to sleep for the matching wait.
 *
 * Local bookkeeping only — it touches neither `updated_at` nor `dirty`, so it
 * cannot make a note look edited, cannot re-order the day list, and cannot
 * cause a push.
 */
export function recordParseFailure(workoutId: string, kind: ParseFailureKind = 'note'): void {
  const db = getDb();
  const row = db.getFirstSync<{ parse_attempts: number | null }>(
    'SELECT parse_attempts FROM workouts WHERE id = ?',
    [workoutId],
  );
  if (!row) return;

  const attempts = (row.parse_attempts ?? 0) + 1;
  db.runSync('UPDATE workouts SET parse_attempts = ?, parse_next_at = ? WHERE id = ?', [
    attempts,
    nextAttemptAt(attempts, new Date(), kind).toISOString(),
    workoutId,
  ]);
}

/**
 * THE WRITING HOLD (15 Sep 2026, owner's ruling — twice). First ruling: the
 * note parses when the athlete says it is done, not while they are
 * mid-sentence. Second, same day, after seeing it run: **not on a timer
 * either** — "naj sploh ne začne delati parser dokler nekdo ne klikne gor".
 * So the hold does not expire. A typed note is read when, and only when,
 * something the athlete did asks for it: the check control, a checklist tap,
 * a correction, a delete — every one of them lands in `requestParse`, which
 * clears this hold.
 *
 * It parks the note on the SAME column the failure backoff uses
 * (`parse_next_at`), so the deferred queue (`getWorkoutsNeedingParse`) skips
 * it with no schema change — a new synced column is the sync breaker the
 * memory notes warn about. `needs_parse` stays 1 the whole time, because that
 * flag means "the structure does not belong to this text" and rehydrate
 * (`parse/rehydrate.ts`) refuses stale rebuilds on exactly that reading.
 *
 * The one writer that WANTS the old queue behaviour — the onboarding seed —
 * says so itself by clearing the hold after it writes.
 *
 * Attempts reset with it for the same reason `clearParseBackoff` resets them:
 * changed words are a different question.
 */
const WRITING_HOLD_UNTIL = '9999-12-31T00:00:00.000Z';

export function holdParseForWriting(workoutId: string): void {
  getDb().runSync('UPDATE workouts SET parse_attempts = 0, parse_next_at = ? WHERE id = ?', [
    WRITING_HOLD_UNTIL,
    workoutId,
  ]);
}

/** A reading landed, or the words changed — this note is eligible again now. */
export function clearParseBackoff(workoutId: string): void {
  getDb().runSync('UPDATE workouts SET parse_attempts = 0, parse_next_at = NULL WHERE id = ?', [
    workoutId,
  ]);
}

/** Every note of an account gets one more free try (the cache repair). */
export function clearAllParseBackoff(userId: string): void {
  getDb().runSync(
    'UPDATE workouts SET parse_attempts = 0, parse_next_at = NULL WHERE user_id = ?',
    [userId],
  );
}
