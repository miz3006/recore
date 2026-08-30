import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import { DUR, EASE } from '@/lib/motion';
import {
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

/**
 * UNMOUNTED, SAME DAY IT WAS BUILT (owner, 23 Aug 2026) — the days screen went
 * back to two option rows with the rest of its earlier design. Kept on disk:
 * the flow has no other compact two-way control, and the next question that
 * wants one starts here.
 *
 * A two- or three-way segmented control — the funnel's answer to a question
 * whose options are SHORT and MUTUALLY EXCLUSIVE.
 *
 * The days screen asked "how you follow it" with two full option rows: two
 * 56 pt cards, two emoji, two check rings, 120 pt of page — for a choice
 * between two short phrases. That is the weight the flow spends on "what is
 * your main goal", handed to a sub-question under another question. The same
 * choice is one 44 pt control here, and the screen it sits on now fits on the
 * glass without scrolling at the default text size.
 *
 * ## The thumb slides; the labels cross-fade
 *
 * A recessed track (`surfaceHigh` — the skill's one sanctioned use for it,
 * "segmented containers") with a white pill riding over it, exactly the way
 * iOS draws this control, so nobody has to learn it. The pill moves on a
 * TRANSFORM — a layout property would be §4.3's ban and would also cost a
 * measure pass per frame — and the labels interpolate their colour on the same
 * progress, so the travel and the emphasis are one event.
 *
 * The distance travelled is derived from the MEASURED track. Before that
 * measurement the pill has nowhere real to be, so it stays hidden rather than
 * flashing at zero and jumping — one frame of an honest empty track beats one
 * frame of a wrong answer. It is hidden while the question is unanswered for
 * the same reason: a pill resting on the first option is an answer nobody gave.
 *
 * Reduce Motion keeps the pill and drops the travel: the selection lands
 * instantly, and nothing is carried by the movement itself.
 */
export type SegmentedOption = {
  id: string;
  label: string;
};

export function Segmented({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: readonly SegmentedOption[];
  /** The chosen id, or null while the question is unanswered. */
  value: string | null;
  onChange: (id: string) => void;
  accessibilityLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((o) => o.id === value);
  const chosen = index >= 0;
  /** One segment's width — the thumb's size AND its unit of travel. */
  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;

  // The thumb's position in SEGMENT INDEX space, so a re-measure (a rotation, a
  // Dynamic Type change) moves the pill by re-reading `slot` without
  // re-animating anything.
  const at = useSharedValue(chosen ? index : 0);
  useEffect(() => {
    if (index < 0) return;
    at.set(reduce ? index : withTiming(index, { duration: DUR.base, easing: EASE.emphasized }));
  }, [index, reduce, at]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: at.get() * slot }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[styles.thumb, { width: slot, opacity: chosen && slot > 0 ? 1 : 0 }, thumbStyle]}
        pointerEvents="none"
      />
      {options.map((option, i) => (
        <Segment
          key={option.id}
          label={option.label}
          index={i}
          at={at}
          answered={chosen}
          selected={chosen && index === i}
          onPress={() => onChange(option.id)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  index,
  at,
  answered,
  selected,
  onPress,
}: {
  label: string;
  index: number;
  at: SharedValue<number>;
  /** False while nothing is chosen — then every label reads as unselected. */
  answered: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  // Distance from the thumb, clamped to one segment: the label under the pill
  // is ink, its neighbours are secondary, and the two swap as the pill travels.
  const labelStyle = useAnimatedStyle(() => {
    const near = answered ? Math.min(1, Math.abs(at.get() - index)) : 1;
    return { color: interpolateColor(near, [0, 1], [SELECTED_INK, IDLE_INK]) };
  });

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.97}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.segment}>
      <Animated.Text
        style={[styles.label, labelStyle]}
        numberOfLines={1}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
    </PressableScale>
  );
}

/** Precomputed for the worklets above: a `useAnimatedStyle` may only do
 * arithmetic on values it is handed — resolving a colour inside one is the
 * runtime crash `theme` warns about. */
const SELECTED_INK = color.textPrimary;
const IDLE_INK = color.textSecondary;

/** The track's inner padding — the gap the white pill leaves around itself. */
const PAD = moderateScale(3);
const HEIGHT = moderateScale(44);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: HEIGHT,
    padding: PAD,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    // The one sanctioned recess in the system: a segmented container.
    backgroundColor: color.surfaceHigh,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.md - PAD,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    borderWidth: hairline,
    borderColor: color.divider,
    ...shadow.card,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  label: {
    ...type.subhead,
    fontWeight: '600',
  },
});
