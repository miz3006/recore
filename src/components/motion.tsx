import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Text,
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
  withTiming,
} from 'react-native-reanimated';

import { selection, tap, tapMedium } from '@/lib/haptics';
import { DUR, EASE, PRESS_SCALE, stagger } from '@/lib/motion';
import { MAX_FONT_SCALE } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The shared motion kit. Everything animated in the redesign routes through
 * these so the whole app moves with one hand: a tactile press-scale on every
 * tappable, a single fade-and-rise reveal, a staggered list entrance, and a
 * count-up numeral. All are reduceMotion-aware — they resolve to the final
 * state instantly when the user asks for less motion.
 *
 * ## Two things left this file on 19 August 2026
 *
 * `FadeSlideX` was the onboarding funnel's step-to-step transition: a
 * horizontal slide-and-crossfade per zone, keyed off a module global that
 * remembered which way the flow last moved. It is gone because the funnel is a
 * NATIVE STACK — `slide_from_right` with `animationMatchesGesture`, configured
 * in the route — and the platform already knows which direction it is going,
 * reverses itself under the back-swipe, and runs off the main thread. The JS
 * version was a second slide layered on top of the real one.
 *
 * `ProgressBar` animated `width` as a percentage, which is a layout pass per
 * frame for the fill and its siblings. The one progress bar in the app is the
 * onboarding rail, and it now lives in `ProgressRail` as a clipped track with a
 * TRANSLATED fill — see that file for why translate rather than scale.
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
  /**
   * Haptic tick. `light` by default; `medium` for a committed action.
   *
   * **`selection` fires on press-IN, the other two fire on press.** That is not
   * an inconsistency, it is the distinction iOS draws. A selection tick is
   * FEEDBACK — it says the finger landed on a choice — so it has to arrive in
   * the same frame as the visual dip; a tick that trails its own animation by
   * the length of a tap reads as a glitch rather than as touch. An impact tick
   * belongs to the COMMIT, which is press-out, and firing it early would buzz
   * for an action a finger slid off and cancelled.
   */
  haptic?: 'light' | 'medium' | 'selection' | 'none';
  disabled?: boolean;
  hitSlop?: PressableProps['hitSlop'];
  delayLongPress?: number;
  /** Passed through so a caller can measure the control it just rendered — the
   * paywall's plan cards, whose selection outline travels between them. */
  onLayout?: PressableProps['onLayout'];
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
  activeScale = PRESS_SCALE,
  haptic = 'light',
  disabled,
  hitSlop,
  delayLongPress,
  onLayout,
  ...a11y
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      // A finger that drifts a few points must not cancel a press the person
      // meant — the touch target is where the thumb landed, not where it ended.
      pressRetentionOffset={PRESS_RETENTION}
      delayLongPress={delayLongPress}
      onLayout={onLayout}
      onPressIn={() => {
        setPressed(true);
        // Same frame as the dip. See the `haptic` prop's note.
        if (haptic === 'selection') selection();
        if (!reduce) scale.set(withTiming(activeScale, PRESS_TIMING));
      }}
      onPressOut={() => {
        setPressed(false);
        if (!reduce) scale.set(withTiming(1, PRESS_TIMING));
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

/**
 * 120 ms on the emphasized ease, NOT a spring.
 *
 * This is the most frequent animation in the app, so it has to be
 * near-imperceptible: at 120 ms the only part of a spring anyone can see is its
 * settle, and `SPRING.press` is underdamped enough (dampingRatio ~0.58) that
 * the settle is a small wobble on release. A curve this short cannot overshoot,
 * and two shared-value writes per press is the whole cost — nothing re-renders,
 * nothing runs per frame.
 */
const PRESS_TIMING = { duration: DUR.press, easing: EASE.emphasized } as const;

const PRESS_RETENTION = 16;

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
    p.set(withDelay(delay, withTiming(1, { duration, easing: EASE.emphasized })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: (1 - p.get()) * distance }],
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
    p.set(withDelay(delay, withTiming(1, { duration, easing: EASE.emphasized })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ scale: from + (1 - from) * p.get() }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
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
    opacity.set(0.3);
    opacity.set(withTiming(1, { duration: DUR.slow, easing: EASE.standard }));
  }, [swapKey, reduce, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
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
