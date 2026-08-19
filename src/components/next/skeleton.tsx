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
 * It mirrors the REAL page's geometry (rebuilt 18 Aug with it): two lede lines
 * on bare paper, a row of chips, then TWO lift cards — a name, a lever, a
 * reading and the card's floor line. Two, because a session with only one lift
 * is rare and a skeleton that draws five rows and resolves into two has lied
 * about the record; two is the fewest a list can be and still look like one.
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

      {/* The chip row. */}
      <Bar width="62%" height={34} p={p} />

      {/* Two cards, in the shape a lift card actually resolves into: the name
          and its lever on one line, the reading right of them, the floor line
          under both. */}
      <SkeletonCard p={p} />
      <SkeletonCard p={p} />
    </View>
  );
}

function SkeletonCard({ p }: { p: SharedValue<number> }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardName}>
          <Bar width="72%" height={17} p={p} />
          <Bar width="46%" height={11} p={p} spaced />
        </View>
        {/* The load — the tallest bar on the card, because it is the tallest
            thing on the card it stands in for. */}
        <Bar width={moderateScale(72)} height={28} p={p} />
      </View>
      <Bar width="54%" height={11} p={p} spaced />
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
  // A real lift card's own metrics — Progression's, and now Next's.
  card: {
    marginTop: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    padding: spacing.lg,
    ...shadow.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardName: {
    flex: 1,
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
