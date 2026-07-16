/**
 * Recore color system (CLAUDE.md §5).
 *
 * The accent is WHITE. The whole design reads premium, monochrome, and modern
 * precisely because it withholds color — Vercel / Linear / Things 3. Near-black
 * canvas, crisp white type, generous negative space, no decorative hue.
 *
 * The one rule that matters most: emphasis appears ONLY where the AI spoke —
 * parsed numbers, the prediction, a PR flag, the blinking cursor — expressed
 * through weight / opacity / position, never through a colored accent.
 */
export const color = {
  bg: '#0A0A0A', // near-black canvas
  surface: '#161616', // cards, sheets, pills
  surfaceHigh: '#202020', // raised elements, pressed states
  accent: '#FFFFFF', // AI output + text cursor. White IS the accent.
  textPrimary: '#FFFFFF', // what the USER typed
  textSecondary: '#9A9A9E', // ghost text, justifications, secondary
  textMuted: '#5A5A5E', // dates, borders, placeholders
  border: '#222222', // hairline borders (use 0.5px where possible)
  error: '#FF453A', // deload / warnings ONLY
} as const;

export type ColorToken = keyof typeof color;

/**
 * Apply an alpha to a hex color. Used to let AI output recede — e.g. parsed
 * gutter numbers sit at ~70% opacity so they stay quiet until looked at.
 */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
