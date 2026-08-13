import { devLog } from '@/lib/log';

import { getDb } from './index';

/**
 * "Clear local cache" (You → Account).
 *
 * WHAT IT CLEARS, AND WHY THAT IS SAFE: only `parse_cache` — the stored model
 * result and its computed gutter signals. That table is a PROJECTION and
 * nothing else: `raw_text` is the record (CLAUDE.md §3), and every row in it can
 * be rebuilt by parsing that text again. Workouts, sets, reflections, entry
 * notes, corrections, learned shorthands, plan days and preferences are NOT
 * touched, so this button cannot lose a single thing the athlete wrote.
 *
 * WHAT IT DOES NOT DO: it does not delete the structure (`items`/`sets`). The
 * ledger, Progress and Next keep reading the numbers they already have while
 * the re-parse is pending — clearing them would blank the app for anyone who
 * pressed this offline, which is the opposite of a repair. Marking the note
 * `needs_parse` is enough: the existing background parser picks it up on the
 * next open or edit, and rebuilds the structure from the words.
 *
 * It exists because a stale or wrong cached reading is the one failure a user
 * can see but not reach — every other repair path (Fix reading, editing the
 * line) works on ONE line. Returns how many workouts were queued to re-read.
 */
export function clearParseCache(userId: string): number {
  const db = getDb();
  let queued = 0;

  db.withTransactionSync(() => {
    db.runSync(
      `DELETE FROM parse_cache WHERE workout_id IN
         (SELECT id FROM workouts WHERE user_id = ?)`,
      [userId],
    );
    const result = db.runSync(
      `UPDATE workouts SET needs_parse = 1
       WHERE user_id = ? AND trim(raw_text) <> ''`,
      [userId],
    );
    queued = result.changes ?? 0;
  });

  devLog(`parse cache cleared — ${queued} workouts queued to re-read`);
  return queued;
}
