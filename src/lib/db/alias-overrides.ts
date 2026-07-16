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
