import { StyleSheet, Text, View } from 'react-native';

import { PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';

import { v2color, v2radius, v2shadow } from './tokens';

/** The step every load moves by. Barbell reality: 1,25 kg a side. */
const STEP_KG = 2.5;

/**
 * ONE KEY LIFT AND ITS CURRENT LOAD — screen 13.
 *
 * The load is an INPUT, so it does not count up (§3 reserves that for results).
 * It appears instantly, in the reading face with tabular figures, and the two
 * steppers move it a plate at a time. §2's own defence of this screen is that a
 * heavy screen late in the funnel is fine when it visibly improves the result —
 * so the number typed here is the number screen 17 hands back, unchanged apart
 * from the increment it states out loud.
 *
 * The steppers get the press spring and a selection tick each, which is the
 * same feedback as a picker detent: §3, "Pickers — haptic tick per unit
 * crossed."
 */
export function LiftLoadRow({
  label,
  kg,
  onChange,
}: {
  label: string;
  kg: number;
  onChange: (kg: number) => void;
}) {
  const shown = Number.isInteger(kg) ? String(kg) : kg.toFixed(1);

  return (
    <View style={[styles.row, v2shadow]}>
      <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.stepper}>
        <Stepper
          glyph="−"
          label={`Decrease ${label}`}
          disabled={kg <= STEP_KG}
          onPress={() => onChange(Math.max(STEP_KG, kg - STEP_KG))}
        />
        <View style={styles.readout}>
          <Text style={styles.value} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {shown}
          </Text>
          <Text style={styles.unit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            kg
          </Text>
        </View>
        <Stepper
          glyph="+"
          label={`Increase ${label}`}
          disabled={kg >= 400}
          onPress={() => onChange(Math.min(400, kg + STEP_KG))}
        />
      </View>
    </View>
  );
}

function Stepper({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityLabel={label}
      style={styles.stepButton}>
      <View style={[styles.stepInner, disabled && styles.stepDisabled]}>
        <Text style={styles.stepGlyph} maxFontSizeMultiplier={1.2}>
          {glyph}
        </Text>
      </View>
    </PressScale>
  );
}

const BUTTON = moderateScale(34);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: v2color.surface,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    minHeight: moderateScale(64),
  },
  label: { ...type.body, fontWeight: '600', color: v2color.ink, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepButton: {},
  stepInner: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,25,20,0.05)',
  },
  stepDisabled: { opacity: 0.35 },
  stepGlyph: { ...type.body, fontWeight: '600', color: v2color.ink, lineHeight: undefined },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: 3, minWidth: moderateScale(62), justifyContent: 'center' },
  value: { ...readingStyle('600'), fontSize: moderateScale(19), color: v2color.ink, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, color: v2color.inkSecondary },
});
