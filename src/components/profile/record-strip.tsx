import { StyleSheet, Text, View } from 'react-native';

import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

/**
 * THE CAREER NUMBERS — three readings, bare on the canvas.
 *
 * ## It lost its card on 9 September 2026
 *
 * This was a white surface with a hairline, a shadow and two vertical rules
 * between the columns. The design system's §Structure has been explicit since
 * v6 that it should not have been: *"The record has no cards and no dividers…
 * a card is the exception, not the default. Anywhere else, a card must be
 * justified against bare rows first."* Sessions, sets and kilograms are the
 * record — the most literal record on the screen — and the card was doing the
 * one thing a card must never do here, which is to put a frame around a fact.
 *
 * Losing it is also the iOS 26 read. A boxed three-up strip is the shape every
 * fitness app draws; a large tabular number over a quiet label, with air
 * instead of a rule between the columns, is what Fitness, Health and Weather
 * draw, and it is the shape that survives being the only thing on a screen.
 *
 * ## What carries the separation, now that nothing draws it
 *
 * Air and typographic contrast, and they are enough: the value is 32 pt
 * reading-face at 700 and the label is 11.5 pt sans at `textSecondary`, so the
 * eye groups each pair vertically long before it looks for a rule between them.
 * Three equal `flex: 1` columns keep the optical centres where a rule used to
 * put them.
 *
 * ## It reports, so it is ink and grey and nothing else
 *
 * Every number here is RECORDED: sessions written, sets counted, kilograms
 * actually moved. §3 reserves `signal` green for a load not yet lifted, and
 * this strip has no future in it at all — so the planned colour cannot appear
 * here, and neither can `gain`/`loss`, which describe a direction it does not
 * claim. The label names the number above it, which makes it information
 * rather than something the eye may skip, and the ink ladder bars `textMuted`
 * from carrying that.
 *
 * ## Tabular figures are load-bearing
 *
 * Three numbers on one optical baseline is the entire read of this shape. In a
 * proportional face `1` is narrower than `8`, so the three columns drift by a
 * few points as the record grows and the strip slowly stops looking aligned.
 * `readingStyle` is the app's number face and it is tabular by construction.
 *
 * ## Not a control
 *
 * It never was. The page it sits on is a settings page, every other tappable
 * thing on it announces itself with a chevron, and a silent target among rows
 * that all declare themselves is the one thing a person finds by accident.
 */

export function RecordStrip({
  stats,
}: {
  /** Exactly three — the columns are the layout. */
  stats: readonly { value: string; label: string }[];
}) {
  return (
    <View
      style={styles.strip}
      accessibilityRole="summary"
      accessibilityLabel={stats.map((s) => `${s.value} ${s.label}`).join(', ')}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={styles.cell}
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
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    // The columns keep the card's old breathing room without the card: this is
    // the air that used to be its vertical padding.
    paddingVertical: spacing.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    gap: moderateScale(2),
    /**
     * THE LABELS SIT ON ONE LINE, WHATEVER THE FIGURES DO (10 September 2026).
     *
     * The row stretches its cells to a common height, so the default TOP
     * alignment hung each column from the top — and a figure that
     * `adjustsFontSizeToFit` has shrunk occupies a shorter box, which left the
     * three columns ragged. Hung from the bottom, the labels are a line and the
     * figures sit the same gap above it, which is what makes three numbers read
     * as one strip rather than as three unrelated readings.
     */
    justifyContent: 'flex-end',
  },
  value: {
    ...readingStyle('700'),
    fontSize: type.statNumber.fontSize,
    /**
     * NO `lineHeight` ON THIS ONE, AND IT IS THE WHOLE BUG (10 September 2026).
     *
     * `adjustsFontSizeToFit` and an explicit line height cannot both be
     * honoured: UIKit is asked to fit glyphs into a box whose height is already
     * pinned, gives up, and drops straight to `minimumFontScale`. Progress's
     * hero reading learned this on 9 September and this file did not — measured
     * at accessibility-extra-large on the iOS 26.5 simulator, where the three
     * career numbers (52 · 339 · 113,667) did not render AT ALL and their
     * labels were sliced to "Ses", "S" and "Kg l".
     *
     * Without it the font's own metrics size the line, `adjustsFontSizeToFit`
     * gets a box it can actually work in, and a long number shrinks to fit its
     * column instead of vanishing from it.
     */
    letterSpacing: type.statNumber.letterSpacing,
    color: color.textPrimary,
  },
  label: {
    ...type.footnote,
    // NO FIXED LINE BOX (10 September 2026). `lineFor()` scales for the DEVICE,
    // not for Dynamic Type, so at the ×1.5 cap the glyphs grow and the box does
    // not — measured on the iOS 26.5 simulator at accessibility-extra-large,
    // where this text lost its ascenders and descenders. The font's own metrics
    // size the line instead, which is what a scaling label wants anyway.
    lineHeight: undefined,
    color: color.textSecondary,
  },
});
