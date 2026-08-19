import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PressableScale } from '@/components/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BLUE, BLUE_WASH, INK_CARD, INK_RING, ROW_RADIUS, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * One tappable answer (v3 design import, 18 Aug 2026).
 *
 * IDLE it is a soft grey card with an EMPTY RING on the right — the ring is the
 * whole point of the redesign. Before it, an unanswered question was five rows
 * with nothing on them, so the screen never said "one of these is a control you
 * have not used yet"; VoiceOver knew, and the eye did not. CHOSEN, the card
 * washes Recore blue, its edge becomes blue at 2 pt, and the ring fills with a
 * white check.
 *
 * The border is always 2 pt and only its COLOUR animates — idle it is drawn in
 * the card's own fill, so it is invisible. A border that grew from a hairline
 * would move the label inside it, and product-direction §4.3 does not allow
 * animating a layout property.
 *
 * ## One value, no pop (19 August 2026)
 *
 * The wash, the edge, the ring's colour and the check all read the SAME 160 ms
 * progress (`useSelectFill`), so choosing an answer is one movement rather than
 * four that happen to start together.
 *
 * The check used to be a separate shared value springing 0.6 → 1 on
 * `SPRING.press`, whose damping ratio is about 0.58 — it overshot, which is a
 * POP. A pop is a celebration, and answering question four of thirteen is not
 * one; it also made the mark arrive after the row it belongs to. And because it
 * was mounted on `selected`, DEselecting had no transition at all: the check
 * vanished while the row it sat in faded for another 160 ms.
 *
 * The mark now scales 0.7 → 1 on the shared progress, which cannot overshoot
 * because the progress is a timing curve, and it runs backwards on deselect for
 * free.
 *
 * ## Shape carries arity
 *
 * A round mark is a RADIO (one answer) and a rounded square is a CHECKBOX (as
 * many as you like). It is the same distinction the system controls draw, it is
 * the only signal on the page that says the obstacles screen accepts more than
 * one answer, and it costs one prop.
 *
 * ## The second line and the glyph
 *
 * `detail` is the design's quiet line under the label — what the answer means
 * for the app, in the person's own register. `emoji` is sanctioned by
 * product-direction §12 ("sparingly as an onboarding choice label when they
 * improve scanning") and appears on three screens of the flow. Neither is
 * announced separately: VoiceOver reads label and detail as one string, because
 * two labels on one control is two stops for one decision.
 */
export function OptionRow({
  label,
  detail,
  emoji,
  selected,
  onPress,
  multi = false,
}: {
  label: string;
  detail?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  /** Checkbox semantics and a square mark, instead of radio and a circle. */
  multi?: boolean;
}) {
  const p = useSelectFill(selected);

  const rowStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.get(), [0, 1], [INK_CARD, BLUE]),
    backgroundColor: interpolateColor(p.get(), [0, 1], [INK_CARD, BLUE_WASH]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      // A choice ticks, it does not thud — and it ticks on press-IN, in the
      // same frame the row dips, because that is the moment the finger landed.
      haptic="selection"
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      accessibilityState={multi ? { checked: selected } : { selected }}
      style={[styles.row, rowStyle]}>
      {emoji ? (
        <Text style={styles.emoji} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {emoji}
        </Text>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail}
          </Text>
        ) : null}
      </View>
      <SelectMark progress={p} square={multi} />
    </PressableScale>
  );
}

/**
 * The ring on the right: an empty ink outline until the answer is chosen, then
 * a filled blue mark with a white check.
 *
 * Both layers are ALWAYS mounted and read the row's own selection progress, so
 * there is nothing to mount or unmount mid-transition. The outline animates to
 * blue underneath the fill rather than being swapped for it — at full
 * selection the 1.5 pt ring and the disc inside it are the same blue, which
 * reads as one solid mark, and on the way there the edge and the fill arrive
 * together instead of the border snapping while the disc grows.
 */
function SelectMark({ progress, square }: { progress: SharedValue<number>; square: boolean }) {
  const shape = square ? styles.markSquare : styles.markRound;

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.get(), [0, 1], [INK_RING, BLUE]),
  }));
  // Never from zero: nothing in the real world appears out of nothing, and 0.7
  // is small enough to read as arriving without reading as a bounce.
  const fillStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.7 + 0.3 * progress.get() }],
  }));

  return (
    <Animated.View style={[styles.mark, styles.markRing, shape, ringStyle]}>
      <Animated.View style={[styles.markFill, shape, fillStyle]}>
        <Svg width={moderateScale(11)} height={moderateScale(11)} viewBox="0 0 16 16">
          <Path
            d="M3 8.5L6.5 12 13 4.5"
            stroke={color.onInk}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const MARK = moderateScale(24);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: ROW_RADIUS,
    borderCurve: 'continuous',
    borderWidth: SELECT_BORDER,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    // A 44 pt target even at the smallest type size, without a fixed height
    // (§14.3, 9 Aug: a fixed `height:` around a label is a defect).
    minHeight: moderateScale(56),
  },
  emoji: {
    fontSize: moderateScale(19),
    lineHeight: moderateScale(24),
  },
  text: {
    flex: 1,
    gap: 1,
  },
  label: {
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  /**
   * `textSecondary`, never `textMuted`: this line tells the person what the
   * answer will DO, which is information, and the 9 Aug ink ladder puts
   * anything that must be read at 4.5:1 or better.
   */
  detail: {
    ...type.subhead,
    color: color.textSecondary,
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Always drawn; only its colour moves. See `SelectMark`. */
  markRing: {
    borderWidth: 1.5,
  },
  markRound: {
    borderRadius: radius.pill,
  },
  markSquare: {
    borderRadius: moderateScale(7),
    borderCurve: 'continuous',
  },
  markFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
