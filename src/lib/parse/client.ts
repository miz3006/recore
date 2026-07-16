import { parsedVolume } from '@/lib/db/history';
import { getDb, nowIso } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';
import { isSupabaseConfigured } from '@/lib/env';
import { devLog } from '@/lib/log';
import { settlePredictionOutcome } from '@/lib/predict/adherence';
import { recachePrediction } from '@/lib/predict/cache';
import { supabase } from '@/lib/supabase';

import { reanchorLines } from './anchor';
import { applyParseResult, getParseCache } from './apply';
import { buildReceipt, type ReceiptData } from './receipt';
import { MAX_RAW_TEXT_CHARS, validateParseResult, type LineSignal } from './types';

/**
 * Background parse (CLAUDE.md §6). The raw line is already saved locally when
 * this runs — the user never waits on it. Flow: call the parse-workout edge
 * function (server-side AI, JWT attached automatically by supabase-js) →
 * validate the JSON → map into items/sets → compute gutter signals → cache the
 * prediction for tomorrow. On failure or offline, the workout keeps
 * needs_parse = 1 and the sync loop retries later. Never throws to the UI.
 */
export interface ParseOutcome {
  workoutId: string;
  signals: LineSignal[];
  volume: number;
  rawSnapshot: string;
  /** line index → canonical exercise name; drives the tap-to-open sheet. */
  lineExercises: Record<number, string>;
  /** Session summary for receipt mode (CLAUDE.md §9). */
  receipt: ReceiptData | null;
}

function lineExercisesOf(result: { items: { line: number; exercise: string }[] }): Record<number, string> {
  const map: Record<number, string> = {};
  for (const item of result.items) {
    if (map[item.line] === undefined) map[item.line] = item.exercise;
  }
  return map;
}

export async function parseWorkout(userId: string, workoutId: string): Promise<ParseOutcome | null> {
  const workout = getWorkoutById(workoutId);
  if (!workout || workout.user_id !== userId) return null;

  const rawText = workout.raw_text;
  if (rawText.trim().length === 0) {
    // Cleared note: drop the projection, nothing to parse.
    const db = getDb();
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM items WHERE workout_id = ?', [workoutId]);
      db.runSync('DELETE FROM parse_cache WHERE workout_id = ?', [workoutId]);
      db.runSync(
        'UPDATE workouts SET needs_parse = 0, structure_dirty = 1, dirty = 1, updated_at = ? WHERE id = ?',
        [nowIso(), workoutId],
      );
    });
    return { workoutId, signals: [], volume: 0, rawSnapshot: rawText, lineExercises: {}, receipt: null };
  }

  // Already parsed this exact text? Serve the cache (and settle the retry flag
  // so the sync loop stops re-checking this workout).
  const cached = getParseCache(workoutId);
  if (cached && cached.raw_snapshot === rawText) {
    try {
      const result = validateParseResult(JSON.parse(cached.result_json));
      const signals = JSON.parse(cached.signals_json) as LineSignal[];
      getDb().runSync('UPDATE workouts SET needs_parse = 0 WHERE id = ?', [workoutId]);
      return {
        workoutId,
        signals,
        volume: result ? parsedVolume(result) : 0,
        rawSnapshot: rawText,
        lineExercises: result ? lineExercisesOf(result) : {},
        receipt: result ? buildReceipt(result, signals) : null,
      };
    } catch {
      // fall through to a fresh parse
    }
  }

  if (!isSupabaseConfigured()) return null;

  // Client-side input cap mirrors the server's.
  const capped = rawText.slice(0, MAX_RAW_TEXT_CHARS);

  try {
    const { data, error } = await supabase.functions.invoke('parse-workout', {
      body: { raw_text: capped },
    });
    if (error || !data) {
      devLog('parse failed, will retry on sync');
      return null;
    }

    // Treat the response as untrusted until validated.
    const result = validateParseResult(data);
    if (!result) {
      devLog('parse response failed validation');
      return null;
    }

    // Pin every item to the line that really contains it — the model's line
    // index is a hint, not a fact.
    reanchorLines(result, capped);

    // Re-read the note: if the user kept typing while the request was in
    // flight, this result belongs to stale text — apply it (structure is still
    // useful) but the gutter equality check hides mismatched lines.
    const fresh = getWorkoutById(workoutId);
    if (!fresh) return null;

    const { signals, volume } = applyParseResult(userId, workoutId, capped, result);

    // Settle what happened to the ghost that was on offer today (§7.2 Gap 3),
    // then compute + cache the NEXT session (CLAUDE.md §7) — reading on open
    // never computes. Both best-effort.
    try {
      settlePredictionOutcome(userId, fresh.performed_at, capped);
    } catch {
      // adherence is telemetry; never let it break the parse flow
    }
    recachePrediction(userId, workoutId);

    return {
      workoutId,
      signals,
      volume,
      rawSnapshot: capped,
      lineExercises: lineExercisesOf(result),
      receipt: buildReceipt(result, signals),
    };
  } catch {
    devLog('parse unreachable (offline?), will retry on sync');
    return null;
  }
}
