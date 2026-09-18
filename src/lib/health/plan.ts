// Relative + `.ts` extensions: this is the PURE half of the Health bridge, so
// it is bundled by Metro AND run under plain `node --test`, like
// `recap-schedule.ts` and `session-effort.ts`. Nothing here imports HealthKit,
// the database, or React.
import { MAX_SESSION_MINUTES, MIN_SESSION_MINUTES, sessionMinutes } from '../session-effort.ts';

/**
 * WHAT A RECORDED SESSION BECOMES IN APPLE HEALTH — the rules, with no I/O.
 *
 * `lib/health/index.ts` is the part that talks to HealthKit and the part that
 * cannot be tested without a device. Everything that DECIDES anything is here:
 * whether a session may be written at all, when it started and ended, and what
 * kind of training it was. All three are answered from the record and from
 * nothing else.
 *
 * ## Recore writes to Health. It does not read from it.
 *
 * One direction, and the direction that cannot damage the record (CLAUDE.md §3:
 * "raw workout text is the source of truth"). A session the athlete finished is
 * copied out to Health so their training counts in the other apps on their
 * phone; nothing comes back, so nothing in Health can add a set, move a load,
 * or create a day that was never trained.
 *
 * ## The numbers are the record's own, or there are none
 *
 * A workout sample carries a start and an end and — optionally — energy,
 * distance and heart rate. Recore has the first two and does not have the rest.
 *
 * **Energy is never written.** It is not derivable from a lifting note: it
 * needs body mass, an activity coefficient and a duration, and the first two
 * would have to be invented. An invented kilojoule count in Health is worse
 * than a missing one, because Health adds it to the day's totals and every
 * other app on the phone then reads it as measured (CLAUDE.md §2 rule 3 — "a
 * model writes language, never facts"; the same rule binds code).
 *
 * **Distance is never written**, for the same reason: a note that says "5k easy"
 * is a distance the parser read, but a session is not a route and Health would
 * attach it to the workout as though it had been measured by the phone.
 *
 * ## Which sessions are eligible
 *
 * Two conditions, both of them the app's own existing honesty rules rather than
 * new ones invented for Health:
 *
 * 1. **The span has to be plausible.** `sessionMinutes` already refuses a span
 *    under ten minutes or over six hours — a note typed from memory on the sofa
 *    and a note left open overnight. Those spans are wrong as durations, and a
 *    duration is most of what a Health workout IS. So a session that cannot be
 *    timed is not written at all, rather than written with a guess.
 *
 * 2. **The parse has to have landed.** Until it has, the app does not know what
 *    kind of training the note describes, and the activity type is the second
 *    thing a workout sample carries. A session with no read items waits for the
 *    next catch-up pass instead of going in as "Other".
 *
 * Both conditions can flip from false to true later — a parse lands, nothing
 * else changes — which is why the writer is a catch-up sweep and not a single
 * shot at Finish.
 */

/**
 * The kinds of training this app can honestly claim, and nothing finer.
 *
 * Health's own list has more than seventy entries and the parser reads four
 * modalities, so the mapping is deliberately coarse: a claim that a session was
 * a "run" rather than "cardio" is a claim the note usually does not support.
 * `lib/health/index.ts` turns these into HealthKit's numbers.
 */
export type HealthActivity = 'strength' | 'cardio';

export interface HealthWorkoutPlan {
  /** UTC ISO, the workout's start in Health — the note's `created_at`. */
  startIso: string;
  /** UTC ISO, its end — the note's `updated_at` at the moment it was read. */
  endIso: string;
  /** Whole minutes between the two, by `sessionMinutes`' rules. */
  minutes: number;
  activity: HealthActivity;
}

export interface HealthWorkoutInput {
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
  /**
   * The parser's modality for every item in the session that carried at least
   * one set. Empty means the note has not been read yet — see condition 2.
   */
  modalities: readonly string[];
}

/**
 * WHAT THE SESSION IS CALLED IN HEALTH.
 *
 * Anything loaded, carried or held is strength training; a session that is
 * ONLY cardio is cardio. The asymmetry is on purpose and it is the honest way
 * round: Recore is a lifting record, so a session with squats and a finisher on
 * the bike is a lifting session that ended on a bike — filing it as cardio
 * would misdescribe the hour. The reverse case, a note that is nothing but a
 * run, has no lifting in it to misdescribe.
 *
 * `carry` and `hold` sit with strength because that is what they are —
 * a farmer's walk and a dead hang are loaded work, and Health has no truer
 * bucket for either. An unknown modality string (a parser that grew a fifth one
 * before this file heard about it) counts as strength rather than being
 * dropped: the session still happened, and the alternative is silently
 * refusing to write it.
 */
export function activityForModalities(modalities: readonly string[]): HealthActivity | null {
  if (modalities.length === 0) return null;
  return modalities.every((m) => m === 'cardio') ? 'cardio' : 'strength';
}

/**
 * The whole eligibility decision, in one call. Null means "not this session,
 * not yet" — never an error and never a reason to stop the sweep.
 */
export function planHealthWorkout(input: HealthWorkoutInput): HealthWorkoutPlan | null {
  const minutes = sessionMinutes(input.createdAt, input.updatedAt);
  if (minutes == null) return null;

  const activity = activityForModalities(input.modalities);
  if (activity == null) return null;

  // `sessionMinutes` proved both parse, so these cannot be NaN.
  const startIso = new Date(Date.parse(input.createdAt!)).toISOString();
  const endIso = new Date(Date.parse(input.updatedAt!)).toISOString();
  return { startIso, endIso, minutes, activity };
}

/**
 * Why a session is not in Health — the sentence the settings screen prints
 * when somebody asks, so "nothing happened" is never the whole answer.
 *
 * It restates the two conditions above in the athlete's own terms. Deliberately
 * NOT a warning and NOT a thing to fix: a note typed from memory is a perfectly
 * good note, it just is not a timed session.
 */
export function healthSkipReason(input: HealthWorkoutInput): string | null {
  if (planHealthWorkout(input) != null) return null;
  if (activityForModalities(input.modalities) == null) {
    return 'Recore has not read this session yet.';
  }
  return `Health workouts need a start and an end, and this note was open for less than ${MIN_SESSION_MINUTES} minutes or more than ${MAX_SESSION_MINUTES / 60} hours.`;
}
