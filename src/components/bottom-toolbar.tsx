import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';

import { tap, tapMedium } from '@/lib/haptics';
import { estimateVolume, groupThousands } from '@/lib/parse/estimate';
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
  const ghostVisible = useGhostVisible();
  const dismissGhost = useSession((s) => s.dismissGhost);
  const total = parsedSnapshot === note ? parsedVolume : estimateVolume(note);

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
        {/* No number, no voice (CLAUDE.md §9): the session tonnage joins the
            chart glyph only once there is real volume behind it. */}
        {total > 0 ? (
          <Text style={styles.volumeText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {groupThousands(total)}
            <Text style={styles.volumeUnit}> kg</Text>
          </Text>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
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
});
