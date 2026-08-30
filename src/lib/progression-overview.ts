import { stalledWeight } from './plateau.ts';
import { clusterSessions, type SessionExercises } from './predict/split.ts';
import type { LiftSession } from './progression.ts';

/**
 * The Progression tab's FIRST level — "what is moving?" (28 August 2026).
 *
 * The rebuilt tab is two screens. This module feeds the root: every lift in the
 * window as a scannable row, and the lifts grouped by **what the person trains
 * together**. Level two (`app/lift/[key].tsx`) is the metric-card stack for one
 * lift, and it needs none of this.
 *
 * ## The groups are the user's own split, not an anatomy chart
 *
 * There is no muscle or body-part column anywhere in this schema, and adding one
 * would mean shipping a catalogue of exercise → muscle that our own parser
 * immediately outgrows: it takes free text, so a lift someone named themselves
 * would land in "Other" on the one screen that is supposed to hold their record.
 *
 * `predict/split.ts` already knows something better and truer. It clusters
 * sessions by which exercises appear together (Jaccard ≥ 0.5) in order to
 * predict the next one, and that clustering IS the grouping: somebody who
 * benches, presses and dips on the same day has a push day whether or not
 * anyone calls it that. Nothing is asked and nothing is invented — CLAUDE.md
 * §2.2, personalise only from chosen information.
 *
 * A group is **named after the lift performed most often inside it**, in the
 * person's own words, so the label is a fact about their record rather than a
 * category we picked. Two groups that would take the same name are
 * disambiguated by their second lift instead of by a number.
 *
 * **One cluster means no groups.** Somebody training the same full-body session
 * every time gets a single cluster, and a strip with one chip in it is
 * furniture: `groups` comes back empty and the strip does not render.
 *
 * ## What arrived from Next on 29 August 2026
 *
 * Next's `Signals` block — "your other lifts", the ones the coming session does
 * not name — belonged here: those are lifts, across lifts, which is this
 * screen's question and not that one's. It did not arrive as a block, because
 * a block would have duplicated rows already in this list. It arrived as two
 * facts folded into the rows that were showing those lifts anyway:
 *
 *  - **`stalledAt`** — the plateau. Genuinely new: this list showed "12
 *    sessions · last Tue" for a lift that had not moved in three, which is the
 *    one thing about it worth knowing. The rule is `lib/plateau.ts`, shared
 *    with the brief so the two tabs cannot disagree.
 *  - **`deltaSuspect`** — the trust guard that came with the block it used to
 *    protect. Next refused to print a delta larger than a quarter of the
 *    lift's current e1RM ("+64 kg" over eight weeks is arithmetic, not a
 *    claim), and this row prints the same class of number. The guard follows
 *    the number rather than being left behind with the retired component.
 *
 * The MOVERS half of `Signals` did not move: it was three lifts with a delta
 * and a sparkline, and this list already gives every lift a delta and a
 * sparkline over a named window. Two answers to one question is what the
 * one-exercise-one-home rule exists to prevent.
 *
 * Pure, node-testable, no I/O.
 */

/**
 * A trend larger than this share of a lift's current e1RM is not believed
 * (owner, 12 Aug 2026; moved here from `next/sections.ts` on 29 Aug with the
 * content it guards).
 *
 * The direction is still true — the lift did climb — so the row still says so.
 * The FIGURE is withheld. Withholding a number we cannot stand behind is the
 * honest half of showing the ones we can (§7.4: predict conservatively or not
 * at all).
 */
export const DELTA_SUSPECT_RATIO = 0.25;

export type Direction = 'up' | 'down' | 'flat' | 'none';

export interface LiftRow {
  key: string;
  canonical: string;
  lastDay: string;
  /** Sessions inside the window. */
  sessions: number;
  /** Latest estimated 1RM — the reading the row shows. Null when no session in
   * the window carried an honest estimate (bodyweight work, high-rep only). */
  latest: number | null;
  first: number | null;
  /** latest − first. Null with fewer than two readings: one is not a move. */
  delta: number | null;
  direction: Direction;
  /** True when `delta` is too large to be believed against `latest`. The row
   * states the direction in words and prints no figure. */
  deltaSuspect: boolean;
  /**
   * The weight this lift is stuck at, or null — `lib/plateau.ts`.
   *
   * Read off the lift's WHOLE history, never the window: a lift whose
   * third-newest session predates this screen's eight weeks is on the same
   * plateau, and a display window must not change what is true about a lift.
   */
  stalledAt: number | null;
  spark: number[];
  groupId: number | null;
}

export interface LiftGroup {
  id: number;
  name: string;
  liftKeys: string[];
  /** Training days in the window that belong to this group. */
  sessions: number;
}

export interface OverviewView {
  /** Most recently trained first — recency is what a person reaches for. */
  lifts: LiftRow[];
  /** Largest first. Empty when the record does not divide into more than one. */
  groups: LiftGroup[];
  /** Distinct training days in the window, across every exercise. */
  sessions: number;
}

