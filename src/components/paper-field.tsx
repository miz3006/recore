import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { PAPER_FIELD_LOCATIONS, PAPER_FIELD_STOPS } from '@/lib/paper-field';

/**
 * The app's canvas, drawn as a surface rather than as a flat fill (owner's spec
 * §C, 13 Aug 2026; warm and static since 20 Aug 2026).
 *
 * Three tones a fraction apart on the page diagonal: peach at the top-left,
 * lavender-pink at the bottom-right. At any instant it is indistinguishable
 * from the canvas colour; across a whole screen it is the difference between a
 * page and a fill. If it is ever NOTICED as a gradient, the values in
 * `lib/paper-field.ts` are wrong — that file, not this one, is where to change
 * them, and its tests say what they may not become.
 *
 * **It does not move.** The forty-two-second drift it used to have is gone
 * (design skill §Canvas: "diagonal, subtle, static, and never animates") — and
 * with it the Reduce Motion branch, the overscan and the two shared values.
 * Nothing here is animated, so there is nothing to gate.
 *
 * It renders BEHIND everything and takes no touches.
 */
export function PaperField() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden>
      <LinearGradient
        colors={PAPER_FIELD_STOPS}
        locations={PAPER_FIELD_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
