import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chart, type BarDatum } from '@/components/chart';
import { DataValue } from '@/components/data-value';
import { StatTile } from '@/components/stat-tile';
import { DEV_LOCAL_USER_ID, isDevBypassed } from '@/lib/auth/dev-bypass';
import { useAuth } from '@/lib/auth/provider';
import { getAllTimePRs, type PrRecord } from '@/lib/db/insights';
import { getStatsSummary, type WeekVolume } from '@/lib/db/stats';
import { formatDelta } from '@/lib/format';
import {
  eyebrow,
  hairline,
  makeStyles,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
  space,
} from '@/lib/theme';

/**
 * Progress (CLAUDE.md §11.1) — "Am I actually improving?"
 *
 * The rule for this screen is the whole design: **every number must be true and
 * nothing may be flattering. A bad month looks like a bad month.** That is why
 * there is no colour, no arrows, no encouragement, and why the insight lines are
 * allowed to say something unwelcome.
 *
 * Zoom 1 (this week) and zoom 2 (the last weeks) are here. §11.1's zoom 3 —
 * Calendar · Sessions · Records behind a segmented control — needs the session
 * push route and the month grid, so Records stands alone until those exist
 * rather than a segmented control with two dead segments.
 */

/** §11.1: at most two, deterministic, never from a model, and zero if none fire. */
function insightsFor(weeks: readonly WeekVolume[]): string[] {
  if (weeks.filter((w) => w.sessions > 0).length < 3) return [];

  const out: string[] = [];
  const recent = weeks.slice(-4);
  const earlier = weeks.slice(-8, -4);
  const vol = (ws: readonly WeekVolume[]) => ws.reduce((n, w) => n + w.volume, 0);
  const sess = (ws: readonly WeekVolume[]) => ws.reduce((n, w) => n + w.sessions, 0);

  if (earlier.length >= 4 && vol(earlier) > 0) {
    const pct = Math.round((vol(recent) / vol(earlier) - 1) * 100);
    if (pct >= 10 && sess(recent) <= sess(earlier)) {
      out.push(`Volume up ${pct}%, sessions flat — you're adding work per session, not more sessions.`);
    } else if (pct <= -15) {
      out.push(`Volume down ${Math.abs(pct)}% against the four weeks before.`);
    }
  }

  // The rule set must be able to produce an unwelcome sentence (§15.4).
  const quiet = weeks.slice(-3).filter((w) => w.sessions === 0).length;
  if (quiet >= 2 && out.length < 2) {
    out.push('Two of the last three weeks had no sessions — worth looking at what changed.');
  }

  return out.slice(0, 2);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-07-27` → `27 Jul`. */
function weekLabel(weekStart: string): string {
  const [, m, d] = weekStart.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`.trim();
}

export default function Progress() {
  const styles = useStyles();
  const { session } = useAuth();
  const userId = session?.user.id ?? (isDevBypassed() ? DEV_LOCAL_USER_ID : null);

  const [weeks, setWeeks] = useState<WeekVolume[]>([]);
  const [wowPct, setWowPct] = useState<number | null>(null);
  const [thisWeek, setThisWeek] = useState(0);
  const [prs, setPrs] = useState<PrRecord[]>([]);

  // Re-read on focus: finishing a session on Today has to be visible here
  // without a relaunch. These are synchronous SQLite reads, comfortably inside
  // §12.2's 400ms "show nothing" window, so there is no spinner.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const summary = getStatsSummary(userId);
      setWeeks(summary.weeks);
      setWowPct(summary.weekOverWeekPct);
      setThisWeek(summary.sessionsThisWeek);
      setPrs(getAllTimePRs(userId, 8));
    }, [userId]),
  );

  const trained = weeks.filter((w) => w.sessions > 0);
  const current = weeks[weeks.length - 1];
  const topLift = prs.reduce((best, p) => Math.max(best, p.weightKg), 0);
  const insights = insightsFor(weeks);

  // §12.1: never a zeroed chart, never "No data" — say what will fill it.
  if (trained.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Progress
          </Text>
          <Text style={styles.emptyNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Two more sessions and there&apos;s something to show here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const bars: BarDatum[] = weeks.map((w, i) => ({
    value: w.volume,
    dots: w.sessions,
    // Sparse labels — first, middle, last. Eight dates in a row is a wall of
    // text nobody reads; this is the AllTrails restraint.
    label:
      i === 0 || i === weeks.length - 1 || i === Math.floor(weeks.length / 2)
        ? weekLabel(w.weekStart)
        : '',
  }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Progress
        </Text>

        <View style={styles.tiles}>
          <StatTile
            value={current?.volume ?? 0}
            unit="kg"
            label="Volume"
            grouped
            delta={wowPct === null ? undefined : `${formatDelta(wowPct, 0)}%`}
          />
          <StatTile value={thisWeek} label="Sessions" />
          <StatTile value={topLift} unit="kg" label="Top lift" />
          <StatTile value={prs.length} label="Records" />
        </View>

        <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {`LAST ${weeks.length} WEEKS`}
        </Text>
        <View style={styles.card}>
          <Chart data={bars} unit="kg" />
        </View>

        {insights.map((line) => (
          <Text key={line} style={styles.insight} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {line}
          </Text>
        ))}

        {prs.length > 0 ? (
          <>
            <Text style={styles.sectionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              RECORDS
            </Text>
            <View style={styles.card}>
              {prs.map((pr, i) => (
                <View
                  key={`${pr.canonical}-${pr.day}`}
                  style={[styles.prRow, i === prs.length - 1 ? styles.prRowLast : null]}>
                  <View style={styles.prText}>
                    <Text style={styles.prName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {pr.canonical}
                    </Text>
                    <Text style={styles.prMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {pr.reps === null ? weekLabel(pr.day) : `${pr.reps} reps · ${weekLabel(pr.day)}`}
                    </Text>
                  </View>
                  <DataValue value={pr.weightKg} unit="kg" size="m" tone="recorded" />
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: space[9],
  },
  empty: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyNote: {
    ...type.callout,
    color: t.inkMuted,
    lineHeight: moderateScale(23),
  },
  title: {
    ...type.title1,
    color: t.ink,
    marginTop: spacing.md,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...eyebrow,
    color: t.inkFaint,
    // §6.6: a section needs more air above than below — that asymmetry is what
    // makes a long scroll read as organised rather than as one block.
    marginTop: spacing.xxxl,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    padding: spacing.lg,
  },
  insight: {
    ...type.callout,
    color: t.inkMuted,
    lineHeight: moderateScale(22),
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  prRow: {
    minHeight: moderateScale(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: hairline,
    borderBottomColor: t.rule,
  },
  prRowLast: {
    borderBottomWidth: 0,
  },
  prText: {
    flexShrink: 1,
  },
  prName: {
    ...type.body,
    color: t.ink,
  },
  prMeta: {
    ...type.caption,
    color: t.inkFaint,
  },
}));
