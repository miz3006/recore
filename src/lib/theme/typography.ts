import { Platform, type TextStyle } from 'react-native';

import { lineFor, moderateScale } from './scale';

/**
 * TYPOGRAPHY TOKENS — the two families every surface in Recore is allowed to
 * speak in, and the one switch that decides what a number looks like.
 *
 * ## The two voices
 *
 * · **`sans`** — SF Pro, the platform default. Prose, labels, headers, buttons:
 *   everything the app SAYS.
 * · **`reading`** — every numeric READING the record contains: set tables,
 *   prescriptions, kg totals, deltas, the dated comparisons, the eyebrow labels
 *   that title a block of them. Everything the app REPORTS.
 *
 * The split is not decoration. A reading is a fact read back off the athlete's
 * own record, and it is held to a different standard than a sentence: it lines
 * up in columns, it never re-flows under a changing digit, and it looks the same
 * wherever the same number appears. That is why `readingText` carries
 * `tabular-nums` and why nothing outside this file is allowed to name a font.
 *
 * ## Changing what a reading looks like — the one line
 *
 * `READING_FACE` below. Flip it, and every number in the app changes family at
 * once; nothing else in the codebase mentions a font name.
 *
 *     const READING_FACE: ReadingFace = 'sans';      // ← today: one voice
 *     const READING_FACE: ReadingFace = 'mono';      // ← the ledger look
 *     const READING_FACE: ReadingFace = 'rounded';   // ← SF Pro Rounded
 *
 * **The columns do not depend on the family.** What holds a set table in line
 * is `tabular-nums` — every digit advancing the same width — and `readingStyle`
 * applies it whatever the face. That is why moving to the system font costs no
 * alignment: SF Pro has tabular figures, it just does not use them by default.
 *
 * ## Before 'rounded' will work (it is NOT wired yet — 12 Aug 2026)
 *
 * The SF Pro Rounded OTFs are **not in this repository**: `assets/fonts/` does
 * not exist and no `.otf`/`.ttf` file is checked in anywhere. iOS ships the
 * rounded face as a system design, but UIKit only exposes it through
 * `systemFont(ofSize:design:.rounded)` — React Native's `fontFamily` resolves
 * by PostScript name, so it CANNOT reach it. The face has to be bundled.
 *
 * To finish the job:
 *
 *  1. Put the four OTFs in `assets/fonts/`, named exactly:
 *     `SF-Pro-Rounded-Regular.otf` · `-Medium.otf` · `-Semibold.otf` · `-Bold.otf`
 *  2. Uncomment the `require` block in `ROUNDED_FONT_ASSETS` below.
 *  3. Flip `READING_FACE` to `'rounded'`.
 *
 * Step 2 is deliberately not written against files that do not exist: a
 * `require` of a missing asset fails the Metro bundle outright, so the app
 * would not start. `loadReadingFont()` is already called from the root layout
 * and is a no-op until the assets are there.
 */

/**
 * Which face the app's numbers wear. See the block comment above.
 *
 * · `'sans'` — the SAME face as the prose (owner, 12 Aug 2026). One voice on
 *   the screen; the numbers are still held in columns by `tabular-nums`, which
 *   is what alignment actually depends on — the monospace was never doing that
 *   job on its own.
 * · `'mono'` — SF Mono. Every screenshot and design decision before 12 Aug.
 * · `'rounded'` — SF Pro Rounded, once the OTFs are bundled.
 */
export type ReadingFace = 'sans' | 'mono' | 'rounded';
const READING_FACE: ReadingFace = 'sans';

/**
 * The mono family, kept registered and reachable whatever `READING_FACE` says —
 * it is the face every screenshot, spec and design decision to date was made
 * against, so flipping back must never require finding it again.
 */
