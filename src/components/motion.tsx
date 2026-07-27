import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { tap, tapMedium } from '@/lib/haptics';
import {
  alpha,
  easing,
  MAX_FONT_SCALE,
  moderateScale,
  spring,
  stagger,
  timing,
  useTheme,
} from '@/lib/theme';

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
  /**
   * How far the surface dims on press, animated on the UI thread alongside the
   * dip. Prefer this over a `pressedStyle` opacity: the latter hard-cuts from a
   * JS state change, so under a busy frame (a parse landing) the dim visibly
   * lags the scale. 1 = no dim.
   */
  activeOpacity?: number;
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

/**
 * A Pressable that dips on touch with a spring — the base tactile unit.
 *
 * The dip AND the haptic both fire on press-IN, on the same event, because the
 * two senses have to agree: a tick that arrives on release describes a different
 * moment than the one the finger just felt, and the interface stops reading as
 * direct. (Waiting for the release also costs the whole press duration in
 * perceived latency, which is the one thing no amount of easing can recover.)
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  pressedStyle,
  activeScale = 0.97,
  activeOpacity = 1,
  haptic = 'light',
  disabled,
  hitSlop,
  delayLongPress,
  ...a11y
}: PressableScaleProps) {
  const reduce = useReducedMotion();
  const press = useSharedValue(0); // 0 released → 1 held
  const [pressed, setPressed] = useState(false);

  // Reduce Motion drops the movement, never the feedback: the dim survives
  // (it carries no vestibular signal), the dip does not.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : 1 - press.value * (1 - activeScale) }],
    opacity: 1 - press.value * (1 - activeOpacity),
  }));

  return (
    <AnimatedPressable
      disabled={disabled}
      hitSlop={hitSlop}
      delayLongPress={delayLongPress}
      onPressIn={() => {
        if (pressedStyle) setPressed(true);
        if (haptic === 'light') tap();
        else if (haptic === 'medium') tapMedium();
        press.value = withSpring(1, spring.snap);
      }}
      onPressOut={() => {
        if (pressedStyle) setPressed(false);
        press.value = withSpring(0, spring.snap);
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[animatedStyle, style, pressed ? pressedStyle : null]}
      {...a11y}>
      {children}
    </AnimatedPressable>
  );
}

/** Fade + rise on mount — the one reveal used everywhere. */
export function FadeSlideIn({
  children,
  delay = 0,
  distance = 10,
  duration = timing.base.duration,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) return;
    p.value = withDelay(delay, withTiming(1, { duration, easing: easing.emphasized }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * distance }],
  }));

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

// ————————————————————————————————————————————— §7.2 · the named transitions
// Four movements with names, because a movement with a name can be reused and
// a movement without one gets re-invented slightly differently every time.
// Every one of them maps under Reduce Motion rather than switching off (§7.5):
// reduced motion must never remove information, only movement.

/**
 * `card.settle` — a parsed line becomes a card.
 *
 * translateY 8→0 + opacity 0→1 on `snap`, staggered 40ms per card. This is the
 * app's most-seen animation by an order of magnitude: it is what "the machine
 * read what I wrote" looks like, and it is the reason a settled card feels like
 * a receipt rather than a re-render.
 *
 * Reduced: opacity only, `fast`, and the whole session arrives at once.
 */
export function CardSettle({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  /** Position in the session, for the 40ms stagger. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Rise distance={8} delay={stagger(index)} spec={spring.snap} style={style}>
      {children}
    </Rise>
  );
}

/**
 * `summary.rise` — the session summary arrives under the last card.
 *
 * translateY 24→0 + opacity on `settle`. Further and heavier than a card,
 * because it is a bigger surface and because finishing should feel like
 * something landing rather than something appearing.
 */
export function SummaryRise({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Rise distance={24} spec={spring.settle} style={style}>
      {children}
    </Rise>
  );
}

/** The shared body of `card.settle` and `summary.rise`. */
function Rise({
  children,
  distance,
  delay = 0,
  spec,
  style,
}: {
  children: React.ReactNode;
  distance: number;
  delay?: number;
  spec: typeof spring.snap;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      p.value = 1;
      return;
    }
    p.value = withDelay(delay, withSpring(1, spec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: reduce ? 1 : p.value,
    transform: [{ translateY: reduce ? 0 : (1 - p.value) * distance }],
  }));

  // Under Reduce Motion the movement is dropped and the fade takes over on the
  // fast curve — the card still announces itself, it just does not travel.
  const reducedStyle = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <Animated.View style={[reduce ? reducedStyle : animatedStyle, style]}>{children}</Animated.View>
  );
}

/**
 * `read.pulse` — a parse is in flight.
 *
 * The reading row breathes between 0.4 and 0.7 on `gentle`, forever, and stops
 * **the instant** a result lands. It is the app's only loading state (§12.2:
 * under 400ms show nothing, 400ms–2s pulse the specific element, never a
 * full-screen spinner) and it is deliberately not a spinner: a spinner says
 * "wait", and this says "still reading" about one specific line.
 *
 * Reduced: static at 0.55 — the mid-point, so the row still reads as provisional
 * without anything moving.
 */
