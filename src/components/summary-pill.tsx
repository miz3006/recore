import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FadeSlideIn, PressableScale } from '@/components/motion';
import { tap } from '@/lib/haptics';
import { formatDistanceTotal } from '@/lib/parse/summarize';
import { groupThousands } from '@/lib/parse/estimate';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, shadow, spacing, type } from '@/lib/theme';
import { useCurrentNote, useSession } from '@/state/session-store';

import { SessionSummarySheet } from './session-summary-sheet';

/**
 * The resting-state summary pill ("Recore Light" frames 01/02): when the
 * keyboard is down, a single mono pill sits above the safe area — this day's
 * counted sets and tonnage ("14 sets · 9 840 kg"), or a quiet "0 sets · 0 kg"
 * on an empty day. It reads the same settled receipt the ledger draws from, so
 * it never disagrees with the record. Volume gives way to distance on a pure
 * cardio day — Recore is a training log, not only a gym log.
 */
export function SummaryPill({ bottomInset = 0 }: { bottomInset?: number }) {
  const note = useCurrentNote();
  const receipt = useSession((s) => s.receipt);
  const [open, setOpen] = useState(false);

  const settled = note.trim().length > 0 && receipt !== null;
  const sets = settled ? receipt!.totalSets : 0;
  const volume = settled ? receipt!.volume : 0;
  const distanceM = settled && volume === 0 ? receipt!.distanceM : 0;

  const empty = sets === 0 && volume === 0 && distanceM === 0;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset }]}>
      {/* The resting pill is the one door to review this session + progress. */}
      <FadeSlideIn distance={moderateScale(10)}>
        <PressableScale
          accessibilityRole="button"
          haptic="none"
          activeScale={0.98}
          onPress={() => {
            tap();
            setOpen(true);
          }}
          style={styles.pill}
          pressedStyle={styles.pillPressed}>
          {/* Scope label so this can never be read as the InsightHeader's
              "this week ·" total — same cadence, one glance apart. */}
          <Text style={styles.scope} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            today
          </Text>
          <Dot />
          <Segment value={String(sets)} unit="sets" muted={empty} />
          <Dot />
          {distanceM > 0 ? (
            <Segment raw={formatDistanceTotal(distanceM)} muted={empty} />
          ) : (
            <Segment value={volume > 0 ? groupThousands(volume) : '0'} unit="kg" muted={empty} />
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
    <Text style={styles.segment} maxFontSizeMultiplier={MAX_FONT_SCALE}>
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
    height: moderateScale(52),
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
  pillPressed: {
    backgroundColor: color.surfaceHigh,
  },
  scope: {
    ...type.subhead,
    fontFamily: fonts.mono,
    color: color.textSecondary,
  },
  segment: {
    ...type.subhead,
    fontFamily: fonts.mono,
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
