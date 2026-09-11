import { type Modality } from '@/lib/parse/types';

import { findAliasOverride } from './alias-overrides';
import {
  mergePlan,
  normalizeName,
  pickExercise,
  type MergeCandidate,
} from './exercise-identity';
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

const normalize = normalizeName;

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

  /**
   * The decision itself is pure and tested (`exercise-identity.ts`): the name
   * the parser gave the movement outranks any shorthand, and shorthand may only
   * resolve to a row that names the SAME movement.
   *
   * That second half is the fix for a merge nobody could undo. This used to
   * accept ANY candidate on ANY row: "diamond push ups" carries the alias
   * "push ups", `Push-up` has already learned it, so the reading resolved to
   * plain push-ups AND `learnAliases` wrote the shorthand onto that row — two
   * movements sharing one history, one chart and one record, with nothing on
   * the aliases screen to show for it. Creating a row too many is the
   * recoverable mistake; that screen exists to merge them back.
   */
  const index = pickExercise(
    rows.map((row) => ({ canonical: row.canonical, aliases: aliasesOf(row) })),
    canonical,
    aliasesSeen,
  );
  if (index != null) {
    const row = rows[index]!;
    learnAliases(row, aliasesSeen);
    return row.id;
  }

  // Nothing named this movement → create a user-owned exercise (synced later).
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

/**
 * MERGE THE CATALOGUE'S DUPLICATES INTO ONE ROW EACH — run after every pull.
 *
 * A device whose catalogue is empty resolves a reading against nothing and
 * creates its own row for a movement the account already has: a fresh install,
 * a restored account, a wiped database, or simply a first sync pass in which
 * the parse ran before the pull. Both rows then exist for ever, the history
 * splits between them, and Progress lists one lift twice.
 *
 * The pull is where this can be healed, because it is the moment the device
 * learns what the account already calls things. Only USER-OWNED rows are
 * merged (the global catalogue is not ours to edit, and a personal row that
 * shadows a global one is the documented resolution order), and only ones this
 * device INVENTED — folding away a row the account really has would be undone
 * by the next pull, once per sync pass, for ever (`mergePlan`). The loser's
 * items and alias overrides are re-pointed, its aliases and its own spelling
 * are carried over as shorthand so the words the person typed still resolve,
 * and only then is it deleted.
 *
 * Returns how many rows were merged away, for the log.
 */
export function mergeDuplicateExercises(userId: string, confirmedIds: ReadonlySet<string>): number {
  const db = getDb();
  const rows = db.getAllSync<ExerciseRow>('SELECT * FROM exercises WHERE user_id = ?', [userId]);
  if (rows.length < 2) return 0;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const counts = new Map<string, number>();
  for (const row of db.getAllSync<{ exercise_id: string; n: number }>(
    'SELECT exercise_id, COUNT(*) AS n FROM items WHERE exercise_id IS NOT NULL GROUP BY exercise_id',
  )) {
    counts.set(row.exercise_id, row.n);
  }

  const candidates: MergeCandidate[] = rows.map((row) => ({
    id: row.id,
    canonical: row.canonical,
    items: counts.get(row.id) ?? 0,
    local: !confirmedIds.has(row.id),
  }));

  let merged = 0;
  for (const { keep, losers } of mergePlan(candidates)) {
    const keeper = byId.get(keep.id);
    if (!keeper) continue;
    for (const loser of losers) {
      const row = byId.get(loser.id);
      if (!row) continue;
      mergeExerciseInto(row, keeper);
      merged += 1;
    }
  }
  return merged;
}

/** Move everything that points at `loser` onto `keeper`, then drop `loser`. */
function mergeExerciseInto(loser: ExerciseRow, keeper: ExerciseRow) {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('UPDATE items SET exercise_id = ? WHERE exercise_id = ?', [keeper.id, loser.id]);
    db.runSync('UPDATE alias_overrides SET exercise_id = ?, dirty = 1 WHERE exercise_id = ?', [
      keeper.id,
      loser.id,
    ]);
    // The loser's own spelling becomes shorthand on the keeper, so a note that
    // used it still resolves after the row is gone.
    const known = new Set([normalize(keeper.canonical), ...aliasesOf(keeper).map(normalize)]);
    const carried = [...aliasesOf(loser), loser.canonical]
      .map(normalize)
      .filter((a) => a && !known.has(a));
    if (carried.length > 0) {
      db.runSync('UPDATE exercises SET aliases = ?, dirty = 1 WHERE id = ?', [
        JSON.stringify([...aliasesOf(keeper), ...carried]),
        keeper.id,
      ]);
    }
    db.runSync('DELETE FROM exercises WHERE id = ?', [loser.id]);
  });
}
