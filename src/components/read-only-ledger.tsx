import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { tap } from '@/lib/haptics';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';

/**
 * ReadOnlyLedger — design frame 13 "Lapsed — read-only ledger, no hostage
 * data". The subscription-first shape (CLAUDE.md §11) promises that a lapsed
 * account becomes READ-ONLY, never data loss: every note, record and plan stays
 * browsable and exportable; only new logging is paused.
 *
 * This is a self-contained, presentational surface. The app has no lapsed
 * route/state yet (entitlement enforcement waits for RevenueCat), so nothing
 * here invents routing — it's ready to drop into a screen and wire later.
 * Sessions default to the frame's copy; pass real briefs (already formatted)
 * via `sessions`, and wire `onExport` / `onResubscribe`.
 */
export interface ReadOnlyLedgerSession {
  id: string;
  /** "Upper A — push" */
  title: string;
  /** "Sun Jul 12 · 51 min" — pre-formatted date + duration. */
  meta: string;
  /** "9 620 kg" — pre-formatted numerals; rendered mono + tabular-nums. */
  volume: string;
}

export interface ReadOnlyLedgerProps {
  /** "Jul 12" — when read-only began. */
  since?: string;
  sessions?: ReadOnlyLedgerSession[];
  onExport?: () => void;
  onResubscribe?: () => void;
}

const DEFAULT_SESSIONS: ReadOnlyLedgerSession[] = [
  { id: '1', title: 'Upper A — push', meta: 'Sun Jul 12 · 51 min', volume: '9 620 kg' },
  { id: '2', title: 'Lower A — squat', meta: 'Fri Jul 10 · 55 min', volume: '10 780 kg' },
  { id: '3', title: 'Upper B — pull', meta: 'Wed Jul 8 · 47 min', volume: '7 410 kg' },
];

export function ReadOnlyLedger({
  since = 'Jul 12',
  sessions = DEFAULT_SESSIONS,
  onExport,
  onResubscribe,
}: ReadOnlyLedgerProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Top nav: wordmark · History pill · settings gear. */}
      <View style={styles.nav}>
        <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore
        </Text>
        <View style={styles.historyPill}>
          <Text style={styles.historyLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            History
          </Text>
        </View>
        <View style={styles.navRight}>
          <View style={styles.gear}>
            <Icon name="gear" size={moderateScale(17)} tint={color.textSecondary} />
          </View>
        </View>
      </View>

      {/* Read-only banner: neutral outlined chip, honest copy, Export + Resubscribe. */}
      <View style={styles.banner}>
        <View style={styles.bannerHead}>
          <Text style={styles.chip} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            READ-ONLY
          </Text>
          <Text style={styles.since} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            since {since}
          </Text>
        </View>
        <Text style={styles.bannerBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your subscription ended. Every note, record and plan stays yours to browse and export —
          new logging is paused.
        </Text>
        <View style={styles.bannerButtons}>
          <Pressable
            onPress={() => {
              tap();
              onExport?.();
            }}
            style={({ pressed }) => [styles.btnSecondary, pressed && styles.pressed]}>
            <Text style={styles.btnSecondaryLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Export
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              tap();
              onResubscribe?.();
            }}
            style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressedPrimary]}>
            <Text style={styles.btnPrimaryLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Resubscribe
            </Text>
          </Pressable>
        </View>
      </View>

      {/* The record itself — browsable, exportable, never hostage. */}
      <View style={styles.list}>
        {sessions.map((s, i) => (
          <View key={s.id} style={[styles.sessionRow, i < sessions.length - 1 && styles.sessionRule]}>
            <View style={styles.sessionText}>
              <Text style={styles.sessionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {s.title}
              </Text>
              <Text style={styles.sessionMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {s.meta}
              </Text>
            </View>
            <Text style={styles.sessionVolume} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {s.volume}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.spacer} />

      {/* Disabled composer — dashed, muted: new sessions are paused, not lost. */}
      <View style={styles.composer}>
        <Text style={styles.composerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          New sessions paused — your record is safe
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  wordmark: {
    width: moderateScale(92),
    fontSize: moderateScale(17),
    fontWeight: '700',
    letterSpacing: -0.4,
    color: color.textPrimary,
  },
  historyPill: {
    paddingVertical: spacing.sm + 1,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
  },
  historyLabel: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: color.textPrimary,
  },
  navRight: {
    width: moderateScale(92),
    alignItems: 'flex-end',
  },
  gear: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    marginTop: spacing.lg + 2,
    marginHorizontal: spacing.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  bannerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Neutral OUTLINED chip — never green, never a filled badge.
  chip: {
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 1,
    color: color.textSecondary,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  since: {
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  bannerBody: {
    marginTop: spacing.sm + 2,
    fontSize: moderateScale(15),
    lineHeight: moderateScale(23),
    color: color.textPrimary,
  },
  bannerButtons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  btnSecondary: {
    flex: 1,
    height: moderateScale(44),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryLabel: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: color.textPrimary,
  },
  btnPrimary: {
    flex: 1,
    height: moderateScale(44),
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryLabel: {
    fontSize: moderateScale(15),
    fontWeight: '600',
    color: color.bg,
  },
  pressed: {
    opacity: 0.6,
  },
  pressedPrimary: {
    backgroundColor: color.accentPressed,
  },
  list: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm + 2,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  sessionRule: {
    borderBottomWidth: 1,
    borderBottomColor: color.tableRule,
  },
  sessionText: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: moderateScale(17),
    fontWeight: '600',
    color: color.textPrimary,
  },
  sessionMeta: {
    marginTop: spacing.xs,
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  sessionVolume: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(14),
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  spacer: {
    flex: 1,
  },
  composer: {
    marginHorizontal: spacing.lg,
    height: moderateScale(52),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerLabel: {
    fontSize: moderateScale(14),
    color: color.textMuted,
  },
});
