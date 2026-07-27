// Relative + .ts extension: this file is BOTH bundled by Metro AND run under
// `node --test` (which can't resolve the `@/` alias) — same pattern as the
// other pure, tested modules (parse/receipt.ts → ./types.ts).
import {
  progressBodyweight,
  progressStrength,
  type Prescription,
  type PriorTop,
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
export interface PlanRow {
  /** Canonical (or typed) movement name. */
  name: string;
  /** The progressed prescription, e.g. "82.5 × 5·5·5", or null when there is no
   * history to progress from — never extrapolate from nothing (CLAUDE.md §7.3). */
  value: string | null;
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

export function buildPlanRow(input: PlanRowInput, smallestPlateKg: number | null): PlanRow {
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
    });
    return { name, value: strengthValue(p) };
  }
  if (hasReps) {
    const p = progressBodyweight(todaySets);
    return { name, value: `${p.sets}×${p.reps}` };
  }
  // Cardio / carries / holds: repeat the last prescription as-is.
  if (input.lastDistanceM != null) return { name, value: distanceValue(input.lastDistanceM) };
  if (input.lastDurationS != null) return { name, value: `${input.lastDurationS}s` };
  return { name, value: null };
}
