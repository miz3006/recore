import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { getStatsSummary } from '@/lib/db/stats';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { color, fonts, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BODY_PADDING_H } from './note-metrics';

/**
 * The page's one landmark — now a single quiet ledger LINE, not a card
 * (minimalism pass: the blank page is the product, so the writing surface
 * gets a proof line, not a dashboard). One tabular mono row under the composer
 * header — "this week · 12,300 kg · 3 sessions" — proof the app holds the
 * user's training before a keystroke; taps to /stats where the 8-week chart
 * and the modules actually live. It disappears while the keyboard is up:
 * mid-workout the note owns the screen. With no history it renders nothing.
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

  const sessions = week.sessions === 1 ? '1 session' : `${week.sessions} sessions`;
  // Tonnage leads when the bar was loaded; a run/bodyweight week speaks in
  // sessions alone — Recore is a training log, not only a gym log.
  const line =
    week.volume > 0 ? `this week · ${groupThousands(week.volume)} kg · ${sessions}` : `this week · ${sessions}`;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(200)}>
      <Pressable
        onPress={() => {
          tap();
          router.push('/progress');
        }}
        hitSlop={spacing.xs}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <Text style={styles.line} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {line}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: BODY_PADDING_H,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  line: {
    fontFamily: fonts.reading,
    fontSize: type.caption.fontSize,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
