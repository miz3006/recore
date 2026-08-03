import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import type { WeightUnit } from '@/lib/prefs';
import {
  alpha,
  color,
  fonts,
  ink,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * The typed-bodyweight control of the illustrated flow: a numeric field with a
 * kg/lb toggle beside it. The field keeps the RAW text (the store owns it, the
 * conversion to metric happens once at completion via `parseBodyWeight`), and
 * the numerals are mono like every load in the app. Same surface language as
 * OptionRow; the active unit is solid ink with a paper label.
 */
export function WeightInput({
  value,
  unit,
  onChangeText,
  onChangeUnit,
  onSubmit,
}: {
  value: string;
  unit: WeightUnit;
  onChangeText: (text: string) => void;
  onChangeUnit: (unit: WeightUnit) => void;
  onSubmit?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={6}
          placeholder={unit === 'kg' ? '70' : '155'}
          placeholderTextColor={color.textMuted}
          style={styles.input}
          accessibilityLabel="Bodyweight"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
      </View>
      {(['kg', 'lb'] as const).map((u) => (
        <PressableScale
          key={u}
          onPress={() => onChangeUnit(u)}
          activeScale={0.96}
          accessibilityRole="radio"
          accessibilityLabel={u === 'kg' ? 'kilograms' : 'pounds'}
          accessibilityState={{ selected: unit === u }}
          style={[styles.unit, unit === u && styles.unitSelected]}>
          <Text
            style={[styles.unitLabel, unit === u && styles.unitLabelSelected]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {u}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    borderRadius: radius.md,
    backgroundColor: alpha(color.bg, 0.6),
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  input: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(22),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
    paddingVertical: spacing.lg,
  },
  unit: {
    minWidth: moderateScale(56),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    borderRadius: radius.md,
    backgroundColor: alpha(color.bg, 0.6),
    paddingHorizontal: spacing.lg,
  },
  unitSelected: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  unitLabel: {
    ...type.headline,
    color: color.textPrimary,
  },
  unitLabelSelected: {
    color: color.bg,
  },
});
