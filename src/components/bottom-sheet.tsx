import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { alpha, color, hairline, moderateScale, radius, shadow, spacing } from '@/lib/theme';

/**
 * The one bottom-sheet chrome for the whole app (CalendarSheet, ExerciseSheet,
 * FixSheet). It replaces the raw `<Modal animationType="slide">` — which hard-
 * cuts the scrim in and can't be dragged — with the app's own motion vocabulary
 * (CLAUDE.md §14): the scrim FADES in while the sheet EASES up on
 * `Easing.out(Easing.cubic)` (~300 ms), and a downward drag on the grabber
 * dismisses it (release under threshold springs back on the same quiet curve —
 * nothing bouncy). Everything is `reduceMotion`-gated to an instant show/hide.
 *
 * ## IT IS A DETACHED CARD, NOT A DRAWER (owner, 18 Aug 2026)
 *
 * Every sheet floats: a hairline gap of `SHEET_INSET` down both sides and a gap
 * over the home indicator, all four corners rounded. It is the iOS date-picker card, and
 * the reason it looks better than a drawer welded to the screen edge is that a
 * card with air around it reads as an OBJECT laid on the app, while a drawer
 * reads as the app growing a new bottom. The white surface also needs the gap:
 * on white-on-white a sheet that touches the edges has nothing to prove it is a
 * separate plane, so the inset does the job the tone can't (`color.ts` §"WHITE,
 * NOT PAPER").
 *
 * Two consequences for callers:
 * - **The sheet owns the bottom safe-area gap.** A child must NOT add
 *   `insets.bottom` to its own `paddingBottom` — it would pay for the home
 *   indicator twice. Pass a plain `spacing` value.
 * - **Percentage heights resolve inside the inset box**, not the window, so a
 *   `maxHeight: '90%'` sheet still clears the status bar.
 *
 * The sheet is a CONTROLLED component: the parent owns `visible`; flipping it to
 * false plays the exit before the Modal unmounts, so a programmatic close (Done,
 * selecting a day) animates just like a backdrop tap. Gestures inside a RN Modal
 * live in a detached native hierarchy, so a `GestureHandlerRootView` is nested
 * here rather than relying on the app-root one.
 *
 * `onClosed` is for the ONE case a sheet hands off to another sheet (You's
 * record calendar → the session sheet, §16.4). Two sheets are two RN `Modal`s,
 * and **UIKit refuses to present a second modal while the first is still on
 * screen** — it does not throw, it simply never appears, which is the worst
 * shape a bug can take. `onClose` says "the parent may now flip `visible`";
 * `onClosed` says "the native modal is gone, it is safe to present another".
 * Only the second one is a valid moment to open a sheet.
 */

const SCREEN_H = Dimensions.get('window').height;

/** The air down both sides of the card — a HAIR of it (owner, 18 Aug 2026: the
 * card should read as detached, not as a floating tile). Its radius is the
 * screen's own corner minus this gap (~39 − 8), which is why the tighter the
 * inset, the ROUNDER the card has to be: `radius.xxl`. */
const SHEET_INSET = spacing.sm;

/** Enter/settle share the decelerating curve; exit uses the accelerating one. */
const IN = { duration: 300, easing: Easing.out(Easing.cubic) } as const;
const OUT = { duration: 240, easing: Easing.in(Easing.cubic) } as const;
const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

/** Past ~28% dragged down, or a firm downward flick, the sheet dismisses. */
const DISMISS_FRACTION = 0.28;
const DISMISS_VELOCITY = 900;

