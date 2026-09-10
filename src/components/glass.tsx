import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { PRESS, PRESS_SCALE } from '@/lib/motion';
import { selection, tap, tapMedium } from '@/lib/haptics';
import { color, radius as radiusToken, shadow, spacing } from '@/lib/theme';

/**
 * THE MATERIAL LAYER — Liquid Glass, and where it is allowed to be.
 *
 * ## The one rule
 *
 * **Glass is the material of chrome that floats OVER content. The record is
 * never glass.**
 *
 * That is Apple's own iOS 26 guidance (Liquid Glass is a layer *above* the
 * content layer; an app that puts it everywhere has no layers left) and it is
 * also, word for word, the structure this app already had. The design skill's
 * §Structure names three layers and no more:
 *
 *   canvas (the world) → ink text (the record) → white pills (the controls)
 *
 * The redesign of 9 September 2026 changes exactly one of those three: **the
 * white pills become glass.** The canvas is untouched, the record is untouched.
 * A Today row is still typography on paper with no card under it, and the
 * numbers a person trains by are still ink that nothing refracts. What became
 * glass is the chrome around them — the scroll edge, the day pill, the sheet,
 * the accessory row, the secondary button — because those are the things that
 * genuinely sit *on top of* something, and glass is the material that says so.
 *
 * Where a surface is not floating over anything, it stays paper. `Card` is
 * still a white surface with a hairline; a settings row is still a row. Glass
 * on a resting card is the glassmorphism-on-everything look the anti-slop laws
 * ban, and it also destroys the layering it is supposed to express.
 *
 * ## Four things this module gets right that a bare `GlassView` does not
 *
 * **1. It cannot crash.** `isLiquidGlassAvailable()` alone is not enough:
 * several iOS 26 betas ship the design without the API behind it, and calling
 * into it there is a hard crash (expo/expo#40911). `glassAvailable` requires
 * BOTH that and `isGlassEffectAPIAvailable()`.
 *
 * **2. It is pinned to light.** `app.json` sets `userInterfaceStyle: "light"` —
 * Recore is a warm-paper app and has no dark scheme. Liquid Glass defaults to
 * `colorScheme: 'auto'`, which follows the *system* appearance, not the app's.
 * On a phone set to dark mode that renders **dark glass on a cream app**: the
 * tab bar, every sheet and every pill would go smoked charcoal while the page
 * behind them stayed paper. Every surface here passes `colorScheme="light"`.
 *
 * **3. It honours Reduce Transparency.** `isLiquidGlassAvailable()` is
 * explicitly documented to stay `true` when the user has turned the effect down
 * in accessibility settings — it reports the component, not the setting. So the
 * setting is read here, subscribed to, and a person who asked for less
 * transparency gets the paper material instead, live, without relaunching.
 * CLAUDE.md §3 makes contrast non-negotiable and this is the same promise.
 *
 * **4. It sets no tint, with one named exception.** Glass recolours itself
 * against whatever is behind it and offers no callback, so a fixed hex goes
 * illegible over some content — the reason §4 sets no tint on the tab bar. The
 * exception is `tint`, and it exists for the primary CTA alone: a filled action
 * whose ground is its own fill, which is the one case where the colour under
 * the glass is known because we drew it.
 *
 * ## The fallback is not a degraded glass — it is the app's own material
 *
 * On iOS 25 and earlier, on Android, in Expo Go, and under Reduce Transparency,
 * every surface here falls back to white `surface` on the warm canvas, a
 * hairline, and `shadow.card`. **The layout is identical either way**, so a
 * screen designed on one reads correctly on the other and nothing reflows when
 * the accessibility setting changes. The shadow is load-bearing in the
 * fallback: white on cream is 1.05:1 by tone, so without it the surface is
 * simply not there.
 */

/**
 * Whether the system can draw Liquid Glass at all. Both checks are required —
 * see note 1 above. This is a build/OS fact and never changes at runtime, so it
 * is a module constant; the *user's* setting is the hook below.
 */
export const glassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * Whether glass should be drawn RIGHT NOW — the constant above, minus the user's
 * Reduce Transparency setting, which they can change while the app is open.
 *
 * Every surface in this file calls it. Call it directly when a caller needs to
 * make a layout decision that glass changes (e.g. whether to draw a border of
 * its own); do not use it to change SIZE or POSITION — the two materials are
 * the same shape on purpose.
 */
