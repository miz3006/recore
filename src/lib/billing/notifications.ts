import * as Notifications from 'expo-notifications';

import { getMeta, setMeta } from '@/lib/db/index';
import { devLog } from '@/lib/log';

import { formatChargeDate, REMINDER_LEAD_DAYS } from './trial';

/**
 * The day-5 trial notification — the UPGRADE, never the whole thing
 * (CLAUDE.md §12.1, PLAN A2c).
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE. The in-app reminder
 * (`trial-reminder-sheet.tsx`) is the floor and it needs no permission, so the
 * paywall's promise stays true for a user who denies this, has notifications
 * off system-wide, or is in Focus. Everything below is additive. If this file
 * were deleted the app would still keep its word.
 *
 * THE RULES, and none of them are negotiable (§15, §18):
 *  - Permission is asked AT TRIAL START, on a screen that has just explained
 *    what it is for (`trial-started-sheet.tsx`). Never in onboarding, never on
 *    a cold launch, never next to a set.
 *  - NEVER RE-ASKED after a denial. `canAskAgain` is checked, and a local flag
 *    records that we have asked once, so a reinstall of the flow cannot nag.
 *  - AT MOST ONE. When the in-app reminder is shown, the scheduled notification
 *    is cancelled, so a user is never told the same thing twice.
 *  - No guilt copy. The notification carries the date, the amount and where to
 *    cancel — the same three facts as the sheet, and nothing else. No "don't
 *    lose", no countdown, no offer to stay.
 *
 * Every function swallows its own failure: a notification is a courtesy, and a
 * courtesy may never break a purchase or a parse.
 */
const KEYS = {
  asked: 'trial_notif_asked',
  scheduledId: 'trial_notif_id',
} as const;

/** Have we ever put the system dialog in front of this user? */
function hasAsked(): boolean {
  return getMeta(KEYS.asked) === '1';
}

/**
 * Ask once, at the moment the user has just been told why. Returns whether we
 * ended up with permission — a `false` is a completely valid outcome and the
 * caller must not treat it as an error.
 */
export async function requestTrialNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // Denied before, or the OS says we may not ask again: stop. This is the
    // line that keeps a denial permanent.
    if (!current.canAskAgain || hasAsked()) return false;

    setMeta(KEYS.asked, '1');
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return next.granted;
  } catch (err) {
    devLog('notification permission check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Schedule the one notification, `REMINDER_LEAD_DAYS` before the charge — the
 * same instant the in-app reminder becomes due, so the two never disagree about
 * which day it is.
 *
 * BOTH INSTANTS COME FROM THE STORE (29 Jul 2026). The caller passes the charge
 * instant Apple reported, not a locally derived "start plus seven": a
 * notification that names the wrong date is worse than no notification, and
 * sandbox trials are compressed to minutes.
 *
 * `priceText` is the store's own localized price string. When there is none the
 * notification states the date and where to cancel and SAYS NOTHING ABOUT AN
 * AMOUNT — a hardcoded dollar figure would be false on most storefronts (§2:
 * the price is always truthful).
 *
 * Silently does nothing without permission, or when the moment has already
 * passed (firing one immediately would be a jump scare rather than a courtesy).
 */
export async function scheduleTrialNotification(
  chargeAtMs: number,
  priceText: string | null,
): Promise<void> {
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;

    const fireAt = new Date(chargeAtMs - REMINDER_LEAD_DAYS * 86_400_000);
    if (fireAt.getTime() <= Date.now()) return;

    await cancelTrialNotification(); // never two

    const when = formatChargeDate(chargeAtMs);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Your Recore trial ends in ${REMINDER_LEAD_DAYS} days`,
        body: priceText
          ? `${priceText} on ${when}. Cancel any time in the App Store.`
          : `Your subscription starts on ${when}. Cancel any time in the App Store.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    setMeta(KEYS.scheduledId, id);
  } catch (err) {
    devLog('trial notification not scheduled:', err instanceof Error ? err.message : err);
  }
}

/**
 * Drop the pending notification. Called when the in-app reminder has already
 * said it (at most one), and by billing when a trial is cancelled or converts
 * early — a reminder about a charge that is no longer coming is worse than no
 * reminder at all.
 */
export async function cancelTrialNotification(): Promise<void> {
  const id = getMeta(KEYS.scheduledId);
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired, already gone, or the OS forgot it. Nothing to recover.
  }
  setMeta(KEYS.scheduledId, null);
}
