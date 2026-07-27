import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { groupThousands } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { tap } from '@/lib/haptics';
import { color, fonts, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { labelForDay, useCurrentNote, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { PrLabel } from './gutter-value';

/**
 * SessionSummarySheet (UX roadmap N1) — the resting `SummaryPill` was a passive
 * dead end; tapping it now opens this backward-looking review. It reads the
 * SAME settled receipt the ledger and the pill draw from, so it never disagrees
 * with the record: stacked mono totals, the day's personal records, and each
 * lift's top set — then one door to the full progress hub. No chart, no green,
 * PR is the neutral outlined label. The record is already written; this only
 * gives the finished session a home at rest, where you actually are.
 */
export function SessionSummarySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const note = useCurrentNote();
  const receipt = useSession((s) => s.receipt);
  const selectedDay = useSession((s) => s.selectedDay);

  const data = useMemo(() => {
    const settled = note.trim().length > 0 && receipt !== null;
    const rows = settled ? receipt!.rows : [];
    const volume = settled ? receipt!.volume : 0;
    const distanceM = settled && volume === 0 ? receipt!.distanceM : 0;
    const sets = settled ? receipt!.totalSets : 0;
    const exercises = new Set(rows.map((r) => r.exercise)).size;
    const prs = rows.filter((r) => r.signal?.kind === 'pr');
    return { rows, volume, distanceM, sets, exercises, prs, empty: exercises === 0 };
  }, [note, receipt]);

  const goStats = () => {
    tap();
    onClose();
    router.push('/stats');
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Eyebrow tone="muted">Session</Eyebrow>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {labelForDay(selectedDay)}
      </Text>

      {data.empty ? (
        <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Nothing recorded today yet — write a line and it settles here.
        </Text>
      ) : (
        <>
          <View style={styles.totals}>
            <Stat n={String(data.exercises)} label={data.exercises === 1 ? 'lift' : 'lifts'} />
            <Stat n={String(data.sets)} label={data.sets === 1 ? 'set' : 'sets'} />
            {data.volume > 0 ? (
              <Stat n={groupThousands(data.volume)} label="kg" />
            ) : data.distanceM > 0 ? (
              <Stat raw={formatDistanceTotal(data.distanceM)} />
            ) : null}
          </View>

          {data.prs.length > 0 ? (
            <View style={styles.recordRow}>
              <PrLabel />
              <Text style={styles.recordText} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {data.prs.length === 1
                  ? 'Personal record · '
                  : `${data.prs.length} personal records · `}
                {data.prs.map((p) => p.exercise).join(', ')}
              </Text>
            </View>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <Stagger step={55} initialDelay={80}>
              {data.rows.map((r, i) => (
                <View
                  key={`${r.line}:${i}:${r.exercise}`}
                  style={[styles.row, i < data.rows.length - 1 && styles.rowRule]}>
                  <Text style={styles.rowName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {r.exercise}
                  </Text>
                  <View style={styles.rowRight}>
                    {r.signal?.kind === 'pr' ? <PrLabel /> : null}
                    <Text style={styles.rowValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {r.setText}
                    </Text>
                  </View>
                </View>
              ))}
            </Stagger>
          </ScrollView>
        </>
      )}

      <AppButton label="See progress" onPress={goStats} style={styles.cta} />
    </BottomSheet>
  );
}

function Stat({ n, label, raw }: { n?: string; label?: string; raw?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {raw ?? n}
      </Text>
      {label ? (
        <Text style={styles.statLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
    maxHeight: '86%',
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xl,
  },
  totals: {
    flexDirection: 'row',
    gap: spacing.xxl,
    marginTop: spacing.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 1,
  },
  statNum: {
    ...type.statNumber,
    fontFamily: fonts.mono,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...type.footnote,
    fontFamily: fonts.mono,
    color: color.textSecondary,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  recordText: {
    flexShrink: 1,
    ...type.caption,
    color: color.textSecondary,
  },
  scroll: {
    flexShrink: 1,
    marginTop: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowRule: {
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  rowName: {
    flexShrink: 1,
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowValue: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(14),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    marginTop: spacing.lg,
  },
});