export function useGlass(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!glassAvailable) return;
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then((on) => {
      if (alive) setReduced(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return glassAvailable && !reduced;
}

/** `clear` is thinner and lets more through — for a surface over busy content;
 * `regular` is the default and the one almost everything wants. */
export type GlassVariant = 'regular' | 'clear';

/**
 * THE LAYER — glass (or paper) drawn behind a parent's children.
 *
 * It renders absolutely-positioned and `pointerEvents="none"`, so callers keep
 * ordinary flex layout and just add `<GlassSurface radius={…} />` as the first
 * child of a `Pressable` or `View`. The parent owns the touch; this owns the
 * material and nothing else.
 *
 * Use `GlassPressable` instead when the surface IS the control — it gets the
 * interactive lens, which a layer behind a pressable cannot.
 */
export function GlassSurface({
  radius,
  style,
  variant = 'regular',
  /** THE PRIMARY CTA ONLY — see note 4. A tint over unknown content is a bug. */
  tint,
}: {
  radius: number;
  style?: StyleProp<ViewStyle>;
  variant?: GlassVariant;
  tint?: string;
}) {
  const glass = useGlass();

  if (glass) {
    return (
      <GlassView
        glassEffectStyle={variant}
        tintColor={tint}
        colorScheme="light"
        style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.curve, style]}
        pointerEvents="none"
      />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.paper,
        { borderRadius: radius },
        styles.curve,
        shadow.card,
        // The fallback for a tinted surface is the tint itself, opaque. A CTA
        // that is blue on glass must still be blue on paper.
        tint ? { backgroundColor: tint, borderColor: tint } : null,
        style,
      ]}
      pointerEvents="none"
    />
  );
}

/**
 * THE CONTROL — a pressable that wears the material.
 *
 * The difference from `GlassSurface` is convenience, not capability: it bundles
 * the layer, the press dip and the haptic into one component so a control is
 * one element instead of three. The material is drawn BEHIND the target and
 * takes no touches — see the note at the return below for why the obvious
 * alternative (glass as the wrapper, to win iOS 26's interactive lens) cannot
 * work, and what it broke when it was tried.
 *
 * The press dip (`PRESS_SCALE`, `PRESS` timing, the minimum-visible hold) is
 * identical to `PressableScale`'s, so a glass control and an ink one feel the
 * same under the thumb. Motion is `transform` only and Reduce Motion flattens
 * it, same contract.
 */
