import { GlassContainer } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { markFirstWorkoutFinished } from '@/lib/funnel';
import { success, tap, tapMedium } from '@/lib/haptics';
import { refreshRecapNotification } from '@/lib/recap';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
import { matchPlanIndex, nameKey, typedNameOf } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import {
  getRestSeconds,
  hasFinishedOnce,
  markFinishedOnce,
  REST_OPTIONS_S,
  setRestSeconds,
} from '@/lib/prefs';
import { fmtClock, useRestTimer } from '@/lib/rest-timer';
import { maybeAskForReview } from '@/lib/review';
import { color, fonts, HIT, ink, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import { useCurrentNote, useSession } from '@/state/session-store';

import { GlassSurface } from './glass';
import { Icon } from './icon';
import { PressableScale } from './motion';
import { revealReceipt } from './note-focus';

/**
 * The ACCESSORY BAR — rebuilt 28 July on the owner's reference: FLOATING GLASS
 * shapes over the keyboard instead of a bordered strip attached to it.
 *
 * The shape is two rows and no bar:
 *
 *   [ 4 staged · 3 240 kg ]                          ← a glass pill, the number
 *   ( timer ) ( mic ) ( hide kb ) ( plan )  [ Finish ]
 *
 * The material is `GlassSurface` — the system's Liquid Glass where it exists,
 * the app's warm paper everywhere else, and **no tint either way** for the same
 * reason §4 sets none on the tab bar: glass recolours itself against what is
 * behind it, and a fixed hex goes illegible over some content.
 *
 * What the reference had and this deliberately does NOT: colour and an emoji.
 * The mic is not blue, the timer is not purple, and the streak is a mono
 * numeral in the top bar, never a flame (§5.1, §5.7 — this is the app
 * reporting, and a record does not wink).
 *
 * THE STATUS PILL is the live count and tonnage ("4 staged · 3 240 kg"; parsed
 * volume once the background parse lands, an instant text estimate before
 * that), tapping through to Progress. The teaching tail ("— they count when you
 * finish") explains the record contract only until the first session is
 * finished, then retires for good.
 *
 * THE MIC dictates: on-device speech (never a cloud API) streams interim text
 * straight into the note, so the parse pipeline just works. While recording,
 * the button inverts to a solid ink fill.
 *
 * THE HIDE-KEYBOARD BUTTON puts the keyboard away without settling anything.
 * The note dismisses on an interactive scroll drag already, but that is a
 * gesture you have to know about, and the only LABELLED way down was Finish —
 * which ends the session. Reading back what you just wrote is not the same as
 * being done, and the bar should not make someone claim the second to get the
 * first. It can never be a dead control: the bar only exists while the keyboard
 * is up (§1.1 invariant 6).
 *
 * THE PLAN BUTTON writes the next prescribed line into the note as real text —
 * the one thing here the keyboard cannot do faster. It is rendered **only when
 * there is a prescription left to take**: no plan, or every line already
 * written, and it is not there at all (§1.1 invariant 6 — silence over a dead
 * control). It replaced a "+", which would have created nothing.
 *
 * FINISH keeps its words. It is the one committed action on this screen and
 * §15 says a button says exactly what happens, so it stays a labelled ink pill
 * rather than becoming a glyph like the reference's round icons.
 */
export function BottomToolbar({ bottomInset = 0 }: { bottomInset?: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const receipt = useSession((s) => s.receipt);
  const ghost = useSession((s) => s.ghost);
  const userId = useSession((s) => s.userId);
  const workoutId = useSession((s) => s.workoutId);
  const checkGhostLine = useSession((s) => s.checkGhostLine);
  const openCheckIn = useSession((s) => s.openCheckIn);
  const finishSession = useSession((s) => s.finishSession);
  const total = parsedSnapshot === note ? parsedVolume : estimateVolume(note);
  // A run-only session totals in distance, not an empty count (kg still wins
  // when both exist — the mixed-session detail lives in the receipt).
  const distanceM = total === 0 && parsedSnapshot === note ? (receipt?.distanceM ?? 0) : 0;

  // What's STAGED = distinct parsed exercises on this day's note. Nothing is
  // recorded until the user finishes — the status line says so. A cleared
  // note stages nothing, even while the old parse lingers in memory.
  const staged =
    note.trim().length > 0 && receipt ? new Set(receipt.rows.map((r) => r.exercise)).size : 0;
  const canFinish = staged > 0;

  const [recording, setRecording] = useState(false);
  // The record-contract tail teaches once; after a first finished session the
  // status line goes bare (a serious lifter doesn't need the caption twice).
  const [taughtDone, setTaughtDone] = useState(() => hasFinishedOnce());
  const dictation = useRef<DictationHandle | null>(null);
  // The note as it was when dictation started — interim results re-render the
  // utterance in place instead of stacking duplicates.
  const baseNote = useRef('');
  const reviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      dictation.current?.stop();
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
    },
    [],
  );

  const handleMic = async () => {
    if (recording) {
      tapMedium();
      dictation.current?.stop();
      return;
    }

    tap();
    if (!voiceAvailable()) {
      Alert.alert(
        'Voice input',
        'Dictation needs the development build (npx expo run:ios) — it is not available in Expo Go.',
      );
      return;
    }

    baseNote.current = note.replace(/\s+$/, '');
    const handle = await startDictation({
      onTranscript: (text, final) => {
        const base = baseNote.current;
        const joined = base.length > 0 ? `${base}\n${text}` : text;
        setNote(joined);
        if (final) baseNote.current = joined; // next utterance starts a new line
      },
      onEnd: () => {
        dictation.current = null;
        setRecording(false);
      },
    });

    if (handle) {
      dictation.current = handle;
      setRecording(true);
    } else {
      Alert.alert('Voice input', 'Microphone or speech permission was not granted.');
    }
  };

  /**
   * The next prescribed line that is NOT already in the note — what the plan
   * button writes. `null` hides the button entirely, which is most days: no
   * prediction, or every line already taken.
   *
   * The source is the ghost's own text, because that is already the parseable
   * form (`bench press 3×5  82.5 kg`) the note wants. The plan strip's rows are
   * display values ("82.5 × 5·5·5") and would not survive a re-parse, so they
   * are deliberately not used here.
   *
   * "Already in the note" is matched the same way `ghost-prediction.tsx` decides
   * a row is done: verbatim, or by the exercise name resolving to that row.
   */
  const nextPlanLine = useMemo(() => {
    if (!ghost) return null;
    const planLines = ghost.ghostText.split('\n').filter((l) => l.trim().length > 0);
    if (planLines.length === 0) return null;

    const planKeys = planLines.map((l) => nameKey(typedNameOf(l)));
    const noteLines = note.split('\n');
    const taken = planLines.map((line) => noteLines.some((l) => l.trim() === line.trim()));
    for (const raw of noteLines) {
      // Mid-keystroke fragments and prose never check a row off.
      if (!/\d/.test(raw) && raw.trim().split(/\s+/).length > 4) continue;
      const i = matchPlanIndex(typedNameOf(raw), planKeys);
      if (i !== null) taken[i] = true;
    }

    const next = planLines.findIndex((_, i) => !taken[i]);
    return next === -1 ? null : planLines[next]!;
  }, [ghost, note]);

  const handlePlan = () => {
    if (!nextPlanLine) return;
    tapMedium();
    checkGhostLine(nextPlanLine);
  };

  /**
   * Put the keyboard away without committing anything.
   *
   * The note already dismisses on an interactive scroll drag, but that is a
   * gesture you have to know about, and the only labelled way down was FINISH —
   * which settles the session. Wanting to read back what you have written is
   * not the same as being done training, and the app should not make someone
   * declare the second to get the first.
   *
   * Nothing is written here, so it is a light tap, not the committed-action
   * haptic (§5.6). Dictation deliberately keeps running: it never needed the
   * keyboard.
   */
  const handleHideKeyboard = () => {
    tap();
    Keyboard.dismiss();
  };

  // Finish = settle the eye on the ledger: keyboard down, receipt in view.
  // Nothing is written here — the receipt below the note IS the record. The
  // first finish also retires the status-line teaching tail for good.
  const handleFinish = () => {
    if (!canFinish) return;
    tapMedium();
    if (!taughtDone) {
      markFinishedOnce();
      setTaughtDone(true);
    }
    // §13: "first workout finished". A local counter, impossible to backfill —
    // the first hundred installs happen once.
    markFirstWorkoutFinished();
    // The session is settled: the resting pill stops reporting a live set and
    // goes back to the day's totals, and the reflection row appears under the
    // ledger. Writing another line re-opens it (session-store).
    finishSession();
    // A finished session changed this week's numbers — the pending §12.1 recap
    // notice re-computes so Sunday's text stays true. No-op while it is off.
    if (userId) void refreshRecapNotification(userId);
    Keyboard.dismiss();
    revealReceipt(!reduceMotion);

    // The check-in (§8.1): a few words about how it went, plus the effort
    // scale. Opened here and nowhere else on the automatic path — the honest
    // moment to ask is the one where the session just landed. It is optional,
    // it carries a real Skip, and it is reachable again later from the receipt
    // for anyone who answers on the train home. It never blocks the save: the
    // session is already on disk by the time this opens.
    openCheckIn();

    // The App Store review prompt — the ONLY place it is ever requested
    // (`src/lib/review/`). It waits for the receipt to settle first: the system
    // sheet appearing on top of the ledger the user just earned would cover the
    // one thing that made the moment worth rating. `maybeAskForReview` decides
    // for itself and stays silent for almost every finish; nothing here may
    // branch on the answer.
    if (userId) {
      const prToday = receipt?.rows.some((r) => r.signal?.kind === 'pr') ?? false;
      if (reviewTimer.current) clearTimeout(reviewTimer.current);
      reviewTimer.current = setTimeout(() => {
        reviewTimer.current = null;
        // Never over the check-in. The system review sheet would land on
        // top of a question the user is in the middle of answering, and Apple
        // gives us no callback to wait on. Skipping costs nothing — the prompt
        // is silent for almost every finish anyway and this one comes round
        // again next time.
        if (useSession.getState().checkInOpen) return;
        void maybeAskForReview({ userId, workoutId, prToday });
      }, REVIEW_PROMPT_DELAY_MS);
    }
  };

  // The status line names the contract; tonnage rides along (folds the old
  // volume pill in) and the line still routes to /stats.
  const tonnage =
    total > 0
      ? ` · ${groupThousands(total)} kg`
      : distanceM > 0
        ? ` · ${formatDistanceTotal(distanceM)}`
        : '';
  // The teaching tail is training wheels — shown only until the first finish.
  const tail = taughtDone
    ? ''
    : staged === 1
      ? ' — it counts when you finish'
      : ' — they count when you finish';
  const status =
    note.trim().length === 0
      ? null
      : staged === 0
        ? 'nothing staged yet'
        : `${staged} staged${tonnage}${tail}`;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      {status ? (
        <Pressable
          onPress={() => {
            tap();
            router.push('/progress');
          }}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.statusPill, pressed && styles.pressedDim]}>
          <GlassSurface radius={radius.pill} />
          <Text
            style={styles.statusText}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {status}
          </Text>
        </Pressable>
      ) : null}

      <GlassContainer spacing={GLASS_MERGE_DISTANCE} style={styles.row}>
        <RestTimer />

        <PressableScale
          onPress={() => void handleMic()}
          haptic="none"
          activeScale={0.92}
          style={[styles.round, recording && styles.roundActive]}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop dictation' : 'Dictate'}>
          {recording ? null : <GlassSurface radius={ROUND / 2} />}
          <Icon name="mic" size={moderateScale(18)} tint={recording ? color.onInk : color.textSecondary} />
        </PressableScale>

        {/* Sits immediately after the mic and BEFORE the plan button, which is
            the only round that comes and goes — so the two buttons that are
            always there never move under the thumb. */}
        <PressableScale
          onPress={handleHideKeyboard}
          haptic="none"
          activeScale={0.92}
          style={styles.round}
          accessibilityRole="button"
          accessibilityLabel="Hide keyboard">
          <GlassSurface radius={ROUND / 2} />
          <Icon name="keyboard-hide" size={moderateScale(18)} tint={color.textSecondary} />
        </PressableScale>

        {/* LABELLED, not a bare glyph (owner's spec §D.1, 13 Aug 2026). A list
            icon on its own could mean the plan, the history, or the last
            workout — three different promises — and the one thing it cannot do
            is say which. The word costs a few points of a bar that has room
            for it. */}
        {nextPlanLine ? (
          <PressableScale
            onPress={handlePlan}
            haptic="none"
            activeScale={0.92}
            style={[styles.round, styles.roundLabelled, styles.planRow]}
            accessibilityRole="button"
            accessibilityLabel={`Write the next planned line: ${nextPlanLine}`}>
            <GlassSurface radius={ROUND / 2} />
            <Icon name="plan" size={moderateScale(16)} tint={color.textSecondary} />
            <Text
              style={styles.roundText}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Plan
            </Text>
          </PressableScale>
        ) : null}

        <PressableScale
          disabled={!canFinish}
          haptic="none"
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canFinish }}
          onPress={handleFinish}
          style={[styles.finish, !canFinish && styles.finishDisabled]}
          pressedStyle={canFinish ? styles.finishPressed : undefined}>
          <Text
            style={styles.finishLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Finish session
          </Text>
        </PressableScale>
      </GlassContainer>
    </View>
  );
}

