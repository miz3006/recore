import { Platform, type TextStyle } from 'react-native';

import { moderateScale } from './scale';

/**
 * Typography (CLAUDE.md §4) — the redesign leans on type, not color, to feel
 * premium. Still SF Pro (the iOS system font: leave `fontFamily` undefined so
 * the platform default is used). What changed: a clearer scale with intentional
 * optical tracking baked into the tokens — display sizes tighten (negative
 * letterSpacing reads as confident/expensive), body loosens a hair for calm
 * reading — and one mono family reserved for numerals and the small-caps eyebrow
 * label, so every number in the app lines up like a ledger.
 *
 * Sizes are NOT hardcoded per screen: every token runs through `moderateScale`
 * so type is proportional from an iPhone SE to a Pro Max. Screens derive from
 * these tokens; a new size gets added here, never inlined (see
 * [[recore-responsive-type]]).
 */
export const fonts = {
  /** SF Pro / system. Leave undefined so RN uses the platform default. */
  sans: undefined as TextStyle['fontFamily'],
  /** SF Mono on iOS, platform mono elsewhere. Numerals + the eyebrow label. */
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }),
} as const;

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
  displayLarge: { fontSize: moderateScale(44), lineHeight: moderateScale(47), fontWeight: '800', letterSpacing: -1.4 },
  /** The single biggest statement on a screen — onboarding heroes, the pitch. */
  display: { fontSize: moderateScale(38), lineHeight: moderateScale(42), fontWeight: '700', letterSpacing: -1.1 },
  largeTitle: { fontSize: moderateScale(34), lineHeight: moderateScale(40), fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: moderateScale(27), lineHeight: moderateScale(32), fontWeight: '700', letterSpacing: -0.6 },
  /** Step titles, section heads — one notch under `title`. */
  title2: { fontSize: moderateScale(22), lineHeight: moderateScale(27), fontWeight: '700', letterSpacing: -0.5 },
  /** The illustrated-onboarding question — bold like every other title (owner,
   * 29 Jul, after the Mobbin pass: Tonal/Strava/WHOOP all carry the question at
   * full weight; a light question over art read as a caption, not an ask). */
  question: { fontSize: moderateScale(28), lineHeight: moderateScale(33), fontWeight: '700', letterSpacing: -0.6 },
  headline: { fontSize: moderateScale(17), lineHeight: moderateScale(22), fontWeight: '600', letterSpacing: -0.3 },
  /** The brief's opening sentence (product-direction §9) — one notch over
   * body, so the paragraph leads like an article, not a form. */
  lede: { fontSize: moderateScale(19), lineHeight: moderateScale(26), fontWeight: '600', letterSpacing: -0.4 },
  body: { fontSize: moderateScale(16), lineHeight: moderateScale(24), fontWeight: '400', letterSpacing: -0.2 },
  subhead: { fontSize: moderateScale(15), lineHeight: moderateScale(21), fontWeight: '400', letterSpacing: -0.1 }, // secondary / grey
  caption: { fontSize: moderateScale(13), lineHeight: moderateScale(18), fontWeight: '400' },
  footnote: { fontSize: moderateScale(11.5), lineHeight: moderateScale(16), fontWeight: '400' },
  bigNumber: { fontSize: moderateScale(44), lineHeight: moderateScale(48), fontWeight: '700', letterSpacing: -0.5 }, // 175 cm, 70.0 kg
  /** Stat-tile numerals (Progress hub, insight header). Always tabular-nums. */
  statNumber: { fontSize: moderateScale(32), lineHeight: moderateScale(36), fontWeight: '700', letterSpacing: -0.4 },
  /** The one hero numeral per screen (receipt total). Always tabular-nums. */
  heroNumber: { fontSize: moderateScale(48), lineHeight: moderateScale(52), fontWeight: '700', letterSpacing: -0.6 },
} as const satisfies Record<string, TextStyle>;

/**
 * The mono treatment for parsed set data (right gutter, receipts, cards).
 * Tabular so weights line up like a ledger. The note surface overrides
 * fontSize/lineHeight to the note's own so the gutter value shares its baseline.
 */
export const monoText = {
  fontFamily: fonts.mono,
  fontSize: moderateScale(15),
  fontWeight: '500',
  letterSpacing: 0.2,
  fontVariant: ['tabular-nums'],
} as const satisfies TextStyle;

/**
 * The eyebrow / kicker — a mono small-caps label that names a block ("RECORD
 * BOOK", "THIS WEEK", "STEP 03"). One shared treatment so section labels read
 * identically everywhere. Callers uppercase the string.
 */
export const eyebrow = {
  fontFamily: fonts.mono,
  fontSize: moderateScale(11),
  lineHeight: moderateScale(14),
  fontWeight: '600',
  letterSpacing: 1.6,
} as const satisfies TextStyle;

export type TypeToken = keyof typeof type;
