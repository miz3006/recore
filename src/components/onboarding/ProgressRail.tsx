import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { alpha, color, spacing } from '@/lib/theme';

/**
 * The top progress rail of the illustrated onboarding: one hairline segment
 * per step, completed segments in ink, the rest at 15% — position without a
 * number, so the flow never reads as a countdown.
 */
export function ProgressRail({
  total,
  completed,
  style,
}: {
  total: number;
  /** Segments filled in ink; the step being viewed counts as reached. */
  completed: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.rail, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: completed }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.segment, i < completed && styles.segmentDone]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: alpha(color.accent, 0.15),
  },
  segmentDone: {
    backgroundColor: color.accent,
  },
});
