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
  textMuted: '#82887B', // dates, evidence lines, placeholders, disabled — see the contrast note below
  border: '#D4D7CC', // 1px card + control borders (hairline rule)
  divider: '#E9EAE2', // row dividers inside cards
  tableRule: '#E9EAE2', // hairline rules between table/receipt rows
  /**
   * ATTENTION (owner, 12 Aug 2026) — plateau / backoff / paused. Never for
   * chrome or CTAs.
   *
   * The palette had no token for "this needs your eye" that was not also a
   * verdict. `signal` green is a load not yet lifted and may never mean
   * anything else; `error` red is a failure or a destructive action; `warning`
   * amber belongs to the app's own state (offline, allowance) rather than to
   * the record. A stalled lift is none of those — it is a fact about training
   * that deserves one degree more weight than muted ink.
   *
   * Its three permitted homes: the STANDING STILL eyebrow, the backoff load
   * inside a WATCH line, and the PAUSED tag on a session type once those ship.
   *
   * MEASURED (§14.3's ink-ladder contract): **4.58:1 on `bg`, 4.87:1 on
   * `surface`** — clears AA, so it may carry a number a person must read. It
   * measures **4.14:1 on `surfaceHigh`** and therefore must not be drawn on
   * the recessed tone.
   */
  attention: '#B45309', // plateau / backoff / paused — never chrome, never a CTA
  warning: '#8A5613', // amber: CHECK chips, offline/allowance banners
  warningBorder: '#D8BE86', // border for amber CHECK tags
  error: '#A33D36', // failures ("Purchase didn't go through") + destructive ONLY
} as const;

export type ColorToken = keyof typeof color;

/**
 * ## The ink ladder, measured (owner, 9 Aug 2026 — "make it readable at low
 * vision")
 *
 * Contrast against the `bg` canvas (`surface` is a shade kinder to all three):
 *
 * | Token | Ratio | What it may carry |
 * |---|---|---|
 * | `textPrimary` | **16.2:1** | Anything. The record's own voice. |
 * | `textSecondary` | **4.7:1** | Clears AA for body text — any number, comparison or label a person must READ. |
 * | `textMuted` | **3.3:1** | Clears the 3:1 floor for large text and non-text marks only: dates, placeholders, disabled states, decoration. |
 *
 * `textMuted` was `#9AA093` — **2.45:1**, which fails AA (4.5) and misses even
 * the 3:1 floor, while being used 180+ times including on values people were
 * expected to read. Darkening the token lifts every one of those at once; the
 * standing rule that came with it is the important half:
 *
 * **If the text carries information, it is `textSecondary` or ink. `textMuted`
 * is for things the eye may skip.**
 *
 * Where a surface still puts a value in muted, that is a bug to fix at the call
 * site, not a reason to lighten this token again.
 */

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
