import { shiftDayKey } from './db/dates.ts';

/**
 * The session's own rating — PURE, zero I/O, so every rule here runs under
 * plain `node --test` like `effort.ts` and `reflection.ts` (owner, 10 September
 * 2026). Its one import is `db/dates.ts`, which is itself pure and zero-import.
 *
 * ## Why a SECOND effort question is not a duplicate of the first
 *
 * `effort.ts` asks how close ONE lift came to failure. That is a fact about a
 * set, it is the engine's input, and it is written into the athlete's own line
 * as `rpe N` because it is training notation.
 *
 * This one asks what the whole session COST — which is a different quantity,
 * measured differently, and used for something else entirely. A person can
 * finish every set two reps shy of failure and still walk out flattened by an
 * hour and a half of it; the per-set answer cannot see that, because volume is
 * not in it.
 *
 * It is the session-RPE method (Foster): one rating of the whole session,
 * multiplied by its duration, gives internal load in arbitrary units. Thirty-six
 * validity studies sit behind it, including in resistance training (Day et al.
 * 2004), and its two derivatives — monotony (a week's mean daily load over its
 * standard deviation) and strain (weekly load × monotony) — are what actually
 * flag an athlete accumulating more than they are absorbing.
 *
 * ## Why it is ONE question and not four
 *
 * The obvious alternative was a wellness check: sleep, fatigue, soreness,
 * stress. The evidence says subjective measures beat objective ones for
 * tracking the training response, and it also says the shorter the instrument
 * the better the compliance — single-item measures are answered when
 * multi-item ones are abandoned. A four-item form at the end of a workout is a
 * form that gets skipped, and a skipped form is worse than no form, because it
 * makes the answer set self-selecting on the days somebody had the patience.
 *
 * One tap, independent of how many lifts were logged, at the moment the answer
 * is freshest.
 *
 * ## What it never becomes
 *
 * **Not an input to any prescription.** The load a lift is given comes from
 * `predict/engine.ts` and reads `sets.rir` only. A session rating changing a
 * weight would mean a global feeling silently overriding a per-set fact.
 *
 * **Not a health assessment, not a verdict, not a score** (§8.1, §12). It is
 * counted and quoted; it is never graded, never coloured, never congratulated.
 * Nothing here may say a person trained well or badly.
 */

/** The three answers the check-in offers. Ordered lightest → heaviest, which
 * is the order the segmented control renders. */
export type SessionEffort = 'easy' | 'moderate' | 'hard';

export const SESSION_EFFORT_CHOICES: SessionEffort[] = ['easy', 'moderate', 'hard'];

/**
 * What each answer STORES, on Foster's modified CR-10.
 *
 * Three points on a ten-point scale, spaced where the scale's own anchors are
 * (3 moderate, 5 hard, 7 very hard) and pulled one step apart so the middle
 * answer is not doing two jobs. The stored value is the CR-10 number rather
 * than the id, for three reasons: the load arithmetic below is then a
 * multiplication and not a lookup; the export carries a number that means
 * something outside this app; and a finer scale, if it is ever asked for, is a
 * change to what the sheet OFFERS and not a migration of what is stored.
 */
export const SESSION_EFFORT_RPE: Record<SessionEffort, number> = {
  easy: 3,
  moderate: 5,
  hard: 8,
};

/**
 * The words on the control. Plain and physical, in the register a person uses
 * walking out — and deliberately NOT the per-lift vocabulary ("Could do more /
 * Just right / Nothing left"), which is about one set's proximity to failure.
 * Two different questions that read as the same question is how a sheet
 * teaches someone that answering it is pointless.
 */
export const SESSION_EFFORT_LABEL: Record<SessionEffort, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  hard: 'Hard',
};

/** What each one means, said once, so the scale is not folklore — the same
 * discipline `EFFORT_HINT` follows. Read out by VoiceOver beside the label. */
export const SESSION_EFFORT_HINT: Record<SessionEffort, string> = {
  easy: 'left the gym fresh',
  moderate: 'a normal session',
  hard: 'took everything you had',
};

/** Which chip a stored value lights up. Rounds to the nearest of the three, so
 * a value that arrives from a future finer scale — or from another device
 * running a later build — still shows the athlete an armed control instead of
 * a blank one. */
