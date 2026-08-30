/**
 * Recore color system — the v2 paper palette, promoted to the whole app
 * (owner, 28 August 2026).
 *
 * **The read: warm paper, warm black ink, one blue.**
 *
 * ## What changed on 28 August 2026
 *
 * `docs/onboarding-v2-spec.md` §0 froze a palette for the v2 onboarding flow,
 * and for a month the app ran two: this file's `#FCF9F4` / `#FFFFFF` / `#1C1C1E`
 * / `#0B5CD6`, and v2's `#F4F5EF` / `#FBFCF6` / `#171914` / `#007AFF`. The owner
 * ruled that **the v2 set wins and becomes the app's palette.** This file is now
 * the single source; `src/components/onboarding-v2/tokens.ts` re-exports from
 * here and holds no colour of its own.
 *
 * The merge kept THIS file's token names wherever one already existed, so no
 * call site had to be renamed: v2's `ink` is `textPrimary`/`accent`, its
 * `inkSecondary` is `textSecondary`, its `blue` is `brand`, its `planned` is
 * `signal`. Four tokens v2 had and this file lacked were added (`brandWash`,
 * `disabled`, `track`, and the shadow's own `shadowCast`). Everything this file
 * had and v2 lacked was kept and **re-derived warm** rather than dropped —
 * `surfaceHigh`, `accentPressed`, `border` and `divider` were all cool
 * (OKLCH hue 286°, a blue grey) and are now cut from the canvas's own hue.
 *
 * ## Every neutral is derived from the canvas, in OKLCH
 *
 * The canvas is `#F4F5EF` — **OKLCH L 96.77 % · C 0.008 · H 114°**. Every
 * neutral below holds that chroma and hue and moves only L, so the whole greyscale
 * is one temperature and nothing in it can drift cool by hand-picking:
 *
 * | token | derivation | value | on canvas |
 * |---|---|---|---|
 * | `surfaceHigh` | L × 0.96 | `#E7E8E2` | 1.12:1 |
 * | `divider` | L × 0.945 | `#E2E3DD` | 1.18:1 |
 * | `border` | L × 0.88 | `#CECFC9` | 1.43:1 |
 *
 * `surfaceHigh` at 1.12:1 is worth a note: it is the TINTED PANEL, and it is
 * *darker* than the canvas, where `surface` is lighter. Both polarities are
 * deliberate — `surface` floats on `shadow.card`, `surfaceHigh` recesses. The
 * 1.12:1 was derived, not chosen, and it lands exactly on the card/page
 * separation of the reference screen the Progression rebuild was measured from.
 *
 * The ink-derived tokens are the warm black composited over the canvas at a
 * fixed opacity and then **frozen to an opaque hex**. Resolved rather than left
 * translucent for the two reasons `blend()` documents below: a translucent value
 * cannot hide what is under it, and an animation interpolating to one
 * composites against the wrong ground. The canvas is the ground because it is
 * what the app is ultimately made of; `surface` is 1.06:1 away, which no eye
 * resolves.
 *
 * | token | ink at | value |
 * |---|---|---|
 * | `textSecondary` | 64 % | `#676863` |
 * | `inkData` | 55 % (over `surfaceHigh`) | `#757671` |
 * | `textMuted` | 50 % | `#868782` |
 * | `disabled` | 22 % | `#C3C5BF` |
 * | `track` | 10 % | `#DEDFD9` |
 *
 * ## The canvas is DARKER than the one it replaced
 *
 * `#F4F5EF` is below `#FCF9F4` on all three channels, so every ink GAINED
 * contrast against the page. Nothing regressed because of the canvas. Two things
 * regressed because of the ink and the blue, and both are owner-accepted:
 *
 * 1. **`textMuted` was v2's `inkMuted` at 42 %, which measured 2.63:1 and failed
 *    the 3:1 floor a non-text mark owes.** Raised to **50 %** (owner, 28 Aug),
 *    which measures **3.30:1 on the canvas, 3.51 on `surface`**. It is still
 *    below 3:1 on `surfaceHigh` (2.94) — see the restriction below.
 * 2. **The blue.** `#007AFF` measures **3.66:1 on the canvas** and white on it
 *    measures **4.02:1**, where `#0B5CD6` measured 5.53 and 5.97. A filled
 *    primary CTA with a white 17 pt label is therefore **below the 4.5:1 AA
 *    floor across the whole app**, not only in onboarding. The owner accepted
 *    this on 28 Aug 2026 on the grounds that onboarding already shipped it and
 *    the app should not wear two blues. It is a known divergence, recorded here
 *    and in `FINDINGS.md`, not an oversight.
 *
 * **`signal` is the one token the merge could not keep above AA.** `#547C00` on
 * `#F4F5EF` measures **4.4962:1** — under 4.5 by four thousandths. It was 4.57
 * on the old canvas. Neither value may move without the owner: `#547C00` is
 * named in CLAUDE.md and the v2 spec, and the canvas is the ruling of 28 Aug.
 * `color.test.ts` asserts this exact ratio so the shortfall is a tripwire rather
 * than a rumour, and `signalWash` (4.59:1) is unaffected because a wash is an
 * opaque fill. **A green of `#4F7500` would clear 4.5 on every stop — that is
 * the fix when the owner wants it.**
 *
 * ## One blue does every job
 *
 * `brand` `#007AFF` is the primary CTA, the selected state and its check, links,
 * active controls, progress fill and chart lines. It lives in exactly one token
 * and **no file may name a blue literal** — `color.test.ts` fails the build on
 * any hex literal in application code outside this file.
 *
 * ## What did NOT change
 *
 * **Green `#547C00` (`signal`) is PLANNED-ONLY** — a future prescription, a load
 * not yet lifted, always with its label and reason. It may never mean good,
 * done, recorded or success, it never becomes a CTA, a link or a selected state,
 * and `gain` green may never stand in for it: recorded is not planned. The
 * recorded semantics (`gain`/`loss`/`attention`), the four washes, `glyph.*`,
 * the `ink` ladder and `alpha()` all carry over untouched, and every one of them
 * was re-measured against the new canvas below.
 */
