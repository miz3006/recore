// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — same pattern as the
// other pure, tested modules (parse/receipt.ts → ./types.ts).
import {
  progressBodyweight,
  progressStrength,
  type Prescription,
  type PriorTop,
  type Reason,
  type WorkingSet,
} from '../predict/engine.ts';

/**
 * PURE plan-row builder — ZERO I/O, runs under `node --test`. CLAUDE.md §7's
 * iron law holds: CODE computes the number, sourced from real history; the AI
 * never picks a load. This mirrors the per-item branch of predict/data.ts, but
 * sourced from a plan MOVEMENT instead of a logged workout item — so the
 * plan-in-view strip speaks the exact same numbers the predictor would, and
 * the strip stays read-only (never writes, never counts).
 */
/**
 * WHICH LEVER MOVED — the double-progression decision, as a word.
 *
 * Every review of this category says the same thing about what a lifter needs
 * at the rack, and it is not a number: *"You don't know whether to add weight
 * or reps this week."* The test an app passes is that **you never stand at the
 * bar wondering which one today is.**
 *
 * The engine has always known the answer — it is `Reason.code` — and the app
 * has always thrown it away, printing `last 3×5 120 → 3×12 120 kg` and leaving
 * the reader to diff two strings to work out what changed. This carries the
 * decision out intact.
 *
 * It is a PROJECTION of a reason already computed. No load, rep count or
 * branch of `progressStrength` is touched by anything in this file.
 */
export type Move =
  | { kind: 'weight'; deltaKg: number }
  | { kind: 'rep' }
  | { kind: 'hold' }
  | { kind: 'backoff'; toKg: number };

/** The engine's own decision, read off the reason it already returned. */
export function moveFor(reason: Reason): Move | null {
  switch (reason.code) {
    case 'top_of_range':
    case 'rir_surplus':
      return { kind: 'weight', deltaKg: reason.increment };
    case 'add_rep':
      return { kind: 'rep' };
    case 'hold':
      return { kind: 'hold' };
    case 'deload':
      return { kind: 'backoff', toKg: reason.to };
    default:
      return null;
  }
}

export interface PlanRow {
  /** Canonical (or typed) movement name. */
  name: string;
  /** Which lever the engine moved. Null when there was no decision to make
   * (a first-ever session, a cardio line). See `Move`. */
  move?: Move | null;
  /** The progressed prescription, e.g. "82.5 × 5·5·5", or null when there is no
   * history to progress from — never extrapolate from nothing (CLAUDE.md §7.3). */
  value: string | null;
  /** The engine's own reason, as a short lowercase fragment — "you filled every
   * set of 5 at 80". Null when there is nothing worth saying. Read by the Next
   * briefing; the strip on Today ignores it and stays a bare reference. */
  why?: string | null;
  /** The prescribed load as a NUMBER, for callers that compare rather than
   * display (Next's heaviest-ever check). Present only on the strength path —
   * parsing it back out of `value` would re-introduce the display-collapse
   * class of bug (§7.7). */
  weightKg?: number | null;
}

/**
 * The engine's reason as ONE short fragment, for a row in the Next briefing.
 *
 * Pure, and deliberately a FRAGMENT rather than a sentence: it sits under a
 * prescription that already carries the numbers, so it only has to supply the
 * because. `predict/data.ts` has a sibling of this (`sentenceFor`) that writes
 * the one full sentence for the ghost — same facts, different length, and both
 * are templates over `Reason`, never generated text.
 *
 * `hold` and `repeat` return null. §8.3's rule holds here: no reason, no line.
 * Saying "same weight again" over and over is how an app teaches people to stop
 * reading it.
 */
export function whyFor(reason: Reason): string | null {
  switch (reason.code) {
    case 'top_of_range':
      return `you filled every set of ${reason.top} at ${fmt(reason.weight)}`;
    case 'rir_surplus':
      return `${fmt(reason.minRir)} left in reserve at ${fmt(reason.weight)}`;
    case 'deload':
      return `two sessions stuck at ${fmt(reason.from)}`;
    case 'add_rep':
      return reason.minRir != null && reason.weight > 0
        ? `nothing much left at ${fmt(reason.weight)} last time`
        : null;
    case 'hold':
      return `short of ${reason.bottom} reps last time`;
    default:
      return null;
  }
}

export interface PlanRowInput {
  name: string;
  modality: string;
  /** The most recent session's working sets for this movement (null / [] when
   * the movement has never been logged). */
  todaySets: WorkingSet[] | null;
  priorTops: PriorTop[];
  incrementKg: number;
  lastDistanceM?: number | null;
  lastDurationS?: number | null;
}

/** sets=3, reps=5 → "5·5·5" — the app's per-set voice. Pure (no gutter import,
 * so this file stays testable outside React Native). */
export function repScheme(sets: number, reps: number | string): string {
  const n = Math.max(1, Math.min(20, Math.round(sets)));
  return Array.from({ length: n }, () => String(reps)).join('·');
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function distanceValue(m: number): string {
  return m >= 1000 ? `${m / 1000}k` : `${m}m`;
}

function strengthValue(p: Prescription): string {
  const scheme = p.reps != null ? repScheme(p.sets, p.reps) : `${p.sets} sets`;
  return p.weightKg != null ? `${fmt(p.weightKg)} × ${scheme}` : scheme;
}

export function buildPlanRow(
  input: PlanRowInput,
  smallestPlateKg: number | null,
  /** The focus fallback (PLAN E1). Passed in for the same reason the plate is:
   * this module is pure and tested outside React Native, so it reads no prefs.
   * The strip and the ghost must be given the SAME value or the two surfaces
   * would prescribe different reps for one exercise. */
  defaultRepRange?: [number, number],
): PlanRow {
  const { name, modality, todaySets, priorTops, incrementKg } = input;
  if (!todaySets || todaySets.length === 0) return { name, value: null };

  const hasLoad = todaySets.some((s) => s.weight_kg != null);
  const hasReps = todaySets.some((s) => s.reps != null);

  if (modality === 'strength' && hasLoad) {
    const p = progressStrength({
      todaySets,
      priorTops,
      incrementKg,
      smallestPlateKg: smallestPlateKg ?? undefined,
      defaultRepRange,
    });
    return {
      name,
      value: strengthValue(p),
      why: whyFor(p.reason),
      move: moveFor(p.reason),
      weightKg: p.weightKg ?? null,
    };
  }
  if (hasReps) {
    const p = progressBodyweight(todaySets);
    return { name, value: `${p.sets}×${p.reps}`, why: whyFor(p.reason), move: moveFor(p.reason) };
  }
  // Cardio / carries / holds: repeat the last prescription as-is.
  if (input.lastDistanceM != null) return { name, value: distanceValue(input.lastDistanceM) };
  if (input.lastDurationS != null) return { name, value: `${input.lastDurationS}s` };
  return { name, value: null };
}
