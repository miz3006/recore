// Relative + .ts extension: bundled by Metro AND run under `node --test`
// (which can't resolve the `@/` alias) — the same pattern as streak.ts.
import { LB_PER_KG } from './onboarding.ts';

/**
 * Load display units — PURE, no storage, no React.
 *
 * **Storage is kilograms, always.** The parser converts every "225", "185lb"
 * and "#" it reads into `weight_kg` (parse-workout/prompt.ts: "WEIGHTS →
 * weight_kg (always kilograms)"), so nothing downstream ever has to guess what
 * a stored number means. The unit preference is a DISPLAY concern and lives
 * here, at the edge, exactly like `formatBodyWeight` in onboarding.ts.
 *
 * The correction sheet is the first reading surface to honour it, and it has to
 * honour one more rule the read-only surfaces don't: **an untouched value must
 * come back byte-identical.** 102.1 kg shown as 225.1 lb and converted straight
 * back is 102.15 kg — a "correction" the athlete never made, written into the
 * record and pushed as training data. `sameDisplay` is the guard: the sheet
 * keeps the original kilograms and only converts back the fields whose TEXT the
 * user actually changed.
 */
export type WeightUnit = 'kg' | 'lb';

/**
 * The stepper's increment, in the user's own unit.
 *
 * 2.5 either way: a pair of 1.25 kg plates, or a pair of 1.25 lb plates. The
 * step is deliberately NOT derived from `pref_smallest_plate_kg` — that
 * preference exists so the engine can PRESCRIBE a rackable load, and a repair
 * control that could only reach plate-multiples would refuse to record a
 * machine stack the athlete actually used.
 */
export const WEIGHT_STEP = 2.5;
/** Reps and RIR move one at a time. */
export const REPS_STEP = 1;
export const RIR_STEP = 1;

/** Stored kilograms → the number shown in the user's unit. */
export function toDisplayWeight(kg: number, unit: WeightUnit): number {
  const v = unit === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(v * 100) / 100;
}

/** A shown number → stored kilograms. */
export function toKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

/**
 * Did this field survive the sheet untouched? Compared as TEXT, because that is
 * what the user did or did not edit — comparing the numbers would call
 * "100" and "100.00" different and re-write the record for a formatting change.
 */
export function sameDisplay(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

/** The stored kilograms as the string the field starts life with. */
export function displayWeightText(kg: number | null, unit: WeightUnit): string {
  if (kg == null) return '';
  return String(toDisplayWeight(kg, unit));
}
