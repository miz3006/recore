import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation — the "soft depth" redesign move (2026-07-23). The ONLY expressive
 * tool here is a single, restrained shadow so the surfaces that matter (paywall
 * plans, onboarding cards, the session receipt) lift off the page and read as
 * premium without a drop of color. Everything small keeps its 1px hairline.
 *
 * IT CARRIES LESS WEIGHT SINCE 18 AUG 2026 than it did the day before. When
 * `bg` and `surface` were both white, this shadow and the hairline WERE a
 * card's entire edge. Now the list screens sit on the grouped grey `#F2F2F7`
 * and the tone does that job the way iOS does it — so on a grouped screen this
 * is a small extra lift, not the thing keeping the card visible. On the white
 * document screens (Today, onboarding, sheets) the old rule still holds: a
 * surface with neither border nor shadow is invisible there.
 *
 * The shadow is low-contrast and cast in the ink's own family (`#20221A`) at a
 * whisper of opacity, so it reads as diffused light rather than as a grey box.
 * Two levels only:
 *   `card`   — resting cards, list rows that want to float a little.
 *   `raised` — the hero surfaces (selected plan, welcome specimen, receipt) and
 *              the primary CTA; a longer, softer cast.
 *
 * Android has no soft-shadow control, so it falls back to `elevation` (a hard
 * grey); we keep it minimal there. Spread as `...shadow.card` into a style.
 */

/** The ink-family shadow colour — the label near-black, so the cast belongs to
 * the same neutral family as the type (18 Aug 2026; it was warm `#20221A`,
 * left over from the paper canvas §4.2 retired). */
const SHADOW_INK = '#1C1C1E';

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
