import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { restore, useEntitlementDecision } from '@/lib/billing/state';
import { managementUrl } from '@/lib/billing/store';
import { formatChargeDate } from '@/lib/billing/trial';
import { buildExportJson } from '@/lib/export-json';
import { shareExportFile } from '@/lib/export-share';
import { tap } from '@/lib/haptics';
import { getLedgerSize } from '@/lib/db/ledger-size';
import { getRecentSessions } from '@/lib/db/insights';
import {
  color,
  fonts,
  MAX_FONT_SCALE,
  moderateScale,
  monoText,
  radius,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { AppButton } from './primitives';

/**
 * The lapsed surface (CLAUDE.md §12.2, PLAN B4) — what Today becomes when the
 * subscription has ended.
 *
 * The promise this keeps is the one in §20: NEVER GATE, DEGRADE OR DELAY
 * EXPORT. A lapsed account is read-only, not confiscated — every note, session
 * and plan is still on the device, still browsable through Lifts and Progress,
 * and still exportable in full and for free from right here. Only new logging
 * pauses, which is the single thing a subscription actually buys.
 *
 * It replaces the composer on Today and nothing else. The other three tabs are
 * untouched on purpose: locking the record behind a paywall after the fact is
 * exactly the move this app was built not to make.
 *
 * This file was finished on 26 July and had ZERO importers until 28 July —
 * it rendered three invented sessions and waited for an entitlement to reach
 * it. The invented rows are gone; it reads the real ledger now.
 *
 * IT STATES THE PERSON'S OWN NUMBERS (§2.2, 29 Jul 2026): how many sessions are
 * recorded and the range they span. That is the whole tone of this screen —
 * evidence of what they built, in place of the countdown or the guilt line a
 * lapsed screen usually carries. There is no "you are losing", no timer, and no
 * offer that expires.
 *
 * IT ALSO SAYS WHICH LAPSE THIS IS. "Your subscription ended" and "Recore could
 * not reach the App Store" are different sentences, and telling a paying
 * customer the first when the second is true is the kind of small lie that ends
 * in a refund request. `useEntitlementDecision` carries the reason.
 */
const SESSION_LIMIT = 8;

/** "12 Mar 2026 – 28 Jul 2026", or a single date when the record is one day. */
function rangeLabel(firstAt: string | null, lastAt: string | null): string | null {
  const first = firstAt ? Date.parse(firstAt) : Number.NaN;
  const last = lastAt ? Date.parse(lastAt) : Number.NaN;
  if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
  const a = formatChargeDate(first);
  const b = formatChargeDate(last);
  return a === b ? a : `${a} – ${b}`;
}

export function ReadOnlyLedger() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);
  const { reason } = useEntitlementDecision();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sessions = useMemo(
    () => (userId ? getRecentSessions(userId, SESSION_LIMIT) : []),
    [userId],
  );

  // The person's own record, in two numbers (§2.2). One synchronous local read,
  // so this screen is complete offline — which is exactly the state it most
  // often appears in.
  const ledger = useMemo(() => (userId ? getLedgerSize(userId) : null), [userId]);
  const range = ledger ? rangeLabel(ledger.firstAt, ledger.lastAt) : null;

  const handleExport = async () => {
    if (!userId) return;
    tap();
    const json = buildExportJson(userId);
    if (!json) {
      setExportMessage('Nothing to export yet.');
      return;
    }
    const outcome = await shareExportFile('json', json);
    setExportMessage(outcome === 'failed' ? 'Export failed — try again.' : null);
  };

  const handleResubscribe = () => {
    tap();
    router.push('/paywall');
  };

  /** Restore, right here. §2.2 requires it directly reachable from this screen —
   * for an `unverified` lapse it is the single tap that fixes everything. */
  const handleRestore = async () => {
    if (busy) return;
    tap();
    setBusy(true);
    setExportMessage(null);
    try {
      const outcome = await restore();
      if (outcome.status === 'nothing') {
        setExportMessage('No Recore subscription is attached to this Apple Account.');
      } else if (outcome.status === 'failed') {
        setExportMessage('Restore could not reach the App Store. Try again in a moment.');
      }
      // A successful restore flips the entitlement and this screen unmounts.
    } finally {
      setBusy(false);
    }
  };

  const handleManage = () => {
    tap();
    void managementUrl()
      .then((url) => Linking.openURL(url))
      .catch(() => {});
  };

  /**
   * What is actually closed, in the person's own situation. Each branch names
   * one state and offers the action that resolves it — never a guilt line and
   * never a countdown (§2.2).
   */
  const explanation =
    reason === 'unverified'
      ? 'Recore could not confirm your subscription with the App Store. Your record is untouched and stays fully exportable — restoring purchases is usually all this needs.'
      : reason === 'never'
        ? 'Writing new sessions and your personal brief are part of the subscription. Everything you have already recorded stays open and exportable.'
        : 'Your subscription ended, so writing new sessions and your personal brief are paused. Everything you recorded stays open and exportable.';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + spacing.xxl + TAB_BAR_CLEARANCE },
      ]}
      showsVerticalScrollIndicator={false}>
      {/* The person's own record first, then what is closed, then the actions.
          Export sits beside Resubscribe at the same size, because it is not the
          lesser action here (§2.2). */}
      <View style={styles.banner}>
        <Text style={styles.chip} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          READ-ONLY
        </Text>

        {/* Their numbers, not ours. No countdown, no "don't lose", no offer
            that expires — the evidence of what they built is the whole line. */}
        {ledger && ledger.sessions > 0 ? (
          <View style={styles.record}>
            <Text style={styles.recordCount} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`${ledger.sessions} ${ledger.sessions === 1 ? 'session' : 'sessions'} recorded`}
            </Text>
            {range ? (
              <Text style={styles.recordRange} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {range}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.bannerBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {explanation}
        </Text>
        <View style={styles.bannerButtons}>
          <AppButton
            label="Export everything"
            variant="secondary"
            compact
            onPress={() => void handleExport()}
            style={styles.bannerButton}
          />
          <AppButton
            label="Resubscribe"
            compact
            onPress={handleResubscribe}
            style={styles.bannerButton}
          />
        </View>
        {/* Both are required to be directly reachable from this screen (§2.2).
            Restore is first: for the unverified case it is the one tap that
            resolves everything, and it never charges. */}
        <View style={styles.bannerButtons}>
          <AppButton
            label={busy ? 'Restoring…' : 'Restore purchases'}
            variant="secondary"
            compact
            disabled={busy}
            onPress={() => void handleRestore()}
            style={styles.bannerButton}
          />
          <AppButton
            label="Manage subscription"
            variant="secondary"
            compact
            onPress={handleManage}
            style={styles.bannerButton}
          />
        </View>
        {exportMessage ? (
          <Text style={styles.exportNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {exportMessage}
          </Text>
        ) : null}
      </View>

      {/* The record itself — browsable, exportable, never hostage. */}
      <View style={styles.list}>
        {sessions.map((s, i) => (
          <View
            key={s.workoutId}
            style={[styles.sessionRow, i < sessions.length - 1 && styles.sessionRule]}>
            <View style={styles.sessionText}>
              <Text style={styles.sessionTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {labelForDay(s.day)}
              </Text>
              <Text style={styles.sessionMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {s.exercises} {s.exercises === 1 ? 'exercise' : 'exercises'} · {s.sets}{' '}
                {s.sets === 1 ? 'set' : 'sets'}
              </Text>
            </View>
            {s.volume > 0 ? (
              <Text style={styles.sessionVolume} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {s.volume.toLocaleString('en-US')} kg
              </Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* The composer's place, held open and honest — not removed, paused. */}
      <View style={styles.composer}>
        <Text style={styles.composerLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          New sessions paused — your record is safe
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  banner: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  // Neutral OUTLINED chip — never green, never a filled badge.
  chip: {
    alignSelf: 'flex-start',
    ...type.footnote,
    fontFamily: fonts.mono,
    fontWeight: '700',
    letterSpacing: 1,
    color: color.textSecondary,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm - 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  // The person's own record — the largest thing on this screen, on purpose.
  record: {
    marginTop: spacing.lg,
  },
  recordCount: {
    ...type.title2,
    color: color.textPrimary,
  },
  recordRange: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: type.footnote.fontSize,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
  },
  bannerBody: {
    marginTop: spacing.sm + 2,
    ...type.subhead,
    lineHeight: moderateScale(23),
    color: color.textPrimary,
  },
  bannerButtons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  bannerButton: {
    flex: 1,
  },
  exportNote: {
    marginTop: spacing.sm,
    ...type.footnote,
    color: color.textSecondary,
  },
  list: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.lg,
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
    ...type.headline,
    fontWeight: '600',
    color: color.textPrimary,
  },
  sessionMeta: {
    marginTop: spacing.xs,
    ...type.caption,
    color: color.textSecondary,
  },
  sessionVolume: {
    ...monoText,
    color: color.textSecondary,
  },
  composer: {
    marginTop: spacing.xl,
    minHeight: moderateScale(52),
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.border,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  composerLabel: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
  },
});
