import { getDb } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';
import { focusForGoal } from '@/lib/onboarding';
import { getGoal, getSmallestPlateKg } from '@/lib/prefs';

import {
  defaultRepRangeFor,
  progressBodyweight,
  progressStrength,
  type Prescription,
  type PriorTop,
  type Reason,
  type WorkingSet,
} from './engine';
import { pickNextSession, type SessionExercises } from './split';

/**
 * Assemble history from SQLite, run the pure engine, and phrase the result
 * (CLAUDE.md §7). The one-line reason is a TEMPLATE over the engine's facts —
 * built from the RIR/reps the parser extracted from the user's own note. If
 * no exercise produced a real reason, there is NO line: silence beats generic
 * encouragement. (A follow-up `explain-prediction` edge function can later
 * rewrite these templates in the user's language — V2.)
 *
 * SPLIT MATCHING (CLAUDE.md §7.2 Gap 2): the session progressed into the
 * ghost is the one the athlete is DUE for — inferred from the rotation of
 * their recent sessions (pure logic in ./split.ts) — not blindly the one just
 * logged. A PPL athlete finishing push day gets tomorrow's ghost of PULL day.
 * No detectable rotation → progress the most recent session (old behavior).
 */
export interface PredictionDraft {
  ghostText: string;
  reason: string | null;
  /** Facts + the user's own lines, for the optional explain-prediction edge
   * function (V2) to phrase the reason in the user's language. */
  explain: { facts: Record<string, string | number>; quotes: string[] } | null;
}

interface TodayItem {
  exercise_id: string;
  canonical: string;
  modality: string;
  increment_kg: number | null;
}

interface SetRow {
  kind: string;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rir: number | null;
}

export function computeNextSession(userId: string, workoutId: string): PredictionDraft | null {
  const db = getDb();
  const trigger = getWorkoutById(workoutId);
  if (!trigger) return null;

  // Progress the session the athlete is DUE for, not necessarily the trigger:
  // the rotation always ends at the LATEST session, so re-parsing an old note
  // still predicts from the true end of history.
  const workout = pickBaseWorkout(userId) ?? trigger;

  const items = db.getAllSync<TodayItem & { item_id: string }>(
    `SELECT i.id AS item_id, e.id AS exercise_id, e.canonical, e.modality, e.increment_kg
     FROM items i JOIN exercises e ON e.id = i.exercise_id
     WHERE i.workout_id = ? ORDER BY i.position`,
    [workout.id],
  );
  if (items.length === 0) return null;

  const lines: string[] = [];
  const reasons: { canonical: string; prescription: Prescription }[] = [];

  for (const item of items) {
    const allSets = db.getAllSync<SetRow>(
      'SELECT kind, reps, weight_kg, distance_m, duration_s, rir FROM sets WHERE item_id = ? ORDER BY position',
      [item.item_id],
    );
    const working = allSets.filter((s) => s.kind !== 'warmup' && s.kind !== 'drop');
    if (working.length === 0) continue;

    const name = item.canonical.toLowerCase();
    const todaySets: WorkingSet[] = working.map((s) => ({
      reps: s.reps,
      weight_kg: s.weight_kg,
      rir: s.rir,
    }));

    const hasLoad = todaySets.some((s) => s.weight_kg != null);
    const hasReps = todaySets.some((s) => s.reps != null);

    if (item.modality === 'strength' && hasLoad) {
      const prescription = progressStrength({
        todaySets,
        priorTops: priorTopsFor(userId, item.exercise_id, workout.performed_at),
        incrementKg: item.increment_kg ?? 2.5,
        // The gym profile from onboarding: suggestions land on rackable loads.
        smallestPlateKg: getSmallestPlateKg() ?? undefined,
        // The training focus from onboarding, as an engine DEFAULT. It only
        // decides the range when this exercise has no reps to infer one from;
        // performance always outranks a stated preference.
        //
        // `Goal` has FIVE values since 29 July (§5 screen 3) and the engine's
        // `Focus` still has three, so `focusForGoal` is the one bridge between
        // them (owner's ruling: a rep range for "general fitness" would be a
        // number nobody has evidence for, and CLAUDE.md §2 rule 3 says code
        // owns numbers). The mapping is total and unit-tested, so a new goal
        // added without a focus fails a test rather than silently prescribing.
        defaultRepRange: defaultRepRangeFor(focusForGoal(getGoal())),
      });
      lines.push(strengthLine(name, prescription));
      reasons.push({ canonical: item.canonical, prescription });
      continue;
    }

    if (hasReps) {
      const prescription = progressBodyweight(todaySets);
      lines.push(`${name} ${prescription.sets}×${prescription.reps}`);
      reasons.push({ canonical: item.canonical, prescription });
      continue;
    }

    // Cardio / carries / holds: repeat today's prescription as-is.
    const top = working[0]!;
    if (top.distance_m != null) {
      lines.push(`${name} ${formatDistance(top.distance_m)}`);
    } else if (top.duration_s != null) {
      lines.push(`${name} ${top.duration_s}s`);
    }
  }

  if (lines.length === 0) return null;

  const best = pickBest(reasons);
  return {
    ghostText: lines.join('\n'),
    reason: best ? sentenceFor(best) : null,
    explain: best ? explainPayload(best, workout.raw_text) : null,
  };
}

