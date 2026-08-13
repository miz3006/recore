import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { DAY_LABELS, hasDay } from '@/lib/onboarding';
import { color, MAX_FONT_SCALE, moderateScale, radius, type } from '@/lib/theme';

import { BLUE, INK_CARD, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * Seven day circles, Monday first, multi-select — the "which days do you
 * train" control. Same bit-mask vocabulary as the calendar and
 * `plan/resolve.ts` (`hasDay`/`toggleDay`), same surface language as OptionRow
 * after the 12 Aug restyle: a soft ink-3 % disc that takes a Recore blue edge
 * and a blue label when it is chosen. An EXPECTATION, never a target (§11) —
 * nothing here or downstream counts a miss.
 */
export function DayPicker({
  mask,
  onToggle,
}: {
  mask: number;
  /** Called with the Monday-first day index (0–6) to flip. */
  onToggle: (day: number) => void;
}) {
  return (
    <Animated.View style={styles.row}>
      {DAY_LABELS.map((label, day) => (
        <DayCircle
          key={label}
          label={label}
          selected={hasDay(mask, day)}
          onPress={() => onToggle(day)}
        />
      ))}
    </Animated.View>
  );
}

function DayCircle({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useSelectFill(selected);

  const circleStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [INK_CARD, BLUE]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [color.textPrimary, BLUE]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.94}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      style={[styles.circle, circleStyle]}>
      <Animated.Text style={[styles.label, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label.slice(0, 2)}
      </Animated.Text>
    </PressableScale>
  );
}

const CIRCLE = moderateScale(42);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK_CARD,
    borderWidth: SELECT_BORDER,
  },
  label: {
    ...type.caption,
    fontWeight: '600',
  },
});
