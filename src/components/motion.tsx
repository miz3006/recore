import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tap, tapMedium } from '@/lib/haptics';
import { DUR, EASE, SPRING, stagger } from '@/lib/motion';
import { alpha, color, MAX_FONT_SCALE } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The shared motion kit. Everything animated in the redesign routes through
 * these so the whole app moves with one hand: a tactile press-scale on every
 * tappable, a single fade-and-rise reveal, a staggered list entrance, the
 * onboarding progress bar, and a count-up numeral. All are reduceMotion-aware —
 * they resolve to the final state instantly when the user asks for less motion.
 */

type PressableScaleProps = {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  /** Extra style applied only while the finger is down (e.g. a fill wash). */
  pressedStyle?: StyleProp<ViewStyle>;
  /** How far the surface dips on press. Bigger surfaces dip less. */
  activeScale?: number;
  /** Haptic tick on press. 'light' by default; 'medium' for committed actions. */
  haptic?: 'light' | 'medium' | 'none';
  disabled?: boolean;
  hitSlop?: PressableProps['hitSlop'];
  delayLongPress?: number;
  accessibilityRole?: PressableProps['accessibilityRole'];
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: PressableProps['accessibilityState'];
  testID?: string;
};

/** A Pressable that dips on touch with a spring — the base tactile unit. */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  activeScale = 0.97,
  haptic = 'light',
  disabled,
  hitSlop,
  delayLongPress,
  ...a11y
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      delayLongPress={delayLongPress}
      onPressIn={() => {
        setPressed(true);
        if (!reduce) scale.value = withSpring(activeScale, SPRING.press);
      }}
      onPressOut={() => {
        setPressed(false);
        if (!reduce) scale.value = withSpring(1, SPRING.press);
      }}
      onPress={(e) => {
        if (haptic === 'light') tap();
        else if (haptic === 'medium') tapMedium();
        onPress?.(e);
      }}
      onLongPress={onLongPress}
      style={[animatedStyle, style, pressed ? pressedStyle : null]}
      {...a11y}>
      {children}
    </AnimatedPressable>
  );
}

/** Fade + rise on mount — the one reveal used everywhere. `layout` (optional)
 * forwards a Reanimated layout transition so a list can also reflow smoothly
 * when a sibling appears (the onboarding affirm line); callers gate it on
 * Reduce Motion themselves. */
export function FadeSlideIn({
  children,
  delay = 0,
  distance = 10,
  duration = DUR.base,
  style,
  layout,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: EASE.emphasized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * distance }],
  }));

  return (
    <Animated.View layout={layout} style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * Fade + settle-scale on mount — the reveal for a surface that should LAND
 * rather than rise: the onboarding illustration slot, the summary card. It
 * arrives a breath small (0.96) and settles to full size on the emphasized
 * ease — deliberate, no overshoot (nothing bounces except the PR flag).
 * Reduce Motion resolves to the final state instantly.
 */
export function FadeScaleIn({
  children,
  delay = 0,
  from = 0.96,
  duration = DUR.slow,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  /** Starting scale. */
  from?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: EASE.emphasized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: from + (1 - from) * p.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/**
 * The same reveal, on the X axis and with a direction — a step in a flow
 * arriving from the side it came from.
 *
 * It exists because a wizard that always slides in from the same side tells the
 * user nothing: going back looks exactly like going forward, so the motion is
 * decoration. Forward enters from the right, Back enters from the left, and the
 * screen suddenly reports where you are in the flow without a word of copy.
 *
 * Mount-only, so the caller keys it on the step. `distance` stays small — this
 * is a shift, not a carousel; the neighbouring screen is not rendered and
 * pretending otherwise would show empty paper.
 */
export function FadeSlideX({
  children,
  direction = 1,
  delay = 0,
  distance = 22,
  duration = DUR.base,
  style,
  layout,
}: {
  children: React.ReactNode;
  /** 1 = arriving from the right (forward), -1 = from the left (back). */
  direction?: 1 | -1;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  layout?: React.ComponentProps<typeof Animated.View>['layout'];
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: EASE.emphasized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateX: (1 - p.value) * distance * direction }],
  }));

  return (
    <Animated.View layout={layout} style={[animatedStyle, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * A gentle fade-through when content is replaced IN PLACE — the brief's
 * composed paragraph upgrading to the model's phrasing when the rewrite lands.
 * The new content dips to a third and rises over ~380 ms: one visible "the
 * page just rewrote itself", which product-direction §4.3 allows as "a value
 * updating once". Not a typewriter and not a shimmer — both would perform
 * generation instead of showing a result, and fake loading is banned. First
 * mount never animates (FadeSlideIn owns arrival), and under Reduce Motion the
 * swap is instant.
 */
export function FadeSwap({
  swapKey,
  children,
  style,
}: {
  /** Animates only when this changes between renders. */
  swapKey: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const opacity = useSharedValue(1);
  const prev = useRef(swapKey);

  useEffect(() => {
    if (prev.current === swapKey) return;
    prev.current = swapKey;
    if (reduce) return;
    opacity.value = 0.3;
    opacity.value = withTiming(1, { duration: DUR.slow, easing: EASE.standard });
  }, [swapKey, reduce, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}

/** Reveal each child in sequence — the same cadence as the rest of the app. */
export function Stagger({
  children,
  step = 55,
  initialDelay = 0,
  distance = 10,
}: {
  children: React.ReactNode;
  step?: number;
  initialDelay?: number;
  distance?: number;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <>
      {items.map((child, i) => (
        <FadeSlideIn key={i} delay={initialDelay + stagger(i, step)} distance={distance}>
          {child}
        </FadeSlideIn>
      ))}
    </>
  );
}

/** A thin animated progress bar — the onboarding spine. */
export function ProgressBar({
  progress,
  height = 3,
  trackColor = alpha(color.accent, 0.1),
  fillColor = color.accent,
  style,
}: {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const w = useSharedValue(progress);

  useEffect(() => {
    w.value = reduce ? progress : withTiming(progress, { duration: DUR.slow, easing: EASE.emphasized });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, w.value)) * 100}%`,
  }));

  return (
    <View style={[{ height, borderRadius: height, backgroundColor: trackColor, overflow: 'hidden' }, style]}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: fillColor }, fillStyle]} />
    </View>
  );
}

/** A numeral that counts up to its value — for stat heroes and the paywall. */
export function AnimatedCount({
  value,
  format = (n) => String(Math.round(n)),
  duration = DUR.slow,
  style,
  maxFontSizeMultiplier = MAX_FONT_SCALE,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  style?: StyleProp<TextStyle>;
  maxFontSizeMultiplier?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      from.current = value;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const e = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - e, 3); // easeOutCubic
      setDisplay(start + (value - start) * eased);
      if (e < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={style} maxFontSizeMultiplier={maxFontSizeMultiplier} allowFontScaling>
      {format(display)}
    </Text>
  );
}
