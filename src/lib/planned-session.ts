import { nameKey, typedNameOf } from './parse/receipt.ts';

/**
 * The planned session (owner's spec §E, 13 Aug 2026) — pure, zero I/O, runs
 * under `node --test`.
 *
 * A session picked from the sheet arrives here as a CHECKLIST OF PLANNED SETS:
 * each row is a set the prescription engine recommends, and none of it is the
 * record. That distinction is the whole module:
 *
 *  - **Planned sets are not history.** They are excluded from today's totals,
 *    from weekly volume, from the streak and from every statistic — and not by
 *    remembering to filter them at each call site, but structurally: a planned
 *    set has never been written into `raw_text`, and `raw_text` is the only
 *    thing the parser, the projections and the statistics ever read.
 *  - **Completing a set writes it down.** Tapping a row's circle turns the
 *    plan into REAL TYPED TEXT in the note, exactly as if the athlete had
 *    written the line themselves (`checkGhostLine` set the precedent). From
 *    that instant the set counts everywhere, through the one path that has
 *    always counted things. Nothing here computes a total the app then
 *    believes.
 *  - **The written line always wins** (§E.4). Free text keeps working while a
 *    session is prefilled. If the athlete writes or rewrites a movement's line
 *    themselves, the checklist RELEASES that movement: it stops writing text
 *    for it and only tracks which of its rows are done. Two authors for one
 *    line is the one way this feature could corrupt a record.
 *
 * The engine's numbers arrive already computed (`lib/plan/prescribe.ts`); this
 * file never derives a load, a rep target or a progression — it moves rows
 * between two states and renders their text.
 */

export type PlannedSetState = 'planned' | 'logged';

export interface PlannedSet {
  /** Stable within a session: `${exercise index}:${set index}`. */
  id: string;
  /** Movement name as it will be written into the note. */
  exercise: string;
  /** 1-based position of this set within its movement. */
  index: number;
  /** Prescribed load in kg; null for bodyweight / cardio rows. */
  weightKg: number | null;
  /** Prescribed reps; null when the movement is not counted in reps. */
  reps: number | null;
  state: PlannedSetState;
}

export interface PlannedSession {
  /** Which picker option produced it (`lib/session-options.ts`). */
  source: 'type' | 'repeat' | 'empty';
  /** The session type's own name — "Push", "Day A", "Last session". */
  label: string;
  sets: PlannedSet[];
  /**
   * Movement → the exact line this checklist last wrote for it. It is how a
   * second completed set REWRITES one line instead of appending a duplicate,
   * and how the module notices the athlete has taken the line over.
   */
  written: Record<string, string>;
  /** Movements the athlete is writing themselves; the checklist keeps its
   * hands off their text (§E.4). */
  released: string[];
}

export interface PlannedMove {
  name: string;
  /** How many sets are planned. Clamped to at least one. */
  sets: number;
  reps: number | null;
  weightKg: number | null;
}

export function buildPlannedSession(
  source: PlannedSession['source'],
  label: string,
  moves: readonly PlannedMove[],
): PlannedSession {
  const sets: PlannedSet[] = [];
  moves.forEach((move, moveIndex) => {
    const name = move.name.trim();
    if (!name) return;
    const count = Math.max(1, Math.round(move.sets));
    for (let i = 1; i <= count; i += 1) {
      sets.push({
        id: `${moveIndex}:${i}`,
        exercise: name,
        index: i,
        weightKg: move.weightKg,
        reps: move.reps,
        state: 'planned',
      });
    }
  });
  return { source, label, sets, written: {}, released: [] };
}

/**
 * The plan strip's rows as planned movements.
 *
 * The prescription engine is not touched by any of this (§F): its rows arrive
 * exactly as `lib/plan/prescribe.ts` builds them, and the LOAD is taken from
 * `weightKg`, the number the engine publishes for callers that compare rather
 * than display. Only the rep SCHEME is read out of the display string, because
 * that is the one part the engine formats and does not also expose — and reps
 * are integers written as `5·5·5`, not a value that can collapse the way a
 * multi-set load can (§7.7).
 */
