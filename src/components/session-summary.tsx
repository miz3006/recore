import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { getAllTimePRs, getRecentSessions } from '@/lib/db/insights';
import { groupThousands } from '@/lib/format';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import {
  MAX_FONT_SCALE,
  hairline,
  makeStyles,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

import { DataValue } from './data-value';
import { SummaryRise } from './motion';
import { PrimaryButton, Tag } from './primitives';

/**
 * The session summary (CLAUDE.md §8.8, PLAN.md 1.19).
 *
 * ```
 * RECORDED                       48 min
 *
 * 5 exercises · 19 sets · 12,480 kg
 * 1 personal record
 *
 * vs last Push        +640 kg    +1 set
 * ```
 *
 * **It exists for every finished session.** No heuristics, no detection, no
 * "receipt mode." v2 showed a receipt only when ≥ 4 exercises were typed inside
 * 60 seconds, which meant the same action produced different screens on
 * different days — and unpredictable UI is worse than plain UI. That rule is
 * gone; this is what finishing looks like, always.
 *
 * Finishing is what turns staged work into a settled session: it seeds the
 * Coach, updates the streak, and closes the day. Which is why the copy says
 * *Recorded* rather than *Saved* — §21: a button says what happens, and the same
 * word appears afterwards.
 */
export function SessionSummary({ onDone }: { onDone: () => void }) {
  const styles = useStyles();
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const receipt = useSession((s) => s.receipt);
  const parsedItems = useSession((s) => s.parsedItems);

  const exercises = new Set(parsedItems.map((i) => i.exercise)).size;
  const sets = receipt?.totalSets ?? 0;
  const volume = receipt?.volume ?? 0;
  const distance = receipt?.distanceM ?? 0;

  /** Records that landed today. Suppressed under three sessions (§15.5). */
  const records = useMemo(() => {
    if (!userId) return 0;
    return getAllTimePRs(userId).filter((pr) => pr.day === selectedDay).length;
  }, [userId, selectedDay]);

  /** The previous session, for the one comparison line. */
  const previous = useMemo(() => {
    if (!userId) return null;
    const [prior] = getRecentSessions(userId, 1, selectedDay);
    return prior ?? null;
  }, [userId, selectedDay]);

  const volumeDelta = previous && volume > 0 && previous.volume > 0 ? volume - previous.volume : null;

  return (
    <SummaryRise style={styles.card}>
      <View style={styles.head}>
        <Tag label="Recorded" />
      </View>

      <View style={styles.figures}>
        <Text style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {exercises} exercise{exercises === 1 ? '' : 's'} · {sets} set{sets === 1 ? '' : 's'}
          {volume > 0 ? ` · ${groupThousands(volume)} kg` : ''}
          {volume === 0 && distance > 0 ? ` · ${formatDistanceTotal(distance)}` : ''}
        </Text>
        {records > 0 ? (
          <Text style={styles.line} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {records} personal record{records === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      {/* One comparison, and only when it is true. §6.3: deltas are typographic,
          never chromatic — a lifter reading "−5 kg" after a deload does not need
          the app to colour it as failure. */}
      {volumeDelta !== null ? (
        <View style={styles.compare}>
          <Text style={styles.compareLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            vs last session
          </Text>
          <DataValue value={signed(volumeDelta)} unit="kg" size="s" tone="read" />
        </View>
      ) : null}

      <PrimaryButton label="Done" onPress={onDone} compact style={styles.done} />
    </SummaryRise>
  );
}

/** A true minus sign (U+2212), so a negative keeps the mono grid (§6.5). */
function signed(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : '−'}${groupThousands(Math.abs(rounded))}`;
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figures: {
    gap: spacing.xs,
  },
  line: {
    ...type.dataM,
    color: t.ink,
  },
  compare: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: hairline,
    borderTopColor: t.rule,
    paddingTop: spacing.md,
  },
  compareLabel: {
    ...type.caption,
    color: t.inkMuted,
  },
  done: {
    alignSelf: 'flex-start',
  },
}));
