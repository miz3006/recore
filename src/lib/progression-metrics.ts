import { fmtNumber } from './parse/summarize.ts';
import { describeDelta, type LiftSession } from './progression.ts';
import { displayLoad, type WeightUnit } from './units.ts';

/**
 * Progression metrics — the pure half of the rebuilt Progression tab
 * (28 August 2026).
 *
 * The tab used to be **one card per lift, one metric** (eight weeks of estimated
 * 1RM, four orderings). It is now **one lift, one card per metric**: an exercise
 * is chosen at the top and the stack below it answers "what is this lift doing?"
 * from several angles at once. This module turns the rows `db/progression.ts`
 * already aggregates into those series. Every import is a relative `.ts` path
 * into another pure module, so it is unit-tested under plain `node --test`
 * exactly like `progression.ts`.
 *
 * Three rules it exists to keep honest:
 *
 * 1. **A session that cannot speak to a metric is SKIPPED, never zero-filled.**
 *    A bodyweight set has no load; a set over the rep cap has no honest Epley
 *    estimate. Zero-filling would draw a crash that never happened.
 * 2. **The sub-label names the first day it actually PLOTTED**, not the window.
 *    `MAX_PLOTTED` caps a dense record so the dots stay separable, and a card
 *    that said "since 3 Jul" while drawing from 17 Jul would be lying by
 *    arithmetic nobody can see.
 * 3. **`topReps` is not a metric.** It is `MAX(reps)` across a session's counted
 *    sets, which is usually the LIGHTEST set's rep count. Charting it would draw
 *    a number whose meaning changes session to session, so this module offers no
 *    "Reps" series until the DB layer sums reps properly.
 */

/** Which chart a metric draws. Lines float among the gridlines; bars stand on
 * the bottom one. */
export type ChartKind = 'line' | 'bar';

export type MetricKey = 'e1rm' | 'topWeight';

export interface MetricPoint {
  day: string;
  value: number;
}

/**
 * How many sessions a card plots, newest kept.
 *
 * The window is eight weeks. Someone training a lift three times a week fills
 * that with twenty-four sessions, and twenty-four dots across a 310 pt card is
 * 13 pt apart — dots touching dots. Fourteen keeps them ~24 pt apart, which is
 * the spacing the reference screens draw at. The cap is not silent: `firstDay`
 * reports the oldest day actually drawn, and every label reads off that.
 */
export const MAX_PLOTTED = 14;

export interface MetricDef {
  key: MetricKey;
  /** The card's own title. */
  name: string;
  unit: string;
  kind: ChartKind;
  /** The metric's value for one session, or null when that session cannot
   * honestly speak to it. */
  valueOf: (s: LiftSession) => number | null;
}

/**
 * The metric set, in the order the cards stack.
 *
 * Both of these come straight out of `getLiftSessions` with no new SQL. Volume
 * (bar) and days-between-sessions (bar) are the next two and need none either;
 * reps-per-session and sets-per-session need one line each (`SUM(s.reps)`,
 * `COUNT(*)`) and are not offered until that lands.
 */
export const METRICS: readonly MetricDef[] = [
  {
    key: 'e1rm',
    name: 'Estimated 1RM',
    unit: 'kg',
    kind: 'line',
    // Epley over the best counted set at or under twelve reps, half-kilo grain.
    // Null on a session that only carried high-rep or bodyweight work.
    valueOf: (s) => s.e1rm,
  },
  {
    key: 'topWeight',
    name: 'Heaviest set',
    unit: 'kg',
    kind: 'line',
    valueOf: (s) => s.topWeight,
  },
] as const;

export interface MetricSeries {
  key: MetricKey;
  name: string;
  unit: string;
  kind: ChartKind;
  /** Oldest → newest, at most `MAX_PLOTTED`. Empty when nothing qualifies. */
  points: MetricPoint[];
  /** The newest plotted value — the card's big number. Null with no points. */
  latest: number | null;
  /** The oldest PLOTTED value, and its day. What the sub-label compares against. */
  first: number | null;
  firstDay: string | null;
  /** latest − first. Null with fewer than two points: one session is a reading,
   * not a move, and "up 0 kg" over a single point is a sentence about nothing. */
  delta: number | null;
  /**
   * The next PRESCRIBED value, drawn green and appended after the last recorded
   * point (CLAUDE.md §3 — planned green is a load not yet lifted).
   *
   * Always null today. `predict/data.ts` computes a `Prescription` per exercise
   * and then discards it into the ghost's TEXT, and the cached row stores only
   * that text, so there is no structured planned value to read yet. The field
   * and the green tail exist so that wiring it up is a one-line change rather
   * than a chart rewrite.
   */
  planned: number | null;
}

