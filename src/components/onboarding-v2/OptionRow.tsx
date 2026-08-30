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

import { BrandIcon } from './BrandIcon';
import type { MarkName } from './flow';
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
// A stroked mark CAN take a tint, so on a selected row it goes ink on the
// white disc rather than white-on-white. This is the one way the two leading
// slots differ, and it is because one is a colour bitmap and one is a path.
const BRAND_ON = v2color.ink;
/** The white disc a mark sits in. Cal AI keeps its disc white on selected rows
 * too (diet screen, position 16) so the mark never fights the fill. */
const MARK_BOX = 36;
const DISC_BORDER_OFF = v2color.border;
const DISC_BORDER_ON = 'rgba(255,255,255,0.55)';

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
 * The fill, the border and both text colours interpolate together on `select`.
 * Colour is animated, geometry is not: the border never grows, the row never
 * changes height, and nothing here animates a layout property.
 *
 * REDUCE MOTION: the colours cross-fade over 160 ms instead of springing. The
 * information (which row is chosen) is never carried by the motion — it is
 * carried by the fill and by `accessibilityState`, both of which are correct on
 * the first frame.
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
   * A drawn mark — brand marks on screen 4, time-of-day marks on screen 18.
   * Absent on every other screen, and then the row draws no leading slot at
   * all: an empty disc beside a label is worse than no disc.
   *
   * There is no `emoji` prop any more. The flow's last two glyphs became paths
   * on 28 August 2026 (see `BrandIcon`, case 'evening').
   */
  icon?: MarkName;
  sub?: string;
  selected: boolean;
  onPress: () => void;
  /** Checkbox semantics instead of radio, for screens 3 and 13. */
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
   * THE DISC IS OPAQUE WHITE IN BOTH STATES, and that is a measurement, not a
   * preference.
   *
   * Cal AI keeps a white disc behind the glyph on its selected (black) rows as
   * well as its unselected ones — its diet screen, position 16 — so the icon
   * never has to change colour or fight the fill. Copying it works here for a
   * reason worth writing down: a colour emoji cannot take a tint, and both of
   * this flow's glyphs are warm gold. MEASURED against `#007AFF`, ☀️'s
   * defining rim lands at **1.55:1** — it sinks into the blue. On white it is
   * ~2.6:1. The disc is what makes the selected row legible.
   *
   * The unselected disc is white too, with a hairline, so the glyph's container
   * is one shape throughout and only the row around it changes.
   */
  const discStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [DISC_BORDER_OFF, DISC_BORDER_ON]),
  }));

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
          <Animated.View style={[styles.disc, discStyle]}>
            {/* The mark takes the label's colour, which is the whole reason it
                is drawn in one ink: on a selected row it goes white with the
                text instead of having to invert or vanish. */}
            <BrandIcon name={icon} size={moderateScale(20)} tint={selected ? BRAND_ON : LABEL_OFF} />
          </Animated.View>
        ) : null}
        <View style={styles.text}>
          <Animated.Text
            style={[styles.label, labelStyle]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Animated.Text>
          {sub ? (
            <Animated.Text
              style={[styles.sub, subStyle]}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {sub}
            </Animated.Text>
          ) : null}
        </View>
      </Animated.View>
    </PressScale>
  );
}

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
  disc: {
    width: moderateScale(MARK_BOX),
    height: moderateScale(MARK_BOX),
    borderRadius: moderateScale(MARK_BOX) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: v2color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  label: { ...type.body, fontWeight: '600' },
  sub: { ...type.subhead },
});
