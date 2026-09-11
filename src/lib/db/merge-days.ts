/**
 * FOLD THE ROWS ONE DAY ALREADY SPLIT INTO — the local half of the repair.
 *
 * The remote half is `merge_duplicate_workout_days()` in
 * `supabase/migrations/20260910191000_merge_duplicate_days.sql` (amended by
 * `20260911090000_merge_days_structure.sql`), and the two apply the SAME rules
 * to the same rows, deliberately: the survivor is the oldest row, and a
 * duplicate's text is appended verbatim unless the survivor already contains
 * it. Read that file for why the bug existed at all; `day-id.ts` is what stops
 * it happening again.
 *
 * ## TEXT AND STRUCTURE TRAVEL TOGETHER
 *
 * The first version of this repair repointed EVERY duplicate's items onto the
 * survivor while skipping the duplicate's words when they were already there.
 * Those two rules contradict each other, and the contradiction is visible:
 * found in the owner's screenshot of 11 September 2026, a day whose text read
 * "benchpress 120kgx12x3" twice was drawn as THREE bench-press entries and
 * headed "1 lift · 9 sets · 12,960 kg". The reading had a third of a session
 * in it that the record does not say happened.
 *
 * `items`/`sets` are a PROJECTION of `raw_text` (CLAUDE.md §3). If a
 * duplicate's words are dropped as "the split, not a second effort", then its
 * parsed structure is a second copy of the same words and goes with them. It
 * is kept in exactly one case — when the survivor has no structure at all, so
 * the duplicate's reading is the only reading that text has ever had, and
 * dropping it would blank a day nobody could re-parse offline.
 *
 * ## Why the local pass is not optional
 *
 * It would be tempting to fix the server and let the person's own device carry
 * on with its extra rows, because `getWorkoutForDay` only ever shows one of
 * them. But the rows the app hides from a person are not hidden from its own
 * arithmetic: `countSessions` counts rows, `getLoggedDayKeys` builds the
 * calendar from rows, and every volume total sums the sets hanging off them.
 * Six rows for 9 September is one training day that reports as six sessions.
 * The number on the profile header was inflated by exactly the duplicates the
 * coach was complaining about seeing.
 *
 * ## It does not touch `dirty`
 *
 * The survivor is left clean. Both sides compute the same result from the same
 * inputs, so there is nothing to push; marking it dirty would only race the
 * server's own merge and risk pushing a half-merged row over a merged one.
 */

/** The three calls this module needs, and nothing else. `SQLiteDatabase`
 *  satisfies it; so does a thin wrapper over `node:sqlite` in the test. */
export interface MergeDb {
  getAllSync<T>(sql: string, params: (string | number | null)[]): T[];
  getFirstSync<T>(sql: string, params: (string | number | null)[]): T | null;
  runSync(sql: string, params: (string | number | null)[]): unknown;
}

interface DayGroup {
  performed_at: string;
}

interface Row {
  id: string;
  raw_text: string | null;
  reflection: string | null;
  entry_notes: string | null;
  session_effort: number | null;
}

/** Is this duplicate's text already inside the survivor's? Three rows reading
 *  "benchpress 120kgx12x3" are one session the sync split, not three sessions,
 *  and printing it back three times would be the repair inventing training. */
function alreadyThere(survivor: string, dupe: string): boolean {
  return dupe.length > 0 && survivor.includes(dupe);
}

function joinText(survivor: string | null, dupe: string | null): string {
  const s = (survivor ?? '').replace(/[\s\n]+$/, '');
  const d = (dupe ?? '').trim();
  if (!d) return survivor ?? '';
  if (!s) return d;
  if (alreadyThere(s, d)) return s;
  return `${s}\n${d}`;
}

/**
 * Throw away one row's whole reading — sets, then items.
 *
 * Written out rather than left to `ON DELETE CASCADE` for one reason:
 * `sets.parent_set_id` is a self-reference with no cascade of its own, so a
 * drop set outliving its working set is a foreign-key error on a device, in a
 * repair that must never be the thing that stops a sync. Children first, and
 * the question does not arise.
 */
function dropStructure(db: MergeDb, workoutId: string) {
  db.runSync(
    `DELETE FROM sets WHERE parent_set_id IS NOT NULL
       AND item_id IN (SELECT id FROM items WHERE workout_id = ?)`,
    [workoutId],
  );
  db.runSync('DELETE FROM sets WHERE item_id IN (SELECT id FROM items WHERE workout_id = ?)', [
    workoutId,
  ]);
  db.runSync('DELETE FROM items WHERE workout_id = ?', [workoutId]);
}

/** A note map that is present and non-empty. `'{}'` is the empty one. */
function hasNotes(v: string | null): boolean {
  const t = (v ?? '').trim();
  return t !== '' && t !== '{}';
}

/**
 * Merge every day of this account that holds more than one row. Returns how
 * many rows were folded away — 0 when there was nothing to do, which is the
 * normal case and costs one grouped query.
 */
export function mergeDuplicateWorkoutDays(db: MergeDb, userId: string): number {
  const groups = db.getAllSync<DayGroup>(
    `SELECT performed_at FROM workouts WHERE user_id = ?
     GROUP BY performed_at HAVING COUNT(*) > 1`,
    [userId],
  );
  if (groups.length === 0) return 0;

  let merged = 0;

  for (const g of groups) {
    const rows = db.getAllSync<Row>(
      `SELECT id, raw_text, reflection, entry_notes, session_effort
         FROM workouts WHERE user_id = ? AND performed_at = ?
        ORDER BY created_at ASC, id ASC`,
      [userId, g.performed_at],
    );
    const survivor = rows[0];
    if (!survivor) continue;

    for (const dupe of rows.slice(1)) {
      const top = db.getFirstSync<{ n: number | null; c: number }>(
        'SELECT MAX(position) AS n, COUNT(*) AS c FROM items WHERE workout_id = ?',
        [survivor.id],
      );
      // Judged BEFORE the text is joined: afterwards every duplicate's words
      // are "already there" by construction.
      const wordsDropped = alreadyThere(
        (survivor.raw_text ?? '').replace(/[\s\n]+$/, ''),
        (dupe.raw_text ?? '').trim(),
      );

      if (wordsDropped && (top?.c ?? 0) > 0) {
        dropStructure(db, dupe.id);
      } else {
        // Positions continue after whatever the survivor already carries, so
        // the merged day reads in the order the entries were written.
        const offset = (top?.n ?? -1) + 1;
        db.runSync(
          'UPDATE items SET workout_id = ?, position = position + ? WHERE workout_id = ?',
          [survivor.id, offset, dupe.id],
        );
      }

      survivor.raw_text = joinText(survivor.raw_text, dupe.raw_text);
      if (!(survivor.reflection ?? '').trim()) survivor.reflection = dupe.reflection;
      if (!hasNotes(survivor.entry_notes)) survivor.entry_notes = dupe.entry_notes;
      if (survivor.session_effort == null) survivor.session_effort = dupe.session_effort;

      db.runSync('DELETE FROM workouts WHERE id = ?', [dupe.id]);
      merged += 1;
    }

    db.runSync(
      `UPDATE workouts SET raw_text = ?, reflection = ?, entry_notes = ?, session_effort = ?
        WHERE id = ?`,
      [
        survivor.raw_text ?? '',
        survivor.reflection,
        survivor.entry_notes,
        survivor.session_effort,
        survivor.id,
      ],
    );
  }

  return merged;
}
