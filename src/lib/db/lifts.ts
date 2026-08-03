import { dayKeyFor, type DayKey } from './dates';
import { getDb } from './index';

/**
 * The Lifts list (CLAUDE.md §11.2): every exercise the user has ever named,
 * sorted by most recent, each row dense enough to answer "how is my bench
 * going?" without opening anything — name, when it was last performed, and the
 * top set of that session.
 *
 * There is no exercise library to browse (§1.1), so this list IS the library:
 * a lift exists here only because the user wrote it down.
 */
export interface LiftRow {
  /** Case-folded canonical — the identity the rest of the app keys on. */
  key: string;
  canonical: string;
  modality: string;
  /** The day of the most recent session containing this lift. */
  lastDay: DayKey;
  /** How many sessions this lift has ever appeared in. */
  sessions: number;
  /** Heaviest counted set of the LAST session ("what did I do last time"). */
  topWeight: number | null;
  topReps: number | null;
  /** What the user actually typed for this lift, most useful first. */
  aliases: string[];
}

interface OccurrenceRow {
  key: string;
  canonical: string;
  modality: string | null;
  aliases: string;
  workout_id: string;
  performed_at: string;
}

function parseAliases(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * @param pinName The primary lift from onboarding (block E, step 8), pinned to
 *   the top **on the first open only**. After that recency is the truth and
 *   pinning would be the app overruling the record. Matched on the canonical
 *   name and on what the user actually typed for it, so "bp" finds the bench.
 */
export function listLifts(userId: string, pinName?: string | null): LiftRow[] {
  const db = getDb();

  // Every occurrence, newest first. Rows are one per exercise per session — a
  // year of training is on the order of a thousand, which is nothing for a
  // local synchronous read, and folding them in JS keeps the SQL honest about
  // the global/user duplicate-canonical problem (`getExerciseStats` folds the
  // same way).
  const occurrences = db.getAllSync<OccurrenceRow>(
    `SELECT lower(e.canonical) AS key, e.canonical AS canonical, e.modality AS modality,
            e.aliases AS aliases, w.id AS workout_id, w.performed_at AS performed_at
     FROM items i
     JOIN exercises e ON i.exercise_id = e.id
     JOIN workouts w ON i.workout_id = w.id
     WHERE w.user_id = ?
     ORDER BY w.performed_at DESC`,
    [userId],
  );
  if (occurrences.length === 0) return [];

  const byKey = new Map<string, LiftRow & { lastWorkoutId: string }>();
  const workoutsSeen = new Map<string, Set<string>>();

  for (const o of occurrences) {
    let row = byKey.get(o.key);
    if (!row) {
      // First time we see the key = the most recent session, because the query
      // is ordered newest-first.
      row = {
        key: o.key,
        canonical: o.canonical,
        modality: o.modality ?? 'strength',
        lastDay: dayKeyFor(new Date(o.performed_at)),
        sessions: 0,
        topWeight: null,
        topReps: null,
        aliases: parseAliases(o.aliases),
        lastWorkoutId: o.workout_id,
      };
      byKey.set(o.key, row);
      workoutsSeen.set(o.key, new Set());
    } else if (row.aliases.length === 0) {
      // A global row and a user row can share a canonical; take whichever
      // carries the vocabulary.
      row.aliases = parseAliases(o.aliases);
    }
    workoutsSeen.get(o.key)!.add(o.workout_id);
  }

  for (const [key, workouts] of workoutsSeen) byKey.get(key)!.sessions = workouts.size;

  // The top set of each lift's LAST session, in one bounded query: at most one
  // workout id per lift.
  const lifts = [...byKey.values()];
  const lastIds = [...new Set(lifts.map((l) => l.lastWorkoutId))];
  const idList = lastIds.map(() => '?').join(',');
  const sets = db.getAllSync<{
    key: string;
    workout_id: string;
    reps: number | null;
    weight_kg: number | null;
  }>(
    `SELECT lower(e.canonical) AS key, i.workout_id AS workout_id, s.reps AS reps,
            s.weight_kg AS weight_kg
     FROM sets s
     JOIN items i ON s.item_id = i.id
     JOIN exercises e ON i.exercise_id = e.id
     WHERE i.workout_id IN (${idList})
       AND s.kind NOT IN ('warmup','drop','skipped')`,
    lastIds,
  );

  for (const s of sets) {
    const row = byKey.get(s.key);
    // Guard the join: this workout may also contain OTHER lifts, whose last
    // session is a different one.
    if (!row || row.lastWorkoutId !== s.workout_id) continue;
    if (s.weight_kg != null && (row.topWeight === null || s.weight_kg > row.topWeight)) {
      row.topWeight = s.weight_kg;
      row.topReps = s.reps;
    } else if (s.weight_kg != null && s.weight_kg === row.topWeight && s.reps != null) {
      row.topReps = Math.max(row.topReps ?? 0, s.reps);
    } else if (s.weight_kg == null && row.topWeight === null && s.reps != null) {
      // Bodyweight movements: reps carry the story.
      row.topReps = Math.max(row.topReps ?? 0, s.reps);
    }
  }

  const rows = lifts.map(({ lastWorkoutId: _lastWorkoutId, ...row }) => row);

  const needle = pinName?.trim().toLowerCase();
  if (!needle) return rows;
  const i = rows.findIndex(
    (r) => r.key === needle || r.aliases.some((a) => a.trim().toLowerCase() === needle),
  );
  // Not trained yet, or already first — nothing to move, and nothing is
  // invented: a lift the user has never written down does not appear here.
  if (i <= 0) return rows;
  return [rows[i]!, ...rows.slice(0, i), ...rows.slice(i + 1)];
}
