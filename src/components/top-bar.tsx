import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { color, fonts, HIT, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { CalendarSheet } from './calendar-sheet';
import { Icon } from './icon';
import { PressableScale } from './motion';
import { StreakSheet } from './streak-sheet';

/**
 * The Home navigation row: the "Recore" wordmark, a centered day pill that names
 * the open day and opens the calendar (a chevron marks it tappable), and a
 * settings avatar. The bare mono streak sits just left of the gear — a serious
 * number, never a flame. One date, one tap target. Every control dips on touch
 * (PressableScale) so the chrome feels physical.
 */
export function TopBar() {
  const router = useRouter();
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

      <View style={[styles.side, styles.right]}>
        {streak > 0 ? (
          <PressableScale
            onPress={() => setStreakOpen(true)}
            hitSlop={spacing.sm}
            activeScale={0.9}
            accessibilityRole="button"
            accessibilityLabel={`${streak} day streak`}>
            <Text style={styles.streakNum} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {streak}
            </Text>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={() => {
            tap();
            router.push('/you');
          }}
          haptic="none"
          hitSlop={spacing.sm}
          activeScale={0.92}
          style={styles.avatar}
          pressedStyle={styles.avatarPressed}
          accessibilityRole="button"
          accessibilityLabel="Settings">
          <Icon name="gear" size={moderateScale(17)} tint={color.textSecondary} />
        </PressableScale>
      </View>

      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
      <StreakSheet visible={streakOpen} onClose={() => setStreakOpen(false)} />
    </View>
  );
}

const AVATAR = moderateScale(38);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    height: HIT + spacing.sm,
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
  wordmark: {
    fontSize: moderateScale(18),
    fontWeight: '700',
    letterSpacing: -0.5,
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
    fontSize: moderateScale(15),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  streakNum: {
    fontFamily: fonts.mono,
    color: color.textMuted,
    fontSize: moderateScale(13),
    fontWeight: '500',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  avatarPressed: {
    backgroundColor: color.surfaceHigh,
  },
});
