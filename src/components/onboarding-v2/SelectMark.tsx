import Ionicons from '@expo/vector-icons/Ionicons';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { REDUCED_FADE_MS, select, tick } from '@/lib/motion/index';
import { alpha, color, moderateScale } from '@/lib/theme';

import { v2color } from './tokens';

/**
 * WHETHER THIS ROW IS THE ANSWER — the control the option rows never had.
 *
 * Until 9 September 2026 a v2 option row carried no selection affordance at
 * all: the whole row filled brand blue and that was the entire signal. It works
 * on a single-select screen and it is genuinely wrong on a multi-select one —
 * screens 3 and 15 say "pick up to two" and "pick the ones you watch most" over
 * five and six rows whose resting state is indistinguishable from a card. There
 * is nothing on the screen that says more than one row can be on, and nothing
 * that says a row is a control rather than a panel.
 *
 * ## The shape carries the arity, which is the whole point
 *
 * A **circle** means one of these; a **rounded square** means as many as you
 * like. That is the convention every list on the phone already uses, and it is
 * the cheapest possible way to answer "can I pick two?" before anybody has
 * tapped anything. It is information, not decoration, which is why it is drawn
 * in the resting state too rather than appearing on selection.
 *
 * ## Colour, and why the mark goes white rather than blue
 *
 * A selected row is a solid blue field. A blue check on it would have to sit in
 * a white disc to be legible at all, and a disc inside a ring is two containers
 * for one mark. So the container inverts instead: the ring fills WHITE and the
 * checkmark is drawn in the row's own blue. White-on-blue and blue-on-white are
 * the same measured ratio, so the mark is exactly as legible as the label
 * beside it in both states.
 *
 * Resting, the ring is `textMuted` — ink at 50%, which is ~3.4:1 on `surface`
 * and clears the 3:1 a non-text mark owes. `border` was tried first and is a
 * hairline colour: at 1.5 pt it read as a smudge rather than as an empty box.
 *
 * ## Motion
 *
 * Two springs, deliberately different. The ring's colours ride `select` (ζ≈0.90,
 * lands without bouncing) because they are the same state change the row's own
 * fill is making and the two must not separate. The check rides `tick` (ζ≈0.60)
 * a beat later, so the mark reads as landing INTO a box that has already turned
 * — the order the eye expects, and the reason it is a delay rather than a
 * second simultaneous spring.
 *
 * Nothing here animates a layout property: the ring's border width is constant
 * in both states (recore-design §Motion — "a border never grows"), the colours
 * interpolate, and the check scales.
 *
 * REDUCE MOTION: both cross-fade over 160 ms. The state is carried by the fill
 * and by `accessibilityState`, both correct on the first frame either way.
 */

/** Precomputed OUTSIDE the worklets. A theme call inside `useAnimatedStyle` is
 * a UI-thread crash, not a type error. */
const RING_OFF = alpha(color.onInk, 0);
const RING_ON = color.onInk;
const STROKE_OFF = v2color.inkMuted;
const STROKE_ON = color.onInk;

const BOX = 24;
/** The square's radius. 7 of 24 is iOS's own checkbox proportion — round
 * enough to read as soft, square enough to never be mistaken for the circle. */
const SQUARE_RADIUS = 7;
/** The check lands after the box has turned. One frame at 60 fps is 16 ms;
 * this is four of them, which is the smallest delay that reads as an order
 * rather than as lag. */
const CHECK_DELAY_MS = 70;

export function SelectMark({
  selected,
  /** Checkbox semantics — a rounded square instead of a circle. */
  multi = false,
}: {
  selected: boolean;
  multi?: boolean;
}) {
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const mark = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = reduced
      ? withTiming(selected ? 1 : 0, { duration: REDUCED_FADE_MS })
      : withSpring(selected ? 1 : 0, select);

    if (reduced) {
      mark.value = withTiming(selected ? 1 : 0, { duration: REDUCED_FADE_MS });
      return;
    }
    // Leaving is not the mirror of arriving. The check waits for the box on the
    // way in, because it is landing in it; on the way out it goes first, so the
    // row never shows a white box with nothing in it.
    mark.value = selected
      ? withDelay(CHECK_DELAY_MS, withSpring(1, tick))
      : withSpring(0, select);
  }, [mark, on, reduced, selected]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [RING_OFF, RING_ON]),
    borderColor: interpolateColor(on.value, [0, 1], [STROKE_OFF, STROKE_ON]),
  }));

  const check = useAnimatedStyle(() => ({
    opacity: mark.value,
    // From 0.4 rather than 0 — `scale(0)` is a point of light expanding, which
    // reads as a flash. A mark that starts at 40% reads as arriving.
    transform: [{ scale: 0.4 + mark.value * 0.6 }],
  }));

  const size = moderateScale(BOX);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: multi ? moderateScale(SQUARE_RADIUS) : size / 2,
        },
        box,
      ]}
      // The row above owns the accessibility state (`radio` / `checkbox` plus
      // `selected` / `checked`). This is that state drawn, and VoiceOver must
      // not read it a second time.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={check}>
        <SymbolView
          name="checkmark"
          size={moderateScale(13)}
          weight="bold"
          tintColor={v2color.blue}
          fallback={<Ionicons name="checkmark" size={moderateScale(15)} color={v2color.blue} />}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
