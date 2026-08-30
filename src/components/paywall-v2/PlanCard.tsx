import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { PressScale } from '@/lib/motion/index';
import { DUR, EASE } from '@/lib/motion';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  textRoom,
  type,
} from '@/lib/theme';

import { Check } from './Check';

/**
 * ONE PRICING CARD.
 *
 * Stacked full width, annual above monthly — the owner's brief, and Gravl's
 * arrangement (`6450921637/pay_k0cx3`) rather than Cal AI's side-by-side pair.
 * A full-width row survives a long localized price string; two half-width
 * cards do not, and "€1.199,99" in a Turkish storefront is exactly the case
 * that breaks them.
 *
 * ## THE INTERNAL ALIGNMENT: NAME AND PRICE LEFT, BADGE RIGHT
 *
 * Owner, 28 August 2026. Both of the card's facts — which plan this is and
 * what it costs — sit on one baseline in the left column, and the overhanging
 * label is the only thing on the right. It replaces an earlier arrangement
 * that pushed the price to the card's right edge and floated the badge in a row
 * ABOVE the card, and it is better on three counts:
 *
 *   · **The two cards are compared on one axis.** A price at the right edge is
 *     read after a round trip across the card; a price beside its own plan name
 *     is read with it, and the second card's price lands directly under the
 *     first one's rather than under a different amount of intervening text.
 *   · **The badge stops being a floating object.** It used to sit in its own
 *     row over the card because straddling the top border — the reference's
 *     placement — put an ink pill across a brand-blue outline and read as a
 *     break in the border. Inside the card there is no border to break.
 *   · **The card is one rectangle again.** Nothing overhangs, so the two cards
 *     are the same height whether or not one carries a badge, which is the
 *     other half of the brief.
 *
 * ## Identical heights, structurally — and the badge is on the SECOND row
 *
 * The badge shares the sub-line's row rather than sitting beside the whole left
 * column, and that is a measurement, not a preference. Beside the column it is
 * a flex sibling, so it takes ~95 pt of width away from EVERY row of the card;
 * on a 393 pt phone "Annual · 6,66 US$ · /mo" then no longer fits on one line,
 * wraps, and the annual card ends up a row taller than the monthly one — the
 * exact thing the brief rules out. Seen in the simulator with the badge forced
 * on, not reasoned about.
 *
 * On the sub-line's row it competes only with "12 months · 79,99 US$", which
 * leaves both of them comfortable at default type.
 *
 * ## `reserve` — the badge's footprint on the card that has no badge
 *
 * A `minHeight` alone equalises the two cards at default type and stops doing
 * so at an accessibility size: there the badge is wide enough that the annual
 * card's sub-line wraps to two lines while the monthly card's — which has the
 * whole row — stays on one, and the pair drift apart by a line again. Seen at
 * `accessibility-extra-extra-extra-large` in the simulator.
 *
 * So the card without a badge draws the SAME badge, invisible: same text, same
 * padding, same clamp, `opacity: 0`, and hidden from VoiceOver and from touch.
 * Both sub-lines then have identical width to wrap in and both rows have
 * identical height, at every type size, which is what "identical height
 * regardless of whether one carries a badge" actually requires. It costs the
 * monthly card some width it was not using for anything.
 *
 * ## The border does not grow
 *
 * Both states are `borderWidth: 2`; only the COLOUR moves, over `DUR.fast`.
 * recore-design §Motion: "Selection animates colour at constant border width;
 * a border never grows." A border that thickens on select nudges the label
 * inside it, which is a layout animation wearing a costume.
 *
 * ## Where the colour is allowed to be
 *
 * The selected border and the check inside it are brand blue — the second and
 * last place the accent appears on this screen, after the timeline nodes. The
 * "7 DAYS FREE" badge is INK, not accent: Cal AI's is black for the same
 * reason, and spending the accent on a badge would leave the screen with three
 * blues competing to be the thing you look at.
 *
 * The saving is not on the card at all — it is a comparison between the two,
 * so `plan.tsx` prints it as one quiet sentence underneath both. There is no
 * "56% OFF" flash here, coloured or otherwise.
 */

/** Precomputed OUTSIDE the worklet — a theme call inside `useAnimatedStyle` is
 * a runtime crash on the UI thread, not a type error. */
const BORDER_OFF = color.border;
const BORDER_ON = color.brand;

