import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { alpha, color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';

import { GutterPending } from './gutter-value';
import { NOTE_FONT_SIZE, NOTE_LINE_HEIGHT } from './note-metrics';

/**
 * The front door demos the product before asking for anything: a note types
 * itself in the user's own shorthand, the analyzing dots breathe, and the
 * parsed signals settle into the right gutter — the exact interaction the app
 * is. Runs on the same note metrics and monochrome rules as the home surface.
 * Under reduceMotion the finished note renders statically, no loop, no cursor.
 */
const SCRIPT = [
  { text: 'bench 3x8 80kg', signal: '↑ +2.5', pr: false },
  { text: 'weighted dips 12-10-8', signal: 'PR', pr: true },
  { text: 'sled push 4x20m', signal: '= same', pr: false },
] as const;

const TYPE_MS = 34; // per character, plus jitter — human, not robotic
const TYPE_JITTER_MS = 40;
const LINE_PAUSE_MS = 320;
const THINK_MS = 750; // dots breathe before the sweep
const REVEAL_STEP_MS = 240;
const HOLD_MS = 3400; // let the finished note be read
const FADE_MS = 420;

const SIGNAL_OPACITY = 0.7;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function SignInDemo() {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState({ line: 0, chars: 0 });
  const [typingDone, setTypingDone] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;

    const run = async () => {
      while (!cancelled) {
        setProgress({ line: 0, chars: 0 });
        setTypingDone(false);
        setRevealedCount(0);
        containerOpacity.value = withTiming(1, { duration: 300 });
        await sleep(600);

        for (let li = 0; li < SCRIPT.length; li++) {
          const text = SCRIPT[li]!.text;
          for (let c = 1; c <= text.length; c++) {
            if (cancelled) return;
            setProgress({ line: li, chars: c });
            await sleep(TYPE_MS + Math.random() * TYPE_JITTER_MS);
          }
          await sleep(LINE_PAUSE_MS);
        }

        if (cancelled) return;
        setTypingDone(true);
        await sleep(THINK_MS);

        for (let i = 1; i <= SCRIPT.length; i++) {
          if (cancelled) return;
          setRevealedCount(i);
          await sleep(REVEAL_STEP_MS);
        }

        await sleep(HOLD_MS);
        if (cancelled) return;
        containerOpacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.in(Easing.ease) });
        await sleep(FADE_MS + 80);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));

  // Which lines exist yet, and how much of each is on screen.
  const textForLine = (i: number): string | null => {
    if (reduceMotion || typingDone || i < progress.line) return SCRIPT[i]!.text;
    if (i === progress.line) return SCRIPT[i]!.text.slice(0, progress.chars);
    return null;
  };

  const activeLine = typingDone ? SCRIPT.length - 1 : progress.line;

  return (
    <Animated.View style={containerStyle}>
      {SCRIPT.map((entry, i) => {
        const text = textForLine(i);
        if (text === null) return <View key={i} style={styles.row} />;

        const revealed = reduceMotion || revealedCount > i;
        const thinking = !reduceMotion && typingDone && !revealed;

        return (
          <View key={i} style={styles.row}>
            <Text style={styles.line} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {text}
            </Text>
            {!reduceMotion && i === activeLine ? <Cursor /> : null}
            <View style={styles.spacer} />
            <View style={styles.gutterCell}>
              {revealed ? (
                <DemoSignal text={entry.signal} pr={entry.pr} />
              ) : thinking ? (
                <GutterPending rowHeight={NOTE_LINE_HEIGHT} />
              ) : null}
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
}

/** The parsed value settling in — the home gutter's fade + 4px slide, with the
 * single PR overshoot when the line earned it. */
function DemoSignal({ text, pr }: { text: string; pr: boolean }) {
  const reduceMotion = useReducedMotion();
  const target = pr ? 1 : SIGNAL_OPACITY;
  const opacity = useSharedValue(reduceMotion ? target : 0);
  const shift = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    shift.value = 4;
    opacity.value = withTiming(target, { duration: 260, easing: Easing.out(Easing.cubic) });
    shift.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    if (pr) {
      scale.value = 0.8;
      scale.value = withSequence(
        withTiming(1.12, { duration: 180, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: shift.value }, { scale: scale.value }],
  }));

  if (pr) {
    return (
      <Animated.View style={[styles.prPill, animatedStyle]}>
        <Text style={styles.prText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {text}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.Text style={[styles.signal, animatedStyle]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {text}
    </Animated.Text>
  );
}

/** The product's white cursor, alive at the end of the line being written. */
function Cursor() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.15, { duration: 550, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.cursor, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: NOTE_LINE_HEIGHT,
  },
  line: {
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: '400',
    color: color.textPrimary,
    flexShrink: 1,
  },
  cursor: {
    width: 2,
    height: Math.round(NOTE_FONT_SIZE * 1.2),
    borderRadius: 1,
    marginLeft: 2,
    backgroundColor: color.accent,
  },
  spacer: {
    flex: 1,
  },
  gutterCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: moderateScale(64),
  },
  signal: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  prPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.5),
  },
  prText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontWeight: '500',
    letterSpacing: 1,
    color: color.textPrimary,
  },
});
