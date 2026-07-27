// The §6 design system. New work reads colour through `useTheme()`/`makeStyles`
// and every other value straight off a token — nothing new reads `color`/`ink`.
export {
  alpha,
  dark,
  light,
  paletteFor,
  PALETTES,
  resolveScheme,
  type ColorScheme,
  type ColorToken,
  type Palette,
  type SystemScheme,
} from './color';
export { shadowsFor, type Elevation, type Shadow, type ShadowToken } from './elevation';
export { FONT_ASSETS, mono, sans, useAppFonts } from './fonts';
export { makeStyles } from './make-styles';
export { easing, projectDecay, rubberband, spring, stagger, timing } from './motion';
export { moderateScale, MAX_FONT_SCALE, osFontScale } from './scale';
export { concentric, radius, type RadiusToken } from './shape';
export {
  CONTROL_HEIGHT,
  HIT,
  ROUND_BUTTON,
  hairline,
  space,
  spacing,
  type SpaceStep,
  type SpacingToken,
} from './space';
export { THEMES, themeFor, type Theme } from './theme';
export { eyebrow, fonts, tag, type, type TypeToken } from './type';
export {
  getColorScheme,
  setColorScheme,
  useColorSchemePreference,
  useTheme,
} from './use-theme';

