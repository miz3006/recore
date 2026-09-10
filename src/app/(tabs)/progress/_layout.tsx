import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PaperField } from '@/components/paper-field';
import { color } from '@/lib/theme';

/**
 * THE PROGRESS TAB'S OWN NAVIGATOR (9 September 2026) — the fourth and last tab
 * off the hand-rolled chrome.
 *
 * Today, Next and You each moved onto the system navigator earlier for the same
 * three behaviours, and all three arguments applied here unchanged: a large
 * title that COLLAPSES as the record travels under it, a bar that IS Liquid
 * Glass on an iOS 26 SDK build, and a scroll view UIKit can find and drive.
 * `StubScreen` gave none of them — it drew a `Text` at `largeTitle` in a row
 * above the scroll view and painted the bar opaque cream, so the first lift row
 * met a hard cut instead of passing under glass.
 *
 * There is a fourth thing this tab wanted that the others did not, and it is
 * the reason this file was worth writing rather than copying: **the search
 * field.** Progress is the one tab with more rows than a screen, and it had a
 * hand-built `TextInput` styled as a pill sitting above the list. iOS puts that
 * control in the navigation bar, hides it until the page is pulled down, and
 * gives it a Cancel button, a scope bar, a dictation key and a keyboard the
 * system dismisses — none of which a `TextInput` in a `View` has. It is now
 * `headerSearchBarOptions` on the screen, which is UIKit's own
 * `UISearchController` (`index.tsx`).
 *
 * ## The canvas is the scroll view's own background
 *
 * Both obvious places are wrong and the measurement is written out in
 * `../next/_layout.tsx`: hoisting `PaperField` beside the navigator loses it
 * behind the navigator's opaque container (warm `#FCF9F4` read back as a flat
 * `#F2F2F2` on the iOS 26.5 simulator), and putting it in the screen as an
 * `absoluteFill` sibling costs UIKit the scroll view it tracks, so the title
 * stops collapsing. The canvas is therefore drawn by the scroll view itself
 * (`experimental_backgroundImage`, derived from `lib/paper-field.ts`).
 *
 * What is left here is the flat fill — `color.canvas` on the root, for the
 * instant before a screen mounts and wherever a gradient cannot render.
 */
export default function ProgressLayout() {
  return (
    <View style={styles.root}>
      <PaperField />
      <Stack
        screenOptions={{
          // Transparent so the scroll view's own canvas is what shows. NOT
          // enough on its own — see the canvas note above.
          contentStyle: { backgroundColor: 'transparent' },
          // NO `headerTransparent`, AND NO `headerStyle.backgroundColor`: the
          // first kills the large title outright and the second opts out of
          // Liquid Glass to paint a cream slab.
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          // The one blue does every control job (skill §Colour), and a bar
          // button — Cancel on the search field included — is a control.
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
