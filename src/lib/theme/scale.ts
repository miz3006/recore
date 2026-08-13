import { Dimensions, PixelRatio } from 'react-native';

/**
 * Responsive sizing (task §1). ONE helper, ONE baseline: every type token is
 * derived from this so text stays proportional on an iPhone SE and a Pro Max
 * instead of being hardcoded per component.
 */

/** iPhone 14/15 logical width — the design baseline. */
const BASELINE_WIDTH = 390;

/** Use the shortest side so a rotation can't balloon the scale. */
const { width, height } = Dimensions.get('window');
const shortestSide = Math.min(width, height);

/**
 * Scale `size` by how far this device is from the 390pt baseline, DAMPED by
 * `factor` (default 0.5) so small screens aren't cramped and large screens
 * aren't ballooned. Snapped to the device pixel grid for crisp rendering.
 */
export function moderateScale(size: number, factor = 0.5): number {
  const ratio = shortestSide / BASELINE_WIDTH;
  const scaled = size + (size * ratio - size) * factor;
  return PixelRatio.roundToNearestPixel(scaled);
}

/**
 * Upper bound on the OS Dynamic Type multiplier. Pass as `maxFontSizeMultiplier`
 * on every scalable Text.
 *
 * **Raised from 1.3 to 1.5 on 9 August 2026 (owner ask: readable at low
 * vision).** 1.3 was never a considered accessibility limit — it was the point
 * where the layout broke, because the app hardcoded line heights that could not
 * grow with their glyphs. That is fixed at the source now (`lineFor` below, used
 * by every type token and every literal line height), so the clamp could move to
 * where the reader is actually served. Someone running iOS at 235% still does
 * not get 235% here; going further needs the fixed-geometry surfaces
 * (calendar cells, the note gutter) rebuilt, not just a bigger number.
 */
export const MAX_FONT_SCALE = 1.5;

/**
 * The clamp for text locked inside GEOMETRY that cannot grow with it — a day
 * number in a calendar circle, initials in an avatar, a reading pinned to a
 * note line. Growing those crops the glyph instead of helping, so they stop
 * one step below the app clamp. Everything else uses `MAX_FONT_SCALE`.
 */
export const FIXED_FONT_SCALE = 1.2;

/**
 * The user's OS font scale, clamped to MAX_FONT_SCALE. RN scales a Text's
 * fontSize by this automatically; we reuse it to scale explicit line heights by
 * the SAME factor so the glyph and its line box grow together.
 */
export const osFontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);

/**
 * A line height for `size`, grown by the reader's own text setting.
 *
 * RN scales a Text's `fontSize` by the OS font scale but leaves an explicit
 * `lineHeight` exactly where it was written — so a hardcoded `lineHeight: 22`
 * under a 17pt font is fine at 1× and clips its own descenders at 1.3×. THIS is
 * what capped the app at 1.3. Every line height in the app goes through here
 * instead, so the line box and the glyph grow together.
 *
 * Read once at module load, like `osFontScale`: a text-size change mid-session
 * lands fully after the next launch.
 */
export function lineFor(size: number, factor = 0.5): number {
  return PixelRatio.roundToNearestPixel(moderateScale(size, factor) * osFontScale);
}
