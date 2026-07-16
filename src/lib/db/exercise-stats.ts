import { dayKeyFor, type DayKey } from './dates';
import { getDb } from './index';

/**
 * History for the exercise bottom sheet (CLAUDE.md §8): last 5 sessions, a
 * volume/weight series for the mini chart, and an estimated 1RM (Epley over
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
}

export interface ExerciseStats {
  canonical: string;
  sessions: ExerciseSession[]; // oldest → newest, up to 5
  e1rm: number | null;
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
     ORDER BY w.performed_at DESC LIMIT 5`,
    [userId, ...ids],
  );
  if (workouts.length === 0) return null;

  const sessions: ExerciseSession[] = workouts
    .map((w) => {
      const sets = db.getAllSync<{ kind: string; reps: number | null; weight_kg: number | null }>(
        `SELECT s.kind, s.reps, s.weight_kg FROM sets s
         JOIN items i ON s.item_id = i.id
         WHERE i.workout_id = ? AND i.exercise_id IN (${idList})`,
        [w.id, ...ids],
      );
      const counted = sets.filter((s) => s.kind !== 'warmup' && s.kind !== 'drop');
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
      };
    })
    .reverse(); // oldest → newest for the chart

  const e1rmRow = db.getFirstSync<{ e1rm: number | null }>(
    `SELECT MAX(s.weight_kg * (1 + s.reps / 30.0)) AS e1rm FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ? AND i.exercise_id IN (${idList})
       AND s.kind NOT IN ('warmup','drop') AND s.reps IS NOT NULL AND s.reps <= 12
       AND s.weight_kg IS NOT NULL`,
    [userId, ...ids],
  );
  const e1rm = e1rmRow?.e1rm != null ? Math.round(e1rmRow.e1rm / 0.5) * 0.5 : null;

  return { canonical: exercises[0]!.canonical, sessions, e1rm };
}