/** The workout to progress into the ghost: the most recent session of the
 * rotation slot that's due next; no readable rotation → the latest session. */
function pickBaseWorkout(userId: string) {
  const sessions = recentSessions(userId);
  if (sessions.length === 0) return null;

  const pickedId =
    pickNextSession(sessions.map((s) => ({ id: s.id, exerciseIds: s.exerciseIds }))) ??
    sessions[sessions.length - 1]!.id;
  return getWorkoutById(pickedId);
}

const ROTATION_WINDOW = 10;

/** The last ≤10 parsed sessions, oldest first, with their exercise sets. */
function recentSessions(userId: string): (SessionExercises & { performed_at: string })[] {
  const db = getDb();
  const workouts = db.getAllSync<{ id: string; performed_at: string }>(
    `SELECT w.id, w.performed_at FROM workouts w
     WHERE w.user_id = ?
       AND EXISTS (SELECT 1 FROM items i WHERE i.workout_id = w.id AND i.exercise_id IS NOT NULL)
     ORDER BY w.performed_at DESC LIMIT ?`,
    [userId, ROTATION_WINDOW],
  );

  return workouts.reverse().map((w) => ({
    id: w.id,
    performed_at: w.performed_at,
    exerciseIds: db
      .getAllSync<{ exercise_id: string }>(
        'SELECT DISTINCT exercise_id FROM items WHERE workout_id = ? AND exercise_id IS NOT NULL',
        [w.id],
      )
      .map((r) => r.exercise_id),
  }));
}

/** Top set of the previous ≤2 sessions of this exercise, most recent first. */
function priorTopsFor(userId: string, exerciseId: string, beforeIso: string): PriorTop[] {
  const db = getDb();
  const workouts = db.getAllSync<{ id: string }>(
    `SELECT w.id FROM workouts w
     WHERE w.user_id = ? AND w.performed_at < ?
       AND EXISTS (SELECT 1 FROM items i JOIN sets s ON s.item_id = i.id
                   WHERE i.workout_id = w.id AND i.exercise_id = ?
                     AND s.kind NOT IN ('warmup','drop'))
     ORDER BY w.performed_at DESC LIMIT 2`,
    [userId, beforeIso, exerciseId],
  );

  return workouts.map((w) => {
    const row = db.getFirstSync<{ weight: number | null; reps: number | null }>(
      `SELECT s.weight_kg AS weight, MAX(s.reps) AS reps FROM sets s
       JOIN items i ON s.item_id = i.id
       WHERE i.workout_id = ? AND i.exercise_id = ? AND s.kind NOT IN ('warmup','drop')
         AND s.weight_kg = (
           SELECT MAX(s2.weight_kg) FROM sets s2 JOIN items i2 ON s2.item_id = i2.id
           WHERE i2.workout_id = ? AND i2.exercise_id = ? AND s2.kind NOT IN ('warmup','drop')
         )
       GROUP BY s.weight_kg`,
      [w.id, exerciseId, w.id, exerciseId],
    );
    return { weight: row?.weight ?? null, reps: row?.reps ?? null };
  });
}

