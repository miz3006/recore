import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
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
  type AnimatedStyle,
} from 'react-native-reanimated';

import { selection, tap, tapMedium } from '@/lib/haptics';
import { DUR, EASE, PRESS, PRESS_SCALE, stagger } from '@/lib/motion';
import { color, MAX_FONT_SCALE, radius } from '@/lib/theme';

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
  /**
   * The surface renders into an `Animated.Pressable`, so a caller may hand it
   * a `useAnimatedStyle` handle as readily as a plain object. Reanimated 4.5
   * stopped calling that handle a `ViewStyle` — it is an `AnimatedStyleHandle`
   * now — so the prop has to say `AnimatedStyle<ViewStyle>` or every animated
   * caller fails to typecheck.
   */
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  /**
   * Extra style applied only while the finger is down (e.g. a fill wash).
   *
   * **Prefer `wash`.** This one is a React state flip, so it costs a render on
   * touch-down and another on lift, and it can only ever CUT between two
   * states — it cannot fade. It stays for the dozen callers that swap a solid
   * fill (the ink CTA, the provider buttons), where a hard cut is the intent.
   */
  pressedStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  /**
   * Darken the surface under the content while the finger is down — the row
   * highlight, on the UI thread.
   *
   * This is what a bare RECORD row gets instead of a dip: the design skill's
   * `surfaceHigh` fading up behind the content, so the paper takes the press
   * and the ink never moves. It replaces the `opacity: 0.6` blink the ledger
   * rows used to do, which faded the record itself out — the one thing on this
   * page that must look permanent.
   */
  wash?: boolean;
  /** Geometry of that wash — inset it, or round it differently. It defaults to
   * the pressable's own box at `radius.md`. */
  washStyle?: StyleProp<ViewStyle>;
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
  /**
   * Custom rotor actions, and how an element hides itself from VoiceOver.
   *
   * Both exist for the same shape: a SECOND action inside a surface that is
   * already one accessible element. iOS merges a nested button away, so the
   * inner control opts out of the tree (`accessible={false}` +
   * `importantForAccessibility`) and the outer one publishes the action on the
   * rotor instead. A finger gets a target, VoiceOver gets a verb, and the row
   * is still read as one utterance.
   */
  accessibilityActions?: PressableProps['accessibilityActions'];
  onAccessibilityAction?: PressableProps['onAccessibilityAction'];
  accessible?: boolean;
  importantForAccessibility?: PressableProps['importantForAccessibility'];
  testID?: string;
};

/**
 * A Pressable that takes the finger — the base tactile unit.
 *
 * ## One shared value, both faces, and no render (6 September 2026)
 *
 * `p` runs 0 → 1 on touch-down and back on lift, and everything the press does
 * hangs off it: the dip, and the `wash` behind the content. It lives entirely
 * on the UI thread, so the feedback lands in the frame the touch does no matter
 * what the JS thread is busy with — and on this app's hottest screen the JS
 * thread is genuinely busy, because the composer re-parses the note on every
 * keystroke. A press that waits its turn behind a parse is the latency the
 * fluid-interface rules call the cliff.
 *
 * The old shape re-rendered on `onPressIn` and again on `onPressOut` — a React
 * state flip whose only job was to apply `pressedStyle`. That state now exists
 * only when a caller actually passes `pressedStyle`; the wash path never
 * renders at all.
 *
 * ## Asymmetric, and held
 *
 * In on `PRESS.in` (90 ms), out on `PRESS.out` (260 ms), never the same curve
 * both ways — see the token. The release is also floored at
 * `PRESS.minVisibleMs` from touch-down, so a fast tap gets the same feedback a
 * slow one does rather than a subliminal flicker.
 *
 * ## Reduce Motion keeps the press
 *
 * It drops the DIP and keeps the WASH. Less motion is not no feedback: a
 * surface that answers a touch with nothing at all reads as a dead control, and
 * a fill fading up in place is not vestibular. (Before this, Reduce Motion
 * removed every trace of press feedback from every button in the app.)
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  wash,
  washStyle,
  activeScale = PRESS_SCALE,
  haptic = 'light',
  disabled,
  hitSlop,
  delayLongPress,
  onLayout,
  ...a11y
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  // Only mounted for the legacy `pressedStyle` path — see the prop's note.
  const [pressed, setPressed] = useState(false);
  const downAt = useRef(0);

  // Resolved on the JS side and captured as a plain number: a worklet may read
  // a closed-over value, never call a helper to compute one.
  const dip = reduce ? 0 : 1 - activeScale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - dip * p.get() }],
  }));
  const washAnimatedStyle = useAnimatedStyle(() => ({ opacity: p.get() }));

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
        downAt.current = Date.now();
        if (pressedStyle) setPressed(true);
        // Same frame as the dip. See the `haptic` prop's note.
        if (haptic === 'selection') selection();
        p.set(withTiming(1, PRESS.in));
      }}
      onPressOut={() => {
        if (pressedStyle) setPressed(false);
        // Hold the press at depth until it has actually been seen.
        const held = Date.now() - downAt.current;
        const wait = Math.max(0, PRESS.minVisibleMs - held);
        p.set(withDelay(wait, withTiming(0, PRESS.out)));
      }}
      onPress={(e) => {
        if (haptic === 'light') tap();
        else if (haptic === 'medium') tapMedium();
        onPress?.(e);
      }}
      onLongPress={onLongPress}
      style={[animatedStyle, style, pressed ? pressedStyle : null]}
      {...a11y}>
      {/* Behind the content and out of the flex flow, so a row's own columns
          are laid out as if it were not here, and the ink paints over it. */}
      {wash ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.wash, washStyle, washAnimatedStyle]}
        />
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const PRESS_RETENTION = 16;

const styles = StyleSheet.create({
  /** The row highlight: the design system's one pressed-state fill
   * (`surfaceHigh`, canvas × 0.96), faded up rather than cut in. */
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    borderCurve: 'continuous',
  },
});

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
