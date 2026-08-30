import { shiftDayKey, type DayKey } from './dates';
import { getDb, newId, nowIso } from './index';

export interface PredictionRow {
  id: string;
  user_id: string;
  for_date: string; // YYYY-MM-DD
  ghost_text: string;
  reason: string | null;
  created_at: string;
  /** Adherence (CLAUDE.md §7.2 Gap 3): when the user tapped Start. */
  accepted_at: string | null;
  /** followed | edited | ignored — settled after the day's session parsed. */
  outcome: string | null;
  /**
   * LOCAL ONLY (v6). `GhostLine[]` as JSON: the engine's own reason and lever
   * for each lift in `ghost_text`, so Next's rows can explain their targets on
   * the ghost path the way the declared-split path already does. Null on a row
   * written before v6, and on any row a remote pull overwrote — see
   * `upsertPredictionFromRemote`. A row that cannot explain itself says
   * nothing; it never guesses.
   */
  lines_json: string | null;
  dirty: number;
}

export type PredictionOutcome = 'followed' | 'edited' | 'ignored';

/** A ghost older than this is silence, not a suggestion — after a long layoff
 * a progression of the last session would prescribe weights the lifter may no
 * longer have (CLAUDE.md §7.4: predict conservatively or not at all). */
export const GHOST_MAX_AGE_DAYS = 14;

/**
 * Read the cache on open (CLAUDE.md §7) — never compute here.
 *
 * A prediction is for the NEXT SESSION, whenever it happens — not for one
 * exact calendar date (CLAUDE.md §7.2 Gap 1). Train Monday, rest Tuesday,
 * open Wednesday: Wednesday must still show the ghost. Newer workouts write
 * newer rows (later for_date), so the latest row ≤ today is always the one
 * computed after the most recent parsed session.
 */
export function getPredictionForOpen(userId: string, today: DayKey): PredictionRow | null {
  const oldest = shiftDayKey(today, -GHOST_MAX_AGE_DAYS);
  return (
    getDb().getFirstSync<PredictionRow>(
      `SELECT * FROM predictions
       WHERE user_id = ? AND for_date <= ? AND for_date >= ?
       ORDER BY for_date DESC LIMIT 1`,
      [userId, today, oldest],
    ) ?? null
  );
}

export function upsertPrediction(
  userId: string,
  day: DayKey,
  ghostText: string,
  reason: string | null,
  /** `GhostLine[]` as JSON — the per-lift reasons behind `ghostText`. Written
   * in the SAME statement as the text they explain, so the two can never drift
   * apart by one parse. */
  linesJson: string | null = null,
) {
  getDb().runSync(
    `INSERT INTO predictions (id, user_id, for_date, ghost_text, reason, created_at, lines_json, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(user_id, for_date) DO UPDATE SET
       ghost_text = excluded.ghost_text,
       reason = excluded.reason,
       created_at = excluded.created_at,
       lines_json = excluded.lines_json,
       dirty = 1`,
    [newId(), userId, day, ghostText, reason, nowIso(), linesJson],
  );
}

/** The user tapped Start on this ghost — set once, never cleared (upserts of
 * newer ghost text leave it alone: the conflict update lists only content
 * columns). */
export function markPredictionAccepted(id: string) {
  getDb().runSync(
    'UPDATE predictions SET accepted_at = ?, dirty = 1 WHERE id = ? AND accepted_at IS NULL',
    [nowIso(), id],
  );
}

/** Re-settled after every parse of the day — converges on the note's final
 * state. */
export function setPredictionOutcome(id: string, outcome: PredictionOutcome) {
  getDb().runSync(
    'UPDATE predictions SET outcome = ?, dirty = 1 WHERE id = ? AND outcome IS NOT ?',
    [outcome, id, outcome],
  );
}

export function getDirtyPredictions(userId: string): PredictionRow[] {
  return getDb().getAllSync<PredictionRow>(
    'SELECT * FROM predictions WHERE user_id = ? AND dirty = 1',
    [userId],
  );
}

export function markPredictionsClean(ids: string[]) {
  const db = getDb();
  for (const id of ids) {
    db.runSync('UPDATE predictions SET dirty = 0 WHERE id = ?', [id]);
  }
}

export function upsertPredictionFromRemote(row: {
  id: string;
  user_id: string;
  for_date: string;
  ghost_text: string;
  reason: string | null;
  created_at: string;
  accepted_at: string | null;
  outcome: string | null;
}) {
  getDb().runSync(
    `INSERT INTO predictions (id, user_id, for_date, ghost_text, reason, created_at, accepted_at, outcome, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_id, for_date) DO UPDATE SET
       ghost_text = excluded.ghost_text,
       reason = excluded.reason,
       created_at = excluded.created_at,
       accepted_at = excluded.accepted_at,
       outcome = excluded.outcome,
       -- The reasons belong to the ghost text they were computed from, and a
       -- remote row carries none (the column is local). Keeping the old ones
       -- would attach a confident sentence to a number it never explained.
       lines_json = NULL
     WHERE predictions.dirty = 0`,
    [
      row.id,
      row.user_id,
      row.for_date,
      row.ghost_text,
      row.reason,
      row.created_at,
      row.accepted_at,
      row.outcome,
    ],
  );
}
