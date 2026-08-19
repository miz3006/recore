import { StyleSheet, Text, View } from 'react-native';

import { COMMIT_WEEKS, projectionSeries } from '@/lib/onboarding';
import { alpha, color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { formatLoad } from './LiftLoadRow';
import { BLUE, CARD_RADIUS, INK_CARD } from './tokens';

/**
 * The flow's last screen: what one lift could stand at after the commitment
 * horizon (v3 design import, 18 Aug 2026).
 *
 * ## What this is, and what it must never become
 *
 * It is a PROJECTION — arithmetic on a load the person typed two screens ago
 * and the experience they chose one screen before that (`projectedTarget`). It
 * is labelled as an estimate on the screen, it is never stored, and no session,
 * chart or brief is ever seeded from it. That distinction is the whole reason
 * this component is allowed to exist beside product-direction §5.1's "Never
 * show a fake progression chart before a session is logged": a chart of
 * training that did not happen is banned, and a chart of what the person just
 * told the app they want is a different object with a different label.
 *
 * The bars therefore carry NO axis and NO values. They are the SHAPE of a
 * straight line between two numbers that are both printed above them in full;
 * a gridline would be an invitation to read week seven off the picture, and
 * week seven is not a thing this screen knows.
 *
 * The early bars are paler, which is the design's own device and an honest one:
 * the far end of a projection is the part the person controls, and the near end
 * is the part that is nearly already true.
 */
export function ProjectionCard({
  lift,
  start,
  target,
  gain,
  unit,
}: {
  lift: string;
  start: number;
  target: number;
  gain: number;
  unit: string;
}) {
  const series = projectionSeries(start, target);
  // The bars are drawn against a floor a little under the starting load rather
  // than against zero: from zero a 20 % rise is a flat row of near-identical
  // bars, which says less about the shape than it pretends to.
  const floor = start * 0.82;
  const ceiling = Math.max(target, floor + 1);

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${lift}: ${formatLoad(start)} ${unit} now, a projected ${formatLoad(
        target,
      )} ${unit} after ${COMMIT_WEEKS} weeks.`}>
      <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lift.toUpperCase()}
      </Text>

      <View style={styles.headline}>
        <Text style={styles.value} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`${formatLoad(start)} ${unit} → ${formatLoad(target)} ${unit}`}
        </Text>
        {gain > 0 ? (
          <View style={styles.gainPill}>
            <Text style={styles.gainText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`+${formatLoad(gain)}`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {series.map((value, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${Math.max(8, ((value - floor) / (ceiling - floor)) * 100)}%`,
                backgroundColor: alpha(BLUE, 0.35 + (0.65 * i) / (series.length - 1)),
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Week 1
        </Text>
        <Text style={styles.axisText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`Week ${COMMIT_WEEKS}`}
        </Text>
      </View>
    </View>
  );
}

/** The same projection without the chart — the second and third lifts, which
 * the design draws as a compact row so the first one keeps the page. */
export function ProjectionRow({
  lift,
  start,
  target,
  unit,
}: {
  lift: string;
  start: number;
  target: number;
  unit: string;
}) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${lift}: ${formatLoad(start)} ${unit} now, a projected ${formatLoad(
        target,
      )} ${unit}.`}>
      <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lift.toUpperCase()}
      </Text>
      <Text style={styles.rowValue} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {`${formatLoad(start)} ${unit} → ${formatLoad(target)} ${unit}`}
      </Text>
    </View>
  );
}

const CHART_HEIGHT = moderateScale(96);

const styles = StyleSheet.create({
  card: {
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    padding: spacing.lg,
  },
  row: {
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    borderCurve: 'continuous',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 2,
  },
  label: {
    ...type.footnote,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: color.textSecondary,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  value: {
    flex: 1,
    ...type.title2,
    color: color.textPrimary,
  },
  rowValue: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
  },
  gainPill: {
    backgroundColor: BLUE,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  gainText: {
    ...type.caption,
    fontWeight: '700',
    color: color.onInk,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: moderateScale(4),
    height: CHART_HEIGHT,
    marginTop: spacing.lg,
  },
  bar: {
    flex: 1,
    borderRadius: moderateScale(3),
    borderCurve: 'continuous',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  axisText: {
    ...type.caption,
    color: color.textMuted,
  },
});
