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
 * Upper bound on the OS Dynamic Type multiplier (~1.3). Text is allowed to grow
 * for accessibility, but clamped here so large sizes don't break the layout
 * (task §1). Pass as `maxFontSizeMultiplier` on every scalable Text.
 */
export const MAX_FONT_SCALE = 1.3;

/**
 * The user's OS font scale, clamped to MAX_FONT_SCALE. RN scales a Text's
 * fontSize by this automatically; we reuse it to scale explicit line heights by
 * the SAME factor so the glyph and its line box grow together.
 */
export const osFontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
