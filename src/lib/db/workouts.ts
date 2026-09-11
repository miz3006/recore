import { currentStreak } from '../streak';

import { dayKeyFor, dayRangeIso, performedAtIso, type DayKey } from './dates';
import { dayWorkoutId } from './day-id';
import { getDb, nowIso } from './index';
import { clearParseBackoff } from './parse-backoff';

export interface WorkoutRow {
  id: string;
  user_id: string;
  performed_at: string;
  raw_text: string;
  /** The athlete's own end-of-session note (§8.1). Null when they skipped. */
  reflection: string | null;
  /** Foster CR-10 rating of the whole session (`lib/session-effort.ts`). Null
   * when they did not answer — an unrated session has no load, never a zero. */
  session_effort: number | null;
  parse_version: number | null;
  created_at: string;
  updated_at: string;
  dirty: number;
  structure_dirty: number;
  needs_parse: number;
  /** Consecutive failed readings of the CURRENT text (`db/parse-backoff.ts`). */
  parse_attempts: number;
  /** ISO instant before which the parse queue skips this note. Null = now. */
  parse_next_at: string | null;
}

/**
 * The workout note for a local day, or null if nothing was logged.
 *
 * **`ORDER BY created_at` is load-bearing, not tidiness.** A day is supposed to
 * hold one row and for a long time held several (see `day-id.ts`), and with no
 * ordering "the day's note" was whichever row SQLite happened to return —
 * which could differ between two reads on one device after a sync. The oldest
 * row is the one the day started as, so it is the one that wins; `id` breaks a
 * tie between two rows written in the same millisecond so the answer is total.
 */
export function getWorkoutForDay(userId: string, day: DayKey): WorkoutRow | null {
  const [start, end] = dayRangeIso(day);
  return (
    getDb().getFirstSync<WorkoutRow>(
      `SELECT * FROM workouts WHERE user_id = ? AND performed_at >= ? AND performed_at < ?
       ORDER BY created_at ASC, id ASC LIMIT 1`,
      [userId, start, end],
    ) ?? null
  );
}

/**
 * WHAT A DAY ALREADY HAS ON IT — Next's "you already trained today" state.
 *
 * A session that is written is not a session that is due, and Next repeating
 * it back as a plan would be the screen failing to read the record it is
 * derived from. This is the smallest true answer to "is today done, and what
 * is on it": how many distinct movements the parse found, and when the note
 * was last touched.
 *
 * `lifts` counts ITEMS, not lines — the parser's own projection of the note —
 * so a movement written twice counts once, the way every other aggregate in
 * the app counts it. Null when the day has no row or the row is still empty:
 * a workout with no text is a day someone opened, not a day they trained.
 */
export function getDaySessionFacts(userId: string, day: DayKey): { lifts: number } | null {
  const workout = getWorkoutForDay(userId, day);
  if (!workout || workout.raw_text.trim() === '') return null;
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(DISTINCT exercise_id) AS n FROM items WHERE workout_id = ? AND exercise_id IS NOT NULL',
    [workout.id],
  );
  return { lifts: row?.n ?? 0 };
}

/**
 * The optimistic write (CLAUDE.md §6 step 1): raw_text lands in SQLite in the
 * same tick as the keystroke. Marks the row dirty for sync and needs_parse for
 * the background parser. Returns the workout id.
 */
