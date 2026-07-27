import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, Stagger } from '@/components/motion';
import { dayKeyFor, todayKey, type DayKey } from '@/lib/db/dates';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { tap, tapMedium } from '@/lib/haptics';
import { makeStyles, useTheme, HIT, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { Sheet } from './sheet';
import { Icon } from './icon';

/**
 * The date pill's calendar sheet (CLAUDE.md §8/§9, design frame 09) — a native
 * month grid on warm paper to switch days. It carries the record contract into
 * the picker: every past day that has a logged workout wears a small INK dot
 * (RECORDED), and when a next-session plan is genuinely offered, today wears a
 * GREEN dot (PLANNED — the one meaningful accent). Today is ringed in ink; the
 * day you're viewing (if not today) fills with ink and a paper numeral. Future
 * days sit muted and untappable — you log what happened. Tapping a day switches
 * the note immediately; Done (or the backdrop) closes.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const; // Monday-first
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const CELL_HEIGHT = moderateScale(48);
const DAY_CIRCLE = moderateScale(40);
const DOT = moderateScale(4);

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
  const styles = useStyles();
  const t = useTheme();
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
    <Sheet
      visible={visible}
      onClose={onClose}
      // §5.3's detents. The calendar is a glance surface: a month grid at 0.6
      // leaves the session visible underneath, and 0.95 is there for the day
      // Dynamic Type or a six-row month needs the room.
      detents={[0.6, 0.95]}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Stagger step={55} initialDelay={80} distance={12}>
          {/* Header: Today · ‹ Month Year › · Done */}
          <View style={styles.header}>
            <PressableScale
              onPress={handleToday}
              haptic="none"
              hitSlop={spacing.sm}
              style={styles.headerSide}
              activeScale={0.94}
              accessibilityRole="button"
              accessibilityLabel="Jump to today">
              <Text style={styles.todayLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Today
              </Text>
            </PressableScale>

            <View style={styles.monthNav}>
              <PressableScale
                onPress={() => shiftMonth(-1)}
                haptic="none"
                hitSlop={spacing.sm}
                activeScale={0.9}
                pressedStyle={styles.pressedIcon}
                accessibilityRole="button"
                accessibilityLabel="Previous month">
                <Icon name="chevron-back" size={moderateScale(16)} tint={t.inkMuted} />
              </PressableScale>
              <Text style={styles.monthTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {MONTHS[cursor.month]} {cursor.year}
              </Text>
              <PressableScale
                disabled={atCurrentMonth}
                onPress={() => shiftMonth(1)}
                haptic="none"
                hitSlop={spacing.sm}
                activeScale={0.9}
                style={atCurrentMonth ? styles.navDisabled : undefined}
                pressedStyle={styles.pressedIcon}
                accessibilityRole="button"
                accessibilityLabel="Next month">
                <Icon name="chevron-forward" size={moderateScale(16)} tint={t.inkMuted} />
              </PressableScale>
            </View>

            <PressableScale
              onPress={handleDone}
              haptic="none"
              hitSlop={spacing.sm}
              style={[styles.headerSide, styles.headerRight]}
              activeScale={0.94}
              accessibilityRole="button"
              accessibilityLabel="Done">
              <Text style={styles.doneLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Done
              </Text>
            </PressableScale>
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
              const filled = isSelected && !isToday;

              const dotStyle = isLogged
                ? filled
                  ? styles.dotOnFill
                  : styles.dotRecorded
                : null;

              return (
                <PressableScale
                  key={i}
                  style={styles.cell}
                  disabled={isFuture}
                  haptic="none"
                  activeScale={0.9}
                  onPress={() => handleDay(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: isFuture }}>
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.todayRing,
                      filled && styles.selectedFill,
                    ]}>
                    <Text
                      style={[
                        styles.dayNum,
                        isFuture && styles.futureNum,
                        isToday && styles.todayNum,
                        filled && styles.selectedNum,
                      ]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {parseInt(day.slice(8), 10)}
                    </Text>
                    {/* The calendar carries the data: ink = recorded. */}
                    <View style={[styles.dot, styles.gridDot, dotStyle]} />
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Legend: what the dots mean */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotRecorded]} />
              <Text style={styles.legendLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Recorded session
              </Text>
            </View>
          </View>
      </Stagger>
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  sheet: {
    paddingHorizontal: spacing.xl,
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
    ...type.callout,
    fontWeight: '600',
    color: t.inkMuted,
  },
  doneLabel: {
    ...type.callout,
    fontWeight: '600',
    color: t.ink, // ink
  },
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  monthTitle: {
    ...type.title3,
    fontWeight: '700',
    color: t.ink,
  },
  navDisabled: {
    opacity: 0.4, // the one disabled level in the app
  },
  pressedIcon: {
    opacity: 0.5,
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  weekday: {
    ...type.caption,
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: t.inkFaint,
    fontWeight: '600',
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
    borderWidth: 2,
    borderColor: t.ink, // ink ring
  },
  selectedFill: {
    backgroundColor: t.ink, // ink fill for the day you're viewing
  },
  dayNum: {
    ...type.body,
    lineHeight: moderateScale(20),
    color: t.ink,
    fontVariant: ['tabular-nums'],
  },
  todayNum: {
    fontWeight: '700',
  },
  futureNum: {
    color: t.inkFaint,
  },
  selectedNum: {
    color: t.canvas, // paper numeral on the ink fill
    fontWeight: '600',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: 'transparent',
  },
  gridDot: {
    marginTop: moderateScale(3),
  },
  dotRecorded: {
    backgroundColor: t.ink, // ink — a recorded session
  },
  dotPlanned: {
    backgroundColor: t.ember, // green — a plan offered
  },
  dotOnFill: {
    backgroundColor: t.canvas, // paper dot on the ink-filled selected day
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendLabel: {
    ...type.caption,
    color: t.inkMuted,
  },
}));