export const color = {
  canvas: '#F4F5EF', // THE WORLD: every screen, every sheet backdrop. OKLCH L 96.77% C 0.008 H 114°.
  canvasTop: '#FBF3EC', // peach — top of the static diagonal gradient (`lib/paper-field.ts`)
  canvasBot: '#F7F4F7', // lavender — bottom of it
  surface: '#FBFCF6', // pills, cards, sheets, chips, the input bar — LIGHTER than the canvas, and it floats on `shadow.card`
  surfaceHigh: '#E7E8E2', // the recessed/tinted panel: segmented containers, metric cards, pressed states. DARKER than the canvas — canvas L × 0.96.
  onInk: '#FFFFFF', // a label, glyph or dot sitting ON `accent` / `brand` — always white, whatever the canvas does
  accent: '#171914', // ink: emphasized borders, badge fills, selected day marks, the onboarding progress fill — equals textPrimary
  accentPressed: '#272923', // ink-fill pressed — never an opacity flash. Ink lightened 6.7pp in OKLCH, hue held.
  brand: '#007AFF', // THE ONE BLUE: primary CTA, selected states + checks, links, active controls, progress fill, chart lines
  brandPressed: '#0062CC', // the brand held down — a darker blue, never an opacity flash
  brandGlow: '#007AFF', // `shadow.glow`'s cast — the only coloured shadow in the app, primary CTA only
  brandWash: '#EAF3FE', // the pale blue behind an informational banner or a selected chip. 3.59:1 under `brand` — a FILL, never a ground for a small label.
  signal: '#547C00', // PLANNED green: future prescription values ONLY. 4.4962:1 — see the AA note above.
  textPrimary: '#171914', // what the USER typed; headings; ink
  textSecondary: '#676863', // supporting copy, gutter readings, tags, labels — ink at 64%
  textMuted: '#868782', // dates, evidence lines, placeholders, disabled — ink at 50%; see the contrast note below
  inkData: '#757671', // CHART SERIES: recorded lines, bars and their dots. Ink at 55% over `surfaceHigh`. Never carries text.
  /**
   * EVERY HAIRLINE THAT HAS TO BE FOUND (owner, on device, 20 Aug 2026; re-derived
   * warm 28 Aug 2026).
   *
   * Card and control borders, and every SEPARATOR inside a card or a sheet. The
   * 20 Aug ruling bought `#D5D5D5` (1.47:1 on white) because `#E9E9E9` at 1.16:1
   * was in the style sheet and not on the screen. v2's own border — ink at 14 %,
   * `#DBDCD6`, **1.34:1** — would have quietly undone that, so it did not win the
   * merge. This is the canvas at L × 0.88: **1.43:1**, which holds the ruling and
   * is cut from the paper instead of from a neutral grey. One hairline, one token.
   *
   * (Between two RECORDS there is no hairline at all — the record is bare rows
   * separated by air. This is for chrome INSIDE a surface.)
   */
  border: '#CECFC9',
  /**
   * The softened border of a card that ALSO casts a shadow. The shadow carries
   * the edge, so the rule is allowed to be almost nothing. Canvas at L × 0.945,
   * 1.18:1 — the warm heir of `#E9E9E9`'s 1.16:1. A border, never a separator.
   */
  divider: '#E2E3DD',
  disabled: '#C3C5BF', // a disabled LABEL or fill, as a colour. Distinct from `ink.disabled`, which is the 40% opacity a CTA drops to.
  track: '#DEDFD9', // the unfilled half of a progress rail or a meter
  shadowCast: '#2E2418', // the warm ink every neutral shadow is cast in (`theme/elevation.ts`). A neutral near-black on cream reads as a smudge.
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
   * MEASURED, re-measured on the canvas of 28 Aug 2026: **4.56–4.60:1 across the
   * three canvas stops, 4.87:1 on `surface`** — clears AA, so it may carry a
   * number a person must read. It measures **4.07:1 on `surfaceHigh`** and
   * therefore must not be drawn on the recessed tone.
   */
  attention: '#B45309', // plateau / backoff / paused — never chrome, never a CTA
  /**
   * THE CHIP WASHES. A wash pairs with exactly ONE ink and nothing else. They
   * are opaque fills, so the canvas under them changes none of these ratios and
   * the merge left every one of them untouched:
   *
   * `signal` on `signalWash` **4.59:1** · `attention` on `attentionWash`
   * **4.64:1** · `gain` on `gainWash` **4.69:1** · `loss` on `lossWash`
   * **4.69:1**.
   *
   * v2 carried its own `plannedWash` `#F1F5E7`; `signalWash` won the merge
   * because its 4.59:1 is measured and the pairing is the same one.
   */
  signalWash: '#F5F8EE', // the chip behind `signal`
  attentionWash: '#FBF5F0', // the chip behind `attention`
  /**
   * DIRECTION (owner, 17 Aug 2026, from the Progression mockup) — how far a
   * RECORDED lift moved, and nothing else.
   *
   * Constraints that make them safe:
   * - **Never the only carrier.** Every place they appear, the word says the
   *   same thing ("up 12%", "down 5%", "no change in 4 sessions").
   * - **Recorded values only.** `signal` green is still a load NOT YET LIFTED
   *   and `gain` may never stand in for it; `error` red is still a failure or a
   *   destructive action and `loss` may never stand in for that either.
   * - **They are their own hues.** Re-measured on the canvas of 28 Aug 2026:
   *   `gain` **4.91–4.95:1 across the canvas stops, 5.23 on `surface`**, `loss`
   *   **5.12–5.15 / 5.45** — both clear AA, so either may carry a number a
   *   person has to read.
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
 * RE-MEASURED against the paper palette of 28 August 2026. The canvas column is
 * the worst of the three gradient stops, because any of them can be under a
 * given pixel; the recessed `surfaceHigh` costs each ink about a fifth of its
 * ratio:
 *
 * | Token | on canvas (worst stop) | on `surface` | on `surfaceHigh` | What it may carry |
 * |---|---|---|---|---|
 * | `textPrimary` | **16.14:1** | 17.17 | 14.37 | Anything. The record's own voice. |
 * | `textSecondary` | **5.12:1** | 5.45 | 4.56 | Clears AA everywhere — any number, comparison or label a person must READ. |
 * | `textMuted` | **3.30:1** | 3.51 | **2.94** | The 3:1 floor for large text and non-text marks only — and **never on `surfaceHigh`**, where it is under it. |
 * | `inkData` | 4.17:1 | 4.44 | **3.72** | Chart marks. Sized for `surfaceHigh`, which is the card it is drawn on. |
 *
 * The information-carrying accents on the same canvas, worst stop: `brand`
 * 3.66, `signal` 4.49, `attention` 4.56, `gain` 4.91, `loss` 5.12, `warning`
 * 5.59, `error` 5.84. All clear AA except the two named in the header: `brand`,
 * which is large-text/non-text only by the owner's ruling, and `signal`, which
 * is four thousandths short.
 *
 * **Two inks are barred from `surfaceHigh`:** `textMuted` (2.94) and `attention`
 * (4.07). `signal` is 4.00 there and is barred from carrying a READ number on
 * it, though it may still draw a mark.
 *
 * ## The hue of the ink (28 Aug 2026)
 *
 * `#171914` is warm — OKLCH hue **125°**, in the canvas's own family. The greys
 * under it are that ink composited on the canvas, so the whole ladder is one
 * temperature by construction rather than by taste. It replaced Apple's label
 * ramp (`#1C1C1E` / `#6E6E73` / `#86868B`, hue 286° — a blue grey), which was
 * chosen in Aug 2026 to match the native controls beside us and lost the merge
 * because a cool ladder on warm paper is the one thing the palette exists to
 * avoid. Every rung KEPT OR IMPROVED its ratio in the move: secondary went
 * 4.83 → 5.12, muted 3.45 → 3.30 (the one small loss, still over the floor).
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
 *   You — wayfinding, so a long list is scanned by shape *and* colour before it
 *   is read. A tinted glyph never sits next to a value, never marks a state,
 *   and never carries a claim. The record stays two inks.
 * - **One colour per glyph, everywhere.** The map lives with the glyphs
 *   (`components/icon.tsx`), so `sparkle` is the same gold on every row it
 *   appears on.
 * - **Green and blue are not in this set, and must never be added to it.**
 *   `signal` is a planned value and `brand` is the app's one accent; a settings
 *   row borrowing either would spend a meaning the app cannot get back. Red is
 *   absent for the same reason — destructive rows already draw in `error`.
 * - **Darkened, and kept that way.** Re-measured against the paper palette of
 *   28 Aug 2026: they run **3.52–5.81:1 on the canvas** (`gold` the lowest) and
 *   **3.13–5.17:1 on `surfaceHigh`**, so every one still clears the 3:1 floor a
 *   non-text mark needs on all three grounds, and they stay as they are.
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
 * COLOURS THAT ARE NOT OURS — the two sign-in buttons, and nothing else.
 *
 * Every value above is Recore's: the paper, the one ink, the one blue, and the
 * neutrals derived from them. These are not. They are Apple's and Google's,
 * published in their own sign-in specs, and they live here only because the
 * palette gate is absolute — a hex outside this file is a value nobody
 * re-measures — not because the system claims them.
 *
 * They are a separate export for that reason. `color` is the design system, and
 * a `color.googleBlue` sitting beside `color.brand` in autocomplete is an
 * invitation to reach for #4285F4 the next time a screen wants a blue. Nothing
 * may use these but `components/provider-button.tsx`.
 *
 * Apple's HIG allows exactly three appearances for the Sign in with Apple
 * button — black, white, white-with-outline — and black is the one that reads
 * on cream. Google's light button is a white surface, a #747775 stroke and
 * #1F1F1F text, with the four-colour "G" that may never be recoloured. The
 * pressed fills are ours: both brands leave the pressed state to the host, and
 * the app's rule everywhere is a darker fill, never an opacity flash.
 *
 * None of these are checked against the canvas contrast ladder, because neither
 * button is a surface the app writes on — each carries one label, in the colour
 * its owner specifies, at a ratio its owner measured.
 */
export const provider = {
  appleFill: '#000000',
  appleFillPressed: '#1C1C1C',
  appleInk: '#FFFFFF',
  googleFill: '#FFFFFF',
  googleFillPressed: '#EFEFEF',
  googleStroke: '#747775',
  googleInk: '#1F1F1F',
  /** The mark's four quadrants, in draw order. */
  googleBlue: '#4285F4',
  googleGreen: '#34A853',
  googleYellow: '#FBBC05',
  googleRed: '#EA4335',
} as const;

/**
 * The same colour `alpha()` describes, resolved to an OPAQUE hex over a given
 * background (20 Aug 2026).
 *
 * `alpha()` returns a translucent colour, which is right whenever what is
 * behind it should show through. It is wrong in two places, and both of them
 * bit this codebase:
 *
 * 1. **A fill that has to HIDE what is under it** — the onboarding parse demo's
 *    wipe was painted white because a 5 % wash cannot cover anything.
 * 2. **A value an animation interpolates TO on a stacked view.** A row whose
 *    background animates to `alpha(brand, .08)` composites that 8 % against the
 *    PAGE, not against the white card it is drawn on, so the card's own white
 *    silently drops out at the end of the transition.
 *
 * Both need the resolved colour rather than the recipe. Both arguments must be
 * `#RRGGBB`; there is no alpha in the output by construction.
 *
 * **Never call this inside a worklet** — same rule as `alpha()` below, and for
 * the same reason. Precompute it into a module constant.
 */
/**
 * Apply an alpha to a hex color. Used to let readings recede — e.g. parsed
 * gutter numbers sit at ~70% opacity so they stay quiet until looked at.
 *
 * **Never call this inside a worklet.** It is a plain JS function, so reaching
 * it from `useAnimatedStyle` crashes on the UI thread at runtime — no gate
 * catches it. Precompute the string outside the hook and close over it.
 */
export function blend(hex: string, opacity: number, over: string): string {
  const a = Math.max(0, Math.min(1, opacity));
  const parse = (h: string): [number, number, number] => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const f = parse(hex);
  const b = parse(over);
  const out = f.map((v, i) => Math.round(a * v + (1 - a) * b[i]!));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function alpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