export function saveRawText(userId: string, day: DayKey, rawText: string): string {
  const db = getDb();
  const existing = getWorkoutForDay(userId, day);
  const now = nowIso();

  if (existing) {
    db.runSync(
      'UPDATE workouts SET raw_text = ?, updated_at = ?, dirty = 1, needs_parse = ? WHERE id = ?',
      [rawText, now, rawText.trim().length > 0 ? 1 : 0, existing.id],
    );
    // DIFFERENT WORDS, DIFFERENT QUESTION. A note that failed to read has a
    // wait on it (`db/parse-backoff.ts`), and rewriting the line is how a
    // person fixes exactly that — so the wait earned by the old text must not
    // be served by the new one. Only on a real change: re-saving identical text
    // is not a new question, and clearing on it would restore the every-open
    // retry this backoff exists to stop.
    if (existing.raw_text !== rawText) clearParseBackoff(existing.id);
    return existing.id;
  }

  // DERIVED FROM THE PERSON AND THE DAY, never random — see `day-id.ts`. Two
  // devices that both write this day before either has synced now produce the
  // SAME row, so the push upserts instead of adding a second session the
  // person's own app would then hide from them and their coach would not.
  //
  // `INSERT OR IGNORE` guards the one case the derivation cannot: a row for
  // this day that arrived from an older client under a random id and has since
  // been pulled. `getWorkoutForDay` above would have found it and this branch
  // would not run — but a race between a pull and a keystroke is exactly the
  // kind of thing that put six rows on 9 September, so it is spelled out.
  const id = dayWorkoutId(userId, day);
  db.runSync(
    `INSERT OR IGNORE INTO workouts (id, user_id, performed_at, raw_text, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 0, ?)`,
    [id, userId, performedAtIso(day), rawText, now, now, rawText.trim().length > 0 ? 1 : 0],
  );
  // If the row was already there under this id, the insert did nothing — the
  // text still has to land.
  db.runSync(
    'UPDATE workouts SET raw_text = ?, updated_at = ?, dirty = 1, needs_parse = ? WHERE id = ?',
    [rawText, now, rawText.trim().length > 0 ? 1 : 0, id],
  );
  return id;
}

export function getWorkoutById(id: string): WorkoutRow | null {
  return getDb().getFirstSync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', [id]) ?? null;
}

/**
 * Write (or clear) the end-of-session reflection (§8.1).
 *
 * `null` CLEARS it, which is what makes skipping free after the fact: someone
 * who wrote a note and then emptied the field is left with no reflection, not
 * with a stale one.
 *
 * It marks the row `dirty` so sync carries it, and deliberately does NOT touch
 * `needs_parse`: a reflection is not part of `raw_text` and re-parsing because
 * of one would be the app spending a model call on prose it must never read.
 *
 * Synchronous, like every other local write — §2 invariant 1 means the sheet's
 * Done button never waits on a network round trip.
 */
export function setReflection(workoutId: string, reflection: string | null): void {
  getDb().runSync('UPDATE workouts SET reflection = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    reflection,
    nowIso(),
    workoutId,
  ]);
}

/** The reflection on one session, or null. */
export function getReflection(workoutId: string): string | null {
  const row = getDb().getFirstSync<{ reflection: string | null }>(
    'SELECT reflection FROM workouts WHERE id = ?',
    [workoutId],
  );
  return row?.reflection ?? null;
}

/**
 * The session's own rating, on Foster's CR-10 (`lib/session-effort.ts`).
 *
 * The same write shape as `setReflection` directly above, and for the same
 * reasons: `dirty = 1` so sync carries it, `needs_parse` untouched because a
 * rating is not part of `raw_text`, and synchronous so the sheet's Done never
 * waits on a network round trip (§2 invariant 1).
 *
 * Passing null CLEARS it, which is what makes a mis-tap undoable — tapping the
 * armed answer again on the check-in un-answers the question rather than
 * trapping the athlete in the first thing they touched.
 */
export function setSessionEffort(workoutId: string, rpe: number | null): void {
  getDb().runSync(
    'UPDATE workouts SET session_effort = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    [rpe, nowIso(), workoutId],
  );
}

/** The rating on one session, or null when it was never answered. */
export function getSessionEffort(workoutId: string): number | null {
  const row = getDb().getFirstSync<{ session_effort: number | null }>(
    'SELECT session_effort FROM workouts WHERE id = ?',
    [workoutId],
  );
  return row?.session_effort ?? null;
}

/** How many sessions carry a reflection — the §13 "first reflection" counter's
 * denominator, and the only thing any caller needs to know in aggregate. */
export function countReflections(userId: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND reflection IS NOT NULL AND trim(reflection) <> ''",
    [userId],
  );
  return row?.n ?? 0;
}

