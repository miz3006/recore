import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Eyebrow } from '@/components/primitives';
import { COMMIT_WEEKS, projectionSeries } from '@/lib/onboarding';
import { EASE } from '@/lib/motion';
import {
  alpha,
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useOnboardingAnswers } from '@/state/onboarding';

import {
  liftProjections,
  relativeProjection,
  type LiftProjection,
  type RelativeProjection,
} from './config';
import { formatLoad } from './LiftLoadRow';
import { CARD_FILL } from './tokens';

/**
 * THE PAYWALL SELLS THE PICTURE THE PERSON JUST SAW (conversion pass, 20 Aug
 * 2026).
 *
 * The screen before this one ends on their projection — their lift, their load,
 * twelve weeks of it. Then the plans arrived and the projection was gone, so
 * the decision was being made a screen away from the reason for it. This is
 * that same object, compact, above the plan cards.
 *
 * ## It is the same arithmetic, not a second one
 *
 * `liftProjections` / `relativeProjection` — the flow config's own functions,
 * over the same stored answers. Nothing is recomputed here and nothing new is
 * asserted; if the projection screen showed the relative variant (no load ever
 * typed), so does this.
 *
 * ## It carries its disclaimer
 *
 * "An estimate from your answers, not a promise" travels with the number. A
 * projection is allowed on a commercial screen precisely because it is labelled
 * as one (§2 rule 5, §5.1) — dropping the label here and keeping the chart
 * would turn an estimate into a sales promise.
 *
 * Nothing renders at all when there is no projection to reprise. Silence beats
 * an empty frame, and a person who skipped every number is exactly the person a
 * fabricated one would be aimed at.
 */

/** The bars grow left to right, once, on arrival. */
const GROW_MS = 600;
/** How much of that time is spent starting the LAST bar — the rest is its own
 * growth. Without a lead the twelve bars are one bar; with too much they are a
 * queue. */
const LEAD = 0.55;

export function ProjectionStrip({ delay = 0 }: { delay?: number }) {
  const answers = useOnboardingAnswers((s) => s.answers);
  const absolute = liftProjections(answers)[0] ?? null;
  const relative = absolute ? null : relativeProjection(answers);
  if (!absolute && !relative) return null;

  return <Strip absolute={absolute} relative={relative} delay={delay} />;
}

/** Does this person have a projection to be reminded of? The paywall reads it
 * for its own §13 event, so the answer lives in one place. */
export function hasProjection(): boolean {
  const { answers } = useOnboardingAnswers.getState();
  return liftProjections(answers).length > 0 || relativeProjection(answers) != null;
}

function Strip({
  absolute,
  relative,
  delay,
}: {
  absolute: LiftProjection | null;
  relative: RelativeProjection | null;
  delay: number;
}) {
  const reduce = useReducedMotion();
  const grow = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    grow.set(withDelay(delay, withTiming(1, { duration: GROW_MS, easing: EASE.emphasized })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lift = absolute?.lift ?? relative!.lift;
  const value = absolute
    ? `${formatLoad(absolute.start)} → ${formatLoad(absolute.target)} ${absolute.unit}`
    : `+${relative!.percent}% in ${COMMIT_WEEKS} weeks`;

  // The same shape the projection card draws: a straight line between the two
  // numbers, or between 100 and the rate when there is no load to start from.
  const series = absolute
    ? projectionSeries(absolute.start, absolute.target)
    : projectionSeries(100, 100 + relative!.percent);
  const floor = series[0]! * 0.82;
  const ceiling = Math.max(series[series.length - 1]!, floor + 1);

  // Heights and tints are resolved HERE, on the render thread: a worklet may
  // only do arithmetic on what it is handed, and calling `alpha()` inside one
  // crashes at runtime.
  const bars = series.map((point, i) => ({
    ratio: Math.max(0.08, (point - floor) / (ceiling - floor)),
    tint: alpha(color.brand, 0.35 + (0.65 * i) / (series.length - 1)),
  }));

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Your projection. ${lift}: ${value}. An estimate from your answers, not a promise.`}>
      <View style={styles.head}>
        <Eyebrow tone="muted" style={styles.eyebrow}>
          YOUR PROJECTION
        </Eyebrow>
        <Text style={styles.lift} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {lift}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {bars.map((bar, i) => (
            <MiniBar key={i} index={i} count={bars.length} ratio={bar.ratio} tint={bar.tint} grow={grow} />
          ))}
        </View>
        <Text style={styles.value} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {value}
        </Text>
      </View>

      <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        An estimate from your answers, not a promise.
      </Text>
    </View>
  );
}

/** One bar of the miniature, growing from its own base. */
function MiniBar({
  index,
  count,
  ratio,
  tint,
  grow,
}: {
  index: number;
  count: number;
  ratio: number;
  tint: string;
  grow: SharedValue<number>;
}) {
  // Both ends of this bar's window, computed off the worklet.
  const start = count > 1 ? (index / (count - 1)) * LEAD : 0;
  const span = Math.max(0.0001, 1 - LEAD);

  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (grow.get() - start) / span));
    return { transform: [{ scaleY: p }] };
  });

  return (
    <Animated.View
      style={[styles.bar, { height: `${ratio * 100}%`, backgroundColor: tint }, style]}
    />
  );
}

const CHART_HEIGHT = moderateScale(34);

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_FILL,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    padding: spacing.lg,
    marginBottom: spacing.lg,
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  head: {
    gap: 2,
  },
  eyebrow: {
    color: color.brand,
  },
  lift: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  chart: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: moderateScale(3),
    height: CHART_HEIGHT,
  },
  bar: {
    flex: 1,
    borderRadius: moderateScale(2),
    borderCurve: 'continuous',
    // Bars grow out of the floor they stand on, not out of their own middle.
    transformOrigin: 'bottom',
  },
  value: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
  },
  note: {
    ...type.caption,
    color: color.textMuted,
    marginTop: spacing.sm,
  },
});
