import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getRecentSessions, getSessionExerciseNames } from '@/lib/db/insights';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { alpha, color, fonts, ink, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { SignInDemo } from './sign-in-demo';

/**
 * The empty page is never a void (CLAUDE.md §8). Under the blank editor:
 *  - with history, the LAST SESSION peek — date, lifts, tonnage — one tap from
 *    re-reading it (the journal finally has visible depth), and
 *  - on a truly blank account, the self-typing demo: the parse performing
 *    itself before the user commits a single keystroke.
 * Both disappear the moment the note has text.
 */
export function EmptyDayCards() {
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);

  const last = useMemo(() => {
    if (!userId) return null;
    const [brief] = getRecentSessions(userId, 1, selectedDay);
    if (!brief) return null;
    return { ...brief, names: getSessionExerciseNames(brief.workoutId) };
  }, [userId, selectedDay]);

  if (!userId) return null;

  if (!last) {
    return (
      <View style={styles.demoCard}>
        <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          HOW IT WORKS
        </Text>
        <SignInDemo />
        <Text style={styles.demoCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Type it like you&apos;d text a friend. Recore reads the rest — sets, weights, PRs.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        tap();
        selectDay(last.day);
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          LAST SESSION
        </Text>
        <Text style={styles.meta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(last.day)}
        </Text>
      </View>
      {last.names.length > 0 ? (
        <Text style={styles.names} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {last.names.join(' · ')}
          {last.exercises > last.names.length ? ` · +${last.exercises - last.names.length}` : ''}
        </Text>
      ) : null}
      {last.sets > 0 ? (
        <Text style={styles.numbers} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {last.volume > 0 ? `${groupThousands(last.volume)} kg · ` : ''}
          {last.sets} sets
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  demoCard: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, ink.hairline),
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  meta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  names: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  numbers: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  demoCaption: {
    ...type.caption,
    color: color.textSecondary,
  },
});
