import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { color, fonts, HIT, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { CalendarSheet } from './calendar-sheet';
import { Icon } from './icon';
import { PressableScale } from './motion';
import { StreakSheet } from './streak-sheet';
import { TourTarget } from './tour-targets';

/**
 * The Home navigation row: the "Recore" wordmark, a centered day pill that names
 * the open day and opens the calendar (a chevron marks it tappable), and the
 * bare mono streak — a serious number, never a flame. One date, one tap target.
 * Every control dips on touch (PressableScale) so the chrome feels physical.
 *
 * THE SETTINGS AVATAR IS GONE (owner, 28 July). It pushed `/you`, which has
 * been a tab since the four-tab restructure — so the gear was a second door to
 * a room with its own door, in the corner where the eye goes first. §18 listed
 * it as a known duplicate; this closes it. Nothing replaced it: the row is
 * wordmark · day · streak, and the right side is quieter for it.
 */
export function TopBar() {
  const streak = useSession((s) => s.streak);
  const selectedDay = useSession((s) => s.selectedDay);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
      </View>

      {/* The spotlight tour's one measured target — the wrapper is layout-
          neutral and only gives the pill a measurable node. */}
      <TourTarget id="dayPill">
        <PressableScale
          onPress={() => setCalendarOpen(true)}
          hitSlop={spacing.xs}
          activeScale={0.96}
          style={styles.dayPill}
          pressedStyle={styles.dayPillPressed}
          accessibilityRole="button"
          accessibilityLabel={`Open calendar — ${labelForDay(selectedDay)}`}>
          <Text style={styles.dayPillText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {labelForDay(selectedDay)}
          </Text>
          <Icon name="chevron-down" size={moderateScale(14)} tint={color.textSecondary} />
        </PressableScale>
      </TourTarget>

      <View style={[styles.side, styles.right]}>
        {streak > 0 ? (
          <PressableScale
            onPress={() => setStreakOpen(true)}
            hitSlop={spacing.sm}
            activeScale={0.9}
            accessibilityRole="button"
            accessibilityLabel={`${streak} training ${streak === 1 ? 'day' : 'days'} in a row`}>
            <Text style={styles.streakNum} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {streak}
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <StreakSheet visible={streakOpen} onClose={() => setStreakOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    minHeight: HIT + spacing.sm,
    gap: spacing.md,
  },
  side: {
    flex: 1,
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  // The brand mark sits where every other tab puts its title, so it takes the
  // title's own size — all four tabs open on the same optical anchor.
  wordmark: {
    ...type.title2,
    color: color.textPrimary,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
    ...shadow.card,
  },
  dayPillPressed: {
    backgroundColor: color.surfaceHigh,
  },
  dayPillText: {
    ...type.subhead,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  streakNum: {
    fontFamily: fonts.mono,
    color: color.textMuted,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
});
