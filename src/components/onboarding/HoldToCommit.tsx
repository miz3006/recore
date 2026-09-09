import { useCallback, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { tapMedium } from '@/lib/haptics';
import { EASE } from '@/lib/motion';
import {
  color,
  CTA_HEIGHT,
  lineFor,
  MAX_FONT_SCALE,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';


/**
 * "Hold to commit" — the commitment screen's button (v3 design import, 18 Aug
 * 2026), and the one control in the app that asks for more than a tap.
 *
 * The reason it is a HOLD is the screen's own argument: the number above it is
 * a count of sessions the person just described, and a tap is what you give a
 * dialog you are dismissing. A second of deliberate pressure is the smallest
 * interaction that reads as a decision. It is not a gate — the darker fill
 * sweeps left to right so the finger can see how long is left, releasing early
 * rewinds it, and no answer is written until it completes.
 *
 * The sweep is a scaleX on a full-width overlay, never an animated `width`:
 * product-direction §4.3 bans animating a layout property, and the picture is
 * the same on the UI thread.
 *
 * **Reduce Motion is not a shortcut, and it is not a blank second either.** The
 * hold takes the same 900 ms; what changes is that the fill FADES UP in place
 * instead of sweeping across. Until 19 Aug 2026 it jumped to full on press-in,
 * which meant the one person who had asked the system for less movement got no
 * indication of how long was left on the only control in the app that asks you
 * to keep holding — a progress control with no progress. Reduced motion means
 * dropping the travel, not the information: the opacity ramp reads the same
 * shared value the sweep does, so the button still answers "how much longer".
 *
 * The label carries the instruction either way, and VoiceOver activates it as
 * an ordinary button because a timed gesture is not something a screen reader
 * user should have to perform.
 *
 * ## The haptic fires from the animation, once
 *
 * `withTiming`'s completion callback IS the threshold — it runs on the UI
 * thread at the exact frame the fill reaches full, and it runs once. (A
 * `useAnimatedReaction` watching `p > 0.99` would be the tool if the value were
 * driven by a finger; here the animation knows precisely when it finished, so
 * polling a derived boolean every frame would be strictly worse.) It is a
 * MEDIUM impact rather than the light tick the rest of the flow uses: this is
 * the one moment somebody commits to twelve weeks, and it is the only medium
 * impact in the funnel.
 */

/** How long the finger stays down. Long enough to be a decision, short enough
 * that nobody wonders whether the button is broken. */
export const HOLD_MS = 900;

export function HoldToCommit({ label, onComplete }: { label: string; onComplete: () => void }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  // Guards a second fire: the worklet callback and an accessibility activation
  // can both reach `onComplete`, and committing twice would push two screens.
  const fired = useRef(false);

  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    tapMedium();
    onComplete();
  }, [onComplete]);

  const start = () => {
    if (fired.current) return;
    cancelAnimation(p);
    p.set(
      withTiming(1, { duration: HOLD_MS, easing: EASE.standard }, (done) => {
        if (done) scheduleOnRN(finish);
      }),
    );
  };

  const abandon = () => {
    if (fired.current) return;
    cancelAnimation(p);
    // Rewinding faster than it filled: an abandoned hold should not look like
    // a second animation the person has to wait out.
    p.set(withTiming(0, { duration: 180, easing: EASE.standard }));
  };

  // Reduced motion keeps the same value and spends it on opacity instead of
  // travel. The sweep's own scale is safe from the corner-smearing that made
  // the progress rail translate instead: this fill carries no radius of its
  // own and is clipped by the button's pill, so its leading edge is meant to
  // be a straight vertical line.
  const fillStyle = useAnimatedStyle(() =>
    reduce
      ? { opacity: p.get(), transform: [{ scaleX: 1 }] }
      : { opacity: 1, transform: [{ scaleX: p.get() }] },
  );

  return (
    <Pressable
      onPressIn={start}
      onPressOut={abandon}
      // The screen-reader path: one activation commits, with no timing at all.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Press and hold to commit"
      onAccessibilityAction={finish}
      style={styles.button}>
      <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />
      <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The quiet instruction above the button, so "hold" is read before it is
 * discovered by a tap that does nothing. */
export function HoldHint({ children }: { children: string }) {
  return (
    <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: CTA_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadow.glow,
  },
  /** The sweep — the CTA's own pressed blue, so the button never introduces a
   * colour the rest of the flow does not already have. */
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.brandPressed,
    transformOrigin: 'left',
  },
  label: {
    fontSize: type.headline.fontSize,
    lineHeight: lineFor(22),
    // 600, the app's headline weight: white on Volt is 5.97:1, so the label no
    // longer has to be bold to be legal (it was 3.4:1 on #007AFF).
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.onInk,
  },
  hint: {
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
