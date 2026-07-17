/**
 * Plate math (PURE, zero I/O, runs under `node --test`): what to load on each
 * side of the bar for a target weight. Standard metric plate set, floored at
 * the user's smallest plate (gym profile). The checklist long-press renders
 * the result as one quiet mono line — the "what do I put on" moment solved
 * without leaving the page.
 */
const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] as const;

export interface PlateBreakdown {
  /** Plates per SIDE, heaviest first (e.g. [20, 10, 1.25]). */
  perSide: number[];
  /** Weight left over when the target isn't loadable exactly. */
  remainderKg: number;
}

export function platesFor(
  targetKg: number,
  barKg: number,
  smallestPlateKg: number | null = null,
): PlateBreakdown | null {
  if (!Number.isFinite(targetKg) || targetKg < barKg) return null;

  const available = STANDARD_PLATES_KG.filter(
    (p) => smallestPlateKg == null || p >= smallestPlateKg,
  );

  let perSideLeft = (targetKg - barKg) / 2;
  const perSide: number[] = [];
  for (const plate of available) {
    while (perSideLeft >= plate - 1e-9) {
      perSide.push(plate);
      perSideLeft -= plate;
    }
  }
  return { perSide, remainderKg: Math.round(perSideLeft * 2 * 100) / 100 };
}

/** "20 + 10 + 1.25 a side" · "just the bar" · null when below the bar. */
export function plateLine(
  targetKg: number,
  barKg: number,
  smallestPlateKg: number | null = null,
): string | null {
  const b = platesFor(targetKg, barKg, smallestPlateKg);
  if (!b) return null;
  if (b.perSide.length === 0) return `just the bar (${barKg} kg)`;
  const list = b.perSide.map((p) => String(p)).join(' + ');
  return b.remainderKg > 0 ? `${list} a side · ${b.remainderKg} kg over` : `${list} a side`;
}
