import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getPriceLabel,
  getTrialClock,
  isTrialReminderDue,
  markTrialReminderShown,
} from '@/lib/billing/state';
import { managementUrl } from '@/lib/billing/store';
import { formatChargeDate } from '@/lib/billing/trial';
import { tap } from '@/lib/haptics';
import { color, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { BottomSheet } from './bottom-sheet';
import { AppButton, Eyebrow } from './primitives';

/**
 * The day-5 trial reminder, in the app (CLAUDE.md §12.1, PLAN A2b).
 *
 * The paywall's timeline promises a reminder before the charge. This is the
 * version of that promise that is ALWAYS TRUE: it needs no permission, so it
 * survives a user who denies notifications, an install with notifications
 * switched off system-wide, and a device in Focus. A scheduled local
 * notification (PLAN A2c) is an upgrade layered on top of this — never a
 * replacement for it.
 *
 * It carries the three facts a person actually needs and nothing else: the
 * date, the amount, and how to cancel. No countdown, no "don't lose", no offer
 * to stay — §20 forbids all three, and a reminder that tries to sell is the
 * reason people stop trusting reminders.
 *
 * Shown at most once (`markTrialReminderShown`). Opening on day 6 having missed
 * day 5 still gets it; opening on day 6 having seen it on day 5 does not.
 */
export function TrialReminderSheet() {
  const insets = useSafeAreaInsets();
  // Decided once, on mount: this is a "first open in the window" surface, and
  // re-evaluating on every render would re-open it after the dismiss.
  const [visible, setVisible] = useState(() => isTrialReminderDue());
  const [facts] = useState(() => {
    const clock = getTrialClock();
    if (!clock) return null;
    return {
      days: clock.daysUntilCharge,
      date: formatChargeDate(clock.chargeAtMs),
      // The store's own localized string, or null. Null means the amount is
      // simply not stated — a hardcoded currency here would be false on most
      // storefronts (§2: the price is always truthful).
      price: getPriceLabel(),
    };
  });

  if (!facts) return null;

  const close = () => {
    markTrialReminderShown();
    setVisible(false);
  };

  const handleManage = () => {
    tap();
    // The customer-specific management URL when the store has one; Apple's
    // generic subscriptions page otherwise. Never a dead control (§2).
    void managementUrl()
      .then((url) => Linking.openURL(url))
      .catch(() => {});
    close();
  };

  const dayWord = facts.days === 1 ? 'day' : 'days';

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        Free trial
      </Eyebrow>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {facts.days > 0 ? `${facts.days} ${dayWord} left` : 'Your trial ends today'}
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {facts.price
          ? `Recore charges ${facts.price} on ${facts.date}. Cancel before then in the App Store and nothing is charged — your record stays yours either way.`
          : `Your subscription begins on ${facts.date}. Cancel before then in the App Store and nothing is charged — your record stays yours either way.`}
      </Text>

      <View style={styles.buttons}>
        <AppButton
          label="Manage subscription"
          variant="secondary"
          onPress={handleManage}
          style={styles.button}
        />
        <AppButton label="Got it" onPress={close} style={styles.button} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.bg,
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  body: {
    marginTop: spacing.md,
    ...type.subhead,
    lineHeight: moderateScale(23),
    color: color.textSecondary,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
  },
});
