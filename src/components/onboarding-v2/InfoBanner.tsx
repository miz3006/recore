import { StyleSheet, Text, View } from 'react-native';

import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { v2color, v2radius } from './tokens';

/**
 * AN INLINE EXPLANATION, on the screen it explains.
 *
 * §2, screen 12: "Use an inline info banner here rather than a separate
 * explainer screen (Gravl does this at its positions 18–19)." Gravl spends two
 * screens telling you what a split is before asking which one you use; the
 * banner is the same information at a tenth of the cost, and it is still on
 * screen while the choice is being made rather than one push behind it.
 *
 * It does not animate on its own — it arrives with the rest of the screen on
 * the shared `Enter`. A box that explains something and also moves is a box
 * that gets read twice.
 */
export function InfoBanner({ text }: { text: string }) {
  return (
    <View style={styles.banner} accessibilityRole="summary">
      <View style={styles.dot} />
      <Text style={styles.text} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: v2color.blueWash,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  dot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    backgroundColor: v2color.blue,
    marginTop: moderateScale(6),
  },
  text: { ...type.subhead, color: v2color.ink, flex: 1 },
});
