import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { color, HIT, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { CalendarSheet } from './calendar-sheet';
import { Icon } from './icon';

/**
 * Top bar (CLAUDE.md §8): small Recore wordmark · centered date pill (tap →
 * calendar sheet to switch days) · streak (flame + number, computed from
 * logged days in SQLite) and a settings gear (→ /settings stub). Both sides
 * flex equally so the pill stays optically centered.
 */
export function TopBar() {
  const router = useRouter();
  const selectedDay = useSession((s) => s.selectedDay);
  const streak = useSession((s) => s.streak);
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
      </View>

      <Pressable
        onPress={() => {
          tap();
          setCalendarOpen(true);
        }}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.datePill, pressed && styles.pressedPill]}>
        <Text style={styles.dateLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {labelForDay(selectedDay)}
        </Text>
        <Icon name="chevron-down" size={moderateScale(15)} tint={color.textMuted} />
      </Pressable>

      <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />

      <View style={[styles.side, styles.right]}>
        {/* A streak of 0 is not a number worth speaking — the flame appears
            only once there is one (CLAUDE.md §9: no number, no voice). */}
        {streak > 0 ? (
          <View style={styles.streak}>
            <Icon name="flame" size={moderateScale(17)} tint={color.textSecondary} />
            <Text style={styles.streakNum} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {streak}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => {
            tap();
            router.push('/settings');
          }}
          hitSlop={spacing.sm}
          style={({ pressed }) => pressed && styles.pressedIcon}>
          <Icon name="gear" size={moderateScale(22)} tint={color.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    height: HIT,
  },
  side: {
    flex: 1,
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  wordmark: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  pressedPill: {
    backgroundColor: color.surfaceHigh,
  },
  dateLabel: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakNum: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  pressedIcon: {
    opacity: 0.5,
  },
});
