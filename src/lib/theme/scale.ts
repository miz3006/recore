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
 * **1.94 is `accessibilityLarge`, exactly.** CLAUDE.md §6.5 sets the ceiling by
 * name — *"Dynamic Type is clamped to xSmall … accessibilityLarge. Above that,
 * cards reflow to a vertical stack rather than shrinking"* — and §17 makes it a
 * release gate. React Native's own table (`RCTAccessibilityManager`, the source
 * of `PixelRatio.getFontScale()`) maps the iOS content-size categories to
 * multipliers: Large 1.0, xL 1.12, xxL 1.23, xxxL 1.35, accessibilityMedium
 * 1.64, **accessibilityLarge 1.94**, and on up to 3.12. So this constant is not
 * a taste call — it is the named category, read off the platform's own numbers.
 *
 * v2 clamped at 1.3, which stops one notch above xxxLarge and never reaches an
 * accessibility size at all: a user who had turned Dynamic Type up for a reason
 * got a cap instead of larger text. Raising it is the whole point of the §17
 * gate, and it is why §8.3's card has to reflow rather than shrink.
 */
export const MAX_FONT_SCALE = 1.94;

/**
 * The user's OS font scale, clamped to MAX_FONT_SCALE. RN scales a Text's
 * fontSize by this automatically; we reuse it to scale explicit line heights by
 * the SAME factor so the glyph and its line box grow together.
 */
export const osFontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
