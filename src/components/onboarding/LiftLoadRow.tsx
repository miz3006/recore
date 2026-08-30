import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import type { WeightUnit } from '@/lib/prefs';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { CARD_FILL, INK_TRACK } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * A starting load for one key lift — the ONLY numeric input left in the flow
 * (v3 design import, 18 Aug 2026).
 *
 * It is a STEPPER, not a text field, and that is the whole design decision. A
 * keyboard here would cost a keyboard transition per lift on a screen that has
 * three of them, and it would accept 61.3 kg, which is not a load anybody can
 * put on a bar. The stepper can only ever produce a real plate jump (see
 * `stepperStep`), so the number this screen hands to the projection is always
 * a load somebody could actually load.
 *
 * `minus` is a quiet white disc and `plus` is the blue one: adding weight is
 * the direction this screen exists for, and the design draws the asymmetry.
 *
 * The value is set in the READING FACE, in full ink, with the unit a step down
 * and a weight lighter — a number and its unit are typographically two things
 * (skill §Structure, §Decided-5). It was the sans headline face, which is the
 * app's speaking voice: every other load in Recore is reported in the reading
 * face, and the one place a person SETS one should not be the exception.
 *
 * The quiet disc is `INK_TRACK`, not white. It was `color.surface` on a card
 * that is itself `color.surface` — a control with neither border nor shadow on
 * a surface of its own colour, which is invisible by definition (skill
 * §Spacing, radii, elevation); all that was left of the minus button was its
 * glyph floating on the row. Both discs are 44 pt targets either way.
 *
 * ## Motion (19 August 2026)
 *
 * Each tap is a SELECTION tick, not an impact — this is a stepper, which is
 * exactly the picker-detent case: a value passing a step. Somebody seeding a
 * bench press taps `+` a dozen times in a row, and a dozen impacts in a row is
 * how a person learns to turn haptics off.
 *
 * The `−` disc FADES to its inert state rather than flipping. It changes at the
 * two ends of the range while the finger is still on it, and a control that
 * dims in the same frame as the tap that dimmed it looks like a mis-render.
 */
export function LiftLoadRow({
  lift,
  value,
  unit,
  onChange,
}: {
  lift: string;
  /** The current load in `unit`, or null when nothing has been set yet. */
  value: number | null;
  unit: WeightUnit;
  onChange: (next: number) => void;
}) {
  const step = stepperStep(unit);
  const current = value != null && value > 0 ? value : 0;
  const max = unit === 'lb' ? 1100 : 500;

  /**
   * The first tap on "+" SEEDS the row at an empty bar rather than at one
   * step, so nobody taps their way up from zero. Twenty kilos is a fact about
   * a barbell, not a guess about the person — the one number this screen is
   * allowed to put in front of somebody who has typed nothing.
   */
  const bump = (delta: number) => {
    if (current <= 0) {
      onChange(seedLoad(unit));
      return;
    }
    const next = Math.round((current + delta) / step) * step;
    onChange(Math.max(step, Math.min(max, next)));
  };

  return (
    <View style={styles.row}>
      <Text style={styles.lift} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {lift}
      </Text>
      <MinusDisc lift={lift} disabled={current <= step} onPress={() => bump(-step)} />
      <Text style={styles.value} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {current > 0 ? formatLoad(current) : '—'}
        <Text style={styles.unit}>{` ${unit}`}</Text>
      </Text>
      <PressableScale
        onPress={() => bump(step)}
        activeScale={0.9}
        haptic="selection"
        hitSlop={spacing.sm}
        accessibilityRole="button"
        accessibilityLabel={`More weight for ${lift}`}
        style={[styles.disc, styles.discBlue]}>
        <Text style={styles.glyphBlue} maxFontSizeMultiplier={1}>
          +
        </Text>
      </PressableScale>
    </View>
  );
}

/** The quiet side of the stepper, which is the one that can run out of range. */
function MinusDisc({
  lift,
  disabled,
  onPress,
}: {
  lift: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const off = useSelectFill(disabled);
  const discStyle = useAnimatedStyle(() => ({ opacity: 1 - DISC_DIM * off.get() }));

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      activeScale={0.9}
      haptic="selection"
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={`Less weight for ${lift}`}
      accessibilityState={{ disabled }}
      style={[styles.disc, styles.discQuiet, discStyle]}>
      <Text style={styles.glyphQuiet} maxFontSizeMultiplier={1}>
        −
      </Text>
    </PressableScale>
  );
}

/**
 * The STEPPER's jump — two plates of `loadStep`, not one.
 *
 * `loadStep` is the smallest jump a projection may round to (2.5 kg), and it is
 * the right number there. Here it would mean twenty-four taps to reach a
 * working bench, so the control moves in fives and the projection still lands
 * on halves. Both are real loads; only one of them is a reasonable number of
 * taps.
 */
function stepperStep(unit: WeightUnit): number {
  return unit === 'lb' ? 10 : 5;
}

/** An empty Olympic bar, in the person's unit. */
function seedLoad(unit: WeightUnit): number {
  return unit === 'lb' ? 45 : 20;
}

/** 62.5 stays 62.5; 60 does not become 60.0. */
export function formatLoad(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

const DISC = moderateScale(30);
/** How far the `−` disc drops when the load is already at the bottom step. */
const DISC_DIM = 0.6;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: CARD_FILL,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: moderateScale(56),
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  lift: {
    flex: 1,
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  value: {
    ...readingStyle('700'),
    fontSize: moderateScale(17),
    lineHeight: lineFor(22),
    color: color.textPrimary,
    minWidth: moderateScale(70),
    textAlign: 'center',
  },
  unit: {
    ...readingStyle('500'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** A recessed disc on a white card — see the note above on why it may not be
   * `surface`. `INK_TRACK` is the same ink-at-10 % the progress bar's empty
   * track uses, which is what "a control that is off" looks like in this flow. */
  discQuiet: {
    backgroundColor: INK_TRACK,
  },
  discBlue: {
    backgroundColor: color.brand,
  },
  glyphQuiet: {
    fontSize: moderateScale(19),
    lineHeight: moderateScale(22),
    fontWeight: '600',
    color: color.textPrimary,
  },
  glyphBlue: {
    fontSize: moderateScale(19),
    lineHeight: moderateScale(22),
    fontWeight: '600',
    color: color.onInk,
  },
});
