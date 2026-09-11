import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { success, tap, tapMedium } from '@/lib/haptics';
import {
  getRestAutoStart,
  getRestSeconds,
  hasTaughtAutoRest,
  markTaughtAutoRest,
  REST_OPTIONS_S,
  setRestSeconds,
} from '@/lib/prefs';
import { cancelRestAlert, scheduleRestAlert } from '@/lib/rest-alert';
import { fmtClock, REST_EXTEND_S, restProgress, useRestTimer } from '@/lib/rest-timer';
import {
  color,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  type,
} from '@/lib/theme';

import { GlassPressable, GlassSurface } from './glass';
import { Icon } from './icon';

/**
 * THE REST TIMER — rebuilt 10 September 2026, and it is now the second
 * instrument on Today rather than a chip that changes into a word.
 *
 * ## What was wrong with the old one, and it was not the styling
 *
 * The chip *grew into text*: start a rest and the 44 pt circle became a pill
 * reading "rest 2:41", which pushed the mic and the hide-keyboard button
 * ~50 pt to the right — **the row moved under the thumb, mid-session, every
 * time a rest started.** `bottom-toolbar.tsx` states as a goal that "nothing
 * here ever moves under the thumb mid-session"; the timer was the one member
 * of the row that broke it, and the fix is the reason for the shape below.
 *
 * It was also, and separately, not a native control. iOS has never shown a
 * running countdown as words inside a round button. It shows a **ring** — the
 * Clock app's timer, a Screen Time budget, an Activity goal — and it puts the
 * digits somewhere that has room for digits.
 *
 * ## The shape
 *
 *     [ 2:41  rest                         +30 s   Skip ]   ← the bar, row 1
 *     ( ◔ )   ( mic )  ( ⌨ )              [ Finish ]        ← the row, unmoved
 *
 * **`RestRing`** — the button NEVER changes size. A brand-blue arc runs down
 * around the `timer` glyph over the rest, on the app's own progress-fill hue
 * (design skill §Colour lists "progress fill" among brand blue's homes, which
 * is exactly what this is). The arc counts DOWN, because that is what the
 * clock inside it is doing.
 *
 * **`RestBar`** — a full-width glass pill in the row above, where the status
 * pill sits when nothing is resting. It holds the reading, `+30 s` and `Skip`
 * as plain text bar buttons, which is how iOS puts two actions on one bar.
 * Rest is the time-critical thing on the screen while it runs, so it takes
 * that row; the tonnage it displaces is a number you can read at any moment
 * and this is not one.
 *
 * ## The rest starts ITSELF now (the actual feature)
 *
 * `useRestEngine` watches the parser's counted-set total for the day's note
 * and starts — or restarts — the rest the moment a set lands in it. It is what
 * every tracker in this category does and Recore did not: Setgraph spends a
 * whole onboarding screen on the sentence "the timer restarts after every set
 * you log", and Strong and Hevy default it on, because a rest timer you have
 * to remember to press runs on about one set in five.
 *
 * It is careful about being automatic:
 *
 * · **It fires on the record, never on a guess.** The trigger is
 *   `receipt.totalSets` — the parser's own counted (non-warm-up, non-drop) set
 *   total, the same number the receipt prints. Nothing is invented and nothing
 *   is written.
 * · **It is silent.** No haptic and no motion on an automatic start. §4 bans
 *   "surprise movement while someone is typing", and starting a clock is not
 *   worth a buzz in the middle of a word.
 * · **It only runs while you are writing** (`active`, the keyboard being up).
 *   A background parse landing on a page nobody is looking at may not start a
 *   clock.
 * · **It says so, once.** The first automatic rest of a person's life prints
 *   "started by the set you wrote" under the clock, then never again.
 * · **It is one row away from off**, in You › Training.
 */

/** The round buttons' diameter — a real 44 pt target, never smaller (§14). */
const ROUND = HIT;
/** The arc's weight. 2 pt reads at 44 pt without becoming a second border. */
const RING_STROKE = 2;
/** Inset so the arc sits just inside the glass edge rather than on it. */
const RING_R = (ROUND - RING_STROKE) / 2 - 1;
const RING_C = 2 * Math.PI * RING_R;

