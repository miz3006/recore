import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAdherenceRecord } from '@/lib/db/insights';
import { tap, tapMedium } from '@/lib/haptics';
import { namesMatch, typedNameOf } from '@/lib/parse/receipt';
import { alpha, color, CONTROL_HEIGHT, ink, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * The planned session as a CHECKLIST (CLAUDE.md §7, §8) — Strong-style, in
 * Recore's voice. The cached prediction renders as grey rows with the
 * prescribed load in volt; each row carries a circle on the right. Tap the
 * circle when you've done it: the prescribed line becomes real typed text in
 * the note (raw_text stays the source of truth) and the row turns into a volt
 * check. Did something different? Just write it — the row checks itself off
 * the moment the parse recognizes the exercise. Start commits the whole plan
 * at once; Something else dismisses without judgment. The reason line and the
 * trust record ("Followed X of last Y", only with ≥3 settled outcomes and a
 * majority followed) stay — evidence, not promises.
 */
const WEIGHT_TOKEN = /(\d+(?:\.\d+)?\s*kg)/i;
const TRUST_MIN_SETTLED = 3;
const CHECK_SIZE = moderateScale(24);

export function GhostPrediction({
  onStart,
  onSomethingElse,
}: {
  onStart: () => void;
  onSomethingElse: () => void;
}) {
  const ghost = useSession((s) => s.ghost);
  const userId = useSession((s) => s.userId);
  const note = useSession((s) => s.note);
  const lineExercises = useSession((s) => s.lineExercises);
  const checkGhostLine = useSession((s) => s.checkGhostLine);

  // The predictor's public record — shown only when it's actually evidence.
  const trust = useMemo(() => {
    if (!userId) return null;
    const record = getAdherenceRecord(userId);
    if (record.settled < TRUST_MIN_SETTLED) return null;
    if (record.followed * 2 < record.settled) return null; // don't sell against ourselves
    return `Followed ${record.followed} of the last ${record.settled}`;
  }, [userId]);

  const planLines = useMemo(
    () => (ghost ? ghost.ghostText.split('\n').filter((l) => l.trim().length > 0) : []),
    [ghost],
  );

  // A plan row is DONE when the note already carries that exercise — either
  // parsed (canonical names) or freshly typed/checked (instant feedback while
  // the parse is still in flight).
  const doneFlags = useMemo(() => {
    const parsedNames = Object.values(lineExercises);
    const typedNames = note
      .split('\n')
      .map((l) => typedNameOf(l))
      .filter((n) => n.length > 0);
    return planLines.map((line) => {
      const name = typedNameOf(line);
      if (!name) return false;
      return (
        parsedNames.some((c) => namesMatch(name, c)) ||
        typedNames.some((t) => namesMatch(name, t))
      );
    });
  }, [planLines, lineExercises, note]);

  if (!ghost || planLines.length === 0) return null;

  const doneCount = doneFlags.filter(Boolean).length;
  const noteEmpty = note.trim().length === 0;

  const handleStart = () => {
    tapMedium();
    onStart();
  };
  const handleElse = () => {
    tap();
    onSomethingElse();
  };
  const handleCheck = (line: string) => {
    tapMedium();
    checkGhostLine(line);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          NEXT SESSION
        </Text>
        <Text style={styles.headerMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {doneCount > 0 ? `${doneCount}/${planLines.length} done` : 'written from your notes'}
        </Text>
      </View>

      {planLines.map((line, i) => {
        const done = doneFlags[i] ?? false;
        const parts = line.split(WEIGHT_TOKEN);
        return (
          <Pressable
            key={i}
            disabled={done}
            onPress={() => handleCheck(line)}
            style={({ pressed }) => [styles.row, pressed && !done && styles.rowPressed]}>
            <Text
              style={styles.rowText}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {parts.map((part, j) =>
                WEIGHT_TOKEN.test(part) ? (
                  <Text key={j} style={done ? styles.doneText : styles.weight}>
                    {part}
                  </Text>
                ) : (
                  <Text key={j} style={done ? styles.doneText : styles.ghost}>
                    {part}
                  </Text>
                ),
              )}
            </Text>
            {done ? (
              <View style={[styles.check, styles.checkDone]}>
                <Text style={styles.checkMark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  ✓
                </Text>
              </View>
            ) : (
              <View style={styles.check} />
            )}
          </Pressable>
        );
      })}

      {doneCount === 0 ? (
        <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Tap a line when it&apos;s done — or just write what you did.
        </Text>
      ) : null}

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

      {noteEmpty ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
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
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: color.surfaceHigh,
  },
  rowText: {
    flex: 1,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight,
  },
  ghost: {
    color: color.textSecondary,
    fontWeight: '400',
  },
  weight: {
    color: color.signal, // the machine's ink: the load it prescribed
    fontWeight: '600',
  },
  doneText: {
    color: color.textMuted, // done rows recede — the note carries them now
    fontWeight: '400',
  },
  check: {
    width: CHECK_SIZE,
    height: CHECK_SIZE,
    borderRadius: CHECK_SIZE / 2,
    borderWidth: 1,
    borderColor: alpha(color.accent, ink.rule),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    borderColor: alpha(color.signal, ink.pill),
  },
  checkMark: {
    color: color.signal,
    fontSize: type.caption.fontSize,
    fontWeight: '700',
  },
  hint: {
    marginTop: spacing.sm,
    fontSize: type.caption.fontSize,
    color: color.textMuted,
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
