import { echoTextOf, fmtNumber, setsLineText, topOfSets } from '@/lib/parse/summarize';
import { namesMatch } from '@/lib/parse/names';

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

interface RawSet {
  kind: string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
}

/** Real performed sets only (the same exclusions the rest of the app uses). */
function countedOf(sets: RawSet[]): RawSet[] {
  return sets.filter((s) => s.kind !== 'warmup' && s.kind !== 'drop' && s.kind !== 'skipped');
}

/** Reproduce last session's sets as a re-parseable suffix — per-set W×R pairs
 * the parser reads verbatim (PARSE_VERSION 5): "80x8 80x8 80x8", a pyramid
 * "120x10 100x15 90x8", bodyweight "8 8 8", a run "5000m". Never a projection —
 * this is the record, echoed back for the user to accept or overwrite. */
function entryLineOf(sets: RawSet[]): string {
  return countedOf(sets)
    .map((s) => {
      if (s.weight_kg != null && s.reps != null) return `${fmtNumber(s.weight_kg)}x${s.reps}`;
      if (s.weight_kg != null) return `${fmtNumber(s.weight_kg)}kg`;
      if (s.reps != null) return `${s.reps}`;
      if (s.distance_m != null) return `${fmtNumber(s.distance_m)}m`;
      if (s.duration_s != null) return `${s.duration_s}s`;
      return '';
    })
    .filter(Boolean)
    .join(' ');
}

export interface LastSessionPrefill {
  canonical: string;
  /** Faithful display of last session ("80 kg × 8·8·8") — the dim ghost text. */
  reading: string;
  /** A re-parseable suffix reproducing those sets ("80x8 80x8 80x8"). */
  entry: string;
}

/**
 * "Same as last" prefill (UX roadmap L6): the moment a line NAMES a known
 * exercise (no numbers yet), offer last session's sets — a VERBATIM record
 * read, never a predicted number — to accept in one gesture instead of
 * retyping. Silence when the shorthand doesn't resolve or there's no history.
 */
export function getLastSessionPrefill(
  userId: string,
  typed: string,
  excludeWorkoutId: string | null,
): LastSessionPrefill | null {
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

  const sets = getDb().getAllSync<RawSet>(
    `SELECT s.kind, s.reps, s.weight_kg, s.distance_m, s.duration_s
     FROM sets s JOIN items i ON s.item_id = i.id
     WHERE i.workout_id = ? AND i.exercise_id = ?
     ORDER BY s.position`,
    [workout.id, exercise.id],
  );
  const reading = setsLineText(sets);
  const entry = entryLineOf(sets);
  if (!reading || !entry) return null;

  return { canonical: exercise.canonical, reading, entry };
}