export function ReadPulse({
  children,
  active = true,
  style,
}: {
  children: React.ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReducedMotion();
  const o = useSharedValue(reduce ? 0.55 : 0.4);

  useEffect(() => {
    if (reduce) {
      o.value = 0.55;
      return;
    }
    if (!active) {
      // Cancel to full opacity: the reading stopped being provisional the moment
      // the result arrived, and a fade-out here would read as the row leaving.
      o.value = withTiming(1, timing.fast);
      return;
    }
    o.value = 0.4;
    o.value = withRepeat(withSequence(withSpring(0.7, spring.gentle), withSpring(0.4, spring.gentle)), -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);

  return <Animated.View style={[{ opacity: o }, style]}>{children}</Animated.View>;
}

/**
 * `read.arc` — the reading indicator, set to the RIGHT of the line being read.
 *
 * OWNER RULING, 27 July 2026. §7.3 and §12.2 say a loading state is a pulse on
 * the element and never a spinner; the owner asked for a turning indicator
 * beside the written line instead, and the ruling wins over the document. It is
 * scoped to exactly one meaning — *this line is being read right now* — so it
 * stays a statement about a specific line rather than the generic "wait" a
 * full-screen spinner makes. Nowhere else in the app may spin.
 *
 * A single stroke, 270° drawn and 90° open, one turn every 800ms, LINEAR. Linear
 * is not in `easing` on purpose (§7.1 has no use for it elsewhere) but a spin
 * needs it: any eased curve visibly stutters at the loop seam, where the end of
 * one turn meets the start of the next.
 *
 * Reduced: the arc holds still at half opacity. §7.5 — reduced motion removes
 * the movement, never the information.
 */
export const READING_ARC = moderateScale(12);
const ARC_STROKE = 1.5;
const ARC_TURN_MS = 800;
/** Fraction of the circumference carrying ink. 0.75 = a 270° arc. */
const ARC_SWEEP = 0.75;
const ARC_STILL_OPACITY = 0.5;

export function ReadingArc({ tone = 'muted' }: { tone?: 'muted' | 'faint' }) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    spin.value = 0;
    spin.value = withRepeat(withTiming(360, { duration: ARC_TURN_MS, easing: Easing.linear }), -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  // Inset by half the stroke so the ink stays inside the box and never clips.
  const r = (READING_ARC - ARC_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <Animated.View
      style={[arcStyles.box, reduce ? arcStyles.still : animatedStyle]}
      // The indicator replaced a word ("reading…"), so it has to carry that word
      // for VoiceOver or the state disappears entirely for anyone not watching.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="reading">
      <Svg width={READING_ARC} height={READING_ARC}>
        <Circle
          cx={READING_ARC / 2}
          cy={READING_ARC / 2}
          r={r}
          fill="none"
          stroke={tone === 'faint' ? t.inkFaint : t.inkMuted}
          strokeWidth={ARC_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${circumference * ARC_SWEEP} ${circumference}`}
        />
      </Svg>
    </Animated.View>
  );
}

const arcStyles = StyleSheet.create({
  box: { width: READING_ARC, height: READING_ARC },
  still: { opacity: ARC_STILL_OPACITY },
});

/**
 * `card.repair` — a value changed after a correction.
 *
 * The changed number **only**: scale 1→1.06→1 on `fast`, under a 200ms
 * `emberSoft`→transparent wash. It exists because §8.4 promises a repair lands
 * in two seconds, and a change you cannot see did not visibly land.
 *
 * On the ember: §6.2's invariant is that ember means PLANNED, and this is the
 * one place §7.2 spends it elsewhere — for 200 transient milliseconds, on a
 * value the user just changed themselves. It is an acknowledgement, not a state,
 * and nothing is ember once it settles. Named here because it is the sort of
 * exception that gets copied if it is not written down as one.
 *
 * Fires when `trigger` changes, never on mount. Reduced: the wash alone — a
 * colour carries no vestibular signal, a scale pulse does.
 */
export function RepairFlash({
  children,
  trigger,
  style,
}: {
  children: React.ReactNode;
  /** Any value that changes when the number does — the number itself will do. */
  trigger: unknown;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const wash = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false; // a card appearing is `card.settle`, not a repair
      return;
    }
    if (!reduce) {
      scale.value = withSequence(
        withTiming(1.06, timing.fast),
        withTiming(1, timing.fast)
      );
    }
    wash.value = 1;
    // §7.2 says 200ms; `base` is 220 and is the token. Twenty milliseconds is
    // below anything anyone can see, and one vocabulary beats one exact number.
    wash.value = withTiming(0, timing.base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[pulse, style]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: t.emberSoft, opacity: wash }]}
      />
      {children}
    </Animated.View>
  );
}

/**
 * A thin animated progress bar — the onboarding spine.
 *
 * The fill is laid out at full width once and slid into place with `translateX`,
 * never animated via `width`: a width tween re-runs layout on every frame on the
 * JS side, while a transform is handed to the compositor and stays smooth even
 * while the step behind it is still mounting.
 */
export function ProgressBar({
  progress,
  height = 3,
  trackColor,
  fillColor,
  style,
}: {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  // Resolved here, not as default parameters: a default cannot call a hook.
  const track = trackColor ?? alpha(t.ink, 0.1);
  const fill = fillColor ?? t.ink;
  const reduce = useReducedMotion();
  const p = useSharedValue(progress);
  const trackW = useSharedValue(0);

  useEffect(() => {
    p.value = reduce ? progress : withTiming(progress, { duration: timing.slow.duration, easing: easing.emphasized });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => {
    const clamped = Math.max(0, Math.min(1, p.value));
    return {
      // Stay invisible for the one frame before the track is measured, so the
      // bar can never flash full-width on mount.
      opacity: trackW.value > 0 ? 1 : 0,
      transform: [{ translateX: -(1 - clamped) * trackW.value }],
    };
  });

  return (
    <View
      onLayout={(e) => {
        trackW.value = e.nativeEvent.layout.width;
      }}
      style={[{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View
        style={[{ height, width: '100%', borderRadius: height, backgroundColor: fill }, fillStyle]}
      />
    </View>
  );
}

/** A numeral that counts up to its value — for stat heroes and the paywall. */
export function AnimatedCount({
  value,
  format = (n) => String(Math.round(n)),
  duration = timing.slow.duration,
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
