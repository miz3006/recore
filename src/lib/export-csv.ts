import { dayKeyFor } from './db/dates';
import { getDb } from './db/index';

/**
 * CSV export (CLAUDE.md §11): the user's data is never hostage — export is
 * free forever. One synchronous query over the local mirror; the raw note is
 * the source of truth elsewhere, this is the STRUCTURED projection in a shape
 * Hevy/Strong/spreadsheets can read.
 */
const HEADER = 'date,exercise,kind,reps,weight_kg,rir';

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function buildWorkoutsCsv(userId: string): string | null {
  const rows = getDb().getAllSync<{
    performed_at: string;
    canonical: string;
    kind: string;
    reps: number | null;
    weight_kg: number | null;
    rir: number | null;
  }>(
    `SELECT w.performed_at, e.canonical, s.kind, s.reps, s.weight_kg, s.rir
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     JOIN exercises e ON e.id = i.exercise_id
     WHERE w.user_id = ? AND trim(w.raw_text) <> ''
     ORDER BY w.performed_at ASC, i.position ASC, s.position ASC`,
    [userId],
  );
  if (rows.length === 0) return null;

  const lines = rows.map((r) =>
    [
      dayKeyFor(new Date(r.performed_at)),
      csvField(r.canonical),
      r.kind,
      r.reps ?? '',
      r.weight_kg ?? '',
      r.rir ?? '',
    ].join(','),
  );
  return [HEADER, ...lines].join('\n');
}
