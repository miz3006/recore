import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { DAY_LABELS, hasDay } from '@/lib/onboarding';
import { alpha, color, ink, MAX_FONT_SCALE, moderateScale, radius, type } from '@/lib/theme';

/**
 * Seven day circles, Monday first, multi-select — the illustrated flow's
 * "which days do you train" control. Same bit-mask vocabulary as the calendar
 * and `plan/resolve.ts` (`hasDay`/`toggleDay`), same surface language as
 * OptionRow: paper at 60% with an ink hairline, selected = solid ink with a
 * paper label. An EXPECTATION, never a target (§11) — nothing here or
 * downstream counts a miss.
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
    <View style={styles.row}>
      {DAY_LABELS.map((label, day) => {
        const selected = hasDay(mask, day);
        return (
          <PressableScale
            key={label}
            onPress={() => onToggle(day)}
            activeScale={0.94}
            accessibilityRole="checkbox"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            style={[styles.circle, selected && styles.circleSelected]}>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {label.slice(0, 2)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
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
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    backgroundColor: alpha(color.bg, 0.6),
  },
  circleSelected: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  label: {
    ...type.caption,
    fontWeight: '600',
    color: color.textPrimary,
  },
  labelSelected: {
    color: color.bg,
  },
});
