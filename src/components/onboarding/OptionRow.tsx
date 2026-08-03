import { StyleSheet, Text } from 'react-native';

import { PressableScale } from '@/components/motion';
import { alpha, color, ink, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * One tappable answer in the illustrated onboarding flow.
 *
 * A full-width pill row over the gradient: paper fill at 60% so the
 * illustration ghosts through, a 0.5px ink hairline at the structural-whisper
 * opacity (`ink.grabber`). Selected fills SOLID INK with a paper label —
 * never green; `signal` is a planned value and selection is not one.
 *
 * Radio semantics: the renderer groups these under the question's
 * `radiogroup`; each row reports `selected` through accessibilityState.
 */
export function OptionRow({
  label,
  emoji,
  selected,
  onPress,
}: {
  label: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.row, selected && styles.rowSelected]}>
      {emoji ? (
        <Text style={styles.emoji} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {emoji}
        </Text>
      ) : null}
      <Text
        style={[styles.label, selected && styles.labelSelected]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    borderRadius: radius.md,
    backgroundColor: alpha(color.bg, 0.6),
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  rowSelected: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  emoji: {
    ...type.headline,
    marginRight: spacing.sm,
  },
  label: {
    ...type.headline,
    color: color.textPrimary,
    flexShrink: 1,
  },
  labelSelected: {
    color: color.bg,
  },
});
