/**
 * Shape (CLAUDE.md §6.7).
 *
 * Two rules carry the whole system. **Interactive things are capsules** — iOS 26
 * prefers them and our primary CTA is a 52pt one. **Nested corners are
 * concentric** — an inner radius equals the outer radius minus the padding
 * between them. Mismatched nested corners are the single most common tell of an
 * app that was drawn rather than built: invisible until you look at exactly one
 * corner, and invisible nowhere afterwards.
 *
 * One shape is deliberately absent: the composer and its inputs have **no radius
 * at all**. The writing surface is a page, not a widget, and that is the detail
 * that keeps Today from looking like a chat app (§6.7, §8.2).
 */
export const radius = {
  sm: 8,
  md: 12,
  /** Cards. */
  lg: 16,
  xl: 20,
  /** Sheet top corners. */
  xxl: 28,
  /** Buttons, chips, pills — anything the finger acts on. */
  capsule: 999,
} as const;

/** The ladder a computed radius snaps onto, small to large. */
const STEPS = [radius.sm, radius.md, radius.lg, radius.xl, radius.xxl] as const;

/**
 * The radius a control should carry inside a rounded surface: `outer − pad`,
 * snapped **up** to the nearest step.
 *
 * §6.7 works the example: a control inside a 16pt card with 12pt padding gets 8,
 * not 4 — the arithmetic says 4, and the eye says a corner that tight inside a
 * soft one reads as a mistake rather than a choice. So this rounds up to the
 * next rung on the shape ladder and never invents a value between rungs.
 *
 *   concentric(radius.xxl, spacing.lg)  // 28 − 16 = 12 → radius.md
 *   concentric(radius.lg, spacing.md)   // 16 − 12 =  4 → radius.sm (snapped up)
 *
 * A capsule stays a capsule: nothing nested inside one should try to be squarer
 * than its container's ends.
 */
export function concentric(outer: number, pad: number): number {
  if (outer >= radius.capsule) return radius.capsule;
  const raw = outer - pad;
  if (raw <= 0) return radius.sm;
  return STEPS.find((step) => step >= raw) ?? outer;
}

export type RadiusToken = keyof typeof radius;