/**
 * The rest timer — the second most-quoted five-star feature in this category.
 * Tap to start (the chip becomes a live mono "rest 2:41"), tap again to stop.
 * Long-press while idle cycles the length (1:00 → 1:30 → 2:00 → 3:00, saved).
 * The last ten seconds firm up; the finish is a success haptic and the chip
 * inverting to paper — never an alarm, never lime.
 */
const TIMER_TICK_MS = 250;
const GO_FLASH_MS = 1800;

/**
 * The chip still owns the timer: it ticks, it flashes, it fires the haptic.
 * Only the CLOCK is shared (`lib/rest-timer.ts`), so the resting pill can
 * report the same countdown instead of computing a second one.
 */
function RestTimer() {
  const endsAt = useRestTimer((s) => s.endsAt);
  const remaining = useRestTimer((s) => s.remaining);
  const startRest = useRestTimer((s) => s.start);
  const stopRest = useRestTimer((s) => s.stop);
  const tickRest = useRestTimer((s) => s.tick);
  const [preview, setPreview] = useState<number | null>(null); // freshly-set length
  const [go, setGo] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      tickRest(left);
      if (left <= 0) {
        stopRest();
        setGo(true);
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
    const t = setTimeout(() => setPreview(null), 1200);
    return () => clearTimeout(t);
  }, [preview]);

  const handlePress = () => {
    tap();
    setGo(false);
    if (endsAt !== null) {
      stopRest(); // stopped early — no judgment
      return;
    }
    startRest(getRestSeconds());
  };

  const handleLongPress = () => {
    if (endsAt !== null) return;
    tapMedium();
    const current = getRestSeconds();
    const idx = REST_OPTIONS_S.indexOf(current as (typeof REST_OPTIONS_S)[number]);
    const next = REST_OPTIONS_S[(idx + 1) % REST_OPTIONS_S.length]!;
    setRestSeconds(next);
    setPreview(next);
  };

  const running = endsAt !== null;
  const lastTen = running && remaining <= 10;
  const label = go
    ? 'go'
    : preview !== null
      ? `rest ${fmtClock(preview)}`
      : running
        ? `rest ${fmtClock(remaining)}`
        : null;

  return (
    <PressableScale
      onPress={handlePress}
      onLongPress={handleLongPress}
      haptic="none"
      activeScale={0.92}
      style={[styles.round, label !== null && styles.roundLabelled, go && styles.roundActive]}
      accessibilityRole="button"
      accessibilityLabel="Rest timer">
      {/* Running or finished, the button carries its own ink fill — the glass
          layer would sit on top of it and wash it out. */}
      {go ? null : <GlassSurface radius={ROUND / 2} />}
      {label !== null ? (
        <Text
          style={[styles.roundText, lastTen && styles.roundTextFirm, go && styles.roundTextGo]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      ) : (
        <Icon name="timer" size={moderateScale(18)} tint={color.textSecondary} />
      )}
    </PressableScale>
  );
}

