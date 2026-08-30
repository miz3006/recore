/**
 * SCHEDULING BY LIFT — the flat lifter's next session (owner, 29 August 2026).
 *
 * ## The promise this keeps
 *
 * Onboarding screen 14 offers "I don't follow a split", and the banner under it
 * says in as many words: *"If you don't follow one, it schedules by lift
 * instead."* `flow.ts` marks that option `drivesBranch` — the one answer on
 * that screen that changes app behaviour rather than personalising copy.
 *
 * **Until now the app did not do it.** `pickNextSession` returns null when the
 * record clusters into one group — *"one repeating session — nothing to
 * rotate"* — and `pickBaseWorkout` then falls back to the most recent workout.
 * So a lifter who told us they follow no split was handed *repeat your last
 * session*, session after session, which is a split of one day. The screen that
 * showed it (`Next`) was correct about everything except the thing it had been
 * promised.
 *
 * ## What "by lift" means here
 *
 * The unit of scheduling is the LIFT, and the question asked of each one is
 * *how overdue is it, by its own cadence?*
 *
 *     score = days since it was last done ÷ how often it is usually done
 *
 * A press trained every 7 days and last done 10 days ago scores 1.43. A
 * deadlift trained every 21 days and last done 14 days ago scores 0.67. The
 * press is the one that is waiting, even though the deadlift's gap is longer in
 * raw days — which is exactly the judgement "least recently trained" gets
 * wrong, and the reason this is a ratio rather than a sort by date.
 *
 * The cadence is the MEDIAN gap between that lift's own sessions, so one
 * holiday does not redefine how often somebody squats. Under two sessions there
 * is no gap to take a median of, and the lift falls back to a default rather
 * than being dropped: a movement done once is still a movement, and §7.3's rule
 * is not to extrapolate a NUMBER from nothing — a place in a ranking is not a
 * prescription.
 *
 * ## Two things it deliberately does not do
 *
 * **It does not gate on "due".** Every lift is ranked; the top N are taken.
 * A cutoff — "score ≥ 1 or it does not appear" — would be a training opinion
 * about how often somebody ought to train a movement, and §20 is explicit that
 * the app never tells anyone what to train. Ranking is arithmetic. The row's
 * reason line prints the date it is ranked on, so the athlete can disagree with
 * the order in front of them.
 *
 * **It does not invent a session length.** How many movements go in the next
 * session is the median of how many the athlete actually puts in theirs.
 *
 * Pure, node-testable, no I/O.
 */

/**
 * The cadence assumed for a lift with fewer than two sessions on record.
 *
 * A week: the commonest training cycle and the one the app's own weekly views
 * are built on. It is a placement in a list and never reaches the screen as a
 * number, which is the only reason a default is allowed here at all.
 */
export const DEFAULT_GAP_DAYS = 7;

/** Sessions are the unit; below this many movements a session is not a sample
 * of how somebody trains, it is a session they cut short. */
const MIN_SESSION_SIZE = 1;

/** Nobody's next session is fifteen movements long, whatever one outlier said. */
const MAX_SESSION_SIZE = 8;

export interface LiftCadence {
  /** Case-folded canonical — the identity the rest of the app keys on. */
  key: string;
  /** Days since this lift was last performed. */
  since: number;
  /** Median days between its sessions. Null under two sessions. */
  gap: number | null;
}

/** The middle value, or the mean of the middle two. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Days between consecutive sessions of one lift.
 *
 * `daysDescending` is the lift's own session days as day-counts backwards from
 * today, most recent (smallest) first — the shape the caller already has from
 * "days since". Same-day duplicates contribute no gap: two entries for one
 * movement in one workout is one session of it.
 */
export function gapsOf(daysDescending: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < daysDescending.length; i += 1) {
    const gap = daysDescending[i]! - daysDescending[i - 1]!;
    if (gap > 0) out.push(gap);
  }
  return out;
}

/**
 * How overdue a lift is, by its own cadence. Larger is more due.
 *
 * A non-positive or missing gap resolves to the default rather than to a
 * division by zero or a negative rank.
 */
export function overdueScore(cadence: LiftCadence): number {
  const gap = cadence.gap != null && cadence.gap > 0 ? cadence.gap : DEFAULT_GAP_DAYS;
  return cadence.since / gap;
}

/**
 * How many movements the athlete's next session should hold: the median of
 * their recent sessions, clamped.
 *
 * The median rather than the mean, for the same reason the cadence is: one
 * fourteen-movement marathon should not stretch every session after it.
 */
export function typicalSessionSize(sizes: readonly number[]): number {
  const usable = sizes.filter((n) => n >= MIN_SESSION_SIZE);
  const mid = median(usable);
  if (mid == null) return MIN_SESSION_SIZE;
  return Math.max(MIN_SESSION_SIZE, Math.min(MAX_SESSION_SIZE, Math.round(mid)));
}

/**
 * The lifts of the next session, most overdue first.
 *
 * Ties break on the raw days since — between two lifts equally overdue by their
 * own cadence, the one untouched for longer goes first — and then on the key,
 * so the same record always produces the same session. A ghost that reshuffles
 * itself between two identical reads is one nobody can trust.
 */
export function dueLifts(cadences: readonly LiftCadence[], limit: number): LiftCadence[] {
  if (limit <= 0) return [];
  return [...cadences]
    .sort((a, b) => {
      const d = overdueScore(b) - overdueScore(a);
      if (d !== 0) return d;
      if (b.since !== a.since) return b.since - a.since;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .slice(0, limit);
}
