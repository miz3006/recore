import { dayKeyFor, type DayKey } from '@/lib/db/dates';
import { type SetKind } from '@/lib/parse/types';

/**
 * Hevy / Strong CSV exports → Recore's shape. Detection is by header
 * signature; every numeric field is parsed defensively (these files are
 * user-provided and untrusted). Weights normalize to kg.
 */
export interface ImportedSet {
  kind: SetKind;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rir: number | null;
}

export interface ImportedExercise {
  name: string;
  sets: ImportedSet[];
}

export interface ImportedDay {
  day: DayKey;
  exercises: ImportedExercise[];
}

export type ImportFormat = 'hevy' | 'strong';

const LB_TO_KG = 0.45359;

export function detectFormat(headers: string[]): ImportFormat | null {
  const h = headers.map((x) => x.trim().toLowerCase());
  if (h.includes('exercise_title') && h.includes('set_type')) return 'hevy';
  if (h.includes('exercise name') && h.includes('set order')) return 'strong';
  return null;
}

export function mapCsv(rows: string[][], format: ImportFormat): ImportedDay[] {
  if (rows.length < 2) return [];
  const headers = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const days = new Map<DayKey, Map<string, ImportedExercise>>();

  const push = (day: DayKey, name: string, set: ImportedSet) => {
    if (!days.has(day)) days.set(day, new Map());
    const exercises = days.get(day)!;
    const key = name.toLowerCase();
    if (!exercises.has(key)) exercises.set(key, { name, sets: [] });
    exercises.get(key)!.sets.push(set);
  };

  if (format === 'hevy') {
    const cDate = col('start_time');
    const cName = col('exercise_title');
    const cType = col('set_type');
    const cWeight = col('weight_kg');
    const cReps = col('reps');
    const cDistance = col('distance_km');
    const cDuration = col('duration_seconds');
    const cRpe = col('rpe');

    for (const r of rows.slice(1)) {
      const day = dayOf(r[cDate]);
      const name = (r[cName] ?? '').trim();
      if (!day || !name) continue;
      const distanceKm = num(r[cDistance]);
      push(day, name, {
        kind: hevyKind(r[cType]),
        reps: int(r[cReps]),
        weight_kg: round2(num(r[cWeight])),
        distance_m: distanceKm != null ? Math.round(distanceKm * 1000) : null,
        duration_s: int(r[cDuration]),
        rir: rirFromRpe(num(r[cRpe])),
      });
    }
  } else {
    const cDate = col('date');
    const cName = col('exercise name');
    const cOrder = col('set order');
    const cWeight = col('weight');
    const cUnit = col('weight unit'); // present in newer exports
    const cReps = col('reps');
    const cDistance = col('distance');
    const cSeconds = col('seconds');
    const cRpe = col('rpe');

    for (const r of rows.slice(1)) {
      const day = dayOf(r[cDate]);
      const name = (r[cName] ?? '').trim();
      if (!day || !name) continue;
      let weight = num(r[cWeight]);
      const unit = cUnit >= 0 ? (r[cUnit] ?? '').trim().toLowerCase() : '';
      if (weight != null && (unit === 'lbs' || unit === 'lb')) weight *= LB_TO_KG;
      push(day, name, {
        kind: strongKind(r[cOrder]),
        reps: int(r[cReps]),
        weight_kg: round2(weight),
        distance_m: round2(num(r[cDistance])),
        duration_s: int(r[cSeconds]),
        rir: rirFromRpe(num(r[cRpe])),
      });
    }
  }

  return [...days.entries()]
    .map(([day, exercises]) => ({ day, exercises: [...exercises.values()] }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

function hevyKind(raw: string | undefined): SetKind {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'warmup':
      return 'warmup';
    case 'dropset':
      return 'drop';
    case 'failure':
      return 'failure';
    default:
      return 'working';
  }
}

function strongKind(raw: string | undefined): SetKind {
  const v = (raw ?? '').trim().toLowerCase();
  if (v.startsWith('w')) return 'warmup';
  if (v.startsWith('d')) return 'drop';
  if (v.startsWith('f')) return 'failure';
  return 'working';
}

function dayOf(raw: string | undefined): DayKey | null {
  if (!raw) return null;
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const parsed = new Date(raw.replace(',', ''));
  return Number.isNaN(parsed.getTime()) ? null : dayKeyFor(parsed);
}

function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function int(raw: string | undefined): number | null {
  const n = num(raw);
  return n != null ? Math.round(n) : null;
}

function round2(n: number | null): number | null {
  return n != null ? Math.round(n * 100) / 100 : null;
}

function rirFromRpe(rpe: number | null): number | null {
  if (rpe == null || rpe < 4 || rpe > 10) return null;
  return Math.round((10 - rpe) * 10) / 10;
}