export function GlassPressable({
  children,
  onPress,
  onLongPress,
  radius,
  variant = 'regular',
  tint,
  solidFill,
  style,
  contentStyle,
  activeScale = PRESS_SCALE,
  haptic = 'light',
  disabled,
  hitSlop,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityHint,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  radius: number;
  variant?: GlassVariant;
  /** THE PRIMARY CTA ONLY — see note 4. */
  tint?: string;
  /**
   * An OPAQUE fill that replaces the glass entirely for as long as it is set.
   *
   * For a control that flips between resting and *speaking* — the mic while it
   * is listening, the rest timer as it finishes — where the app has taken the
   * button over and wants it to read as solid ink, not as a material. Glass is
   * what a control is made of at rest; this is what it becomes when it is doing
   * something. Passing it keeps such a button on ONE code path instead of
   * swapping component types between states.
   */
  solidFill?: string;
  /** Shape, size and position. */
  style?: StyleProp<ViewStyle>;
  /** Layout of the children inside the shape. */
  contentStyle?: StyleProp<ViewStyle>;
  activeScale?: number;
  /** `selection` fires on press-IN for a choice; `light`/`medium` on press-out
   * for a commit — the §5.6 split, same as `PressableScale`. */
  haptic?: 'none' | 'selection' | 'light' | 'medium';
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityState?: { disabled?: boolean; selected?: boolean; expanded?: boolean };
  accessibilityHint?: string;
}) {
  const glass = useGlass();
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  const downAt = useRef(0);

  // Resolved on the JS side and captured as a plain number: a worklet may read
  // a closed-over value, never call a helper to compute one.
  const dip = reduce ? 0 : 1 - activeScale;
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - dip * p.get() }] }));

  const target = (
    <Pressable
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        downAt.current = Date.now();
        if (haptic === 'selection') selection();
        p.set(withTiming(1, PRESS.in));
      }}
      onPressOut={() => {
        // Hold the press at depth until it has actually been seen — the same
        // floor `PressableScale` applies, so both controls feel identical.
        const wait = Math.max(0, PRESS.minVisibleMs - (Date.now() - downAt.current));
        p.set(withDelay(wait, withTiming(0, PRESS.out)));
      }}
      onPress={() => {
        if (haptic === 'light') tap();
        else if (haptic === 'medium') tapMedium();
        onPress?.();
      }}
      onLongPress={onLongPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
      accessibilityHint={accessibilityHint}
      style={contentStyle}>
      {children}
    </Pressable>
  );

  // The material is a LAYER BEHIND the target, never a wrapper around it.
  //
  // It was a wrapper for one day (9 Sep 2026) so the glass could take the
  // `isInteractive` lens, which belongs to the glass view's own touch handling.
  // **A native `GlassView` does not deliver touches to its React children**, so
  // that arrangement made every control built on it a dead control — verified
  // on the iOS 26.5 simulator: the day pill stopped opening the calendar, and
  // removing `isInteractive` did not bring it back, which is what proves the
  // cause is the nesting and not the lens.
  //
  // So the lens is unreachable through this API and is gone. The layer keeps
  // everything that mattered: the Pressable sits in normal flow and gives the
  // shape its size (a pill is as wide as "Today · Sep 6"), the material fills it
  // absolutely with `pointerEvents="none"`, and the press dip is the feedback.
  const material = solidFill ? (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: solidFill, borderRadius: radius }, styles.curve]}
      pointerEvents="none"
    />
  ) : glass ? (
    <GlassView
      glassEffectStyle={variant}
      tintColor={tint}
      colorScheme="light"
      style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.curve]}
      pointerEvents="none"
    />
  ) : (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.paper,
        { borderRadius: radius },
        styles.curve,
        shadow.card,
        tint ? { backgroundColor: tint, borderColor: tint } : null,
      ]}
      pointerEvents="none"
    />
  );

  return (
    <Animated.View style={[animatedStyle, styles.shrink, style]}>
      {material}
      {target}
    </Animated.View>
  );
}

/**
 * A MERGE GROUP — glass shapes close enough to flow into one another.
 *
 * The other half of the iOS 26 material, and the half an imitation cannot
 * reach: two glass shapes inside a container within `spacing` of each other
 * stop being two objects and become one piece of glass that stretches between
 * them as they move. It is what makes the accessory row read as a single
 * instrument rather than as four buttons that happen to be adjacent.
 *
 * Wrap a row of related glass controls in this; leave unrelated ones out of it,
 * because merging says *these belong together* and the effect is wasted — worse,
 * misleading — on a row of things that do not.
 *
 * It is a plain `View` wherever glass does not exist, so the row lays out
 * identically and no caller needs a branch.
 */
export function GlassGroup({
  children,
  style,
  spacing: merge = GLASS_MERGE_DISTANCE,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How close two shapes must be before they flow together. */
  spacing?: number;
}) {
  const glass = useGlass();

  if (!glass) return <View style={style}>{children}</View>;

  return (
    <GlassContainer spacing={merge} style={style}>
      {children}
    </GlassContainer>
  );
}

/**
 * How close two glass shapes have to be before iOS lets them merge — one value
 * for the whole app, so every merge group flows at the same distance. It is
 * `spacing.md`, which is also the widest gap the app puts between two controls
 * that belong together; anything further apart is meant to read as separate.
 */
export const GLASS_MERGE_DISTANCE = spacing.md;

/**
 * The radius a glass shape takes when it sits INSIDE another rounded shape.
 *
 * iOS 26 draws nested corners concentrically: the inner radius is the outer one
 * minus the gap between them, so the two curves stay parallel instead of the
 * inner corner looking too round. A control inset by `pad` inside a container of
 * `outer` should use this rather than a token, and it never goes below `radius.sm`.
 */
export function concentric(outer: number, pad: number): number {
  return Math.max(radiusToken.sm, outer - pad);
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  /** Squircles, on both materials — iOS 26 corners are continuous everywhere. */
  curve: {
    borderCurve: 'continuous',
  },
  /** The press wrapper takes the shape's own sizing behaviour, on BOTH
   * materials: without it a content-sized pill in a `space-between` row would
   * refuse to give ground and push the row wider at large type sizes. */
  shrink: {
    flexShrink: 1,
  },
});
