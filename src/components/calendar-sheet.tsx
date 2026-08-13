import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, Stagger } from '@/components/motion';
// The month layout is shared with You's history calendar — one definition of
// "where does the month start", tested in `activity.test.ts`.
import { cursorOf, monthGrid, type MonthCursor } from '@/lib/activity';
import { todayKey, type DayKey } from '@/lib/db/dates';
import { computePlanStrip } from '@/lib/db/strip';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { tap, tapMedium } from '@/lib/haptics';
import { color, FIXED_FONT_SCALE, HIT, ink, lineFor, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { Icon } from './icon';

/**
 * The date pill's calendar sheet (CLAUDE.md §8/§9, design frame 09) — a native
 * month grid on warm paper to switch days. It carries the record contract into
 * the picker: every past day that has a logged workout wears a small BLUE dot
 * (the trained mark, §5.1), and when a next-session plan is genuinely offered,
 * today wears a GREEN dot (PLANNED). Today is ringed in ink; the
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

export function CalendarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const selectDay = useSession((s) => s.selectDay);

  const today = todayKey();
  const [cursor, setCursor] = useState<MonthCursor>(() => cursorOf(selectedDay));
  const [loggedDays, setLoggedDays] = useState<Set<DayKey>>(new Set());
  // Whether a split day is genuinely due today — the green PLANNED dot's one
  // condition. Read on open, not from the store: the store's strip follows the
  // selected day, and browsing yesterday must not blank today's dot.
  const [plannedToday, setPlannedToday] = useState(false);

  // Fresh data every time the sheet opens; start on the selected day's month.
  useEffect(() => {
    if (visible) {
      setCursor(cursorOf(selectedDay));
      if (userId) {
        setLoggedDays(getLoggedDayKeys(userId));
        const strip = computePlanStrip(userId, todayKey());
        setPlannedToday(strip !== null && strip.rows.length > 0);
      }
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
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
                <Icon name="chevron-back" size={moderateScale(16)} tint={color.textSecondary} />
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
                <Icon name="chevron-forward" size={moderateScale(16)} tint={color.textSecondary} />
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
              <Text key={i} style={styles.weekday} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
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

              // Trained beats planned: once today is logged, the blue mark is
              // the truth and the prescription dot retires (§4.2 — green is a
              // future prescription only).
              const isPlanned = isToday && plannedToday && !isLogged;

              const dotStyle = isLogged
                ? filled
                  ? styles.dotOnFill
                  : styles.dotRecorded
                : isPlanned
                  ? styles.dotPlanned
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
                      maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                      {parseInt(day.slice(8), 10)}
                    </Text>
                    {/* The calendar carries the data: blue = trained. */}
                    <View style={[styles.dot, styles.gridDot, dotStyle]} />
                  </View>
                </PressableScale>
              );
            })}
          </View>

          {/* Legend: what the dots mean. Green never appears without its label
              (§4.2), so the planned item is listed only while its dot can be
              on the grid at all. */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, styles.dotRecorded]} />
              <Text style={styles.legendLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Recorded session
              </Text>
            </View>
            {plannedToday && !loggedDays.has(today) ? (
              <View style={styles.legendItem}>
                <View style={[styles.dot, styles.dotPlanned]} />
                <Text style={styles.legendLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Planned today
                </Text>
              </View>
            ) : null}
          </View>
      </Stagger>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HIT,
  },
  headerSide: {
    width: moderateScale(64),
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  todayLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  doneLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.accent, // ink
  },
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  monthTitle: {
    ...type.headline,
    fontWeight: '700',
    color: color.textPrimary,
  },
  navDisabled: {
    opacity: ink.disabled,
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
    color: color.textMuted,
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
    borderColor: color.accent, // ink ring
  },
  selectedFill: {
    backgroundColor: color.accent, // ink fill for the day you're viewing
  },
  dayNum: {
    ...type.body,
    lineHeight: lineFor(20),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  todayNum: {
    fontWeight: '700',
  },
  futureNum: {
    color: color.textMuted,
  },
  selectedNum: {
    color: color.bg, // paper numeral on the ink fill
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
    backgroundColor: color.trained, // blue — a day trained (§5.1)
  },
  dotPlanned: {
    backgroundColor: color.signal, // green — a plan offered
  },
  dotOnFill: {
    backgroundColor: color.bg, // paper dot on the ink-filled selected day
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
    color: color.textSecondary,
  },
});
