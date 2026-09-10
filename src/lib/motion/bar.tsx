import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { push, REDUCED_FADE_MS } from './springs';

/**
 * A BAR THAT FILLS ON A SPRING — the progress rail on every question screen,
 * and the thin bar on screen 16.
 *
 * It rides `push`, the same spring as the screen transition, because §3 asks
 * for exactly that: "Same spring, same frame as the transition, so bar and
 * screen read as one gesture." The bar is not measuring elapsed time, it is
 * reporting where you are, and it should arrive with the screen it describes.
 *
 * The fill is a scaleX on a full-width child rather than an animated `width`,
 * so it runs on the UI thread and never triggers layout. `transformOrigin` is
 * set on the fill so it grows from the left edge.
 *
 * COLOURS ARE PROPS, NOT LOOKUPS. Nothing in this file calls the theme, and
 * nothing inside `useAnimatedStyle` calls anything at all — a helper invoked
 * inside a worklet is a runtime crash, not a type error.
 */
export function SpringBar({
  /** 0…1. Values outside are clamped by the caller, not here. */
  progress,
  height = 4,
  trackColor,
  fillColor,
  style,
  accessibilityLabel,
}: {
  progress: number;
  height?: number;
  trackColor: string;
  fillColor: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const filled = useSharedValue(progress);

  useEffect(() => {
    filled.value = reduced
      ? withTiming(progress, { duration: REDUCED_FADE_MS })
      : withSpring(progress, push);
  }, [filled, progress, reduced]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(filled.value, 0.0001) }] }));

  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }, style]}>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2, backgroundColor: fillColor },
          fill,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { ...StyleSheet.absoluteFill, transformOrigin: 'left center' },
});