/** One lift's sessions inside the window, oldest first. */
export function sessionsFor(rows: LiftSession[], key: string, fromDay: string): LiftSession[] {
  return rows
    .filter((r) => r.key === key && r.day >= fromDay)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Turn one lift's sessions into one metric's series. `sessions` must already be
 * filtered to the lift and the window; `sessionsFor` does that. */
export function buildSeries(
  sessions: LiftSession[],
  def: MetricDef,
  planned: number | null = null,
): MetricSeries {
  const all: MetricPoint[] = [];
  for (const s of sessions) {
    const v = def.valueOf(s);
    // A null or a non-finite reading is a session that cannot speak to this
    // metric. Zero is only real for a metric where zero is a value, and neither
    // of the two below is one — a heaviest set of 0 kg is an absent reading.
    if (v == null || !Number.isFinite(v) || v <= 0) continue;
    all.push({ day: s.day, value: v });
  }
  const points = all.slice(-MAX_PLOTTED);
  const latest = points.length > 0 ? points[points.length - 1]!.value : null;
  const first = points.length > 0 ? points[0]!.value : null;
  return {
    key: def.key,
    name: def.name,
    unit: def.unit,
    kind: def.kind,
    points,
    latest,
    first,
    firstDay: points.length > 0 ? points[0]!.day : null,
    delta: points.length > 1 && latest != null && first != null ? latest - first : null,
    planned,
  };
}

/** Every metric for one lift, in card order. */
export function buildMetrics(sessions: LiftSession[]): MetricSeries[] {
  return METRICS.map((def) => buildSeries(sessions, def));
}

/**
 * The same series, read in the athlete's own unit (4 September 2026).
 *
 * A DISPLAY step at the very end, deliberately: everything above it is
 * kilograms, which is what the record stores and what every comparison in this
 * module is computed on, so the unit cannot leak backwards into arithmetic. It
 * converts the whole series at once — points, latest, first, delta, planned —
 * because a card that plotted kilograms under a pound reading would be one lift
 * drawn twice.
 *
 * **A metric that is not a load is returned untouched.** The guard is on
 * `series.unit`, not on the metric's name: `topWeight` and `e1rm` are both
 * kilograms and both convert, and the reps and days-between metrics that are
 * still to come must not be multiplied by 2.2 the day they land.
 *
 * `delta` converts as a load because it IS one — the difference of two loads —
 * and `describeSeries` then reads it off `unit`, so the sub-label follows with
 * nothing to change.
 */
export function seriesInUnit(series: MetricSeries, unit: WeightUnit): MetricSeries {
  if (unit === 'kg' || series.unit !== 'kg') return series;
  const load = (v: number | null) => (v == null ? null : displayLoad(v, unit));
  return {
    ...series,
    unit,
    points: series.points.map((p) => ({ ...p, value: displayLoad(p.value, unit) })),
    latest: load(series.latest),
    first: load(series.first),
    delta: load(series.delta),
    planned: load(series.planned),
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "13 Jul" from a `YYYY-MM-DD` day. A chart endpoint, never a full date. */
export function monthDay(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]}`;
}

/**
 * The card's one-line sub-label — the only sentence on the card, so it has to
 * carry the comparison the big number cannot.
 *
 * It defers to `describeDelta` for the phrasing, which is the single place the
 * app decides how a move is worded, and that is what keeps a **leading minus off
 * this screen**: a deload reads "down 5 kg", never "−5 kg", and a lift that held
 * its load reads "same as", never "0%".
 *
 * "No data yet" is the reference's own words, and it is the honest line for a
 * lift whose sessions cannot speak to this metric — a pull-up has no heaviest
 * set. §12.1: an empty state says what will fill it and never reports a lack.
 */
export function describeSeries(series: MetricSeries): string {
  if (series.points.length === 0) return 'No data yet';
  if (series.points.length === 1 || series.delta == null) {
    return `One session · ${monthDay(series.points[0]!.day)}`;
  }
  const since = monthDay(series.firstDay!);
  const moved = describeDelta(series.delta, series.unit, since, fmtNumber);
  return series.delta === 0 ? moved : `${moved} since ${since}`;
}
