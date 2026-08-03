import { currentStreak } from '../streak';

import { dayKeyFor, dayRangeIso, performedAtIso, type DayKey } from './dates';
import { getDb, newId, nowIso } from './index';

export interface WorkoutRow {
  id: string;
  user_id: string;
  performed_at: string;
  raw_text: string;
  /** The athlete's own end-of-session note (§8.1). Null when they skipped. */
  reflection: string | null;
  parse_version: number | null;
  created_at: string;
  updated_at: string;
  dirty: number;
  structure_dirty: number;
  needs_parse: number;
}

/** The workout note for a local day, or null if nothing was logged. */
export function getWorkoutForDay(userId: string, day: DayKey): WorkoutRow | null {
  const [start, end] = dayRangeIso(day);
  return (
    getDb().getFirstSync<WorkoutRow>(
      'SELECT * FROM workouts WHERE user_id = ? AND performed_at >= ? AND performed_at < ? LIMIT 1',
      [userId, start, end],
    ) ?? null
  );
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
    return existing.id;
  }

  const id = newId();
  db.runSync(
    `INSERT INTO workouts (id, user_id, performed_at, raw_text, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
     VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 0, ?)`,
    [id, userId, performedAtIso(day), rawText, now, now, rawText.trim().length > 0 ? 1 : 0],
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

/** How many sessions carry a reflection — the §13 "first reflection" counter's
 * denominator, and the only thing any caller needs to know in aggregate. */
export function countReflections(userId: string): number {
  const row = getDb().getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM workouts WHERE user_id = ? AND reflection IS NOT NULL AND trim(reflection) <> ''",
    [userId],
  );
  return row?.n ?? 0;
}

export function getWorkoutsNeedingParse(userId: string, limit = 5): WorkoutRow[] {
  return getDb().getAllSync<WorkoutRow>(
    'SELECT * FROM workouts WHERE user_id = ? AND needs_parse = 1 ORDER BY updated_at DESC LIMIT ?',
    [userId, limit],
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
 * The streak: consecutive TRAINING DAYS (CLAUDE.md §16.2, PLAN D6).
 *
 * The rule and its tests live in `src/lib/streak.ts`, which is pure. This is
 * only the query that feeds it — the days with a non-empty note. It used to
 * walk back one calendar day at a time, which read Mon/Wed/Fri as 1.
 */
export function computeStreak(userId: string, today: DayKey): number {
  return currentStreak([...getLoggedDayKeys(userId)], today);
}