const TIMER_TICK_MS = 250;
/** How long the finished state holds before the controls go back to resting. */
const GO_FLASH_MS = 1800;
/** How long a freshly-cycled default length stays on screen. */
const PREVIEW_MS = 1600;
/** The last stretch, where the reading firms up. Weight, not colour: nothing
 * bad is happening and amber in this app means plateau or backoff. */
const FIRM_AT_S = 10;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** What the row above is currently reporting. */
export type RestMode = 'idle' | 'running' | 'go' | 'preview';

export interface RestEngine {
  mode: RestMode;
  /** Seconds left, or the previewed default length. */
  seconds: number;
  /** 0 → 1 across the rest actually being taken. */
  progress: number;
  /** The first automatic rest explains itself; every one after it is silent. */
  teaching: boolean;
  onPressTimer: () => void;
  onLongPressTimer: () => void;
  onExtend: () => void;
  onSkip: () => void;
  /** The session was finished — clear any rest and its pending alert. */
  onFinishSession: () => void;
}

/**
 * The clock's one owner: it ticks, it fires the completion haptic, it schedules
 * and cancels the pocket alert, and it starts the rest when a set lands.
 *
 * Everything that MOVES lives here and everything that DRAWS lives below, so
 * the ring and the bar can never disagree about a number — they are handed the
 * same one.
 */
export function useRestEngine({
  /** The parser's counted-set total for the day's note. */
  totalSets,
  /** Which note this total belongs to — a day change must not read as a set. */
  dayKey,
  /** Whether the athlete is writing right now (the keyboard is up). */
  active,
}: {
  totalSets: number;
  dayKey: string;
  active: boolean;
}): RestEngine {
  const endsAt = useRestTimer((s) => s.endsAt);
  const remaining = useRestTimer((s) => s.remaining);
  const total = useRestTimer((s) => s.total);
  const teach = useRestTimer((s) => s.teach);
  const startRest = useRestTimer((s) => s.start);
  const stopRest = useRestTimer((s) => s.stop);
  const tickRest = useRestTimer((s) => s.tick);
  const extendRest = useRestTimer((s) => s.extend);
  const taught = useRestTimer((s) => s.taught);

  const [preview, setPreview] = useState<number | null>(null);
  const [go, setGo] = useState(false);

  // --- the tick -------------------------------------------------------------
  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      tickRest(left);
      if (left <= 0) {
        stopRest();
        setGo(true);
        // The rest landed on its own terms, so the alert has done its job or
        // is about to; either way nothing should ring after this.
        void cancelRestAlert();
        success();
        setTimeout(() => setGo(false), GO_FLASH_MS);
      }
    };
    tick();
    const t = setInterval(tick, TIMER_TICK_MS);
    return () => clearInterval(t);
  }, [endsAt, tickRest, stopRest]);

  useEffect(() => {
    if (preview === null) return;
    const t = setTimeout(() => setPreview(null), PREVIEW_MS);
    return () => clearTimeout(t);
  }, [preview]);

  // --- the automatic start --------------------------------------------------
  //
  // `seen` is the set total this hook has already reacted to. It is null until
  // the first reading of a note, which is what stops an app open, a day swipe
  // or a background parse landing on existing text from reading as "a set was
  // just written" — the note being loaded is not the note being added to.
  const seen = useRef<number | null>(null);
  const seenDay = useRef(dayKey);

  useEffect(() => {
    if (seenDay.current !== dayKey) {
      seenDay.current = dayKey;
      seen.current = null;
    }
    const before = seen.current;
    seen.current = totalSets;
    if (before === null) return; // first reading of this note — a baseline
    if (totalSets <= before) return; // a deletion or a re-parse, not a new set
    if (!active) return; // nobody is writing; a parse alone starts nothing
    if (!getRestAutoStart()) return;

    // Setgraph's contract, and the right one: the timer RESTARTS on every set,
    // running or not. The rest you care about is the one after the set you
    // just did.
    const seconds = getRestSeconds();
    // The one explanation, the first time it ever happens. The flag travels
    // WITH the rest so nothing here has to call `setState` from an effect.
    const first = !hasTaughtAutoRest();
    if (first) markTaughtAutoRest();
    startRest(seconds, { source: 'auto', teach: first });
    scheduleRestAlert(Date.now() + seconds * 1000);
  }, [totalSets, dayKey, active, startRest]);

  // --- the controls ---------------------------------------------------------
  const onPressTimer = useCallback(() => {
    tap();
    setGo(false);
    if (useRestTimer.getState().endsAt !== null) {
      stopRest(); // stopped early — no judgment
      void cancelRestAlert();
      return;
    }
    const seconds = getRestSeconds();
    startRest(seconds, { source: 'manual' });
    scheduleRestAlert(Date.now() + seconds * 1000);
  }, [startRest, stopRest]);

  /** Idle only: cycle the default length. The value is also a settings row —
   * You › Training › Rest timer default — which is where it is discovered; this
   * is the shortcut for someone already standing at the bar. */
  const onLongPressTimer = useCallback(() => {
    if (useRestTimer.getState().endsAt !== null) return;
    tapMedium();
    const current = getRestSeconds();
    const idx = REST_OPTIONS_S.indexOf(current as (typeof REST_OPTIONS_S)[number]);
    const next = REST_OPTIONS_S[(idx + 1) % REST_OPTIONS_S.length]!;
    setRestSeconds(next);
    setPreview(next);
  }, []);

  const onExtend = useCallback(() => {
    tap();
    extendRest(REST_EXTEND_S);
    const next = useRestTimer.getState().endsAt;
    if (next !== null) scheduleRestAlert(next);
    taught(); // a deliberate touch means the explanation has landed
  }, [extendRest, taught]);

  const onSkip = useCallback(() => {
    tapMedium();
    stopRest();
    void cancelRestAlert();
  }, [stopRest]);

  /** Finish already has its own haptic and its own consequences; this only
   * takes the clock down with the session. Silent on purpose. */
  const onFinishSession = useCallback(() => {
    if (useRestTimer.getState().endsAt === null) return;
    stopRest();
    void cancelRestAlert();
  }, [stopRest]);

  const running = endsAt !== null;
  const mode: RestMode = running ? 'running' : go ? 'go' : preview !== null ? 'preview' : 'idle';

  return {
    mode,
    seconds: mode === 'preview' ? (preview ?? 0) : remaining,
    progress: restProgress(remaining, total),
    teaching: teach,
    onPressTimer,
    onLongPressTimer,
    onExtend,
    onSkip,
    onFinishSession,
  };
}