export function sessionEffortOf(rpe: number | null | undefined): SessionEffort | null {
  if (typeof rpe !== 'number' || !Number.isFinite(rpe)) return null;
  let best: SessionEffort = SESSION_EFFORT_CHOICES[0]!;
  let bestGap = Infinity;
  for (const choice of SESSION_EFFORT_CHOICES) {
    const gap = Math.abs(SESSION_EFFORT_RPE[choice] - rpe);
    if (gap < bestGap) {
      bestGap = gap;
      best = choice;
    }
  }
  return best;
}

/**
 * How long a session lasted, in whole minutes, or null when the record cannot
 * say honestly.
 *
 * The span is the workout row's own timestamps, and `updated_at` moves with
 * every keystroke — so it is the time between starting to write the session and
 * last touching it, which for someone logging as they train IS the session, and
 * for someone typing it up on the sofa afterwards is not. The bound is what
 * keeps that difference from becoming a lie: under ten minutes is a note typed
 * from memory, over six hours is a note left open, and neither gets a number.
 *
 * This lived inline in `check-in-sheet.tsx`, which printed the same 10–360
 * rule. It moved here when `sessionLoad` needed the identical span — two
 * copies of a sanity rule is one copy that drifts.
 */
export const MIN_SESSION_MINUTES = 10;
export const MAX_SESSION_MINUTES = 360;

