import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { track } from '@/lib/analytics';
import {
  DEMO_EXAMPLE,
  parseDemoLine,
  toDemoEntry,
  type DemoEntry,
  type DemoReading,
  type DemoSource,
} from '@/lib/demo-parse';
import { remoteDemoParse } from '@/lib/demo-parse-remote';
import { success } from '@/lib/haptics';
import { DUR, EASE } from '@/lib/motion';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import {
  alpha,
  blend,
  color,
  fonts,
  HIT,
  ink,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';

import { BRAND_WASH, CARD_FILL, RISE_PX, SELECT_BORDER } from './tokens';
import { useSelectFill } from './use-select-fill';

/**
 * THE AHA MOMENT, and now the person's OWN line (conversion pass, 20 Aug 2026).
 *
 * This screen used to play a canned animation: `bench 100kg 5,5,4` faded in and
 * a record wiped in underneath it. It demonstrated the promise on somebody
 * else's training. Now the field is live — the keyboard opens on arrival, the
 * person writes a line from their last session, and the record made of THAT is
 * what appears. Everything after this screen is built out of it: the key-lift
 * chip, the overload card, the projection, and the first entry on Today.
 *
 * ## Read locally, in the same tick
 *
 * The app's real parser is an edge function behind a user JWT, and there is no
 * account yet — so the line is read by `lib/demo-parse.ts`, a small grammar for
 * exactly the shape this screen asks for. The real parser is asked only when a
 * session happens to exist (a replay from You), with a 2.5 s ceiling. Neither
 * path writes anything: the record starts at signup, from the person's own raw
 * text (`lib/onboarding-seed.ts`).
 *
 * ## It cannot dead-end
 *
 * Gibberish, an empty line, a timeout — none of them produce an error state.
 * They produce the CANNED example, animated, under a caption that says what is
 * being shown. A demo that can fail is a demo that can lose someone on the
 * fourth screen of the funnel; nothing on this page is allowed to say "no".
 *
 * ## The button waits
 *
 * The CTA is not rendered until a reading has landed (`onSettled`), so
 * "That's the whole app" arrives as the consequence of the moment rather than
 * as a way past it. The screen's CTA band stays reserved either way — the
 * template's fixed zones mean nothing moves when the button appears.
 *
 * ## Motion
 *
 * The written line flashes once, then the record settles in beneath it, and the
 * success haptic fires on the frame it lands. Under Reduce Motion the record is
 * simply there — the haptic still fires, because it is feedback, not motion.
 * Nothing here loops (§A.1).
 */

/** The caption under a record the person did not write themselves. */
const FALLBACK_CAPTION = "Here's how a line becomes a record.";

/** Chip typing speed — fast enough to feel written, slow enough to read. */
const TYPE_MS = 30;
/** How long the written line holds its wash before the record arrives. */
const FLASH_MS = 140;

/** Precomputed for the worklets below: a `useAnimatedStyle` may only do
 * arithmetic on values it is handed — calling `alpha()`/`blend()` inside one
 * crashes at runtime. */
const BRAND = color.brand;
const FIELD_IDLE = CARD_FILL;
const FIELD_FOCUS = blend(color.brand, 0.05, color.surface);
const FIELD_FLASH = BRAND_WASH;

type Landed = { reading: DemoReading; canned: boolean };

export function ParseDemo({
  onResult,
  onSettled,
}: {
  /** The last SUCCESSFUL reading of the person's own line — null when all they
   * ever saw was the canned example, which is never stored as their answer. */
  onResult: (entry: DemoEntry | null) => void;
  /** A record has landed: the screen may show its button. */
  onSettled: () => void;
}) {
  const reduce = useReducedMotion();
  const input = useRef<TextInput>(null);

  const [text, setText] = useState('');
  /** The field's current words, readable from a callback that is not a render —
   * dictation ends outside React's flow and must not read a stale closure. */
  const latest = useRef('');
  const [focused, setFocused] = useState(false);
  const [landed, setLanded] = useState<Landed | null>(null);
  const [recording, setRecording] = useState(false);
  const [mic] = useState(() => voiceAvailable());

  const dictation = useRef<DictationHandle | null>(null);
  /** How many times this person asked the screen to read something. The number
   * that says whether the demo is a moment or a fight (§13). */
  const attempts = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  /** The words dictation started from — the same base-note shape the Today
   * toolbar uses, so an utterance replaces itself instead of stacking. */
  const spoken = useRef(false);

  const flash = useSharedValue(0);
  const reveal = useSharedValue(0);
  const focus = useSelectFill(focused);

  const write = useCallback((value: string) => {
    latest.current = value;
    setText(value);
  }, []);

  const after = useCallback((ms: number, run: () => void) => {
    const t = setTimeout(run, ms);
    timers.current.push(t);
  }, []);

  // The keyboard opens by itself, a beat after the push has finished — asking
  // for it during the transition makes the platform animate two things at once
  // and the page arrives with a stutter.
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(
    () => () => {
      dictation.current?.stop();
      if (typing.current) clearInterval(typing.current);
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  /** Put a record on the page: flash the line, settle the card, then the tick. */
  const land = useCallback(
    (reading: DemoReading, canned: boolean) => {
      setLanded({ reading, canned });
      if (reduce) {
        reveal.set(1);
        success();
        onSettled();
        return;
      }
      flash.set(
        withSequence(
          withTiming(1, { duration: FLASH_MS, easing: EASE.standard }),
          withTiming(0, { duration: DUR.base, easing: EASE.standard }),
        ),
      );
      reveal.set(0);
      after(FLASH_MS, () => reveal.set(withTiming(1, { duration: DUR.base, easing: EASE.emphasized })));
      // The record has arrived, so the moment is over and the button may exist.
      after(FLASH_MS + DUR.base, () => {
        success();
        onSettled();
      });
    },
    [after, flash, onSettled, reduce, reveal],
  );

  /**
   * Read what is written. Local first because it answers in this tick; the real
   * parser only when there is a session for it to use; the canned example when
   * neither can say anything true.
   */
  const run = useCallback(
    async (source: DemoSource, value: string) => {
      const line = value.trim();
      attempts.current += 1;
      if (!line) {
        track('onboarding_demo_failed', { reason: 'empty', attempts: attempts.current });
        const canned = parseDemoLine(DEMO_EXAMPLE);
        if (canned) land(canned, true);
        onResult(null);
        return;
      }

      const local = parseDemoLine(line);
      if (local) {
        land(local, false);
        onResult(toDemoEntry(line, local, source, true));
        track('onboarding_demo_parsed', {
          source,
          parsed_locally: true,
          attempts: attempts.current,
        });
        return;
      }

      const remote = await remoteDemoParse(line);
      if (remote) {
        land(remote, false);
        onResult(toDemoEntry(line, remote, source, false));
        track('onboarding_demo_parsed', {
          source,
          parsed_locally: false,
          attempts: attempts.current,
        });
        return;
      }

      // Nothing readable — and still no error. The canned example runs, the
      // caption says what it is, and the person keeps their own words in the
      // field to try again.
      // The reason is a CATEGORY, never the line itself: what a person wrote
      // does not leave the device (§7.3), not even to explain a miss.
      track('onboarding_demo_failed', { reason: 'unreadable', attempts: attempts.current });
      const canned = parseDemoLine(DEMO_EXAMPLE);
      if (canned) land(canned, true);
      onResult(null);
    },
    [land, onResult],
  );

  /** The zero-effort path: the example types itself, then reads itself. */
  const tryExample = useCallback(() => {
    if (typing.current) return;
    input.current?.blur();
    write('');
    let i = 0;
    typing.current = setInterval(() => {
      i += 1;
      write(DEMO_EXAMPLE.slice(0, i));
      if (i >= DEMO_EXAMPLE.length) {
        if (typing.current) clearInterval(typing.current);
        typing.current = null;
        void run('example', DEMO_EXAMPLE);
      }
    }, TYPE_MS);
  }, [run, write]);

  const toggleMic = useCallback(async () => {
    if (recording) {
      dictation.current?.stop();
      return;
    }
    spoken.current = false;
    const handle = await startDictation({
      onTranscript: (transcript) => {
        spoken.current = true;
        write(transcript);
      },
      onEnd: () => {
        dictation.current = null;
        setRecording(false);
        // The utterance is the submission: nobody dictates a line and then
        // reaches for a return key.
        if (spoken.current) void run('dictated', latest.current);
      },
    });
    if (handle) {
      dictation.current = handle;
      setRecording(true);
    }
  }, [recording, run, write]);

  // Two washes on one surface: focus is the steady state, the flash rides over
  // it for one beat. Nested rather than blended by hand, so a field that is
  // focused when the line lands does not step back to the idle colour first.
  const fieldStyle = useAnimatedStyle(() => {
    const resting = interpolateColor(focus.get(), [0, 1], [FIELD_IDLE, FIELD_FOCUS]);
    return {
      borderColor: interpolateColor(focus.get(), [0, 1], [FIELD_IDLE, BRAND]),
      backgroundColor: interpolateColor(flash.get(), [0, 1], [resting, FIELD_FLASH]),
    };
  });

  const cardStyle = useAnimatedStyle(() => ({
    opacity: reveal.get(),
    transform: [{ translateY: (1 - reveal.get()) * RISE_PX }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.field, fieldStyle]}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={write}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={() => void run('typed', text)}
          placeholder={DEMO_EXAMPLE}
          placeholderTextColor={color.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={120}
          style={styles.input}
          accessibilityLabel="Write a line from your last session"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        {/* A dead control is worse than no control (§6): in Expo Go the speech
            module is not linked, and then there is no microphone here at all. */}
        {mic ? (
          <Pressable
            onPress={() => void toggleMic()}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop dictation' : 'Dictate a line'}
            accessibilityState={{ selected: recording }}
            style={({ pressed }) => [styles.mic, pressed && styles.pressed]}>
            <Icon
              name={recording ? 'mic-on' : 'mic'}
              size={moderateScale(20)}
              tint={recording ? color.brand : color.textMuted}
            />
          </Pressable>
        ) : null}
      </Animated.View>

      <View style={styles.chipRow}>
        <PressableScale
          onPress={tryExample}
          activeScale={0.95}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={`Try this one: ${DEMO_EXAMPLE}`}
          style={styles.chip}>
          <Text style={styles.chipLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Try this one
          </Text>
        </PressableScale>
      </View>

      {landed ? (
        <Animated.View style={cardStyle}>
          {landed.canned ? (
            <Text style={styles.quote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {DEMO_EXAMPLE}
            </Text>
          ) : null}
          <DemoCard reading={landed.reading} />
          {landed.canned ? (
            <Text style={styles.caption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {FALLBACK_CAPTION}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The record, in the ledger's own voice: the movement in the reading face, the
 * load and the reps in Recore blue. It is a lightweight twin of the Today
 * entry card rather than the component itself — that one reads from the session
 * store, needs a workout id, and can open sheets, none of which exists yet on
 * the fourth screen of the funnel.
 */
function DemoCard({ reading }: { reading: DemoReading }) {
  const load = reading.weightKg == null ? null : formatDemoLoad(reading);
  const reps = reading.reps.join(' · ');
  return (
    <View
      style={styles.rowClip}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Recore recorded ${reading.exerciseName}${
        load ? `, ${load}` : ''
      }, reps ${reading.reps.join(', ')}.`}>
      <View style={styles.row}>
        <Text style={styles.exercise} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {reading.exerciseName}
        </Text>
        <View style={styles.readings}>
          {load ? (
            <>
              <Text style={styles.reading} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {load}
              </Text>
              <Text style={styles.dot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {'·'}
              </Text>
            </>
          ) : null}
          <Text style={styles.reading} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {reps}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The load in the unit it was WRITTEN in — 225 lb is read back as 225 lb. */
function formatDemoLoad(reading: DemoReading): string | null {
  if (reading.weightKg == null) return null;
  const value = reading.unit === 'lb' ? reading.weightKg * 2.2046226218 : reading.weightKg;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${reading.unit}`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: moderateScale(58),
    backgroundColor: CARD_FILL,
    borderWidth: SELECT_BORDER,
    borderColor: CARD_FILL,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg,
    // A white surface on the canvas needs an edge to exist: it is 1.05:1 by
    // tone (skill §Spacing, radii, elevation).
    ...shadow.card,
  },
  /** MONO, because this is raw text — the parser's own echo voice, and the same
   * face the ledger uses for a line the app has not read yet. */
  input: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    lineHeight: lineFor(21),
    color: color.textPrimary,
    paddingVertical: spacing.md,
  },
  mic: {
    width: HIT - spacing.md,
    height: HIT - spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.sm,
  },
  pressed: {
    opacity: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: CARD_FILL,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: moderateScale(40),
    justifyContent: 'center',
    ...shadow.card,
  },
  chipLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  quote: {
    ...type.body,
    fontFamily: fonts.mono,
    fontSize: moderateScale(15),
    lineHeight: lineFor(21),
    color: alpha(color.textPrimary, ink.echo),
    marginBottom: spacing.sm,
  },
  caption: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.sm,
  },
  rowClip: {
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: CARD_FILL,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.card,
  },
  exercise: {
    ...type.headline,
    fontWeight: '500',
    color: color.textPrimary,
    flexShrink: 1,
  },
  readings: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  reading: {
    ...readingStyle('600'),
    fontSize: moderateScale(17),
    lineHeight: lineFor(22),
    color: color.brand,
  },
  dot: {
    ...type.subhead,
    color: color.textMuted,
  },
});
