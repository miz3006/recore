import * as Notifications from 'expo-notifications';

import { devLog } from '@/lib/log';

/**
 * THE REST-END ALERT — a local notification for the rest you are standing
 * through with the phone in your pocket (10 September 2026).
 *
 * The rest timer already fires a success haptic and flips the control to ink
 * when it lands, and both of those need the app to be on screen. Between two
 * heavy sets it usually is not: the phone goes in a pocket, or face-down on the
 * bench, and the one thing the timer exists to tell you is the one thing you
 * cannot see. That is the whole reason every tracker in this category ships
 * this, and it is why Setgraph asks for the permission on the same screen it
 * sets the rest length on.
 *
 * ## It never asks for anything
 *
 * §18 and `recap.ts` are explicit: notification permission is requested in
 * context, on a surface that has just explained what the message is for, and
 * this is not one of those surfaces — you are mid-set. So this schedules ONLY
 * when permission has ALREADY been granted (the weekly recap's own prompt, or
 * the trial-started sheet) and is a silent no-op otherwise. Nobody is ever
 * interrupted mid-workout by a permission dialog, and nobody has to grant
 * anything to use the timer.
 *
 * ## It is a courtesy, never load-bearing
 *
 * Same law as the recap: every function swallows its own failure, nothing
 * awaits it, and the timer is correct whether or not a notification exists.
 * The in-app haptic remains the primary signal.
 *
 * ## One at a time, and it never outlives its rest
 *
 * The id is held in memory rather than in the meta KV, deliberately: a rest is
 * a thing that lasts two minutes, and an id that survived a relaunch would only
 * ever be an id for a rest that no longer exists. Stopping, skipping, extending
 * or restarting all cancel first — the ONE case this must never do is fire
 * after you have already come back to the bar.
 */

/** The pending alert, or null. In memory on purpose — see the note above. */
let scheduledId: string | null = null;

/**
 * Ring at `endsAt`. Cancels any alert already pending, so a `+30 s` or a fresh
 * set moves the alert instead of stacking a second one.
 *
 * Fire-and-forget: callers do not await it and nothing branches on the result.
 */
export function scheduleRestAlert(endsAt: number): void {
  void (async () => {
    try {
      await cancelRestAlert();
      // Already past, or so close that the notification would land after the
      // haptic it is meant to stand in for. Not worth a system round trip.
      if (endsAt - Date.now() < MIN_LEAD_MS) return;
      if (!(await Notifications.getPermissionsAsync()).granted) return;

      scheduledId = await Notifications.scheduleNotificationAsync({
        // Dry, like everything printed beside a number: it reports that the
        // rest is over. It does not congratulate, hurry, or guess what is next
        // — the app does not know what the next set is and may not pretend to.
        content: { title: 'Rest is up', body: 'Next set.' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(endsAt),
        },
      });
    } catch (err) {
      devLog('rest alert not scheduled:', err instanceof Error ? err.message : err);
    }
  })();
}

/** Drop the pending alert. Safe to call when there is none. */
export async function cancelRestAlert(): Promise<void> {
  const id = scheduledId;
  scheduledId = null;
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired, already gone, or the OS forgot it. Nothing to recover.
  }
}

/** Below this, the notification would land on top of the haptic rather than
 * instead of it. */
const MIN_LEAD_MS = 2000;
