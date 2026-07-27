import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { getRecentSessions, getSessionExerciseNames } from '@/lib/db/insights';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { color, fonts, MAX_FONT_SCALE, radius, shadow, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';
import { SignInDemo } from './sign-in-demo';

/**
 * The empty page is never a void (CLAUDE.md §8), in the card vocabulary
 * (design brief: surface, 1px border, mono tags). Under the blank editor:
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
      <FadeSlideIn duration={260}>
        <View style={styles.card}>
          <View style={styles.tagRow}>
            <MonoTag label="HOW IT WORKS" />
          </View>
          <SignInDemo />
          <Text style={styles.demoCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Type it like you&apos;d text a friend. Recore reads the rest — sets, weights, PRs.
          </Text>
        </View>
      </FadeSlideIn>
    );
  }

  return (
    <FadeSlideIn duration={260}>
      <PressableScale
        activeScale={0.98}
        haptic="none"
        onPress={() => {
          tap();
          selectDay(last.day);
        }}
        style={styles.card}
        pressedStyle={styles.pressed}
        accessibilityRole="button"
        accessibilityLabel={`Last session, ${labelForDay(last.day)}`}>
        <View style={styles.header}>
          <MonoTag label="LAST SESSION" />
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
      </PressableScale>
    </FadeSlideIn>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: color.divider,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row', // the tag border hugs its text in a column layout
  },
  meta: {
    ...type.caption,
    fontFamily: fonts.mono,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  names: {
    ...type.subhead,
    color: color.textPrimary,
  },
  numbers: {
    ...type.caption,
    fontFamily: fonts.mono,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  demoCaption: {
    ...type.caption,
    color: color.textSecondary,
  },
});
