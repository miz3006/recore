import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, shadow } from '@/lib/theme';

/**
 * One glass material for the whole app (owner, 28 July).
 *
 * This is the SECOND place Recore uses the system's Liquid Glass, and it
 * follows the first exactly: the tab bar is a real `UITabBarController` and
 * §4 sets **no tint** on it, because glass recolours itself against whatever
 * is behind it and offers no callback — a fixed hex goes illegible over some
 * content. The same rule applies here, so nothing below passes `tintColor`.
 *
 * WHERE IT DOES NOT EXIST — iOS 25 and earlier, Android, Expo Go — it falls
 * back to the material the rest of v6 is made of: a white `surface` on the warm
 * canvas, a hairline, and `shadow.card`. That is not a degraded glass; it is
 * the app's own material, and the layout is identical either way, so a screen
 * designed on one reads correctly on the other. The shadow is load-bearing in
 * the fallback: white on cream is 1.05:1 by tone, so without it the surface is
 * simply not there.
 *
 * It renders as an absolutely-positioned LAYER behind its parent's children,
 * so callers keep ordinary flex layout and just add `<GlassSurface radius={…} />`
 * as the first child of a `Pressable` or `View`.
 */
export const glassAvailable = isLiquidGlassAvailable();

export function GlassSurface({
  radius,
  style,
  /** `clear` is thinner and lets more through — for a surface over content. */
  variant = 'regular',
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  variant?: 'regular' | 'clear';
}) {
  if (glassAvailable) {
    return (
      <GlassView
        glassEffectStyle={variant}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, style]}
        pointerEvents="none"
      />
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.paper,
        { borderRadius: radius },
        shadow.card,
        style,
      ]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
});
