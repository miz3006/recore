import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { StubScreen } from '@/components/stub-screen';
import { signOut } from '@/lib/auth/sign-in';
import { buildWorkoutsCsv } from '@/lib/export-csv';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import {
  getBarWeightKg,
  getGoal,
  getSmallestPlateKg,
  setBarWeightKg,
  setGoal,
  setSmallestPlateKg,
  type Goal,
} from '@/lib/prefs';
import { scheduleSync } from '@/lib/sync/index';
import { color, CONTROL_HEIGHT, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { fmtNumber } from '@/lib/parse/summarize';
import { useSession } from '@/state/session-store';

/**
 * /settings: training profile (goal, smallest plate — the answers onboarding
 * collected are finally editable here, and the plate feeds roundToPlate so it
 * visibly changes every prescription), data in AND out (import + CSV export —
 * export is free forever, CLAUDE.md §11), Recore Pro, and sign out.
 */
const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'both', label: 'Both' },
];

/** Same options onboarding offers — one source of plate truth for the picker. */
const PLATE_OPTIONS = [0.5, 1.25, 2.5] as const;

/** Olympic 20 or the common 15 — feeds the checklist's plate math. */
const BAR_OPTIONS = [15, 20] as const;

export default function Settings() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  const [busy, setBusy] = useState<null | 'import' | 'signout'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [goal, setGoalState] = useState<Goal | null>(() => getGoal());
  const [plate, setPlateState] = useState<number | null>(() => getSmallestPlateKg());
  const [bar, setBarState] = useState<number>(() => getBarWeightKg());

  const handleBar = (kg: number) => {
    tap();
    setBarWeightKg(kg);
    setBarState(kg);
  };

  const handleGoal = (g: Goal) => {
    tap();
    setGoal(g);
    setGoalState(g);
  };

  const handlePlate = (kg: number) => {
    tap();
    setSmallestPlateKg(kg);
    setPlateState(kg);
    // The plate shapes every prescribed load (roundToPlate) — rebuild the
    // cached ghost so the change is visible on the very next open.
    if (userId) {
      recachePredictionFromLatest(userId);
      hydrate(userId);
    }
  };

  const handleImport = async () => {
    if (busy || !userId) return;
    tap();
    setImportMessage(null);
    setBusy('import');
    try {
      const outcome = await pickAndImportCsv(userId);
      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'invalid') {
        setImportMessage('That file is not a Hevy or Strong CSV export.');
        return;
      }
      if (outcome.status === 'failed') {
        setImportMessage('Import failed — export a fresh CSV and try again.');
        return;
      }

      hydrate(userId); // streak, calendar dots, today's view
      scheduleSync();
      setImportMessage(
        outcome.importedDays > 0
          ? `Imported ${outcome.importedDays} workouts (${outcome.sets} sets)` +
              (outcome.skippedDays > 0 ? ` · ${outcome.skippedDays} days already logged` : '')
          : 'Nothing new to import — those days are already logged.',
      );
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    if (!userId) return;
    tap();
    const csv = buildWorkoutsCsv(userId);
    if (!csv) {
      setExportMessage('Nothing to export yet.');
      return;
    }
    setExportMessage(null);
    await Share.share({ title: 'Recore export', message: csv });
  };

  const handleSignOut = async () => {
    if (busy) return;
    tapMedium();
    setBusy('signout');
    try {
      await signOut(); // the guard swaps back to /sign-in
    } finally {
      setBusy(null);
    }
  };

  return (
    <StubScreen title="Settings">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          training
        </Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Goal
            </Text>
            <View style={styles.segments}>
              {GOAL_OPTIONS.map((g) => (
                <Pressable
                  key={g.id}
                  onPress={() => handleGoal(g.id)}
                  style={[styles.segment, goal === g.id && styles.segmentSelected]}>
                  <Text
                    style={[styles.segmentLabel, goal === g.id && styles.segmentLabelSelected]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Smallest plate
            </Text>
            <View style={styles.segments}>
              {PLATE_OPTIONS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handlePlate(p)}
                  style={[styles.segment, plate === p && styles.segmentSelected]}>
                  <Text
                    style={[styles.segmentLabel, plate === p && styles.segmentLabelSelected]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {fmtNumber(p)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Bar weight
            </Text>
            <View style={styles.segments}>
              {BAR_OPTIONS.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => handleBar(b)}
                  style={[styles.segment, bar === b && styles.segmentSelected]}>
                  <Text
                    style={[styles.segmentLabel, bar === b && styles.segmentLabelSelected]}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {b} kg
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        <Text style={styles.sectionFootnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Predictions round to what your gym&apos;s bar can actually hold.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          data
        </Text>
        <View style={styles.card}>
          <Pressable
            disabled={busy !== null}
            onPress={() => void handleImport()}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {busy === 'import' ? 'Importing…' : 'Import from Hevy or Strong'}
            </Text>
            <Icon name="chevron-forward" size={moderateScale(15)} tint={color.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => void handleExport()}
            style={({ pressed }) => [styles.row, styles.rowDivider, pressed && styles.pressed]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Export CSV
            </Text>
            <Icon name="chevron-forward" size={moderateScale(15)} tint={color.textMuted} />
          </Pressable>
        </View>
        <Text
          style={[
            styles.sectionFootnote,
            (importMessage ?? exportMessage) != null && styles.footnoteActive,
          ]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {importMessage ??
            exportMessage ??
            'Your history makes comparisons and predictions useful from day one.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          recore pro
        </Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => {
              tap();
              router.push('/paywall');
            }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recore Pro
            </Text>
            <Icon name="chevron-forward" size={moderateScale(15)} tint={color.textMuted} />
          </Pressable>
        </View>
        <Text style={styles.sectionFootnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Everything is unlocked while Recore is in beta.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          account
        </Text>
        <View style={styles.card}>
          <Pressable
            disabled={busy !== null}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.signOutLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {busy === 'signout' ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Recore {Constants.expoConfig?.version ?? ''}
      </Text>
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
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.caption,
    color: color.textMuted,
    marginLeft: spacing.lg,
  },
  // Grouped inset card — rows separated by hairlines, never heavy dividers.
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    minHeight: CONTROL_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  rowLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  segments: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceHigh,
  },
  segmentSelected: {
    backgroundColor: color.accent,
  },
  segmentLabel: {
    fontSize: type.caption.fontSize,
    fontWeight: '600',
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  segmentLabelSelected: {
    color: color.bg,
  },
  sectionFootnote: {
    ...type.caption,
    color: color.textMuted,
    marginLeft: spacing.lg,
  },
  footnoteActive: {
    color: color.textSecondary, // an actual result speaks a step louder
  },
  signOutLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.error, // destructive: error text only (CLAUDE.md §5)
  },
  version: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
});
