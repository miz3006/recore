/**
 * Progression — the pure half of the Progress tab (CLAUDE.md §5.1, "Am I
 * actually improving?").
 *
 * The screen shows one card per lift: the series over the chosen range, the
 * latest value, and how far it moved. All of that is arithmetic over rows the
 * DB layer already aggregated, so it lives here — zero imports, zero I/O,
 * unit-tested under plain `node --test`, exactly like `streak.ts`.
 *
 * Two rules this module exists to keep honest:
 *
 * 1. **A trend needs points.** Under `MIN_SESSIONS_FOR_CARD` sessions inside
 *    the range there is nothing to draw, so the lift gets no chart rather than a
 *    flat line pretending to be a plateau — it comes back as a `belowFloor`
 *    row instead, because a lift someone logged should never vanish off the
 *    screen that is supposed to hold their record.
 * 2. **A delta is a word, never a sign or a colour** (§5.1). `describeDelta`
 *    is the only place that phrasing is decided, so a leading minus can never
 *    reach the screen and scold someone for a deload.
 *
 * Days are plain `YYYY-MM-DD` strings — lexicographically sortable, which is
 * why every comparison here is a string compare and no Date is constructed
 * except for the one gap calculation that genuinely needs calendar maths.
 */

/** Which series the cards plot. All three are recorded facts, never estimates
 * of intent: `e1rm` is Epley over the best counted set, `weight` is the
 * heaviest counted set, `volume` is counted reps × weight. */
export type ProgressionMetric = 'e1rm' | 'weight' | 'volume';

/** One exercise's aggregates from one session — what `db/progression.ts` reads.
 * Warm-ups, drops and skipped sets are already excluded upstream (§1.1.5). */
export interface LiftSession {
  /** Case-folded canonical — the identity the rest of the app keys on. */
  key: string;
  canonical: string;
  /** The session behind this point, so a card can open its own evidence. */
  workoutId: string;
  day: string;
  topWeight: number | null;
  topReps: number | null;
  e1rm: number | null;
  volume: number;
}

export interface ProgressionPoint {
  day: string;
  value: number;
}

export interface LiftProgression {
  key: string;
  canonical: string;
  /** The workout behind the LATEST point — the set table an open card shows. */
  workoutId: string;
  lastDay: string;
  /** The oldest plotted day — what "since" means for this lift's own delta. */
  firstDay: string;
  /** Sessions inside the range (== points.length). */
  sessions: number;
  /** Oldest → newest. Never shorter than MIN_SESSIONS_FOR_CARD. */
  points: ProgressionPoint[];
  first: number;
  latest: number;
  /** latest − first, inside the range. */
  delta: number;
  /**
   * The same move as a share of where the lift started, so lifts of different
   * sizes can be ranked against each other: 5 kg on an overhead press is a
   * bigger move than 5 kg on a deadlift, and only the percentage says so.
   * Zero when the starting value is zero (nothing to be a share of).
   */
  percent: number;
  /** All-time best for this metric, from the WHOLE history, not just the range
   * — the dashed reference hairline. A PR set two years ago is still the bar. */
  best: number;
  /** The day that all-time best was set. */
  bestDay: string;
  /** The latest point is the all-time best. Drives the outlined PR label. */
  isBest: boolean;
  /** The all-time best was set INSIDE the range — a best that belongs to this
   * stretch of training, whether or not the latest session repeated it. */
  newBest: boolean;
}

/** A lift with a record too shallow to draw a trend from — listed, never
 * charted, so nothing a person logged silently disappears from the screen. */
export interface LiftBrief {
  key: string;
  canonical: string;
  workoutId: string;
  lastDay: string;
  sessions: number;
  latest: number;
}

