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
 * ## WHITE, NOT PAPER (owner, 17 August 2026)
 *
 * The canvas is now **pure white**, everywhere in the app, and so is every
 * surface that sits on it. The warm paper family (`#F4F5EF` canvas, `#FBFCF6`
 * raised paper) is history; the greys that used to lean olive to belong to it
 * are neutral, because a warm hairline on white reads as dirt rather than as
 * warmth.
 *
 * This changes the elevation model, and it has to: nothing can be brighter than
 * white, so a card is no longer a lighter tone — **it is white on white, lifted
 * by its hairline and its shadow**. `surfaceHigh` keeps the opposite job as the
 * *recessed* tone (segmented containers, hairline fills, pressed states), which
 * is now the only tonal step the neutrals have left. A surface that carries no
 * border and no shadow will no longer be visible; give it one.
 *
 * The inks are unchanged and every one of them gained contrast on the lighter
 * canvas (the measured ladder below).
 *
 * Token roles are preserved from the dark scheme so every screen keeps reading
 * the same names; only the values change.
 */
export const color = {
  bg: '#F2F2F7', // GROUPED CANVAS (iOS systemGroupedBackground): what a LIST screen sits on, so a white card is a card. NOT a foreground — white-on-ink is `onInk`.
  surface: '#FFFFFF', // cards, sheets, chips, pills, accessory bar, keys — and the full-bleed DOCUMENT screens (Today, onboarding, sign-in)
  surfaceHigh: '#E5E5EA', // recessed: segmented container, hairline fills, pressed states (iOS systemGray5 — it has to stay legible on the grouped `bg` too)
  onInk: '#FFFFFF', // a label, glyph or dot sitting ON `accent` / `ctaFill` — always white, whatever the canvas does
  accent: '#1C1C1E', // ink: emphasized borders, badge fills, selected day marks — equals textPrimary. NO LONGER the primary CTA (18 Aug).
  accentPressed: '#2C2C2E', // ink-fill pressed — never an opacity flash
  ctaFill: '#007AFF', // THE PRIMARY BUTTON (owner, 18 Aug 2026): Apple tints its prominent button, it does not ink it. Same blue as `trained`.
  ctaFillPressed: '#0062CC', // the CTA held down — a darker blue, never an opacity flash
  signal: '#547C00', // PLANNED green: future prescription values ONLY
  trained: '#007AFF', // RECORE BLUE (iOS systemBlue): the product accent (§4.2) — selected choices, active controls, walkthrough emphasis, recorded-progress charts, day-trained marks
  trend: '#BF5B23', // TREND ember: the progression line of ONE lift + its wash, in the lift sheet ONLY
  textPrimary: '#1C1C1E', // what the USER typed; headings; ink
  textSecondary: '#6E6E73', // supporting copy, gutter readings, tags, labels
  textMuted: '#86868B', // dates, evidence lines, placeholders, disabled — see the contrast note below
  border: '#D5D5D5', // 1px card + control borders (hairline rule) — it draws the card now that tone does not
  divider: '#E9E9E9', // row dividers inside cards
  tableRule: '#E9E9E9', // hairline rules between table/receipt rows
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
   * MEASURED (§14.3's ink-ladder contract), re-measured on the white canvas of
   * 17 Aug: **5.02:1 on `bg` and `surface`** — clears AA, so it may carry a
   * number a person must read. It still measures **4.14:1 on `surfaceHigh`**
   * and therefore must not be drawn on the recessed tone.
   */
  attention: '#B45309', // plateau / backoff / paused — never chrome, never a CTA
  /**
   * THE TWO CHIP WASHES for the states that had none (owner, 18 Aug 2026 —
   * *"in Next use the green the way Progression uses it"*).
   *
   * Progression says a delta with a small tinted chip: `gain` ink on
   * `gainWash`, `loss` ink on `lossWash`. Next had no equivalent, so its
   * decision label was a SOLID fill with a white label — a different, louder
   * object doing the same job one tab across. These two washes let Next wear
   * Progression's chip with Next's own tokens, which is the only way to have
   * both: the record contract forbids `gain` from standing in for `signal`
   * (recorded is not planned), so the treatment travels and the hue does not.
   *
   * THEY ARE PALER THAN `gainWash`/`lossWash`, and the arithmetic is why. A
   * 12%-strength wash suits `gain` #1F7A33 (5.4:1 on white) and leaves 4.7:1.
   * The same strength under `signal` #547C00 (4.93:1) and `attention` #B45309
   * (5.02:1) — both lighter hues — lands at **4.2:1** and fails §14.3's AA
   * contract for an 11 pt label. At the strengths below they clear it:
   * **`signal` on `signalWash` 4.59:1, `attention` on `attentionWash`
   * 4.64:1.** Nothing but those two pairings may be drawn on them.
   */
  signalWash: '#F5F8EE', // the chip behind `signal` — 4.59:1
  attentionWash: '#FBF5F0', // the chip behind `attention` — 4.64:1
  /**
   * DIRECTION (owner, 17 Aug 2026, from the Progression mockup) — how far a
   * RECORDED lift moved, and nothing else.
   *
   * This pair reverses the v5.1 §10 ruling that "a lift that fell draws in
   * exactly the same blue as one that rose". The owner's mockup marks a gain
   * green and a regression red, and captions the rule that keeps it humane:
   * **red only when truly regressing** — a lift that merely held its load is
   * ink, never red, so a maintenance block is never coloured as a failure.
   *
   * Constraints that make them safe:
   * - **Never the only carrier.** Every place they appear, the word says the
   *   same thing ("up 12%", "down 5%", "no change in 4 sessions") — §14.
   * - **Recorded values only.** `signal` green is still a load NOT YET LIFTED
   *   and `gain` may never stand in for it; `error` red is still a failure or a
   *   destructive action and `loss` may never stand in for that either. Keeping
   *   four distinct tokens is what stops "down 5%" reading as "something broke".
   * - **They are their own hues.** MEASURED against the ink ladder below, on
   *   the white canvas of 17 Aug: `gain` **5.4:1 on bg/surface, 4.7:1 on its
   *   own chip wash**, `loss` **5.6 / 4.7** — both clear AA, so either may
   *   carry a number a person has to read.
   */
  gain: '#1F7A33', // RECORDED progress upward — never a planned value (that is `signal`)
  loss: '#C62828', // RECORDED regression — never an error or a destructive action (that is `error`)
  gainWash: '#E4F3E3', // the chip behind `gain`
  lossWash: '#FBE6E3', // the chip behind `loss`
  warning: '#8A5613', // amber: CHECK chips, offline/allowance banners
  warningBorder: '#D8BE86', // border for amber CHECK tags
  error: '#A33D36', // failures ("Purchase didn't go through") + destructive ONLY
} as const;

export type ColorToken = keyof typeof color;

/**
 * ## The ink ladder, measured (owner, 9 Aug 2026 — "make it readable at low
 * vision")
 *
 * Contrast against the canvas, RE-MEASURED on the white `bg` of 17 Aug 2026
 * (`surface` is the same white now, so one column answers for both; the
 * recessed `surfaceHigh` costs each of them about a fifth of its ratio):
 *
 * | Token | Ratio | What it may carry |
 * |---|---|---|
 * | `textPrimary` | **17.0:1** (was 17.7 warm, 16.2 on paper) | Anything. The record's own voice. |
 * | `textSecondary` | **5.1:1** (was 4.7 on paper) | Clears AA for body text — any number, comparison or label a person must READ. |
 * | `textMuted` | **3.6:1** (was 3.3 on paper) | Clears the 3:1 floor for large text and non-text marks only: dates, placeholders, disabled states, decoration. |
 *
 * ## The hue went neutral too (18 Aug 2026)
 *
 * §4.2 retired warm paper and said the neutrals go neutral; the INK had not
 * followed. `#171914` / `#687064` / `#82887B` were all green-cast (G > R > B),
 * which on a pure-white canvas reads as a slightly sickly grey rather than as
 * ink. They now sit on Apple's own label ramp — `#1C1C1E` label, `#6E6E73`,
 * `#86868B` — which runs the other way (B ≥ G = R, a hair cool) and is what
 * every native control on the screen next to us is already drawn in.
 *
 * **The ladder was preserved, not copied.** Apple's `secondaryLabel` over white
 * is ~`#8A8A8E` (3.3:1) and its tertiary ~`#C4C4C6` (1.9:1) — both would drop
 * this app below the floor measured above, so only the HUE moved; each rung
 * kept its ratio. If a future token borrows an Apple grey, measure it first.
 *
 * Every ink gained on white; none of the rules below loosens because of it —
 * `textMuted` at 3.6 still fails AA for body text.
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
 * - **Darkened, and kept that way.** The values were pulled down off the iOS
 *   system hues when the canvas was warm paper; on the white canvas of 17 Aug
 *   they all gained contrast rather than losing it (3.9–6.4:1, `gold` the
 *   lowest), so they stay exactly as they are. Every value here clears 3:1
 *   against `bg`, `surface` and `surfaceHigh` (§14).
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