export interface PlanCardProps {
  title: string;
  /** "12 months · €39,99", "Billed every month". Never a promise, only what the
   * store charges and when. */
  sub: string;
  /** The big number: Apple's own localized string, or null while in flight. */
  price: string | null;
  /** "/mo", "/yr". Drawn a step lighter and lighter-weight than the number —
   * recore-design: a number and its unit are typographically two things. */
  unit: string;
  /** The label on the right. Annual only, and only when the store really offers
   * a trial on it. */
  badge?: string | null;
  /**
   * The OTHER card's badge, when this one has none — drawn invisible so both
   * cards measure the same. Pass the identical string, not a placeholder: it is
   * the width and height of that exact label that is being reserved.
   */
  reserve?: string | null;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

export function PlanCard({
  title,
  sub,
  price,
  unit,
  badge,
  reserve,
  selected,
  onPress,
  testID,
}: PlanCardProps) {
  const reduced = useReducedMotion();
  const on = useDerivedValue(() =>
    withTiming(selected ? 1 : 0, {
      duration: reduced ? 0 : DUR.fast,
      easing: EASE.emphasized,
    }),
  );

  const edge = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.get(), [0, 1], [BORDER_OFF, BORDER_ON]),
  }));

  const dot = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [BORDER_OFF, BORDER_ON]),
  }));

  return (
    <PressScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, price ? `${price}${unit}` : null, sub, badge]
        .filter(Boolean)
        .join(', ')}
      testID={testID}>
      <Animated.View style={[styles.card, edge]}>
        {/* Filled when chosen, a hollow ring when not. The ring is the same
            diameter in both states, so nothing shifts on selection. */}
        <Animated.View style={[styles.dot, dot]}>
          <View style={[styles.dotInner, selected && styles.dotInnerOn]}>
            {selected ? <Check size={moderateScale(13)} tint={color.onInk} /> : null}
          </View>
        </Animated.View>

        <View style={styles.labels}>
          {/* Name and price on one baseline — the left axis of the card, and it
              has the card's full width because the badge is a row below. */}
          <View style={styles.head}>
            <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
              {title}
            </Text>
            {/* NO PRICE AT ALL until the store supplies one (CLAUDE.md §2 rule
                5, `pricing.ts`). A dash is honest; an invented amount is not. */}
            <Text style={styles.price} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
              {price ?? '—'}
            </Text>
            {price ? (
              <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {unit}
              </Text>
            ) : null}
          </View>

          {/* What is charged, left; the label, right. The row keeps its height
              whether or not the label is drawn — see the header. */}
          <View style={styles.foot}>
            <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2}>
              {sub}
            </Text>
            {/* INK, not accent — and its own ghost on the card without one.
                See the header. */}
            {badge || reserve ? (
              <View
                style={[styles.badge, !badge && styles.badgeGhost]}
                pointerEvents="none"
                accessibilityElementsHidden={!badge}
                importantForAccessibility={badge ? 'auto' : 'no-hide-descendants'}>
                <Text style={styles.badgeText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                  {badge ?? reserve}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Animated.View>
    </PressScale>
  );
}

const DOT = moderateScale(26);

/** The badge at rest: one line of `footnote` plus its own vertical padding.
 * The card without a badge reserves exactly this on its second row. */
const BADGE_HEIGHT = lineFor(16) + spacing.xs * 2;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: moderateScale(72),
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 2,
    backgroundColor: color.surface,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The hollow centre. It fills with the card's own surface when unselected,
   * which is what turns the disc above into a ring without a second border. */
  dotInner: {
    width: DOT - 4,
    height: DOT - 4,
    borderRadius: (DOT - 4) / 2,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInnerOn: { backgroundColor: color.brand },
  labels: { flex: 1, gap: spacing.xs },
  /** `flexWrap`, so accessibility type moves the price under the plan name
   * instead of squeezing both to an ellipsis. The row is baseline-aligned:
   * three different sizes on one line only look deliberate when they sit on
   * the same line, not on the same box. */
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  /** The second row, and the reason the two cards measure the same: its
   * `minHeight` is the badge's own height, reserved on the card without one.
   * `textRoom` scales that reserve with the reader's type setting, so the row
   * never becomes the shorter of the two at an accessibility size. */
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: textRoom(BADGE_HEIGHT),
  },
  title: { ...type.headline, fontWeight: '700', color: color.textPrimary },
  price: { ...readingStyle('700'), fontSize: moderateScale(20), color: color.textPrimary },
  unit: { ...type.caption, color: color.textSecondary },
  sub: { ...type.caption, color: color.textSecondary, flex: 1 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: color.accent,
  },
  /** Present for measurement only. Not `display: none`, not conditional — the
   * whole point is that it occupies the space. */
  badgeGhost: { opacity: 0 },
  badgeText: {
    ...type.footnote,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: color.onInk,
  },
});
