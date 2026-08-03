import { StyleSheet, TextInput, View } from 'react-native';

import { alpha, color, ink, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';

/**
 * The single-line text answer of the illustrated flow (name, priority
 * movement). Same surface language as OptionRow — paper at 60% with an ink
 * hairline — and a sans face, because mono is reserved for numerals (the
 * design law's ledger voice). Both callers treat empty as a first-class
 * "skip": §5 keeps these questions optional.
 */
export function TextField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View style={styles.field}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={color.textMuted}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        maxLength={60}
        style={styles.input}
        accessibilityLabel={accessibilityLabel}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 0.5,
    borderColor: alpha(color.accent, ink.grabber),
    borderRadius: radius.md,
    backgroundColor: alpha(color.bg, 0.6),
    paddingHorizontal: spacing.xl,
  },
  input: {
    fontSize: moderateScale(17),
    fontWeight: '500',
    color: color.textPrimary,
    paddingVertical: spacing.lg,
  },
});
