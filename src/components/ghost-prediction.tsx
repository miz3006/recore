import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAdherenceRecord } from '@/lib/db/insights';
import { tap, tapMedium } from '@/lib/haptics';
import { alpha, color, CONTROL_HEIGHT, ink, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BODY_PADDING_H, BODY_PADDING_TOP, NOTE_FONT_SIZE, NOTE_LINE_HEIGHT } from './note-metrics';

/**
 * The cached next-session prediction (CLAUDE.md §7, §8), read from the local
 * predictions table — never computed on open. The moat, finally dressed: a
 * labeled card ("NEXT SESSION") so the ghost reads as the machine's work, not
 * a stale draft. Prescribed loads speak in the machine's volt ink; the one
 * justification line sits behind a volt rule; and when the predictor has a
 * track record (≥3 settled outcomes, majority followed) it says so — evidence,
 * not promises. If the engine had no reason, no line is shown — silence beats
 * generic encouragement. Start commits the ghost text into the note;
 * Something else clears to a blank page.
 */
const WEIGHT_TOKEN = /(\d+(?:\.\d+)?\s*kg)/i;
const TRUST_MIN_SETTLED = 3;

export function GhostPrediction({
  onStart,
  onSomethingElse,
}: {
  onStart: () => void;
  onSomethingElse: () => void;
}) {
  const ghost = useSession((s) => s.ghost);
  const userId = useSession((s) => s.userId);

  // The predictor's public record — shown only when it's actually evidence.
  const trust = useMemo(() => {
    if (!userId) return null;
    const record = getAdherenceRecord(userId);
    if (record.settled < TRUST_MIN_SETTLED) return null;
    if (record.followed * 2 < record.settled) return null; // don't sell against ourselves
    return `Followed ${record.followed} of the last ${record.settled}`;
  }, [userId]);

  const handleStart = () => {
    tapMedium();
    onStart();
  };
  const handleElse = () => {
    tap();
    onSomethingElse();
  };

  if (!ghost) return null;

  const lines = ghost.ghostText.split('\n');

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            NEXT SESSION
          </Text>
          <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            written from your notes
          </Text>
        </View>

        <View style={styles.body}>
          {lines.map((line, i) => {
            // Emphasis belongs to the machine: prescribed loads in volt.
            const parts = line.split(WEIGHT_TOKEN);
            return (
              <Text key={i} style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {parts.map((part, j) =>
                  WEIGHT_TOKEN.test(part) ? (
                    <Text key={j} style={styles.weight}>
                      {part}
                    </Text>
                  ) : (
                    <Text key={j} style={styles.ghost}>
                      {part}
                    </Text>
                  ),
                )}
              </Text>
            );
          })}
        </View>

        {ghost.reason ? (
          <View style={styles.reasonRow}>
            <Text style={styles.reason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {ghost.reason}
            </Text>
          </View>
        ) : null}

        {trust ? (
          <Text style={styles.trust} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {trust}
          </Text>
        ) : null}

        <View style={styles.buttons}>
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [styles.btn, styles.startBtn, pressed && styles.startPressed]}>
            <Text style={styles.startLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Start
            </Text>
          </Pressable>
          <Pressable
            onPress={handleElse}
            style={({ pressed }) => [styles.btn, styles.elseBtn, pressed && styles.elsePressed]}>
            <Text style={styles.elseLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Something else
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: BODY_PADDING_H,
    paddingTop: BODY_PADDING_TOP,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLabel: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.signal,
    fontWeight: '500',
  },
  headerMeta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  body: {
    marginBottom: spacing.xs,
  },
  line: {
    fontSize: NOTE_FONT_SIZE, // shares the editor's grid — Start swaps in place
    lineHeight: NOTE_LINE_HEIGHT,
  },
  ghost: {
    color: color.textSecondary,
    fontWeight: '400',
  },
  weight: {
    color: color.signal, // the machine's ink: the load it prescribed
    fontWeight: '600',
  },
  reasonRow: {
    marginTop: spacing.md,
    borderLeftWidth: 1.5,
    borderLeftColor: alpha(color.signal, 0.7),
    paddingLeft: spacing.md,
  },
  reason: {
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  trust: {
    marginTop: spacing.md,
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  btn: {
    flex: 1,
    height: CONTROL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  startBtn: {
    backgroundColor: color.accent,
  },
  startPressed: {
    backgroundColor: color.accentPressed,
  },
  startLabel: {
    color: color.bg, // black text on white fill
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  elseBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.3),
  },
  elsePressed: {
    backgroundColor: color.surfaceHigh,
  },
  elseLabel: {
    color: color.textSecondary,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
  },
});
