import { Platform, type ViewStyle } from 'react-native';

import { color } from './color';

/**
 * Elevation — two neutral levels plus one glow, and on the warm canvas they are
 * load-bearing again (design skill §Spacing, radii, elevation; 20 Aug 2026).
 *
 * A white pill on `canvas` is **1.05:1 by tone**. Nothing about its fill makes
 * it visible: the shadow is what separates it from the page. That is the whole
 * structure of v6 — canvas (world) → ink text (the record) → white pills
 * (controls) — so every floating pill takes `shadow.card`, and a surface with
 * neither border nor shadow is simply not there.
 *
 * (This reverses the note of 18 Aug that the shadow "carries less weight" now
 * that list screens sit on grouped grey. There is no grouped grey; the tone step
 * that was doing the job is gone.)
 *
 * The cast is **warm ink `#2E2418`** — the canvas is paper again, and a neutral
 * near-black shadow on cream reads as a grey smudge rather than as light. Large
 * blur, low opacity, never a hard drop shadow.
 *
 *   `card`   — resting cards and every floating pill: the date pill, the summary
 *              pill, the input bar and its accessory circles.
 *   `raised` — sheets and hero surfaces; a longer, softer cast.
 *   `glow`   — **the only coloured shadow in the app**, and it belongs to the
 *              primary CTA alone. Brand blue at 28%, radius 20, y 8: the button
 *              sits in its own light instead of being outlined.
 *
 * Android has no soft-shadow control, so it falls back to `elevation` (a hard
 * grey); we keep it minimal there. Spread as `...shadow.card` into a style.
 */

/** The shadow's colour — warm ink, from the paper canvas's own family. It lived
 * here as a literal until the palette merge of 28 Aug 2026; it is `shadowCast`
 * in `color.ts` now, so the app has exactly one place a colour is named. */
const SHADOW_INK: string = color.shadowCast;

type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

const ios = (opacity: number, radius: number, y: number, hex = SHADOW_INK): Shadow => ({
  shadowColor: hex,
  shadowOffset: { width: 0, height: y },
  shadowOpacity: opacity,
  shadowRadius: radius,
});

export const shadow = {
  /** Resting cards and floating pills — a wide, gentle 4pt lift. */
  card: (Platform.select({
    ios: ios(0.05, 14, 4),
    android: { elevation: 1, shadowColor: SHADOW_INK },
    default: {},
  }) ?? {}) as Shadow,
  /** Sheets and hero surfaces — a longer, softer 10pt cast. */
  raised: (Platform.select({
    ios: ios(0.07, 28, 10),
    android: { elevation: 3, shadowColor: SHADOW_INK },
    default: {},
  }) ?? {}) as Shadow,
  /** THE PRIMARY CTA, and nothing else. The app's one coloured shadow. */
  glow: (Platform.select({
    ios: ios(0.28, 20, 8, color.brandGlow),
    android: { elevation: 4, shadowColor: color.brandGlow },
    default: {},
  }) ?? {}) as Shadow,
} as const;

export type ShadowToken = keyof typeof shadow;
