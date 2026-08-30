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
 * grow with their glyphs. Line heights now go through `lineFor` below — used by
 * every type token and every literal — and the renderer grows them with the
 * glyph, so the clamp could move to where the reader is actually served.
 * Someone running iOS at 235% still does
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
 * The reader's own text setting, clamped to MAX_FONT_SCALE.
 *
 * **This belongs to VIEWS, not to text.** React Native already applies this
 * multiplier to every `fontSize` AND every explicit `lineHeight` (see `lineFor`
 * below) — text needs nothing from this constant. A plain `View` gets no such
 * treatment, so a box that has to reserve room for a line of text scales itself,
 * through `textRoom`.
 */
export const osFontScale = Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);

/**
 * A line height for `size`, in the same units the type tokens are written in.
 *
 * ## It does NOT apply the OS font scale, and applying it was a bug (23 Aug 2026)
 *
 * This function used to multiply by `osFontScale`, on the stated premise that
 * "RN scales a Text's fontSize by the OS font scale but leaves an explicit
 * lineHeight exactly where it was written". **That premise is false**, and the
 * proof is four lines of the renderer we ship
 * (`react-native/Libraries/Text/RCTTextAttributes.mm:138`):
 *
 *     if (!isnan(_lineHeight)) {
 *       CGFloat lineHeight = _lineHeight * self.effectiveFontSizeMultiplier;
 *
 * `effectiveFontSizeMultiplier` is the SAME multiplier the font size gets, down
 * to the `maxFontSizeMultiplier` clamp the Text carries (`:236`). So the line
 * height was scaled TWICE — once here, once by the renderer — and the ratio the
 * type scale is designed at moved with the square of the reader's setting.
 *
 * At the default text size the two agree and nothing shows, which is why it
 * shipped. Below it they do not: at iOS's xSmall (0.823) every line box in the
 * app came out 18 % tighter than its glyphs, so ascenders and the dot of an "i"
 * were cut off by the top of their own line — measured on the owner's device on
 * 23 Aug, on the onboarding hero (`question`, 30/34 → an effective 0.93 em
 * against the 0.95 a tittle needs). Above the default it fails the other way:
 * at the 1.5× clamp a body paragraph was set with half a line of extra leading
 * and every screen's arithmetic for "does this fit" was wrong.
 *
 * One multiplier, applied by the renderer, is the whole fix. The glyph and its
 * line box now grow together by construction, at every setting, and the clamp
 * that governs both is the `maxFontSizeMultiplier` on the Text itself — which
 * is also how a `FIXED_FONT_SCALE` surface finally clamps its line height to
 * 1.2 instead of to the app-wide 1.5.
 */
export function lineFor(size: number, factor = 0.5): number {
  return moderateScale(size, factor);
}

/**
 * Room in a VIEW for a line of text — a reserved eyebrow row, a chart's label
 * band, the gutter row that has to sit on the note's own baseline.
 *
 * Wrap the line height the text is set in: `minHeight: textRoom(lineFor(14))`.
 * The renderer grows the text by the reader's setting and no one grows the box,
 * so the box has to do it itself or the two drift apart — which is the same
 * mismatch `lineFor` used to have, only in the other direction.
 *
 * Read once at module load: a text-size change mid-session lands fully after
 * the next launch.
 */
export function textRoom(lineHeight: number): number {
  return PixelRatio.roundToNearestPixel(lineHeight * osFontScale);
}
