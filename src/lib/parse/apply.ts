import { getCorrectionPatches } from '@/lib/db/corrections';
import { resolveExercise } from '@/lib/db/exercises';
import { computeSignals, parsedVolume } from '@/lib/db/history';
import { getDb, newId, nowIso } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';

import { overlayCorrections } from '@/lib/parse/overlay';
import { type LineSignal, type ParseResult, type ParsedItem } from '@/lib/parse/types';

/**
 * Map a VALIDATED parse result into items + sets (CLAUDE.md §6 step 3):
 * re-apply the user's stored corrections on top of the model output (a fix
 * must survive re-parses — §6.2), resolve exercise_id via aliases, rebuild the
 * workout's structure atomically, then compute gutter signals against history
 * and cache them so the gutter renders instantly on the next cold start.
 * raw_text is never touched — structure is a derivable projection.
 */
export function applyParseResult(
  userId: string,
  workoutId: string,
  rawSnapshot: string,
  rawResult: ParseResult,
): { signals: LineSignal[]; volume: number } {
  const db = getDb();
  const workout = getWorkoutById(workoutId);
  if (!workout) return { signals: [], volume: 0 };

  const result = overlayCorrections(rawResult, rawSnapshot, getCorrectionPatches(workoutId));

  const exerciseIdByItem = new Map<ParsedItem, string>();

  db.withTransactionSync(() => {
    // Structure is a projection — replace it wholesale for this workout.
    db.runSync('DELETE FROM items WHERE workout_id = ?', [workoutId]);

    const groupPositions = new Map<string, number>();

    result.items.forEach((item, position) => {
      const exerciseId = resolveExercise(userId, item.exercise, item.aliases_seen, item.modality);
      exerciseIdByItem.set(item, exerciseId);

      let groupPos: number | null = null;
      if (item.group_key) {
        groupPos = groupPositions.get(item.group_key) ?? 0;
        groupPositions.set(item.group_key, groupPos + 1);
      }

      const itemId = newId();
      db.runSync(
        'INSERT INTO items (id, workout_id, position, exercise_id, group_key, group_pos) VALUES (?, ?, ?, ?, ?, ?)',
        [itemId, workoutId, position, exerciseId, item.group_key, groupPos],
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
            set.kind,
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
      [result.parse_version, nowIso(), workoutId],
    );
  });

  const signals = computeSignals(userId, workout.performed_at, result, exerciseIdByItem);
  const volume = parsedVolume(result);

  db.runSync(
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
