import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { tap } from '@/lib/haptics';
import { HIT, MAX_FONT_SCALE, makeStyles, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { CalendarSheet } from './calendar-sheet';
import { DataValue } from './data-value';
import { Icon } from './icon';
import { RawNoteSheet } from './raw-note-sheet';

/**
 * The Today header (CLAUDE.md §8.1, PLAN.md 1.16, 1.18).
 *
 *   Saturday 26 July            ⌃      ○ 6 wks
 *   Push · 4th session this week
 *
 * Four things and nothing else. The date in `title2`; a chevron that opens the
 * calendar; a derived session subtitle that is **silent when it has nothing true
 * to say** — never "New note", never a placeholder; and the streak on the right
 * as a bare mono number.
 *
 * The streak deliberately has no flame, no colour, no badge and no celebration
 * when it increments (§15.3). It sits there and says nothing. When it breaks the
 * app also says nothing — guilt is the fastest known way to make someone delete
 * a fitness app.
 *
 * **Swipe down on the header reveals the raw note** (§8.2, 1.18). This escape
 * hatch must always exist: cards are a projection, `raw_text` is the record, and
 * the user must always be able to see exactly what they typed.
 */
export function TodayHeader() {
  const styles = useStyles();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const selectedDay = useSession((s) => s.selectedDay);
  const streak = useSession((s) => s.streak);
  const subtitle = useSession(sessionSubtitle);

  // Downward only, and short — this is a reveal, not a scroll. `failOffsetY`
  // upward keeps the composer's own scrolling untouched.
  const reveal = Gesture.Pan()
    .activeOffsetY(24)
    .failOffsetY(-8)
    .onEnd(() => {
      runOnJS(setRawOpen)(true);
    });

  return (
    <GestureDetector gesture={reveal}>
      <View style={styles.root} accessibilityLabel="Session header">
        <View style={styles.row}>
          <Pressable
            style={styles.dateCell}
            onPress={() => {
              tap();
              setCalendarOpen(true);
            }}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel={`${longDate(selectedDay)}. Open calendar`}>
            <Text style={styles.date} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {longDate(selectedDay)}
            </Text>
            <Icon name="chevron-down" size={spacing.lg} tint="inkMuted" />
          </Pressable>

          {streak > 0 ? (
            <View accessibilityLabel={`${streak} week streak`}>
              <DataValue value={streak} unit="wks" size="s" tone="read" />
            </View>
          ) : null}
        </View>

        {subtitle ? (
          <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {subtitle}
          </Text>
        ) : null}

        <CalendarSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} />
        <RawNoteSheet visible={rawOpen} onClose={() => setRawOpen(false)} />
      </View>
    </GestureDetector>
  );
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** `Saturday 26 July` — the weekday matters to a lifter reading a split. */
function longDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1);
  return `${DAYS[date.getDay()]} ${d} ${MONTHS[(m ?? 1) - 1]}`;
}

/**
 * The subtitle, derived from what has actually been logged — **or nothing.**
 *
 * §8.1 allows the dominant muscle group, the matched split day, or silence. We
 * carry no muscle taxonomy (§24: no exercise library) and the split cluster was
 * deleted, so what remains that is true is the count of exercises staged today.
 * That is a real fact about this session, and when there is no session yet the
 * line simply is not there.
 */
function sessionSubtitle(s: { parsedItems: { exercise: string }[] }): string | null {
  const distinct = new Set(s.parsedItems.map((i) => i.exercise)).size;
  if (distinct === 0) return null;
  return distinct === 1 ? '1 exercise' : `${distinct} exercises`;
}

const useStyles = makeStyles((t) => ({
  root: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT,
  },
  dateCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  date: {
    ...type.title2,
    color: t.ink,
  },
  subtitle: {
    ...type.callout,
    color: t.inkMuted,
  },
}));
