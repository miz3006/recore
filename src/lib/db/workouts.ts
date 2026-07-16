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

/** Streak: consecutive local days with a non-empty note, ending today (or
 * yesterday, so the streak doesn't read as broken before today's session). */
export function computeStreak(userId: string, today: DayKey): number {
  const rows = getDb().getAllSync<{ performed_at: string }>(
    "SELECT performed_at FROM workouts WHERE user_id = ? AND trim(raw_text) <> '' ORDER BY performed_at DESC LIMIT 400",
    [userId],
  );
  const days = new Set(
    rows.map((r) => {
      const d = new Date(r.performed_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }),
  );

  let cursor = today;
  if (!days.has(cursor)) {
    // No workout yet today — the streak counts back from yesterday.
    const [y, m, d] = cursor.split('-').map(Number);
    const prev = new Date(y!, m! - 1, d! - 1);
    cursor = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    const prev = new Date(y!, m! - 1, d! - 1);
    cursor = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  }
  return streak;
}
