import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BLUE, CARD_RADIUS, INK_CARD, INK_TRACK } from './tokens';

/**
 * The flow's switch (owner's restyle, 12 Aug 2026): an iOS-shaped control that
 * tints Recore blue, with a small spring overshoot on the thumb so the throw
 * feels like a real switch rather than a state change.
 *
 * It is written rather than imported because React Native's `Switch` animates
 * on its own schedule and cannot carry a spring — and because the tint has to
 * be the flow's blue, not the platform green.
 *
 * The overshoot is CLAMPED to the track's own padding: a thumb that sprang past
 * the edge would either poke outside the control or be clipped in half by it.
 */

/** A hair looser than `SPRING.press` — this is the one place a small overshoot
 * is the point. */
const THROW: WithSpringConfig = { mass: 0.5, damping: 14, stiffness: 320 };

const TRACK_W = moderateScale(51);
const TRACK_H = moderateScale(31);
const PAD = 2;
const THUMB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - THUMB - PAD * 2;
/** ≈2 pt of overshoot — exactly the room the track's padding leaves. */
const OVERSHOOT = 2 / TRAVEL;

export function Toggle({
  value,
  onValueChange,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const target = value ? 1 : 0;
    p.value = reduce ? target : withSpring(target, THROW);
  }, [value, reduce, p]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [INK_TRACK, BLUE]),
  }));
  const thumbStyle = useAnimatedStyle(() => {
    const clamped = Math.max(-OVERSHOOT, Math.min(1 + OVERSHOOT, p.value));
    return { transform: [{ translateX: clamped * TRAVEL }] };
  });

  return (
    <PressableScale
      onPress={() => onValueChange(!value)}
      activeScale={0.96}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      style={styles.hit}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </PressableScale>
  );
}

/**
 * A switch on its own soft card, with the answer's own words beside it — the
 * shape the notifications step wears. The label is whichever of the step's two
 * option labels currently applies, so the row always states the answer it will
 * store rather than describing the control.
 */
export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    padding: spacing.xs,
    margin: -spacing.xs,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    padding: PAD,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    shadowColor: '#20221A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
  rowLabel: {
    ...type.headline,
    color: color.textPrimary,
    flexShrink: 1,
  },
});
