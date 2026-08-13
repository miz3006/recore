import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { color, MAX_FONT_SCALE, moderateScale, spacing } from '@/lib/theme';

import { BLUE, CARD_RADIUS, INK_CARD, SELECT_BORDER } from './tokens';

/**
 * The single-line text answer of the flow (name, priority movement). A soft
 * card in the same language as an option row — ink at 3 %, no visible edge —
 * whose border becomes Recore blue while the field has focus, which is the
 * "interactive focus" §4.2 names as a permitted use of the accent.
 *
 * Both callers treat empty as a first-class "skip": §5 keeps these questions
 * optional.
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
    backgroundColor: INK_CARD,
    borderWidth: SELECT_BORDER,
    borderColor: INK_CARD,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: spacing.xl,
  },
  fieldFocused: {
    borderColor: BLUE,
  },
  input: {
    fontSize: moderateScale(17),
    fontWeight: '500',
    color: color.textPrimary,
    paddingVertical: spacing.lg,
  },
});
