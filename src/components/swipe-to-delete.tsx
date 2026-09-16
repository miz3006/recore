import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tap, tapMedium } from '@/lib/haptics';
import { DUR, EASE, SPRING } from '@/lib/motion';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';

import { Icon } from './icon';
import { PressableScale } from './motion';

/**
 * SWIPE A ROW LEFT TO REMOVE IT (owner, 16 September 2026).
 *
 * Deleting an entry used to live three levels down: the card's ⋯, then a menu,
 * then a destructive row, then a confirm. The ⋯ is gone — the card's one glyph
 * is the note now — and the two other things that hid behind it went to the
 * places they already existed (history is the Progress tab's whole job, and
 * repairing a reading is the card's own tap plus the alias echo). Delete had
 * nowhere to go, so it became the gesture every list on this phone already
 * uses: drag the row left.
 *
 * ## Why the gesture is safe enough to be the only door
 *
 * It was not, before `undo-delete.tsx`. A swipe is quick and a line of
 * `raw_text` is the record (CLAUDE.md §3), and the argument against a gesture
 * was always that the action could not be taken back. It can now: deleting
 * offers an undo pill for six seconds, which is the layer this gesture rests
 * on. Between the deliberate drag, the red block that appears under the thumb
 * before anything happens, the haptic when it arms, and the undo after, there
 * are four moments to change your mind.
 *
 * ## Two ways out of the same drag, which is what iOS does
 *
 * - Past `COMMIT` and released — the row leaves and the red sweeps after it.
 * - Past the block's own width and released short of `COMMIT` — the row rests
 *   open with a real Delete button, the two-stage shape for a careful thumb.
 * - Anything less springs shut.
 *
 * Only one row is ever open, app-wide (`openRow`): opening a second closes the
 * first, the way Mail does, so a stray red block is never left behind on a
 * ledger you have scrolled away from.
 *
 * ## It has to lose three arguments to win one
 *
 * The ledger sits inside a vertical scroll view AND inside `DaySwipe`, which
 * owns horizontal drags for moving between days. So:
 *
 * - `failOffsetY` hands a vertical drag to the scroll view.
 * - `activeOffsetX(-ACTIVATE)` means this only ever activates LEFTWARD, and
 *   `failOffsetX(ACTIVATE)` makes a rightward drag fail outright — that is
 *   `DaySwipe` going back a day, and it must not be blocked waiting on a
 *   handler that will never activate.
 * - `blocksExternalGesture(day)` makes `DaySwipe` wait for this one to resolve
 *   rather than racing it. Without it a fast left flick crosses both thresholds
 *   in one frame, and on a past day that deleted an entry AND changed the day.
 *   The ref arrives through `DaySwipeGestureContext`; with no provider (the
 *   onboarding demo, where there is no day to swipe to) there is nothing to
 *   block and the relation is simply not declared.
 *
 * ## VoiceOver
 *
 * A gesture nobody can see is not a door for everyone, and the menu that used
 * to spell "Delete entry" out loud is gone. The card publishes it as a custom
 * rotor action instead (`ExerciseCard`'s `onDelete`), which is exactly how iOS
 * exposes its own swipe actions — the finger gets a drag, VoiceOver gets a
 * verb, and neither is the other's afterthought.
 */

/**
 * `DaySwipe`'s own pan, so a row's swipe can out-rank it. A context rather than
 * a prop because the ledger builds its blocks in a loop several components deep
 * and threading a ref through every one of them would be prop drilling for a
 * relationship that is really "whatever day page I happen to be inside".
 */
export const DaySwipeGestureContext = createContext<React.MutableRefObject<
  GestureType | undefined
> | null>(null);

const SCREEN_W = Dimensions.get('window').width;

/** How wide the red block is when the row rests open. Wide enough for the word
 * and the glyph, and a hair over the 44 pt target. */
const ACTION_W = moderateScale(92);

/** How far left the thumb must have travelled, on release, for the row to go
 * without a second tap. A proportion of the screen rather than a constant: the
 * gesture means "keep going", and on a wider phone that is further. */
const COMMIT = Math.max(ACTION_W * 1.9, SCREEN_W * 0.42);

/** The drag has to mean it before this takes the touch away from the page. */
const ACTIVATE_X = 14;
const FAIL_Y = 12;

/** A flick this fast commits from anywhere past the block's own width. */
const FLING_VX = -900;

/** Resistance on a drag back PAST closed — there is nothing on the right. */
const RIGHT_RESISTANCE = 0.2;

/**
 * WHICH ROW IS RESTING OPEN, ANYWHERE IN THE APP — an id and a register of
 * closers, rather than a held function, because a ref may not be read or
 * written during render and a plain closure would go stale the moment the row
 * re-rendered. `useId` gives every mounted row a stable name for its whole
 * life; the effect below keeps its closer current and takes it out again on
 * unmount, so a deleted card never leaves a closer nobody can call.
 */
