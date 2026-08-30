import { dayKeyFor, daysBetween, todayKey } from '@/lib/db/dates';
import { getDb } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';
import { focusForGoal } from '@/lib/onboarding';
import { moveFor, repScheme, whyFor, type Move } from '@/lib/plan/prescribe';
import { getGoal, getSmallestPlateKg } from '@/lib/prefs';
import { getAnswer } from '@/lib/profile-answers';

import { dueLifts, gapsOf, median, typicalSessionSize, type LiftCadence } from './flat';

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
/**
 * ONE LIFT OF THE GHOST, with the engine's reason for it (owner, 28 Aug 2026).
 *
 * `ghostText` is the session as WRITABLE TEXT — the lines a person accepts,
 * edits or overwrites, and the parser reads back. It carries numbers and
 * nothing else, which is right: a reason is not something you write into a
 * note.
 *
 * But Next's row now states the reason for every target it prints, and until
 * now the ghost path could not. Not because the arithmetic was missing —
 * `computeNextSession` builds a full `Reason` per lift, hands `pickBest` the
 * whole set, keeps the single best sentence for the session and drops the
 * rest. This is that set, kept.
 *
 * `canonical` is the RECORD's spelling, which is how `db/brief.ts` matches a
 * ghost line back to its reason — never by index. `ghostText`'s own lines are
 * lowercased for writing, and a cardio line contributes text with no entry
 * here at all, so position is not a key anything may rely on.
 */
export interface GhostLine {
  canonical: string;
  /** The engine's reason as a fragment ("you filled every set of 8 at 82.5"). */
  why: string | null;
  /** Which lever moved — add weight, add a rep, hold, back off. */
  move: Move | null;
  /** "5·5·5" — the per-set voice the declared-split path speaks. `ghostText`
   * writes "3×5" because that is what a person types; the SCREEN says it the
   * way the plan strip says it, so one lift reads identically on both paths. */
  scheme: string | null;
  weightKg: number | null;
}

export interface PredictionDraft {
  ghostText: string;
  reason: string | null;
  /** The per-lift reasons behind `ghostText`, in plan order. */
  lines: GhostLine[];
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
  /**
   * WHICH MOVEMENTS COME NEXT — the one question the two paths answer
   * differently (29 August 2026).
   *
   * A flat lifter's session is assembled lift by lift, most overdue by its own
   * cadence first (`flatItems`). Everyone else progresses the session the
   * rotation says they are due for. Both then run through the identical
   * `prescribeItem`, so the ARITHMETIC never differs — only the roster.
   *
   * `base` is the session this prediction is PHRASED from — what the explain
   * payload quotes back. On the rotation path that is the workout being
   * progressed; on the flat path there is no single one, so it is the session
   * the athlete just wrote, which is the text they would recognise.
   *
   * `pickBaseWorkout` runs eleven queries to read the rotation, so the flat
   * path does not call it at all.
   */
  const flat = getAnswer('split') === 'flat';
  const base = flat ? trigger : (pickBaseWorkout(userId) ?? trigger);
  const plan: { item: TodayItem & { item_id: string }; beforeIso: string }[] = flat
    ? flatItems(userId)
    : db
        .getAllSync<TodayItem & { item_id: string }>(
          `SELECT i.id AS item_id, e.id AS exercise_id, e.canonical, e.modality, e.increment_kg
           FROM items i JOIN exercises e ON e.id = i.exercise_id
           WHERE i.workout_id = ? ORDER BY i.position`,
          [base.id],
        )
        .map((item) => ({ item, beforeIso: base.performed_at }));
  if (plan.length === 0) return null;

  const lines: string[] = [];
  const reasons: { canonical: string; prescription: Prescription }[] = [];
  const explained: GhostLine[] = [];

  for (const { item, beforeIso } of plan) {
    const out = prescribeItem(userId, item, beforeIso);
    if (!out) continue;
    lines.push(out.line);
    if (out.candidate) reasons.push(out.candidate);
    if (out.ghost) explained.push(out.ghost);
  }

  if (lines.length === 0) return null;

  const best = pickBest(reasons);
  return {
    ghostText: lines.join('\n'),
    reason: best ? sentenceFor(best) : null,
    lines: explained,
    explain: best ? explainPayload(best, base.raw_text) : null,
  };
}

/**
 * ONE MOVEMENT, PROGRESSED — the body of the prediction loop, extracted so the
 * two paths into it cannot drift apart (29 August 2026).
 *
 * The rotation path feeds it the items of one workout; the flat path feeds it
 * one item per lift, each from that lift's own most recent session. Everything
 * downstream — the engine call, the plate rounding, the focus fallback, the
 * phrasing, the reason — is identical, which is the point: a flat lifter and a
 * split lifter are prescribed by the same arithmetic, and only the question of
 * WHICH movements come next is answered differently.
 *
 * `beforeIso` is the session being progressed FROM, so `priorTops` never reads
 * the session it is about to progress.
 */
