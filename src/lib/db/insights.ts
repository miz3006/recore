import { dayKeyFor, dayRangeIso, type DayKey } from './dates';
import { getDb } from './index';

/**
 * Read-side aggregates for the surfaces that make Recore feel like a paid
 * product: the predictor's public track record, the all-time PR ledger, and
 * per-session summaries for the training log. Everything here is a synchronous
 * SELECT over data other systems already write — no new writes, no network.
 */

export interface AdherenceRecord {
  followed: number;
  edited: number;
  ignored: number;
  settled: number;
}

/**
 * The predictor's track record over its most recent settled ghosts
 * (CLAUDE.md §7.2 Gap 3 — the trust surface). "Followed" is strict: the note
 * matched the prescription. Callers should stay silent below 3 settled rows —
 * a record of one is noise, not evidence.
 */
export function getAdherenceRecord(userId: string, window = 10): AdherenceRecord {
  const rows = getDb().getAllSync<{ outcome: string }>(
    `SELECT outcome FROM predictions
     WHERE user_id = ? AND outcome IS NOT NULL
     ORDER BY for_date DESC LIMIT ?`,
    [userId, window],
  );
  const count = (o: string) => rows.filter((r) => r.outcome === o).length;
  return {
    followed: count('followed'),
    edited: count('edited'),
    ignored: count('ignored'),
    settled: rows.length,
  };
}

export interface PrRecord {
  canonical: string;
  weightKg: number;
  reps: number | null;
  day: DayKey;
}

/**
 * The record book: each exercise's heaviest counted set (warm-ups and drops
 * excluded), heaviest first. The gutter's PR pill is a boolean; these are the
 * numbers behind it.
 */
