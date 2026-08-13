import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { SPRING } from '@/lib/motion';

import { BLUE, INK_TRACK } from './tokens';

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
 * **The fill SPRINGS from wherever the bar stood on the previous screen.** Each
 * step is a fresh mount of a fresh route, so the component cannot see its own
 * past — `lastFraction` remembers it for the flow. That is what makes the bar
 * feel continuous while the screen slides in underneath it, and it means Back
 * animates the bar DOWN without a special case.
 *
 * The fill is a full-width bar scaled on X from its left edge, never an
 * animated `width`: §4.3 forbids animating a layout property, and scaleX is the
 * same picture on the UI thread. Reduce Motion lands on the new value at once.
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

  useEffect(() => {
    lastFraction = target;
    if (reduce) {
      p.value = target;
      return;
    }
    p.value = withSpring(target, SPRING.snappy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));

  return (
    <View
      style={[styles.track, style]}
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
    backgroundColor: INK_TRACK,
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BAR_HEIGHT,
    backgroundColor: BLUE,
    transformOrigin: 'left',
  },
});