function prescribeItem(
  userId: string,
  item: TodayItem & { item_id: string },
  beforeIso: string,
): { line: string; candidate: Candidate | null; ghost: GhostLine | null } | null {
  const allSets = getDb().getAllSync<SetRow>(
    'SELECT kind, reps, weight_kg, distance_m, duration_s, rir FROM sets WHERE item_id = ? ORDER BY position',
    [item.item_id],
  );
  const working = allSets.filter((s) => s.kind !== 'warmup' && s.kind !== 'drop');
  if (working.length === 0) return null;

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
      priorTops: priorTopsFor(userId, item.exercise_id, beforeIso),
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
    return {
      line: strengthLine(name, prescription),
      candidate: { canonical: item.canonical, prescription },
      ghost: ghostLineOf(item.canonical, prescription),
    };
  }

  if (hasReps) {
    const prescription = progressBodyweight(todaySets);
    return {
      line: `${name} ${prescription.sets}×${prescription.reps}`,
      candidate: { canonical: item.canonical, prescription },
      ghost: ghostLineOf(item.canonical, prescription),
    };
  }

  // Cardio / carries / holds: repeat the last prescription as-is. No engine, so
  // no reason and no lever — the row will state the record it came from.
  const top = working[0]!;
  if (top.distance_m != null) {
    return { line: `${name} ${formatDistance(top.distance_m)}`, candidate: null, ghost: null };
  }
  if (top.duration_s != null) {
    return { line: `${name} ${top.duration_s}s`, candidate: null, ghost: null };
  }
  return null;
}

/**
 * THE FLAT PATH — the next session assembled lift by lift.
 *
 * Reached only when the athlete answered "I don't follow a split" (onboarding
 * screen 14). The answer drives it, not the record: `flow.ts` marks that option
 * `drivesBranch`, and CLAUDE.md §2 rule 2 is to personalise from CHOSEN
 * information. Somebody whose sessions happen to cluster is still somebody who
 * told us they do not follow a split.
 *
 * Three reads, all bounded, all off the same window:
 *
 *  1. every (lift, session) pair inside `FLAT_WINDOW_DAYS`, newest first —
 *     which gives each lift its days-since AND its own cadence;
 *  2. how many movements the athlete's recent sessions actually hold;
 *  3. the sets of each picked lift's own most recent session.
 *
 * The ranking is `predict/flat.ts` and is pure. A lift last trained beyond the
 * window simply does not appear: after a layoff that long a progression would
 * prescribe weights the lifter may no longer have, which is §7.4's rule and the
 * same reason `GHOST_MAX_AGE_DAYS` exists.
 */
function flatItems(userId: string): { item: TodayItem & { item_id: string }; beforeIso: string }[] {
  const db = getDb();
  const today = todayKey();
  const since = new Date(Date.now() - FLAT_WINDOW_DAYS * 86_400_000).toISOString();

  const rows = db.getAllSync<{
    exercise_id: string;
    canonical: string;
    modality: string;
    increment_kg: number | null;
    item_id: string;
    performed_at: string;
  }>(
    `SELECT e.id AS exercise_id, e.canonical, e.modality, e.increment_kg,
            i.id AS item_id, w.performed_at
     FROM items i
     JOIN exercises e ON e.id = i.exercise_id
     JOIN workouts w ON w.id = i.workout_id
     WHERE w.user_id = ? AND w.performed_at >= ?
     ORDER BY e.id, w.performed_at DESC`,
    [userId, since],
  );
  if (rows.length === 0) return [];

  // Per lift: its latest item (rows are newest-first inside each exercise) and
  // the day-counts every one of its sessions sits at.
  const latest = new Map<string, (typeof rows)[number]>();
  const days = new Map<string, number[]>();
  for (const row of rows) {
    if (!latest.has(row.exercise_id)) latest.set(row.exercise_id, row);
    const list = days.get(row.exercise_id);
    const age = daysBetween(dayKeyFor(new Date(row.performed_at)), today);
    if (list) list.push(age);
    else days.set(row.exercise_id, [age]);
  }

  const cadences: LiftCadence[] = [...latest.keys()].map((id) => {
    const ages = days.get(id) ?? [];
    return { key: id, since: ages[0] ?? 0, gap: median(gapsOf(ages)) };
  });

  const sizes = db
    .getAllSync<{ n: number }>(
      `SELECT COUNT(DISTINCT i.exercise_id) AS n
       FROM workouts w JOIN items i ON i.workout_id = w.id
       WHERE w.user_id = ? AND w.performed_at >= ? AND i.exercise_id IS NOT NULL
       GROUP BY w.id
       ORDER BY w.performed_at DESC
       LIMIT ?`,
      [userId, since, ROTATION_WINDOW],
    )
    .map((r) => r.n);

  return dueLifts(cadences, typicalSessionSize(sizes)).map((c) => {
    const row = latest.get(c.key)!;
    return {
      item: {
        item_id: row.item_id,
        exercise_id: row.exercise_id,
        canonical: row.canonical,
        modality: row.modality,
        increment_kg: row.increment_kg,
      },
      beforeIso: row.performed_at,
    };
  });
}

/**
 * One prescription, as the row will need to explain it.
 *
 * Every field is read off the `Prescription` the engine already returned —
 * `whyFor` and `moveFor` are the SAME templates the declared-split path runs
 * through (`plan/prescribe.ts`), so a lift prescribed by the ghost and the
 * same lift prescribed by a plan day give the reader the same sentence. Two
 * copies of this phrasing is how two surfaces start disagreeing about one
 * lift.
 */
function ghostLineOf(canonical: string, p: Prescription): GhostLine {
  return {
    canonical,
    why: whyFor(p.reason),
    move: moveFor(p.reason),
    scheme: p.reps != null ? repScheme(p.sets, p.reps) : `${p.sets} sets`,
    weightKg: p.weightKg ?? null,
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

/**
 * How far back the flat scheduler looks for a lift's cadence.
 *
 * Four months: long enough that a three-weekly movement contributes several
 * gaps, short enough that a lift abandoned last spring does not reappear in
 * tonight's session. A lift with nothing inside the window is not scheduled at
 * all — after a layoff that long a progression would prescribe weights the
 * lifter may no longer have (§7.4).
 */
const FLAT_WINDOW_DAYS = 120;

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
