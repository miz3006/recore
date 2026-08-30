import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { selection, success, tap } from '@/lib/haptics';
import { pop, press, select } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { Check } from './Check';
import { v2color } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = moderateScale(168);
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** How long the finger has to stay down. Long enough to be a decision, short
 * enough that nobody lets go thinking it is broken. */
const HOLD_MS = 1500;

/**
 * HOLD TO COMMIT — screen 15.
 *
 * §2: 'Hold-to-commit: "I\'ll log every session for the next 4 weeks."' A tap
 * is a reflex and a hold is a decision; the whole point of the screen is that
 * it costs a second and a half of deliberate attention.
 *
 * THE RING'S FILL IS LINEAR, and that is the second and last exception to §3's
 * "springs throughout" (the first is the rotating ring on screen 16). The arc
 * is a readout of elapsed hold time under a finger that is still down —
 * easing it would mean the ring reports a different amount of time than has
 * passed, which for a commitment is precisely the wrong thing to fake. Letting
 * GO is a spring, because that is the ring recoiling rather than reporting.
 *
 * The completion haptic fires from the animation's own callback, so it lands on
 * the frame the ring closes on even if JS is busy.
 *
 * REDUCE MOTION: the ring still fills — it is a progress readout, not
 * decoration, and removing it would leave a person holding a button with no
 * feedback at all. What is dropped is the scale on the disc.
 */
export function HoldToCommit({
  label,
  done,
  onDone,
}: {
  label: string;
  done: boolean;
  onDone: () => void;
}) {
  const reduced = useReducedMotion();
  const held = useSharedValue(done ? 1 : 0);
  const discScale = useSharedValue(1);
  const settled = useRef(done);

  useEffect(() => {
    settled.current = done;
    if (done) held.value = withSpring(1, select);
  }, [done, held]);

  const complete = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    success();
    onDone();
  }, [onDone]);

  const onPressIn = useCallback(() => {
    if (settled.current) return;
    selection();
    if (!reduced) discScale.value = withSpring(0.97, press);
    held.value = withTiming(
      1,
      // Remaining time, so a re-press after a partial hold does not restart the
      // clock at full length.
      { duration: HOLD_MS * (1 - held.value), easing: Easing.linear },
      (finished) => {
        'worklet';
        if (finished) runOnJS(complete)();
      },
    );
  }, [complete, discScale, held, reduced]);

  const onPressOut = useCallback(() => {
    if (!reduced) discScale.value = withSpring(1, press);
    if (settled.current) return;
    tap();
    held.value = withSpring(0, pop);
  }, [discScale, held, reduced]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - held.value),
  }));
  const disc = useAnimatedStyle(() => ({ transform: [{ scale: discScale.value }] }));
  // The check belongs to the COMPLETED state, not to the fill: a tick that
  // fades up while the ring is still travelling would promise the commitment
  // before it was made.
  const checkStyle = useAnimatedStyle(() => ({
    opacity: done ? held.value : 0,
    transform: [{ scale: reduced || !done ? 1 : 0.6 + held.value * 0.4 }],
  }));

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={done}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={done ? 'Committed' : 'Hold until the circle closes'}
        accessibilityState={{ selected: done }}
        testID="v2-hold">
        <Animated.View style={[styles.disc, disc]}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={v2color.track}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={v2color.blue}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              // Start the arc at twelve o'clock rather than at three.
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              animatedProps={arc}
            />
          </Svg>
          <Animated.View style={[styles.check, checkStyle]}>
            <Check size={moderateScale(34)} color={v2color.blue} strokeWidth={3} />
          </Animated.View>
          {!done ? (
            <Text style={styles.holdLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Hold
            </Text>
          ) : null}
        </Animated.View>
      </Pressable>
      <Text style={styles.pledge} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xxl },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: v2color.surface,
  },
  check: { position: 'absolute' },
  holdLabel: { ...type.headline, color: v2color.inkSecondary },
  pledge: {
    ...type.lede,
    color: v2color.ink,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
