import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKeyFor, todayKey, type DayKey } from '@/lib/db/dates';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { tap, tapMedium } from '@/lib/haptics';
import {
  alpha,
  color,
  HIT,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { Icon } from './icon';
import { SheetGrabber } from './sheet-grabber';

/**
 * The date pill's calendar sheet (CLAUDE.md §8): a native-style month grid to
 * switch days, in Recore's monochrome voice — the accent is white, so the
 * selected day is the ONLY filled element (white circle, black numeral), today
 * wears a hairline ring, and the data speaks: a small dot marks every day with
 * a logged workout. Future days are muted and untappable — you log what
 * happened. Tapping a day switches the note immediately; Done (or the
 * backdrop) closes.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const; // Monday-first
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const CELL_HEIGHT = moderateScale(44);
const DAY_CIRCLE = moderateScale(34);

interface MonthCursor {
  year: number;
  month: number; // 0-based
}

function cursorOf(day: DayKey): MonthCursor {
  const [y, m] = day.split('-').map(Number);
  return { year: y!, month: (m ?? 1) - 1 };
}

/** The month laid out Monday-first: leading nulls, then each day's key. */
function monthGrid(cursor: MonthCursor): (DayKey | null)[] {
  const first = new Date(cursor.year, cursor.month, 1);
  const leading = (first.getDay() + 6) % 7; // 0 = Monday
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells: (DayKey | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(dayKeyFor(new Date(cursor.year, cursor.month, d)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function CalendarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);

  const today = todayKey();
  const [cursor, setCursor] = useState<MonthCursor>(() => cursorOf(selectedDay));
  const [loggedDays, setLoggedDays] = useState<Set<DayKey>>(new Set());

  // Fresh data every time the sheet opens; start on the selected day's month.
  useEffect(() => {
    if (visible) {
      setCursor(cursorOf(selectedDay));
      if (userId) setLoggedDays(getLoggedDayKeys(userId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = useMemo(() => monthGrid(cursor), [cursor]);

  const currentMonth = cursorOf(today);
  const atCurrentMonth =
    cursor.year > currentMonth.year ||
    (cursor.year === currentMonth.year && cursor.month >= currentMonth.month);

  const shiftMonth = (delta: number) => {
    tap();
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const handleDay = (day: DayKey) => {
    if (day > today) return; // future — you log what happened
    tap();
    selectDay(day);
  };

  const handleToday = () => {
    tap();
    selectDay(today);
    setCursor(cursorOf(today));
  };

  const handleDone = () => {
    tapMedium();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={handleDone} />

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <SheetGrabber />
          {/* Header: Today · ‹ Month Year › · Done */}
          <View style={styles.header}>
            <Pressable onPress={handleToday} hitSlop={spacing.sm} style={styles.headerSide}>
              <Text style={styles.todayLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Today
              </Text>
            </Pressable>

            <View style={styles.monthNav}>
              <Pressable
                onPress={() => shiftMonth(-1)}
                hitSlop={spacing.sm}
                style={({ pressed }) => pressed && styles.pressedIcon}>
                <Icon name="chevron-back" size={moderateScale(17)} tint={color.textSecondary} />
              </Pressable>
              <Text style={styles.monthTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {MONTHS[cursor.month]} {cursor.year}
              </Text>
              <Pressable
                disabled={atCurrentMonth}
                onPress={() => shiftMonth(1)}
                hitSlop={spacing.sm}
                style={({ pressed }) => [atCurrentMonth && styles.navDisabled, pressed && styles.pressedIcon]}>
                <Icon name="chevron-forward" size={moderateScale(17)} tint={color.textSecondary} />
              </Pressable>
            </View>

            <Pressable onPress={handleDone} hitSlop={spacing.sm} style={[styles.headerSide, styles.headerRight]}>
              <Text style={styles.doneLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Done
              </Text>
            </Pressable>
          </View>

          {/* Weekday letters */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {w}
              </Text>
            ))}
          </View>

          {/* Month grid */}
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;

              const isSelected = day === selectedDay;
              const isToday = day === today;
              const isFuture = day > today;
              const isLogged = loggedDays.has(day);

              return (
                <Pressable
                  key={i}
                  style={styles.cell}
                  disabled={isFuture}
                  onPress={() => handleDay(day)}>
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && !isSelected && styles.todayRing,
                      isSelected && styles.selectedFill,
                    ]}>
                    <Text
                      style={[
                        styles.dayNum,
                        isFuture && styles.futureNum,
                        isSelected && styles.selectedNum,
                      ]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {parseInt(day.slice(8), 10)}
                    </Text>
                    {/* Training-day dot — the calendar carries the data. */}
                    <View
                      style={[
                        styles.dot,
                        isLogged && (isSelected ? styles.dotOnSelected : styles.dotVisible),
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: alpha('#000000', 0.6),
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HIT,
  },
  headerSide: {
    width: moderateScale(64),
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  todayLabel: {
    color: color.textSecondary,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
  },
  doneLabel: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
  },
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  monthTitle: {
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
  navDisabled: {
    opacity: 0.3,
  },
  pressedIcon: {
    opacity: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...type.caption,
    color: color.textMuted,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: DAY_CIRCLE,
    height: DAY_CIRCLE,
    borderRadius: DAY_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayRing: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: alpha(color.accent, 0.6),
  },
  selectedFill: {
    backgroundColor: color.accent, // white IS the accent
  },
  dayNum: {
    color: color.textPrimary,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  futureNum: {
    color: color.textMuted,
  },
  selectedNum: {
    color: color.bg, // black numeral on the white fill
    fontWeight: '600',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  dotVisible: {
    backgroundColor: alpha(color.accent, 0.55),
  },
  dotOnSelected: {
    backgroundColor: color.bg,
  },
});
