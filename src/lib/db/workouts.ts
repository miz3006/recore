import { dayKeyFor, dayRangeIso, performedAtIso, type DayKey } from './dates';
import { getDb, newId, nowIso } from './index';

export interface WorkoutRow {
  id: string;
  user_id: string;
  performed_at: string;
  raw_text: string;
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
 * The streak (CLAUDE.md §15.3, D3) — **consecutive weeks in which the user met
 * their own weekly target**, not consecutive days.
 *
 * This is a deliberate departure from every competitor and it is the whole
 * point. A daily streak in a training app punishes rest days, and rest days are
 * training: an app that makes a lifter feel guilty on their programmed off-day
 * is working against the thing it claims to support. Worse, the moment they miss
 * one the number resets and the mechanic becomes a reason to leave.
 *
 * Three sessions a week means three sessions. Tuesday/Thursday/Sunday scores
 * exactly the same as Monday/Wednesday/Friday, and a week with four against a
 * target of three is a met week, not a bonus.
 *
 * The CURRENT week is counted only once it has been met — a week still in
 * progress can never break the streak, it just has not earned its point yet.
 */
export function computeWeekStreak(userId: string, today: DayKey, target: number): number {
  const rows = getDb().getAllSync<{ performed_at: string }>(
    "SELECT performed_at FROM workouts WHERE user_id = ? AND trim(raw_text) <> '' ORDER BY performed_at DESC LIMIT 800",
    [userId],
  );

  // Distinct trained days per ISO week, keyed by that week's Monday.
  const perWeek = new Map<string, Set<DayKey>>();
  for (const row of rows) {
    const day = dayKeyFor(new Date(row.performed_at));
    const monday = mondayKeyOf(day);
    const days = perWeek.get(monday) ?? new Set<DayKey>();
    days.add(day);
    perWeek.set(monday, days);
  }

  const met = (monday: string) => (perWeek.get(monday)?.size ?? 0) >= Math.max(1, target);

  let cursor = mondayKeyOf(today);
  let streak = 0;
  // A week in progress is not a broken week; step back and start counting there.
  if (!met(cursor)) cursor = shiftDays(cursor, -7);
  while (met(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -7);
  }
  return streak;
}

/** The Monday of a day's week. Local time, Monday-first (§15.3 counts weeks). */
function mondayKeyOf(day: DayKey): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const offset = (date.getDay() + 6) % 7;
  return dayKeyFor(new Date(y!, m! - 1, d! - offset));
}

function shiftDays(day: DayKey, delta: number): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  return dayKeyFor(new Date(y!, m! - 1, d! + delta));
}