export function movesFromPlanRows(
  rows: readonly { name: string; value: string | null; weightKg?: number | null }[],
): PlannedMove[] {
  return rows.map((row) => {
    const value = row.value?.trim() ?? '';
    const weightKg = row.weightKg ?? null;

    if (weightKg != null) {
      const reps = repsOf(value);
      return { name: row.name, sets: Math.max(1, reps.length), reps: reps[0] ?? null, weightKg };
    }
    // Bodyweight rows are published as "3×8".
    const bodyweight = /^(\d+)\s*×\s*(\d+)$/.exec(value);
    if (bodyweight) {
      return {
        name: row.name,
        sets: Number(bodyweight[1]),
        reps: Number(bodyweight[2]),
        weightKg: null,
      };
    }
    // Cardio, holds, and movements with no history to progress from: one row,
    // no numbers. Never extrapolate from nothing (CLAUDE.md §7.3).
    return { name: row.name, sets: 1, reps: null, weightKg: null };
  });
}

/** "82.5 × 5·5·5" → [5, 5, 5]. Empty when the value carries no rep scheme. */
function repsOf(value: string): number[] {
  const scheme = value.includes('×') ? value.slice(value.indexOf('×') + 1) : value;
  const reps = scheme
    .split('·')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return reps;
}

/** The movements of a session, in order, each with its rows. */
export function movesOf(session: PlannedSession): { exercise: string; sets: PlannedSet[] }[] {
  const order: string[] = [];
  const byExercise = new Map<string, PlannedSet[]>();
  for (const set of session.sets) {
    if (!byExercise.has(set.exercise)) {
      byExercise.set(set.exercise, []);
      order.push(set.exercise);
    }
    byExercise.get(set.exercise)!.push(set);
  }
  return order.map((exercise) => ({ exercise, sets: byExercise.get(exercise)! }));
}

/**
 * What this session contributes to a total. ONLY logged sets are counted —
 * a planned set contributes nothing to the count and nothing to the volume,
 * which is §E.2 stated as arithmetic.
 *
 * The app's real totals come from the parsed record, not from here; this is
 * what the checklist itself reports ("3 of 12 sets"), and the property the
 * tests hold the state machine to.
 */
export function plannedTotals(session: PlannedSession): { sets: number; volumeKg: number } {
  let sets = 0;
  let volumeKg = 0;
  for (const set of session.sets) {
    if (set.state !== 'logged') continue;
    sets += 1;
    if (set.weightKg != null && set.reps != null) volumeKg += set.weightKg * set.reps;
  }
  return { sets, volumeKg };
}

/** How many rows are still owed. */
export function remainingSets(session: PlannedSession): number {
  return session.sets.filter((s) => s.state === 'planned').length;
}

export function isComplete(session: PlannedSession): boolean {
  return session.sets.length > 0 && remainingSets(session) === 0;
}

/** The result of a tap: the session as it now stands, and the note it implies.
 * Both or neither — a logged set that failed to reach the note would be a set
 * the app counts and the record does not. */
export interface PlannedEdit {
  session: PlannedSession;
  note: string;
}

/**
 * Tap a circle: this set is done, at the planned values (§E.3). It moves into
 * the record — the movement's line in the note is (re)written to include it —
 * and from that moment it counts everywhere the record counts.
 *
 * Idempotent: tapping a logged row again changes nothing, so a double tap
 * cannot log a set twice.
 */
export function logSet(session: PlannedSession, note: string, id: string): PlannedEdit {
  const target = session.sets.find((s) => s.id === id);
  if (!target || target.state === 'logged') return { session, note };
  return commit(session, note, id, { state: 'logged' });
}

/**
 * Long-press, or a tap on the values: log what actually happened instead of the
 * plan (§E.3). A planned set becomes logged with the edited numbers; a set that
 * is ALREADY logged stays logged and its numbers are corrected — editing a
 * record is not a way to leave it.
 */
export function editSet(
  session: PlannedSession,
  note: string,
  id: string,
  values: { weightKg?: number | null; reps?: number | null },
): PlannedEdit {
  const target = session.sets.find((s) => s.id === id);
  if (!target) return { session, note };
  return commit(session, note, id, {
    state: 'logged',
    weightKg: values.weightKg === undefined ? target.weightKg : values.weightKg,
    reps: values.reps === undefined ? target.reps : values.reps,
  });
}

/** Undo a tap: the set goes back to planned and leaves the record with it. */
export function unlogSet(session: PlannedSession, note: string, id: string): PlannedEdit {
  const target = session.sets.find((s) => s.id === id);
  if (!target || target.state === 'planned') return { session, note };
  return commit(session, note, id, { state: 'planned' });
}