/**
 * THE BUTTON — a 44 pt round that stays 44 pt round for ever, with the arc as
 * the only thing that changes about it.
 *
 * Under Reduce Motion the arc still moves: it is a readout of time that has
 * actually passed, and `HoldToCommit` settled the same question the same way —
 * removing a progress ring leaves a person standing at a control with no
 * feedback at all. What Reduce Motion drops is the interpolation between ticks;
 * the value snaps to each second instead of gliding to it.
 */
export function RestRing({ engine }: { engine: RestEngine }) {
  const reduce = useReducedMotion();
  const { mode, progress } = engine;
  const running = mode === 'running';
  const go = mode === 'go';

  const swept = useSharedValue(0);

  useEffect(() => {
    if (!running) {
      swept.set(0);
      return;
    }
    if (reduce) {
      swept.set(progress);
      return;
    }
    // Linear, and exactly one tick long: the arc must report the time that has
    // passed, never ease its way to it.
    swept.set(withTiming(progress, { duration: TIMER_TICK_MS, easing: Easing.linear }));
  }, [progress, running, reduce, swept]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: RING_C * swept.get() }));

  return (
    <GlassPressable
      onPress={engine.onPressTimer}
      onLongPress={engine.onLongPressTimer}
      haptic="none"
      activeScale={0.92}
      radius={ROUND / 2}
      style={styles.round}
      contentStyle={styles.roundContent}
      // Finished = the app spoke: solid ink, no glass. Running is still glass —
      // a countdown is the control doing its job, not the app interrupting.
      solidFill={go ? color.accent : undefined}
      accessibilityLabel={
        running ? `Rest timer, ${fmtClock(engine.seconds)} left. Stop` : 'Start rest timer'
      }
      accessibilityHint={running ? undefined : 'Press and hold to change the rest length'}>
      {running ? (
        <Svg
          width={ROUND}
          height={ROUND}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          // 12 o'clock, like every countdown anyone has ever seen.
          viewBox={`0 0 ${ROUND} ${ROUND}`}>
          <Circle
            cx={ROUND / 2}
            cy={ROUND / 2}
            r={RING_R}
            stroke={color.track}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={ROUND / 2}
            cy={ROUND / 2}
            r={RING_R}
            stroke={color.brand}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={RING_C}
            animatedProps={arc}
            transform={`rotate(-90 ${ROUND / 2} ${ROUND / 2})`}
          />
        </Svg>
      ) : null}
      <Icon
        name="timer"
        size={ACCESSORY_GLYPH}
        tint={go ? color.onInk : running ? color.brand : color.textPrimary}
      />
    </GlassPressable>
  );
}

