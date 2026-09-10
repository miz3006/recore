import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PressScale, REDUCED_FADE_MS, select } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import type { MarkName } from './flow';
import { Mark } from './Mark';
import { SelectMark } from './SelectMark';
import { v2color, v2metrics, v2radius, v2shadow } from './tokens';

/** Precomputed. Nothing inside a worklet may call the theme. */
const FILL_OFF = v2color.surface;
const FILL_ON = v2color.blue;
const BORDER_OFF = v2color.border;
const BORDER_ON = v2color.blue;
const LABEL_OFF = v2color.ink;
const LABEL_ON = v2color.onBlue;
const SUB_OFF = v2color.inkSecondary;
const SUB_ON = 'rgba(255,255,255,0.82)';

/**
 * ONE OPTION.
 *
 * §3, "Option rows": "Press → scale 0.97 + `impactLight`, spring back on
 * release. Selection animates in on a spring, never an instant swap.
 * Single-select: outgoing animates out as incoming animates in, never both
 * active for a frame."
 *
 * That last clause is the reason this component is driven by a single `selected`
 * boolean per row rather than by an index held somewhere above: every row runs
 * its own spring from the same state change in the same frame, so the row
 * leaving and the row arriving cross in the middle. A parent that swapped a
 * "selected index" and re-rendered would give you one frame with both fills at
 * full strength, which is exactly the artefact the spec names.
 *
 * The fill, the border, both text colours and the leading mark interpolate
 * together on `select`. Colour is animated, geometry is not: the border never
 * grows, the row never changes height, and nothing here animates a layout
 * property.
 *
 * ## The row has three parts now, and the two new ones are not decoration
 *
 * **A leading system symbol** where the option names something a symbol can
 * honestly denote (`Mark`), and **a trailing selection control** on every row
 * (`SelectMark`). Before 9 September 2026 it had neither on seventeen of the
 * twenty screens, and what that produced is visible in a screenshot of any
 * question screen: five identical white slabs carrying one word each, with
 * nothing to say whether one of them or three of them can be on.
 *
 * ## THE WHITE DISC IS GONE, and its own reasoning is what removed it
 *
 * The mark used to sit in an opaque white disc, and the argument for it was
 * measured: *"a colour emoji cannot take a tint … ☀️'s defining rim lands at
 * 1.55:1 on the blue"*. Every glyph in this flow is now a single-ink path or a
 * system symbol, so that premise is simply no longer true — the mark takes the
 * label's colour and crosses to white with it on the same spring. The disc was
 * a container built for a legibility problem that no longer exists, and a
 * container around every glyph is the thing recore-design's bare-row structure
 * exists to refuse.
 *
 * REDUCE MOTION: the colours cross-fade over 160 ms instead of springing. The
 * information (which row is chosen) is never carried by the motion — it is
 * carried by the fill, the check and `accessibilityState`, all of which are
 * correct on the first frame.
 */
export function OptionRow({
  label,
  icon,
  sub,
  selected,
  onPress,
  multi = false,
}: {
  label: string;
  /**
   * A drawn mark or a system symbol — see `Mark.tsx`. Absent on the screens
   * whose options name numbers, durations or abstract states, and then the row
   * draws no leading slot at all: a mark that has to be invented to fill a slot
   * is the decoration the whole glyph rule exists to keep out.
   *
   * There is no `emoji` prop and there never will be one.
   */
  icon?: MarkName;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  /** Checkbox semantics instead of radio — and a square mark instead of a
   * circle, which is how the screen says "more than one" before anyone taps. */
  multi?: boolean;
}) {
  const reduced = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = reduced
      ? withTiming(selected ? 1 : 0, { duration: REDUCED_FADE_MS })
      : withSpring(selected ? 1 : 0, select);
  }, [on, reduced, selected]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [FILL_OFF, FILL_ON]),
    borderColor: interpolateColor(on.value, [0, 1], [BORDER_OFF, BORDER_ON]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [LABEL_OFF, LABEL_ON]),
  }));
  const subStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [SUB_OFF, SUB_ON]),
  }));
  /**
   * THE LEADING MARK CROSS-FADES BETWEEN TWO COPIES OF ITSELF, and it is not a
   * flourish — it is the only way to keep it on the label's spring.
   *
   * `Mark` resolves to a native `SymbolView` on iOS, whose `tintColor` is a
   * PROP rather than a style. A prop cannot be reached from a worklet, so the
   * mark's colour cannot be interpolated the way the label's is. Two copies at
   * complementary opacities give the identical result on the identical shared
   * value, which is what makes the mark and the label turn white together
   * rather than one of them snapping a frame late.
   */
  const markOff = useAnimatedStyle(() => ({ opacity: 1 - on.value }));
  const markOn = useAnimatedStyle(() => ({ opacity: on.value }));

  return (
    <PressScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      accessibilityState={multi ? { checked: selected } : { selected }}
      style={styles.press}>
      <Animated.View style={[styles.row, v2shadow, rowStyle]}>
        {icon ? (
          <View style={styles.markSlot}>
            <Animated.View style={[styles.markLayer, markOff]}>
              <Mark name={icon} size={moderateScale(MARK_SIZE)} tint={LABEL_OFF} />
            </Animated.View>
            <Animated.View style={[styles.markLayer, markOn]}>
              <Mark name={icon} size={moderateScale(MARK_SIZE)} tint={LABEL_ON} />
            </Animated.View>
          </View>
        ) : null}
        <View style={styles.text}>
          <Animated.Text style={[styles.label, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Animated.Text>
          {sub ? (
            <Animated.Text style={[styles.sub, subStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {sub}
            </Animated.Text>
          ) : null}
        </View>
        <SelectMark selected={selected} multi={multi} />
      </Animated.View>
    </PressScale>
  );
}

/** Big enough to hold its own beside 17 pt semibold in a 68 pt row. */
const MARK_SIZE = 22;
const MARK_BOX = 26;

const styles = StyleSheet.create({
  press: { marginBottom: v2metrics.optionGap },
  row: {
    // `minHeight`, never `height` — the row grows with Dynamic Type and with a
    // second line, and a fixed height would clip both.
    minHeight: v2metrics.optionHeight,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    // The gutter between a glyph and its label — one value from the scale, and
    // the same one on every row that has a glyph at all.
    gap: spacing.md,
  },
  /** A fixed box, so labels line up down the list whether their marks are wide
   * (`tablecells`) or narrow (`note.text`). SF Symbols are laid out by their
   * own metrics and a row of them is not otherwise flush. */
  markSlot: {
    width: moderateScale(MARK_BOX),
    height: moderateScale(MARK_BOX),
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLayer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  label: { ...type.body, fontWeight: '600' },
  sub: { ...type.subhead },
});
