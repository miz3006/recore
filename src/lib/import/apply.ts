import { performedAtIso } from '@/lib/db/dates';
import { resolveExercise } from '@/lib/db/exercises';
import { getDb, newId, nowIso } from '@/lib/db/index';
import { getWorkoutForDay } from '@/lib/db/workouts';
import { type Modality } from '@/lib/parse/types';

import { type ImportedDay, type ImportedExercise } from './formats';

/**
 * Write imported history into SQLite as first-class workouts: structure lands
 * directly (no AI parse needed), raw_text is reconstructed in the app's own
 * voice so the note surface reads naturally, and the sync engine pushes it
 * all to Supabase in the background. Days that already have a local note are
 * NEVER overwritten — imports must not clobber what the user wrote.
 */
export interface ImportResult {
  importedDays: number;
  skippedDays: number;
  sets: number;
}

export function applyImport(userId: string, days: ImportedDay[]): ImportResult {
  const db = getDb();
  let importedDays = 0;
  let skippedDays = 0;
  let sets = 0;
  const now = nowIso();

  db.withTransactionSync(() => {
    for (const day of days) {
      if (getWorkoutForDay(userId, day.day)) {
        skippedDays += 1;
        continue;
      }

      const rawText = day.exercises.map(rawLineOf).join('\n');
      if (!rawText.trim()) {
        skippedDays += 1;
        continue;
      }

      const workoutId = newId();
      db.runSync(
        `INSERT INTO workouts (id, user_id, performed_at, raw_text, parse_version, created_at, updated_at, dirty, structure_dirty, needs_parse)
         VALUES (?, ?, ?, ?, NULL, ?, ?, 1, 1, 0)`,
        [workoutId, userId, performedAtIso(day.day), rawText, now, now],
      );

      day.exercises.forEach((exercise, position) => {
        const exerciseId = resolveExercise(
          userId,
          exercise.name,
          [exercise.name.toLowerCase()],
          modalityOf(exercise),
        );
        const itemId = newId();
        db.runSync(
          'INSERT INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, NULL, NULL)',
          [itemId, workoutId, position, exerciseId],
        );
        exercise.sets.forEach((set, setPosition) => {
          db.runSync(
            `INSERT INTO sets (id, item_id, position, kind, parent_set_id, reps, weight_kg, distance_m, duration_s, rir, note)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL)`,
            [newId(), itemId, setPosition, set.kind, set.reps, set.weight_kg, set.distance_m, set.duration_s, set.rir],
          );
          sets += 1;
        });
      });

      importedDays += 1;
    }
  });

  return { importedDays, skippedDays, sets };
}

function modalityOf(exercise: ImportedExercise): Modality {
  const hasDistance = exercise.sets.some((s) => s.distance_m != null);
  const hasDuration = exercise.sets.some((s) => s.duration_s != null);
  const hasReps = exercise.sets.some((s) => s.reps != null);
  if (hasDistance) return 'cardio';
  if (hasDuration && !hasReps) return 'hold';
  return 'strength';
}

/** Reconstruct a plausible note line in the app's own voice. */
function rawLineOf(exercise: ImportedExercise): string {
  const name = exercise.name.toLowerCase();
  const counted = exercise.sets.filter((s) => s.kind !== 'warmup' && s.kind !== 'drop');
  const top = counted.reduce(
    (a, b) => ((b.weight_kg ?? 0) > (a?.weight_kg ?? 0) ? b : a),
    counted[0],
  );
  if (!top) return name;

  if (top.weight_kg != null && top.reps != null) {
    return `${name} ${counted.length}x${top.reps} ${fmt(top.weight_kg)}kg`;
  }
  if (top.reps != null) return `${name} ${counted.length}x${top.reps}`;
  if (top.distance_m != null) {
    return `${name} ${top.distance_m >= 1000 ? `${top.distance_m / 1000}k` : `${top.distance_m}m`}`;
  }
  if (top.duration_s != null) return `${name} ${top.duration_s}s`;
  return name;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}