// --- phrasing ------------------------------------------------------------------

function strengthLine(name: string, p: Prescription): string {
  const scheme = p.reps != null ? `${p.sets}×${p.reps}` : `${p.sets} sets`;
  return p.weightKg != null ? `${name} ${scheme}  ${fmt(p.weightKg)} kg` : `${name} ${scheme}`;
}

type Candidate = { canonical: string; prescription: Prescription };

/** ONE line, and only when there is a real reason — priority: deload beats a
 * surplus beats a filled range. */
function pickBest(all: Candidate[]): Candidate | null {
  const rank: Record<Reason['code'], number> = {
    deload: 4,
    rir_surplus: 3,
    top_of_range: 2,
    add_rep: 1,
    hold: 0,
    repeat: 0,
  };

  let best: Candidate | null = null;
  for (const candidate of all) {
    if (rank[candidate.prescription.reason.code] === 0) continue;
    if (!best || rank[candidate.prescription.reason.code] > rank[best.prescription.reason.code]) {
      best = candidate;
    }
  }
  return best;
}

/** Template sentence over the engine's facts — the instant, offline V1 voice. */
function sentenceFor(best: Candidate): string | null {
  const name = best.canonical.toLowerCase();
  const r = best.prescription.reason;
  switch (r.code) {
    case 'deload':
      return `Two sessions stuck at ${fmt(r.from)} on ${name}. Backing off to ${fmt(r.to)}.`;
    case 'rir_surplus':
      return `Last time at ${fmt(r.weight)} you had ${fmt(r.minRir)} in reserve. So +${fmt(r.increment)}.`;
    case 'top_of_range':
      return `You filled every set of ${r.top} at ${fmt(r.weight)}. Up ${fmt(r.increment)}, back to ${r.bottom}s.`;
    case 'add_rep':
      // Only worth a sentence when the text said it was hard (RIR 0–1).
      return r.minRir != null && r.weight > 0
        ? `Nothing much left at ${fmt(r.weight)} last time. Same weight, one more rep.`
        : null;
    default:
      return null;
  }
}

/** The same facts, structured, plus the user's own lines for quoting. */
function explainPayload(best: Candidate, rawText: string): PredictionDraft['explain'] {
  const r = best.prescription.reason;
  const facts: Record<string, string | number> = { exercise: best.canonical, code: r.code };
  if ('weight' in r) facts.weight_kg = r.weight;
  if ('increment' in r) facts.increment_kg = r.increment;
  if ('minRir' in r && r.minRir != null) facts.min_rir = r.minRir;
  if ('top' in r) facts.rep_top = r.top;
  if ('bottom' in r) facts.rep_bottom = r.bottom;
  if (r.code === 'deload') {
    facts.weight_kg = r.from;
    facts.new_weight_kg = r.to;
  }
  if (best.prescription.weightKg != null) facts.next_weight_kg = best.prescription.weightKg;
  if (best.prescription.reps != null) facts.next_reps = best.prescription.reps;
  facts.next_sets = best.prescription.sets;

  const quotes = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => l.slice(0, 160));

  return { facts, quotes };
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function formatDistance(m: number): string {
  return m >= 1000 ? `${m / 1000}k` : `${m}m`;
}