export function getAllTimePRs(userId: string, limit = 12): PrRecord[] {
  const rows = getDb().getAllSync<{
    canonical: string;
    weight_kg: number;
    reps: number | null;
    performed_at: string;
  }>(
    `SELECT canonical, weight_kg, reps, performed_at FROM (
       SELECT e.canonical AS canonical, s.weight_kg AS weight_kg, s.reps AS reps,
              w.performed_at AS performed_at,
              ROW_NUMBER() OVER (
                PARTITION BY lower(e.canonical)
                ORDER BY s.weight_kg DESC, COALESCE(s.reps, 0) DESC, w.performed_at ASC
              ) AS rn
       FROM sets s
       JOIN items i ON s.item_id = i.id
       JOIN workouts w ON i.workout_id = w.id
       JOIN exercises e ON e.id = i.exercise_id
       WHERE w.user_id = ? AND s.kind NOT IN ('warmup', 'drop', 'skipped') AND s.weight_kg IS NOT NULL
     ) WHERE rn = 1
     ORDER BY weight_kg DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((r) => ({
    canonical: r.canonical,
    weightKg: r.weight_kg,
    reps: r.reps,
    day: dayKeyFor(new Date(r.performed_at)),
  }));
}

export interface SessionBrief {
  workoutId: string;
  day: DayKey;
  exercises: number;
  sets: number;
  volume: number;
}

/** Recent PARSED training days, newest first — the scrollable log the
 * calendar's dots never provided. Warm-ups are excluded from all volume math;
 * prose-only notes (no parsed items) never become log rows. `beforeDay` cuts
 * in SQL (local-midnight ISO, same pattern as getWorkoutForDay) so pagination
 * can never silently drop older history. */
export function getRecentSessions(userId: string, limit = 10, beforeDay?: DayKey): SessionBrief[] {
  const cutoff = beforeDay ? dayRangeIso(beforeDay)[0] : null;
  const rows = getDb().getAllSync<{
    id: string;
    performed_at: string;
    exercises: number;
    sets: number;
    volume: number | null;
  }>(
    `SELECT w.id, w.performed_at,
            COUNT(DISTINCT i.exercise_id) AS exercises,
            COUNT(CASE WHEN s.kind NOT IN ('warmup', 'skipped') THEN s.id END) AS sets,
            SUM(CASE WHEN s.kind NOT IN ('warmup', 'skipped') AND s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                     THEN s.reps * s.weight_kg ELSE 0 END) AS volume
     FROM workouts w
     LEFT JOIN items i ON i.workout_id = w.id
     LEFT JOIN sets s ON s.item_id = i.id
     WHERE w.user_id = ? AND trim(w.raw_text) <> ''` +
      (cutoff ? ' AND w.performed_at < ?' : '') +
      ` GROUP BY w.id
     HAVING COUNT(i.id) > 0
     ORDER BY w.performed_at DESC LIMIT ?`,
    cutoff ? [userId, cutoff, limit] : [userId, limit],
  );
  return rows.map((r) => ({
    workoutId: r.id,
    day: dayKeyFor(new Date(r.performed_at)),
    exercises: r.exercises,
    sets: r.sets,
    volume: Math.round(r.volume ?? 0),
  }));
}

/** The top exercises of one session, in logged order — the peek card's copy. */
export function getSessionExerciseNames(workoutId: string, limit = 3): string[] {
  const rows = getDb().getAllSync<{ canonical: string }>(
    `SELECT DISTINCT e.canonical AS canonical
     FROM items i JOIN exercises e ON e.id = i.exercise_id
     WHERE i.workout_id = ?
     ORDER BY i.position LIMIT ?`,
    [workoutId, limit],
  );
  return rows.map((r) => r.canonical);
}

export interface WorkoutSet {
  position: number;
  kind: string; // working | warmup | drop
  reps: number | null;
  weightKg: number | null;
  distanceM: number | null;
  durationS: number | null;
  rir: number | null;
  parentSetId: string | null;
}

export interface WorkoutExercise {
  itemId: string;
  canonical: string;
  /** Shared across items = a superset/triset/circuit (CLAUDE.md §5). */
  groupKey: string | null;
  sets: WorkoutSet[];
}

export interface WorkoutDetail {
  workoutId: string;
  day: DayKey;
  performedAt: string;
  exercises: WorkoutExercise[];
  /** Counted sets (warm-ups excluded, matching the training log). */
  countedSets: number;
  volume: number;
}

/**
 * The forensic set-by-set record for one workout — the deepest honest layer we
 * can draw from `sets` (CLAUDE.md §9 receipt/ledger, the SessionSheet in the
 * progress spec). Ordered items (prose lines excluded by the exercise JOIN),
 * each with its ordered sets verbatim. Warm-ups are kept but flagged, so the
 * view can dim them and drop them from totals — the same rule the rest of the
 * app's volume math follows. Pure synchronous reads, no network.
 */
export function getWorkoutDetail(workoutId: string): WorkoutDetail | null {
  const db = getDb();
  const w = db.getFirstSync<{ performed_at: string }>(
    'SELECT performed_at FROM workouts WHERE id = ?',
    [workoutId],
  );
  if (!w) return null;

  const items = db.getAllSync<{ id: string; canonical: string; group_key: string | null }>(
    `SELECT i.id, e.canonical AS canonical, i.group_key
     FROM items i JOIN exercises e ON e.id = i.exercise_id
     WHERE i.workout_id = ?
     ORDER BY i.position`,
    [workoutId],
  );

  let countedSets = 0;
  let volume = 0;
  const exercises: WorkoutExercise[] = items.map((it) => {
    const rows = db.getAllSync<{
      position: number;
      kind: string;
      reps: number | null;
      weight_kg: number | null;
      distance_m: number | null;
      duration_s: number | null;
      rir: number | null;
      parent_set_id: string | null;
    }>(
      `SELECT position, kind, reps, weight_kg, distance_m, duration_s, rir, parent_set_id
       FROM sets WHERE item_id = ? ORDER BY position`,
      [it.id],
    );
    const sets: WorkoutSet[] = rows.map((s) => {
      if (s.kind !== 'warmup' && s.kind !== 'skipped') {
        countedSets += 1;
        if (s.reps != null && s.weight_kg != null) volume += s.reps * s.weight_kg;
      }
      return {
        position: s.position,
        kind: s.kind,
        reps: s.reps,
        weightKg: s.weight_kg,
        distanceM: s.distance_m,
        durationS: s.duration_s,
        rir: s.rir,
        parentSetId: s.parent_set_id,
      };
    });
    return { itemId: it.id, canonical: it.canonical, groupKey: it.group_key, sets };
  });

  return {
    workoutId,
    day: dayKeyFor(new Date(w.performed_at)),
    performedAt: w.performed_at,
    exercises,
    countedSets,
    volume: Math.round(volume),
  };
}

export interface E1rmPoint {
  day: DayKey;
  e1rm: number;
}

/**
 * Per-session Epley e1RM series for one exercise (best counted set ≤ 12 reps
 * per session), oldest first — the trend line serious lifters actually chase.
 */
export function getE1rmSeries(userId: string, canonical: string, limit = 24): E1rmPoint[] {
  const rows = getDb().getAllSync<{ performed_at: string; e1rm: number | null }>(
    `SELECT w.performed_at, MAX(s.weight_kg * (1 + s.reps / 30.0)) AS e1rm
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     JOIN exercises e ON e.id = i.exercise_id
     WHERE w.user_id = ? AND lower(e.canonical) = lower(?)
       AND s.kind NOT IN ('warmup', 'drop', 'skipped')
       AND s.reps IS NOT NULL AND s.reps <= 12 AND s.weight_kg IS NOT NULL
     GROUP BY w.id
     ORDER BY w.performed_at DESC LIMIT ?`,
    [userId, canonical, limit],
  );
  return rows
    .filter((r) => r.e1rm != null)
    .map((r) => ({
      day: dayKeyFor(new Date(r.performed_at)),
      e1rm: Math.round((r.e1rm as number) / 0.5) * 0.5,
    }))
    .reverse();
}
