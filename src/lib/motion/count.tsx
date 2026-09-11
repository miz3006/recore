import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FIXED_FONT_SCALE } from '@/lib/theme';

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
  /**
   * THE CLAMP, AND IT DEFAULTS TO THE GEOMETRY ONE (10 September 2026).
   *
   * This component had **no clamp at all**, so the number scaled with the
   * reader's text setting without limit. At `accessibility-extra-large` on the
   * iOS 26.5 simulator that is roughly ×2.3, which took the progression card's
   * 44 pt reading past 100 pt: "100.5 kg" rendered as "100." with the unit
   * pushed off the right edge of the card. The number is the whole point of
   * that screen and it was the one thing on it you could not read.
   *
   * `FIXED_FONT_SCALE` is the app's own answer for "text locked inside geometry"
   * — a reading pinned into a card that cannot grow with it. Every caller is
   * that case: the progression metric cards and the three onboarding screens
   * that count a number up inside a fixed illustration band. A caller that ever
   * has room to grow can pass `MAX_FONT_SCALE` explicitly.
   */
  maxFontSizeMultiplier = FIXED_FONT_SCALE,
  /**
   * OPT IN TO A BOX THE FINISHED NUMBER SIZES. Off by default, and that default
   * is not timidity — `InsightScreen` renders this component as an INLINE CHILD
   * OF A `<Text>`, and a `View` may not be nested inside a `Text` in React
   * Native. A number set into a sentence must stay a bare node.
   *
   * Turn it on wherever the number sits in a ROW beside something else — a
   * unit, a delta — which is the case the sizer exists for. See the render.
   */
  sized = false,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  decimalComma?: boolean;
  delay?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  maxFontSizeMultiplier?: number;
  sized?: boolean;
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

  const input = (
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
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={sized ? [styles.base, styles.paint, style, fade] : [styles.base, style, fade]}
      animatedProps={animatedProps}
      defaultValue={reduced ? finalText : '0'}
    />
  );

  if (!sized) return input;

  return (
    /**
     * A `Text` SIZES THE BOX; THE `TextInput` ONLY PAINTS IN IT (10 Sep 2026).
     *
     * The number has to be a `TextInput`, because that is the one RN node whose
     * string can be driven from a worklet (`animatedProps.text`) without a JS
     * render per frame. It is also a node with **no intrinsic width**: it does
     * not shrink-wrap its content the way a `Text` does, and the string arriving
     * from the UI thread never triggers a re-layout at all. At the default text
     * size the box happened to land close enough to the digits that nobody
     * noticed. At `accessibility-extra-large` on the iOS 26.5 simulator it did
     * not: the progression card's "kg" was pushed a third of the card to the
     * right of "86" and sat below its baseline, because the box it was
     * following was neither the width nor the height of the number inside it.
     *
     * So the layout is a real `Text` holding the FINAL string — which is known
     * without waiting for the animation — and the counting input is laid over
     * it. Three things fall out of that and all three are the point:
     *   · the box is exactly as wide as the finished number, so a unit beside it
     *     sits where a reader expects it whatever the text size;
     *   · Yoga takes a `View`'s baseline from its first child, and the first
     *     child is now a `Text`, so `alignItems: 'baseline'` finally means what
     *     it says next to this component;
     *   · the sizer carries the same clamp, so the two can never disagree.
     *
     * The sizer is invisible and hidden from VoiceOver — the input above it
     * already announces the value whole.
     */
    <View style={styles.box}>
      <Text
        style={[styles.sizer, style]}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        accessible={false}
        importantForAccessibility="no-hide-descendants">
        {finalText}
      </Text>
      {input}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Sized by the sizer, painted by the input. No padding of its own — the
   * caller's style lands on the text, not on this. */
  box: {
    position: 'relative',
  },
  /** The finished number, drawn and then made invisible. `opacity` rather than
   * `display: none`, because a hidden box measures nothing. */
  sizer: {
    opacity: 0,
    fontVariant: ['tabular-nums'],
  },
  base: {
    // A TextInput carries platform padding a Text does not. Strip it so the
    // number sits on the same baseline as the label beside it.
    padding: 0,
    margin: 0,
    fontVariant: ['tabular-nums'],
  },
  /** Over the sizer, edge to edge, so the counting digits land exactly where
   * the finished ones will. */
  paint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
