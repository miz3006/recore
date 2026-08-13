import * as Notifications from 'expo-notifications';

import { getMeta, setMeta } from '@/lib/db/index';
import { todayKey } from '@/lib/db/dates';
import { mondayOf } from '@/lib/db/stats';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { markRecapToggled } from '@/lib/funnel';
import { devLog } from '@/lib/log';
import { getRecapHour, isRecapEnabled, setRecapEnabled } from '@/lib/prefs';

/**
 * The §12.1 weekly recap notification — THE one recurring notification Recore
 * is allowed. Everything here follows the same law as the trial notice
 * (`billing/notifications.ts`): a notification is a courtesy, never load-
 * bearing, and every function swallows its own failure.
 *
 * THE RULES (§12.1):
 *  - At most one per week, on Sunday, at a user-visible and editable hour
 *    (You → Weekly recap). Off in one tap, off by default.
 *  - Content is factual and drawn from the person's own record: the sessions
 *    of the week that is ending. An empty week states a neutral fact — never
 *    guilt, never a streak warning, never "we miss you".
 *  - Permission is asked in context: on the first recap card, or when the
 *    person turns the row on in You. Never in onboarding (§5.1), never
 *    re-asked after a denial.
 *
 * HOW THE CONTENT STAYS TRUE with a locally scheduled notification (which is
 * static once scheduled): the pending notice is re-computed and re-scheduled
 * on every Today open and every finished session — and a session can only be
 * logged inside the app, so by the time Sunday's notice fires it carries the
 * numbers as of the last time the record changed.
 */
const KEYS = {
  asked: 'recap_notif_asked',
  scheduledId: 'recap_notif_id',
} as const;

function hasAsked(): boolean {
  return getMeta(KEYS.asked) === '1';
}

/**
 * Ask once, in context. Returns whether we ended up with permission — `false`
 * is a valid outcome, not an error. A system-level denial is permanent here:
 * `canAskAgain` is honoured and a local flag stops a re-ask across reinstalls
 * of the flow.
 */
export async function requestRecapNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain || hasAsked()) return false;

    setMeta(KEYS.asked, '1');
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return next.granted;
  } catch (err) {
    devLog('recap permission check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Sessions recorded in the week containing today (Monday-first). One logged
 * day is one session — that is the record's own unit. */
function sessionsThisWeek(userId: string): number {
  const monday = mondayOf(todayKey());
  const today = todayKey();
  let n = 0;
  for (const day of getLoggedDayKeys(userId)) {
    if (day >= monday && day <= today) n += 1;
  }
  return n;
}

/** The next Sunday at the chosen hour — today, if it is Sunday and the hour is
 * still ahead. */
function nextRecapDate(hour: number, now = new Date()): Date {
  const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  fire.setDate(fire.getDate() + ((7 - now.getDay()) % 7)); // getDay(): 0 = Sunday
  if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 7);
  return fire;
}

/**
 * Recompute and reschedule the pending recap — or clear it when the feature is
 * off. Cheap and idempotent: callers fire-and-forget it on Today open and on
 * every finished session.
 */
export async function refreshRecapNotification(userId: string): Promise<void> {
  try {
    if (!isRecapEnabled()) {
      await cancelRecapNotification();
      return;
    }
    if (!(await Notifications.getPermissionsAsync()).granted) return;

    const n = sessionsThisWeek(userId);
    const body =
      n > 0 ? `${n} ${n === 1 ? 'session' : 'sessions'} this week.` : 'No sessions recorded this week.';

    await cancelRecapNotification(); // never two
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Weekly recap', body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextRecapDate(getRecapHour()),
      },
    });
    setMeta(KEYS.scheduledId, id);
  } catch (err) {
    devLog('recap notification not scheduled:', err instanceof Error ? err.message : err);
  }
}

export async function cancelRecapNotification(): Promise<void> {
  const id = getMeta(KEYS.scheduledId);
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired, already gone, or the OS forgot it. Nothing to recover.
  }
  setMeta(KEYS.scheduledId, null);
}

/**
 * Turn the recap on: ask (in context) if needed, enable only when permission
 * actually exists — an "On" that can never fire would be a lie (§2) — and
 * schedule the first notice. Returns whether it is now on.
 */
export async function enableRecap(userId: string): Promise<boolean> {
  const granted = await requestRecapNotificationPermission();
  if (!granted) return false;
  const wasOn = isRecapEnabled();
  setRecapEnabled(true);
  if (!wasOn) markRecapToggled(true); // §13: recap enabled
  await refreshRecapNotification(userId);
  return true;
}

/** Off in one tap (§12.1): disable and drop the pending notice. */
export async function disableRecap(): Promise<void> {
  if (isRecapEnabled()) markRecapToggled(false); // §13: recap disabled
  setRecapEnabled(false);
  await cancelRecapNotification();
}
