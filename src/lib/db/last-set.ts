import { echoTextOf, topOfSets } from '@/lib/parse/summarize';
import { namesMatch } from '@/lib/parse/receipt';

import { findAliasOverride } from './alias-overrides';
import { getExerciseById, type ExerciseRow } from './exercises';
import { getDb } from './index';

/**
 * The "last time" hint (the single most-quoted five-star feature across
 * Strong/Hevy reviews): the moment a line names an exercise — before any
 * numbers — the gutter shows what the lifter did last session. Pure local
 * SQLite, instant, no AI call. Silence when the shorthand doesn't resolve.
 */
export interface LastSetHint {
  canonical: string;
  /** "3×8 80" — the same voice the gutter echo speaks. */
  echo: string;
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function aliasesOf(row: ExerciseRow): string[] {
  try {
    const parsed = JSON.parse(row.aliases) as unknown;
    return Array.isArray(parsed) ? parsed.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return [];
  }
}

/** Resolve typed shorthand to an exercise without creating anything:
 * alias override → exact name/alias → loose namesMatch (plural/typo-safe
 * containment). */
function resolveForHint(userId: string, typed: string): ExerciseRow | null {
  const needle = normalize(typed);
  if (!needle) return null;

  const overridden = findAliasOverride(userId, [needle]);
  if (overridden) {
    const row = getExerciseById(overridden);
    if (row) return row;
  }

  const rows = getDb().getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? OR user_id IS NULL ORDER BY user_id IS NULL',
    [userId],
  );
  for (const row of rows) {
    if (normalize(row.canonical) === needle) return row;
    if (aliasesOf(row).some((a) => normalize(a) === needle)) return row;
  }
  // Looser pass so "rows" still finds "Row" — exact matches already won above.
  // Ambiguity ("press" hitting bench AND overhead) resolves to SILENCE, not a
  // guess: a wrong hint costs more trust than no hint.
  let loose: ExerciseRow | null = null;
  for (const row of rows) {
    const hit = namesMatch(needle, row.canonical) || aliasesOf(row).some((a) => namesMatch(needle, a));
    if (!hit) continue;
    if (loose && loose.id !== row.id) return null;
    loose = loose ?? row;
  }
  return loose;
}

export function getLastSetHint(
  userId: string,
  typed: string,
  excludeWorkoutId: string | null,
): LastSetHint | null {
  const exercise = resolveForHint(userId, typed);
  if (!exercise) return null;

  const workout = getDb().getFirstSync<{ id: string }>(
    `SELECT w.id FROM workouts w
     JOIN items i ON i.workout_id = w.id
     WHERE w.user_id = ? AND i.exercise_id = ? AND w.id IS NOT ?
     ORDER BY w.performed_at DESC LIMIT 1`,
    [userId, exercise.id, excludeWorkoutId],
  );
  if (!workout) return null;

  const sets = getDb().getAllSync<{
    kind: string;
    reps: number | null;
    weight_kg: number | null;
    distance_m: number | null;
    duration_s: number | null;
  }>(
    `SELECT s.kind, s.reps, s.weight_kg, s.distance_m, s.duration_s
     FROM sets s JOIN items i ON s.item_id = i.id
     WHERE i.workout_id = ? AND i.exercise_id = ?
     ORDER BY s.position`,
    [workout.id, exercise.id],
  );
  const echo = echoTextOf(topOfSets(sets));
  if (!echo) return null;

  return { canonical: exercise.canonical, echo };
}
