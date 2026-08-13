import { dayKeyFor, type DayKey } from './dates';
import { getDb } from './index';

/**
 * History for the exercise bottom sheet (CLAUDE.md §8): last 10 sessions, a
 * weight-per-session series for the progression chart, and an estimated 1RM
 * (Epley over
 * the best counted set — warm-ups and drops excluded, sane rep cap so a 20-rep
 * burnout doesn't fake a max).
 */
export interface ExerciseSession {
  day: DayKey;
  performedAt: string;
  topWeight: number | null;
  topReps: number | null;
  setCount: number;
  volume: number;
  /**
   * What the athlete wrote about this lift on that day, in the order they wrote
   * it — the inline remarks the parser lifted out of the line ("zadnjo serijo
   * forma padla"). Quoted back verbatim or not at all: nothing here is
   * summarised, scored, or read by any prescription.
   *
   * Empty for every session logged before PARSE_VERSION 6, and empty for a
   * session where nothing was written. Both are ordinary states, not gaps.
   */
  notes: string[];
}

export interface ExerciseStats {
  canonical: string;
  sessions: ExerciseSession[]; // oldest → newest, up to 10
  e1rm: number | null;
  /** Every session ever recorded for this lift. `sessions` is capped at 10, so
   * the sheet's "24 sessions" reading cannot be derived from its length. */
  sessionCount: number;
  /** The first day this lift was ever recorded — the record's own start. */
  firstDay: DayKey | null;
  /** All-time counted tonnage for this lift (0 for bodyweight work, which has
   * no weight to multiply — the sheet reads reps instead). */
  volumeTotal: number;
  /** All-time counted reps for this lift. */
  repsTotal: number;
}

export function getExerciseStats(userId: string, canonical: string): ExerciseStats | null {
  const db = getDb();

  const exercises = db.getAllSync<{ id: string; canonical: string }>(
    'SELECT id, canonical FROM exercises WHERE lower(canonical) = lower(?) AND (user_id = ? OR user_id IS NULL)',
    [canonical, userId],
  );
  if (exercises.length === 0) return null;
  const ids = exercises.map((e) => e.id);
  const idList = ids.map(() => '?').join(',');

  const workouts = db.getAllSync<{ id: string; performed_at: string }>(
    `SELECT DISTINCT w.id, w.performed_at FROM workouts w
     JOIN items i ON i.workout_id = w.id
     WHERE w.user_id = ? AND i.exercise_id IN (${idList})
     ORDER BY w.performed_at DESC LIMIT 10`,
    [userId, ...ids],
  );
  if (workouts.length === 0) return null;

  const sessions: ExerciseSession[] = workouts
    .map((w) => {
      const sets = db.getAllSync<{
        kind: string;
        reps: number | null;
        weight_kg: number | null;
        note: string | null;
      }>(
        // Ordered so the remarks read back in the order they were written.
        `SELECT s.kind, s.reps, s.weight_kg, s.note FROM sets s
         JOIN items i ON s.item_id = i.id
         WHERE i.workout_id = ? AND i.exercise_id IN (${idList})
         ORDER BY i.position, s.position`,
        [w.id, ...ids],
      );
      const counted = sets.filter(
        (s) => s.kind !== 'warmup' && s.kind !== 'drop' && s.kind !== 'skipped',
      );
      let topWeight: number | null = null;
      let topReps: number | null = null;
      let volume = 0;
      for (const s of counted) {
        if (s.weight_kg != null && (topWeight === null || s.weight_kg > topWeight)) {
          topWeight = s.weight_kg;
          topReps = s.reps;
        } else if (s.weight_kg === topWeight && s.reps != null) {
          topReps = Math.max(topReps ?? 0, s.reps);
        }
        if (s.reps != null && s.weight_kg != null) volume += s.reps * s.weight_kg;
      }
      // Bodyweight movements: reps carry the story.
      if (topWeight === null) {
        const reps = counted.map((s) => s.reps).filter((r): r is number => r != null);
        topReps = reps.length ? Math.max(...reps) : null;
      }
      return {
        day: dayKeyFor(new Date(w.performed_at)),
        performedAt: w.performed_at,
        topWeight,
        topReps,
        setCount: counted.length,
        volume: Math.round(volume),
        // Every remark on the lift that day, warmups included — the athlete
        // wrote it, so it is theirs to read back.
        notes: sets
          .map((s) => s.note?.trim())
          .filter((n): n is string => !!n && n.length > 0),
      };
    })
    .reverse(); // oldest → newest for the chart

  const e1rmRow = db.getFirstSync<{ e1rm: number | null }>(
    `SELECT MAX(s.weight_kg * (1 + s.reps / 30.0)) AS e1rm FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ? AND i.exercise_id IN (${idList})
       AND s.kind NOT IN ('warmup','drop','skipped') AND s.reps IS NOT NULL AND s.reps <= 12
       AND s.weight_kg IS NOT NULL`,
    [userId, ...ids],
  );
  const e1rm = e1rmRow?.e1rm != null ? Math.round(e1rmRow.e1rm / 0.5) * 0.5 : null;

  // The whole record, not the charted window: the stat row says how many times
  // this lift has ever been trained and how much work is in it, and the
  // ten-session cap above would silently cap both readings.
  //
  // LEFT JOIN, so a session whose sets were all skipped still counts as a
  // session while contributing no work — and the join carries §1.1 invariant
  // 5's exclusion list itself, like every other aggregate in the app.
  const totals = db.getFirstSync<{
    n: number;
    first_at: string | null;
    volume: number | null;
    reps: number | null;
  }>(
    `SELECT COUNT(DISTINCT w.id) AS n,
            MIN(w.performed_at) AS first_at,
            SUM(CASE WHEN s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                     THEN s.reps * s.weight_kg END) AS volume,
            SUM(s.reps) AS reps
     FROM workouts w
     JOIN items i ON i.workout_id = w.id
     LEFT JOIN sets s ON s.item_id = i.id
       AND s.kind NOT IN ('warmup','drop','skipped')
     WHERE w.user_id = ? AND i.exercise_id IN (${idList})`,
    [userId, ...ids],
  );

  return {
    canonical: exercises[0]!.canonical,
    sessions,
    e1rm,
    sessionCount: totals?.n ?? sessions.length,
    firstDay: totals?.first_at ? dayKeyFor(new Date(totals.first_at)) : null,
    volumeTotal: Math.round(totals?.volume ?? 0),
    repsTotal: Math.round(totals?.reps ?? 0),
  };
}
