import { getDb, nowIso } from './index';

/**
 * Alias overrides (CLAUDE.md §6.2): the user's shorthand → one exercises row,
 * consulted BEFORE any other resolution. Written by the parse-correction flow;
 * this is what makes a fix stick for every future note, including when the
 * target is a GLOBAL exercise whose alias array is read-only.
 */
export interface AliasOverrideRow {
  user_id: string;
  alias: string; // normalized (trim/lower/one-space)
  exercise_id: string;
  created_at: string;
  dirty: number;
}

export function setAliasOverride(userId: string, alias: string, exerciseId: string) {
  getDb().runSync(
    `INSERT INTO alias_overrides (user_id, alias, exercise_id, created_at, dirty)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, alias) DO UPDATE SET
       exercise_id = excluded.exercise_id,
       created_at = excluded.created_at,
       dirty = 1`,
    [userId, alias, exerciseId, nowIso()],
  );
}

/** First matching override for any of the candidate strings, in candidate
 * order — the order the caller ranks them (typed shorthand before the model's
 * canonical guess). */
export function findAliasOverride(userId: string, candidates: string[]): string | null {
  const db = getDb();
  for (const alias of candidates) {
    const row = db.getFirstSync<{ exercise_id: string }>(
      'SELECT exercise_id FROM alias_overrides WHERE user_id = ? AND alias = ?',
      [userId, alias],
    );
    if (row) return row.exercise_id;
  }
  return null;
}

/**
 * Every shorthand this account has taught the parser, newest first, joined to
 * the exercise it now resolves to — "benchpress → Bench Press".
 *
 * The corrections a person makes are a thing they should be able to SEE (§12:
 * the record is theirs, and this is part of it). Until You grew a screen for
 * them, the only readout was the export file. Rows whose exercise has since
 * vanished are dropped rather than shown as an arrow into nothing.
 */
export interface AliasOverrideView {
  alias: string;
  exerciseId: string;
  canonical: string;
  createdAt: string;
}

export function listAliasOverrides(userId: string): AliasOverrideView[] {
  return getDb().getAllSync<AliasOverrideView>(
    `SELECT o.alias AS alias, o.exercise_id AS exerciseId, e.canonical AS canonical,
            o.created_at AS createdAt
     FROM alias_overrides o
     JOIN exercises e ON e.id = o.exercise_id
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC`,
    [userId],
  );
}

/**
 * Forget one taught shorthand.
 *
 * It is a hard local DELETE, not a tombstone, and that is a deliberate limit
 * worth knowing: the row is also pushed to Supabase by the sync loop, which
 * only ever sends `dirty = 1` rows and has no delete channel for this table
 * (`sync/index.ts`). So a deletion holds on this device and is undone if the
 * account is restored onto another one. The alternative — inventing a
 * tombstone column — is a schema migration, and the honest small version is
 * this plus a note. The next re-parse of a line that used the shorthand will
 * simply read it the way the model does.
 */
export function deleteAliasOverride(userId: string, alias: string): void {
  getDb().runSync('DELETE FROM alias_overrides WHERE user_id = ? AND alias = ?', [userId, alias]);
}

export function getDirtyAliasOverrides(userId: string): AliasOverrideRow[] {
  return getDb().getAllSync<AliasOverrideRow>(
    'SELECT * FROM alias_overrides WHERE user_id = ? AND dirty = 1',
    [userId],
  );
}

export function markAliasOverridesClean(userId: string, aliases: string[]) {
  const db = getDb();
  for (const alias of aliases) {
    db.runSync('UPDATE alias_overrides SET dirty = 0 WHERE user_id = ? AND alias = ?', [
      userId,
      alias,
    ]);
  }
}

export function upsertAliasOverrideFromRemote(row: {
  user_id: string;
  alias: string;
  exercise_id: string;
  created_at: string;
}) {
  getDb().runSync(
    `INSERT INTO alias_overrides (user_id, alias, exercise_id, created_at, dirty)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(user_id, alias) DO UPDATE SET
       exercise_id = excluded.exercise_id,
       created_at = excluded.created_at
     WHERE alias_overrides.dirty = 0`,
    [row.user_id, row.alias, row.exercise_id, row.created_at],
  );
}
