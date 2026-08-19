import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alpha, color, spacing } from '@/lib/theme';

/**
 * THE SCROLL EDGE (owner, 18 Aug 2026 — *"ko klikne gor se ne sme tako
 * obarvati"*).
 *
 * A screen title used to sit in a row ABOVE the scroll view. That is the one
 * arrangement iOS itself never uses, and the reason shows the moment you scroll:
 * the list is clipped dead flat at the row's bottom edge, so a card is sliced
 * in half against a plain grey slab. Nothing is animating, nothing is wrong —
 * it just reads as an app that has a lid on it.
 *
 * iOS 26 solves this with the *scroll edge effect*: content keeps going under
 * the title, and the background progressively takes it over as it approaches
 * the top, so the last thing you see is a fade, never a cut. This is that,
 * built from the two things every install already has — an absolutely
 * positioned header and a gradient — rather than a blur, because a blur would
 * be a platform branch (real Liquid Glass on 26, an imitation everywhere else)
 * for an effect the gradient renders identically on every device.
 *
 * Two rules for callers:
 * - **The scroll view runs the full height of the screen**, under the header;
 *   the header is an overlay, not a row. `pointerEvents` is `box-none` so the
 *   fade never eats a tap meant for the content behind it.
 * - **`onHeight` → `contentContainerStyle.paddingTop`, plus `EDGE_FADE`.** The
 *   header measures itself because its height moves with Dynamic Type, and the
 *   fade has to sit over EMPTY background at rest — content parked under the
 *   gradient would read as washed-out, which is a worse bug than the cut.
 */

/** How far the background reaches down over the content. */
export const EDGE_FADE = spacing.xxl;

export function ScrollEdgeHeader({
  children,
  onHeight,
}: {
  children: ReactNode;
  /** The measured header height (safe area included) — the caller's top padding. */
  onHeight: (h: number) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.overlay, { paddingTop: insets.top }]}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}>
      {/* Opaque behind the title itself: the title is the one thing that may
          never have a moving card behind it. */}
      <View style={styles.solid} pointerEvents="none" />
      {children}
      <LinearGradient
        colors={[color.bg, alpha(color.bg, 0)]}
        style={styles.fade}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  solid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.bg,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -EDGE_FADE,
    height: EDGE_FADE,
  },
});