export function sessionMinutes(
  createdAtIso: string | null | undefined,
  updatedAtIso: string | null | undefined,
): number | null {
  if (!createdAtIso || !updatedAtIso) return null;
  const start = Date.parse(createdAtIso);
  const end = Date.parse(updatedAtIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const mins = Math.round((end - start) / 60_000);
  if (mins < MIN_SESSION_MINUTES || mins > MAX_SESSION_MINUTES) return null;
  return mins;
}

/**
 * Foster's session load in arbitrary units: the rating times the minutes.
 *
 * Null whenever either half is missing, and that is the whole honesty rule
 * here. A session nobody rated has no load — not a zero, not an estimate from
 * tonnage, not the athlete's average. `weeklyLoad` below counts what it could
 * compute and reports how many sessions it had to leave out, so a week that is
 * half-rated can never be printed as though it were the week.
 */
export function sessionLoad(rpe: number | null, minutes: number | null): number | null {
  if (rpe == null || minutes == null) return null;
  if (!Number.isFinite(rpe) || !Number.isFinite(minutes)) return null;
  if (rpe <= 0 || minutes <= 0) return null;
  return Math.round(rpe * minutes);
}

export interface RatedSession {
  /** Local day the session belongs to, `YYYY-MM-DD`. */
  day: string;
  /** Foster CR-10 rating, or null when the athlete did not answer. */
  rpe: number | null;
  /** Minutes from `sessionMinutes`, or null when the span was implausible. */
  minutes: number | null;
}

export interface LoadWeek {
  /** First day of the bucket, inclusive. */
  start: string;
  /** Last day of the bucket, inclusive. */
  end: string;
  /** Summed AU over the sessions that could be computed. */
  load: number;
  /** How many sessions contributed. */
  counted: number;
  /** How many sessions in the bucket could NOT be computed — unrated, or with
   * a span too short or too long to be a session. Carried, never hidden. */
  skipped: number;
  /**
   * Distinct DAYS trained in the bucket, and how many of those days have every
   * one of their sessions rated.
   *
   * The completeness rule counts workout rows, because a row is what carries a
   * rating and a duration. The SENTENCE counts days, because that is what this
   * tab means by a session everywhere else — `progress-summary.ts` is explicit
   * that two entries written on one evening are one day of training and that a
   * chart saying two is flattering. Printing "1 of 13 sessions" beside a hero
   * reading "8 training days" is the same screen using one word for two things.
   */
  days: number;
  ratedDays: number;
}

export function weeklyLoad(sessions: readonly RatedSession[], start = '', end = ''): LoadWeek {
  let load = 0;
  let counted = 0;
  let skipped = 0;
  /** day → is every session of that day computable so far */
  const byDay = new Map<string, boolean>();
  for (const s of sessions) {
    const one = sessionLoad(s.rpe, s.minutes);
    const whole = byDay.get(s.day) ?? true;
    byDay.set(s.day, whole && one != null);
    if (one == null) {
      skipped += 1;
      continue;
    }
    load += one;
    counted += 1;
  }
  let ratedDays = 0;
  for (const whole of byDay.values()) if (whole) ratedDays += 1;
  return { start, end, load, counted, skipped, days: byDay.size, ratedDays };
}

/**
 * IS THIS WEEK'S TOTAL A TOTAL? — the honesty rule the whole surface turns on.
 *
 * A week is complete when it has training in it and **every** session of it
 * carries a load. Not "enough of them": a sum over four of six sessions is
 * smaller than the week was, and a smaller number is not a partial truth on a
 * chart — it is a lighter week that never happened. Volume never had this
 * problem, because volume is computed from the record; this is computed from
 * something the athlete has to choose to give.
 *
 * The consequence is deliberate and is stated on screen: a week with one
 * unrated session shows no total, and what it shows instead is how many are
 * missing. That is a surface somebody can complete, which a silently wrong
 * number is not.
 */
export function weekIsComplete(week: LoadWeek): boolean {
  return week.counted > 0 && week.skipped === 0;
}

/**
 * Bucket sessions into rolling seven-day weeks ending on `endDay`, oldest
 * first — the SAME buckets `progress-summary.ts` builds for volume, sessions
 * and lifts, so the load reads against them rather than against a calendar of
 * its own. (Its docstring has the argument: a calendar week makes the newest
 * bucket a stub and reports a collapse that is really a Wednesday.)
 *
 * `dates.ts` is pure and zero-import, so importing it keeps this module
 * runnable under plain `node --test` — the same allowance `progress-summary.ts`
 * and `brief-prose.ts` take, for the same reason.
 */
export function buildLoadWeeks(
  sessions: readonly RatedSession[],
  endDay: string,
  weeks: number,
): LoadWeek[] {
  const out: LoadWeek[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = shiftDayKey(endDay, -(i * LOAD_WEEK_DAYS));
    const start = shiftDayKey(end, -(LOAD_WEEK_DAYS - 1));
    out.push(weeklyLoad(
      sessions.filter((s) => s.day >= start && s.day <= end),
      start,
      end,
    ));
  }
  return out;
}

export const LOAD_WEEK_DAYS = 7;

/**
 * How many earlier COMPLETE weeks the average has to stand on before it is
 * worth comparing against. Two, for the reason `MIN_SESSIONS_FOR_CARD` is
 * three: an average of one week is that week, and "35% above your average"
 * against a single week is a comparison of a thing with itself.
 */
export const MIN_WEEKS_FOR_AVERAGE = 2;

export interface LoadTrend {
  /** The most recent bucket, complete or not. Null with no buckets at all. */
  current: LoadWeek | null;
  /** Mean load of the complete weeks BEFORE the current one, rounded. Null
   * under `MIN_WEEKS_FOR_AVERAGE`. */
  average: number | null;
  /** How many complete weeks that average stands on. */
  averageWeeks: number;
  /**
   * The current week against that average, in whole percent, or null.
   *
   * It speaks ONLY when the current week is complete AND the average exists.
   * Comparing a half-rated week to an average of whole ones is comparing two
   * different quantities and calling the difference a trend — the same refusal
   * `buildPeriod` makes when the record does not reach into the earlier window.
   *
   * Whole points, like `changePercent`: a load figure carries digits it did not
   * earn, and a decimal invites trust that one extra set would move.
   */
  percent: number | null;
}

export function loadTrend(weeks: readonly LoadWeek[]): LoadTrend {
  const current = weeks.length > 0 ? weeks[weeks.length - 1]! : null;
  const earlier = weeks.slice(0, -1).filter(weekIsComplete);

  if (earlier.length < MIN_WEEKS_FOR_AVERAGE) {
    return { current, average: null, averageWeeks: earlier.length, percent: null };
  }

  const average = Math.round(earlier.reduce((sum, w) => sum + w.load, 0) / earlier.length);
  const percent =
    current && weekIsComplete(current) && average > 0
      ? Math.round(((current.load - average) / average) * 100)
      : null;
  return { current, average, averageWeeks: earlier.length, percent };
}
