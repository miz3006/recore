import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { CountUp, Enter, PressScale } from '@/lib/motion/index';
import { describeSeries, type MetricSeries } from '@/lib/progression-metrics';
import { MAX_FONT_SCALE, color, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BareChart } from './bare-chart';

/**
 * ONE METRIC, ONE CARD (28 August 2026, from Lyfta's Exercise Progress screens).
 *
 * The tab's axis has flipped. It used to be one card per LIFT carrying a single
 * metric; it is now one lift chosen at the top and one card per METRIC below it.
 * Nothing here ranks, sorts or compares against another exercise — a card
 * answers one question about one lift and then stops.
 *
 * Anatomy, in reading order: the metric's name in ink · a chevron · the value,
 * very large and **grey rather than ink** · one sub-label · the chart.
 *
 * ## Why the number is grey and the name is not
 *
 * The name is the only ink on the card, so a stack of cards is scannable by
 * heading alone. The number is enormous but quiet, which is the reference's own
 * trick: size carries the hierarchy and tone carries the emphasis, so a screen
 * of six huge numbers does not shout six times.
 *
 * It is `textSecondary` and not `textMuted`, and that is a constraint rather
 * than a preference: on `surfaceHigh` — the tinted card — `textMuted` measures
 * **2.94:1** and is barred by `theme/color.ts`. The sub-label is the same colour
 * for the same reason plus a second one: it carries a comparison, and the ink
 * ladder's standing rule is that text carrying information is `textSecondary`
 * or ink. Size alone separates the two, which at 48 pt against 15 pt is plenty.
 *
 * ## The rhythm is measured, not guessed
 *
 * Every gap below was taken off the reference at 3× and converted
 * (`research/lyfta/screens.md`): 32 pt of air above the name, 17 to the number,
 * 23 to the sub-label, **45 to the first gridline**, 26 under the chart. The
 * first build of this card used the app's default 4 pt stacking gap throughout
 * and read as a dense little tile; the air IS the design, and it is what makes a
 * 44 pt number look calm rather than shouted.
 *
 * ## Colour
 *
 * **The chart draws in the brand blue** (owner, 28 August 2026 — the card was
 * monochrome for half a day, because the reference is). The blue is the app's
 * one recorded-line hue, so a lift looks the same here as on the Next tab and in
 * the lift sheet; the reasoning and the measured ratio live in `bare-chart.tsx`.
 *
 * **Everything that is TEXT stays ink or grey.** The name, the 44 pt number, its
 * unit and the sub-label are untouched by this — the skill's standing rule is
 * that colour marks and ink speaks, so a value never wears the hue of its own
 * chart. The one other colour on the card is the planned continuation in
 * `signal` green, which is a load NOT yet lifted (CLAUDE.md §3).
 */

/** ~40 ms between cards, the reference's cadence. `Enter`'s own `stagger` runs
 * at 60 for the onboarding flow, so the delay is passed explicitly rather than
 * by index — same primitive, this screen's rhythm. */
export const CARD_STAGGER = 40;
/** The chart starts once its card has arrived, not with it. */
const CHART_LEAD = 120;

const CHART_HEIGHT = moderateScale(180);

export function MetricCard({
  series,
  index,
  onPress,
}: {
  series: MetricSeries;
  index: number;
  onPress: () => void;
}) {
  const subLabel = describeSeries(series);
  const value = series.latest ?? 0;
  // A half-kilo estimate must keep its half; a whole number must not grow ".0".
  const decimals = Number.isInteger(value) ? 0 : 1;
  const delay = index * CARD_STAGGER;

  return (
    <Enter index={0} extraDelay={delay}>
      <PressScale
        haptic="selection"
        onPress={onPress}
        accessibilityRole="button"
        // Spoken whole, so VoiceOver never has to assemble it from a counting
        // number and a chart it cannot see.
        accessibilityLabel={`${series.name}. ${
          series.latest == null ? 'No data yet' : `${value} ${series.unit}. ${subLabel}`
        }`}
        accessibilityHint={`Opens the full history for this lift`}
        style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {series.name}
          </Text>
          <Icon name="chevron-forward" size={moderateScale(17)} tint={color.textSecondary} />
        </View>

        {/* Baseline-aligned so the unit sits ON the number's baseline rather
            than centred against a 48 pt line box. */}
        <View style={styles.valueRow}>
          <CountUp
            value={value}
            decimals={decimals}
            delay={delay}
            style={styles.value}
            // The card's own label speaks the whole thing; this must stay silent
            // or VoiceOver reads the number twice.
            accessibilityLabel=""
          />
          <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {series.unit}
          </Text>
        </View>

        <Text style={styles.sub} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {subLabel}
        </Text>

        <BareChart
          points={series.points}
          kind={series.kind}
          planned={series.planned}
          height={CHART_HEIGHT}
          delay={delay + CHART_LEAD}
        />
      </PressScale>
    </Enter>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    // Measured off the reference — see the rhythm note above. No `gap` here:
    // each block sets its own top margin, because the gaps are not equal and a
    // single gap value is what flattened the first build.
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  name: {
    ...type.lede,
    fontWeight: '700',
    color: color.textPrimary,
    flexShrink: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: moderateScale(2),
    marginTop: spacing.sm,
  },
  value: {
    // 44, not the 48 of `heroNumber`: the reference's digits measure ~31 pt of
    // cap height, which is a 44 pt face at this weight.
    ...type.bigNumber,
    fontWeight: '800',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: moderateScale(18),
    lineHeight: moderateScale(22),
    fontWeight: '700',
    letterSpacing: -0.2,
    color: color.textSecondary,
  },
  sub: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl + spacing.xs,
  },
});
