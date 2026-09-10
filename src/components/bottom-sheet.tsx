import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { SPRING } from '@/lib/motion';
import { alpha, color, concentricRadius, ink, moderateScale, shadow, spacing } from '@/lib/theme';

/**
 * The one bottom-sheet chrome for the whole app (CalendarSheet, ExerciseSheet,
 * FixSheet). It replaces the raw `<Modal animationType="slide">` — which hard-
 * cuts the scrim in and can't be dragged — with the app's own motion vocabulary
 * (CLAUDE.md §14): the scrim FADES in while the sheet EASES up on
 * `Easing.out(Easing.cubic)` (~300 ms), and a downward drag on the grabber
 * dismisses it (release under threshold springs back on the same quiet curve —
 * nothing bouncy). Everything is `reduceMotion`-gated to an instant show/hide.
 *
 * ## IT FLOATS, AND THE NUMBERS ARE MEASURED FROM UIKIT (9 September 2026)
 *
 * *"make the sheets to look like apple design"* — and then, on seeing a first
 * attempt go edge to edge: *"apple design ima tko da ni full width in height
 * ampk kukr da ima malo ob strani prostora da izgleda kot da je floating."*
 *
 * **The owner is right, and the DETACHED CARD ruling of 18 August 2026 stands.**
 * The first attempt at this change made the sheet edge-to-edge on the strength
 * of twenty real sheets read on Appllama — every one of them a full-width panel
 * with only its top corners rounded. That research was sound and its conclusion
 * was wrong, because the library is mostly pre-iOS-26 apps: it shows what an
 * iPhone sheet looked like for ten years, not what iOS 26 draws.
 *
 * So this was settled by measuring the real thing instead. The check-in screen
 * is a genuine `UISheetPresentationController` (`_layout.tsx`,
 * `presentation: 'formSheet'`), so it was opened on the iOS 26.5 simulator and
 * its pixels read off the screenshot. On a 402 pt wide iPhone 17 Pro:
 *
 * | edge | measured |
 * |---|---|
 * | left | **8.00 pt** |
 * | right | **8.33 pt** |
 * | bottom | **8.33 pt above the screen edge** |
 *
 * **UIKit's own iOS 26 sheet floats by `spacing.sm` on three sides** — which is
 * exactly the inset this file has used since 18 August. The card was right all
 * along; it is now right *and measured*, which is the difference between a taste
 * and a number.
 *
 * The bottom measurement is the one worth keeping in mind: the system sheet does
 * **not** clear the home indicator with air. It stops 8 pt off the screen edge
 * and lets the indicator sit over it, paying the clearance as padding INSIDE the
 * card. This file now does the same — see `bottomGap` — which is why the caller
 * contract is unchanged: a child still must not add `insets.bottom`, and its own
 * bottom padding still lands clear of the indicator.
 *
 * ## What DID change, and stays changed
 *
 * - **It arrives on a spring** (`SPRING.soft`), not a cubic. A sheet is a
 *   surface a finger can catch mid-flight, and §Motion's rule is that anything
 *   a finger was on is a spring. The exit stays timed: iOS takes a dismissed
 *   sheet away quickly and never bounces it off the screen.
 * - **The grabber is Apple's**: 36 × 5 at 5 pt from the top, drawn in
 *   `ink.grabber` — the ladder's own entry for "sheet grabbers, structural
 *   whispers" — instead of 40 × 5 in `color.border`, which is the tone for
 *   drawing a *line*, not a handle.
 * - **There is one grabber.** Five profile sheets were rendering `SheetGrabber`
 *   inside a `BottomSheet` that already draws its own, so those sheets wore two
 *   stacked handles. The chrome belongs to the sheet; the callers no longer
 *   bring their own.
 * - **No side stroke.** The measured system sheet has none — it separates
 *   itself with the dimmed page and its own cast, and so does this.
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

/**
 * The air on three sides — left, right and bottom. **8 pt, measured off UIKit's
 * own iOS 26 form sheet** (8.00 / 8.33 / 8.33), and identical to the value the
 * 18 August ruling picked by eye. `spacing.sm` is that number in the app's own
 * scale, so the sheet floats on a token rather than on a magic 8.
 */
