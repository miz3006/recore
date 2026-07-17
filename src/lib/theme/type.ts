import { Platform, type TextStyle } from 'react-native';

import { moderateScale } from './scale';

/**
 * Typography (CLAUDE.md §4).
 *
 * Everything is SF Pro (the iOS system font) — on RN this means leaving
 * fontFamily undefined so the platform default is used. The ONE exception is a
 * clean monospace used ONLY for parsed set data in the right gutter (weights
 * align like a table) — never for headings or buttons.
 *
 * Sizes are NOT hardcoded per screen: every token runs through `moderateScale`
 * (task §1) so type is proportional from an iPhone SE to a Pro Max. Screens
 * derive from these tokens; they never set ad-hoc pixel sizes.
 */
export const fonts = {
  /** SF Pro / system. Leave undefined so RN uses the platform default. */
  sans: undefined as TextStyle['fontFamily'],
  /** SF Mono on iOS, platform mono elsewhere. Parsed numbers only. */
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }),
} as const;

export const type = {
  largeTitle: { fontSize: moderateScale(34), lineHeight: moderateScale(41), fontWeight: '700' },
  title: { fontSize: moderateScale(28), lineHeight: moderateScale(34), fontWeight: '700' },
  headline: { fontSize: moderateScale(17), lineHeight: moderateScale(22), fontWeight: '600' },
  body: { fontSize: moderateScale(17), lineHeight: moderateScale(24), fontWeight: '400' },
  subhead: { fontSize: moderateScale(15), lineHeight: moderateScale(20), fontWeight: '400' }, // secondary / grey
  caption: { fontSize: moderateScale(13), lineHeight: moderateScale(18), fontWeight: '400' },
  bigNumber: { fontSize: moderateScale(44), lineHeight: moderateScale(50), fontWeight: '700' }, // 175 cm, 70.0 kg
  /** Stat-tile numerals (Progress hub, insight header). Always tabular-nums. */
  statNumber: { fontSize: moderateScale(34), lineHeight: moderateScale(40), fontWeight: '700' },
  /** The one hero numeral per screen (receipt total). Always tabular-nums. */
  heroNumber: { fontSize: moderateScale(48), lineHeight: moderateScale(54), fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

/**
 * The mono treatment for parsed set data in the right gutter. Tabular so weights
 * line up like a ledger. The note surface overrides fontSize/lineHeight to the
 * note's own so the gutter value shares its baseline (task §1).
 */
export const monoText = {
  fontFamily: fonts.mono,
  fontSize: moderateScale(15),
  fontWeight: '500',
  letterSpacing: 0.2,
  fontVariant: ['tabular-nums'],
} as const satisfies TextStyle;

export type TypeToken = keyof typeof type;
