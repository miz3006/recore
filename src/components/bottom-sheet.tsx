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
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { alpha, color, moderateScale, radius } from '@/lib/theme';

/**
 * The one bottom-sheet chrome for the whole app (CalendarSheet, ExerciseSheet,
 * FixSheet). It replaces the raw `<Modal animationType="slide">` — which hard-
 * cuts the scrim in and can't be dragged — with the app's own motion vocabulary
 * (CLAUDE.md §14): the scrim FADES in while the sheet EASES up on
 * `Easing.out(Easing.cubic)` (~300 ms), and a downward drag on the grabber
 * dismisses it (release under threshold springs back on the same quiet curve —
 * nothing bouncy). Everything is `reduceMotion`-gated to an instant show/hide.
 *
 * The sheet is a CONTROLLED component: the parent owns `visible`; flipping it to
 * false plays the exit before the Modal unmounts, so a programmatic close (Done,
 * selecting a day) animates just like a backdrop tap. Gestures inside a RN Modal
 * live in a detached native hierarchy, so a `GestureHandlerRootView` is nested
 * here rather than relying on the app-root one.
 */

const SCREEN_H = Dimensions.get('window').height;

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
  children,
  sheetStyle,
  scrimOpacity = 0.3,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Parent-owned surface: background, horizontal padding, bottom inset, maxHeight. */
  sheetStyle?: StyleProp<ViewStyle>;
  scrimOpacity?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const translateY = useSharedValue(SCREEN_H);
  const progress = useSharedValue(0); // 0 closed → 1 open (drives the scrim)
  const sheetH = useSharedValue(SCREEN_H);
  const openedRef = useRef(false);

  const finishClose = (notify: boolean) => {
    openedRef.current = false;
    setMounted(false);
    if (notify) onClose();
  };

  const animateOut = (notify: boolean) => {
    if (reduceMotion) {
      finishClose(notify);
      return;
    }
    progress.value = withTiming(0, OUT);
    translateY.value = withTiming(sheetH.value || SCREEN_H, OUT, (finished) => {
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
  // then reveal. Later layouts keep sheetH fresh for the dismiss travel.
  const onSheetLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    sheetH.value = h;
    if (!openedRef.current) {
      openedRef.current = true;
      if (reduceMotion) {
        translateY.value = 0;
        progress.value = 1;
        return;
      }
      translateY.value = h;
      progress.value = withTiming(1, IN);
      translateY.value = withTiming(0, IN);
    }
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      const next = Math.max(0, translateY.value + e.changeY);
      translateY.value = next;
      progress.value = 1 - Math.min(1, next / (sheetH.value || SCREEN_H));
    })
    .onEnd((e) => {
      const h = sheetH.value || SCREEN_H;
      if (translateY.value > h * DISMISS_FRACTION || e.velocityY > DISMISS_VELOCITY) {
        progress.value = withTiming(0, OUT);
        translateY.value = withTiming(h, OUT, (finished) => {
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
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => animateOut(true)}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: alpha(color.accent, scrimOpacity) }, scrimStyle]}
        />
        {/* Tap-anywhere-outside catcher (below the sheet, above the scrim). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateOut(true)} />

        {/* box-none so empty space above the sheet still hits the catcher; the
            KeyboardAvoidingView lifts a sheet with inputs (FixSheet) clear of
            the keyboard and is an inert no-op for the sheets without one. */}
        <KeyboardAvoidingView
          style={styles.anchor}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.sheet, sheetStyle, sheetAnimStyle]} onLayout={onSheetLayout}>
            {/* Only the grabber handle drags — leaves inner scroll views free. */}
            <GestureDetector gesture={pan}>
              <View style={styles.handle}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
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
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: color.border,
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
