import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { getStatsSummary } from '@/lib/db/stats';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { color, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { MicroBars } from './charts';
import { BODY_PADDING_H } from './note-metrics';

/**
 * The page's one landmark (CLAUDE.md §8): this week's tonnage as a big tabular
 * numeral with the quiet 8-week strip beside it — proof, before a single
 * keystroke, that the app holds the user's training. Tapping it opens
 * /stats. It disappears while the keyboard is up: mid-workout the note owns
 * the screen. With no history at all it renders nothing — the empty-state
 * surfaces below carry day one.
 */
export function InsightHeader({ hidden = false }: { hidden?: boolean }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const userId = useSession((s) => s.userId);
  // Re-read after every parse (parsedVolume moves) and on day switches.
  const parsedVolume = useSession((s) => s.parsedVolume);
  const selectedDay = useSession((s) => s.selectedDay);

  const summary = useMemo(
    () => (userId ? getStatsSummary(userId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, parsedVolume, selectedDay],
  );

  if (hidden || !summary) return null;
  const week = summary.weeks[summary.weeks.length - 1]!;
  // Zero is not a number worth speaking (CLAUDE.md §9): an untrained week
  // stays silent — the LAST SESSION peek below carries that state.
  if (week.volume <= 0 && week.sessions === 0) return null;

  // Tonnage is the landmark when the bar was loaded; a run/bodyweight week
  // speaks in sessions instead — Recore is a training log, not only a gym log.
  const tonnageWeek = week.volume > 0;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)}>
      <Pressable
        onPress={() => {
          tap();
          router.push('/stats');
        }}
        style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
        <View style={styles.left}>
          <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            THIS WEEK
          </Text>
          <Text style={styles.value} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tonnageWeek ? groupThousands(week.volume) : String(week.sessions)}
            <Text style={styles.unit}>
              {tonnageWeek ? ' kg' : week.sessions === 1 ? ' session' : ' sessions'}
            </Text>
          </Text>
        </View>
        <View style={styles.right}>
          <MicroBars
            data={summary.weeks.map((w) => (tonnageWeek ? w.volume : w.sessions))}
          />
          <Text style={styles.sessions} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {tonnageWeek
              ? week.sessions === 1
                ? '1 session'
                : `${week.sessions} sessions`
              : '8 weeks'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: BODY_PADDING_H,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    borderRadius: spacing.sm,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  left: {
    gap: 2,
  },
  label: {
    fontSize: type.caption.fontSize,
    letterSpacing: 1.2,
    color: color.textMuted,
    fontWeight: '500',
  },
  value: {
    ...type.statNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  sessions: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
