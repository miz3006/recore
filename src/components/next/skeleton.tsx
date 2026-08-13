import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { color, moderateScale, radius, shadow, spacing } from '@/lib/theme';

/**
 * The Next tab's loading skeleton — a lede and the one raised card.
 *
 * WHY IT EXISTS. `buildBrief` is a synchronous pass over the local mirror, so
 * on a warm database it is genuinely instant and this never shows. On a cold
 * start, on a large history, or while a re-parse is landing, it is not — and
 * the page was popping in fully formed after a blank beat. A blank beat reads
 * as "nothing here"; the skeleton reads as "reading your record", which is
 * what is actually happening.
 *
 * It mirrors the REAL page's geometry (rebuilt 13 Aug with it): two lede lines
 * on bare paper, an eyebrow, then the hero card with a short label, a name, a
 * lever and one wide load bar. Nothing jumps when the content replaces it, and
 * it never mimics rows it cannot promise — a skeleton that draws five rows and
 * resolves into two has lied about the record.
 *
 * Reduce Motion holds the bars at their mid opacity. §1.1's rule is absolute
 * and a shimmer is exactly the kind of idle repetition it exists to stop.
 */
export function NextSkeleton() {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 0.5 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Reading your record">
      {/* The lede, on paper. */}
      <Bar width="88%" height={17} p={p} />
      <Bar width="52%" height={17} p={p} spaced />

      <View style={styles.gap} />

      <Bar width="28%" height={11} p={p} />
      <View style={styles.card}>
        <Bar width="30%" height={10} p={p} />
        <Bar width="58%" height={20} p={p} spaced />
        <Bar width="34%" height={16} p={p} spaced />
        {/* The load — the tallest bar on the page, because it is the tallest
            thing on the page it stands in for. */}
        <Bar width="76%" height={28} p={p} spaced />
      </View>
    </View>
  );
}

/** Every bar reads the SAME shared value, so the whole skeleton breathes as one
 * surface rather than as six independently pulsing shapes. */
function Bar({
  width,
  height,
  p,
  spaced,
}: {
  width: DimensionValue;
  height: number;
  p: SharedValue<number>;
  spaced?: boolean;
}) {
  const shimmer = useAnimatedStyle(() => ({ opacity: 0.35 + p.value * 0.35 }));
  return (
    <Animated.View
      style={[
        styles.bar,
        { width, height: moderateScale(height), borderRadius: moderateScale(height) / 2 },
        spaced && styles.spaced,
        shimmer,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.xxl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    ...shadow.raised,
  },
  gap: {
    height: spacing.xl,
  },
  bar: {
    backgroundColor: color.surfaceHigh,
  },
  spaced: {
    marginTop: spacing.md,
  },
});