function commit(
  session: PlannedSession,
  note: string,
  id: string,
  patch: Partial<Pick<PlannedSet, 'state' | 'weightKg' | 'reps'>>,
): PlannedEdit {
  const sets = session.sets.map((s) => (s.id === id ? { ...s, ...patch } : s));
  const exercise = session.sets.find((s) => s.id === id)!.exercise;
  const next: PlannedSession = { ...session, sets };

  // A movement the athlete has taken over is theirs: the row's state still
  // moves, the note is not touched.
  if (session.released.includes(exercise)) return { session: next, note };

  const logged = sets.filter((s) => s.exercise === exercise && s.state === 'logged');
  const previous = session.written[exercise] ?? null;
  const line = setLineText(exercise, logged);
  const written = { ...session.written };
  if (line) written[exercise] = line;
  else delete written[exercise];

  return { session: { ...next, written }, note: applyLine(note, previous, line) };
}

/**
 * One movement's logged sets as a line of the athlete's own note.
 *
 * The shape is the one the parser is already fluent in — `squat 120kg×10·10·10`
 * — and this module writes nothing else. No parser change, no new grammar: the
 * checklist speaks the language the note already speaks, which is also what
 * makes the written line and the tapped line indistinguishable afterwards.
 */
export function setLineText(exercise: string, sets: readonly PlannedSet[]): string {
  const logged = sets.filter((s) => s.state === 'logged');
  if (logged.length === 0) return '';

  const name = exercise.trim();
  const reps = logged.map((s) => (s.reps == null ? null : String(s.reps)));
  const weights = new Set(logged.map((s) => s.weightKg));
  const repsText = reps.every((r) => r != null) ? reps.join('·') : '';

  // One load across the movement: the note's ordinary shorthand.
  if (weights.size === 1) {
    const weight = logged[0]!.weightKg;
    if (weight == null) return repsText ? `${name} ${repsText}` : name;
    return repsText ? `${name} ${formatKg(weight)}×${repsText}` : `${name} ${formatKg(weight)}`;
  }

  // Sets at different loads are spelled out one by one, so nothing is averaged
  // into a number the athlete did not do.
  const parts = logged.map((s) => {
    if (s.weightKg == null) return s.reps == null ? '' : String(s.reps);
    return s.reps == null ? formatKg(s.weightKg) : `${formatKg(s.weightKg)}×${s.reps}`;
  });
  return `${name} ${parts.filter(Boolean).join(' · ')}`.trim();
}

/** `82.5` → "82.5kg", `80` → "80kg". Storage is kg everywhere, and so is the
 * note the athlete would have typed with the plan in front of them. */
export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0+$/, '')}kg`;
}

/**
 * Put `next` in the note where `previous` was.
 *
 * Replaces the LAST line that is exactly `previous` — the line this checklist
 * wrote — and appends when there is none, which covers both the first set of a
 * movement and the case where the athlete has since deleted or rewritten the
 * line. An empty `next` removes the line: unchecking every set of a movement
 * leaves no trace of it in the record.
 */
export function applyLine(note: string, previous: string | null, next: string): string {
  const lines = note.split('\n');
  const wanted = previous?.trim();
  const at = wanted ? lastIndexOfLine(lines, wanted) : -1;

  if (at >= 0) {
    if (next) lines[at] = next;
    else lines.splice(at, 1);
    return lines.join('\n');
  }
  if (!next) return note;

  const base = note.replace(/\s+$/, '');
  return base.length > 0 ? `${base}\n${next}` : next;
}

function lastIndexOfLine(lines: readonly string[], text: string): number {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i]!.trim() === text) return i;
  }
  return -1;
}

/**
 * Reconcile the checklist with what is actually written (§E.4).
 *
 * Every line of the note that names one of the session's movements and is NOT
 * the line this checklist wrote is the athlete writing for themselves. That
 * movement is RELEASED: from then on its rows can still be ticked off (so the
 * checklist's own progress stays honest) but the module never edits its text
 * again. A release is permanent for the session — an athlete who has taken the
 * pen does not hand it back mid-workout.
 *
 * Called after every note change, so a line typed by hand and a line produced
 * by a tap can never both claim the same movement.
 */
export function settleFromNote(session: PlannedSession, note: string): PlannedSession {
  const released = new Set(session.released);
  const ownLines = new Set(Object.values(session.written).map((l) => l.trim()));
  const keys = new Map<string, string>();
  for (const set of session.sets) keys.set(nameKey(set.exercise), set.exercise);

  for (const raw of note.split('\n')) {
    const line = raw.trim();
    if (!line || ownLines.has(line)) continue;
    const named = keys.get(nameKey(typedNameOf(line)));
    if (named) released.add(named);
  }

  if (released.size === session.released.length) return session;
  return { ...session, released: [...released] };
}

/** Is this movement still the checklist's to write? */
export function ownsExercise(session: PlannedSession, exercise: string): boolean {
  return !session.released.includes(exercise);
}
