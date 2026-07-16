/**
 * Prediction engine — double progression with RIR (CLAUDE.md §7).
 *
 * PURE functions, zero imports, zero I/O: CODE computes the numbers, the AI
 * only ever explains them. The data layer (./data.ts) assembles history from
 * SQLite and turns prescriptions into ghost text; this module is the math and
 * nothing else, so it runs under plain `node --test`.
 *
 * Algorithm:
 *   1. Hit the TOP of the rep range on ALL working sets → add weight, drop
 *      reps to the bottom of the range.
 *   2. RIR ≥ 2 extracted from the text → too easy: add weight now.
 *   3. RIR 0–1 and reps in range → keep weight, chase one more rep.
 *   4. Didn't reach the bottom of the range → keep weight (fatigued).
 *   5. No progress two sessions in a row → deload −10%.
 * The rep range is inferred from what the athlete actually does (top = max
 * reps today, bottom = top − 2), falling back to the classic 6–8.
 */
export interface WorkingSet {
  reps: number | null;
  weight_kg: number | null;
  rir: number | null;
}

/** Top set of one earlier session, most recent first. */
export interface PriorTop {
  weight: number | null;
  reps: number | null;
}

export interface StrengthHistory {
  /** Today's working sets (warm-ups and drops already excluded). */
  todaySets: WorkingSet[];
  /** Up to two previous sessions of this exercise, most recent first. */
  priorTops: PriorTop[];
  /** +5 lower compound, +2.5 upper compound, +1.25 isolation. */
  incrementKg: number;
  /** Smallest plate in the gym — one per side, so the barbell step is 2×. */
  smallestPlateKg?: number;
}

export type Reason =
  | { code: 'repeat' }
  | { code: 'hold'; weight: number; bottom: number }
  | { code: 'add_rep'; weight: number; minRir: number | null }
  | { code: 'top_of_range'; weight: number; increment: number; top: number; bottom: number }
  | { code: 'rir_surplus'; weight: number; increment: number; minRir: number }
  | { code: 'deload'; from: number; to: number };

export interface Prescription {
  sets: number;
  reps: number | null;
  weightKg: number | null;
  reason: Reason;
}

export const DEFAULT_SMALLEST_PLATE_KG = 1.25;

/** Round to loads a barbell can hold: plates load in pairs, so the step is 2×
 * the smallest plate. 83.75 never gets suggested with 1.25s in the gym. */
export function roundToPlate(kg: number, smallestPlateKg = DEFAULT_SMALLEST_PLATE_KG): number {
  const step = smallestPlateKg * 2;
  const rounded = Math.round(kg / step) * step;
  return Math.round(rounded * 100) / 100;
}

/** Rep range inferred from today's work; classic 6–8 when reps are unknown. */
export function repRange(todaySets: WorkingSet[]): [number, number] {
  const reps = todaySets.map((s) => s.reps).filter((r): r is number => r != null);
  if (reps.length === 0) return [6, 8];
  const top = Math.max(...reps);
  return [Math.max(1, top - 2), top];
}

/** Next session for a LOADED strength exercise. */
export function progressStrength(h: StrengthHistory): Prescription {
  const setsCount = h.todaySets.length;
  const plate = h.smallestPlateKg ?? DEFAULT_SMALLEST_PLATE_KG;

  const weights = h.todaySets.map((s) => s.weight_kg).filter((w): w is number => w != null);
  const topWeight = weights.length ? Math.max(...weights) : null;
  if (topWeight == null || setsCount === 0) {
    return { sets: Math.max(1, setsCount), reps: null, weightKg: null, reason: { code: 'repeat' } };
  }

  const [bottom, top] = repRange(h.todaySets);
  const reps = h.todaySets.map((s) => s.reps).filter((r): r is number => r != null);
  const maxReps = reps.length ? Math.max(...reps) : null;
  const rirs = h.todaySets.map((s) => s.rir).filter((r): r is number => r != null);
  const minRir = rirs.length ? Math.min(...rirs) : null;

  // 5. Two sessions stuck at this weight with no rep progress → deload −10%.
  const [p0, p1] = h.priorTops;
  if (
    p0?.weight === topWeight &&
    p1?.weight === topWeight &&
    maxReps != null &&
    p0.reps != null &&
    p1.reps != null &&
    maxReps <= p0.reps &&
    p0.reps <= p1.reps
  ) {
    const to = roundToPlate(topWeight * 0.9, plate);
    return { sets: setsCount, reps: bottom, weightKg: to, reason: { code: 'deload', from: topWeight, to } };
  }

  // 1. Every working set filled the top of the range → load up, reps to bottom.
  const allAtTop = reps.length === setsCount && reps.every((r) => r >= top) && setsCount > 0;
  if (allAtTop && maxReps != null) {
    const w = roundToPlate(topWeight + h.incrementKg, plate);
    return {
      sets: setsCount,
      reps: bottom,
      weightKg: w,
      reason: { code: 'top_of_range', weight: topWeight, increment: w - topWeight, top, bottom },
    };
  }

  // 2. The text said it was easy (RIR ≥ 2) → add weight now.
  if (minRir != null && minRir >= 2) {
    const w = roundToPlate(topWeight + h.incrementKg, plate);
    return {
      sets: setsCount,
      reps: maxReps ?? top,
      weightKg: w,
      reason: { code: 'rir_surplus', weight: topWeight, increment: w - topWeight, minRir },
    };
  }

  // 4. Below the bottom of the range → keep the weight, rebuild.
  if (maxReps != null && maxReps < bottom) {
    return { sets: setsCount, reps: bottom, weightKg: topWeight, reason: { code: 'hold', weight: topWeight, bottom } };
  }

  // 3. In range → same weight, chase the top of the range.
  return {
    sets: setsCount,
    reps: top,
    weightKg: topWeight,
    reason: { code: 'add_rep', weight: topWeight, minRir },
  };
}

/** Bodyweight work progresses reps first (CLAUDE.md §7). */
export function progressBodyweight(todaySets: WorkingSet[]): Prescription {
  const setsCount = todaySets.length;
  const reps = todaySets.map((s) => s.reps).filter((r): r is number => r != null);
  if (setsCount === 0 || reps.length === 0) {
    return { sets: Math.max(1, setsCount), reps: null, weightKg: null, reason: { code: 'repeat' } };
  }
  const top = Math.max(...reps);
  const allAtTop = reps.length === setsCount && reps.every((r) => r >= top);
  return {
    sets: setsCount,
    reps: allAtTop ? top + 1 : top,
    weightKg: null,
    reason: allAtTop ? { code: 'add_rep', weight: 0, minRir: null } : { code: 'repeat' },
  };
}