const MONO_FAMILY = Platform.select({
  ios: 'ui-monospace',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

/**
 * PostScript names of the bundled rounded faces. They only resolve once the
 * OTFs are registered by `loadReadingFont()`; until then a Text asking for one
 * silently falls back to the system font, which is why `READING_FACE` stays on
 * `'mono'` rather than pointing at a name that is not there yet.
 */
const ROUNDED_REGULAR = 'SFProRounded-Regular';
const ROUNDED_MEDIUM = 'SFProRounded-Medium';
const ROUNDED_SEMIBOLD = 'SFProRounded-Semibold';
const ROUNDED_BOLD = 'SFProRounded-Bold';

/**
 * The expo-font asset map. EMPTY until the OTFs land — see step 2 above.
 *
 * // [SF Pro Rounded] Uncomment together with dropping the four files in:
 * // 'SFProRounded-Regular': require('../../../assets/fonts/SF-Pro-Rounded-Regular.otf'),
 * // 'SFProRounded-Medium': require('../../../assets/fonts/SF-Pro-Rounded-Medium.otf'),
 * // 'SFProRounded-Semibold': require('../../../assets/fonts/SF-Pro-Rounded-Semibold.otf'),
 * // 'SFProRounded-Bold': require('../../../assets/fonts/SF-Pro-Rounded-Bold.otf'),
 */
export const ROUNDED_FONT_ASSETS: Record<string, number> = {};

/** True once the rounded face is actually available to render with. */
export const roundedFaceAvailable = (): boolean =>
  Object.keys(ROUNDED_FONT_ASSETS).length > 0;

/**
 * The family a reading is set in, by weight.
 *
 * A bundled face has ONE weight per file, so `fontWeight` cannot synthesise the
 * others the way it can for a system font — the weight has to be chosen by
 * picking the right family name. `sans` keeps using `fontWeight` as before.
 */
function readingFamily(w: TextStyle['fontWeight']): TextStyle['fontFamily'] {
  // The system face, exactly as prose gets it: undefined, so the platform
  // picks SF Pro and every weight synthesises normally.
  if (READING_FACE === 'sans') return undefined;
  if (READING_FACE === 'mono' || !roundedFaceAvailable()) return MONO_FAMILY;
  switch (w) {
    case '700':
    case '800':
    case '900':
    case 'bold':
      return ROUNDED_BOLD;
    case '600':
      return ROUNDED_SEMIBOLD;
    case '500':
      return ROUNDED_MEDIUM;
    default:
      return ROUNDED_REGULAR;
  }
}

export const fonts = {
  /** SF Pro / system. Left undefined so RN uses the platform default. */
  sans: undefined as TextStyle['fontFamily'],
  /**
   * EVERY numeric reading in the app. Prefer the `readingText` /
   * `readingStyle()` helpers, which also carry `tabular-nums`; this bare family
   * exists for styles that set their own size and weight around it.
   */
  reading: readingFamily('500'),
  /**
   * The mono family by name, for the two places that mean MONOSPACE
   * specifically rather than "a reading" — the parser's own echo of raw text.
   * Everything else uses `reading`.
   */
  mono: MONO_FAMILY,
} as const;

/**
 * A reading at a given weight: the right family, tabular figures, always.
 *
 * `tabular-nums` is the point of the token. Proportional digits let a column of
 * weights wobble as the numbers change under it, and a set table that shifts
 * while you read it is the one thing a ledger may not do.
 */
export function readingStyle(fontWeight: TextStyle['fontWeight'] = '500'): TextStyle {
  return {
    fontFamily: readingFamily(fontWeight),
    // A BUNDLED face carries its weight in the file, so asking for one on top
    // of it double-bolds on iOS. The system and mono faces synthesise weights
    // normally and keep theirs.
    fontWeight: READING_FACE === 'rounded' && roundedFaceAvailable() ? undefined : fontWeight,
    fontVariant: ['tabular-nums'],
  };
}

/**
 * The default treatment for parsed set data (gutter, receipts, cards). Callers
 * override fontSize/lineHeight freely — the note surface matches the gutter
 * value to the note's own baseline that way.
 */
export const readingText = {
  ...readingStyle('500'),
  fontSize: moderateScale(15),
  letterSpacing: 0.2,
} as const satisfies TextStyle;

/**
 * The eyebrow / kicker — a small-caps label naming a block of readings ("RECORD
 * BOOK", "THIS WEEK", "STEP 03"). It belongs to the reading voice rather than
 * to prose: it titles the ledger and is set in the ledger's own face, so the
 * two never look like two different systems. Callers uppercase the string.
 */
export const eyebrow = {
  ...readingStyle('600'),
  fontSize: moderateScale(11),
  lineHeight: lineFor(14),
  letterSpacing: 1.6,
} as const satisfies TextStyle;

/**
 * Register the bundled reading face. Called once from the root layout, before
 * the splash screen is released, so no surface can render a number in the
 * fallback face and then reflow into the real one.
 *
 * A no-op while `ROUNDED_FONT_ASSETS` is empty, and it never throws: a font
 * that fails to load must degrade to the system face, not stop the app from
 * opening (§2 — nothing blocks a workout).
 */
export async function loadReadingFont(): Promise<void> {
  if (!roundedFaceAvailable()) return;
  try {
    const { loadAsync } = await import('expo-font');
    await loadAsync(ROUNDED_FONT_ASSETS);
  } catch {
    // Falls back to the system face. Nothing else to do and nothing worth
    // telling the athlete about.
  }
}