export function directionOf(delta: number | null): Direction {
  if (delta == null) return 'none';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export function buildOverview(rows: LiftSession[], fromDay: string): OverviewView {
  const inWindow = rows.filter((r) => r.day >= fromDay);

  // --- the lifts ------------------------------------------------------------
  const byLift = new Map<string, LiftSession[]>();
  for (const r of inWindow) {
    const found = byLift.get(r.key);
    if (found) found.push(r);
    else byLift.set(r.key, [r]);
  }

  // The plateau reads the UNWINDOWED history — see `LiftRow.stalledAt`.
  const allByLift = new Map<string, LiftSession[]>();
  for (const r of rows) {
    const found = allByLift.get(r.key);
    if (found) found.push(r);
    else allByLift.set(r.key, [r]);
  }

  // --- the groups -----------------------------------------------------------
  // One entry per training SESSION, chronological, carrying the lifts in it —
  // exactly the shape `clusterSessions` reads.
  const byWorkout = new Map<string, { day: string; keys: Set<string> }>();
  for (const r of inWindow) {
    const found = byWorkout.get(r.workoutId);
    if (found) found.keys.add(r.key);
    else byWorkout.set(r.workoutId, { day: r.day, keys: new Set([r.key]) });
  }
  const ordered = [...byWorkout.entries()].sort((a, b) =>
    a[1].day === b[1].day ? (a[0] < b[0] ? -1 : 1) : a[1].day < b[1].day ? -1 : 1,
  );
  const sessions: SessionExercises[] = ordered.map(([id, v]) => ({
    id,
    exerciseIds: [...v.keys],
  }));
  const labels = sessions.length > 0 ? clusterSessions(sessions) : [];
  const clusterCount = labels.length > 0 ? Math.max(...labels) + 1 : 0;

  // How often each lift appears in each cluster, and how big each cluster is.
  const liftCluster = new Map<string, Map<number, number>>();
  const clusterSize = new Map<number, number>();
  const clusterLiftCounts = new Map<number, Map<string, number>>();
  sessions.forEach((session, i) => {
    const c = labels[i]!;
    clusterSize.set(c, (clusterSize.get(c) ?? 0) + 1);
    let counts = clusterLiftCounts.get(c);
    if (!counts) {
      counts = new Map();
      clusterLiftCounts.set(c, counts);
    }
    for (const key of session.exerciseIds) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      let per = liftCluster.get(key);
      if (!per) {
        per = new Map();
        liftCluster.set(key, per);
      }
      per.set(c, (per.get(c) ?? 0) + 1);
    }
  });

  /** A lift belongs to the cluster it appears in most; ties go to the larger. */
  const groupOf = (key: string): number | null => {
    const per = liftCluster.get(key);
    if (!per) return null;
    let best: number | null = null;
    let bestCount = -1;
    for (const [c, n] of per) {
      const better = n > bestCount || (n === bestCount && (clusterSize.get(c) ?? 0) > (clusterSize.get(best!) ?? 0));
      if (better) {
        best = c;
        bestCount = n;
      }
    }
    return best;
  };

  const canonicalOf = (key: string) => byLift.get(key)?.[0]?.canonical ?? key;

  // A single cluster is not a grouping — see the header.
  const groups: LiftGroup[] =
    clusterCount > 1
      ? [...clusterLiftCounts.entries()]
          .map(([id, counts]) => {
            const ranked = [...counts.entries()].sort((a, b) =>
              b[1] === a[1] ? canonicalOf(a[0]).localeCompare(canonicalOf(b[0])) : b[1] - a[1],
            );
            return {
              id,
              name: canonicalOf(ranked[0]![0]),
              second: ranked[1] ? canonicalOf(ranked[1][0]) : null,
              liftKeys: [...counts.keys()].filter((k) => groupOf(k) === id),
              sessions: clusterSize.get(id) ?? 0,
            };
          })
          .filter((g) => g.liftKeys.length > 0)
          .sort((a, b) => (b.sessions === a.sessions ? a.name.localeCompare(b.name) : b.sessions - a.sessions))
          .map((g, _i, all) => {
            // Two groups topped by the same lift are told apart by their second
            // lift, never by a number — "Squat 2" names nothing.
            const clash = all.filter((o) => o.name === g.name).length > 1;
            const name = clash && g.second ? `${g.name} · ${g.second}` : g.name;
            return { id: g.id, name, liftKeys: g.liftKeys, sessions: g.sessions };
          })
      : [];

  const lifts: LiftRow[] = [...byLift.entries()]
    .map(([key, sess]) => {
      const sorted = [...sess].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
      // A null or non-positive estimate is a session that cannot speak to it —
      // skipped, never zero-filled (the same rule `progression-metrics` keeps).
      const spark = sorted
        .map((r) => r.e1rm)
        .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
      const latest = spark.length > 0 ? spark[spark.length - 1]! : null;
      const first = spark.length > 0 ? spark[0]! : null;
      const delta = spark.length > 1 && latest != null && first != null ? latest - first : null;
      const newestFirst = [...(allByLift.get(key) ?? [])]
        .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
        .map((r) => ({ weight: r.topWeight, reps: r.topReps }));
      return {
        key,
        canonical: sorted[0]!.canonical,
        lastDay: sorted[sorted.length - 1]!.day,
        sessions: sorted.length,
        latest,
        first,
        delta,
        direction: directionOf(delta),
        deltaSuspect:
          delta != null &&
          latest != null &&
          latest > 0 &&
          Math.abs(delta) > DELTA_SUSPECT_RATIO * latest,
        stalledAt: stalledWeight(newestFirst),
        spark,
        groupId: groupOf(key),
      };
    })
    .sort((a, b) =>
      a.lastDay === b.lastDay ? a.canonical.localeCompare(b.canonical) : b.lastDay < a.lastDay ? -1 : 1,
    );

  return {
    lifts,
    groups,
    sessions: new Set(inWindow.map((r) => r.day)).size,
  };
}
