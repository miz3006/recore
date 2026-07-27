import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { mondayOf } from '@/lib/db/stats';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { color, fonts, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { AnimatedCount, Stagger } from './motion';
import { Eyebrow } from './primitives';

/**
 * StreakSheet (UX roadmap X2) — the bare streak number in the top bar was an
 * untappable figure; tapping it now opens a quiet consistency read: the current
 * day-streak, the best you've held, and this week's logged days as ink dots.
 * Consistency is the quietest motivator — surfaced with no flame, no badge, no
 * green, no "don't break it" guilt. Just the record, said out loud.
 */
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Longest run of consecutive logged days in the whole history. */
function longestStreak(days: Set<DayKey>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(shiftDayKey(day, -1))) continue; // not a run start
    let len = 1;
    let cur = shiftDayKey(day, 1);
    while (days.has(cur)) {
      len += 1;
      cur = shiftDayKey(cur, 1);
    }
    if (len > best) best = len;
  }
  return best;
}

export function StreakSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const streak = useSession((s) => s.streak);

  const data = useMemo(() => {
    if (!userId || !visible) return null;
    const days = getLoggedDayKeys(userId);
    const monday = mondayOf(todayKey());
    const today = todayKey();
    const week = DOW.map((letter, i) => {
      const dk = shiftDayKey(monday, i);
      return { letter, logged: days.has(dk), future: dk > today, today: dk === today };
    });
    return { best: longestStreak(days), week };
  }, [userId, visible]);

  const unit = streak === 1 ? 'day' : 'days';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        This week
      </Eyebrow>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Consistency
      </Text>

      <View style={styles.heroRow}>
        <AnimatedCount
          value={streak}
          format={(n) => String(Math.round(n))}
          style={styles.hero}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
        />
        <Text style={styles.heroUnit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {streak > 0 ? `${unit} in a row` : 'day streak'}
        </Text>
      </View>
      <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {streak > 0
          ? data && data.best > streak
            ? `Best · ${data.best} days`
            : 'Your best yet.'
          : 'Log today to start a streak.'}
      </Text>

      {data ? (
        <View style={styles.week}>
          <Stagger initialDelay={100} step={40}>
            {data.week.map((d, i) => (
              <View key={i} style={styles.day}>
                <Text
                  style={[styles.dow, d.today && styles.dowToday]}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {d.letter}
                </Text>
                <View
                  style={[
                    styles.dot,
                    d.logged ? styles.dotLogged : d.future ? styles.dotFuture : styles.dotRest,
                  ]}
                />
              </View>
            ))}
          </Stagger>
        </View>
      ) : null}

      <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        A day counts the moment you write a line — rest days are part of training too.
      </Text>
    </BottomSheet>
  );
}

const DOT = moderateScale(9);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  hero: {
    ...type.bigNumber,
    fontFamily: fonts.mono,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    ...type.subhead,
    color: color.textSecondary,
  },
  sub: {
    marginTop: spacing.xs,
    ...type.caption,
    fontFamily: fonts.mono,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  day: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  dow: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
  dowToday: {
    color: color.textPrimary,
    fontWeight: '700',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  dotLogged: {
    backgroundColor: color.accent, // ink — a recorded day
  },
  dotRest: {
    backgroundColor: color.surfaceHigh, // recessed — a rest day, no judgment
  },
  dotFuture: {
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: 'transparent',
  },
  foot: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    ...type.footnote,
    color: color.textMuted,
  },
});
