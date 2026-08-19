import { StyleSheet, Text, View } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';

import { PressableScale } from '@/components/motion';
import type { WeightUnit } from '@/lib/prefs';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { BLUE, INK_CARD, ROW_RADIUS } from './tokens';
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
 * The value is `textPrimary` at a mono-ish weight because it is a NUMBER a
 * person has to read (the 9 Aug ink ladder), and both discs are 44 pt targets
 * even where they are drawn smaller.
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
        {current > 0 ? `${formatLoad(current)} ${unit}` : `— ${unit}`}
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
    backgroundColor: INK_CARD,
    borderRadius: ROW_RADIUS,
    borderCurve: 'continuous',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: moderateScale(56),
  },
  lift: {
    flex: 1,
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  value: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
    minWidth: moderateScale(64),
    textAlign: 'center',
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discQuiet: {
    backgroundColor: color.surface,
  },
  discBlue: {
    backgroundColor: BLUE,
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