/**
 * THE BAR — the reading and the two things you can do about it.
 *
 * Full width, so `+30 s` and `Skip` sit at a fixed right edge and do not shuffle
 * as the digits change. They are plain text bar buttons, which is what iOS puts
 * on a bar and what §15 wants anyway: a button says exactly what happens.
 *
 * It renders nothing at all while nothing is resting — the caller shows the
 * status pill in this slot instead.
 */
export function RestBar({ engine }: { engine: RestEngine }) {
  const { mode, seconds, teaching } = engine;
  if (mode === 'idle') return null;

  const firm = mode === 'running' && seconds <= FIRM_AT_S;
  const label =
    mode === 'go' ? 'rest is up' : mode === 'preview' ? 'default rest length' : 'rest';

  return (
    <View style={styles.bar}>
      <GlassSurface radius={radius.pill} />
      <View style={styles.barRow}>
        <Text
          style={[styles.clock, firm && styles.clockFirm]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {fmtClock(mode === 'go' ? 0 : seconds)}
        </Text>
        <Text style={styles.barLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>

        {mode === 'running' ? (
          <View style={styles.barActions}>
            <Pressable
              onPress={engine.onExtend}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={`Add ${REST_EXTEND_S} seconds`}>
              <Text style={styles.extend} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {`+${REST_EXTEND_S} s`}
              </Text>
            </Pressable>
            <Pressable
              onPress={engine.onSkip}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Skip the rest of this rest">
              <Text style={styles.skip} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Skip
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Said once in a person's life, then never again. It has to be said at
          all: a clock that starts on its own with no explanation is a bug the
          first time you see it. It does NOT also name the setting that turns
          it off — that sentence wrapped the bar onto three lines over a
          keyboard, and "You › Training" is where a person looks for it anyway.
          One fact, on the surface where it happened. */}
      {teaching ? (
        <Text style={styles.taught} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          started by the set you wrote
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The accessory row's one glyph size.
 *
 * 20 pt rather than 18. UIKit draws a bar-button symbol at the system font size
 * in a 44 pt target, and `expo-symbols` renders every symbol at 17 pt and then
 * aspect-fits it into the box it is given — so the box IS the optical size, and
 * 18 was reading a step small beside the system keyboard's own keys.
 */
export const ACCESSORY_GLYPH = moderateScale(20);

const styles = StyleSheet.create({
  round: {
    minWidth: ROUND,
  },
  roundContent: {
    height: ROUND,
    width: ROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    alignSelf: 'stretch',
    minHeight: moderateScale(38),
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md + 2,
    gap: 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  clock: {
    ...readingStyle('600'),
    fontSize: type.headline.fontSize,
    color: color.textPrimary,
  },
  clockFirm: {
    ...readingStyle('700'),
  },
  barLabel: {
    ...readingStyle('400'),
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    flexShrink: 1,
  },
  barActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  extend: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.brand,
  },
  skip: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textSecondary,
  },
  taught: {
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
  },
});
