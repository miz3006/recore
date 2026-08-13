import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import type { WeightUnit } from '@/lib/prefs';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { BLUE, CARD_RADIUS, INK_CARD, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * The bodyweight step's VALUE CARD (owner's restyle, 12 Aug 2026) — the
 * reference app's pattern, recoloured: one soft card holding the number at hero
 * size in Recore blue, with a quiet "Tap to change" and a pencil under it.
 *
 * The number is a real `TextInput`, not a label over a hidden field: tapping
 * anywhere on the card focuses it and the numeric keyboard comes up, so the
 * value is edited exactly where it is read. It keeps the RAW typed text (the
 * store owns it; conversion to metric happens once at completion via
 * `parseBodyWeight`), and it is set in the reading voice with tabular figures
 * like every other number in the app.
 *
 * kg / lb stays a real segmented control under the card. It is a display unit,
 * not a value, so it does not belong inside the number.
 *
 * §5: this whole screen is optional. An empty card shows the placeholder in
 * muted ink and Continue stays live — skipping changes nothing essential.
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
  const field = useRef<TextInput>(null);
  const empty = value.trim().length === 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => field.current?.focus()}
        accessibilityRole="button"
        accessibilityLabel="Bodyweight. Tap to change."
        style={styles.card}>
        <View style={styles.valueRow}>
          <TextInput
            ref={field}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            keyboardType="decimal-pad"
            returnKeyType="done"
            maxLength={6}
            placeholder={unit === 'kg' ? '70' : '155'}
            placeholderTextColor={color.textMuted}
            style={[styles.value, empty && styles.valueEmpty]}
            accessibilityLabel="Bodyweight"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />
          <Text style={[styles.unit, empty && styles.valueEmpty]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {unit}
          </Text>
        </View>
        <View style={styles.hint}>
          <Icon name="pencil" size={moderateScale(12)} tint={color.textMuted} />
          <Text style={styles.hintText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Tap to change
          </Text>
        </View>
      </Pressable>

      <View style={styles.units}>
        {(['kg', 'lb'] as const).map((u) => (
          <UnitToggle key={u} unit={u} selected={unit === u} onPress={() => onChangeUnit(u)} />
        ))}
      </View>
    </View>
  );
}

/** The display-unit pair — the same soft-card-to-blue-border language as an
 * option row, at chip size. */
function UnitToggle({
  unit,
  selected,
  onPress,
}: {
  unit: WeightUnit;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useSelectFill(selected);

  const boxStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [INK_CARD, BLUE]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [color.textSecondary, BLUE]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.96}
      accessibilityRole="radio"
      accessibilityLabel={unit === 'kg' ? 'kilograms' : 'pounds'}
      accessibilityState={{ selected }}
      style={[styles.unitToggle, boxStyle]}>
      <Animated.Text style={[styles.unitToggleLabel, labelStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {unit}
      </Animated.Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    // Bottoms aligned rather than baselines: a TextInput's baseline is not
    // reliably reported on iOS, and the unit's own padding puts "kg" back on
    // the numeral's line.
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  value: {
    ...readingStyle('700'),
    fontSize: type.bigNumber.fontSize,
    letterSpacing: type.bigNumber.letterSpacing,
    color: BLUE,
    minWidth: moderateScale(72),
    textAlign: 'right',
    paddingVertical: 0,
  },
  valueEmpty: {
    color: color.textMuted,
  },
  unit: {
    ...readingStyle('600'),
    fontSize: moderateScale(22),
    paddingBottom: moderateScale(6),
    color: BLUE,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  hintText: {
    ...type.caption,
    color: color.textMuted,
  },
  units: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  unitToggle: {
    minWidth: moderateScale(64),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK_CARD,
    borderWidth: SELECT_BORDER,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  unitToggleLabel: {
    ...type.subhead,
    fontWeight: '600',
  },
});
