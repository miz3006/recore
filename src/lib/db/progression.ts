import type { LiftSession } from '../progression';
import { dayKeyFor } from './dates';
import { getDb } from './index';

/**
 * The one read behind the Progress tab — every exercise's aggregates for every
 * session the user has recorded, in a single grouped scan.
 *
 * It is deliberately NOT range-filtered. The range only decides what gets
 * plotted; an all-time best has to come from the whole history, or a PR set
 * last winter would quietly stop being the bar the dashed hairline draws.
 * Everything downstream is pure arithmetic in `src/lib/progression.ts`, so the
 * three metrics and all three ranges come out of this one fetch and switching
 * a tab costs no query at all.
 *
 * Grouping is on `lower(canonical)` rather than `exercise_id` on purpose: a
 * lift can own both a user row and a read-only global row (the same reason
 * `getExerciseStats` collects ids first), and those are one lift to a lifter.
 *
 * Warm-ups, drops and skipped sets are excluded here, like every other
 * aggregate in the app (CLAUDE.md §1.1 invariant 5).
 */
export function getLiftSessions(userId: string): LiftSession[] {
  const rows = getDb().getAllSync<{
    key: string;
    canonical: string;
    workout_id: string;
    performed_at: string;
    top_weight: number | null;
    top_reps: number | null;
    e1rm: number | null;
    volume: number | null;
  }>(
    `SELECT lower(e.canonical) AS key,
            MAX(e.canonical)   AS canonical,
            w.id               AS workout_id,
            w.performed_at     AS performed_at,
            MAX(s.weight_kg)   AS top_weight,
            MAX(s.reps)        AS top_reps,
            MAX(CASE WHEN s.reps IS NOT NULL AND s.reps <= 12 AND s.weight_kg IS NOT NULL
                     THEN s.weight_kg * (1 + s.reps / 30.0) END) AS e1rm,
            SUM(CASE WHEN s.reps IS NOT NULL AND s.weight_kg IS NOT NULL
                     THEN s.reps * s.weight_kg ELSE 0 END)       AS volume
       FROM sets s
       JOIN items i     ON s.item_id = i.id
       JOIN workouts w  ON i.workout_id = w.id
       JOIN exercises e ON e.id = i.exercise_id
      WHERE w.user_id = ?
        AND s.kind NOT IN ('warmup', 'drop', 'skipped')
      GROUP BY lower(e.canonical), w.id
      ORDER BY w.performed_at ASC`,
    [userId],
  );

  return rows.map((r) => ({
    key: r.key,
    canonical: r.canonical,
    workoutId: r.workout_id,
    day: dayKeyFor(new Date(r.performed_at)),
    topWeight: r.top_weight,
    topReps: r.top_reps,
    // Half-kilo grain, matching `getE1rmSeries` so the same lift never reads
    // two different estimates on two screens.
    e1rm: r.e1rm != null ? Math.round(r.e1rm / 0.5) * 0.5 : null,
    volume: Math.round(r.volume ?? 0),
  }));
}
