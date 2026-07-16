import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap, tapMedium } from '@/lib/haptics';
import { alpha, color, CONTROL_HEIGHT, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BODY_PADDING_H, BODY_PADDING_TOP, NOTE_FONT_SIZE, NOTE_LINE_HEIGHT } from './note-metrics';

/**
 * The cached next-session prediction (CLAUDE.md §7, §8), read from the local
 * predictions table — never computed on open. Rendered as grey ghost text on
 * the SAME note grid as the editor, with weights emphasized in full white and
 * the single justification line (quoting the user's own words) behind a thin
 * white rule. If the engine had no reason, no line is shown — silence beats
 * generic encouragement. Start commits the ghost text into the note;
 * Something else clears to a blank page.
 */
const WEIGHT_TOKEN = /(\d+(?:\.\d+)?\s*kg)/i;

export function GhostPrediction({
  onStart,
  onSomethingElse,
}: {
  onStart: () => void;
  onSomethingElse: () => void;
}) {
  const ghost = useSession((s) => s.ghost);

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
      <View>
        {lines.map((line, i) => {
          // Emphasis via weight/opacity, never hue: the load reads in white.
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
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: BODY_PADDING_H,
    paddingTop: BODY_PADDING_TOP,
  },
  line: {
    fontSize: NOTE_FONT_SIZE, // shares the editor's baseline grid
    lineHeight: NOTE_LINE_HEIGHT,
  },
  ghost: {
    color: color.textSecondary,
    fontWeight: '400',
  },
  weight: {
    color: color.textPrimary, // emphasis via white + weight, never hue
    fontWeight: '600',
  },
  reasonRow: {
    marginTop: spacing.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: alpha(color.accent, 0.28),
    paddingLeft: spacing.md,
  },
  reason: {
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
    color: color.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
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
    opacity: 0.85,
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
