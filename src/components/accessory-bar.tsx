import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { success, tap, tapMedium } from '@/lib/haptics';
import { estimateVolume } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { REST_OPTIONS_S, getRestSeconds, setRestSeconds } from '@/lib/prefs';
import {
  HIT,
  MAX_FONT_SCALE,
  hairline,
  makeStyles,
  moderateScale,
  radius,
  spacing,
  type,
  useTheme,
} from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';
import { useCurrentNote, useSession } from '@/state/session-store';

import { DataValue } from './data-value';
import { Glass } from './glass';
import { Icon } from './icon';

/**
 * The accessory bar (CLAUDE.md §8.1, §6.9, PLAN.md 1.17).
 *
 * Glass, above the keyboard, and **four things forever**: the rest timer, the
 * microphone, the running session total, and Finish. Nothing else ever goes
 * here — this is the one strip of screen a lifter can reach without looking, and
 * every addition costs one of the four.
 *
 * Glass is legitimate here for the reason §6.9 allows it at all: this is a
 * control layer floating above content, not a content surface. It contains no
 * scroll view (which would render incorrectly inside a `GlassView`), and its
 * opacity is never animated (any value below 1 stops the effect rendering
 * entirely — the view does not fade, it turns off).
 *
 * On the tab bar underneath: §5.2 asks it to hide while the keyboard is up. On
 * iOS the keyboard window sits above the tab bar and occludes it, and
 * expo-router 6.0.24 exposes `hidden` per trigger rather than for the bar, so
 * the platform gives us the behaviour and we do not fight it.
 */
export function AccessoryBar({
  bottomInset = 0,
  onFinish,
}: {
  bottomInset?: number;
  onFinish: () => void;
}) {
  const styles = useStyles();
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const receipt = useSession((s) => s.receipt);

  const total = parsedSnapshot === note ? parsedVolume : estimateVolume(note);
  // A run-only session totals in distance rather than showing an empty 0 kg.
  const distanceM = total === 0 && parsedSnapshot === note ? (receipt?.distanceM ?? 0) : 0;

  // Staged = distinct parsed exercises. Nothing is recorded until Finish.
  const staged = note.trim().length > 0 && receipt ? new Set(receipt.rows.map((r) => r.exercise)).size : 0;

  return (
    <Glass style={[styles.bar, { paddingBottom: bottomInset }]}>
      <View style={styles.row}>
        <RestTimer />
        <Mic note={note} setNote={setNote} />

        <View style={styles.total}>
          {total > 0 ? (
            <DataValue value={total} unit="kg" size="s" tone="read" grouped />
          ) : distanceM > 0 ? (
            <Text style={styles.totalText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {formatDistanceTotal(distanceM)}
            </Text>
          ) : null}
          {staged > 0 ? (
            <Text style={styles.totalText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {staged} exercise{staged === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            if (staged === 0) return;
            tapMedium();
            onFinish();
          }}
          disabled={staged === 0}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Finish session"
          accessibilityState={{ disabled: staged === 0 }}
          style={({ pressed }) => [
            styles.finish,
            // §8.8 — disabled at 40% while nothing is staged, never hidden: the
            // user should be able to see where the session ends before it does.
            staged === 0 && styles.finishOff,
            pressed && staged > 0 && styles.finishPressed,
          ]}>
          <Text style={styles.finishText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Finish
          </Text>
        </Pressable>
      </View>
    </Glass>
  );
}

/**
 * The rest timer (§8.7). Tap to start, tap to stop, long-press while idle to
 * cycle the length. The last ten seconds go ember — a countdown *is* a planned
 * future, so that is consistent with §6.2 rather than an exception to it.
 *
 * At zero: a haptic, and **never a sound.** Nobody wants their phone to alarm in
 * a quiet gym. (The Live Activity and the local notification are 6.2 and 6.3.)
 */
const TICK_MS = 250;

function RestTimer() {
  const styles = useStyles();
  const t = useTheme();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        setEndsAt(null);
        success();
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [endsAt]);

  useEffect(() => {
    if (preview === null) return;
    const id = setTimeout(() => setPreview(null), 1200);
    return () => clearTimeout(id);
  }, [preview]);

  const running = endsAt !== null;
  const shown = preview ?? (running ? remaining : null);

  return (
    <Pressable
      onPress={() => {
        tap();
        setEndsAt(running ? null : Date.now() + getRestSeconds() * 1000);
      }}
      onLongPress={() => {
        if (running) return;
        tapMedium();
        const current = getRestSeconds();
        const idx = REST_OPTIONS_S.indexOf(current as (typeof REST_OPTIONS_S)[number]);
        const next = REST_OPTIONS_S[(idx + 1) % REST_OPTIONS_S.length]!;
        setRestSeconds(next);
        setPreview(next);
      }}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={running ? `Rest, ${remaining} seconds left` : 'Start rest timer'}
      style={styles.slot}>
      {shown !== null ? (
        <DataValue
          value={clock(shown)}
          size="s"
          // The last ten seconds are the one countdown ember §6.2 allows.
          tone={running && remaining <= 10 ? 'planned' : 'read'}
        />
      ) : (
        <Icon name="timer" size={moderateScale(18)} tint={t.inkMuted} />
      )}
    </Pressable>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The microphone dictates into the composer. **That is all it does** (§8.6) —
 * no voice mode, no transcript view, no second pipeline. Dictated text is text
 * and goes through the same parser.
 */
function Mic({ note, setNote }: { note: string; setNote: (text: string) => void }) {
  const styles = useStyles();
  const [recording, setRecording] = useState(false);
  const handle = useRef<DictationHandle | null>(null);
  const base = useRef('');

  useEffect(() => () => handle.current?.stop(), []);

  const toggle = async () => {
    if (recording) {
      tapMedium();
      handle.current?.stop();
      return;
    }
    tap();
    if (!voiceAvailable()) {
      Alert.alert('Voice input', 'Dictation needs the development build (npx expo run:ios).');
      return;
    }
    base.current = note.replace(/\s+$/, '');
    handle.current = await startDictation({
      onTranscript: (text, final) => {
        const joined = base.current.length > 0 ? `${base.current}\n${text}` : text;
        setNote(joined);
        if (final) base.current = joined;
      },
      onEnd: () => setRecording(false),
    });
    setRecording(true);
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop dictation' : 'Dictate'}
      style={[styles.slot, recording && styles.slotActive]}>
      <Icon name="mic" size={moderateScale(18)} tint={recording ? 'ink' : 'inkMuted'} />
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  bar: {
    borderTopWidth: hairline,
    borderTopColor: t.rule,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: HIT,
  },
  slot: {
    minWidth: HIT,
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: {
    borderRadius: radius.capsule,
    backgroundColor: t.surfaceHigh,
  },
  total: {
    flex: 1,
    alignItems: 'flex-end',
  },
  totalText: {
    ...type.dataS,
    color: t.inkMuted,
  },
  finish: {
    // minHeight, never height: at `accessibilityLarge` the label is nearly twice
    // its base size, and a fixed capsule crops it (§6.5 — text reflows, it never
    // shrinks or clips). Found on device, not by reading this file.
    minHeight: moderateScale(40),
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.capsule,
    backgroundColor: t.ink,
  },
  finishOff: {
    opacity: 0.4,
  },
  finishPressed: {
    backgroundColor: t.inkMuted,
  },
  finishText: {
    ...type.bodyEmph,
    color: t.canvas,
  },
}));
