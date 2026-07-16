import { type Modality } from '@/lib/parse/types';

import { findAliasOverride } from './alias-overrides';
import { getDb, newId } from './index';

export interface ExerciseRow {
  id: string;
  user_id: string | null;
  canonical: string;
  aliases: string; // JSON string[]
  modality: string;
  increment_kg: number | null;
  dirty: number;
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function aliasesOf(row: ExerciseRow): string[] {
  try {
    const parsed = JSON.parse(row.aliases);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Aliasing (CLAUDE.md §3): `bench`, `BP`, `bench press` all resolve to ONE
 * exercises row via the aliases array. Resolve on parse; create a new exercise
 * only if no alias matches. Resolution order:
 *  1. the user's ALIAS OVERRIDES (written by parse corrections — what the user
 *     explicitly said their shorthand means always wins, §6.2),
 *  2. the user's own rows (personal shorthand can shadow a default),
 *  3. global rows,
 *  4. create a new user-owned exercise.
 */
export function resolveExercise(
  userId: string,
  canonical: string,
  aliasesSeen: string[],
  modality: Modality,
): string {
  const db = getDb();

  // Typed shorthand ranks before the model's canonical guess.
  const ranked = [...new Set([...aliasesSeen.map(normalize), normalize(canonical)])];
  const overridden = findAliasOverride(userId, ranked);
  if (overridden) {
    const target = getExerciseById(overridden);
    if (target) {
      learnAliases(target, aliasesSeen);
      return target.id;
    }
  }

  const rows = db.getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? OR user_id IS NULL ORDER BY user_id IS NULL',
    [userId],
  );

  const candidates = new Set(ranked);

  for (const row of rows) {
    const names = new Set([normalize(row.canonical), ...aliasesOf(row).map(normalize)]);
    for (const c of candidates) {
      if (names.has(c)) {
        learnAliases(row, aliasesSeen);
        return row.id;
      }
    }
  }

  // No alias matched → create a user-owned exercise (synced later).
  return createUserExercise(userId, canonical, aliasesSeen, modality);
}

/** Create a user-owned exercise row (synced later). */
export function createUserExercise(
  userId: string,
  canonical: string,
  aliasesSeen: string[],
  modality: Modality,
): string {
  const id = newId();
  const aliases = aliasesSeen.map(normalize).filter((a) => a && a !== normalize(canonical));
  getDb().runSync(
    'INSERT INTO exercises (id, user_id, canonical, aliases, modality, increment_kg, dirty) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [id, userId, canonical, JSON.stringify(aliases), modality, modality === 'strength' ? 2.5 : null],
  );
  return id;
}

/** Exact name/alias lookup for the correction sheet — user rows first, then
 * globals. Returns null when nothing matches. */
export function findExerciseByName(userId: string, name: string): ExerciseRow | null {
  const needle = normalize(name);
  if (!needle) return null;
  const rows = getDb().getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? OR user_id IS NULL ORDER BY user_id IS NULL',
    [userId],
  );
  for (const row of rows) {
    if (normalize(row.canonical) === needle) return row;
    if (aliasesOf(row).some((a) => normalize(a) === needle)) return row;
  }
  return null;
}

/** Prefix/substring suggestions for the correction sheet, user rows first. */
export function searchExercises(userId: string, query: string, limit = 3): ExerciseRow[] {
  const needle = normalize(query);
  if (!needle) return [];
  const rows = getDb().getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? OR user_id IS NULL ORDER BY user_id IS NULL',
    [userId],
  );
  const starts: ExerciseRow[] = [];
  const contains: ExerciseRow[] = [];
  for (const row of rows) {
    const c = normalize(row.canonical);
    if (c === needle) continue; // exact match is already the field's value
    if (c.startsWith(needle)) starts.push(row);
    else if (c.includes(needle)) contains.push(row);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Drop a mis-learned shorthand from every USER row except the target — after
 * a correction the old learned alias must not shadow the override. */
export function removeAliasFromUserExercises(userId: string, alias: string, exceptId: string) {
  const needle = normalize(alias);
  const rows = getDb().getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ?',
    [userId],
  );
  for (const row of rows) {
    if (row.id === exceptId) continue;
    const aliases = aliasesOf(row);
    const next = aliases.filter((a) => normalize(a) !== needle);
    if (next.length !== aliases.length) {
      getDb().runSync('UPDATE exercises SET aliases = ?, dirty = 1 WHERE id = ?', [
        JSON.stringify(next),
        row.id,
      ]);
    }
  }
}

/** Remember new shorthand on the USER'S rows (globals are read-only). */
function learnAliases(row: ExerciseRow, aliasesSeen: string[]) {
  if (row.user_id === null) return;
  const known = new Set(aliasesOf(row).map(normalize));
  known.add(normalize(row.canonical));
  const fresh = aliasesSeen.map(normalize).filter((a) => a && !known.has(a));
  if (fresh.length === 0) return;

  const next = [...aliasesOf(row), ...fresh];
  getDb().runSync('UPDATE exercises SET aliases = ?, dirty = 1 WHERE id = ?', [
    JSON.stringify(next),
    row.id,
  ]);
}

export function getDirtyExercises(userId: string): ExerciseRow[] {
  return getDb().getAllSync<ExerciseRow>(
    'SELECT * FROM exercises WHERE user_id = ? AND dirty = 1',
    [userId],
  );
}

export function markExercisesClean(ids: string[]) {
  const db = getDb();
  for (const id of ids) {
    db.runSync('UPDATE exercises SET dirty = 0 WHERE id = ?', [id]);
  }
}

export function upsertExerciseFromRemote(row: {
  id: string;
  user_id: string | null;
  canonical: string;
  aliases: string[] | null;
  modality: string | null;
  increment_kg: number | null;
}) {
  getDb().runSync(
    `INSERT INTO exercises (id, user_id, canonical, aliases, modality, increment_kg, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET
       canonical = excluded.canonical,
       aliases = excluded.aliases,
       modality = excluded.modality,
       increment_kg = excluded.increment_kg
     WHERE exercises.dirty = 0`,
    [
      row.id,
      row.user_id,
      row.canonical,
      JSON.stringify(row.aliases ?? []),
      row.modality ?? 'strength',
      row.increment_kg,
    ],
  );
}

export function getExerciseById(id: string): ExerciseRow | null {
  return getDb().getFirstSync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', [id]) ?? null;
}
