import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { todayKey } from '@/lib/db/dates';
import { getStatsSummary } from '@/lib/db/stats';
import { tap } from '@/lib/haptics';
import { lastSetOf } from '@/lib/parse/receipt';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtClock, useRestTimer } from '@/lib/rest-timer';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { labelForDay, useCurrentNote, useSession } from '@/state/session-store';

import { useSessionActive } from './use-session-active';
import { SessionSummarySheet } from './session-summary-sheet';

/**
 * UNMOUNTED SINCE 18 AUGUST 2026 (owner). The resting pill is off Today: the
 * floating capsule above the tab bar — the live "last set · Bench Press ·
 * 82.5 kg × 5 · 1:30" and the settled "today · 14 sets · 9 840 kg" alike — was
 * removed from `app/(tabs)/today.tsx`, so the bottom of the screen belongs to
 * the keyboard alone. Kept on disk, unmounted; mounting it again is one line
 * there.
 *
 * It took two things down with it, knowingly: `session-summary-sheet.tsx` (its
 * only opener was this pill) and `save-split.tsx` inside it.
 *
 * Everything below describes the pill as it was mounted.
 */

/**
 * The resting-state pill ("Recore Light" frames 01/02): when the keyboard is
 * down, one mono pill sits above the safe area. It reads the same settled
 * receipt the ledger draws from, so it never disagrees with the record.
 *
 * ## It says something different mid-session (owner, 11 Aug 2026)
 *
 * The pill used to report "today · 14 sets · 9 840 kg" in every state, directly
 * under a header line already reading "this week · 9 840 kg · 1 session". On the
 * commonest day of all — the one where this week IS today's session — the screen
 * printed the same tonnage twice, one glance apart, and the second one taught
 * the reader nothing. So the pill now answers the question the moment is
 * actually asking:
 *
 *  · **In the gym** (something logged, touched within the last 90 minutes, no
 *    Finish yet — `lib/session-activity.ts`): the LIVE context. The set just
 *    written, and the rest still counting down beside it. Neither is on the
 *    screen anywhere else, and the running total is the one number the athlete
 *    already knows.
 *  · **Otherwise** (finished, or a day being read back): the day's totals, as
 *    before — which is when the header is talking about a WEEK that contains
 *    more than this one session, so the two lines no longer echo.
 *
 * Volume gives way to distance on a pure cardio day — Recore is a training log,
 * not only a gym log.
 */
