import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { DAY_LABELS, hasDay } from '@/lib/onboarding';
import { color, MAX_FONT_SCALE, moderateScale, radius, type } from '@/lib/theme';

import { BLUE, INK_CARD } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * Seven day circles, Monday first, multi-select — the "which days do you
 * train" control. Same bit-mask vocabulary as the calendar and
 * `plan/resolve.ts` (`hasDay`/`toggleDay`).
 *
 * A chosen day FILLS blue with a white label (Claude Design canvas, 13 Aug
 * 2026). A single option row wears its blue as an edge because a filled row
 * would outshout the CTA beneath it; seven small discs are a pattern, and the
 * shape of a training week has to be legible at a glance from across the
 * screen — which an outline at this size is not.
 *
 * An EXPECTATION, never a target (§11) — nothing here or downstream counts a
 * miss.
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
    backgroundColor: interpolateColor(p.value, [0, 1], [INK_CARD, BLUE]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [color.textPrimary, '#FFFFFF']),
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

const CIRCLE = moderateScale(44);

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
  },
  label: {
    ...type.caption,
    fontWeight: '600',
  },
});
