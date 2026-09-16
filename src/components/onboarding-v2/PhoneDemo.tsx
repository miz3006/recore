import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TodayDateline } from '@/components/today-header';
import { todayKey } from '@/lib/db/dates';
import { arrive } from '@/lib/motion/index';
import { MAX_FONT_SCALE, readingStyle, spacing, type } from '@/lib/theme';

import { LiveLedger } from './LiveLedger';
import { PhoneFrame, phoneMetrics } from './PhoneFrame';
import { v2color } from './tokens';

/**
 * THE HERO — the Today page performing itself inside a drawn iPhone
 * (owner, 16 September 2026: *"an iPhone frame drawn in code … the
 * real-looking Recore Today screen plays a looping demo"*).
 *
 * ## It is the product, not a picture of it
 *
 * The page inside the frame is composed of Today's own parts: the title
 * block, `TodayDateline`, and the record drawn by `LiveLedger` — which
 * renders `ExerciseCard` from `note-surface.tsx` on the real offline grammar.
 * The mini-screen is the full-width page scaled down, so the typography,
 * rings and spacing are exactly what a person meets on their first real day.
 * If the grammar or the card regresses, the first screen of the funnel shows
 * it before any other.
 *
 * ## The script is a push session, written like a person writes
 *
 * Each line is typed in two beats — the lift and its load first, a breath,
 * then the reps — because that is the cadence of someone logging between
 * sets, and the pause is where "it read that" happens. The line settles into
 * a card, the caret moves on, and the page shifts up under the writing hand
 * exactly as the real page scrolls to keep the composer in view.
 *
 * ## It LOOPS, and the ruling that banned that is amended
 *
 * `SelfWritingLedger` (this component's predecessor) ran once and stopped,
 * citing the motion rules' ban on looping decoration. The owner's directive
 * of 16 September 2026 asks for a seamless loop here by name. The rule stands
 * everywhere else; on this one screen the loop is the demonstration, and a
 * demonstration a latecomer's eye can catch from the start beats one that
 * finished before they looked up. Reduce Motion gets the finished record,
 * static, with nothing to wait for and nothing moving.
 */
const SCRIPT: readonly { head: string; tail: string }[] = [
  { head: 'bench press 100 kg', tail: ' 12, 12, 10' },
  { head: 'incline db press 30 kg', tail: ' 10, 10, 8' },
  { head: 'cable fly 25 kg', tail: ' 15, 15, 12' },
  { head: 'tricep pushdown 40 kg', tail: ' 12, 12, 10' },
];

/** The page is laid out at Today's own width and scaled to the glass, so every
 * component keeps the metrics it has on the real page. */
const LOGICAL_W = 360;
/** Below the island and the drawn status bar, where Today's large title
 * stands. In logical points, so it scales with the page. */
const PAGE_TOP = 72;

const FIRST_CHAR_MS = 46;
const CHAR_MS = 34;
const BETWEEN_BEATS_MS = 380;
const BEFORE_COMMIT_MS = 300;
const BETWEEN_LINES_MS = 560;
const HOLD_MS = 1700;
const FADE_MS = 350;

