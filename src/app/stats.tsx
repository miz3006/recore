import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, todayKey } from '@/lib/db/dates';
import { getPredictionForOpen } from '@/lib/db/predictions';
import { getStatsSummary } from '@/lib/db/stats';
import { groupThousands } from '@/lib/parse/estimate';
import { alpha, color, fonts, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /stats (CLAUDE.md §8): ONE chart — volume over 8 weeks — two quiet insight
 * lines, one prediction. Nothing else. Lines only appear when there is a real
 * number behind them; the AI never speaks first without one.
 */
const CHART_HEIGHT = moderateScale(120);

export default function Stats() {
  const userId = useSession((s) => s.userId);

  const data = useMemo(() => (userId ? getStatsSummary(userId) : null), [userId]);
  // Latest prediction up to and including tomorrow — the upcoming session,
  // regardless of how many rest days sit in between (CLAUDE.md §7.2 Gap 1).
  const prediction = useMemo(() => {
    if (!userId) return null;
    return getPredictionForOpen(userId, shiftDayKey(todayKey(), 1));
  }, [userId]);

  const maxVolume = Math.max(1, ...(data?.weeks.map((w) => w.volume) ?? [1]));
  const hasAny = (data?.weeks.some((w) => w.volume > 0) ?? false);

  const insights: string[] = [];
  if (data) {
    if (data.weekOverWeekPct != null) {
      insights.push(
        data.weekOverWeekPct >= 0
          ? `Volume this week is up ${data.weekOverWeekPct}% on last week.`
          : `Volume this week is down ${Math.abs(data.weekOverWeekPct)}% on last week.`,
      );
    }
    if (data.sessionsThisWeek > 0) {
      insights.push(
        data.sessionsThisWeek === 1
          ? 'One session logged this week.'
          : `${data.sessionsThisWeek} sessions logged this week.`,
      );
    }
  }

  return (
    <StubScreen title="Stats">
      {hasAny ? (
        <>
          {/* The one big number — this week's volume — then ONE chart. */}
          <View>
            <Text style={styles.bigNumber} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {groupThousands(data!.weeks[7]!.volume)}
              <Text style={styles.bigNumberUnit}> kg</Text>
            </Text>
            <Text style={styles.bigNumberLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              volume this week
            </Text>
          </View>

          <View style={styles.chart}>
            {data!.weeks.map((w, i) => (
              <View key={w.weekStart} style={styles.barSlot}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(3, (w.volume / maxVolume) * CHART_HEIGHT),
                      backgroundColor:
                        i === data!.weeks.length - 1 ? color.accent : alpha(color.accent, 0.28),
                    },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.axis}>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              8 weeks ago
            </Text>
            <Text style={styles.axisLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              this week
            </Text>
          </View>

          {insights.length > 0 ? (
            <View style={styles.insights}>
              {insights.slice(0, 2).map((line, i) => (
                <Text key={i} style={styles.insight} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {line}
                </Text>
              ))}
            </View>
          ) : null}

          {prediction ? (
            <View style={styles.prediction}>
              <Text style={styles.predictionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                next session
              </Text>
              <Text style={styles.predictionText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {prediction.ghost_text}
              </Text>
              {prediction.reason ? (
                <Text style={styles.predictionReason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {prediction.reason}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Log a few sessions and the volume chart appears here.
        </Text>
      )}
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  bigNumber: {
    ...type.bigNumber,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bigNumberUnit: {
    fontSize: type.headline.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
  },
  bigNumberLabel: {
    ...type.caption,
    color: color.textMuted,
    marginTop: -spacing.xs,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: CHART_HEIGHT,
    marginTop: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    paddingBottom: spacing.xs,
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    ...type.caption,
    color: color.textMuted,
  },
  insights: {
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  insight: {
    ...type.subhead,
    color: color.textSecondary,
  },
  prediction: {
    marginTop: spacing.xxl,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: alpha(color.accent, 0.28),
    paddingLeft: spacing.md,
    gap: spacing.xs,
  },
  predictionLabel: {
    ...type.caption,
    color: color.textMuted,
  },
  predictionText: {
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight! * 1.3,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  predictionReason: {
    ...type.caption,
    color: color.textSecondary,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
  },
});