const SHEET_INSET = spacing.sm;

/**
 * THE CORNER IS CONCENTRIC WITH THE DISPLAY, AND IT MOVES WITH THE DEVICE
 * (owner, 9 September 2026: *"noben ta sheet se ne konca lepo ampk so vsi nekak
 * cez ekran odspodej … mogoce da je mejcken vec zaobljeno al pa kej oz da se
 * prilagaja glede na telefon"*).
 *
 * It was `radius.xl` — a flat 24 — and 24 is far tighter than the curve of the
 * screen it floats 8 pt inside. On an iPhone 17 Pro the display's own corner is
 * **62 pt**, so near the bottom the phone's curve cut straight across the card's
 * gentle one and there was no corner left to see: the sheet read as running off
 * the bottom of the screen rather than ending on it. That is exactly what the
 * owner described, from their own phone.
 *
 * The fix is the rule iOS 26 uses everywhere: **inner radius = outer radius −
 * the gap between them.** 62 − 8 = 54 here, and it is computed per device
 * (`concentricRadius`) rather than fixed, because the display corner is 39 on an
 * iPhone X and 0 on a Touch ID phone.
 *
 * It was confirmed against UIKit rather than reasoned into place. `_layout.tsx`
 * was asking the real form sheet for `sheetCornerRadius: 24`; dropping that prop
 * and measuring what UIKit chose for itself gave a corner roughly **three times**
 * that. So the system does round concentrically, and 24 was overriding it with a
 * worse number on the one sheet the app had already made native.
 */
const useSheetRadius = () => {
  const { width, height } = useWindowDimensions();
  return concentricRadius(width, height, SHEET_INSET);
};

/**
 * Enter and settle are SPRINGS; the exit is a timing curve.
 *
 * A sheet is the clearest case of §Motion's rule that anything a finger was on
 * is a spring: it can be caught, dragged and released mid-flight, and a spring
 * carries the velocity through that interruption where a curve restarts.
 * `SPRING.soft` is the app's sheet spring (damping ratio ≈ 0.90 — it settles
 * without a bounce, which is what iOS does and what a rail-like surface owes).
 *
 * The exit stays timed on purpose: iOS takes a dismissed sheet away quickly and
 * never springs it off the screen, and the scrim has to reach zero on the same
 * schedule as the card.
 */
