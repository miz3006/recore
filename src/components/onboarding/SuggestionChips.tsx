import { StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BLUE, INK_CARD } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * The key-lift chips: a wrapping row of the best-known lifts, MULTI-SELECT up
 * to a cap (v3 design import, 18 Aug 2026 — it used to be a single quick-pick
 * under a text field, and the flow no longer has that field).
 *
 * A soft ink pill that FILLS blue with a white label when chosen, matching the
 * day circles: both are small multiple-choice marks that have to read from
 * across the screen, where an outline does not.
 *
 * **At the cap the unchosen chips go quiet rather than away.** A control that
 * disappears when you reach a limit leaves you guessing what happened; a chip
 * that dims and stops responding, beside three that are lit, says "three is the
 * number" without a line of copy. Deselecting any of them wakes the rest.
 *
 * That dimming is ANIMATED (19 Aug 2026). Choosing the third lift changes the
 * state of every other chip on the screen at once, and as a hard cut it read as
 * the screen glitching rather than as a rule being applied — eight rows losing
 * half their contrast in the same frame is a lot of simultaneous change to have
 * no transition at all. On the same 160 ms as the selection itself, it reads as
 * a consequence of the tap.
 */
export function SuggestionChips({
  suggestions,
  selected,
  onToggle,
  max,
}: {
  suggestions: readonly string[];
  /** The chosen lifts, in the order they were chosen. */
  selected: readonly string[];
  onToggle: (suggestion: string) => void;
  /** How many may be lit at once; omit for no limit. */
  max?: number;
}) {
  const full = max != null && selected.length >= max;
  return (
    <View style={styles.wrap}>
      {suggestions.map((s) => {
        const on = selected.includes(s);
        return (
          <Chip
            key={s}
            label={s}
            selected={on}
            // At the cap the unchosen ones are inert; the chosen ones must stay
            // tappable or there is no way back out of a full selection.
            disabled={full && !on}
            onPress={() => onToggle(s)}
          />
        );
      })}
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = useSelectFill(selected);
  const off = useSelectFill(disabled);

  const chipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], [INK_CARD, BLUE]),
    opacity: 1 - CHIP_DIM * off.get(),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.get(), [0, 1], [color.textPrimary, color.onInk]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      activeScale={0.95}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.chip, chipStyle]}>
      <Animated.Text style={[styles.label, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

/** How far an inert chip drops. It was `opacity: 0.45` as a static style. */
const CHIP_DIM = 0.55;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: INK_CARD,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: moderateScale(40),
    justifyContent: 'center',
  },
  label: {
    ...type.subhead,
    fontWeight: '600',
  },
});
