import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
  cursorOf,
  monthGrid,
  monthsDescending,
  type MonthCursor,
} from '@/lib/activity';
import { todayKey, type DayKey } from '@/lib/db/dates';
import { getLoggedDayKeys, getWorkoutForDay } from '@/lib/db/workouts';
import { tapMedium } from '@/lib/haptics';
import { color, FIXED_FONT_SCALE, fonts, HIT, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { PressableScale } from './motion';

/**
 * THE FULL RECORD — the You screen's dot grid, opened out into a calendar you
 * can scroll all the way back through (owner, 28 July).
 *
 * The grid on the card shows the last thirty weeks because that is what fits on
 * a card. This is the same fact without that limit: every month from the first
 * day ever logged to this one, newest at the top, because looking back is a
 * downward motion and a history that starts years ago and makes you scroll to
 * the bottom to find last week is backwards.
 *
 * Same two marks as the grid (§16.4): a day with training carries the blue
 * trained fill (§5.1, ruled 28 Jul) and a paper numeral, a day without is bare,
 * and days that have not happened yet are muted. **No intensity ramp and no
 * streak flames** — this is a record, and a heavier mark on a heavier day would
 * be telling a lifter their deload week counted less.
 *
 * A trained day is a real 44 pt target and opens that session. It CLOSES this
 * sheet on the way rather than stacking a second modal over it — two scrims is
 * the bug §4 mounts `ExerciseSheet` once to avoid, and it would look the same
 * here.
 *
 * **The hand-off waits for `onClosed`, not `onClose`** (fixed 29 Jul). This is
 * the only place in the app where one sheet opens another, and it was doing
 * both in the same tick: `onClose()` starts a 240 ms exit, `openSessionSheet()`
 * mounted the second `Modal` immediately, and UIKit refuses to present a modal
 * over one that is still on screen. It does not throw — the session sheet
 * simply never appeared, so tapping a trained day did nothing at all. Remember
 * the workout, close, and open it once the native modal has actually gone.
 */
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const; // Monday-first
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const CELL = moderateScale(44);
const DAY_CIRCLE = moderateScale(34);

export function HistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const userId = useSession((s) => s.userId);
  const openSessionSheet = useSession((s) => s.openSessionSheet);

  const today = todayKey();

  /** The session a tapped day is waiting to open, once the modal is gone. */
  const pendingSession = useRef<string | null>(null);

  /**
   * True from the moment the sheet is asked to open until its modal has really
   * gone. The record below keys on THIS rather than on `visible`, so the
   * calendar stays on screen through the 240 ms exit instead of blanking to the
   * empty state on its way down — which it did on every close, and most
   * visibly on the one path that closes by itself: tapping a day.
   */
  const [live, setLive] = useState(visible);
  useEffect(() => {
    if (!visible) return;
    // An open always starts with no hand-off owed. If `onClosed` were ever
    // missed, a stale id here would open last week's session on the next open.
    pendingSession.current = null;
    setLive(true);
  }, [visible]);

  /**
   * Read once per open, not per render: this is several hundred day keys and a
   * month list, and the sheet is otherwise static. Recomputed on each open so a
   * session logged since the last one shows up.
   */
  const data = useMemo(() => {
    if (!live || !userId) return null;
    const logged = getLoggedDayKeys(userId);
    if (logged.size === 0) return null;
    // The set is unordered; the earliest key sorts first because a day key
    // sorts lexicographically exactly as it sorts chronologically.
    const first = [...logged].sort()[0]!;
    return { logged, months: monthsDescending(first, today), first };
  }, [live, userId, today]);

  const handleDay = (day: DayKey) => {
    if (!userId || day > today) return;
    const workout = getWorkoutForDay(userId, day);
    if (!workout) return;
    tapMedium();
    pendingSession.current = workout.id;
    onClose();
  };

  /** The modal is gone: drop the record, then make the hand-off. */
  const handleClosed = () => {
    setLive(false);
    const workoutId = pendingSession.current;
    pendingSession.current = null;
    if (workoutId) openSessionSheet(workoutId);
  };

  const handleDone = () => {
    tapMedium();
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={handleClosed}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Your record
          </Text>
          {data ? (
            <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${data.logged.size} training ${data.logged.size === 1 ? 'day' : 'days'} since ${monthAndYear(cursorOf(data.first))}`}
            </Text>
          ) : null}
        </View>
        <PressableScale
          onPress={handleDone}
          haptic="none"
          hitSlop={spacing.sm}
          activeScale={0.94}
          accessibilityRole="button"
          accessibilityLabel="Done">
          <Text style={styles.done} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Done
          </Text>
        </PressableScale>
      </View>

      {/* The weekday letters sit above the list, not inside every month — they
          are the same seven letters each time, and repeating them twenty times
          is chrome the record does not need. */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {w}
          </Text>
        ))}
      </View>

      {/* `data` is null before the first session is ever logged, and again once
          the sheet has fully closed. Render the list only when there is a
          record to render, so `logged` is passed as a value rather than through
          a non-null assertion that depends on the FlatList's own `data` guard
          holding. */}
      {data ? (
        <FlatList
          data={data.months}
          keyExtractor={(m) => `${m.year}-${m.month}`}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          // Months are uniform enough to window aggressively; a five-year record
          // is sixty of these and only a few are ever on screen.
          initialNumToRender={3}
          windowSize={5}
          removeClippedSubviews
          renderItem={({ item }) => (
            <Month cursor={item} logged={data.logged} today={today} onDay={handleDay} />
          )}
        />
      ) : (
        // §15: an empty screen invites an action and never reports a lack.
        <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Write one session and the days you train start filling in here.
        </Text>
      )}
    </BottomSheet>
  );
}

function monthAndYear(cursor: MonthCursor): string {
  return `${MONTHS_LONG[cursor.month]} ${cursor.year}`;
}

function Month({
  cursor,
  logged,
  today,
  onDay,
}: {
  cursor: MonthCursor;
  logged: Set<DayKey>;
  today: DayKey;
  onDay: (day: DayKey) => void;
}) {
  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const count = cells.filter((d) => d && logged.has(d)).length;

  return (
    <View style={styles.month}>
      <View style={styles.monthHead}>
        <Text style={styles.monthTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {monthAndYear(cursor)}
        </Text>
        {/* A month with nothing in it says nothing, rather than "0 days" —
            §15: empty states never report a lack. */}
        {count > 0 ? (
          <Text style={styles.monthCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`${count} ${count === 1 ? 'day' : 'days'}`}
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={i} style={styles.cell} />;
          const trained = logged.has(day);
          const future = day > today;
          const isToday = day === today;

          if (!trained) {
            return (
              <View key={i} style={styles.cell}>
                <View style={[styles.dayCircle, isToday && styles.todayRing]}>
                  <Text
                    style={[styles.dayNum, future && styles.futureNum]}
                    maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                    {Number(day.slice(8))}
                  </Text>
                </View>
              </View>
            );
          }

          return (
            <PressableScale
              key={i}
              onPress={() => onDay(day)}
              haptic="none"
              activeScale={0.9}
              style={styles.cell}
              accessibilityRole="button"
              accessibilityLabel={`${Number(day.slice(8))} ${MONTHS_LONG[cursor.month]}, trained. Open the session.`}>
              <View style={[styles.dayCircle, styles.trainedFill]}>
                <Text style={[styles.dayNum, styles.trainedNum]} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                  {Number(day.slice(8))}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.lg,
    // Tall on purpose: this is a browsing surface, and a short one would make
    // "look all the way back" a scroll through a letterbox.
    height: '86%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: HIT,
    paddingTop: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...type.title2,
    color: color.textPrimary,
  },
  subtitle: {
    marginTop: 2,
    ...type.footnote,
    color: color.textMuted,
  },
  done: {
    ...type.subhead,
    fontWeight: '600',
    color: color.accent,
    paddingTop: moderateScale(6),
  },
  weekRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.divider,
  },
  weekday: {
    ...type.caption,
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontWeight: '600',
    color: color.textMuted,
  },
  list: {
    flex: 1,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingTop: spacing.xl,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  month: {
    paddingTop: spacing.lg,
  },
  monthHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  monthTitle: {
    ...type.subhead,
    fontWeight: '700',
    color: color.textPrimary,
  },
  monthCount: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(11),
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    height: CELL,
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
  trainedFill: {
    backgroundColor: color.trained,
  },
  todayRing: {
    borderWidth: 1.5,
    borderColor: color.accent,
  },
  dayNum: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(13),
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  trainedNum: {
    color: color.onInk,
    fontWeight: '600',
  },
  futureNum: {
    color: color.textMuted,
    opacity: 0.5,
  },
});
