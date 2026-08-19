import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { mondayOf } from '@/lib/db/stats';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { longestStreak } from '@/lib/streak';
import { color, fonts, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { AnimatedCount, Stagger } from './motion';
import { Eyebrow } from './primitives';

/**
 * StreakSheet (UX roadmap X2) — the bare streak number in the top bar was an
 * untappable figure; tapping it now opens a quiet consistency read: the current
 * run of training days, the best you've held, and this week's logged days as
 * blue trained marks (§5.1). Consistency is the quietest motivator — surfaced
 * with no flame, no badge, no green, no "don't break it" guilt. Just the
 * record, said out loud.
 *
 * THE UNIT IS A SESSION, NOT A CALENDAR DAY (CLAUDE.md §16.2, ruled 28 July).
 * Both numbers here come from `src/lib/streak.ts`, so the sheet and the top bar
 * can never disagree, and the copy says "training days" because that is what is
 * being counted — a rest day is not a miss.
 */
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function StreakSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    return { best: longestStreak([...days]), week };
  }, [userId, visible]);

  const unit = streak === 1 ? 'training day' : 'training days';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
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
          {streak > 0 ? `${unit} in a row` : 'training days'}
        </Text>
      </View>
      <Text style={styles.sub} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {streak > 0
          ? data && data.best > streak
            ? `Best · ${data.best}`
            : 'Your best yet.'
          : 'Write a session to start one.'}
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
        A training day counts the moment you write a line. Rest days never break it — more than a
        week between sessions does.
      </Text>
    </BottomSheet>
  );
}

const DOT = moderateScale(9);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
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
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
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
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
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
    backgroundColor: color.trained, // blue — a day trained (§5.1)
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