/** The round buttons' diameter — a real 44 pt target, never smaller (§14). */
const ROUND = HIT;
/** Long enough for the receipt to scroll into view and be read as a receipt,
 * short enough to still belong to the same gesture. */
const REVIEW_PROMPT_DELAY_MS = 1400;
/** How close two glass shapes have to be before iOS lets them merge. */
const GLASS_MERGE_DISTANCE = spacing.md;

const styles = StyleSheet.create({
  // No bar: the shapes FLOAT over the keyboard. No background, no top border —
  // that strip is what the reference replaced, and glass needs something behind
  // it to refract or it is just a grey rectangle.
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: moderateScale(30),
    justifyContent: 'center',
    paddingHorizontal: spacing.md + 2,
    borderRadius: radius.pill,
  },
  pressedDim: {
    opacity: 0.6,
  },
  statusText: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11),
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  round: {
    height: ROUND,
    minWidth: ROUND,
    borderRadius: ROUND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundLabelled: {
    paddingHorizontal: spacing.md,
  },
  /** Icon and word on one line, for the labelled plan button. */
  planRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  // Listening / finished = the app spoke: solid ink fill, paper glyph.
  roundActive: {
    backgroundColor: color.accent,
  },
  roundText: {
    fontFamily: fonts.reading,
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  roundTextFirm: {
    fontWeight: '700',
  },
  roundTextGo: {
    color: color.onInk,
    fontWeight: '700',
  },
  finish: {
    marginLeft: 'auto',
    height: ROUND,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: color.ctaFill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    ...shadow.raised,
  },
  finishPressed: {
    backgroundColor: color.ctaFillPressed,
  },
  finishDisabled: {
    opacity: ink.disabled,
  },
  finishLabel: {
    color: color.onInk,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
});
