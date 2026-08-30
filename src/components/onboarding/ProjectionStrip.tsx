import { StyleSheet, Text, View } from 'react-native';

import { projectionFor } from '@/components/onboarding-v2/projection';
import { Eyebrow } from '@/components/primitives';
import { COMMIT_WEEKS, projectionSeries } from '@/lib/onboarding';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { useOnboardingAnswers } from '@/state/onboarding';
import { useV2, v2Answers } from '@/state/onboarding-v2';

import {
  liftProjections,
  relativeProjection,
  type LiftProjection,
  type RelativeProjection,
} from './config';
import { formatLoad } from './LiftLoadRow';
import { ProjectionChart } from './ProjectionChart';
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
 *
 * ## It reads whichever flow the person actually walked (28 August 2026)
 *
 * v2 is the primary onboarding now, and it keeps its answers in its own store.
 * Reading only the v1 store would have left the paywall blank for every new
 * person — the exact regression this component was built to fix. So the v1
 * answers come first (an install that finished the illustrated flow) and the v2
 * projection stands behind them, drawn with **v2's own stepped series** rather
 * than a straight ramp: the promise is to reprise the picture they saw, and the
 * two flows do not draw the same one.
 */

export function ProjectionStrip({ delay = 0 }: { delay?: number }) {
  const answers = useOnboardingAnswers((s) => s.answers);
  const v2 = useV2((s) => s.answers);
  const fromV1 = liftProjections(answers)[0] ?? null;
  const v2Projection = fromV1 ? null : projectionFor(v2);
  const absolute = fromV1 ?? (v2Projection ? asLiftProjection(v2Projection) : null);
  const relative = absolute ? null : relativeProjection(answers);
  if (!absolute && !relative) return null;

  return (
    <Strip
      absolute={absolute}
      relative={relative}
      series={v2Projection?.series ?? null}
      delay={delay}
    />
  );
}

/** Does this person have a projection to be reminded of? The paywall reads it
 * for its own §13 event, so the answer lives in one place. */
export function hasProjection(): boolean {
  const { answers } = useOnboardingAnswers.getState();
  if (liftProjections(answers).length > 0 || relativeProjection(answers) != null) return true;
  return projectionFor(v2Answers()) != null;
}

/**
 * v2's projection in the shape this strip already draws.
 *
 * KILOGRAMS, because that is what v2 asked for and showed: the flow has no unit
 * question and writes kg, so converting here would print a number the person
 * never saw on the screen this is reprising.
 */
function asLiftProjection(p: NonNullable<ReturnType<typeof projectionFor>>): LiftProjection {
  return {
    lift: p.lift,
    start: p.startKg,
    target: p.endKg,
    gain: p.endKg - p.startKg,
    unit: 'kg',
  };
}

function Strip({
  absolute,
  relative,
  series: given,
  delay,
}: {
  absolute: LiftProjection | null;
  relative: RelativeProjection | null;
  /** v2's own weekly series, when the projection came from that flow. */
  series: number[] | null;
  delay: number;
}) {
  const lift = absolute?.lift ?? relative!.lift;
  const value = absolute
    ? `${formatLoad(absolute.start)} → ${formatLoad(absolute.target)} ${absolute.unit}`
    : `+${relative!.percent}% in ${COMMIT_WEEKS} weeks`;

  // The same object the projection screen drew, at a third the height: the same
  // arithmetic, the same component, the same line (`ProjectionChart`). It was
  // twelve miniature bars while that screen drew twelve bars; when that became
  // a line this had to follow, or the paywall would be reprising a picture the
  // person never saw.
  const series =
    given ??
    (absolute
      ? projectionSeries(absolute.start, absolute.target)
      : projectionSeries(100, 100 + relative!.percent));

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
        <View style={styles.chart}>
          <ProjectionChart
            series={series}
            height={CHART_HEIGHT}
            delay={delay}
            strokeWidth={1.75}
          />
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
