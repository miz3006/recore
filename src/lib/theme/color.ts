/**
 * Recore color system (CLAUDE.md §8).
 *
 * TWO INKS. The user writes in white; the machine answers in SIGNAL — a single
 * volt accent reserved exclusively for what the AI asserts: parsed deltas, PR
 * flags, ghost prescriptions, progress fills, parse status. Everything else is
 * monochrome — near-black canvas, crisp white type, generous negative space.
 * Research (Whoop / Oura / Peloton): premium dark fitness UI = grayscale-first
 * hierarchy + exactly ONE meaningful accent at ~10% coverage; zero-accent
 * monochrome reads unfinished.
 *
 * The rule that matters most: signal is SEMANTIC, never decorative. If a pixel
 * isn't the machine speaking or the user getting stronger, it doesn't get volt.
 * Primary CTAs stay white-fill / black-text — restraint IS the brand.
 */
export const color = {
  bg: '#0A0A0A', // near-black canvas
  surface: '#161616', // cards, sheets, pills
  surfaceHigh: '#202020', // raised elements, pressed states
  accent: '#FFFFFF', // user's ink: text cursor, primary CTA fill
  accentPressed: '#E4E4E6', // white-fill button pressed — never an opacity flash
  signal: '#C8FF00', // machine's ink: AI output, deltas, PR, progress
  textPrimary: '#FFFFFF', // what the USER typed
  textSecondary: '#9A9A9E', // ghost text, justifications, secondary
  textMuted: '#5A5A5E', // dates, borders, placeholders
  border: '#222222', // hairline borders (use 0.5px where possible)
  error: '#FF453A', // deload / warnings ONLY
} as const;

export type ColorToken = keyof typeof color;

/**
 * The opacity ladder — the core of the two-ink hierarchy, centralized so no
 * component can silently drift. Echoes recede, comparisons speak, PRs shout.
 */
export const ink = {
  /** First-time echo ("3×12 100") — visible but quiet. */
  echo: 0.55,
  /** Quiet white mono values (receipt top sets, record-book rows). */
  value: 0.7,
  /** Comparison signals (↑ +2.5) — the machine's working voice. */
  delta: 0.8,
  /** PR / the machine's full voice. */
  full: 1.0,
  /** Sheet grabbers, structural whispers. */
  grabber: 0.18,
  /** Hairline rules on white. */
  rule: 0.28,
  /** Subtle signal-tinted fills (chips, chart history bars). */
  wash: 0.14,
  /** Card borders. */
  hairline: 0.08,
  /** Row dividers inside cards. */
  divider: 0.06,
  /** Signal pill borders (PR). */
  pill: 0.6,
} as const;

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
