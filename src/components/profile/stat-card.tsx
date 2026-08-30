import { StyleSheet, Text, View } from 'react-native';

import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

/**
 * THE CAREER NUMBERS — three, side by side, hairlines between (Pin Trading,
 * `oth_hirl5`: number above label, vertical rules, one white card).
 *
 * ## It reports, so it is ink and grey and nothing else
 *
 * Every number on this card is RECORDED: sessions written, sets counted,
 * kilograms actually moved. CLAUDE.md §3 reserves `signal` green for a load not
 * yet lifted, and this card has no future in it at all — so the planned colour
 * cannot appear here, and neither can `gain`/`loss`, which describe a direction
 * this card does not claim. Value in ink, label in `textSecondary`. The label
 * names the number above it, which makes it information rather than something
 * the eye may skip, and the ink ladder bars `textMuted` from carrying that.
 *
 * ## Tabular figures are load-bearing
 *
 * Three numbers on one optical baseline is the entire read of this shape. In a
 * proportional face `1` is narrower than `8`, so the three columns drift by a
 * few points as the record grows and the card slowly stops looking aligned.
 * `readingStyle` is the app's number face and it is tabular by construction.
 *
 * ## Not a control
 *
 * The old record card was pressable and pushed to Progress. This one is not: the
 * page it sits on is a settings page, every other tappable thing on it has a
 * chevron, and a card that silently navigates among rows that announce
 * themselves is the one target a person finds by accident. The chart card below
 * is where the record is explored.
 */

export function StatCard({
  stats,
}: {
  /** Exactly three. The hairlines are drawn between, so the count is the layout. */
  stats: readonly { value: string; label: string }[];
}) {
  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={stats.map((s) => `${s.value} ${s.label}`).join(', ')}>
      {stats.map((stat, i) => (
        <View key={stat.label} style={styles.cell}>
          {i > 0 ? <View style={styles.rule} /> : null}
          <View
            style={styles.stat}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Text
              style={styles.value}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {stat.value}
            </Text>
            <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {stat.label}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  // The rule is a SIBLING of the stat rather than a border on it, so it can be
  // inset from the card's top and bottom padding — a full-height border would
  // run into the card's own rounded corner.
  cell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rule: {
    width: hairline,
    marginVertical: spacing.xs,
    backgroundColor: color.border,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  value: {
    ...readingStyle('700'),
    fontSize: moderateScale(26),
    lineHeight: moderateScale(31),
    letterSpacing: -0.4,
    color: color.textPrimary,
  },
  label: {
    ...type.footnote,
    color: color.textSecondary,
  },
});
