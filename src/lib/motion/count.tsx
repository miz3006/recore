import { useEffect } from 'react';
import { StyleSheet, TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { count, REDUCED_FADE_MS } from './springs';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * A NUMBER THAT IS A RESULT, counting up from zero (§3, "Numbers": "Every
 * number that appears as a *result* — not an input — counts up from zero on a
 * spring on mount").
 *
 * The distinction matters and the flow enforces it: a load the person TYPED on
 * screen 13 is shown as typed, instantly, because animating someone's own
 * input back at them implies the app is deciding it. A load the app WORKED OUT
 * — the +2.5 kg on screen 17, the percentage on 16 — counts, because the count
 * is the app showing its arithmetic.
 *
 * ## Why a TextInput
 *
 * Text content cannot be driven from the UI thread on a `<Text>`; a
 * `TextInput`'s `text` prop can. So this is a non-editable, non-focusable
 * TextInput that renders as text. It is the standard Reanimated pattern and it
 * is the only way to count sixty times a second without a re-render per frame.
 *
 * TABULAR FIGURES are on by default (`fontVariant`) so the width does not
 * jitter as digits change — §3 asks for it by name.
 *
 * REDUCE MOTION: the final value is set immediately and only opacity fades in.
 * No information waits on the animation, ever.
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  /** Locales that write 82,5 instead of 82.5. Off by default: the v2 flow is
   * English, and a load with a comma in it reads as a thousands separator. */
  decimalComma = false,
  delay = 0,
  style,
  accessibilityLabel,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  decimalComma?: boolean;
  delay?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(reduced ? value : 0);
  const opacity = useSharedValue(reduced ? 0 : 1);

  useEffect(() => {
    if (reduced) {
      shown.value = value;
      opacity.value = withDelay(delay, withTiming(1, { duration: REDUCED_FADE_MS }));
      return;
    }
    opacity.value = 1;
    shown.value = 0;
    shown.value = withDelay(delay, withSpring(value, count));
  }, [delay, opacity, reduced, shown, value]);

  const animatedProps = useAnimatedProps(() => {
    const fixed = shown.value.toFixed(decimals);
    const text = decimalComma ? fixed.replace('.', ',') : fixed;
    return { text: text + suffix, defaultValue: text + suffix };
  });

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const finalText =
    (decimals > 0 && decimalComma ? value.toFixed(decimals).replace('.', ',') : value.toFixed(decimals)) +
    suffix;

  return (
    <AnimatedTextInput
      editable={false}
      // The value is announced whole; VoiceOver never reads a counting number.
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? finalText}
      importantForAccessibility="yes"
      underlineColorAndroid="transparent"
      scrollEnabled={false}
      pointerEvents="none"
      style={[styles.base, style, fade]}
      animatedProps={animatedProps}
      defaultValue={reduced ? finalText : '0'}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    // A TextInput carries platform padding a Text does not. Strip it so the
    // number sits on the same baseline as the label beside it.
    padding: 0,
    margin: 0,
    fontVariant: ['tabular-nums'],
  },
});

/**
 * A NUMBER THAT FOLLOWS A CHANGING VALUE, rather than counting once from zero.
 *
 * `CountUp` resets to 0 and springs to its value on mount, which is right for a
 * result that appears. Screen 16's percentage is a different thing: it is a
 * readout of work that is still happening, so it has to spring from wherever it
 * currently is to wherever the work has got to, and never restart.
 *
 * Same spring, same tabular figures, same rule about Reduce Motion — under it
 * the number simply jumps to each new value, which is exactly as informative.
 */
export function TrackingNumber({
  value,
  decimals = 0,
  suffix = '',
  style,
  accessibilityLabel,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(value);

  useEffect(() => {
    shown.value = reduced ? value : withSpring(value, count);
  }, [reduced, shown, value]);

  const animatedProps = useAnimatedProps(() => {
    const text = shown.value.toFixed(decimals) + suffix;
    return { text, defaultValue: text };
  });

  return (
    <AnimatedTextInput
      editable={false}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${value.toFixed(decimals)}${suffix}`}
      underlineColorAndroid="transparent"
      scrollEnabled={false}
      pointerEvents="none"
      style={[styles.base, style]}
      animatedProps={animatedProps}
      defaultValue={`${value.toFixed(decimals)}${suffix}`}
    />
  );
}
