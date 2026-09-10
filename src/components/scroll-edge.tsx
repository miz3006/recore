import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alpha, color, spacing } from '@/lib/theme';

import { GlassSurface, useGlass } from './glass';

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
 *
 * ## It works with NO title, and Profile is why (28 August 2026)
 *
 * Profile's title scrolls with the content, the way both of its references draw
 * it. Dropping this component along with the fixed title looked right until the
 * page was scrolled: rows ran under the Dynamic Island and the clock with no
 * treatment at all, so the time sat on top of a row label. The cut this
 * component was written to remove came back as a worse thing — an overlap.
 *
 * So `children` is optional. With none, this is the scroll edge on its own:
 * `insets.top` of opaque canvas and the gradient under it, no row, nothing
 * pinned. The measured height is then just the safe area, which is exactly what
 * a caller whose title is content wants back as padding.
 *
 * ## ON iOS 26 IT IS REAL GLASS, AND THE GRADIENT RETIRES (9 September 2026)
 *
 * This component was written to fake the scroll edge out of "the two things
 * every install already has — an absolutely positioned header and a gradient —
 * rather than a blur, because a blur would be a platform branch for an effect
 * the gradient renders identically on every device."
 *
 * That reasoning was right when the alternative was a *hand-rolled* blur. It is
 * no longer the alternative. On iOS 26 the system draws this bar itself, and the
 * two are not the same effect: the gradient FADES CONTENT OUT into a flat cream
 * slab, while glass REFRACTS it — a row sliding under the bar bends and
 * brightens through it instead of dissolving into paper, and the bar picks up
 * the tone of whatever is actually beneath it. The gradient's whole job was to
 * avoid a hard cut; glass avoids it by being a material the content is visibly
 * behind.
 *
 * So the branch is now taken deliberately, and it is one branch in one file:
 *
 * - **Glass**: a `regular` glass bar over the header box, and **no gradient**.
 *   A defined bottom edge is what iOS 26 draws under a bar that contains a
 *   title — the soft variant is for bars holding nothing but floating buttons —
 *   and a cream gradient hanging below glass would be a smear of the exact
 *   opaque paper the glass exists to replace.
 * - **Paper**: unchanged. Opaque canvas, gradient under it, identical geometry.
 *
 * The measured height, the `box-none`, and the `EDGE_FADE` contract are the same
 * on both, so no caller changes and a screen laid out on one is correct on the
 * other. `EDGE_FADE` still has to be added to the caller's top padding on both
 * materials: under glass it is what keeps the first row from starting its life
 * already behind the bar.
 */

/** How far the background reaches down over the content. */
export const EDGE_FADE = spacing.xxl;

export function ScrollEdgeHeader({
  children,
  onHeight,
}: {
  /** Omit for a bare scroll edge — see the note above. */
  children?: ReactNode;
  /** The measured header height (safe area included) — the caller's top padding. */
  onHeight: (h: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const glass = useGlass();

  return (
    <View
      style={[styles.overlay, { paddingTop: insets.top }]}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => onHeight(e.nativeEvent.layout.height)}>
      {glass ? (
        // Square: this bar spans the screen and meets its own top and side
        // edges, so there is no corner to round. Glass carries the separation
        // that the opaque fill and the gradient carry below.
        <GlassSurface radius={0} />
      ) : (
        <>
          {/* Opaque behind the title itself: the title is the one thing that
              may never have a moving card behind it. */}
          <View style={styles.solid} pointerEvents="none" />
        </>
      )}
      {children}
      {glass ? null : (
        <LinearGradient
          colors={[color.canvas, alpha(color.canvas, 0)]}
          style={styles.fade}
          pointerEvents="none"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // The bar draws over the page, so it has to be above it in z-order too —
    // a sibling declared earlier would otherwise win on some screens.
    zIndex: 1,
  },
  solid: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.canvas,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -EDGE_FADE,
    height: EDGE_FADE,
  },
});
