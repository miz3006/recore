import { Platform, type ViewStyle } from 'react-native';

/**
 * Elevation (CLAUDE.md §6.8). **Two shadows. That is the entire system.**
 *
 *   `card`   — session cards, tappable list rows, stat tiles.
 *   `raised` — paywall plan cards, the PR moment, sheets, the onboarding hero.
 *
 * Everything else is flat with a hairline: chips, tags, segmented controls,
 * table rows, anything inside a sheet scrim, anything under 44pt. "Calm core,
 * rich edges" — the reading surfaces stay flat and the interactive ones lift.
 *
 * **The shadow inverts with the theme, and it has to.** On warm paper a shadow
 * is diffused light and sits at 6% of the ink; on graphite there is no light to
 * diffuse, so the same shadow at the same opacity is literally invisible and the
 * cast has to be pure black at 35% to read as depth at all. A single set of
 * numbers cannot be right on both, which is why this is a function of the scheme
 * rather than a constant — and why the resolved pair rides on the theme object
 * (`t.shadow.card`) instead of being imported directly.
 *
 * Never coloured. A tinted shadow is the fastest way to make a monochrome app
 * look cheap, and §6.8 says both live in the ink family.
 */

/**
 * The cast. Warm near-black on paper (the ink's own family, so the shadow reads
 * warm rather than as a grey box); true black in the dark theme, because a
 * shadow must go darker than a `#0E1113` canvas and nothing in the palette does.
 */
const CAST = { light: '#14181A', dark: '#000000' } as const;

/** §6.8's two casts: `[y, blur, opacityLight, opacityDark]`. */
const SPEC = {
  card: { y: 2, blur: 8, opacity: { light: 0.06, dark: 0.35 }, android: 1 },
  raised: { y: 10, blur: 28, opacity: { light: 0.1, dark: 0.5 }, android: 3 },
} as const;

export type ShadowToken = keyof typeof SPEC;

export type Shadow = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export type Elevation = Readonly<Record<ShadowToken, Shadow>>;

function build(token: ShadowToken, scheme: 'light' | 'dark'): Shadow {
  const spec = SPEC[token];
  return (Platform.select({
    ios: {
      shadowColor: CAST[scheme],
      shadowOffset: { width: 0, height: spec.y },
      shadowOpacity: spec.opacity[scheme],
      shadowRadius: spec.blur,
    },
    // Android has no soft-shadow control; `elevation` is a hard grey ramp, so we
    // stay at the bottom of it rather than pretending to match iOS.
    android: { elevation: spec.android, shadowColor: CAST[scheme] },
    default: {},
  }) ?? {}) as Shadow;
}

/** The resolved pair for one scheme. Built twice, at module load, and frozen. */
export function shadowsFor(scheme: 'light' | 'dark'): Elevation {
  return { card: build('card', scheme), raised: build('raised', scheme) };
}
