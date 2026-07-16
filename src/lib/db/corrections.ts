import { type ParsedItem } from '@/lib/parse/types';

import { getDb, newId, nowIso } from './index';

/**
 * Parser corrections (CLAUDE.md §6.2): the raw line, what the parser produced,
 * what the user said it should be. Two jobs:
 *  1. OVERLAY — applyParseResult re-applies a correction whenever the same
 *     line text is re-parsed, so a fix survives model regressions.
 *  2. TRAINING DATA — rows are pushed to Supabase (never pulled) and feed the
 *     eval set / future few-shots.
 */
export interface CorrectionRow {
  id: string;
  user_id: string;
  workout_id: string | null;
  line_text: string;
  before_json: string | null;
  after_json: string;
  created_at: string;
  dirty: number;
}

/** A correction decoded for the overlay pass. */
export interface CorrectionPatch {
  lineText: string;
  before: ParsedItem | null;
  after: ParsedItem;
}

export function insertCorrection(
  userId: string,
  workoutId: string,
  lineText: string,
  before: ParsedItem | null,
  after: ParsedItem,
) {
  getDb().runSync(
    `INSERT INTO corrections (id, user_id, workout_id, line_text, before_json, after_json, created_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      newId(),
      userId,
      workoutId,
      lineText,
      before ? JSON.stringify(before) : null,
      JSON.stringify(after),
      nowIso(),
    ],
  );
}

/** Corrections for one workout, oldest first — the overlay applies them in
 * the order they were made, so a second fix of the same line chains onto the
 * first. */
export function getCorrectionPatches(workoutId: string): CorrectionPatch[] {
  const rows = getDb().getAllSync<CorrectionRow>(
    'SELECT * FROM corrections WHERE workout_id = ? ORDER BY created_at ASC',
    [workoutId],
  );

  const patches: CorrectionPatch[] = [];
  for (const row of rows) {
    try {
      patches.push({
        lineText: row.line_text,
        before: row.before_json ? (JSON.parse(row.before_json) as ParsedItem) : null,
        after: JSON.parse(row.after_json) as ParsedItem,
      });
    } catch {
      // a malformed row must never break parsing — skip it
    }
  }
  return patches;
}

export function getDirtyCorrections(userId: string): CorrectionRow[] {
  return getDb().getAllSync<CorrectionRow>(
    'SELECT * FROM corrections WHERE user_id = ? AND dirty = 1 LIMIT 50',
    [userId],
  );
}

export function markCorrectionsClean(ids: string[]) {
  const db = getDb();
  for (const id of ids) {
    db.runSync('UPDATE corrections SET dirty = 0 WHERE id = ?', [id]);
  }
}
