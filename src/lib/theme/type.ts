import type { TextStyle } from 'react-native';

import { mono, sans } from './fonts';
import { moderateScale, osFontScale } from './scale';

/**
 * THE LADDER (CLAUDE.md §6.5). Thirteen rungs, two faces, and nothing in
 * between.
 *
 * **Words are humanist, numbers are machine.** The nine text rungs are SF Pro;
 * the four `data*` rungs are JetBrains Mono, tabular, and carry their own
 * `fontFamily` — so there is no way to set a load in the wrong face by
 * forgetting a prop. That division is not decoration: it is how §6.2's record
 * contract stays legible at a glance.
 *
 * Nothing here is hardcoded per screen. Every size runs through `moderateScale`
 * so type stays proportional from an SE to a Pro Max, and a new size is added
 * here or not at all (see [[recore-responsive-type]]).
 *
 * Two mechanics that are easy to skip and impossible to unsee afterwards:
 *
 * · **Line boxes grow with the glyph.** React Native scales `fontSize` by the
 *   OS Dynamic Type multiplier but leaves `lineHeight` exactly where you put it,
 *   so a fixed line height silently clamps text at large sizes — the glyphs grow
 *   and then collide. Every rung multiplies its line height by the same clamped
 *   scale the platform is applying to the size.
 *
 * · **Tracking is size-specific.** §6.5 states it in em, which is the only unit
 *   that survives scaling; it is resolved to points against the rung's own
 *   scaled size, so the display rung tightens hard (-0.02em) and `micro` opens
 *   up (+0.06em) and both stay right at every device width.
 */

/** Resolve one rung: §6.5's `size / lineHeight` plus its tracking in em. */
function rung(size: number, lineHeight: number, em = 0) {
  const fontSize = moderateScale(size);
  return {
    fontSize,
    lineHeight: Math.round(moderateScale(lineHeight) * osFontScale),
    letterSpacing: Number((fontSize * em * osFontScale).toFixed(2)),
  };
}

/**
 * The faces, for the rare place that composes its own treatment (the composer's
 * text input, a measuring mirror). Prefer a rung — it already carries the face.
 */
export const fonts = {
  /** SF Pro / system. Undefined is how RN spells "the platform default". */
  sans,
  /** JetBrains Mono at 500. The weight-specific families live in `./fonts`. */
  mono: mono.medium,
} as const;

export const type = {
  // ————————————————————————————————————————————————— words (SF Pro)
  /** Onboarding + paywall headlines only. Left-aligned and heavy, per §6.5. */
  display: { ...rung(40, 44, -0.02), fontWeight: '700' },
  title1: { ...rung(28, 34, -0.01), fontWeight: '700' },
  title2: { ...rung(22, 28), fontWeight: '600' },
  /** Card and sheet headers. */
  title3: { ...rung(17, 22), fontWeight: '600' },
  body: { ...rung(17, 24), fontWeight: '400' },
  /** Body at the same metrics, carrying emphasis — never a second size. */
  bodyEmph: { ...rung(17, 24), fontWeight: '600' },
  callout: { ...rung(15, 20), fontWeight: '400' },
  caption: { ...rung(13, 18), fontWeight: '500' },
  /**
   * The tag rung — `RECORDED`, `PR`, `WARM-UP`, section eyebrows. The only type
   * in the app that is set in capitals, which is why it is also the only rung
   * with positive tracking: capitals crowd at 11pt without it. Callers
   * uppercase the string; the token cannot do it for them.
   */
  micro: { ...rung(11, 14, 0.06), fontWeight: '600', textTransform: 'uppercase' },

  // ————————————————————————————————————— numbers (JetBrains Mono, tabular)
  // No `fontWeight` on any of these on purpose: the weight IS the family
  // (see `./fonts`), and asking a single-face family for a weight it does not
  // own is how you get a smeared synthetic bold instead of the real cut.
  /** One hero fact per screen, maximum. */
  dataXL: { ...rung(34, 38), fontFamily: mono.bold, fontVariant: ['tabular-nums'] },
  /** THE CARD VALUE — the number the whole composer exists to produce. */
  dataL: { ...rung(22, 26), fontFamily: mono.semibold, fontVariant: ['tabular-nums'] },
  /** Table cells, ledger rows. */
  dataM: { ...rung(17, 22), fontFamily: mono.medium, fontVariant: ['tabular-nums'] },
  /** Sublines and comparisons — the archival voice. */
  dataS: { ...rung(13, 18), fontFamily: mono.medium, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

/**
 * The section eyebrow — a mono small-caps label naming a block ("RECORD BOOK",
 * "THIS WEEK"). `micro`'s metrics in the data face, opened further because a
 * label that sits alone above a block needs to read as a rule, not a word.
 */
export const eyebrow = {
  ...type.micro,
  fontFamily: mono.semibold,
  fontWeight: undefined,
  letterSpacing: Number((type.micro.fontSize * 0.14).toFixed(2)),
} as const satisfies TextStyle;

/**
 * The record-contract TAG — `RECORDED`, `PLANNED`, `PR`. Mono because §6.3 says
 * so by name: *"a hairline capsule outlined in `ink` containing mono uppercase
 * PR"*. It is a shape, not a colour, and it has to survive every theme, every
 * colourblind profile, and every screenshot.
 */
export const tag = {
  ...type.micro,
  fontFamily: mono.semibold,
  fontWeight: undefined,
} as const satisfies TextStyle;

export type TypeToken = keyof typeof type;
