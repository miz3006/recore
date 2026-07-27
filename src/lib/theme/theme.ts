import { dark, light, resolveScheme, type ColorScheme, type Palette, type SystemScheme } from './color';
import { shadowsFor, type Elevation } from './elevation';

/**
 * The resolved theme — a palette plus the things that have to change *with* it.
 *
 * §6.3's palettes are pure data and stay that way (`color.ts` imports nothing,
 * so the contrast gate can read it under plain `node`). But elevation is not
 * pure data: §6.8's shadows invert between themes, and a component asking for
 * "the card shadow" has no business knowing which theme it is in — that is the
 * same argument that makes the palettes carry identical keys.
 *
 * So a component still writes `t.canvas`, and now also writes `t.shadow.card`,
 * and never branches. `scheme` is exposed for the rare consumer that genuinely
 * needs to know (a native component that takes a `'light' | 'dark'` prop, a blur
 * tint) — needing it for a *colour* is a bug.
 *
 * There are exactly two of these objects and they are module constants, so the
 * `makeStyles` cache keyed on their identity can never grow.
 */
export type Theme = Palette & {
  readonly scheme: 'light' | 'dark';
  readonly shadow: Elevation;
};

export const THEMES: Record<'light' | 'dark', Theme> = {
  light: { ...light, scheme: 'light', shadow: shadowsFor('light') },
  dark: { ...dark, scheme: 'dark', shadow: shadowsFor('dark') },
};

/** Resolve a preference against the device, straight to the theme. */
export function themeFor(preference: ColorScheme, system: SystemScheme): Theme {
  return THEMES[resolveScheme(preference, system)];
}
