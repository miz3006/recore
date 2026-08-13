import {
  doneKeyFor,
  echoTextOf,
  setsLineText,
  topOfSets,
  parsedVolume,
  type SetSummary,
} from '@/lib/parse/summarize';
import {
  type GutterSignal,
  type LineSignal,
  type ParseResult,
  type ParsedItem,
} from '@/lib/parse/types';

import { dayKeyFor, type DayKey } from './dates';
import { getDb } from './index';

/**
 * Gutter signals (task §6): each parsed line is compared against the PREVIOUS
 * session of the same exercise — ↑ +2.5, = same, ↓ -2 rep, or PR when this
 * session tops the all-time best. With no previous session there is nothing to
 * compare, so the line gets a quiet ECHO of its normalized top set instead
 * ("80 ×8") — still a number, still the AI's own voice, and the visible proof
 * on day one that the analysis landed.
 *
 * The pure summary math (top set, echo voice, volume) lives in
 * `parse/summarize.ts`, shared with the session receipt.
 */
export { parsedVolume };

/** Working-set kinds that count toward "top set" comparisons. Warm-ups are
 * excluded from all math (CLAUDE.md §3); drops chain off a parent and don't
 * represent the day's top effort. */
const TOP_SET_KINDS = "('working','myo','amrap','failure')";

function previousSessionTop(
  userId: string,
  exerciseId: string,
  beforeIso: string,
): { prev: SetSummary | null; prevDay: DayKey | null; allTimeMaxWeight: number | null } {
  const db = getDb();

  const prevWorkout = db.getFirstSync<{ id: string; performed_at: string }>(
    `SELECT w.id, w.performed_at FROM workouts w
     WHERE w.user_id = ? AND w.performed_at < ?
       AND EXISTS (SELECT 1 FROM items i JOIN sets s ON s.item_id = i.id
                   WHERE i.workout_id = w.id AND i.exercise_id = ? AND s.kind IN ${TOP_SET_KINDS})
     ORDER BY w.performed_at DESC LIMIT 1`,
    [userId, beforeIso, exerciseId],
  );

  const allTime = db.getFirstSync<{ max_w: number | null }>(
    `SELECT MAX(s.weight_kg) AS max_w FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ? AND w.performed_at < ? AND i.exercise_id = ? AND s.kind IN ${TOP_SET_KINDS}`,
    [userId, beforeIso, exerciseId],
  );

  if (!prevWorkout) {
    return { prev: null, prevDay: null, allTimeMaxWeight: allTime?.max_w ?? null };
  }

  const sets = db.getAllSync<{
    kind: string;
    weight_kg: number | null;
    reps: number | null;
    distance_m: number | null;
    duration_s: number | null;
  }>(
    `SELECT s.kind, s.weight_kg, s.reps, s.distance_m, s.duration_s FROM sets s
     JOIN items i ON s.item_id = i.id
     WHERE i.workout_id = ? AND i.exercise_id = ?`,
    [prevWorkout.id, exerciseId],
  );

  return {
    prev: topOfSets(sets),
    prevDay: dayKeyFor(new Date(prevWorkout.performed_at)),
    allTimeMaxWeight: allTime?.max_w ?? null,
  };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function signalFor(current: SetSummary, prev: SetSummary, allTimeMax: number | null): GutterSignal | null {
  // Loaded work: compare top weight, then reps at that weight.
  if (current.weight != null && prev.weight != null) {
    if (allTimeMax != null && current.weight > allTimeMax) return { kind: 'pr' };
    if (current.weight > prev.weight) return { kind: 'up', delta: `+${fmt(current.weight - prev.weight)}` };
    if (current.weight < prev.weight) return { kind: 'down', delta: `-${fmt(prev.weight - current.weight)}` };
    const cr = current.repsAtWeight;
    const pr = prev.repsAtWeight;
    if (cr != null && pr != null) {
      if (cr > pr) return { kind: 'up', delta: `+${cr - pr} rep` };
      if (cr < pr) return { kind: 'down', delta: `-${pr - cr} rep` };
    }
    return { kind: 'equal' };
  }

  // Bodyweight: compare reps.
  if (current.weight == null && prev.weight == null && current.repsAtWeight != null && prev.repsAtWeight != null) {
    if (current.repsAtWeight > prev.repsAtWeight)
      return { kind: 'up', delta: `+${current.repsAtWeight - prev.repsAtWeight} rep` };
    if (current.repsAtWeight < prev.repsAtWeight)
      return { kind: 'down', delta: `-${prev.repsAtWeight - current.repsAtWeight} rep` };
    return { kind: 'equal' };
  }

  // Cardio / carries: total distance.
  if (current.distance != null && prev.distance != null) {
    if (current.distance > prev.distance) return { kind: 'up', delta: `+${fmt(current.distance - prev.distance)}m` };
    if (current.distance < prev.distance) return { kind: 'down', delta: `-${fmt(prev.distance - current.distance)}m` };
    return { kind: 'equal' };
  }

  // Holds: longest duration.
  if (current.duration != null && prev.duration != null) {
    if (current.duration > prev.duration) return { kind: 'up', delta: `+${current.duration - prev.duration}s` };
    if (current.duration < prev.duration) return { kind: 'down', delta: `-${prev.duration - current.duration}s` };
    return { kind: 'equal' };
  }

  return null;
}

/**
 * The normalized session, echoed back as a prescription — the same voice the
 * ghost prediction speaks in: "3×12 100" (sets×reps weight), "3×10" for
 * bodyweight, "4× 20 m", "60 s".
 */
function echoOf(current: SetSummary): GutterSignal | null {
  const text = echoTextOf(current);
  return text ? { kind: 'set', text } : null;
}

/**
 * Name the session a comparison is comparing AGAINST. Only the three
 * comparison kinds carry it: a PR is measured against every session at once,
 * and an echo compares nothing — attaching a date to either would invite the
 * ledger to print a fact that isn't there.
 */
function withDay(signal: GutterSignal, day: DayKey | null): GutterSignal {
  if (!day) return signal;
  if (signal.kind === 'up' || signal.kind === 'down' || signal.kind === 'equal') {
    return { ...signal, at: day };
  }
  return signal;
}

/**
 * Compute a gutter signal per parsed item, keyed to its line: a comparison
 * where history exists, the top-set echo where it doesn't.
 */
export function computeSignals(
  userId: string,
  performedAtIso: string,
  result: ParseResult,
  exerciseIdByItem: Map<ParsedItem, string>,
  /** Exercises the user marked NOT DONE — they get no comparison/PR signal
   * (you can't set a record on work you didn't perform). */
  undone: Set<string> = new Set(),
): LineSignal[] {
  const signals: LineSignal[] = [];

  for (const item of result.items) {
    const exerciseId = exerciseIdByItem.get(item);
    if (!exerciseId) continue;
    if (undone.has(doneKeyFor(item.exercise, setsLineText(item.sets) ?? ''))) continue;

    const current = topOfSets(item.sets);
    const { prev, prevDay, allTimeMaxWeight } = previousSessionTop(userId, exerciseId, performedAtIso);

    const signal = prev
      ? (signalFor(current, prev, allTimeMaxWeight) ?? echoOf(current))
      : echoOf(current);
    if (signal) signals.push({ line: item.line, signal: withDay(signal, prevDay) });
  }

  return signals;
}

