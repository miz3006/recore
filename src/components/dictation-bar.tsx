import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { EASE } from '@/lib/motion';
import { fmtClock } from '@/lib/rest-timer';
import {
  color,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { GlassSurface } from './glass';

/**
 * THE LISTENING BAR — Recore's dictaphone (owner, 17 September 2026:
 * *"naj se vidi da to posluša kot nek diktafon … in potem ko konča naj se
 * umakne in ugasne mikrofon"*).
 *
 * It sits in the accessory row's first slot, the same slot the rest bar uses,
 * and for the same reason: **a reading that is true for the next few seconds
 * and nowhere else.** It exists only while the microphone is live, and it
 * leaves the instant the session ends — which is the point. Before this, the
 * only evidence dictation was running was a filled glyph in a 44 pt circle,
 * and a microphone that had quietly stayed on looked exactly like one that had
 * not.
 *
 * ## WHY A MOVING WAVEFORM IS ALLOWED HERE
 *
 * The design system bans autoplaying decoration and "surprise movement while
 * someone is typing", and it is right to. This is neither. **Every bar is a
 * sample of the microphone's actual input level**, drawn in the order it was
 * heard — the same category of object as the rest ring's sweep or a value
 * updating: a readout of something happening right now, not an animation
 * playing over a still fact. It answers the one question a person has while
 * dictating and cannot answer any other way: *is it hearing me?* A flat line
 * means the room is quiet or the microphone is not picking you up, and that is
 * information you want before you talk through a whole session.
 *
 * It follows the rest of the rules exactly: `transform` only (`scaleY` on
 * fixed-height bars — nothing animates layout), ink rather than a new hue,
 * and **Reduce Motion gets a still waveform**, not an empty box. The reading
 * does not disappear with the movement: the word *listening* and the clock say
 * the same thing beside it, so colour and motion are never the only carriers.
 *
 * ## THE SHAPE CAME FROM THE APPS THAT DO THIS FOR A LIVING
 *
 * Studied on Appllama before a line was drawn — SpeakApp AI's active
 * recording, Noted's live-transcribe header, ABA English's speak screen, Song
 * AI's voice capture. Four apps, one skeleton, and Recore keeps the skeleton
 * and none of the pixels:
 *
 * - **a live level readout** (all four) — the waveform;
 * - **an elapsed clock** (all four) — because a microphone with no clock is
 *   how you end up having recorded for six minutes;
 * - **an unmissable, labelled stop** (all four, and every one of them puts it
 *   at the end of the bar) — `Stop`, a plain brand text button, exactly what
 *   `+30 s` and `Skip` already are on the rest bar one slot away.
 *
 * What was left behind: the red. Those apps go red because red is the
 * recording convention on a full-screen recorder; Recore's row is monochrome
 * on purpose, `error` red means a lost lift, and the record never blinks.
 */
export function DictationBar({
  level,
  seconds,
  onStop,
  fallbackLanguage = false,
}: {
  /** The microphone's live input, 0…1. Written by `useDictation`. */
  level: SharedValue<number>;
  seconds: number;
  onStop: () => void;
  /**
   * The phone's language has no recogniser and English stood in (`voice.ts`).
   *
   * The bar SAYS SO, in the one place the person is already looking. Apple
   * dictates 63 languages and Slovene — the owner's own — is not among them;
   * a microphone quietly listening in a language you are not speaking, with
   * the evidence arriving later as nonsense in your record, is exactly the
   * kind of thing §2 means by keeping the record trustworthy.
   */
  fallbackLanguage?: boolean;
}) {
  /**
   * WHAT GOES WHEN THE TEXT GETS BIG.
   *
   * Measured at `accessibility-extra-large` on the 17 Pro: waveform, clock,
   * word and action together overran the bar and clipped `Stop` to "Sto" — an
   * action label cut in half, which is the one thing on this bar that may
   * never happen. The clock is the part that leaves, and it is the right part:
   * the word says the microphone is on, the waveform says it can hear you, and
   * the elapsed seconds are the only one of the three a person can do without.
   * Below the threshold nothing changes at all.
   */
  const { fontScale } = useWindowDimensions();
  // The language note is longer than the word alone, so it takes the clock's
  // room before Dynamic Type does — which is the right order: WHAT it is
  // hearing outranks how long it has been hearing it.
  const roomForClock = fontScale <= CLOCK_DROPS_ABOVE && !fallbackLanguage;

  return (
    <View style={styles.bar}>
      <GlassSurface radius={radius.pill} />
      <View style={styles.row}>
        <Waveform level={level} />
        <View style={styles.reading}>
          {roomForClock ? (
            <Text style={styles.clock} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {fmtClock(seconds)}
            </Text>
          ) : null}
          <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {fallbackLanguage ? 'listening · English' : 'listening'}
          </Text>
        </View>
        <Pressable
          onPress={onStop}
          hitSlop={spacing.sm}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={`Stop dictation, ${fmtClock(seconds)} recorded`}>
          <Text style={styles.stop} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Stop
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The scrolling level meter.
 *
 * One shared array, one sample every {@link SAMPLE_MS}: the oldest reading
 * falls off the left, the newest arrives at the right. Each bar eases to the
 * height its neighbour just had, which is what makes a 12 Hz sample read as a
 * continuous scroll rather than a strobe.
 *
 * The samples keep coming in silence — a flat line IS the reading. A meter
 * that froze when nobody spoke would be indistinguishable from a meter that
 * had stopped working, and telling those two apart is the whole job.
 */
function Waveform({ level }: { level: SharedValue<number> }) {
  const reduce = useReducedMotion();
  const history = useSharedValue<number[]>(new Array(BARS).fill(0));

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      const next = history.get().slice(1);
      next.push(level.get());
      history.set(next);
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [history, level, reduce]);

  return (
    <View style={styles.wave} importantForAccessibility="no-hide-descendants">
      {STILL.map((rest, i) =>
        reduce ? (
          <View
            key={i}
            style={[styles.tick, { opacity: FADE[i], transform: [{ scaleY: rest }] }]}
          />
        ) : (
          <Tick key={i} history={history} index={i} />
        ),
      )}
    </View>
  );
}

function Tick({ history, index }: { history: SharedValue<number[]>; index: number }) {
  const animated = useAnimatedStyle(() => ({
    transform: [
      {
        scaleY: withTiming(FLOOR + (1 - FLOOR) * (history.get()[index] ?? 0), {
          duration: SAMPLE_MS + 40,
          easing: EASE.standard,
        }),
      },
    ],
  }));
  return <Animated.View style={[styles.tick, { opacity: FADE[index] }, animated]} />;
}

/** Enough to read as a waveform, few enough to leave the row its air. */
const BARS = 20;
/** ~12 readings a second — the rate `voice.ts` asks the recogniser to meter at. */
const SAMPLE_MS = 80;
/**
 * Silence still draws a line. A bar that collapsed to nothing would read as a
 * gap in the recording rather than a quiet moment in it — and at much less
 * than this the quiet stretch stops being a low line and starts being a row of
 * dots, which the eye files as an ellipsis: *thinking*, not *listening*.
 */
const FLOOR = 0.2;
const BAR_W = 2;
const WAVE_H = moderateScale(18);
/** Above this text scale the clock leaves rather than crowd the action. */
const CLOCK_DROPS_ABOVE = 1.3;

/** Older samples sit back. Precomputed — opacity per index is a fact about the
 * bar's age, and nothing may compute a colour or an alpha inside a worklet. */
const FADE = Array.from({ length: BARS }, (_, i) => 0.3 + 0.7 * (i / (BARS - 1)));

/**
 * The Reduce Motion silhouette — a still waveform, not an empty strip.
 *
 * Fixed, not random: the shape says "this control listens", and a shape that
 * changed every time the bar mounted would be motion by another route.
 */
const STILL = [
  0.24, 0.36, 0.52, 0.4, 0.66, 0.84, 0.6, 0.44, 0.72, 0.9, 0.7, 0.5, 0.62, 0.82, 0.58, 0.38, 0.5,
  0.68, 0.44, 0.3,
];

const styles = StyleSheet.create({
  // Deliberately the rest bar's geometry to the point: the two can share the
  // row and must not look like two different pieces of chrome.
  bar: {
    alignSelf: 'stretch',
    minHeight: moderateScale(38),
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The reading absorbs every bit of squeeze so the two things that must keep
  // their size — the meter and the action — never lose any of it.
  reading: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVE_H,
    flexShrink: 0,
    gap: BAR_W,
  },
  tick: {
    width: BAR_W,
    height: WAVE_H,
    borderRadius: BAR_W / 2,
    backgroundColor: color.textPrimary,
  },
  clock: {
    ...readingStyle('600'),
    fontSize: type.headline.fontSize,
    color: color.textPrimary,
    flexShrink: 0,
  },
  label: {
    ...readingStyle('400'),
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    flexShrink: 1,
  },
  action: {
    flexShrink: 0,
  },
  stop: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.brand,
  },
});
