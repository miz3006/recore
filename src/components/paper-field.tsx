import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {
  PAPER_FIELD_DRIFT_PX,
  PAPER_FIELD_LOCATIONS,
  PAPER_FIELD_STOPS,
  paperFieldMotion,
} from '@/lib/paper-field';

/**
 * The Today canvas, drawn as a surface rather than as a flat fill (owner's spec
 * §C, 13 Aug 2026; white since 17 Aug 2026).
 *
 * A gradient of three near-white tones, a couple of units apart, drifting
 * across the page over forty-two seconds. At any instant it is
 * indistinguishable from the canvas colour; over a minute it is the difference
 * between a screen and a sheet of paper. If it is ever NOTICED as a gradient,
 * the values in `lib/paper-field.ts` are wrong — that file, not this one, is
 * where to change them, and its tests say what it may not become.
 *
 * ## How it is drawn
 *
 * The gradient is a single sheet OVERSCANNED past every edge of the screen and
 * then translated. Nothing fades, nothing re-renders, nothing changes colour —
 * the only animated properties are two transforms on the UI thread, which is
 * also why the field costs nothing while a person is typing a workout on top of
 * it. The overscan is twice the travel, so no edge of the sheet can ever come
 * into view.
 *
 * With Reduce Motion on the sheet is mounted and never animated: the same
 * gradient, standing still.
 *
 * It renders BEHIND everything and takes no touches.
 */
export function PaperField() {
  const reduceMotion = useReducedMotion();
  const motion = paperFieldMotion(reduceMotion);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!motion.animated) return;
    drift.value = withRepeat(
      withTiming(1, {
        duration: motion.cycleMs / 2,
        // Sine in and out: no visible start, no visible stop, no corner at the
        // turn. A linear drift would tick over at each end of the cycle.
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motion.animated, motion.cycleMs]);

  const sheet = useAnimatedStyle(() => {
    // −1…1 from the 0…1 clock, so the field passes through its rest position
    // rather than starting at one extreme.
    const t = drift.value * 2 - 1;
    return {
      transform: [
        { translateX: t * motion.driftPx * 0.6 },
        { translateY: -t * motion.driftPx },
      ],
    };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      <Animated.View style={[styles.sheet, sheet]}>
        <LinearGradient
          colors={PAPER_FIELD_STOPS}
          locations={PAPER_FIELD_LOCATIONS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const OVERSCAN = PAPER_FIELD_DRIFT_PX * 2;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: -OVERSCAN,
    left: -OVERSCAN,
    right: -OVERSCAN,
    bottom: -OVERSCAN,
  },
});
