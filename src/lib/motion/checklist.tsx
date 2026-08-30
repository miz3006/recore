import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tap } from '@/lib/haptics';

import { arrive, REDUCED_FADE_MS, tick } from './springs';

/**
 * ONE ROW OF WORK REPORTING ITSELF FINISHED — screen 16 and nowhere else.
 *
 * §3, "Screen 16": "Checklist rows on a stagger, each checkmark scaling in with
 * a light haptic. 2.5–3.5s total. Do not make it faster — this is where
 * perceived effort is manufactured."
 *
 * The row itself arrives immediately with the rest of the screen; the CHECK is
 * what is delayed. That is the difference between a list that loads and a list
 * being worked through: you can see all the work up front, and then you watch
 * it get done.
 *
 * The haptic is fired from the spring's own callback rather than from a
 * `setTimeout`, so the tick lands on the frame the check appears on and stays
 * in sync if the JS thread stalls.
 *
 * REDUCE MOTION: the check cross-fades in at the same moment, with the same
 * haptic. The choreography survives; only the scale is dropped.
 */
export function ChecklistRow({
  label,
  /** Milliseconds from mount until this row's check lands. */
  delay,
  checkStyle: checkContainerStyle,
  labelStyle,
  doneLabelStyle,
  style,
  children,
}: {
  label: string;
  delay: number;
  /** The check's own box — size, fill, radius. Drawn by the caller. */
  checkStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  /** Applied on top of `labelStyle` once the row is done. */
  doneLabelStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  /** The check mark glyph, drawn by the caller so this file owns no icons. */
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const done = useSharedValue(0);
  const labelLift = useSharedValue(0);

  useEffect(() => {
    // `runOnJS` is called from inside the animation's own completion callback,
    // which runs on the UI thread on the frame the check lands. A `setTimeout`
    // would drift away from it the moment the JS thread is busy — and on this
    // screen the JS thread is busy, because four of these fire in three
    // seconds while the percentage counts.
    done.value = withDelay(
      delay,
      reduced
        ? withTiming(1, { duration: REDUCED_FADE_MS }, (finished) => {
            'worklet';
            if (finished) runOnJS(tap)();
          })
        : withSpring(1, tick, (finished) => {
            'worklet';
            if (finished) runOnJS(tap)();
          }),
    );
    labelLift.value = withDelay(delay, withSpring(1, arrive));
  }, [delay, done, labelLift, reduced]);

  const checkAnimated = useAnimatedStyle(() => ({
    opacity: done.value,
    transform: [{ scale: reduced ? 1 : 0.4 + done.value * 0.6 }],
  }));
  // The label does not move; it firms up. Going from secondary to ink weight
  // by opacity keeps the row's height and baseline fixed while it happens.
  const labelAnimated = useAnimatedStyle(() => ({ opacity: 0.55 + labelLift.value * 0.45 }));

  return (
    <View style={[styles.row, style]}>
      <Animated.Text
        style={[labelStyle, doneLabelStyle, labelAnimated]}
        numberOfLines={2}>
        {label}
      </Animated.Text>
      <Animated.View style={[styles.check, checkContainerStyle, checkAnimated]}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: { alignItems: 'center', justifyContent: 'center' },
});

/** A row's schedule, held as data by the screen that owns the list. */
export interface ChecklistStep {
  label: string;
  delay: number;
}
