import { StyleSheet, Text, View } from 'react-native';

import { GlassPressable } from '@/components/glass';
import { PressableScale } from '@/components/motion';
import {
  color,
  CTA_HEIGHT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';

/**
 * THE PINNED START — one full-width CTA at the bottom of Next (Symmetry's
 * Workout Detail, owner 28 August 2026).
 *
 * Symmetry pins two controls there, Edit Workout above Start Workout. Ours
 * pins one: editing moved to the title block, where it does not compete with
 * the action the screen exists to offer.
 *
 * ## What Start does, and what it refuses to do
 *
 * It hands Next's targets to Today as a CHECKLIST and writes nothing. A plan
 * filled into `raw_text` would count as performed the moment it landed — every
 * total, the week and the streak would report a workout nobody did — so the
 * session arrives as planned rows that have never been written, and ticking a
 * circle is what writes the line. `state/session-store.ts#startFromNext`.
 *
 * ## The colour, and the rule it sits against
 *
 * This CTA is PLANNED GREEN on the owner's ruling for this screen: *"Next is
 * the one screen in the app where everything is planned, so PLANNED green is
 * the dominant colour here rather than an accent — targets, the reason lines'
 * emphasis, the Start CTA."* Setgraph carries a whole screen on one green over
 * a light neutral canvas, and this is that.
 *
 * **It contradicts a standing rule and the contradiction is deliberate, not
 * overlooked.** `recore-design` §Colour says green *"never becomes a CTA, a
 * link or a selected state"*, and §Decided-1 makes the primary CTA a filled
 * brand-blue pill. The owner's instruction is later and more specific, so it
 * governs here — but it is the first green control in the app, and it is
 * flagged rather than quietly normalised. One line switches this back to
 * `AppButton variant="primary"` if the owner prefers the standing rule.
 *
 * Two consequences of the ruling, decided here so they are not decided by
 * accident:
 *
 *  - **No glow.** `shadow.glow` is brand-blue and belongs to the blue CTA
 *    alone; a green button wearing a blue halo would be the two systems
 *    arguing. It rests on `shadow.card` like every other floating surface.
 *  - **White on `signal`** measures the same 4.4962:1 as the ink-on-white
 *    direction. At the CTA's 17 pt semibold that is large text under WCAG,
 *    which owes 3:1, so the label clears comfortably — unlike the 11.5 pt
 *    figure in the reason line, which is the one place the shortfall bites.
 *
 * ## THE QUIET SHAPE IS GLASS; THE GREEN ONE IS NOT (9 September 2026)
 *
 * The two variants took opposite rulings in the iOS 26 pass, and the split is
 * the material rule working rather than an inconsistency:
 *
 * **Quiet is glass.** It is a control pinned over a list that scrolls beneath
 * it — the exact case `glass.tsx` reserves the material for — and its label is
 * `textPrimary`, which is 16:1 ink and stays ink whatever the glass picks up
 * from the rows passing under it. The bar was already built so "the list
 * visibly runs under it rather than stopping at a second edge"; glass is what
 * that sentence has been describing all along.
 *
 * **Start stays a filled green pill.** A CTA carries a WHITE label, and white
 * on glass has no measured ratio because glass has no fixed colour — the 4.4962
 * above is a number about `signal`, and it survives only while `signal` is
 * actually what is behind the label. The owner's ruling put the screen on one
 * green; dissolving that green into a material would spend the ruling and the
 * contrast in the same move.
 */
export function StartBar({
  label,
  onPress,
  /** The secondary shape: today is already written, so the action is to open
   * what exists rather than to begin something. Ink outline, no fill — a green
   * button offering to re-open a finished session would be the screen calling
   * a record a plan. */
  quiet = false,
  bottomInset = 0,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  bottomInset?: number;
}) {
  return (
    <View style={[styles.bar, { paddingBottom: bottomInset + spacing.md }]} pointerEvents="box-none">
      {quiet ? (
        <GlassPressable
          haptic="none"
          activeScale={0.98}
          onPress={onPress}
          radius={radius.pill}
          contentStyle={styles.cta}
          accessibilityLabel={label}>
          <Text
            style={[styles.label, styles.labelQuiet]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </GlassPressable>
      ) : (
        <PressableScale
          haptic="none"
          activeScale={0.98}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[styles.cta, styles.ctaShape, styles.ctaStart]}>
          <Text
            style={[styles.label, styles.labelStart]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}

/** What a scroll must clear so its last row is never parked under the bar. */
export const START_BAR_CLEARANCE = CTA_HEIGHT + TAB_BAR_CLEARANCE + spacing.xxl;

const styles = StyleSheet.create({
  /**
   * Pinned, and clearing the tab bar BY HAND — the skill's rule for anything
   * that floats over a tab scroll. The canvas shows through: the bar is the
   * button and its air, not a bordered dock, so the list visibly runs under it
   * rather than stopping at a second edge.
   *
   * NO HORIZONTAL PADDING OF ITS OWN. It is absolutely positioned inside
   * `StubScreen`'s body, and an absolute child is laid out against its
   * parent's PADDING box — so `left: 0` already sits on the body gutter. Adding
   * `spacing.xxl` here would inset the button twice and it would not line up
   * with the rows above it.
   */
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: TAB_BAR_CLEARANCE,
  },
  // Size and content layout — shared, so both shapes are the same button at the
  // same height whichever material draws them.
  cta: {
    minHeight: CTA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  // The filled shape draws its own corner and lift; the glass one gets both
  // from its material.
  ctaShape: {
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    ...shadow.card,
  },
  ctaStart: {
    backgroundColor: color.signal,
  },
  label: {
    ...type.headline,
    letterSpacing: moderateScale(0.1),
  },
  labelStart: {
    color: color.surface,
  },
  labelQuiet: {
    color: color.textPrimary,
  },
});