export interface ProgressionView {
  /** Qualifying lifts, most recently trained first (decision 02: recency is
   * the truth, the same rule the Lifts tab follows). `sortLifts` re-orders. */
  lifts: LiftProgression[];
  /** Lifts inside the range that have points but fewer than the floor. */
  belowFloor: LiftBrief[];
  /** How many of them ended the range above where they started. */
  improved: number;
  /** Ended exactly where they started. */
  unchanged: number;
  /** Ended below where they started — counted, never coloured as failure. */
  declined: number;
  /** How many qualified for a card at all — the denominator of the verdict. */
  counted: number;
  /** Charted lifts whose all-time best was set inside the range. */
  newBests: number;
  /** Median percentage move across charted lifts — the middle lift's story,
   * which one freak session cannot drag the way a mean can. Null with none. */
  medianPercent: number | null;
  /** Distinct training days in the range, across every exercise. */
  sessions: number;
  /** Longest run of days between two consecutive training days, or null when
   * there are fewer than two. */
  longestGapDays: number | null;
}

/** How the list is ordered. `gain` is the owner's default (4 Aug 2026): the
 * lifts that moved most, first. */
export type LiftSort = 'gain' | 'recent' | 'name';

/** Below this many sessions inside the range there is no trend to draw. */
export const MIN_SESSIONS_FOR_CARD = 3;

/** The metric's value for one session, or null when that session cannot speak
 * to it (a bodyweight set has no weight; a session under the rep cap has no
 * honest e1RM). A null point is skipped, never zero-filled. */
export function metricValue(s: LiftSession, metric: ProgressionMetric): number | null {
  if (metric === 'e1rm') return s.e1rm;
  if (metric === 'weight') return s.topWeight;
  return s.volume > 0 ? s.volume : null;
}

/** Whole days from `a` to `b`, both `YYYY-MM-DD`. Calendar maths in UTC, which
 * is safe because both ends are already local day keys (§10.1). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const from = Date.UTC(ay ?? 0, (am ?? 1) - 1, ad ?? 1);
  const to = Date.UTC(by ?? 0, (bm ?? 1) - 1, bd ?? 1);
  return Math.round((to - from) / 86_400_000);
}

/**
 * How the record reads a change (§5.1): a muted word, never a bare `+`/`−` and
 * never a colour. `sinceLabel` names what "same" is being measured against, so
 * an unchanged lift says "same as May 26" rather than the graceless "no change".
 */
export function describeDelta(
  delta: number,
  unit: string,
  sinceLabel: string,
  format: (n: number) => string = String,
): string {
  if (delta === 0) return `same as ${sinceLabel}`;
  const size = format(Math.abs(delta));
  const amount = unit ? `${size} ${unit}` : size;
  return delta > 0 ? `up ${amount}` : `down ${amount}`;
}

/**
 * Build the screen's view model from every aggregated row the user has.
 *
 * `rows` is the WHOLE history (so an all-time best is a real all-time best);
 * `fromDay` cuts the plotted series. Rows may arrive in any order.
 */
