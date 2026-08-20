import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { blend, color, HIT, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';

import { CARD_FILL, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The single-line text answer of the flow (name, priority movement).
 *
 * A soft card in the same language as an option row — ink at 3 %, no visible
 * edge — whose border becomes Recore blue while the field has focus, which is
 * the "interactive focus" §4.2 names as a permitted use of the accent.
 *
 * ## What the 14 Aug pass added
 *
 * The field was a correct rectangle that did not look like anywhere to write.
 * Three changes, all of them about the field saying what it is:
 *
 *  - **A focus WASH, not only a border.** Two points of blue outline on warm
 *    paper is easy to miss; the same blue at 5 % behind the text makes the
 *    active field the brightest thing on the page.
 *  - **A taller target.** The whole card focuses the field, not only the line of
 *    text inside it.
 *  - **A clear button** once there is text. Backspacing a name a character at a
 *    time is the kind of small friction nobody reports and everybody feels.
 *
 * ## Focus is a transition, not a cut (19 August 2026)
 *
 * The edge and the wash arrive on the SAME 160 ms progress an option row uses,
 * because this is the same statement — "this one is live" — and until now it
 * was the only control in the flow that made it with a hard cut. Two points of
 * blue and a tinted card appearing in a single frame, at the exact moment the
 * keyboard starts rising, read as a flash rather than as focus.
 *
 * It costs nothing extra: the field already re-renders on focus for the hint
 * and the clear button, so the shared value replaces a style swap rather than
 * adding a subscription.
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
  hint,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  accessibilityLabel: string;
  /**
   * A trailing word inside the field ("Optional"), shown only while it is
   * empty — the design's way of saying a field may be skipped without spending
   * a line of subtext on it. It is decoration for the eye, not for VoiceOver:
   * the same fact belongs in the field's own label, which is where the caller
   * puts it.
   */
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const written = value.trim().length > 0;

  const p = useSelectFill(focused);
  const fieldStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.get(), [0, 1], [CARD_FILL, color.brand]),
    backgroundColor: interpolateColor(p.get(), [0, 1], [CARD_FILL, BRAND_FOCUS_WASH]),
  }));

  return (
    /* The whole card is the target, not just the glyph-height text line. */
    <AnimatedPressable
        onPress={() => input.current?.focus()}
        accessibilityRole="none"
        style={[styles.field, fieldStyle]}>
        <TextInput
          ref={input}
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
        {!written && hint ? (
          <Text
            style={styles.hint}
            importantForAccessibility="no"
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {hint}
          </Text>
        ) : null}
        {written ? (
          <Pressable
            onPress={() => {
              onChangeText('');
              input.current?.focus();
            }}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Clear"
            style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}>
            <Icon name="close" size={moderateScale(18)} tint={color.textMuted} />
          </Pressable>
        ) : null}
    </AnimatedPressable>
  );
}

/** The focus wash — blue at 5 %, the lightest tint that still reads as live. */
// `blend`, not `alpha`: the field's background ANIMATES to this, and 5 % of
// brand drawn translucently would composite against the page instead of
// against the white field it belongs to.
const BRAND_FOCUS_WASH = blend(color.brand, 0.05, color.surface);

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: moderateScale(58),
    backgroundColor: CARD_FILL,
    borderWidth: SELECT_BORDER,
    borderColor: CARD_FILL,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.xl,
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  input: {
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: '500',
    color: color.textPrimary,
    paddingVertical: spacing.md,
  },
  hint: {
    ...type.subhead,
    color: color.textMuted,
  },
  clear: {
    width: HIT - spacing.md,
    height: HIT - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  clearPressed: {
    opacity: 0.5,
  },
});
