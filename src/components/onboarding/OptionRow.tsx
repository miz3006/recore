import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { SPRING } from '@/lib/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BLUE, INK_CARD, INK_TRACK, ROW_RADIUS, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * One tappable answer (owner's restyle, 12 Aug 2026).
 *
 * Unselected it is a soft card — ink at 3 % on paper, ink label, no visible
 * edge. Selected, the edge becomes RECORE BLUE at 2 pt and a blue check chip
 * springs in on the right; the label stays ink and the card stays soft. It used
 * to sweep to solid ink with a paper label, which made a chosen answer the
 * loudest thing on the screen and left nothing for the CTA to be.
 *
 * The border is always 2 pt and only its COLOUR animates — unselected it is
 * drawn in the card's own fill, so it is invisible. A border that grew from a
 * hairline would move the label inside it, and §4.3 does not allow animating a
 * layout property.
 *
 * Radio semantics: the renderer groups these under the question's
 * `radiogroup`; each row reports `selected` through accessibilityState. The
 * light haptic comes from `PressableScale`, and the renderer advances the flow
 * ~250 ms later — long enough to see the check land.
 *
 * ## Variants (Claude Design canvas, 13 Aug 2026)
 *
 * `card` is the row above and every question in the flow uses it. `primary` and
 * `outline` exist for the ONE screen the design draws as a pair of full-height
 * choices rather than a list — the weekly recap, where the two answers are
 * opposites rather than items of a set, and a filled row states which one the
 * screen is recommending without a word of pressure copy.
 */
export type OptionVariant = 'card' | 'primary' | 'outline';

export function OptionRow({
  label,
  selected,
  onPress,
  variant = 'card',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  variant?: OptionVariant;
}) {
  const p = useSelectFill(selected);
  const primary = variant === 'primary';

  const rowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      p.value,
      [0, 1],
      // A primary row is already blue; only the two quiet variants light an
      // edge, and the outline draws a visible one even when idle.
      primary ? [BLUE, BLUE] : [variant === 'outline' ? INK_TRACK : INK_CARD, BLUE],
    ),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.row, variant !== 'card' && styles.tall, VARIANT[variant], rowStyle]}>
      <Animated.Text
        style={[styles.label, primary && styles.labelOnBlue]}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Animated.Text>
      <View style={styles.mark}>{selected ? <CheckChip onBlue={primary} /> : null}</View>
    </PressableScale>
  );
}

/** The blue chip that springs in when an answer is chosen — 0.6 → 1.0 on the
 * press spring, so it lands with the tap rather than after it. On a filled blue
 * row it inverts, because blue on blue is not a mark. */
function CheckChip({ onBlue = false }: { onBlue?: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0.6);

  useEffect(() => {
    if (!reduce) s.value = withSpring(1, SPRING.press);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: Math.min(1, (s.value - 0.4) * 2.5),
  }));

  return (
    <Animated.View
      style={[styles.chip, onBlue && { backgroundColor: '#FFFFFF' }, animatedStyle]}>
      <Svg width={moderateScale(11)} height={moderateScale(11)} viewBox="0 0 16 16">
        <Path
          d="M3 8.5L6.5 12 13 4.5"
          stroke={onBlue ? BLUE : '#FFFFFF'}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

const VARIANT = StyleSheet.create({
  card: { backgroundColor: INK_CARD, borderRadius: ROW_RADIUS },
  primary: { backgroundColor: BLUE, borderRadius: radius.pill },
  outline: { backgroundColor: 'transparent', borderRadius: radius.pill },
});

const MARK = moderateScale(22);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: SELECT_BORDER,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  /** The two full-height variants: the design's 56 pt choice, not a list item. */
  tall: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  label: {
    ...type.headline,
    fontWeight: '500',
    color: color.textPrimary,
    flexShrink: 1,
  },
  labelOnBlue: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  /** Reserved so the label does not re-wrap when the chip appears. */
  mark: {
    width: MARK,
    height: MARK,
  },
  chip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
