import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { v2color, v2radius, v2shadow } from './tokens';

/**
 * A FIELD, on the canvas.
 *
 * Deliberately unanimated. §3's restraint clause bans "surprise movement while
 * someone is typing", and a field that reacts to focus with a spring is exactly
 * that — the keyboard is already a 250 ms layout change and anything moving on
 * top of it reads as a glitch. Focus is carried by the border colour alone,
 * which changes instantly.
 *
 * `multiline` is what screen 5 uses: the demo asks for a training line, and a
 * line that wraps must show all of itself, because the whole promise being
 * demonstrated is that the words stay exactly as they were written.
 */
export const V2TextField = forwardRef<TextInput, TextInputProps & { focused?: boolean }>(
  function V2TextField({ focused = false, style, ...props }, ref) {
    return (
      <View style={[styles.wrap, v2shadow, focused && styles.wrapFocused]}>
        <TextInput
          ref={ref}
          placeholderTextColor={v2color.inkMuted}
          selectionColor={v2color.blue}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[styles.input, style]}
          {...props}
        />
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: v2color.surface,
    borderRadius: v2radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: v2color.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: moderateScale(60),
    justifyContent: 'center',
  },
  wrapFocused: { borderColor: v2color.blue },
  input: {
    ...type.lede,
    fontWeight: '500',
    color: v2color.ink,
    padding: 0,
  },
});
