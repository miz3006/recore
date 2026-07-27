import { getCorrectionPatches } from '@/lib/db/corrections';
import { loadUndoneKeys } from '@/lib/db/done-state';
import { resolveExercise } from '@/lib/db/exercises';
import { computeSignals, parsedVolume } from '@/lib/db/history';
import { getDb, newId, nowIso } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';

import { overlayCorrections } from '@/lib/parse/overlay';
import { doneKeyFor, setsLineText } from '@/lib/parse/summarize';
import { type LineSignal, type ParseResult, type ParsedItem } from '@/lib/parse/types';

/**
 * Map a VALIDATED parse result into items + sets (CLAUDE.md §6 step 3):
 * re-apply the user's stored corrections on top of the model output (a fix
 * must survive re-parses — §6.2), resolve exercise_id via aliases, rebuild the
 * workout's structure atomically, then compute gutter signals against history
 * and cache them so the gutter renders instantly on the next cold start.
 * raw_text is never touched — structure is a derivable projection.
 */
/**
 * Rebuild a workout's items+sets from a validated, overlaid parse result and
 * compute its gutter signals — honoring the composer's "done" checklist. An
 * un-checked exercise (recorded, not performed) has its sets written with kind
 * `'skipped'` (excluded from all counted math everywhere) and gets no
 * comparison/PR signal. Structure is a projection, so this replaces it
 * wholesale. Returns the signals + the PERFORMED volume (un-checked excluded).
 */
function rebuildAndSignal(
  userId: string,
  workout: { id: string; performed_at: string },
  result: ParseResult,
): { signals: LineSignal[]; volume: number } {
  const db = getDb();
  const undone = loadUndoneKeys(workout.id);
  const isUndone = (item: ParsedItem) =>
    undone.size > 0 && undone.has(doneKeyFor(item.exercise, setsLineText(item.sets) ?? ''));

  const exerciseIdByItem = new Map<ParsedItem, string>();

  db.withTransactionSync(() => {
    // Structure is a projection — replace it wholesale for this workout.
    db.runSync('DELETE FROM items WHERE workout_id = ?', [workout.id]);

    const groupPositions = new Map<string, number>();

    result.items.forEach((item, position) => {
      const exerciseId = resolveExercise(userId, item.exercise, item.aliases_seen, item.modality);
      exerciseIdByItem.set(item, exerciseId);
      const undoneItem = isUndone(item);

      let groupPos: number | null = null;
      if (item.group_key) {
        groupPos = groupPositions.get(item.group_key) ?? 0;
        groupPositions.set(item.group_key, groupPos + 1);
      }

      const itemId = newId();
      db.runSync(
        'INSERT INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, ?, ?)',
        [itemId, workout.id, position, exerciseId, item.group_key, groupPos],
      );

      // parent is an index into THIS item's sets → map to the created row ids.
      const setIds: string[] = [];
      item.sets.forEach((set, setPosition) => {
        const setId = newId();
        const parentId =
          set.parent != null && set.parent < setIds.length ? setIds[set.parent]! : null;
        db.runSync(
          `INSERT INTO sets (id, item_id, position, kind, parent_set_id, reps, weight_kg, distance_m, duration_s, rir, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            setId,
            itemId,
            setPosition,
            // "Not done" overrides the parsed kind so every count excludes it.
            undoneItem ? 'skipped' : set.kind,
            parentId,
            set.reps,
            set.weight_kg,
            set.distance_m,
            set.duration_s,
            set.rir,
          ],
        );
        setIds.push(setId);
      });
    });

    db.runSync(
      'UPDATE workouts SET parse_version = ?, needs_parse = 0, structure_dirty = 1, dirty = 1, updated_at = ? WHERE id = ?',
      [result.parse_version, nowIso(), workout.id],
    );
  });

  const signals = computeSignals(userId, workout.performed_at, result, exerciseIdByItem, undone);
  const performed =
    undone.size > 0 ? { ...result, items: result.items.filter((it) => !isUndone(it)) } : result;
  return { signals, volume: parsedVolume(performed) };
}

export function applyParseResult(
  userId: string,
  workoutId: string,
  rawSnapshot: string,
  rawResult: ParseResult,
): { signals: LineSignal[]; volume: number } {
  const workout = getWorkoutById(workoutId);
  if (!workout) return { signals: [], volume: 0 };

  const result = overlayCorrections(rawResult, rawSnapshot, getCorrectionPatches(workoutId));
  const { signals, volume } = rebuildAndSignal(userId, workout, result);

  getDb().runSync(
    `INSERT INTO parse_cache (workout_id, raw_snapshot, result_json, signals_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workout_id) DO UPDATE SET
       raw_snapshot = excluded.raw_snapshot,
       result_json = excluded.result_json,
       signals_json = excluded.signals_json,
       updated_at = excluded.updated_at`,
    [workoutId, rawSnapshot, JSON.stringify(result), JSON.stringify(signals), nowIso()],
  );

  return { signals, volume };
}

/**
 * Re-project a workout's structure to reflect a just-changed "done" checklist,
 * WITHOUT a re-parse or a network call: rebuild items/sets from the CACHED
 * result (so un-checked exercises become `'skipped'`) and refresh the cached
 * signals. `result_json`/`raw_snapshot` are unchanged — only the derived
 * structure + signals move, so every historical total (this week, /stats, PRs)
 * agrees with the pill the instant a card is toggled.
 */
export function reapplyDoneState(userId: string, workoutId: string): void {
  const workout = getWorkoutById(workoutId);
  if (!workout) return;
  const cache = getParseCache(workoutId);
  if (!cache) return;
  let result: ParseResult;
  try {
    result = JSON.parse(cache.result_json) as ParseResult;
  } catch {
    return;
  }
  const { signals } = rebuildAndSignal(userId, workout, result);
  getDb().runSync('UPDATE parse_cache SET signals_json = ?, updated_at = ? WHERE workout_id = ?', [
    JSON.stringify(signals),
    nowIso(),
    workoutId,
  ]);
}

export interface ParseCacheRow {
  workout_id: string;
  raw_snapshot: string;
  result_json: string;
  signals_json: string;
  updated_at: string;
}

export function getParseCache(workoutId: string): ParseCacheRow | null {
  return (
    getDb().getFirstSync<ParseCacheRow>('SELECT * FROM parse_cache WHERE workout_id = ?', [
      workoutId,
    ]) ?? null
  );
}
