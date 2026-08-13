import { typedNameOf } from '@/lib/parse/receipt';
import { buildPlanRow, type PlanRow } from '@/lib/plan/prescribe';
import { focusForGoal } from '@/lib/onboarding';
import { defaultRepRangeFor, type PriorTop, type WorkingSet } from '@/lib/predict/engine';
import { getGoal, getSmallestPlateKg } from '@/lib/prefs';

import { todayKey, type DayKey } from './dates';
import { findExerciseByName } from './exercises';
import { getDb } from './index';
import { resolveTodayPlanDay, type PlanDayRow } from './plan';

/**
 * The plan-in-view strip's content (pre-plan, Surface 1): today's due
 * day-template resolved to movements, each carrying the engine's progressed
 * load. Read-only reference — computed here, rendered by components/plan-strip
 * without any write path. The heavy engine/history reads live behind the same
 * cadence as the ghost (hydrate + after a parse), NOT per keystroke.
 */
export interface PlanStrip {
  /** The plan_days row this strip was resolved from — the session-start card
   * marks its chip as the selected answer (§8.2). */
  dayId: string;
  /** The day-type name, e.g. "Upper". */
  label: string;
  rows: PlanRow[];
}

const MAX_MOVES = 20;
const WORKING = "s.kind NOT IN ('warmup','drop','skipped')";

/**
 * Today's strip: resolve which day-template is due, then progress it. The plan
 * is only ever "in view" today.
 */
export function computePlanStrip(userId: string, day: DayKey): PlanStrip | null {
  if (day !== todayKey()) return null;
  const planDay = resolveTodayPlanDay(userId, day);
  return planDay ? planStripFor(userId, planDay) : null;
}

/**
 * The same progression for ONE NAMED day-template, whichever it is and whether
 * or not it is the one due (split out 13 Aug 2026).
 *
 * It exists so the Next tab can show a split day the athlete is NOT due for —
 * tapping "Pull" while today reads as "Push" and seeing what that session's
 * loads would be. That preview must speak the identical numbers the real strip
 * would, so it goes through this function rather than a parallel one: two
 * expressions of "what goes on the bar for this day" is exactly the divergence
 * the repo keeps having to diagnose.
 *
 * Read-only. Resolving a day for a preview writes nothing and changes nothing
 * about which day is due — `setPlanDayChoice` is the only thing that does that,
 * and this function never calls it.
 */
export function planStripFor(userId: string, planDay: PlanDayRow): PlanStrip | null {
  const smallest = getSmallestPlateKg();
  const lines = planDay.raw_text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_MOVES);

  const rows: PlanRow[] = [];
  for (const line of lines) {
    const typed = typedNameOf(line) || line;
    const ex = findExerciseByName(userId, typed);
    if (!ex) {
      rows.push({ name: titleCase(typed), value: null });
      continue;
    }
    const latest = latestSessionFor(userId, ex.id);
    if (!latest) {
      rows.push({ name: ex.canonical, value: null });
      continue;
    }
    const cardio = topCardioOf(latest.id, ex.id);
    rows.push(
      buildPlanRow(
        {
          name: ex.canonical,
          modality: ex.modality,
          todaySets: workingSetsOf(latest.id, ex.id),
          priorTops: priorTopsFor(userId, ex.id, latest.performed_at),
          incrementKg: ex.increment_kg ?? 2.5,
          lastDistanceM: cardio.distance_m,
          lastDurationS: cardio.duration_s,
        },
        smallest,
        // Same fallback the ghost gets (predict/data.ts) — the strip and the
        // prediction must never disagree about one exercise, which is why both
        // go through `focusForGoal` rather than reading the goal directly.
        defaultRepRangeFor(focusForGoal(getGoal())),
      ),
    );
  }

  return rows.length > 0 ? { dayId: planDay.id, label: planDay.label, rows } : null;
}

/** The most recent session that logged real (non-warmup/drop/skipped) work for
 * this exercise — the base the engine progresses from. */
function latestSessionFor(
  userId: string,
  exerciseId: string,
): { id: string; performed_at: string } | null {
  return (
    getDb().getFirstSync<{ id: string; performed_at: string }>(
      `SELECT w.id, w.performed_at FROM workouts w
       WHERE w.user_id = ? AND EXISTS (
         SELECT 1 FROM items i JOIN sets s ON s.item_id = i.id
         WHERE i.workout_id = w.id AND i.exercise_id = ? AND ${WORKING})
       ORDER BY w.performed_at DESC LIMIT 1`,
      [userId, exerciseId],
    ) ?? null
  );
}

function workingSetsOf(workoutId: string, exerciseId: string): WorkingSet[] {
  return getDb().getAllSync<WorkingSet>(
    `SELECT s.reps, s.weight_kg, s.rir FROM sets s JOIN items i ON s.item_id = i.id
     WHERE i.workout_id = ? AND i.exercise_id = ? AND ${WORKING} ORDER BY s.position`,
    [workoutId, exerciseId],
  );
}

function topCardioOf(
  workoutId: string,
  exerciseId: string,
): { distance_m: number | null; duration_s: number | null } {
  const row = getDb().getFirstSync<{ distance_m: number | null; duration_s: number | null }>(
    `SELECT s.distance_m, s.duration_s FROM sets s JOIN items i ON s.item_id = i.id
     WHERE i.workout_id = ? AND i.exercise_id = ? AND ${WORKING}
       AND (s.distance_m IS NOT NULL OR s.duration_s IS NOT NULL)
     ORDER BY s.position LIMIT 1`,
    [workoutId, exerciseId],
  );
  return { distance_m: row?.distance_m ?? null, duration_s: row?.duration_s ?? null };
}

/** Top set of the ≤2 sessions BEFORE the base — the engine's stall/deload
 * lookback (mirrors predict/data.ts priorTopsFor). */
function priorTopsFor(userId: string, exerciseId: string, beforeIso: string): PriorTop[] {
  const db = getDb();
  const workouts = db.getAllSync<{ id: string }>(
    `SELECT w.id FROM workouts w
     WHERE w.user_id = ? AND w.performed_at < ?
       AND EXISTS (SELECT 1 FROM items i JOIN sets s ON s.item_id = i.id
                   WHERE i.workout_id = w.id AND i.exercise_id = ? AND ${WORKING})
     ORDER BY w.performed_at DESC LIMIT 2`,
    [userId, beforeIso, exerciseId],
  );
  return workouts.map((w) => {
    const row = db.getFirstSync<{ weight: number | null; reps: number | null }>(
      `SELECT s.weight_kg AS weight, MAX(s.reps) AS reps FROM sets s JOIN items i ON s.item_id = i.id
       WHERE i.workout_id = ? AND i.exercise_id = ? AND ${WORKING}
         AND s.weight_kg = (
           SELECT MAX(s2.weight_kg) FROM sets s2 JOIN items i2 ON s2.item_id = i2.id
           WHERE i2.workout_id = ? AND i2.exercise_id = ? AND s2.kind NOT IN ('warmup','drop','skipped'))
       GROUP BY s.weight_kg`,
      [w.id, exerciseId, w.id, exerciseId],
    );
    return { weight: row?.weight ?? null, reps: row?.reps ?? null };
  });
}

function titleCase(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
