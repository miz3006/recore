import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PaperField } from '@/components/paper-field';
import { color } from '@/lib/theme';

/**
 * THE YOU TAB'S OWN NAVIGATOR (9 September 2026).
 *
 * You was a bare route file drawing its own chrome: a `Text` styled at
 * `largeTitle` sitting in the scroll content, plus `ScrollEdgeHeader` — an
 * absolutely-positioned overlay that faked the scroll edge with a gradient (or,
 * since the glass pass, with a `GlassSurface`). It looked close. It was not the
 * thing, and three behaviours were missing that no amount of styling reaches:
 *
 * 1. **The title never collapsed.** iOS's large title shrinks into the bar as
 *    you scroll and grows back at the top, tracking the finger, interruptible
 *    mid-flight. A `Text` in a `ScrollView` just leaves.
 * 2. **There was nowhere to put a search field.** `UISearchController` belongs
 *    to a navigation item. Thirty-three rows is precisely the list that needs
 *    one, and the app could not offer it.
 * 3. **The tab bar could not minimize.** `(tabs)/_layout.tsx` asks for
 *    `minimizeBehavior="onScrollDown"` and records that it never fired, with
 *    the diagnosis written out: *"UIKit minimizes against a scroll view it has
 *    to FIND for itself, and this app's scrolls sit several levels down inside
 *    a `PaperField` + `SafeAreaView` shell rather than being the screen's own
 *    root scroll view."* The fix it names is exactly this file.
 *
 * So the chrome goes back to the navigator, which is fidelity law 9 and also
 * §5.2's own argument for the native tab bar: **the system draws its own
 * furniture better than we can, and it draws iOS 26's furniture at all.**
 *
 * ## THE CANVAS IS NOT HERE EITHER (corrected 9 September 2026)
 *
 * This layout hoisted `PaperField` up beside the navigator so the screen's root
 * could be its scroll view, and the reasoning was right about the scroll view
 * and wrong about where that leaves the canvas: **the navigator's own container
 * view is opaque and paints over it.** Sampled on the iOS 26.5 simulator, the
 * warm `#FCF9F4` read back as a flat neutral `#F2F2F2` on this tab and on Next
 * — the tab had been grey since the hoist landed, a few hours earlier the same
 * day. The probe that isolated the layer, and the reason the fix cannot be a
 * prop, are written out once in `../next/_layout.tsx`.
 *
 * Moving it back inside the screen restores the paper and costs the large-title
 * collapse, exactly as this file's original note predicted. So it goes in a
 * third place: `index.tsx` draws the canvas as the scroll view's OWN background
 * (`experimental_backgroundImage`), which needs no sibling and sits under no
 * container. Everything this layout says about the scroll view being the
 * screen's root stands unchanged — that is why the canvas had to move rather
 * than the scroll view.
 *
 * What stays here is the flat `color.canvas` fill on the root, for the instant
 * before a screen mounts and for wherever a gradient cannot render.
 *
 * The screens are therefore transparent by construction. `contentStyle` says so
 * explicitly rather than relying on a default: a screen that paints its own
 * opaque background here would cover the gradient and nobody would see why.
 */
export default function YouLayout() {
  return (
    <View style={styles.root}>
      <PaperField />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: 'transparent' },
          // NO `headerTransparent`, AND NO `headerStyle.backgroundColor`.
          //
          // Both were set for one build and both were wrong. Transparent killed
          // the large title outright — verified on the iOS 26.5 simulator, 9
          // September 2026: the bar rendered, the title did not — and a
          // background colour would have been worse, because on an iOS 26 SDK
          // build **an unstyled navigation bar already IS Liquid Glass**. It
          // hides itself at the top of the scroll so the canvas reads straight
          // through, and materialises as the rows travel under it. Naming a
          // colour opts out of the material to paint a cream slab, which is the
          // exact thing `scroll-edge.tsx` was rewritten to stop doing.
          //
          // The screen under it is transparent (above), so what the glass has
          // to refract is the page's own gradient plus whatever is scrolling.
          //
          // No hairline under it either: iOS 26 separates a bar from its
          // content with the material, not with a rule.
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerTintColor: color.brand,
          headerTitleStyle: { color: color.textPrimary },
          headerLargeTitleStyle: { color: color.textPrimary },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The flat fill the gradient sits on, and the colour anything that ever
    // renders before it would show.
    backgroundColor: color.canvas,
  },
});