export function buildProgression(
  rows: LiftSession[],
  metric: ProgressionMetric,
  fromDay: string,
): ProgressionView {
  const byLift = new Map<string, LiftSession[]>();
  for (const r of rows) {
    const list = byLift.get(r.key);
    if (list) list.push(r);
    else byLift.set(r.key, [r]);
  }

  const lifts: LiftProgression[] = [];
  const belowFloor: LiftBrief[] = [];

  for (const sessions of byLift.values()) {
    // Oldest → newest. A stable sort on the day key is enough; two sessions of
    // the same lift on one day are already merged by the GROUP BY upstream.
    const ordered = [...sessions].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

    // The all-time reference comes from the full history, before the range cut.
    let best = -Infinity;
    let bestDay = '';
    for (const s of ordered) {
      const v = metricValue(s, metric);
      if (v != null && v > best) {
        best = v;
        bestDay = s.day;
      }
    }
    if (best === -Infinity) continue; // this lift cannot speak to this metric

    const points: ProgressionPoint[] = [];
    let latestRow: LiftSession | null = null;
    for (const s of ordered) {
      if (s.day < fromDay) continue;
      const v = metricValue(s, metric);
      if (v == null) continue;
      points.push({ day: s.day, value: v });
      latestRow = s;
    }
    if (!latestRow) continue;
    if (points.length < MIN_SESSIONS_FOR_CARD) {
      // Too shallow to draw, still the person's record: it goes to the list
      // under the cards rather than vanishing off the screen.
      belowFloor.push({
        key: latestRow.key,
        canonical: latestRow.canonical,
        workoutId: latestRow.workoutId,
        lastDay: latestRow.day,
        sessions: points.length,
        latest: points[points.length - 1]!.value,
      });
      continue;
    }

    const first = points[0]!.value;
    const latest = points[points.length - 1]!.value;
    lifts.push({
      key: latestRow.key,
      canonical: latestRow.canonical,
      workoutId: latestRow.workoutId,
      lastDay: latestRow.day,
      firstDay: points[0]!.day,
      sessions: points.length,
      points,
      first,
      latest,
      delta: latest - first,
      percent: first > 0 ? ((latest - first) / first) * 100 : 0,
      best,
      bestDay,
      isBest: latest >= best,
      newBest: bestDay >= fromDay,
    });
  }

  // Decision 02 — most recently trained first. Ties break on the deeper record,
  // then on name, so the order is stable across renders.
  lifts.sort(
    (a, b) =>
      (a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0) ||
      b.sessions - a.sessions ||
      a.canonical.localeCompare(b.canonical),
  );

  belowFloor.sort(
    (a, b) =>
      (a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0) ||
      a.canonical.localeCompare(b.canonical),
  );

  const spread = trainingSpread(rows.filter((r) => r.day >= fromDay).map((r) => r.day));

  return {
    lifts,
    belowFloor,
    improved: lifts.filter((l) => l.delta > 0).length,
    unchanged: lifts.filter((l) => l.delta === 0).length,
    declined: lifts.filter((l) => l.delta < 0).length,
    counted: lifts.length,
    newBests: lifts.filter((l) => l.newBest).length,
    medianPercent: median(lifts.map((l) => l.percent)),
    sessions: spread.sessions,
    longestGapDays: spread.longestGapDays,
  };
}

/** The middle value of a set, or null when the set is empty. Even counts take
 * the mean of the two middles, the ordinary definition. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Re-order the charted lifts (owner, 4 Aug 2026 — "the ones I progressed most
 * on, first").
 *
 * `gain` ranks on the PERCENTAGE move, not the kilos: ranking on kilos would
 * put every heavy lift above every light one forever and call that progress.
 * A lift that fell is not pushed to the bottom as a punishment — it simply
 * ranks where its number puts it, and the screen never colours it as failure.
 * Ties break on the deeper record, then the name, so the order is stable across
 * renders and metric switches.
 */
export function sortLifts(lifts: LiftProgression[], sort: LiftSort): LiftProgression[] {
  const out = [...lifts];
  if (sort === 'name') {
    out.sort((a, b) => a.canonical.localeCompare(b.canonical));
    return out;
  }
  if (sort === 'recent') {
    out.sort(
      (a, b) =>
        (a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : 0) ||
        b.sessions - a.sessions ||
        a.canonical.localeCompare(b.canonical),
    );
    return out;
  }
  out.sort(
    (a, b) =>
      b.percent - a.percent ||
      b.sessions - a.sessions ||
      a.canonical.localeCompare(b.canonical),
  );
  return out;
}

/**
 * Distinct training days and the longest rest between two of them — the single
 * line that stands in for the week ledger (decision 04). Duplicates are
 * expected: one day carries a row per exercise.
 */
export function trainingSpread(days: string[]): {
  sessions: number;
  longestGapDays: number | null;
} {
  const unique = Array.from(new Set(days)).sort();
  if (unique.length < 2) return { sessions: unique.length, longestGapDays: null };
  let longest = 0;
  for (let i = 1; i < unique.length; i++) {
    const gap = daysBetween(unique[i - 1]!, unique[i]!);
    if (gap > longest) longest = gap;
  }
  return { sessions: unique.length, longestGapDays: longest };
}
