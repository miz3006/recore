import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getAllTimePRs,
  getWorkoutDetail,
  type WorkoutSet,
} from '@/lib/db/insights';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { color, lineFor, MAX_FONT_SCALE, moderateScale, radius, readingStyle, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { BottomSheet } from './bottom-sheet';
import { E1RM_LABEL } from './e1rm-sheet';

/**
 * SessionSheet (progress spec §3.7) — the forensic floor of the drill-down.
 * Tap a recorded session anywhere and this answers "what were the exact sets
 * that day?": every counted set as `100 kg × 8 · est. 1RM 125`, warm-ups dimmed and
 * excluded, drops indented under their parent, supersets flagged by their
 * shared group. The parser's RIR reading rides along in the quiet INTERPRETED
 * voice (mono, muted) — never dressed up as the user's verbatim words. RECORDED
 * work only: no chart, no green, PR is the one neutral outlined mono label.
 */

const PR_SCAN = 400;

/** Epley over a sane rep cap so a 20-rep burnout doesn't fake a max. */
function e1rmOf(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || reps < 1 || reps > 12) return null;
  return Math.round((weight * (1 + reps / 30)) / 0.5) * 0.5;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** The right-aligned mono reading for one set — weight, cardio, or bodyweight. */
function setValue(s: WorkoutSet): string {
  if (s.weightKg != null) {
    return s.reps != null ? `${fmtNumber(s.weightKg)} kg × ${s.reps}` : `${fmtNumber(s.weightKg)} kg`;
  }
  if (s.distanceM != null) {
    const km = `${fmtNumber(s.distanceM / 1000)} km`;
    return s.durationS != null ? `${km} · ${fmtDuration(s.durationS)}` : km;
  }
  if (s.durationS != null) return fmtDuration(s.durationS);
  if (s.reps != null) return `× ${s.reps}`;
  return '—';
}

export function SessionSheet() {
  const userId = useSession((s) => s.userId);
  const sheetSession = useSession((s) => s.sheetSession);
  const closeSessionSheet = useSession((s) => s.closeSessionSheet);

  const detail = useMemo(
    () => (sheetSession ? getWorkoutDetail(sheetSession) : null),
    [sheetSession],
  );

  // All-time bests, to mark the set that set a record (same rule as the lift
  // sheet: heaviest counted set on the day it was set).
  //
  // A BASELINE IS SKIPPED ENTIRELY (4 September 2026). When a lift's heaviest
  // day is also the first day it was ever written down, nothing was beaten to
  // get there, and a "PR" on it makes the word worthless everywhere else it
  // appears. Dropped from the map rather than filtered at the row, so there is
  // one place this rule lives on this screen.
  const prMap = useMemo(() => {
    const m = new Map<string, { weightKg: number; day: string }>();
    if (!userId) return m;
    for (const p of getAllTimePRs(userId, PR_SCAN)) {
      if (p.isBaseline) continue;
      m.set(p.canonical.toLowerCase(), { weightKg: p.weightKg, day: p.day });
    }
    return m;
  }, [userId]);

  const close = () => {
    closeSessionSheet();
  };

  const exerciseCount = detail?.exercises.length ?? 0;

  return (
    <BottomSheet
      visible={sheetSession !== null}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <View style={styles.header}>
        <View style={styles.namePill}>
          <Text style={styles.nameText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail ? labelForDay(detail.day) : 'Session'}
          </Text>
        </View>
      </View>

      {detail && exerciseCount > 0 ? (
        <>
          <Text style={styles.heroLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'} · {detail.countedSets}{' '}
            {detail.countedSets === 1 ? 'set' : 'sets'}
            {detail.volume > 0 ? ` · ${groupThousands(detail.volume)} kg` : ''}
          </Text>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {detail.exercises.map((ex, ei) => {
              const prForEx = prMap.get(ex.canonical.toLowerCase());
              let working = 0;
              return (
                <View key={ex.itemId} style={[styles.exBlock, ei > 0 && styles.exDivider]}>
                  <View style={styles.exHead}>
                    <Text style={styles.exName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {ex.canonical}
                    </Text>
                    {ex.groupKey ? (
                      <Text style={styles.groupTag} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        SUPERSET
                      </Text>
                    ) : null}
                  </View>

                  {ex.sets.map((s, si) => {
                    const isWarm = s.kind === 'warmup';
                    const isDrop = !isWarm && (s.kind === 'drop' || s.parentSetId != null);
                    if (!isWarm && !isDrop) working += 1;
                    const label = isWarm ? 'Warm-up' : isDrop ? 'Drop' : `Set ${working}`;
                    const e = isWarm ? null : e1rmOf(s.weightKg, s.reps);
                    const isPr =
                      !isWarm &&
                      s.weightKg != null &&
                      prForEx != null &&
                      s.weightKg === prForEx.weightKg &&
                      detail.day === prForEx.day;
                    return (
                      <View key={si} style={[styles.setRow, isDrop && styles.setRowDrop]}>
                        <View style={styles.setLeft}>
                          <Text
                            style={[styles.setLabel, isWarm && styles.setLabelMuted]}
                            maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {label}
                          </Text>
                          {isPr ? (
                            <Text style={styles.prLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                              PR
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.setValue, isWarm && styles.setValueMuted]}
                          maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          {setValue(s)}
                          {/* One wording for this label everywhere it is
                              printed (4 September 2026) — the Progression row,
                              the lift sheet and this set all say `est. 1RM`.
                              The number keeps the SET's kilograms: it sits
                              inside a reading that already carries a unit, and
                              a second one on the same line would be noise. */}
                          {e != null ? (
                            <Text style={styles.setMeta}>{`  ·  ${E1RM_LABEL} ${fmtNumber(e)}`}</Text>
                          ) : null}
                          {!isWarm && s.rir != null ? (
                            <Text style={styles.setMeta}>{`  ·  RIR ${fmtNumber(s.rir)}`}</Text>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recorded work only, exactly as read from your note.
            </Text>
          </ScrollView>
        </>
      ) : (
        <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Nothing recorded for this session.
        </Text>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  namePill: {
    paddingVertical: moderateScale(9),
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    maxWidth: '80%',
  },
  nameText: {
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  heroLine: {
    marginTop: spacing.lg,
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  scroll: {
    flexShrink: 1,
    marginTop: spacing.sm,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },

  exBlock: {
    paddingVertical: spacing.md,
  },
  exDivider: {
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  exHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  exName: {
    flexShrink: 1,
    fontSize: type.subhead.fontSize,
    fontWeight: '600',
    color: color.textPrimary,
  },
  groupTag: {
    ...readingStyle('700'),
    fontSize: moderateScale(9),
    letterSpacing: 0.6,
    // WARM-UP / DROP — it says what a set IS, which is the only thing that
    // tells warm-ups apart from counted work (§1.1 invariant 5).
    color: color.textSecondary,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm - 1,
  },
  setRowDrop: {
    paddingLeft: spacing.lg,
  },
  setLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  setLabel: {
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  setLabelMuted: {
    color: color.textMuted,
  },
  prLabel: {
    ...readingStyle('700'),
    fontSize: moderateScale(10),
    letterSpacing: 0.5,
    color: color.textPrimary,
    borderWidth: 1,
    borderColor: color.accent,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  setValue: {
    flexShrink: 1,
    textAlign: 'right',
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textPrimary,
  },
  setValueMuted: {
    color: color.textMuted,
  },
  setMeta: {
    color: color.textMuted,
  },
  footer: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: moderateScale(12),
    lineHeight: lineFor(19),
    color: color.textMuted,
  },
  empty: {
    ...type.subhead,
    color: color.textMuted,
    paddingVertical: spacing.xxl,
  },
});
