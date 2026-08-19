import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { Icon } from '@/components/icon';
import { Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import { getReflection } from '@/lib/db/workouts';
import { groupThousands } from '@/lib/parse/estimate';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { tap } from '@/lib/haptics';
import { color, fonts, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';
import { labelForDay, useCurrentNote, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { PrLabel } from './gutter-value';
import { SaveSplitBlock } from './save-split';

/**
 * UNREACHABLE SINCE 18 AUGUST 2026. `SummaryPill` was its only opener and the
 * pill left Today on the owner's call; nothing else in the app presents this
 * sheet, which also makes "Save as a split day" (`save-split.tsx`, mounted
 * below) unreachable. Left in the tree, not deleted — restoring the pill
 * restores both.
 */

/**
 * SessionSummarySheet (UX roadmap N1) — the resting `SummaryPill` was a passive
 * dead end; tapping it now opens this backward-looking review. It reads the
 * SAME settled receipt the ledger and the pill draw from, so it never disagrees
 * with the record: stacked mono totals, the day's personal records, and each
 * lift's top set — then one door to the full progress hub. No chart, no green,
 * PR is the neutral outlined label. The record is already written; this only
 * gives the finished session a home at rest, where you actually are.
 *
 * It is also the check-in's way back (§8.1 — "the honest moment to answer is
 * sometimes twenty minutes later"): one quiet action hands off to the check-in
 * sheet AFTER this modal is fully gone (`onClosed` — UIKit refuses a second
 * presented sheet while one is still up).
 */
export function SessionSummarySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const note = useCurrentNote();
  const receipt = useSession((s) => s.receipt);
  const selectedDay = useSession((s) => s.selectedDay);
  const workoutId = useSession((s) => s.workoutId);
  const openCheckIn = useSession((s) => s.openCheckIn);

  // The one hand-off this sheet owes: opened → close fully → check-in. A ref,
  // not state — nothing renders differently while it is owed.
  const checkInOwed = useRef(false);
  useEffect(() => {
    // An open always starts with no hand-off owed.
    if (visible) checkInOwed.current = false;
  }, [visible]);

  // Whether the day already carries a reflection — decides the action's label,
  // re-read on every open so an edit made through check-in shows here.
  const hasReflection = useMemo(
    () => (visible && workoutId ? getReflection(workoutId) !== null : false),
    [visible, workoutId],
  );

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
    router.push('/progress');
  };

  const goReflect = () => {
    tap();
    checkInOwed.current = true;
    onClose();
  };

  // Share: a settled session as one archival PNG (the only way out of the app
  // this record has). The card renders hidden only while capturing — same
  // pattern as the week recap. Failure is silence; sharing is a bonus.
  const shareRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const handleShare = async () => {
    if (sharing) return;
    tap();
    setSharing(true);
    await new Promise((r) => setTimeout(r, 80)); // let the hidden card lay out
    try {
      const uri = await captureRef(shareRef, { format: 'png', quality: 1 });
      // view-shot returns file:// on Android but a bare path on iOS.
      const url = uri.startsWith('file://') ? uri : `file://${uri}`;
      await Sharing.shareAsync(url, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // sharing is a bonus, never an error surface
    } finally {
      setSharing(false);
    }
  };

  const handleClosed = () => {
    if (!checkInOwed.current) return;
    checkInOwed.current = false;
    openCheckIn();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onClosed={handleClosed}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <View style={styles.headRow}>
        <Eyebrow tone="muted">Session</Eyebrow>
        {!data.empty ? (
          <Pressable
            onPress={() => void handleShare()}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel="Share this session as an image"
            style={({ pressed }) => pressed && styles.sharePressed}>
            <Icon name="share" size={moderateScale(17)} tint={color.textSecondary} />
          </Pressable>
        ) : null}
      </View>
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

      {/* Turn this session into a split day, here, where the movements are
          already read back — instead of retyping them in You (owner, 13 Aug).
          It decides its own visibility: too few movements, or a day already in
          the split, and it renders nothing. */}
      {/* Keyed on the day: the sheet stays mounted between opens, and a
          "Saved as Push" line left over from today must not follow the athlete
          when they swipe back to yesterday's session. */}
      {!data.empty ? <SaveSplitBlock key={selectedDay} rows={data.rows} /> : null}

      {/* The reflection's way back (§8.1). Only when there is a session to
          reflect on — an empty day has nothing to hand off to. */}
      {!data.empty && workoutId ? (
        <AppButton
          label={hasReflection ? 'Edit your reflection' : 'Add a reflection'}
          variant="secondary"
          onPress={goReflect}
          style={styles.cta}
        />
      ) : null}
      <AppButton
        label="See progress"
        onPress={goStats}
        style={!data.empty && workoutId ? styles.ctaTight : styles.cta}
      />

      {/* The share card — laid out off-screen only while capturing. A fixed
          width so the PNG has one deliberate shape whatever the phone. */}
      {sharing ? (
        <View ref={shareRef} collapsable={false} style={styles.shareCard}>
          <View style={styles.shareHead}>
            <Text style={styles.shareEyebrow} allowFontScaling={false}>
              {`SESSION · ${labelForDay(selectedDay).toUpperCase()}`}
            </Text>
            <Text style={styles.shareBrand} allowFontScaling={false}>
              Recore
            </Text>
          </View>
          <Text style={styles.shareTotals} allowFontScaling={false}>
            {[
              `${data.exercises} ${data.exercises === 1 ? 'lift' : 'lifts'}`,
              `${data.sets} ${data.sets === 1 ? 'set' : 'sets'}`,
              data.volume > 0
                ? `${groupThousands(data.volume)} kg`
                : data.distanceM > 0
                  ? formatDistanceTotal(data.distanceM)
                  : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <View style={styles.shareRows}>
            {data.rows.slice(0, 10).map((r, i) => (
              <View key={`s:${r.line}:${i}`} style={styles.shareRow}>
                <Text style={styles.shareName} numberOfLines={1} allowFontScaling={false}>
                  {r.exercise}
                </Text>
                <View style={styles.shareRight}>
                  {r.signal?.kind === 'pr' ? <PrLabel /> : null}
                  <Text style={styles.shareValue} numberOfLines={1} allowFontScaling={false}>
                    {r.setText}
                  </Text>
                </View>
              </View>
            ))}
            {data.rows.length > 10 ? (
              <Text style={styles.shareMore} allowFontScaling={false}>
                {`+ ${data.rows.length - 10} more`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
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
    backgroundColor: color.surface,
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
    fontFamily: fonts.reading,
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...type.footnote,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
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
    fontFamily: fonts.reading,
    fontSize: moderateScale(14),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    marginTop: spacing.lg,
  },
  ctaTight: {
    marginTop: spacing.sm,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sharePressed: {
    opacity: 0.5,
  },

  // --- the share PNG, composed off-screen ---
  shareCard: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 360,
    backgroundColor: color.surface,
    padding: spacing.xl,
  },
  shareHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  shareEyebrow: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    letterSpacing: 1,
    color: color.textMuted,
  },
  shareBrand: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: color.textMuted,
  },
  shareTotals: {
    marginTop: spacing.md,
    fontFamily: fonts.reading,
    fontSize: 17,
    fontWeight: '600',
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  shareRows: {
    marginTop: spacing.md,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: color.tableRule,
  },
  shareName: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: color.textPrimary,
  },
  shareRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareValue: {
    fontFamily: fonts.reading,
    fontSize: 12.5,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  shareMore: {
    paddingTop: spacing.sm,
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
    color: color.textMuted,
  },
});