export function BottomSheet({
  visible,
  onClose,
  onClosed,
  children,
  sheetStyle,
  scrimOpacity = 0.3,
}: {
  visible: boolean;
  onClose: () => void;
  /** The native modal has actually gone. The only safe moment to open another. */
  onClosed?: () => void;
  children: ReactNode;
  /** Parent-owned surface: background, horizontal padding, bottom padding, maxHeight.
   * Do NOT add `insets.bottom` here — the sheet already floats clear of it. */
  sheetStyle?: StyleProp<ViewStyle>;
  scrimOpacity?: number;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);

  // How far the card sits above the home indicator (or the screen edge on a
  // device without one). It is also travel the exit has to cover.
  //
  // It is the safe area MINUS the side gap, not the safe area: the indicator
  // lives in the bottom ~21 pt, so 34 − 8 still clears it completely while
  // taking the drawer-like slab of empty white out from under the card.
  const bottomGap = Math.max(insets.bottom - SHEET_INSET, spacing.sm);

  const translateY = useSharedValue(SCREEN_H);
  const progress = useSharedValue(0); // 0 closed → 1 open (drives the scrim)
  const travel = useSharedValue(SCREEN_H); // sheet height + the bottom gap
  const openedRef = useRef(false);

  const finishClose = (notify: boolean) => {
    openedRef.current = false;
    setMounted(false);
    if (notify) onClose();
    // Unmounting the Modal only ASKS iOS to dismiss; the presentation slot is
    // free one dismissal-completion later, and that is what `onDismiss` below
    // reports. Android has neither the callback nor the restriction — a modal
    // there is a view, not a presented controller — so the unmount is it.
    if (Platform.OS !== 'ios') onClosed?.();
  };

  const animateOut = (notify: boolean) => {
    if (reduceMotion) {
      finishClose(notify);
      return;
    }
    progress.value = withTiming(0, OUT);
    translateY.value = withTiming(travel.value || SCREEN_H, OUT, (finished) => {
      if (finished) runOnJS(finishClose)(notify);
    });
  };

  // Mount on open; when the parent flips visible→false, play the exit itself.
  useEffect(() => {
    if (visible) {
      setMounted(true);
    } else if (mounted) {
      animateOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // First real layout: learn the sheet's height, park it exactly off-screen,
  // then reveal. Later layouts keep `travel` fresh for the dismiss distance.
  const onSheetLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    // A floating card is not gone at its own height — it still has the bottom
    // gap to cross before the screen edge hides it.
    travel.value = h + bottomGap;
    if (!openedRef.current) {
      openedRef.current = true;
      if (reduceMotion) {
        translateY.value = 0;
        progress.value = 1;
        return;
      }
      translateY.value = h + bottomGap;
      progress.value = withTiming(1, IN);
      translateY.value = withTiming(0, IN);
    }
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      const next = Math.max(0, translateY.value + e.changeY);
      translateY.value = next;
      progress.value = 1 - Math.min(1, next / (travel.value || SCREEN_H));
    })
    .onEnd((e) => {
      const t = travel.value || SCREEN_H;
      if (translateY.value > t * DISMISS_FRACTION || e.velocityY > DISMISS_VELOCITY) {
        progress.value = withTiming(0, OUT);
        translateY.value = withTiming(t, OUT, (finished) => {
          if (finished) runOnJS(finishClose)(true);
        });
      } else {
        translateY.value = withTiming(0, SETTLE);
        progress.value = withTiming(1, SETTLE);
      }
    });

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onDismiss={Platform.OS === 'ios' ? onClosed : undefined}
      onRequestClose={() => animateOut(true)}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: alpha(color.accent, scrimOpacity) }, scrimStyle]}
        />
        {/* Tap-anywhere-outside catcher (below the sheet, above the scrim). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateOut(true)} />

        {/* box-none so empty space above the sheet still hits the catcher; the
            KeyboardAvoidingView lifts a sheet with inputs (FixSheet) clear of
            the keyboard and is an inert no-op for the sheets without one.
            Its paddingBottom is written by RN itself, which is why the inset
            box below is a separate view rather than padding on this one. */}
        <KeyboardAvoidingView
          style={styles.anchor}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inset, { paddingBottom: bottomGap }]} pointerEvents="box-none">
            <Animated.View
              style={[styles.sheet, sheetStyle, sheetAnimStyle]}
              onLayout={onSheetLayout}>
              {/* Only the grabber handle drags — leaves inner scroll views free. */}
              <GestureDetector gesture={pan}>
                <View style={styles.handle}>
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>
              {children}
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  anchor: {
    flex: 1,
  },
  /** The box the card lives in: side air, bottom air, card pinned to its floor.
   * Percentage heights on a sheet resolve against THIS, not the window. */
  inset: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SHEET_INSET,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    borderCurve: 'continuous',
    borderWidth: hairline,
    borderColor: color.border,
    // Detached means it has to look detached: the card casts, the canvas does not.
    ...shadow.raised,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  grabber: {
    width: moderateScale(40),
    height: 5,
    borderRadius: 3,
    backgroundColor: color.border,
  },
});
