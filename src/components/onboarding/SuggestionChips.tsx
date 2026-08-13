import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { color, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

import { BLUE, INK_CARD } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * Quick-pick pills under a text answer (the key-lift step): the best-known
 * choices one tap away, the field above for everything else. Tapping a chip
 * answers-and-advances exactly like a radio option, so the common case costs
 * one touch and typing stays first-class.
 *
 * A soft ink-3 % pill that FILLS blue with a white label when chosen (Claude
 * Design canvas, 13 Aug 2026), matching the day circles: both are small
 * multiple-choice marks that have to read from across the screen, where an
 * outline does not. The chip matching the field's current text reads selected,
 * so typing a lift by hand deselects the row by itself.
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
      {suggestions.map((s) => (
        <Chip
          key={s}
          label={s}
          selected={normalized === s.toLowerCase()}
          onPress={() => onPick(s)}
        />
      ))}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useSelectFill(selected);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [INK_CARD, BLUE]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [color.textPrimary, '#FFFFFF']),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.95}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, chipStyle]}>
      <Animated.Text style={[styles.label, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: INK_CARD,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2,
  },
  label: {
    ...type.subhead,
    fontWeight: '500',
  },
});
