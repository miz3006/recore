/**
 * Recore color system — the v6 canvas (design skill `recore-design`, §Canvas
 * and §Colour; migration Phase 1, 20 August 2026).
 *
 * **The read: warm paper, black ink, one blue.**
 *
 * ## The canvas is warm paper again, and there is only ONE of them
 *
 * The document/grouped split is abolished. There is no `#F2F2F7` grouped world
 * that a list screen sits on and no white document world that Today writes on:
 * `canvas` runs the whole app — Today, the tabs, sheets' backdrop, settings,
 * every onboarding step. **White is a SURFACE** (pills, cards, sheets, chips),
 * never the canvas. `canvasTop` and `canvasBot` are the two ends of the static
 * diagonal gradient drawn over it (`lib/paper-field.ts`).
 *
 * This reverses "WHITE, NOT PAPER" (17 Aug 2026) and the grouped-grey `bg` that
 * followed it (18 Aug). The measured ladder below is why: on `#F2F2F7` two of
 * the inks people are expected to READ failed AA — `signal` at 4.42 and
 * `textSecondary` at 4.54 with no headroom. Every one of them clears 4.5:1 on
 * the three canvas tints. A warmer cream was measured too and rejected for
 * exactly this. **Do not deepen the canvas without re-measuring the whole ink
 * ladder.**
 *
 * The elevation model that came with white stands, and matters more here: on a
 * canvas a white pill is 1.05:1 by tone, so **a surface with neither border nor
 * shadow is invisible — give it one** (`shadow.card`). `surfaceHigh` keeps the
 * opposite job as the *recessed* tone.
 *
 * ## One blue does every job
 *
 * `brand` `#0B5CD6` ("Volt", owner's pick, 20 Aug 2026) is the primary CTA, the
 * selected state and its check, links, active controls, progress fill and chart
 * lines. It lives in exactly one token and **no file may name a blue literal**.
 * `#007AFF` is retired: it measured 4.02:1 on white and 3.73:1 on the canvas and
 * failed text-sized use. Volt measures **5.97:1 on white, 5.53–5.69:1 across the
 * canvas tints**, and white-on-fill is the same ratio, so it also clears AA as a
 * filled button. `ctaFill` / `ctaFillPressed` / `trained` are deprecated aliases
 * of it for the duration of the migration and are deleted with Phase 3.
 *
 * Primary CTAs are a filled brand pill with `shadow.glow`. The old "primary CTAs
 * are ink-fill — restraint IS the brand" ruling is retired (skill §Decided-1);
 * `accent` keeps its other jobs (emphasized borders, badge fills, day marks) and
 * the onboarding progress rail, which stays ink and never goes brand.
 *
 * ## What did NOT change
 *
 * **Green `#547C00` (`signal`) is PLANNED-ONLY** — a future prescription, a load
 * not yet lifted, always with its label and reason. It may never mean good,
 * done, recorded or success, it never becomes a CTA, a link or a selected state,
 * and `gain` green may never stand in for it: recorded is not planned. The
 * recorded semantics (`gain`/`loss`/`attention`), the three inks, the
 * borders, the four washes, `glyph.*`, the `ink` ladder and `alpha()` all carry
 * over untouched.
 *
 * `trend` ember `#BF5B23` is the one exception to that list: it is **retired**
 * (owner, 20 Aug 2026). Its only sanctioned home was the lift sheet's
 * progression line and the wash under it, and that chart draws in `brand` now
 * so the same lift reads the same way there as on Progression. The token has no
 * call sites — see its own note below.
 */
