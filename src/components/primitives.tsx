import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha, color, ink, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * The shared surface vocabulary (CLAUDE.md §8). One Card, one caption label,
 * one stat tile — so every screen draws the same shapes instead of re-rolling
 * them inline. No gradients, no shadows: a Card is a surface fill, an 18px
 * radius, and a hairline border. Emphasis stays with the content.
 */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Small-caps section label — the quiet voice that names a block ("SESSION",
 * "NEXT SESSION", "RECORDS"). */
export function CaptionLabel({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'signal' }) {
  return (
    <Text
      style={[styles.captionLabel, tone === 'signal' && styles.captionSignal]}
      maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children.toUpperCase()}
    </Text>
  );
}

/**
 * A big-number stat tile (Whoop's anchor unit): caption label on top, tabular
 * numeral, optional delta line. The delta speaks in the machine's ink when
 * positive, error red when it warns, muted otherwise.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaTone = 'muted',
  style,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'signal' | 'error' | 'muted';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[styles.tile, style]}>
      <CaptionLabel>{label}</CaptionLabel>
      <Text style={styles.tileValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value}
        {unit ? <Text style={styles.tileUnit}> {unit}</Text> : null}
      </Text>
      {delta ? (
        <Text
          style={[styles.tileDelta, deltaTone === 'signal' && styles.deltaSignal, deltaTone === 'error' && styles.deltaError]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {delta}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
  },
  captionLabel: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  captionSignal: {
    color: color.signal,
  },
  tile: {
    flex: 1,
    gap: spacing.xs,
  },
  tileValue: {
    ...type.statNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  tileDelta: {
    ...type.caption,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  deltaSignal: {
    color: color.signal,
  },
  deltaError: {
    color: color.error,
  },
});
