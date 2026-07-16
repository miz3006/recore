import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getDb } from '@/lib/db/index';
import { upsertPrediction } from '@/lib/db/predictions';

import { computeNextSession } from './data';
import { refinePredictionReason } from './explain';

/**
 * Compute the NEXT session after a workout changed and cache it (CLAUDE.md
 * §7): reading on open never computes. Called after every parse AND after a
 * manual parse correction — a fixed weight must flow into tomorrow's ghost.
 * Best-effort: never throws into the caller.
 */
export function recachePrediction(userId: string, workoutId: string): void {
  try {
    const draft = computeNextSession(userId, workoutId);
    if (!draft) return;
    const forDate = shiftDayKey(todayKey(), 1);
    upsertPrediction(userId, forDate, draft.ghostText, draft.reason);
    // V2: quietly upgrade the template reason to a phrased one (user's
    // language, their own words). Fire-and-forget.
    void refinePredictionReason(userId, forDate, draft);
  } catch {
    // prediction is best-effort; never let it break parsing or correcting
  }
}

/**
 * Recompute from the user's most recent parsed session — used right after a
 * CSV import (CLAUDE.md §10) so the onboarding ghost is REAL: their next
 * session, from their own history, before they've logged anything here.
 */
export function recachePredictionFromLatest(userId: string): void {
  try {
    const row = getDb().getFirstSync<{ id: string }>(
      `SELECT w.id FROM workouts w
       WHERE w.user_id = ?
         AND EXISTS (SELECT 1 FROM items i WHERE i.workout_id = w.id AND i.exercise_id IS NOT NULL)
       ORDER BY w.performed_at DESC LIMIT 1`,
      [userId],
    );
    if (row) recachePrediction(userId, row.id);
  } catch {
    // best-effort
  }
}
