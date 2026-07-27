import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation — the "soft depth" redesign move (2026-07-23). The app stays
 * strictly monochrome ink-on-warm-paper; the ONLY new expressive tool is a
 * single, restrained shadow so the surfaces that matter (paywall plans,
 * onboarding cards, the session receipt) lift off the page and read as premium
 * without a drop of color. Everything small keeps its 1px hairline.
 *
 * The shadow is WARM and low-contrast — cast in the ink's own family (`#20221A`)
 * at a whisper of opacity — so on `#F4F5EF` paper it looks like real diffused
 * light, never a grey box. Two levels only:
 *   `card`   — resting cards, list rows that want to float a little.
 *   `raised` — the hero surfaces (selected plan, welcome specimen, receipt) and
 *              the primary CTA; a longer, softer cast.
 *
 * Android has no soft-shadow control, so it falls back to `elevation` (a hard
 * grey); we keep it minimal there. Spread as `...shadow.card` into a style.
 */

/** The ink-family shadow color — a warm near-black so the cast stays warm. */
const SHADOW_INK = '#20221A';

type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const ios = (opacity: number, radius: number, y: number): Shadow => ({
  shadowColor: SHADOW_INK,
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

export const shadow = {
  /** Resting cards — a gentle 4pt lift. */
  card: (Platform.select({
    ios: ios(0.05, 12, 4),
    android: { elevation: 1, shadowColor: SHADOW_INK },
    default: {},
  }) ?? {}) as Shadow,
  /** Hero surfaces + the primary CTA — a longer, softer 8pt cast. */
  raised: (Platform.select({
    ios: ios(0.08, 22, 8),
    android: { elevation: 3, shadowColor: SHADOW_INK },
    default: {},
  }) ?? {}) as Shadow,
} as const;

export type ShadowToken = keyof typeof shadow;
