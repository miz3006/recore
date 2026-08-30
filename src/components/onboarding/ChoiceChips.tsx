import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';

import { CARD_FILL } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * A SINGLE-SELECT question drawn as pills instead of rows (23 Aug 2026).
 *
 * The flow's default answer is a full-width `OptionRow`: a 56 pt white card
 * with a ring on the right, which is the right weight for a question whose
 * answer changes what the app does. The attribution screen is not that
 * question. It changes nothing the person will ever see, it is skippable, and
 * it asks six things at once — so as rows it was six identical cards and six
 * empty rings filling the page, which is the heaviest the flow gets for its
 * lightest question. (It read worse still after the glyphs came off on the
 * owner's ruling: the emoji had been the only thing telling the six rows
 * apart at a glance.)
 *
 * As pills the same six answers take three lines, the weight matches the ask,
 * and the screen reads as a question a company is asking rather than as another
 * form. The vocabulary is the flow's own — chosen FILLS blue with a white label,
 * exactly like the day circles and the key-lift chips — so nothing new has to be
 * learned to use it.
 *
 * It is the RADIO twin of `SuggestionChips` (same shape, checkbox semantics,
 * many answers). They are kept apart rather than merged behind a flag: one
 * takes option ids and answers a question, the other takes exercise names and
 * builds a set, and the sixty lines they would share are style declarations.
 */
export function ChoiceChips({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly { id: string; label: string }[];
  /** The chosen id, or null while the question is unanswered. */
  value: string | null;
  onChange: (id: string) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <Chip
          key={option.id}
          label={option.label}
          selected={value === option.id}
          onPress={() => onChange(option.id)}
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
    backgroundColor: interpolateColor(p.get(), [0, 1], [IDLE_FILL, SELECTED_FILL]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.get(), [0, 1], [IDLE_INK, SELECTED_INK]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.95}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, chipStyle]}>
      <Animated.Text style={[styles.label, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

/** Precomputed for the worklets above — a `useAnimatedStyle` may only do
 * arithmetic on what it is handed. */
const IDLE_FILL = CARD_FILL;
const SELECTED_FILL = color.brand;
const IDLE_INK = color.textPrimary;
const SELECTED_INK = color.onInk;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    // A 44 pt target at the default text size, without a fixed height.
    minHeight: moderateScale(44),
    justifyContent: 'center',
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  label: {
    ...type.subhead,
    fontWeight: '600',
  },
});
