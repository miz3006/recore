import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WeekBars } from '@/components/charts';
import { Card, CaptionLabel, StatTile } from '@/components/primitives';
import { StubScreen } from '@/components/stub-screen';
import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { getAdherenceRecord, getAllTimePRs, getRecentSessions } from '@/lib/db/insights';
import { getPredictionForOpen } from '@/lib/db/predictions';
import { getStatsSummary } from '@/lib/db/stats';
import { tap } from '@/lib/haptics';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { alpha, color, fonts, ink, MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

/**
 * /stats — the Progress hub (CLAUDE.md §9): the screen that shows a serious
 * lifter their training is being MEASURED. Tier 1: four big-number tiles.
 * Tier 2: the 8-week volume chart with session dots and two quiet insight
 * lines. Tier 3: the predictor's public record, the record book, and the
 * training log. Every number here was already computed by the data layer —
 * this screen just finally says it out loud.
 */
const PR_ROWS = 8;
const LOG_ROWS = 5;

/** "26 May" from a week-start DayKey — the chart's two endpoint labels. */
function shortDate(day: DayKey): string {
  const [, m, d] = day.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[(m ?? 1) - 1]}`;
}

export default function Stats() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);

  // Cheap synchronous SQLite reads — re-run on every focus so a round trip
  // through /settings (CSV import) or a fresh parse lands here immediately.
  const [refresh, setRefresh] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefresh((n) => n + 1);
    }, []),
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  const data = useMemo(() => (userId ? getStatsSummary(userId) : null), [userId, refresh]);
  const adherence = useMemo(() => (userId ? getAdherenceRecord(userId) : null), [userId, refresh]);
  const prs = useMemo(() => (userId ? getAllTimePRs(userId, PR_ROWS + 1) : []), [userId, refresh]);
  const log = useMemo(() => (userId ? getRecentSessions(userId, LOG_ROWS) : []), [userId, refresh]);
  // Latest prediction up to and including tomorrow — the upcoming session,
  // regardless of how many rest days sit in between (CLAUDE.md §7.2 Gap 1).
  const prediction = useMemo(() => {
    if (!userId) return null;
    return getPredictionForOpen(userId, shiftDayKey(todayKey(), 1));
  }, [userId, refresh]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const hasAny = (data?.weeks.some((w) => w.volume > 0) ?? false) || prs.length > 0;

  if (!hasAny) {
    return (
      <StubScreen title="Progress">
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Your training, measured.
          </Text>
          <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Log one session — or import your history — and this screen fills with volume,
            records, and what the predictor writes next.
          </Text>
          <Pressable
            onPress={() => {
              tap();
              router.push('/settings');
            }}
            style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}>
            <Text style={styles.emptyActionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Import from Hevy or Strong
            </Text>
          </Pressable>
        </Card>
      </StubScreen>
    );
  }

  const week = data!.weeks[data!.weeks.length - 1]!;
  const wow = data!.weekOverWeekPct;
  const best = prs[0] ?? null;

  const insights: string[] = [];
  if (wow != null) {
    insights.push(
      wow >= 0
        ? `Volume this week is up ${wow}% on last week.`
        : `Volume this week is down ${Math.abs(wow)}% on last week.`,
    );
  }
  if (data!.sessionsThisWeek > 0) {
    insights.push(
      data!.sessionsThisWeek === 1
        ? 'One session logged this week.'
        : `${data!.sessionsThisWeek} sessions logged this week.`,
    );
  }

  const predictorValue =
    adherence && adherence.settled >= 3 ? `${adherence.followed}/${adherence.settled}` : '—';
  const predictorDelta =
    adherence && adherence.settled >= 3 ? 'sessions followed' : 'learning your training';
  const predictorTone =
    adherence && adherence.settled >= 3 && adherence.followed * 2 >= adherence.settled
      ? ('signal' as const)
      : ('muted' as const);

  return (
    <StubScreen title="Progress">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {/* Tier 1 — the glance. */}
        <View style={styles.tileRow}>
          <StatTile
            label="This week"
            value={groupThousands(week.volume)}
            unit="kg"
            delta={wow != null ? `${wow >= 0 ? '↑' : '↓'} ${Math.abs(wow)}% vs last week` : undefined}
            // A lighter week is normal training, not a warning — red stays
            // reserved for deloads/errors (CLAUDE.md §8).
            deltaTone={wow != null && wow > 0 ? 'signal' : 'muted'}
          />
          <StatTile
            label="Sessions"
            value={String(data!.sessionsThisWeek)}
            delta="this week"
          />
        </View>
        <View style={styles.tileRow}>
          <StatTile
            label="Heaviest lift"
            value={best ? fmtNumber(best.weightKg) : '—'}
            unit={best ? 'kg' : undefined}
            delta={best ? best.canonical : 'no loaded lifts yet'}
          />
          <StatTile
            label="Predictor"
            value={predictorValue}
            delta={predictorDelta}
            deltaTone={predictorTone}
          />
        </View>

        {/* Tier 2 — the trend. */}
        <Card>
          <CaptionLabel>8 weeks</CaptionLabel>
          <View style={styles.chart}>
            <WeekBars
              data={data!.weeks.map((w, i) => ({
                label:
                  i === 0 || i === data!.weeks.length - 1 ? shortDate(w.weekStart) : '',
                value: w.volume,
                sessions: w.sessions,
              }))}
            />
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
        </Card>

        {/* Tier 3 — the moat, on the record. */}
        {prediction ? (
          <Card>
            <CaptionLabel tone="signal">Next session</CaptionLabel>
            <Text style={styles.predictionText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {prediction.ghost_text}
            </Text>
            {prediction.reason ? (
              <Text style={styles.predictionReason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {prediction.reason}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {prs.length > 0 ? (
          <Card>
            <CaptionLabel>Record book</CaptionLabel>
            <View style={styles.rows}>
              {prs.slice(0, PR_ROWS).map((pr) => (
                <View key={pr.canonical} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {pr.canonical}
                  </Text>
                  <Text style={styles.rowMono} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {fmtNumber(pr.weightKg)}
                    {pr.reps != null ? ` × ${pr.reps}` : ''}
                  </Text>
                  <Text style={styles.rowDate} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {labelForDay(pr.day)}
                  </Text>
                </View>
              ))}
            </View>
            {prs.length > PR_ROWS ? (
              <Pressable
                onPress={() => {
                  tap();
                  router.push('/paywall');
                }}
                style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}>
                <Text style={styles.moreLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Full record book · Recore Pro
                </Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {log.length > 0 ? (
          <Card>
            <CaptionLabel>Training log</CaptionLabel>
            <View style={styles.rows}>
              {log.map((s) => (
                <View key={s.workoutId} style={styles.row}>
                  <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {labelForDay(s.day)}
                  </Text>
                  <Text style={styles.rowMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {s.exercises} {s.exercises === 1 ? 'exercise' : 'exercises'} · {s.sets} sets
                  </Text>
                  <Text style={styles.rowMono} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {s.volume > 0 ? `${groupThousands(s.volume)} kg` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    marginHorizontal: -spacing.xxl, // StubScreen pads the body; the scroll owns it
  },
  content: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
    gap: spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  chart: {
    marginTop: spacing.md,
  },
  insights: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  insight: {
    ...type.subhead,
    color: color.textSecondary,
  },
  predictionText: {
    marginTop: spacing.md,
    fontFamily: fonts.mono,
    fontSize: type.subhead.fontSize,
    lineHeight: type.subhead.lineHeight! * 1.3,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  predictionReason: {
    marginTop: spacing.sm,
    ...type.caption,
    color: color.textSecondary,
  },
  rows: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm + 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
  },
  rowName: {
    flex: 1,
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  rowMeta: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  rowMono: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
    opacity: ink.value,
  },
  rowDate: {
    fontSize: type.caption.fontSize,
    color: color.textMuted,
  },
  moreRow: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(color.accent, ink.divider),
  },
  moreLabel: {
    ...type.caption,
    color: color.textSecondary,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  emptyCard: {
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.subhead,
    color: color.textSecondary,
  },
  emptyAction: {
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
  },
  emptyActionLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
});
