import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { success, tap, tapMedium } from '@/lib/haptics';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { getRestSeconds, REST_OPTIONS_S, setRestSeconds } from '@/lib/prefs';
import { color, MAX_FONT_SCALE, moderateScale, radius, ROUND_BUTTON, spacing, type } from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import { useCurrentNote, useGhostVisible, useSession } from '@/state/session-store';

import { Icon, type IconName } from './icon';
import { focusNote } from './note-focus';

/**
 * Bottom toolbar (CLAUDE.md §8): a total-volume pill on the left, then a row of
 * round mic / camera / + / keyboard buttons. The pill shows the PARSED session
 * volume (warm-ups excluded) once the background parse lands; while a line is
 * still unparsed it falls back to an instant text estimate.
 *
 * The MIC dictates the workout: on-device speech (never a cloud API) streams
 * interim text straight into the note — each keystroke-equivalent lands in
 * SQLite like typed input, so the parse pipeline just works. While recording,
 * the button inverts to a solid white circle. Camera and + stay visual for now;
 * the keyboard button dismisses the keyboard.
 */
export function BottomToolbar({ bottomInset = 0 }: { bottomInset?: number }) {
  const router = useRouter();
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const receipt = useSession((s) => s.receipt);
  const ghostVisible = useGhostVisible();
  const dismissGhost = useSession((s) => s.dismissGhost);
  const total = parsedSnapshot === note ? parsedVolume : estimateVolume(note);
  // A run-only session totals in distance, not an empty pill (kg still wins
  // when both exist — the mixed-session detail lives in the receipt).
  const distanceM = total === 0 && parsedSnapshot === note ? (receipt?.distanceM ?? 0) : 0;

  const [recording, setRecording] = useState(false);
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

  // + = "start a new line": dismiss the ghost if it's covering the page,
  // make sure the note ends on a fresh line, and drop the cursor in.
  const handlePlus = () => {
    if (ghostVisible) {
      dismissGhost();
    } else if (note.length > 0 && !note.endsWith('\n')) {
      setNote(`${note}\n`);
    }
    focusNote();
  };

  return (
    <View style={[styles.bar, { paddingBottom: bottomInset }]}>
      <Pressable
        onPress={() => {
          tap();
          router.push('/stats');
        }}
        style={({ pressed }) => [styles.volumePill, pressed && styles.roundPressed]}>
        <Icon name="chart" size={moderateScale(15)} tint={color.textSecondary} />
        {/* No number, no voice (CLAUDE.md §9): the session total joins the
            chart glyph only once there is a real number behind it. */}
        {total > 0 ? (
          <Text style={styles.volumeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {groupThousands(total)}
            <Text style={styles.volumeUnit}> kg</Text>
          </Text>
        ) : distanceM > 0 ? (
          <Text style={styles.volumeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {formatDistanceTotal(distanceM)}
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <RestTimer />
        <Pressable
          onPress={() => void handleMic()}
          style={({ pressed }) => [
            styles.round,
            recording && styles.roundActive,
            pressed && !recording && styles.roundPressed,
          ]}>
          <Icon
            name="mic"
            size={moderateScale(20)}
            tint={recording ? color.bg : color.textSecondary}
          />
        </Pressable>
        <RoundButton name="plus" onPress={handlePlus} />
        <RoundButton name="keyboard" onPress={() => Keyboard.dismiss()} />
      </View>
    </View>
  );
}

/**
 * The rest timer — the second most-quoted five-star feature in this category.
 * Tap to start (the button becomes a live mono countdown), tap again to stop.
 * Long-press while idle cycles the length (1:00 → 1:30 → 2:00 → 3:00, saved).
 * The last ten seconds speak in volt; the finish is a success haptic and a
 * quiet volt "go" — never an alarm.
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
  const label = go ? 'go' : preview !== null ? fmtClock(preview) : running ? fmtClock(remaining) : null;

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={({ pressed }) => [
        label !== null ? styles.timerPill : styles.round,
        go && styles.timerGo,
        pressed && styles.roundPressed,
      ]}>
      {label !== null ? (
        <Text
          style={[styles.timerText, (lastTen || go) && styles.timerTextSignal]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      ) : (
        <Icon name="timer" size={moderateScale(20)} tint={color.textSecondary} />
      )}
    </Pressable>
  );
}

function RoundButton({ name, onPress }: { name: IconName; onPress?: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.round, pressed && styles.roundPressed]}>
      <Icon name={name} size={moderateScale(20)} tint={color.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
  },
  volumePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  volumeText: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  volumeUnit: {
    color: color.textSecondary,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  round: {
    width: ROUND_BUTTON,
    height: ROUND_BUTTON,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  roundPressed: {
    backgroundColor: color.surfaceHigh,
  },
  // Recording = the app is listening: solid white, black glyph — the same
  // "the app spoke" emphasis as the Start button and the PR pill.
  roundActive: {
    backgroundColor: color.accent,
  },
  timerPill: {
    height: ROUND_BUTTON,
    minWidth: ROUND_BUTTON,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  timerGo: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.signal,
  },
  timerText: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  timerTextSignal: {
    color: color.signal,
  },
});
