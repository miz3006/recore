/**
 * Recore color system — LIGHT scheme ("Recore Light" design project;
 * scheme spec mirrored in `../design-import/` and the CLAUDE.md tokens).
 *
 * THE RECORD CONTRACT still sets the palette, now on warm paper. Four data
 * states — Written / Interpreted / Recorded / Planned — live on a warm paper
 * canvas with a small number of intentional accents (product-direction §4.2,
 * v5.1): **green `#547C00` appears ONLY on planned, future prescription
 * values, always with their label and reason**; **blue `#007AFF` is RECORE
 * BLUE, the visible product accent** — selected onboarding choices,
 * interactive focus, active controls, walkthrough emphasis, recorded-progress
 * charts, and the day-trained marks it started as (it is an accent, never a
 * reward colour); and **ember `#BF5B23` is an optional secondary comparison
 * in a chart**, never the sole indicator of good or bad — today that is one
 * lift's progression line and the wash under it in the lift sheet. Ember
 * never touches a NUMBER — the readings beside the chart stay ink. A PR is a
 * neutral outlined label; comparisons are archival mono in muted grey;
 * warnings are amber words, never color alone; red is destructive actions and
 * genuine errors only.
 *
 * (History: v2's "blue ONLY on day-trained marks" ruling, 28 Jul, was widened
 * by v5.1 §4.2 — "Recore blue is a visible product accent, not a colour
 * confined to a calendar".)
 *
 * Primary CTAs are ink-fill (`accent` #171914 on `bg`/`surface` text) —
 * restraint IS the brand. If a pixel isn't a future prescription, it doesn't
 * get green.
 *
 * Token roles are preserved from the dark scheme so every screen keeps reading
 * the same names; only the values invert. Note the light elevation model:
 * `surface` (#FBFCF6) is *raised* above the `bg` canvas (#F4F5EF), and
 * `surfaceHigh` (#E9EAE2) is now the *recessed* tone (segmented containers,
 * hairline fills, pressed states) — brighter is nearer in dark, recessed is
 * nearer in light.
 */
export const color = {
  bg: '#F4F5EF', // warm paper canvas (screen bg; also ink-CTA label color)
  surface: '#FBFCF6', // raised paper: cards, sheets, chips, pills, accessory bar, keys
  surfaceHigh: '#E9EAE2', // recessed: segmented container, hairline fills, pressed states
  accent: '#171914', // ink: primary CTA fill, emphasized borders — equals textPrimary
  accentPressed: '#2C2F27', // ink-fill button pressed — never an opacity flash
  signal: '#547C00', // PLANNED green: future prescription values ONLY
  trained: '#007AFF', // RECORE BLUE (iOS systemBlue): the product accent (§4.2) — selected choices, active controls, walkthrough emphasis, recorded-progress charts, day-trained marks
  trend: '#BF5B23', // TREND ember: the progression line of ONE lift + its wash, in the lift sheet ONLY
  textPrimary: '#171914', // what the USER typed; headings; ink
  textSecondary: '#687064', // supporting copy, gutter readings, tags, labels
  textMuted: '#9AA093', // dates, evidence lines, placeholders, disabled
  border: '#D4D7CC', // 1px card + control borders (hairline rule)
  divider: '#E9EAE2', // row dividers inside cards
  tableRule: '#E9EAE2', // hairline rules between table/receipt rows
  warning: '#8A5613', // amber: CHECK chips, offline/allowance banners
  warningBorder: '#D8BE86', // border for amber CHECK tags
  error: '#A33D36', // failures ("Purchase didn't go through") + destructive ONLY
} as const;

export type ColorToken = keyof typeof color;

/**
 * The settings-glyph palette — owner, 28 July. The **only** place in Recore
 * where a hue means nothing at all, and the constraints are what make that
 * safe:
 *
 * - **Chrome, never data.** These tint the leading glyph of a settings row on
 *   You (§16.4) — wayfinding, so a long list is scanned by shape *and* colour
 *   before it is read. A tinted glyph never sits next to a value, never marks
 *   a state, and never carries a claim. The record stays two inks.
 * - **One colour per glyph, everywhere.** The map lives with the glyphs
 *   (`components/icon.tsx`), so `sparkle` is the same gold on every row it
 *   appears on. A colour that means one thing here and another there is worse
 *   than no colour.
 * - **Green and blue are not in this set, and must never be added to it.**
 *   `signal` is a planned value and `trained` is a day trained; a settings row
 *   borrowing either would spend a meaning the app cannot get back. Red is
 *   absent for the same reason — destructive rows already draw in `error`.
 * - **Warm and darkened for paper.** The iOS system hues are tuned for pure
 *   white and go garish on `#F4F5EF`. Every value here clears 3:1 against both
 *   `surface` and `bg` (§14).
 */
export const glyph = {
  indigo: '#5B57C2', // calendar, card — structure and billing
  orange: '#C2661C', // target, upload — what you aim at, what comes in
  teal: '#2E8B8F', // language, refresh, download — words and movement
  gold: '#A9791B', // plate, sparkle, star — iron, Pro, and the review ask
  slate: '#5C6B7A', // barbell, lock, document, sign-out, wrench — the plumbing
  plum: '#7A4E8C', // table — the spreadsheet's own colour
} as const;

export type GlyphTone = keyof typeof glyph;

/**
 * The opacity ladder — centralized so no component can silently drift.
 * Echoes recede, readings stay quiet, disabled CTAs sit at 40%. Values are
 * scheme-independent (they encode relative emphasis, not a hue), so they carry
 * over unchanged from dark to light.
 */
export const ink = {
  /** First-time echo ("3×12 100") — visible but quiet. */
  echo: 0.55,
  /** Quiet mono values (receipt top sets, record-book rows). */
  value: 0.7,
  /** Comparison lines — the archival voice. */
  delta: 0.8,
  /** Full-strength text. */
  full: 1.0,
  /** Disabled primary CTA (design frame 05: Finish at 40%). */
  disabled: 0.4,
  /** Sheet grabbers, structural whispers (home indicator = ink @ .18). */
  grabber: 0.18,
  /** Hairline rules on paper. */
  rule: 0.28,
  /** Subtle tinted fills (chips, chart history bars). */
  wash: 0.14,
  /** Card borders (legacy alpha-based hairlines). */
  hairline: 0.08,
  /** Row dividers inside cards (legacy alpha-based). */
  divider: 0.06,
  /** Outlined pill borders (PR). */
  pill: 0.6,
} as const;

/**
 * Apply an alpha to a hex color. Used to let readings recede — e.g. parsed
 * gutter numbers sit at ~70% opacity so they stay quiet until looked at.
 */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
