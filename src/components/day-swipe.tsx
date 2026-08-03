import { type ReactNode } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { tap } from '@/lib/haptics';
import { DUR, EASE, SPRING } from '@/lib/motion';
import { useSession } from '@/state/session-store';

/**
 * Swipe left and right on Today to move between days.
 *
 * The day pill and the calendar sheet were the only way to reach yesterday, and
 * reaching yesterday is the single most common thing a lifter does after a
 * session they wrote up late. A horizontal drag is what everyone's thumb
 * already tries; this makes the thumb right.
 *
 * DIRECTION follows every calendar on the phone: drag RIGHT (pulling the page
 * with you, revealing what sits to the left) goes BACK a day; drag LEFT goes
 * forward. Forward stops at today — you log what happened, not what will
 * (`calendar-sheet.tsx` disables future days for the same reason), and the edge
 * answers with resistance and a spring rather than with nothing, so the wall is
 * felt instead of guessed at.
 *
 * IT MUST NOT FIGHT THE COMPOSER, which is the whole design constraint:
 *  - `activeOffsetX` ±24 and `failOffsetY` ±12 mean the note's vertical
 *    ScrollView always wins an ambiguous drag. The swipe has to be deliberate.
 *  - It is DISABLED while the keyboard is up. Mid-sentence a horizontal drag is
 *    the user placing a cursor, and swapping the day under a half-typed line
 *    would be the worst bug in the app.
 *
 * The neighbouring day is not pre-rendered, so this is a parallax-and-fade
 * rather than a page slide: the current day travels a short distance out, the
 * new one comes in from the other side. Reduce Motion swaps instantly and
 * keeps every bit of the information (§5.5).
 */
const SCREEN_W = Dimensions.get('window').width;

/** How far the content travels on a commit, and comes in from. */
const TRAVEL = Math.min(96, SCREEN_W * 0.24);
/** Past this much drag the day changes; under it, it springs back. */
const COMMIT_DISTANCE = 64;
const COMMIT_VELOCITY = 520;
/** The finger moves further than the page does — the page has weight. */
const DRAG_RESISTANCE = 0.55;
/** At the edge (no tomorrow to go to) it barely moves at all. */
const EDGE_RESISTANCE = 0.12;

export function DaySwipe({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const reduceMotion = useReducedMotion();
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);

  const tx = useSharedValue(0);
  const opacity = useSharedValue(1);

  // `direction` is where the CONTENT goes: -1 travels left (moving forward in
  // time), +1 travels right (moving back).
  const go = (direction: 1 | -1) => {
    const next = shiftDayKey(selectedDay, direction === 1 ? -1 : 1);
    if (next > todayKey()) return;
    tap();
    selectDay(next);
  };

  const atToday = selectedDay >= todayKey();

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onChange((e) => {
      // Dragging left from today has nowhere to land, so it is heavy.
      const resistance = atToday && e.translationX < 0 ? EDGE_RESISTANCE : DRAG_RESISTANCE;
      const next = e.translationX * resistance;
      tx.value = Math.max(-TRAVEL, Math.min(TRAVEL, next));
      opacity.value = 1 - Math.min(0.35, Math.abs(tx.value) / (TRAVEL * 3));
    })
    .onEnd((e) => {
      const far = Math.abs(e.translationX) > COMMIT_DISTANCE;
      const fast = Math.abs(e.velocityX) > COMMIT_VELOCITY;
      const direction: 1 | -1 = e.translationX > 0 ? 1 : -1;
      const blocked = atToday && direction === -1;

      if (!(far || fast) || blocked) {
        tx.value = withSpring(0, SPRING.snappy);
        opacity.value = withTiming(1, { duration: DUR.fast });
        return;
      }

      if (reduceMotion) {
        tx.value = 0;
        opacity.value = 1;
        runOnJS(go)(direction);
        return;
      }

      opacity.value = withTiming(0, { duration: DUR.fast, easing: EASE.standard });
      tx.value = withTiming(
        direction * TRAVEL,
        { duration: DUR.fast, easing: EASE.standard },
        (finished) => {
          if (!finished) return;
          runOnJS(go)(direction);
          // Park on the far side and let the new day arrive from there.
          tx.value = -direction * TRAVEL;
          tx.value = withSpring(0, SPRING.soft);
          opacity.value = withTiming(1, { duration: DUR.base });
        },
      );
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: opacity.value,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