let openRowId: string | null = null;
const closers = new Map<string, () => void>();

export function SwipeToDelete({
  children,
  onDelete,
  /** What VoiceOver and the block itself call the action. */
  label = 'Delete',
  enabled = true,
  reduceMotion,
}: {
  children: ReactNode;
  /**
   * Remove this row from the record. It may raise a confirm of its own (a
   * run-on line takes its neighbours with it) and it may be cancelled — the
   * row is put back either way, so a dialog dismissed leaves the ledger exactly
   * as it was.
   */
  onDelete: () => void;
  label?: string;
  enabled?: boolean;
  reduceMotion: boolean;
}) {
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);
  /** The row's measured width — where the block parks, and how far the commit
   * has to travel. `SCREEN_W` until the first layout, which lands long before
   * a finger can reach it. */
  const rowW = useSharedValue(SCREEN_W);
  /** Has the drag crossed `COMMIT`? Kept on the UI thread so the haptic fires
   * once per crossing rather than once per frame. */
  const armed = useSharedValue(false);

  /**
   * THE CLIP IS ONLY ON WHILE THE ROW IS OFF ITS MARK, and that is a fix rather
   * than an optimisation. The block has to be clipped, or it shows in the
   * page's own side gutter at rest. But the card inside ARRIVES on a
   * `FadeInDown`, which starts it 25 pt below where it lands — and a permanent
   * `overflow: hidden` sized to the card cut that entrance off at the ankles on
   * every settling line. So the clip goes on when a drag starts and comes off
   * only once the row is square again, which is exactly the window where the
   * card is not moving vertically and the block is.
   */
  const [clipped, setClipped] = useState(false);
  /**
   * Is the row RESTING open, waiting for the red block to be tapped? While it
   * is, a touch anywhere on the card means "never mind" and closes it — the
   * rule every swipeable list on this phone follows, and without it a tap on a
   * row shifted 92 pt off its own margin would open the line for editing.
   */
  const [open, setOpen] = useState(false);

  /** This row's name in the app-wide register of open rows. */
  const id = useId();

  const close = useCallback(() => {
    if (openRowId === id) openRowId = null;
    setOpen(false);
    if (reduceMotion) {
      tx.value = 0;
      setClipped(false);
      return;
    }
    tx.value = withSpring(0, SPRING.snappy, (finished) => {
      'worklet';
      if (finished) runOnJS(setClipped)(false);
    });
  }, [id, reduceMotion, tx]);

  useEffect(() => {
    closers.set(id, close);
    return () => {
      closers.delete(id);
      if (openRowId === id) openRowId = null;
    };
  }, [id, close]);

  const rest = useCallback(() => {
    // Mail's rule: a second row opening shuts the first, so a red block is
    // never left behind on a ledger the thumb has already scrolled past.
    if (openRowId !== null && openRowId !== id) closers.get(openRowId)?.();
    openRowId = id;
    setOpen(true);
    tx.value = reduceMotion ? -ACTION_W : withSpring(-ACTION_W, SPRING.snappy);
  }, [id, reduceMotion, tx]);

  /**
   * Remove it, then put the row back where it started. The reset is not a
   * contradiction: a deleted card unmounts in the same React commit and never
   * draws again, while a card whose confirm was cancelled has to be sitting
   * square on the page when the dialog goes. One path covers both, so there is
   * no state saying which happened.
   */
  const commit = useCallback(() => {
    if (openRowId === id) openRowId = null;
    onDelete();
    tx.value = 0;
    armed.value = false;
    setClipped(false);
    setOpen(false);
  }, [armed, id, onDelete, tx]);

  const swipe = Gesture.Pan()
    .enabled(enabled)
    .failOffsetY([-FAIL_Y, FAIL_Y])
    .onStart(() => {
      startX.value = tx.value;
      armed.value = tx.value <= -COMMIT;
      runOnJS(setClipped)(true);
    })
    .onChange((e) => {
      const raw = startX.value + e.translationX;
      tx.value = raw > 0 ? raw * RIGHT_RESISTANCE : raw;
      const now = tx.value <= -COMMIT;
      if (now !== armed.value) {
        armed.value = now;
        // Only on the way IN: the thumb learns where the wall is once, and a
        // tick on the way back out would read as a second decision.
        if (now) runOnJS(tapMedium)();
      }
    })
    .onEnd((e) => {
      const past = tx.value <= -COMMIT;
      const flung = e.velocityX < FLING_VX && tx.value <= -ACTION_W;
      if (past || flung) {
        if (reduceMotion) {
          runOnJS(commit)();
          return;
        }
        // The red sweeps across as the row leaves — the block travels with the
        // card, so there is nothing to reveal and nothing to fill.
        tx.value = withTiming(
          -rowW.value,
          { duration: DUR.base, easing: EASE.standard },
          (finished) => {
            if (finished) runOnJS(commit)();
          },
        );
        return;
      }
      if (tx.value <= -ACTION_W * 0.5) runOnJS(rest)();
      else runOnJS(close)();
    });

  /**
   * WHICH DIRECTIONS THE ROW OWNS DEPENDS ON WHETHER IT IS OPEN.
   *
   * Closed, it activates LEFTWARD only and FAILS outright on a rightward drag:
   * that drag is `DaySwipe` going back a day, and since the day's pan is
   * blocked waiting on this one, a handler that merely idled rightward would
   * have taken the back-a-day gesture away from every card on the page.
   *
   * Open, it owns both — dragging the row back to the right is how a person
   * shuts it, and the same `failOffsetX` that protects the day swipe would have
   * made an open row impossible to close with the gesture that opened it.
   */
  const pan = open
    ? swipe.activeOffsetX([-ACTIVATE_X, ACTIVATE_X])
    : swipe.activeOffsetX(-ACTIVATE_X).failOffsetX(ACTIVATE_X);

  const day = useContext(DaySwipeGestureContext);
  const gesture = day ? pan.blocksExternalGesture(day) : pan;

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));
  // The block is parked at the row's own right edge and travels with the card,
  // so what the drag does is uncover it rather than slide it in from nowhere.
  const block = useAnimatedStyle(() => ({ transform: [{ translateX: rowW.get() + tx.get() }] }));

  return (
    <View
      style={clipped ? styles.clip : undefined}
      onLayout={(e) => {
        rowW.value = e.nativeEvent.layout.width;
      }}>
      {/*
        THE BLOCK IS NOT BEHIND THE ROW, IT IS BESIDE IT, and that is the whole
        layout. The ledger's cards have no fill of their own — they are ink on
        the paper gradient — so a panel underneath would show straight through
        them. Parked at the row's right edge and moving with the card, the two
        never overlap and nothing has to be opaque.

        It is a SIBLING of the sliding layer rather than a child of it, which is
        a hit-testing rule and not a style: iOS does not deliver a touch to a
        subview lying outside its parent's bounds, so a block parked past the
        card's own right edge was tappable nowhere. Inside the clip, its visible
        strip is inside the bounds that matter.

        It is a screen wide so the commit has something to sweep with; only its
        first `ACTION_W` ever carries the glyph.

        It is mounted only while the row is off its mark, for the same reason
        the clip is: unclipped and at rest, a block parked on the right edge
        paints the page's own side margin red.
      */}
      {clipped ? (
        <Animated.View style={[styles.action, block]} pointerEvents="box-none">
          <PressableScale
            onPress={() => {
              tap();
              commit();
            }}
            haptic="none"
            activeScale={0.94}
            // The row's own card publishes Delete on the rotor; this is the
            // finger's copy of it and would be read out twice.
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            style={styles.actionBtn}>
            <Icon name="trash" size={moderateScale(20)} tint={color.onInk} />
            <Text style={styles.actionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {label}
            </Text>
          </PressableScale>
        </Animated.View>
      ) : null}
      <GestureDetector gesture={gesture}>
        <Animated.View style={slide}>
          {children}
          {/* The "never mind" target, only while the row is resting open. It
              does not fight the drag: a finger that MOVES is the pan's, which
              cancels the press under it (RNGH takes the touch out of the
              responder system when it activates). */}
          {open ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            />
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * The rotor action a swipeable row's card publishes, so VoiceOver has the verb
 * the gesture is. The label is the bare word: the focused element has already
 * read the exercise out, and "Delete Bench Press" after "Bench Press, 3 sets"
 * says the name twice.
 *
 * Module scope, so it is one prop identity for the life of the app rather than
 * a fresh array on every render of every card.
 */
export const DELETE_ROTOR_ACTIONS = [{ name: 'delete', label: 'Delete' }] as const;

/**
 * "A", "A and B", "A, B and C" — the ONE voice for naming the entries that
 * share a written line. It lived on the ⋯ sheet until that sheet was deleted;
 * the delete confirm is the last thing that needs it, and this is where delete
 * lives now.
 */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  /** Everything outside the row's own width is off-stage. */
  clip: {
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    left: 0,
    // Inset off the card's own vertical padding, so the block reads as a thing
    // sitting on the paper rather than as a band bleeding into its neighbours.
    top: spacing.xs,
    bottom: spacing.xs,
    width: SCREEN_W,
    backgroundColor: color.error,
    // Rounded on the side the eye sees. The right edge is always clipped.
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    borderCurve: 'continuous',
  },
  actionBtn: {
    width: ACTION_W,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  actionLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.onInk,
  },
});
