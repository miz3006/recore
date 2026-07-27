/**
 * WCAG relative luminance and contrast (CLAUDE.md §17).
 *
 * §17 is unambiguous about how this gets checked: *"Verify in CI with a
 * token-pair test, not by eye."* Eyes are the reason inaccessible palettes ship
 * — a designer with a good monitor in a lit room cannot see what a lifter sees
 * on a dimmed phone with sweat on the glass. So the palette answers to a number.
 *
 * Pure and free of React Native imports so `npm test` can run it under node.
 */

/** WCAG AA for body text. Anything below this is unreadable to someone. */
export const AA_BODY = 4.5;

/** WCAG AA for large text — ≥ 24pt, or ≥ 18.66pt bold. */
export const AA_LARGE = 3;

function channel(value: number): number {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance per WCAG 2.1. Any alpha is ignored: a token pair is
 * checked at full opacity, which is the worst case a reader actually meets.
 */
export function luminance(hex: string): number {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body.slice(0, 6);
  const n = parseInt(full, 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** Contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Does this pair clear the threshold? */
export function meetsAA(foreground: string, background: string, threshold = AA_BODY): boolean {
  return contrastRatio(foreground, background) >= threshold;
}
