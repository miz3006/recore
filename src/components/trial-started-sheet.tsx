import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  requestTrialNotificationPermission,
  scheduleTrialNotification,
} from '@/lib/billing/notifications';
import {
  getPriceLabel,
  getTrialClock,
  isTrialWelcomeDue,
  markTrialWelcomeShown,
} from '@/lib/billing/state';
import { formatChargeDate } from '@/lib/billing/trial';
import { color, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { BottomSheet } from './bottom-sheet';
import { AppButton, Eyebrow } from './primitives';

/**
 * The one screen that is allowed to ask for notification permission
 * (CLAUDE.md §12.1, §18; PLAN A2c).
 *
 * It exists because of a rule, not because of a feature: the permission is
 * asked AT TRIAL START, on a surface that has just explained what it is for.
 * Never in onboarding — an onboarding permission prompt is asked before the
 * user knows what the app is, gets denied, and then the good use of the
 * permission is gone for the life of the install.
 *
 * The ask is optional in the honest sense: "Not now" costs the user nothing,
 * because the in-app reminder (`trial-reminder-sheet.tsx`) still shows on day 5
 * with the same three facts. This sheet says that out loud rather than implying
 * a consequence, and it never asks again either way (§15 — no guilt copy).
 *
 * Shown once, on the first open after a trial starts. Renders nothing at all
 * when there is no trial, which is every state before billing lands.
 */
export function TrialStartedSheet() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(() => isTrialWelcomeDue());
  const [busy, setBusy] = useState(false);
  // Every fact here came from the store: the charge instant Apple reported and
  // the localized price string it formatted. Nothing is derived locally, so the
  // sentence below is true on every storefront (§2).
  const [facts] = useState(() => {
    const clock = getTrialClock();
    if (!clock) return null;
    return {
      chargeAtMs: clock.chargeAtMs,
      date: formatChargeDate(clock.chargeAtMs),
      price: getPriceLabel(),
    };
  });

  if (!facts) return null;

  const close = () => {
    markTrialWelcomeShown();
    setVisible(false);
  };

  const handleAllow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await requestTrialNotificationPermission();
      // A denial is a valid answer, not a failure: the in-app reminder is
      // untouched by it and the sheet closes exactly the same way.
      if (granted) await scheduleTrialNotification(facts.chargeAtMs, facts.price);
    } finally {
      setBusy(false);
      close();
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      sheetStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        Free trial
      </Eyebrow>
      <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {'Seven days.\nNothing charged yet.'}
      </Text>
      <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {facts.price
          ? `On ${facts.date} the trial becomes ${facts.price} unless you cancel. Two days before that, Recore can send you one reminder with the date and the amount.`
          : `On ${facts.date} the subscription begins unless you cancel. Two days before that, Recore can send you one reminder with the date and how to cancel.`}
      </Text>
      <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        One notification, once. Say no and Recore still tells you inside the app.
      </Text>

      <View style={styles.buttons}>
        <AppButton label="Not now" variant="secondary" onPress={close} style={styles.button} />
        <AppButton
          label="Remind me"
          loading={busy}
          onPress={() => void handleAllow()}
          style={styles.button}
        />
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
  foot: {
    marginTop: spacing.sm,
    ...type.footnote,
    lineHeight: moderateScale(17),
    color: color.textMuted,
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
