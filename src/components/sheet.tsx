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
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  alpha,
  easing,
  makeStyles,
  projectDecay,
  radius,
  rubberband,
  spacing,
  spring,
  timing,
  useTheme,
} from '@/lib/theme';

import { SheetGrabber } from './sheet-grabber';

/**
 * `Sheet` — the one modal surface in the app (§5.3, §20, PLAN.md 1.9).
 *
 * §5.3: *"Detents `[0.6, 0.95]` with a grabber; never full-screen-cover for
 * something the user is meant to glance at."* A sheet that swallows the screen
 * makes the thing behind it feel gone rather than paused, and the whole reason
 * to use a sheet is that the session underneath is still there.
 *
 * **Two shapes, one component.** Pass `detents` and the sheet takes a fixed
 * fraction of the screen and snaps between the stops; pass nothing and it sizes
 * to its content, which is right for a sheet whose content is short and known
 * (a summary, a streak). Both share one drag, one scrim and one exit, because
 * two sheet implementations is how an app ends up with two feels.
 *
 * The drag is the only place in Recore where the user holds a moving surface, so
 * it is worth being precise about three things:
 *
 * · The sheet tracks the finger 1:1 downward and **resists** upward past its
 *   tallest stop rather than stopping dead — a hard clamp reads as a frozen app.
 * · The release decision comes from where the flick is **going** (velocity
 *   projected through iOS's own deceleration model), not from the pixel the
 *   finger lifted at. A short fast flick throws the sheet away; a slow drag two
 *   thirds of the way down still returns.
 * · The animation that takes over **inherits the finger's velocity**, so there
 *   is no seam between dragging and animating.
 *
 * Controlled: the parent owns `visible`, and flipping it to false plays the exit
 * before the Modal unmounts, so a programmatic close animates exactly like a
 * backdrop tap. Gestures inside an RN Modal live in a detached native hierarchy,
 * which is why a `GestureHandlerRootView` is nested here rather than inherited.
 *
 * Everything is `useReducedMotion`-gated to an instant show/hide (§7.5) — the
 * sheet still appears and still dismisses, it just does not travel.
 */

const SCREEN_H = Dimensions.get('window').height;

/**
 * Enter and exit both decelerate — an accelerating exit withholds movement for
 * the first frames after the tap, which reads as the sheet hesitating before it
 * agrees to leave. The exit is simply shorter: the app explains itself on the
 * way in and gets out of the way on the way out.
 */
const IN = { duration: 300, easing: easing.emphasized } as const;
const OUT = { duration: timing.base.duration, easing: easing.emphasized } as const;

/** How far a content-sized sheet must be projected to count as thrown away. */
const DISMISS_FRACTION = 0.28;

export function Sheet({
  visible,
  onClose,
  children,
  detents,
  initialDetent = 0,
  sheetStyle,
  scrimOpacity = 0.3,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Stops as fractions of the screen, ascending — §5.3's default is
   * `[0.6, 0.95]`. Omit for a sheet that sizes to its own content.
   */
  detents?: readonly number[];
  /** Which stop to open at. */
  initialDetent?: number;
  /** Parent-owned surface: padding, bottom inset, max height. */
  sheetStyle?: StyleProp<ViewStyle>;
  scrimOpacity?: number;
}) {
  const styles = useStyles();
  const t = useTheme();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  // Offsets, not fractions: 0 is the tallest stop, and each shorter stop sits
  // that much further down. Ascending offsets = descending heights.
  const stops = detents?.length
    ? [...detents].sort((a, b) => b - a).map((d) => (Math.max(...detents) - d) * SCREEN_H)
    : [0];
  const fixedHeight = detents?.length ? Math.max(...detents) * SCREEN_H : undefined;
  const openOffset = stops[Math.min(initialDetent, stops.length - 1)] ?? 0;

  const translateY = useSharedValue(SCREEN_H);
  const progress = useSharedValue(0); // 0 closed → 1 open (drives the scrim)
  const sheetH = useSharedValue(fixedHeight ?? SCREEN_H);
  const snaps = useSharedValue<number[]>(stops);
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
  // then reveal. Later layouts keep the dismiss travel honest.
  const onSheetLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    sheetH.value = h;
    snaps.value = stops;
    if (!openedRef.current) {
      openedRef.current = true;
      if (reduceMotion) {
        translateY.value = openOffset;
        progress.value = 1;
        return;
      }
      translateY.value = h;
      progress.value = withTiming(1, IN);
      translateY.value = withTiming(openOffset, IN);
    }
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      const h = sheetH.value || SCREEN_H;
      const raw = translateY.value + e.changeY;
      // Above the tallest stop there is nowhere to go, so instead of a hard
      // clamp the sheet resists more the further it is pulled and springs back.
      const next = raw >= 0 ? raw : -rubberband(-raw, h);
      translateY.value = next;
      progress.value = 1 - Math.min(1, Math.max(0, next) / h);
    })
    .onEnd((e) => {
      const h = sheetH.value || SCREEN_H;
      const landing = translateY.value + projectDecay(e.velocityY);
      const lowest = snaps.value[snaps.value.length - 1] ?? 0;

      // Closed is just another candidate: the release lands wherever it is
      // nearest, which makes "flick it away" and "drop it one stop" the same
      // decision rather than two competing rules.
      const candidates = [...snaps.value, h];
      let target = candidates[0];
      for (const c of candidates) {
        if (Math.abs(c - landing) < Math.abs(target - landing)) target = c;
      }
      const beyondLowest = landing > lowest + (h - lowest) * DISMISS_FRACTION;
      if (target === h || (snaps.value.length === 1 && beyondLowest)) {
        progress.value = withTiming(0, OUT);
        translateY.value = withSpring(h, { ...spring.gesture, velocity: e.velocityY }, (finished) => {
          if (finished) runOnJS(finishClose)(true);
        });
        return;
      }
      translateY.value = withSpring(target, { ...spring.gesture, velocity: e.velocityY });
      progress.value = withSpring(1, spring.gesture);
    });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={() => animateOut(true)}>
      <GestureHandlerRootView style={styles.root}>
        {/* Reanimated 4 reads shared values straight out of the style object, so
            a pass-through like this needs no useAnimatedStyle worklet. */}
        <Animated.View
          style={[styles.scrim, { backgroundColor: alpha(t.ink, scrimOpacity) }, { opacity: progress }]}
        />
        {/* Tap-anywhere-outside catcher (below the sheet, above the scrim). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => animateOut(true)} />

        {/* box-none so empty space above the sheet still hits the catcher; the
            KeyboardAvoidingView lifts a sheet with inputs clear of the keyboard
            and is an inert no-op for the sheets without one. */}
        <KeyboardAvoidingView
          style={styles.anchor}
          pointerEvents="box-none"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={[
              styles.sheet,
              fixedHeight ? { height: fixedHeight } : null,
              sheetStyle,
              { transform: [{ translateY }] },
            ]}
            onLayout={onSheetLayout}>
            {/* Only the grabber drags — inner scroll views stay free. */}
            <GestureDetector gesture={pan}>
              <View style={styles.handle}>
                <SheetGrabber />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
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
    backgroundColor: t.surface,
    // §6.7 — sheets take the xxl corner.
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderTopColor: t.rule,
  },
  handle: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
}));