/**
 * SESSIONS THAT HAVE NOT REACHED THE SERVER YET — what signing out would cost.
 *
 * Signing out re-scopes the local database, and re-scoping to a different user
 * WIPES it (`ensureLocalUser`). That is the right default: a device with nobody
 * signed in should not hold an account's training. It is only safe because sync
 * has already carried the record — and `dirty = 1` is exactly the set of rows
 * for which that is not yet true.
 *
 * So this is not a diagnostic, it is the number the confirmation has to say out
 * loud. Somebody who wrote three sessions underground and signs out at the
 * airport is about to lose them, and the alert used to promise the opposite in
 * so many words: "Your training stays on this device."
 *
 * Empty notes are excluded — a day someone opened and did not write on is not a
 * session, which is the same rule `countSessions` and the calendar dots use.
 */
export function countUnsyncedSessions(userId: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND dirty = 1 AND trim(raw_text) <> ''",
    [userId],
  );
  return row?.n ?? 0;
}

/**
 * The parse queue: notes with no reading, oldest failure last.
 *
 * TWO CLAUSES THAT ARE NOT TIDINESS (10 September 2026). This used to be
 * `needs_parse = 1 ORDER BY updated_at DESC`, and both halves of that were
 * wrong in the same way — they had no memory of what had already been tried.
 *
 *  · **The wait.** `parse_next_at` is `db/parse-backoff.ts`'s doing and its
 *    header carries the reasoning: a note the parser cannot read used to ask
 *    the model again on every app open, for ever, at the project owner's
 *    expense.
 *  · **The order.** `updated_at DESC` alone means five unreadable notes at the
 *    top of the queue are the same five on every pass — so an imported history
 *    behind them is never read at all. Fewest failures first is what makes that
 *    starvation impossible: a note that has never been tried always outranks
 *    one that has failed, and among equals the newest still wins.
 */
export function getWorkoutsNeedingParse(userId: string, limit = 5): WorkoutRow[] {
  return getDb().getAllSync<WorkoutRow>(
    `SELECT * FROM workouts
      WHERE user_id = ? AND needs_parse = 1
        AND (parse_next_at IS NULL OR parse_next_at <= ?)
      ORDER BY parse_attempts ASC, updated_at DESC
      LIMIT ?`,
    [userId, nowIso(), limit],
  );
}

/** Every local day that has a non-empty note — the calendar's training dots. */
export function getLoggedDayKeys(userId: string): Set<DayKey> {
  const rows = getDb().getAllSync<{ performed_at: string }>(
    "SELECT performed_at FROM workouts WHERE user_id = ? AND trim(raw_text) <> '' ORDER BY performed_at DESC LIMIT 730",
    [userId],
  );
  return new Set(rows.map((r) => dayKeyFor(new Date(r.performed_at))));
}

/**
 * Sessions on the record, all time — the top bar's one figure (owner, 11 Aug
 * 2026).
 *
 * It replaced the bare streak numeral there, and the reason is §20 rather than
 * arithmetic: a number that goes DOWN when you rest is a daily goal wearing a
 * serious face, and this product does not set daily goals. A total only ever
 * grows, and it means exactly what it says. The streak rule itself survives
 * untouched in `lib/streak.ts` for the consistency sheet, which explains its
 * own tolerance in words.
 *
 * A session = a day with a non-empty note, the same definition the calendar
 * dots and the week chart use, so the three can never disagree.
 */
export function countSessions(userId: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND trim(raw_text) <> ''",
    [userId],
  );
  return row?.n ?? 0;
}

/**
 * The streak: consecutive TRAINING DAYS (CLAUDE.md §16.2, PLAN D6).
 *
 * The rule and its tests live in `src/lib/streak.ts`, which is pure. This is
 * only the query that feeds it — the days with a non-empty note. It used to
 * walk back one calendar day at a time, which read Mon/Wed/Fri as 1.
 */
export function computeStreak(userId: string, today: DayKey): number {
  return currentStreak([...getLoggedDayKeys(userId)], today);
}