export const color = {
  canvas: '#FCF9F4', // THE WORLD: every screen, every sheet backdrop. Also the flat fill wherever the gradient cannot render.
  canvasTop: '#FDF6EE', // peach tint — top of the static diagonal gradient
  canvasBot: '#F9F5F9', // faint lavender-pink tint — bottom of it
  /** @deprecated alias of `canvas` — kept only until Phase 2 has moved its 13 call sites. Use `canvas`. */
  bg: '#FCF9F4',
  surface: '#FFFFFF', // pills, cards, sheets, chips, the input bar — a SURFACE on the canvas, never the canvas
  surfaceHigh: '#E5E5EA', // recessed only: segmented containers, hairline fills, pressed states
  onInk: '#FFFFFF', // a label, glyph or dot sitting ON `accent` / `brand` — always white, whatever the canvas does
  accent: '#1C1C1E', // ink: emphasized borders, badge fills, selected day marks, the onboarding progress fill — equals textPrimary
  accentPressed: '#2C2C2E', // ink-fill pressed — never an opacity flash
  brand: '#0B5CD6', // THE ONE BLUE: primary CTA, selected states + checks, links, active controls, progress fill, chart lines
  brandPressed: '#0A4CB0', // the brand held down — a darker blue, never an opacity flash
  brandGlow: '#0B5CD6', // `shadow.glow`'s cast — the only coloured shadow in the app, primary CTA only
  /** @deprecated → `brand`. Removed with Phase 3. */
  ctaFill: '#0B5CD6',
  /** @deprecated → `brandPressed`. Removed with Phase 3. */
  ctaFillPressed: '#0A4CB0',
  /** @deprecated → `brand`. Removed with Phase 3. */
  trained: '#0B5CD6',
  signal: '#547C00', // PLANNED green: future prescription values ONLY
  /**
   * @deprecated NO CALL SITES since 20 Aug 2026. Ember was the lift sheet's
   * progression line and its wash — its only sanctioned home — and the owner
   * moved that chart to `brand` so it draws the same as Progression's. The
   * token is kept rather than deleted because retiring a palette entry is the
   * owner's call; if it stays unused, delete it and the §Colour line that
   * reserves it. Nothing new may adopt it.
   */
  trend: '#BF5B23', // TREND ember — unused
  textPrimary: '#1C1C1E', // what the USER typed; headings; ink
  textSecondary: '#6E6E73', // supporting copy, gutter readings, tags, labels
  textMuted: '#86868B', // dates, evidence lines, placeholders, disabled — see the contrast note below
  border: '#D5D5D5', // 1px card + control borders (hairline rule)
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
   * MEASURED (§14.3's ink-ladder contract), re-measured on the canvas of 20 Aug
   * 2026: **4.65–4.78:1 across the three canvas tints, 5.02:1 on `surface`** —
   * clears AA, so it may carry a number a person must read. It still measures
   * **4.00:1 on `surfaceHigh`** and therefore must not be drawn on the recessed
   * tone.
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
   * They are the fills of `Badge tone="wash"` — the one sanctioned filled chip
   * (skill §Decided-4). A wash pairs with exactly ONE ink and nothing else.
   *
   * THEY ARE PALER THAN `gainWash`/`lossWash`, and the arithmetic is why. A
   * 12%-strength wash suits `gain` #1F7A33 (5.4:1 on white) and leaves 4.7:1.
   * The same strength under `signal` #547C00 (4.93:1) and `attention` #B45309
   * (5.02:1) — both lighter hues — lands at **4.2:1** and fails §14.3's AA
   * contract for an 11 pt label. At the strengths below they clear it:
   * **`signal` on `signalWash` 4.59:1, `attention` on `attentionWash`
   * 4.64:1.** Nothing but those two pairings may be drawn on them. (The washes
   * are opaque fills, so the canvas underneath them does not change these.)
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
   *   the canvas of 20 Aug 2026: `gain` **5.00–5.14:1 on the canvas tints, 5.40
   *   on `surface`, 4.69 on its own chip wash**, `loss` **5.21–5.35 / 5.62 /
   *   4.69** — both clear AA, so either may carry a number a person has to read.
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
 * Contrast RE-MEASURED against the warm canvas of 20 Aug 2026. The canvas
 * column is the worst of the three tints (`canvas` / `canvasTop` / `canvasBot`),
 * because the gradient means any of them can be under a given pixel; the
 * recessed `surfaceHigh` costs each ink about a fifth of its ratio:
 *
 * | Token | on canvas (worst tint) | on `surface` | What it may carry |
 * |---|---|---|---|
 * | `textPrimary` | **15.76:1** | 17.01 | Anything. The record's own voice. |
 * | `textSecondary` | **4.70:1** | 5.07 | Clears AA for body text — any number, comparison or label a person must READ. |
 * | `textMuted` | **3.36:1** | 3.62 | Clears the 3:1 floor for large text and non-text marks only: dates, placeholders, disabled states, decoration. |
 *
 * The information-carrying accents on the same canvas, worst tint: `brand`
 * 5.53, `signal` 4.57, `attention` 4.65, `gain` 5.00, `loss` 5.21, `warning`
 * 5.69, `error` 5.94 — every one clears AA. `trend` is 4.11 and is the one
 * exception the palette allows itself: it draws a LINE and its wash, never a
 * number.
 *
 * The retired grouped grey `#F2F2F7` is what these numbers were bought from:
 * there `signal` was 4.42 and `textSecondary` 4.54, so a prescribed load and
 * every supporting reading in the app sat at or under the line.
 *
 * ## The hue of the ink (18 Aug 2026, unchanged by the canvas)
 *
 * `#1C1C1E` / `#6E6E73` / `#86868B` sit on Apple's own label ramp, which runs a
 * hair cool (B ≥ G = R) and is what every native control on the screen next to
 * us is already drawn in. They were green-cast before that.
 *
 * **The ladder was preserved, not copied.** Apple's `secondaryLabel` over white
 * is ~`#8A8A8E` (3.3:1) and its tertiary ~`#C4C4C6` (1.9:1) — both would drop
 * this app below the floor measured above, so only the HUE moved; each rung
 * kept its ratio. If a future token borrows an Apple grey, measure it first.
 *
 * The standing rule that came with the ladder is the important half:
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
 *   `signal` is a planned value and `brand` is the app's one accent; a settings
 *   row borrowing either would spend a meaning the app cannot get back. Red is
 *   absent for the same reason — destructive rows already draw in `error`.
 * - **Darkened, and kept that way.** The values were pulled down off the iOS
 *   system hues when the canvas was warm paper, which is what it is again:
 *   re-measured 20 Aug they run 3.58–5.90:1 on the canvas tints (`gold` the
 *   lowest), so every one still clears the 3:1 floor a non-text mark needs on
 *   `canvas`, `surface` and `surfaceHigh` (§14), and they stay as they are.
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
 *
 * **Never call this inside a worklet.** It is a plain JS function, so reaching
 * it from `useAnimatedStyle` crashes on the UI thread at runtime — no gate
 * catches it. Precompute the string outside the hook and close over it.
 */
export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