const OUT = { duration: 240, easing: Easing.in(Easing.cubic) } as const;

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
  /**
   * Parent-owned surface: background, horizontal padding, bottom padding,
   * maxHeight.
   *
   * Do NOT add `insets.bottom` here — the sheet already floats clear of it —
   * and do NOT set `borderRadius`: the corner is concentric with the display
   * and is applied after this style precisely so it cannot be overridden. See
   * the note at the call site.
   */
  sheetStyle?: StyleProp<ViewStyle>;
  scrimOpacity?: number;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const sheetRadius = useSheetRadius();
  const [mounted, setMounted] = useState(visible);

  // The home-indicator clearance, paid INSIDE the card — the way the measured
  // system sheet pays it.
  //
  // The card's own floor is already `SHEET_INSET` off the screen edge, so the
  // indicator's top is `insets.bottom − SHEET_INSET` above that floor, and that
  // is the padding the content owes. The two together come to exactly
  // `insets.bottom`, which is what the indicator actually needs.
  //
  // This is what keeps the caller contract intact: a child still must not add
  // `insets.bottom`, and its own bottom padding still lands clear. On a device
  // with no indicator it is zero and the card is simply 8 pt off the edge.
  // THE INSET IS THE WINDOW'S, NOT THE SCREEN'S (9 September 2026).
  //
  // `useSafeAreaInsets()` reads the nearest provider, and a sheet opened from a
  // tab screen has the TAB BAR in that context: measured on the iOS 26.5
  // simulator by tinting this spacer, it came back **55 pt** where the home
  // indicator asks for 26. Every sheet in the app opened over the tabs was
  // therefore leaving a band of empty surface at its foot roughly the height of
  // the tab bar — most visible on You, where the last option row ended a
  // finger's width above the card floor with nothing under it.
  //
  // `initialWindowMetrics` is the WINDOW's own inset, captured before any
  // navigator has adjusted anything, so it is the indicator and nothing else.
  // The hook stays as the fallback for the case the metrics are unavailable
  // (they are null before the provider mounts on some platforms); being wrong
  // there in the old direction is only ever too much air, never too little.
  const windowBottom = initialWindowMetrics?.insets.bottom ?? insets.bottom;
  const bottomGap = Math.max(windowBottom - SHEET_INSET, 0);

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
    // A floating card is not gone at its own height — it still has the air
    // under it to cross before the screen edge hides it.
    travel.value = h + SHEET_INSET;
    if (!openedRef.current) {
      openedRef.current = true;
      if (reduceMotion) {
        translateY.value = 0;
        progress.value = 1;
        return;
      }
      translateY.value = h + SHEET_INSET;
      // The scrim is timed while the card springs: dimming that overshoots
      // would read as the light flickering, and only the card was ever grabbed.
      progress.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      translateY.value = withSpring(0, SPRING.soft);
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
        // Released short of the threshold: the finger's own velocity carries
        // into the spring, so the card returns as one continuous movement
        // rather than restarting on a curve.
        translateY.value = withSpring(0, { ...SPRING.soft, velocity: e.velocityY });
        progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
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
          <View style={styles.inset} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                // THE RADIUS COMES LAST, AND THAT IS DELIBERATE (9 September
                // 2026). It sat before `sheetStyle`, so any caller that named a
                // `borderRadius` of its own quietly won — and five did, all of
                // them on You, all of them at `radius.xl` (24) against the 54
                // this computes on an iPhone 17 Pro. Nobody had written a wrong
                // number; they had written the number that was right before the
                // corner became concentric, and the override made the mistake
                // invisible. The corner is a property of the PRESENTATION, not
                // of the content, so the presentation has the last word on it.
                { borderRadius: sheetRadius },
                sheetAnimStyle,
              ]}
              onLayout={onSheetLayout}>
              {/* Only the grabber handle drags — leaves inner scroll views free. */}
              <GestureDetector gesture={pan}>
                <View style={styles.handle}>
                  <View style={styles.grabber} />
                </View>
              </GestureDetector>
              {children}
              {/* The indicator's own room. Additive to whatever bottom padding
                  the caller set, which is exactly what the air under the old
                  floating card was. */}
              {bottomGap > 0 ? <View style={{ height: bottomGap }} /> : null}
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
  /** The box the card lives in: air down both sides and under its floor, card
   * pinned to that floor. Percentage heights on a sheet resolve against THIS,
   * not the window, so a `maxHeight: '90%'` sheet still clears the status bar. */
  inset: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SHEET_INSET,
    paddingBottom: SHEET_INSET,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  /**
   * Four corners, no stroke, and it casts.
   *
   * The hairline that used to run around the card is gone: the measured system
   * sheet has no stroke at all. It separates itself with the dimmed page behind
   * it and its own shadow, and `shadow.raised` is doing that job here — on the
   * cream canvas it is load-bearing, because a white card on paper is 1.05:1 by
   * tone and the cast is the only thing that lifts it.
   */
  sheet: {
    backgroundColor: color.surface,
    // The radius is per-device and arrives at the call site — see `useSheetRadius`.
    borderCurve: 'continuous',
    ...shadow.raised,
  },
  handle: {
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 6,
  },
  /**
   * Apple's grabber, measured: **36 × 5**, fully rounded, 5 pt down from the
   * sheet's top edge. It was 40 wide in `color.border` — the hairline tone,
   * which is furniture for drawing a *line*, not a handle. `ink.grabber` is the
   * ladder's own entry for exactly this ("sheet grabbers, structural
   * whispers"), so the affordance now takes the token that was written for it.
   */
  grabber: {
    width: moderateScale(36),
    height: 5,
    borderRadius: 2.5,
    backgroundColor: alpha(color.accent, ink.grabber),
  },
});
