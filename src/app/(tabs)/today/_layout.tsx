import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PaperField } from '@/components/paper-field';
import { color } from '@/lib/theme';

/**
 * THE TODAY TAB'S OWN NAVIGATOR (9 September 2026) — the last tab off the
 * hand-rolled chrome, and the one it mattered most for.
 *
 * Next and You moved onto the system navigator earlier today, each for the same
 * three behaviours a styled `Text` in a row can never reach: a large title that
 * COLLAPSES as the content travels under it, a bar that IS Liquid Glass on an
 * iOS 26 SDK build, and a scroll view UIKit can find and drive. Today kept its
 * own row — the "Recore" wordmark, a centred day pill, a session count — which
 * is the arrangement `scroll-edge.tsx` was written to argue against: *"the one
 * arrangement iOS itself never uses."*
 *
 * It matters most here because Today is a NOTE, and the reference for a note is
 * Apple Notes. Notes has no app-titled bar over your writing: the page runs to
 * the top of the screen, the chrome floats, and the day the note belongs to is
 * the title of the page itself. Bear and Day One draw the same thing — a large
 * title, a dateline under it, and the body immediately after. That is now what
 * this tab is, and every piece of it is the system's:
 *
 *   Today                        ← `headerLargeTitle`, collapses on scroll
 *   Tuesday, 9 September         ← content (`note-surface.tsx`)
 *   ○ Bench press  82.5 kg …     ← the record
 *
 * The three facts the old row carried all survive: the day is the title, the
 * date is the dateline, the session count sits at the end of the dateline with
 * its own tap target, and the calendar moved to a bar button where iOS puts a
 * navigation control. The wordmark is gone, and that is the rule rather than a
 * loss — all four tabs now print their own name at the same optical anchor,
 * which is what the design skill asked the wordmark to stand in for.
 *
 * ## THE CANVAS IS NOT HERE, AND NOT IN THE SCREEN EITHER
 *
 * Both obvious places are wrong and the measurement is written out in
 * `../next/_layout.tsx`: hoisting `PaperField` beside the navigator loses it
 * behind the navigator's opaque container (the warm `#FCF9F4` read back as a
 * flat `#F2F2F2` on the iOS 26.5 simulator), and putting it back in the screen
 * as an `absoluteFill` sibling costs UIKit the scroll view it tracks, so the
 * title stops collapsing. The canvas is therefore the scroll view's OWN
 * background (`experimental_backgroundImage`, `note-surface.tsx`).
 *
 * What is left here is the same flat fill the other two keep: `color.canvas` on
 * the root, for the instant before a screen mounts and for wherever a gradient
 * cannot render (skill §Canvas).
 */
export default function TodayLayout() {
  return (
    <View style={styles.root}>
      <PaperField />
      <Stack
        screenOptions={{
          // Transparent so the scroll view's own canvas is what shows. NOT
          // enough on its own — see the canvas note above.
          contentStyle: { backgroundColor: 'transparent' },
          // NO `headerTransparent`, AND NO `headerStyle.backgroundColor`. Both
          // were tried on You and both were wrong: transparent killed the large
          // title outright, and naming a background colour opts out of Liquid
          // Glass to paint a cream slab — the exact thing `scroll-edge.tsx` was
          // rewritten to stop doing.
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
