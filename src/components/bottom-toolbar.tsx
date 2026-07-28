import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { success, tap, tapMedium } from '@/lib/haptics';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import {
  getRestSeconds,
  hasFinishedOnce,
  markFinishedOnce,
  REST_OPTIONS_S,
  setRestSeconds,
} from '@/lib/prefs';
import { color, fonts, HIT, ink, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import { useCurrentNote, useSession } from '@/state/session-store';

import { Icon } from './icon';
import { PressableScale } from './motion';
import { revealReceipt } from './note-focus';
import { BODY_PADDING_H } from './note-metrics';

/**
 * The ACCESSORY BAR (design frames 05–07): a surface strip with a 1px top
 * border pinned above the keyboard. Left, just two 44pt bordered chips — the
 * rest timer and the mic (minimalism pass: the "+" new-line and keyboard-down
 * chips are gone; the return key already makes lines and a swipe-down on the
 * note dismisses the keyboard). Right, the "Finish session" primary pill:
 * settlement has a fixed home from minute one, disabled at 40% until something
 * is actually staged.
 *
 * Directly above the bar runs the mono STATUS LINE — the live count and
 * tonnage ("4 staged · 3,240 kg"; parsed volume once the background parse
 * lands, an instant text estimate before that), tapping through to /stats.
 * The teaching tail ("— they count when you finish") explains the record
 * contract only until the first session is finished, then retires.
 *
 * The MIC dictates the workout: on-device speech (never a cloud API) streams
 * interim text straight into the note — each keystroke-equivalent lands in
 * SQLite like typed input, so the parse pipeline just works. While recording,
 * the chip inverts to a solid paper fill.
 */
export function BottomToolbar({ bottomInset = 0 }: { bottomInset?: number }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const receipt = useSession((s) => s.receipt);
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

  useEffect(() => () => dictation.current?.stop(), []);

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
    Keyboard.dismiss();
    revealReceipt(!reduceMotion);
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
    <View>
      {status ? (
        <Pressable
          onPress={() => {
            tap();
            router.push('/progress');
          }}
          hitSlop={spacing.xs}
          style={({ pressed }) => [styles.statusRow, pressed && styles.statusPressed]}>
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

      <View style={[styles.bar, { paddingBottom: bottomInset }]}>
        <RestTimer />
        <PressableScale
          onPress={() => void handleMic()}
          haptic="none"
          activeScale={0.92}
          style={[styles.chip, recording && styles.chipActive]}
          pressedStyle={!recording ? styles.chipPressed : undefined}
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop dictation' : 'Dictate'}>
          <Icon
            name="mic"
            size={moderateScale(18)}
            tint={recording ? color.bg : color.textSecondary}
          />
        </PressableScale>

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
      </View>
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

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function RestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [preview, setPreview] = useState<number | null>(null); // freshly-set length
  const [go, setGo] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setEndsAt(null);
        setGo(true);
        success();
        setTimeout(() => setGo(false), GO_FLASH_MS);
      }
    };
    tick();
    const t = setInterval(tick, TIMER_TICK_MS);
    return () => clearInterval(t);
  }, [endsAt]);

  useEffect(() => {
    if (preview === null) return;
    const t = setTimeout(() => setPreview(null), 1200);
    return () => clearTimeout(t);
  }, [preview]);

  const handlePress = () => {
    tap();
    setGo(false);
    if (endsAt !== null) {
      setEndsAt(null); // stopped early — no judgment
      return;
    }
    setEndsAt(Date.now() + getRestSeconds() * 1000);
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
      style={[styles.chip, label !== null && styles.chipLabelled, go && styles.chipActive]}
      pressedStyle={!go ? styles.chipPressed : undefined}
      accessibilityRole="button"
      accessibilityLabel="Rest timer">
      {label !== null ? (
        <Text
          style={[styles.chipText, lastTen && styles.chipTextFirm, go && styles.chipTextGo]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      ) : (
        <Icon name="timer" size={moderateScale(18)} tint={color.textSecondary} />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    paddingHorizontal: BODY_PADDING_H,
    paddingBottom: spacing.sm,
  },
  statusPressed: {
    opacity: 0.6,
  },
  statusText: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.surface,
  },
  chip: {
    height: HIT,
    minWidth: HIT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabelled: {
    paddingHorizontal: spacing.md,
  },
  chipPressed: {
    backgroundColor: color.surfaceHigh,
  },
  // Listening / finished = the app spoke: solid paper fill, bg glyph.
  chipActive: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  chipText: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chipTextFirm: {
    fontWeight: '700',
  },
  chipTextGo: {
    color: color.bg,
    fontWeight: '700',
  },
  finish: {
    marginLeft: 'auto',
    height: HIT,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    ...shadow.card,
  },
  finishPressed: {
    backgroundColor: color.accentPressed,
  },
  finishDisabled: {
    opacity: ink.disabled,
  },
  finishLabel: {
    color: color.bg,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
});