export function PhoneDemo({
  width,
  /** The crop — how much of the phone the hero band shows. The frame is drawn
   * full-length underneath; the band's own fade takes it over. */
  height,
}: {
  width: number;
  height: number;
}) {
  const reduced = useReducedMotion();
  const full = SCRIPT.map((l) => l.head + l.tail).join('\n');

  const [committed, setCommitted] = useState(reduced ? full : '');
  const [typed, setTyped] = useState('');
  const [cycle, setCycle] = useState(0);
  const fade = useSharedValue(1);
  /** How far the page has scrolled itself up to keep the caret on the glass,
   * in logical points. Driven by the record measuring itself. */
  const shift = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (reduced) return;
    const scheduled: ReturnType<typeof setTimeout>[] = [];
    timers.current = scheduled;
    const at = (ms: number, fn: () => void) => scheduled.push(setTimeout(fn, ms));

    let t = 700;
    const done: string[] = [];
    SCRIPT.forEach((line, i) => {
      const charMs = i === 0 ? FIRST_CHAR_MS : CHAR_MS;
      for (let c = 1; c <= line.head.length; c += 1) {
        const text = line.head.slice(0, c);
        at(t, () => setTyped(text));
        t += charMs;
      }
      t += BETWEEN_BEATS_MS;
      for (let c = 1; c <= line.tail.length; c += 1) {
        const text = line.head + line.tail.slice(0, c);
        at(t, () => setTyped(text));
        t += charMs;
      }
      t += BEFORE_COMMIT_MS;
      done.push(line.head + line.tail);
      const record = done.join('\n');
      at(t, () => {
        setTyped('');
        setCommitted(record);
      });
      t += BETWEEN_LINES_MS;
    });

    // The loop. The page fades as one piece, resets while invisible, and the
    // next cycle types onto an empty note — no snap, no half-state.
    at(t + HOLD_MS, () => {
      fade.value = withTiming(0, { duration: FADE_MS });
    });
    at(t + HOLD_MS + FADE_MS + 40, () => {
      setCommitted('');
      setTyped('');
      shift.value = 0;
      fade.value = withTiming(1, { duration: FADE_MS });
      setCycle((c) => c + 1);
    });

    return () => {
      scheduled.forEach(clearTimeout);
      timers.current = [];
    };
  }, [cycle, fade, full, reduced, shift]);

  const pageFade = useAnimatedStyle(() => ({ opacity: fade.value }));
  const pageShift = useAnimatedStyle(() => ({
    transform: [{ translateY: -shift.value }],
  }));

  const { band, bezel, screenW } = phoneMetrics(width);
  const scale = screenW / LOGICAL_W;
  /** How much of the page the crop leaves on the glass, in logical points. */
  const visibleLogical = (height - band - bezel) / scale;
  /**
   * THE PAGE TOP FOLLOWS THE READER'S TYPE SETTING. The island and status
   * bar are drawn at the phone's own scale; the page's text scales with
   * Dynamic Type — at XL the large title grew up into the island
   * (photographed, 16 Sep 2026). The title block's start moves down with the
   * same factor its own text grows by, so the two can never meet.
   */
  const { fontScale } = useWindowDimensions();
  const typeFactor = Math.min(Math.max(fontScale, 1), 1.6);
  const pageTop = PAGE_TOP * typeFactor;

  return (
    <PhoneFrame width={width}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.page,
          { width: LOGICAL_W, height: LOGICAL_W * 2.16, transform: [{ scale }] },
          pageFade,
        ]}>
        <Animated.View style={[styles.inner, { paddingTop: pageTop }, pageShift]}>
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Today
          </Text>
          <TodayDateline day={todayKey()} sessionCount={0} onOpenStreak={noop} />

          <View
            style={styles.record}
            onLayout={(e) => {
              // Keep the caret's line inside the crop: the page scrolls itself
              // by the shortfall and no further, the same rule the real page
              // follows when the keyboard covers the composer.
              const bottom = pageTop + TITLE_BLOCK * typeFactor + e.nativeEvent.layout.height;
              const overflow = Math.max(0, bottom - visibleLogical + 24);
              shift.value = reduced ? overflow : withSpring(overflow, arrive);
            }}>
            {committed ? (
              <LiveLedger text={committed} stagger={false} showWritten={false} />
            ) : null}
            <Text style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {typed}
              <Text style={styles.caret}>|</Text>
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </PhoneFrame>
  );
}

function noop() {}

/** Title + dateline, in logical points — measured once off the simulator; only
 * the scroll arithmetic reads it, and being a few points off means a few
 * points of extra air, never a clipped line. */
const TITLE_BLOCK = 76;

const styles = StyleSheet.create({
  /** Scaled from the top-left so the arithmetic in the render stays legible;
   * the frame clips whatever the crop hides. */
  page: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: 'top left',
  },
  inner: {
    paddingHorizontal: spacing.xl,
  },
  title: { ...type.largeTitle, color: v2color.ink },
  record: { marginTop: spacing.lg },
  /** The line being written, in the reading face — the composer's own voice. */
  line: { ...readingStyle('500'), fontSize: 17, lineHeight: 25, color: v2color.ink, minHeight: 25 },
  caret: { color: v2color.blue },
});
