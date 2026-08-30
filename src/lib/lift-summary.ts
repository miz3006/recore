import { daysBetween, shortDayLabel, type DayKey } from './db/dates.ts';
import { gapsOf, median } from './predict/flat.ts';

/**
 * ONE LIFT, SUMMED UP — what the lift sheet opens with (owner, 29 August 2026).
 *
 * The sheet used to open on `Sessions · Best e1RM · Volume`: three database
 * aggregates, in a row, answering a question nobody arrived with. Somebody
 * taps "bench press · up 2.5 from Wed 26 Aug · 85 kg" on Next, and what they
 * want to know is **how this lift has actually been going** — how often they
 * do it, whether it is moving, and what the heaviest thing in the record is.
 *
 * So this module reads the lift's own sessions and states the four facts that
 * answer that, in counted language:
 *
 *     Trained 3 times over 2 weeks, about every 5 days.
 *     Heaviest 82.5 kg × 5 on Wed 26 Aug. Up 5 kg since Sat 15 Aug.
 *
 * ## Every clause is a count, and a missing one is silence
 *
 * There is no adjective here, no "great consistency", no score. A lift with
 * one session has no cadence and no trend, so it says neither — it says the
 * one thing it knows. §8.3's rule holds all the way down: no fact, no line.
 *
 * ## Cadence is the median gap, and it is shared with the scheduler
 *
 * `gapsOf`/`median` are `predict/flat.ts`'s, the same pair that ranks a flat
 * lifter's next session by how overdue each lift is. If this sheet said a lift
 * runs "about every 5 days" while the scheduler ranked it on a different
 * number, the two would be describing different lifts.
 *
 * Pure, node-testable, no I/O.
 */

/** One session of one lift, oldest → newest, as `db/exercise-stats.ts` reads it. */
export interface LiftPoint {
  day: DayKey;
  topWeight: number | null;
  topReps: number | null;
}

export interface LiftSummary {
  sessions: number;
  /** First and last day on record for this lift. */
  firstDay: DayKey | null;
  lastDay: DayKey | null;
  /** Median days between sessions. Null under two sessions. */
  cadenceDays: number | null;
  /** The heaviest counted working set, and when. */
  heaviest: { kg: number; reps: number | null; day: DayKey } | null;
  /** Latest top weight minus the earliest. Null under two weighed sessions. */
  deltaKg: number | null;
  /** The rep count this lift is usually worked at — the commonest top-set
   * reps, not an average, because 5·5·8 averages to a number nobody did. */
  workingReps: number | null;
}

export function summarise(points: readonly LiftPoint[]): LiftSummary {
  const empty: LiftSummary = {
    sessions: 0,
    firstDay: null,
    lastDay: null,
    cadenceDays: null,
    heaviest: null,
    deltaKg: null,
    workingReps: null,
  };
  if (points.length === 0) return empty;

  const ordered = [...points].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;

  // `gapsOf` reads day-counts NEWEST first; these are oldest first, so the
  // ages run the other way and the gaps come out the same.
  const ages = [...ordered].reverse().map((p) => daysBetween(p.day, last.day));
  const cadence = median(gapsOf(ages));

  let heaviest: LiftSummary['heaviest'] = null;
  for (const p of ordered) {
    if (p.topWeight == null || p.topWeight <= 0) continue;
    // Strictly greater keeps the EARLIEST session that reached the weight —
    // the day it was first done is the day it was earned.
    if (!heaviest || p.topWeight > heaviest.kg) {
      heaviest = { kg: p.topWeight, reps: p.topReps, day: p.day };
    }
  }

  const weighed = ordered.filter((p) => p.topWeight != null && p.topWeight > 0);
  const delta =
    weighed.length > 1
      ? Math.round((weighed[weighed.length - 1]!.topWeight! - weighed[0]!.topWeight!) * 100) / 100
      : null;

  const repCounts = new Map<number, number>();
  for (const p of ordered) {
    if (p.topReps == null || p.topReps <= 0) continue;
    repCounts.set(p.topReps, (repCounts.get(p.topReps) ?? 0) + 1);
  }
  let workingReps: number | null = null;
  let best = 0;
  for (const [reps, n] of [...repCounts.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > best) {
      best = n;
      workingReps = reps;
    }
  }

  return {
    sessions: ordered.length,
    firstDay: first.day,
    lastDay: last.day,
    cadenceDays: cadence,
    heaviest,
    deltaKg: delta,
    workingReps,
  };
}

/** "3 times over 2 weeks, about every 5 days" — how much record there is. */
export function cadenceLine(s: LiftSummary, fmt: (n: number) => string): string | null {
  if (s.sessions === 0) return null;
  const times = s.sessions === 1 ? 'Trained once' : `Trained ${s.sessions} times`;

  const span =
    s.firstDay && s.lastDay ? daysBetween(s.firstDay, s.lastDay) : 0;
  const over =
    span >= 14
      ? ` over ${Math.round(span / 7)} weeks`
      : span > 0
        ? ` over ${span} days`
        : '';

  // Under two sessions there is no gap to take a median of, and inventing a
  // cadence from one point is exactly what §7.3 forbids.
  const every = s.cadenceDays != null ? `, about every ${fmt(s.cadenceDays)} days` : '';
  return `${times}${over}${every}.`;
}

/** "Heaviest 82.5 kg × 5 on Wed 26 Aug." — the strongest thing in the record. */
export function heaviestLine(s: LiftSummary, fmt: (n: number) => string): string | null {
  if (!s.heaviest) return null;
  const reps = s.heaviest.reps != null ? ` × ${s.heaviest.reps}` : '';
  return `Heaviest ${fmt(s.heaviest.kg)} kg${reps} on ${shortDayLabel(s.heaviest.day)}.`;
}

/**
 * "Up 5 kg since Sat 15 Aug." — or that it has not moved.
 *
 * A lift that has held its weight is not failing, and the line does not imply
 * it is: it says what happened and stops. Down is stated as plainly as up —
 * a deload is a decision, not a loss (`describeDelta`'s rule, kept here).
 */
export function trendLine(s: LiftSummary, fmt: (n: number) => string): string | null {
  if (s.deltaKg == null || !s.firstDay) return null;
  const since = ` since ${shortDayLabel(s.firstDay)}`;
  if (s.deltaKg === 0) return `Same top weight${since}.`;
  const word = s.deltaKg > 0 ? 'Up' : 'Down';
  return `${word} ${fmt(Math.abs(s.deltaKg))} kg${since}.`;
}
