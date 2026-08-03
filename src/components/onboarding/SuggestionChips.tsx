import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { alpha, color, ink, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * Quick-pick pills under a text answer (the priority-movement step): the
 * best-known choices one tap away, the field above for everything else.
 * Tapping a chip answers-and-advances exactly like a radio option, so the
 * common case costs one touch and typing stays first-class. Same surface
 * language as OptionRow; the chip matching the field's current text reads
 * selected.
 */
export function SuggestionChips({
  suggestions,
  current,
  onPick,
}: {
  suggestions: string[];
  /** The field's current text — the matching chip shows as selected. */
  current: string;
  onPick: (suggestion: string) => void;
}) {
  const normalized = current.trim().toLowerCase();
  return (
    <View style={styles.wrap}>
      {suggestions.map((s) => {
        const selected = normalized === s.toLowerCase();
        return (
          <PressableScale
            key={s}
            onPress={() => onPick(s)}
            activeScale={0.95}
            accessibilityRole="button"
            accessibilityLabel={s}
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {s}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    borderRadius: radius.pill,
    backgroundColor: alpha(color.bg, 0.6),
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chipSelected: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  label: {
    ...type.subhead,
    fontWeight: '500',
    color: color.textPrimary,
  },
  labelSelected: {
    color: color.bg,
  },
});
