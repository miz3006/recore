import * as Notifications from 'expo-notifications';

import { getMeta, setMeta } from '@/lib/db/index';
import { todayKey } from '@/lib/db/dates';
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { markRecapToggled } from '@/lib/funnel';
import { devLog } from '@/lib/log';
import { getRecapDay, getRecapHour, isRecapEnabled, setRecapEnabled } from '@/lib/prefs';
import { knowableWindow, nextRecapDate } from '@/lib/recap-schedule';

/**
 * The §12.1 weekly recap notification — THE one recurring notification Recore
 * is allowed. Everything here follows the same law as the trial notice
 * (`billing/notifications.ts`): a notification is a courtesy, never load-
 * bearing, and every function swallows its own failure.
 *
 * THE RULES (§12.1):
 *  - At most one per week, on the day and hour the person chose — Sunday
 *    evening by default, Monday morning if the onboarding recap screen was
 *    answered that way (28 Aug 2026), and the hour is editable in
 *    You → Weekly recap. Off in one tap, off by default.
 *  - Content is factual and drawn from the person's own record: the sessions
 *    of the week that is ending. An empty week states a neutral fact — never
 *    guilt, never a streak warning, never "we miss you".
 *  - Permission is asked IN CONTEXT, on a surface that has just explained what
 *    the message is for, and never re-asked after a denial. Three places do
 *    that: the recap screen of onboarding (owner, 23 Aug 2026 — see
 *    `requestRecapInOnboarding`), the first recap card, and the You row.
 *
 *    That first one reverses §5.1's "no permission prompt in onboarding". The
 *    owner's ruling: the recap screen shows the message, says what is in it and
 *    asks in the person's own words, and answering "yes, send it" to a question
 *    like that and then getting nothing until some later Sunday is the part
 *    that reads as a broken promise. The clause the rule protects — never ask
 *    before the reason is on the glass — is kept, because the reason IS the
 *    screen. Nothing else in the flow asks the OS for anything.
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

/**
 * Has the OS already been asked, whatever it answered? The recap card reads it
 * so it can stop offering something that can no longer be turned on: a denial
 * is permanent here (`canAskAgain` plus the local flag), so an offer after one
 * is a button whose only possible outcome is nothing happening.
 */
export function recapPermissionAsked(): boolean {
  return hasAsked();
}

/**
 * THE ONBOARDING ASK (owner, 23 Aug 2026).
 *
 * Called from the recap screen's Continue when the answer is "yes, send it": it
 * opens the real iOS prompt and, only when that prompt is granted, turns the
 * weekly recap ON. A denial leaves it off and is not an error — the intent is
 * still stored, You still carries the row, and nothing in the flow waits.
 *
 * It does NOT schedule anything, because there is no account yet: the first
 * Today open calls `refreshRecapNotification` with a real user id and the
 * pending notice is computed there, from the record as it stands.
 */
export async function requestRecapInOnboarding(): Promise<boolean> {
  const granted = await requestRecapNotificationPermission();
  if (!granted) return false;
  if (!isRecapEnabled()) {
    setRecapEnabled(true);
    markRecapToggled(true); // §13: recap enabled
  }
  return true;
}

/** Sessions recorded between two day keys, inclusive. One logged day is one
 * session — that is the record's own unit. */
function sessionsBetween(userId: string, from: string, to: string): number {
  let n = 0;
  for (const day of getLoggedDayKeys(userId)) {
    if (day >= from && day <= to) n += 1;
  }
  return n;
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

    /**
     * THE DAY IS AN ANSWER NOW (28 Aug 2026). The v2 onboarding's recap screen
     * asks for Sunday evening or Monday morning, and until it became the
     * primary flow this scheduler fired on Sunday whatever anybody chose.
     *
     * The day changes the WORDS as well as the date: a Monday-morning notice
     * arrives after the week it is about has closed, so it says "last week".
     * `knowableWindow` decides which days it counts and never counts forward
     * into a week that has not happened.
     */
    const day = getRecapDay();
    const fire = nextRecapDate(getRecapHour(), day);
    const window = knowableWindow(fire, day, todayKey());
    const period = day === 'mon' ? 'last week' : 'this week';
    const n = window ? sessionsBetween(userId, window.from, window.to) : 0;
    const body =
      window && n > 0
        ? `${n} ${n === 1 ? 'session' : 'sessions'} ${period}.`
        : `No sessions recorded ${period} yet.`;

    await cancelRecapNotification(); // never two
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Weekly recap', body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fire,
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
