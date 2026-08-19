import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, hairline, MAX_FONT_SCALE, radius, shadow, spacing, type } from '@/lib/theme';
import { eyebrow as eyebrowToken } from '@/lib/theme/typography';

/**
 * The Next tab's shared section shell — the rhythm every block on the page
 * keeps.
 *
 * It exists so the page reads as ONE system: the eyebrow is always the same
 * 11 pt letter-spaced label, the card always has the same padding, and the gap
 * between two sections is always the same. Before this, each block set its own
 * and the page drifted a few points at every seam.
 *
 * `tone` is the ONLY thing an eyebrow is allowed to vary, and the three values
 * are the three meanings the palette has (product-direction §4.2, amended
 * 12 Aug): `brand` blue is Recore's product accent and names the authored
 * brief; `attention` amber marks a plateau; everything else is muted ink. A
 * section eyebrow never wears `signal` green — green is a load not yet lifted
 * and nothing else, ever.
 */
export type EyebrowTone = 'muted' | 'brand' | 'attention';

/** One 8 pt-grid gap between two sections, used by the page and nothing else. */
export const SECTION_GAP = spacing.xxxl;

export function SectionEyebrow({
  children,
  tone = 'muted',
  style,
}: {
  children: string;
  tone?: EyebrowTone;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Text
      style={[styles.eyebrow, TONE[tone], style as never]}
      accessibilityRole="header"
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children.toUpperCase()}
    </Text>
  );
}

/** The standard raised-paper card. One radius, one padding, one border. */
export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** The hairline between two rows inside a card. Never on the first row. */
export function RowRule() {
  return <View style={styles.rule} />;
}

const TONE = StyleSheet.create({
  muted: { color: color.textMuted },
  brand: { color: color.trained },
  attention: { color: color.attention },
});

const styles = StyleSheet.create({
  eyebrow: {
    ...eyebrowToken,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  rule: {
    height: hairline,
    backgroundColor: color.divider,
  },
});

/** Shared by the section bodies so a row's supporting line is one treatment. */
export const rowText = StyleSheet.create({
  name: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
    flexShrink: 1,
  },
  sub: {
    marginTop: 2,
    ...type.footnote,
    color: color.textSecondary,
  },
});
