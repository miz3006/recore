import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { selection } from '@/lib/haptics';
import { PressScale, pop, REDUCED_FADE_MS, select } from '@/lib/motion/index';
import { MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

import { v2color, v2glow, v2metrics, v2radius } from './tokens';

/** Precomputed OUTSIDE the worklet. A theme call inside `useAnimatedStyle` is a
 * runtime crash on the UI thread, not a type error. */
const FILL_OFF = v2color.disabled;
const FILL_ON = v2color.blue;

/**
 * THE CONTINUE BUTTON — and the flow's one reward.
 *
 * §3: "Disabled until a selection exists, then it animates alive — opacity plus
 * a small scale pop, with a `selection` haptic. Copy Cal AI exactly here. It
 * makes the CTA a reward rather than furniture."
 *
 * So the button never appears or disappears; it WAKES. The pill is the same
 * object in both states — Cal AI greys the fill and keeps the white label, and
 * the whole effect depends on that, because a button that faded in from nothing
 * would read as a new control rather than as a permission just granted.
 *
 * The pop fires only on the false→true EDGE, never on mount and never on a
 * re-render, so returning to a screen that is already answered shows a button
 * that was always awake. `wasEnabled` is a ref rather than state for exactly
 * that reason: it must not itself cause a render.
 *
 * REDUCE MOTION: the colour still changes (it is information), the haptic still
 * fires, the scale pop is dropped.
 */
export function ContinueButton({
  label = 'Continue',
  enabled,
  onPress,
  accessibilityHint,
}: {
  label?: string;
  enabled: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const reduced = useReducedMotion();
  const awake = useSharedValue(enabled ? 1 : 0);
  const popScale = useSharedValue(1);
  const wasEnabled = useRef(enabled);

  useEffect(() => {
    const justWokeUp = enabled && !wasEnabled.current;
    wasEnabled.current = enabled;

    awake.value = reduced
      ? withTiming(enabled ? 1 : 0, { duration: REDUCED_FADE_MS })
      : withSpring(enabled ? 1 : 0, select);

    if (!justWokeUp) return;
    selection();
    if (reduced) return;
    // Up and back on one spring each, so the return carries the overshoot's
    // velocity instead of restarting from rest.
    popScale.value = withSequence(withSpring(1.035, pop), withSpring(1, pop));
  }, [awake, enabled, popScale, reduced]);

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(awake.value, [0, 1], [FILL_OFF, FILL_ON]),
    transform: [{ scale: popScale.value }],
  }));

  // The glow belongs to an AWAKE primary CTA and to nothing else, so it is a
  // separate layer that fades with `awake` rather than a style on the pill.
  const glow = useAnimatedStyle(() => ({ opacity: awake.value }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, v2glow, glow]} pointerEvents="none" />
      <PressScale
        onPress={onPress}
        disabled={!enabled}
        haptic="impact"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !enabled }}
        style={styles.press}
        testID="v2-continue">
        <Animated.View style={[styles.pill, fill]}>
          {/* NO `numberOfLines`, AND THE PILL GROWS INSTEAD (9 Sep 2026).
              At Dynamic Type XXXL the label came out as "Cont…" — a primary
              CTA whose own word does not fit inside it, on a flow whose
              accessibility floor is not negotiable (CLAUDE.md §3). Clipping the
              label was the cheap half of the fix; the other half is that a
              button with a FIXED height cannot honour type scaling at all, so
              the pill is a `minHeight` now, exactly as recore-design asks for
              any box drawn around a label. "Continue anyway" is allowed to take
              two lines on a large-type phone and the pill is allowed to be
              taller — what is not allowed is a truncated verb. */}
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </Animated.View>
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  press: { width: '100%' },
  /** Fills the wrap, which is exactly the pill's box — so the glow tracks the
   * button's height instead of asserting a constant the pill no longer has. */
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: v2radius.button,
    backgroundColor: v2color.blue,
  },
  pill: {
    minHeight: v2metrics.ctaHeight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: v2radius.button,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.headline, color: v2color.onBlue, fontWeight: '600', textAlign: 'center' },
});
