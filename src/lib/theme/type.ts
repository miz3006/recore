import { type TextStyle } from 'react-native';

import { lineFor, moderateScale } from './scale';

/**
 * Type SIZES (CLAUDE.md §4) — the redesign leans on type, not color, to feel
 * premium. A clear scale with intentional optical tracking baked into the
 * tokens: display sizes tighten (negative letterSpacing reads as
 * confident/expensive), body loosens a hair for calm reading.
 *
 * **FAMILIES LIVE IN `typography.ts`, NOT HERE** (12 Aug 2026). This file owns
 * how BIG text is; that file owns what it is SET IN — the `sans` / `reading`
 * split, and the one switch that changes the face of every number in the app.
 * `fonts`, `readingText` and `eyebrow` are re-exported below so the rest of the
 * codebase keeps one import site (`@/lib/theme`).
 *
 * Sizes are NOT hardcoded per screen: every token runs through `moderateScale`
 * so type is proportional from an iPhone SE to a Pro Max. Screens derive from
 * these tokens; a new size gets added here, never inlined (see
 * [[recore-responsive-type]]).
 */
export {
  eyebrow,
  fonts,
  loadReadingFont,
  readingStyle,
  readingText,
  roundedFaceAvailable,
  type ReadingFace,
} from './typography';

/** Weight ladder — named so screens speak in intent, not magic strings. */
export const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const type = {
  /** The marketing hero — the onboarding welcome + paywall headline. One notch
   * above `display`, tracked tight so it reads confident and expensive. */
  displayLarge: { fontSize: moderateScale(44), lineHeight: lineFor(47), fontWeight: '800', letterSpacing: -1.4 },
  /** The single biggest statement on a screen — onboarding heroes, the pitch. */
  display: { fontSize: moderateScale(38), lineHeight: lineFor(42), fontWeight: '700', letterSpacing: -1.1 },
  largeTitle: { fontSize: moderateScale(34), lineHeight: lineFor(40), fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: moderateScale(27), lineHeight: lineFor(32), fontWeight: '700', letterSpacing: -0.6 },
  /** Step titles, section heads — one notch under `title`. */
  title2: { fontSize: moderateScale(22), lineHeight: lineFor(27), fontWeight: '700', letterSpacing: -0.5 },
  /** The illustrated-onboarding question — bold like every other title (owner,
   * 29 Jul, after the Mobbin pass: Tonal/Strava/WHOOP all carry the question at
   * full weight; a light question over art read as a caption, not an ask). */
  question: { fontSize: moderateScale(28), lineHeight: lineFor(33), fontWeight: '700', letterSpacing: -0.6 },
  headline: { fontSize: moderateScale(17), lineHeight: lineFor(22), fontWeight: '600', letterSpacing: -0.3 },
  /** The brief's opening sentence (product-direction §9) — one notch over
   * body, so the paragraph leads like an article, not a form. */
  lede: { fontSize: moderateScale(19), lineHeight: lineFor(26), fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: moderateScale(16), lineHeight: lineFor(24), fontWeight: '400', letterSpacing: -0.2 },
  subhead: { fontSize: moderateScale(15), lineHeight: lineFor(21), fontWeight: '400', letterSpacing: -0.1 }, // secondary / grey
  caption: { fontSize: moderateScale(13), lineHeight: lineFor(18), fontWeight: '400' },
  footnote: { fontSize: moderateScale(11.5), lineHeight: lineFor(16), fontWeight: '400' },
  bigNumber: { fontSize: moderateScale(44), lineHeight: lineFor(48), fontWeight: '700', letterSpacing: -0.5 }, // 175 cm, 70.0 kg
  /** Stat-tile numerals (Progress hub, insight header). Always tabular-nums. */
  statNumber: { fontSize: moderateScale(32), lineHeight: lineFor(36), fontWeight: '700', letterSpacing: -0.4 },
  /** The one hero numeral per screen (receipt total). Always tabular-nums. */
  heroNumber: { fontSize: moderateScale(48), lineHeight: lineFor(52), fontWeight: '700', letterSpacing: -0.6 },
} as const satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;
