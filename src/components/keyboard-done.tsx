import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { tap } from '@/lib/haptics';
import { color, hairline, HIT, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';

/**
 * A WAY OFF THE NUMBER PAD (owner, 20 Aug 2026).
 *
 * iOS's numeric keyboards — `decimal-pad`, `number-pad` — have **no return
 * key**. A field using one can be left with the keyboard up and nothing on the
 * keyboard itself that puts it away: the only exits are a tap somewhere else or
 * a scroll, and both are gestures the user has to already know about. Every
 * other field in the app ends with a return, so the number pads were the one
 * shape of input in Recore that could feel stuck.
 *
 * This is the standard iOS answer: one accessory bar over the keyboard with a
 * `Done` on it. It is deliberately NOT the Today accessory bar (`bottom-
 * toolbar.tsx`) — that one is a composing surface with a timer, a mic and a
 * commit; this is a single way out of a field that holds one number.
 *
 * ## How to wire one
 *
 * Give the field `inputAccessoryViewID={DONE_ACCESSORY}` and mount exactly one
 * `<KeyboardDoneBar />` in the same tree. **"The same tree" is literal inside a
 * `BottomSheet`:** a sheet is an RN `Modal` with its own window, so a bar
 * mounted on the screen behind it will not attach to a field inside it. Each
 * sheet with a number pad mounts its own.
 *
 * It renders nothing off iOS, and it is not for multiline fields: UIKit does
 * not attach an accessory view to a multiline `TextInput`, and a multiline
 * field has a return key anyway (it just writes a newline with it — those
 * fields are dismissed by a scroll, by a tap outside, or by the sheet's own
 * Save).
 */
export const DONE_ACCESSORY = 'recore.keyboard.done';

export function KeyboardDoneBar() {
  // Not a `Platform.select` on the component: on Android the export is RN's
  // UnimplementedView, which draws an empty box and warns. Nothing is rendered
  // there at all — the system back button already dismisses the keyboard.
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_ACCESSORY} backgroundColor={color.surface}>
      <Pressable
        onPress={() => {
          tap();
          Keyboard.dismiss();
        }}
        accessibilityRole="button"
        accessibilityLabel="Done"
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Done
        </Text>
      </Pressable>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  // The whole bar is the target, not the word — a 44 pt row whose content is
  // right-aligned, which is where iOS puts this button and therefore where the
  // thumb already is (§14).
  bar: {
    minHeight: HIT,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderTopWidth: hairline,
    borderTopColor: color.border,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    // An active control, so it wears the app's one blue (design skill §Colour:
    // "one brand blue does every job" — CTA, links, active controls).
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.brand,
  },
});
