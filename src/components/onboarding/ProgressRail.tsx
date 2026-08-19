import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { EASE } from '@/lib/motion';

import { BLUE, INK_TRACK, RAIL_DELAY_MS, RAIL_MS } from './tokens';

/**
 * The onboarding progress bar: ONE continuous 4 pt track, blue fill on ink at
 * 10 %, fully rounded (owner's restyle, 12 Aug 2026 — it was a row of dashed
 * segments, one per screen, which read as a twenty-step countdown; a single
 * rising bar reads as ground covered).
 *
 * It still takes `total` / `completed` rather than a fraction, so the count
 * keeps deriving itself from the flow config and adding a screen still updates
 * the bar with no other edit.
 *
 * **The fill travels from wherever the bar stood on the previous screen.** Each
 * step is a fresh mount of a fresh route, so the component cannot see its own
 * past — `lastFraction` remembers it for the flow. That is what makes the bar
 * feel continuous across a push, and it means Back animates the bar DOWN
 * without a special case.
 *
 * ## The fill is TRANSLATED, not scaled (19 August 2026)
 *
 * The fill is a full-width bar that starts fully off to the left and slides
 * right into a clipped track. It used to be the same bar scaled on X from its
 * left edge, and scale was the wrong transform for this shape.
 *
 * A horizontal scale multiplies the geometry, INCLUDING the corner radius. The
 * bar is 4 pt tall with a 4 pt radius — semicircular caps — so at the first
 * step of a thirteen-step flow (`scaleX` ≈ 0.077) the leading cap's horizontal
 * radius becomes 0.3 pt: a pill squashed into a rectangle with a barely
 * rounded right edge, at exactly the moment it is smallest and most obviously
 * a shape. Translation moves the view without distorting it, so the leading cap
 * stays a true semicircle at every fraction, and the trailing end slides out
 * under the track's own `overflow: 'hidden'` and rounded corner, which is what
 * draws the left cap. Neither transform touches layout; only one of them keeps
 * the drawing.
 *
 * (The third option — animating `width` — is the one the app's old shared
 * `ProgressBar` used, and it is a layout pass for the fill and its siblings on
 * every frame. The recipe's sanctioned `width` animation is for an absolutely
 * positioned pill that has to keep its radius; here translation gets the radius
 * for free, so there is nothing to trade a layout pass for.)
 *
 * ## Timing
 *
 * `RAIL_MS` on the ease-out, delayed by `RAIL_DELAY_MS` — see `tokens.ts` for
 * why it is a curve rather than the spring it used to be, and why it waits for
 * the native push to land. Reduce Motion lands on the new value at once.
 */

/** Where the bar stood when the previous screen of this flow was rendered. */
let lastFraction = 0;

export function ProgressRail({
  total,
  completed,
  style,
}: {
  total: number;
  /** Segments earned; the step being viewed counts as reached. */
  completed: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const target = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
  // Re-entering the flow at the top starts the bar empty rather than sliding
  // backwards from a run that is already over.
  const from = completed === 0 ? 0 : lastFraction;
  const p = useSharedValue(reduce ? target : from);

  // Measured once, on layout — the track is `flex: 1` in the chrome row, so its
  // width is not known until it has been laid out, and it only changes on a
  // rotation or a window resize. Nothing here reads a size per frame.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  useEffect(() => {
    lastFraction = target;
    if (reduce) {
      p.set(target);
      return;
    }
    p.set(withDelay(RAIL_DELAY_MS, withTiming(target, { duration: RAIL_MS, easing: EASE.emphasized })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const fillStyle = useAnimatedStyle(() => ({
    // Fully left-of-track at 0, flush at 1.
    transform: [{ translateX: -(1 - p.get()) * width }],
    // Held back until the track has a width. Before layout the offset is
    // `(1 - p) * 0`, i.e. zero — which would draw the fill FLUSH, flashing a
    // completely full blue bar for the frame between mount and `onLayout`.
    opacity: width > 0 ? 1 : 0,
  }));

  return (
    <View
      style={[styles.track, style]}
      onLayout={onLayout}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: completed }}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const BAR_HEIGHT = 4;

const styles = StyleSheet.create({
  track: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT,
    // Clips the trailing end of the fill, and draws the left cap with its own
    // corner. Without it the fill would hang off the left of the chrome row.
    overflow: 'hidden',
    backgroundColor: INK_TRACK,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_HEIGHT,
    backgroundColor: BLUE,
  },
});
