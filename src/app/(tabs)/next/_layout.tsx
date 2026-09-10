import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PaperField } from '@/components/paper-field';
import { color } from '@/lib/theme';

/**
 * THE NEXT TAB'S OWN NAVIGATOR (9 September 2026).
 *
 * Next drew its own chrome through `StubScreen`: a `Text` at `largeTitle` in a
 * row above the scroll view, a hand-built subtitle under it, and one trailing
 * slot holding a white "Edit" pill. It was the arrangement `scroll-edge.tsx`
 * was written to argue against — *"the one arrangement iOS itself never
 * uses"* — and the You tab had already been moved off it earlier today for
 * three behaviours that no amount of styling reaches. All three were missing
 * here too:
 *
 * 1. **The title never collapsed.** iOS shrinks a large title into the bar as
 *    the content travels under it, tracking the finger and interruptible
 *    mid-flight. A `Text` in a header row just sits there while cards slide
 *    past it, and on Next it sat there while the first lift card was clipped
 *    flat against its bottom edge.
 * 2. **The bar was not the material.** On an iOS 26 SDK build an unstyled
 *    navigation bar *is* Liquid Glass: invisible at the top of the scroll, and
 *    materialising as rows pass beneath it. `StubScreen` painted opaque cream
 *    instead, so a card met a hard cut.
 * 3. **Nothing UIKit does to a tracked scroll view could reach it.** The
 *    collapse is the visible half of that; anything else the system wants to
 *    drive off the screen's own scroll view — the iOS 26 tab-bar minimize
 *    among them — needs the same thing this one did, and could not have it
 *    while the scroll sat several levels down inside a `PaperField` +
 *    `SafeAreaView` shell.
 *
 * So the chrome goes back to the navigator — fidelity law 9, and §5.2's own
 * argument for the native tab bar: **the system draws its own furniture better
 * than we can, and it draws iOS 26's furniture at all.**
 *
 * ## THE CANVAS: TWO OBVIOUS PLACES, BOTH WRONG, AND WHAT IT TOOK
 *
 * This file first hoisted `PaperField` out of the screen and up beside the
 * navigator, on You's reasoning: a sibling `absoluteFill` is *"the one thing
 * the screen may not have any more"*, because UIKit has to find a
 * `UIScrollView` as the screen's root. **The app went grey.** Sampled on the
 * iOS 26.5 simulator, 9 September 2026: the warm canvas `#FCF9F4` read back as
 * a flat neutral `#F2F2F2` on this tab and on You. A half-opacity red
 * `contentStyle` proved why — composited, the red resolved the layer *behind*
 * the screen to that same neutral, so the navigator's own container view is
 * opaque and paints over anything the layout puts under it.
 * (`react-native-screens` has the knob — `RNSScreenStack.mm` assigns
 * `_controller.view.backgroundColor` from a `nativeContainerBackgroundColor`
 * prop — but nothing on the path from expo-router's `Stack` through
 * `standard-navigation` to `ScreenStack` plumbs it.)
 *
 * So the canvas went back into the screen, as a sibling of the scroll view, and
 * **the hoist's premise turned out to be exactly right**: the paper came back
 * and the large title stopped collapsing. Scrolled programmatically to 340 and
 * photographed, the title stayed at full size while the cards travelled
 * *underneath* it. Content was still inset correctly — `contentInsetAdjustment`
 * does not need the tracking that the collapse does — which is what makes this
 * failure quiet enough to ship by accident.
 *
 * Two places, and each one costs the other. The resolution is a third: **the
 * canvas is the scroll view's own background** (`experimental_backgroundImage`,
 * RN 0.86), derived from `PaperField`'s three stops in `lib/paper-field.ts` so
 * there is one palette behind both draw paths. No sibling to spoil the lookup,
 * nothing above it to hide it. Verified in the same pass: warm paper, and a
 * title that collapses into a glass bar with the rows refracting under it.
 *
 * What is left here is the flat fill — `color.canvas` on the root, for the
 * instant before a screen mounts and for wherever a gradient cannot render
 * (skill §Canvas).
 *
 * (The iOS 26 tab-bar minimize is a separate question. `(tabs)/_layout.tsx`
 * does not currently ask for it, and it has never been seen to fire on any tab.
 * Nothing here should be described as fixing it.)
 */
export default function NextLayout() {
  return (
    <View style={styles.root}>
      <PaperField />
      <Stack
        screenOptions={{
          // Transparent so the scroll view's own canvas is what shows. It is
          // NOT enough on its own — see the canvas note above.
          contentStyle: { backgroundColor: 'transparent' },
          // NO `headerTransparent`, AND NO `headerStyle.backgroundColor` — both
          // were tried on You and both were wrong. Transparent killed the large
          // title outright (verified on the iOS 26.5 simulator, 9 September
          // 2026: the bar rendered, the title did not), and naming a background
          // colour opts out of Liquid Glass to paint a cream slab, which is the
          // exact thing `scroll-edge.tsx` was rewritten to stop doing.
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          // The one blue does every control job (skill §Colour), and a bar
          // button is a control.
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
