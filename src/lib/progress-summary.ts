import { shiftDayKey } from './db/dates.ts';
import type { LiftSession } from './progression.ts';

/**
 * THE PROGRESS TAB'S TOP HALF — "am I training, and is it adding up?"
 * (9 September 2026).
 *
 * `progression-overview.ts` answers the tab's second question, ACROSS lifts:
 * which lift moved, which one stalled, which one was trained on Tuesday. It
 * cannot answer the first one, because the first one is not about a lift at
 * all — it is about the eight weeks themselves. A list of twelve rows never
 * says whether the month was heavier than the one before it, and that is the
 * question somebody opens this tab to ask before they go looking for a lift.
 *
 * So this module buckets the same record BY WEEK rather than by exercise, and
 * it is the only place that arithmetic happens. Pure, node-testable, no I/O —
 * the same contract every other `lib/` aggregate keeps.
 *
 * ## Three metrics, and every one of them is a count off the record
 *
 * `volume` is counted reps × weight, already summed per lift-session upstream
 * (`db/progression.ts` excludes warm-ups, drops and skipped sets). `sessions`
 * is DISTINCT TRAINING DAYS, not workouts — two entries written on one evening
 * are one day of training and a chart that says two is flattering. `lifts` is
 * distinct exercises, which is the only one of the three that cannot be summed
 * across weeks: somebody who benches every week trained one lift, not eight, so
 * the window total is computed over the window's own rows rather than added up
 * from the buckets.
 *
 * ## The weeks are counted BACK FROM TODAY, not off the calendar
 *
 * A calendar week would make the newest bucket a stub — on a Tuesday it would
 * hold two days of training against seven in every bucket behind it, and the
 * chart would report a collapse that is really a Wednesday. Each bucket is
 * therefore a rolling seven days ending on `endDay`, so all eight are the same
 * length and the last one is as complete as the rest.
 *
 * ## The comparison refuses to speak when the record cannot back it
 *
 * "Up 12% on the previous 8 weeks" is a claim about sixteen weeks of record.
 * Somebody who started three weeks ago has none of the first eight, and
 * dividing by their zero would print an infinity or — worse — a plausible
 * number derived from nothing. `before` is null unless the record itself
 * reaches into that earlier window, and the screen prints no comparison at all
 * when it is (CLAUDE.md §2 rule 2: never create history that was not lived).
 */

/** The three series the chart can plot. All recorded facts. */
export type PeriodMetric = 'volume' | 'sessions' | 'lifts';

/** How long a bucket is. Named once — the chart, the totals and the previous
 * window all measure in these. */
export const WEEK_DAYS = 7;

export interface WindowTotals {
  /** Counted reps × weight, in kilograms — storage's unit, never the display's. */
  volume: number;
  /** Distinct days trained. */
  sessions: number;
  /** Distinct exercises trained. */
  lifts: number;
}

export interface Week extends WindowTotals {
  /** First day of the bucket, inclusive. */
  start: string;
  /** Last day of the bucket, inclusive. */
  end: string;
}

export interface PeriodSummary {
  /** Oldest first, always exactly the number of weeks asked for — a week with
   * no training is a real zero and keeps its slot. */
  weeks: Week[];
  /** The whole window, computed over its own rows (see `lifts`). */
  now: WindowTotals;
  /** The equally long window before it, or null when the record does not reach
   * back into it. */
  before: WindowTotals | null;
  /** The window's own first and last day, inclusive. */
  from: string;
  to: string;
}

export function totalsOf(rows: LiftSession[], from: string, to: string): WindowTotals {
  const days = new Set<string>();
  const keys = new Set<string>();
  let volume = 0;
  for (const r of rows) {
    if (r.day < from || r.day > to) continue;
    days.add(r.day);
    keys.add(r.key);
    volume += r.volume;
  }
  return { volume, sessions: days.size, lifts: keys.size };
}

export function metricOf(t: WindowTotals, metric: PeriodMetric): number {
  return metric === 'volume' ? t.volume : metric === 'sessions' ? t.sessions : t.lifts;
}

/**
 * The move as a percentage, or null when there is nothing to be a share of.
 *
 * Rounded to whole points: a volume figure carries four significant digits it
 * did not earn, and "up 11.7%" invites a reader to trust a decimal that a
 * single extra set would move.
 */
export function changePercent(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

export function buildPeriod(rows: LiftSession[], endDay: string, weeks: number): PeriodSummary {
  const span = weeks * WEEK_DAYS;
  const from = shiftDayKey(endDay, -(span - 1));

  const buckets: Week[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = shiftDayKey(endDay, -(i * WEEK_DAYS));
    const start = shiftDayKey(end, -(WEEK_DAYS - 1));
    buckets.push({ start, end, ...totalsOf(rows, start, end) });
  }

  // The previous window, and the test that the record was actually being kept
  // during it: an athlete whose first session is inside THIS window has no
  // earlier eight weeks, and a zero there is an absence rather than a rest.
  const prevTo = shiftDayKey(from, -1);
  const prevFrom = shiftDayKey(prevTo, -(span - 1));
  const reachesBack = rows.some((r) => r.day <= prevTo);

  return {
    weeks: buckets,
    now: totalsOf(rows, from, endDay),
    before: reachesBack ? totalsOf(rows, prevFrom, prevTo) : null,
    from,
    to: endDay,
  };
}

/**
 * How the window's training days divide between the athlete's own groups.
 *
 * The groups come from `progression-overview.ts` — clusters of exercises
 * performed together, named after the lift done most often inside them — and
 * the share is of TRAINING DAYS rather than of volume. Volume looked like the
 * richer measure and is the wrong one here: a bodyweight day carries no
 * kilograms, so a calisthenics session would report as 0% of a person's
 * training. Days are days.
 */
export function splitShares(
  groups: { id: number; name: string; sessions: number }[],
): { id: number; name: string; sessions: number; share: number }[] {
  const total = groups.reduce((n, g) => n + g.sessions, 0);
  if (total <= 0) return [];
  return groups.map((g) => ({ ...g, share: g.sessions / total }));
}
