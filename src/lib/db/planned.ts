import {
  buildPlannedSession,
  movesFromPlanRows,
  type PlannedMove,
  type PlannedSession,
} from '@/lib/planned-session';
import {
  EMPTY_OPTION_ID,
  REPEAT_OPTION_ID,
  sessionOptions,
  type DetectedSessionType,
  type SessionOption,
} from '@/lib/session-options';

import { todayKey, type DayKey } from './dates';
import { getMeta, setMeta } from './index';
import { getRecentSessions, getWorkoutDetail } from './insights';
import { getPlanDay, listPlanDays, resolveTodayPlanDay } from './plan';
import { planStripFor } from './strip';

/**
 * The session picker's data layer (owner's spec §D, 13 Aug 2026): what the
 * sheet may offer, and what each option prefills the canvas with.
 *
 * The decisions are all in pure, tested modules — `lib/session-options.ts` for
 * what the sheet lists and `lib/planned-session.ts` for what a prefilled
 * session IS. This file only reads the database and hands them rows, which is
 * the same division `db/strip.ts` keeps with the prescription engine.
 *
 * NOTHING here writes. Choosing an option produces a checklist of PLANNED sets
 * and not one row of record; the record is written when a circle is tapped, as
 * text, through the note (§E.3).
 */

/** The session types the app has detected: the days of the athlete's declared
 * split, in the split's own order. */
export function detectedSessionTypes(userId: string): DetectedSessionType[] {
  return listPlanDays(userId).map((day) => ({
    id: day.id,
    label: day.label,
    detail: movementCountLabel(day.raw_text),
  }));
}

/** Everything the picker sheet shows, for today. */
export function sessionPickerOptions(userId: string, day: DayKey = todayKey()): SessionOption[] {
  const due = day === todayKey() ? resolveTodayPlanDay(userId, day) : null;
  const [last] = getRecentSessions(userId, 1, day);
  return sessionOptions({
    types: detectedSessionTypes(userId),
    dueTypeId: due?.id ?? null,
    last: last ? { label: 'Repeat last session', detail: lastSessionDetail(last) } : null,
  });
}

/**
 * The planned session one option produces, or null when there is nothing to
 * prefill with (an empty session, or a type whose template has no movements
 * the engine can speak about yet).
 */
export function plannedSessionFor(
  userId: string,
  option: SessionOption,
  day: DayKey = todayKey(),
): PlannedSession | null {
  if (option.kind === 'empty' || option.id === EMPTY_OPTION_ID) return null;

  if (option.kind === 'repeat' || option.id === REPEAT_OPTION_ID) {
    // The same cutoff the picker used to decide there WAS a last session — a
    // day cannot repeat itself.
    const [last] = getRecentSessions(userId, 1, day);
    if (!last) return null;
    const moves = movesOfWorkout(last.workoutId);
    return moves.length > 0 ? buildPlannedSession('repeat', option.label, moves) : null;
  }

  const planDay = getPlanDay(option.id);
  if (!planDay || planDay.user_id !== userId) return null;
  const strip = planStripFor(userId, planDay);
  if (!strip) return null;
  return buildPlannedSession('type', strip.label, movesFromPlanRows(strip.rows));
}

/**
 * "Repeat last session" is the last session again — its movements, its loads,
 * its set counts. Deliberately NOT progressed: the athlete asked to repeat, and
 * a repeat that quietly adds 2.5 kg is the app choosing a plan (CLAUDE.md §2
 * rule 3). The split days above go through the engine, which is where
 * progression belongs.
 *
 * Warm-ups and skipped sets are not part of the plan, the same exclusion every
 * total in the app makes.
 */
function movesOfWorkout(workoutId: string): PlannedMove[] {
  const detail = getWorkoutDetail(workoutId);
  if (!detail) return [];

  const moves: PlannedMove[] = [];
  for (const exercise of detail.exercises) {
    const working = exercise.sets.filter((s) => s.kind !== 'warmup' && s.kind !== 'skipped');
    if (working.length === 0) continue;
    // The top set is what the next session aims at; the rest of the rows carry
    // the same target, and whatever actually happens is edited in per set.
    const top = working.reduce((best, s) => ((s.weightKg ?? 0) > (best.weightKg ?? 0) ? s : best));
    moves.push({
      name: exercise.canonical,
      sets: working.length,
      reps: top.reps,
      weightKg: top.weightKg,
    });
  }
  return moves;
}

/**
 * The open checklist, kept per day in the local meta KV — the same sticky-meta
 * shape receipt mode and Finish use. A plan the athlete is halfway through must
 * survive a relaunch mid-session; it is not the record (nothing here is) but
 * losing it in the gym would send them back to the picker with half their sets
 * already written down.
 */
const plannedKey = (day: DayKey) => `planned_session:${day}`;

export function loadPlannedSession(day: DayKey): PlannedSession | null {
  const raw = getMeta(plannedKey(day));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlannedSession;
    if (!parsed || !Array.isArray(parsed.sets)) return null;
    return {
      source: parsed.source,
      label: String(parsed.label ?? ''),
      sets: parsed.sets,
      written: parsed.written ?? {},
      released: Array.isArray(parsed.released) ? parsed.released : [],
    };
  } catch {
    return null;
  }
}

export function savePlannedSession(day: DayKey, session: PlannedSession | null): void {
  setMeta(plannedKey(day), session ? JSON.stringify(session) : null);
}

/** "5 movements" — the evidence under a session type's label. */
function movementCountLabel(rawText: string): string | null {
  const count = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean).length;
  if (count === 0) return null;
  return `${count} ${count === 1 ? 'movement' : 'movements'}`;
}

function lastSessionDetail(last: { sets: number; exercises: number }): string {
  const parts: string[] = [];
  if (last.exercises > 0) {
    parts.push(`${last.exercises} ${last.exercises === 1 ? 'movement' : 'movements'}`);
  }
  if (last.sets > 0) parts.push(`${last.sets} ${last.sets === 1 ? 'set' : 'sets'}`);
  return parts.join(' · ');
}