export function SummaryPill({ bottomInset = 0 }: { bottomInset?: number }) {
  const note = useCurrentNote();
  const receipt = useSession((s) => s.receipt);
  const selectedDay = useSession((s) => s.selectedDay);
  const userId = useSession((s) => s.userId);
  const parsedVolume = useSession((s) => s.parsedVolume);
  const active = useSessionActive();
  const restEndsAt = useRestTimer((s) => s.endsAt);
  const restRemaining = useRestTimer((s) => s.remaining);
  const [open, setOpen] = useState(false);

  const settled = note.trim().length > 0 && receipt !== null;
  const sets = settled ? receipt!.totalSets : 0;
  const volume = settled ? receipt!.volume : 0;
  const distanceM = settled && volume === 0 ? receipt!.distanceM : 0;

  const empty = sets === 0 && volume === 0 && distanceM === 0;
  const lastSet = active && receipt ? lastSetOf(receipt) : null;
  const resting = restEndsAt !== null;

  /**
   * The last case where the two lines could still echo: a settled session that
   * is the ONLY one this week, where "today · 3 sets · 2 900 kg" and "this week
   * · 2 900 kg · 1 session" carry the identical tonnage a glance apart. When
   * the week total IS today's, the pill drops the load and keeps the count —
   * the header is the page's landmark and owns the number; the pill still says
   * the thing the header cannot (how many sets, and the way through to the
   * session). Read exactly as `InsightHeader` reads it, on the same deps, so
   * the two can never disagree about what the week holds.
   */
  const weekVolume = useMemo(
    () => (userId ? (getStatsSummary(userId).weeks.at(-1)?.volume ?? 0) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, parsedVolume, selectedDay],
  );
  const volumeEchoesHeader = volume > 0 && volume === weekVolume;

  // The scope word is the day being READ, not always "today" — the pill follows
  // the day pill above it rather than mislabelling yesterday's record.
  const scope = selectedDay === todayKey() ? 'today' : labelForDay(selectedDay).toLowerCase();

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      {/* The resting pill is the one door to review this session + progress. */}
      <FadeSlideIn distance={moderateScale(10)}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={
            lastSet
              ? `Last set: ${lastSet.exercise} ${lastSet.reading}${
                  resting ? `. Rest ${fmtClock(restRemaining)} remaining` : ''
                }. Open session summary`
              : // Spoken exactly as shown, including the load the pill drops
                // when the header is already carrying it.
                `${scope}: ${sets} sets${
                  distanceM > 0
                    ? `, ${formatDistanceTotal(distanceM)}`
                    : volumeEchoesHeader
                      ? ''
                      : `, ${volume} kilograms`
                }. Open session summary`
          }
          haptic="none"
          activeScale={0.98}
          onPress={() => {
            tap();
            setOpen(true);
          }}
          style={styles.pill}>
          {lastSet ? (
            <>
              <Text style={styles.scope} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                last set
              </Text>
              <Dot />
              <Text
                style={styles.liftName}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {lastSet.exercise}
              </Text>
              <Segment raw={lastSet.reading} muted={false} />
              {resting ? (
                <>
                  <Dot />
                  {/* The rest is the other half of "where am I right now" — the
                      same countdown the chip shows, never a second clock. */}
                  <Segment raw={fmtClock(restRemaining)} muted={false} />
                </>
              ) : null}
            </>
          ) : (
            <>
              {/* Scope label so this can never be read as the InsightHeader's
                  "this week ·" total — same cadence, one glance apart. */}
              <Text style={styles.scope} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {scope}
              </Text>
              <Dot />
              <Segment value={String(sets)} unit="sets" muted={empty} />
              {distanceM > 0 ? (
                <>
                  <Dot />
                  <Segment raw={formatDistanceTotal(distanceM)} muted={empty} />
                </>
              ) : volumeEchoesHeader ? null : (
                <>
                  <Dot />
                  <Segment
                    value={volume > 0 ? groupThousands(volume) : '0'}
                    unit="kg"
                    muted={empty}
                  />
                </>
              )}
            </>
          )}
        </PressableScale>
      </FadeSlideIn>
      <SessionSummarySheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function Segment({
  value,
  unit,
  raw,
  muted,
}: {
  value?: string;
  unit?: string;
  raw?: string;
  muted: boolean;
}) {
  return (
    <Text style={styles.segment} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {raw ? (
        <Text style={muted ? styles.unit : styles.value}>{raw}</Text>
      ) : (
        <>
          <Text style={muted ? styles.unit : styles.value}>{value}</Text>
          <Text style={styles.unit}> {unit}</Text>
        </>
      )}
    </Text>
  );
}

const Dot = () => (
  <Text style={styles.divider} maxFontSizeMultiplier={MAX_FONT_SCALE}>
    ·
  </Text>
);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
  },
  pill: {
    minHeight: moderateScale(52),
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadow.card,
  },
  scope: {
    ...type.subhead,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    color: color.textSecondary,
  },
  // The one thing in the pill that is a NAME rather than a reading, so it is
  // the one thing not in mono — and it yields its width first when the lift is
  // called something long.
  liftName: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textSecondary,
  },
  segment: {
    ...type.subhead,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
  },
  value: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  unit: {
    color: color.textSecondary,
    fontWeight: '400',
  },
  divider: {
    color: color.border,
    fontSize: moderateScale(14),
  },
});
