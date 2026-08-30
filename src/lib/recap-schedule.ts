// Relative + .ts extensions: pure date arithmetic, bundled by Metro AND run
// under `node --test`. Nothing here reads the database or expo-notifications.
import { mondayOf } from './activity.ts';
import { dayKeyFor, shiftDayKey, type DayKey } from './db/dates.ts';
import type { RecapDay } from './prefs.ts';

/**
 * WHEN THE WEEKLY RECAP FIRES, AND WHICH WEEK IT IS ABOUT.
 *
 * Split out of `recap.ts` on 28 August 2026, when the v2 onboarding became the
 * primary flow and its recap screen's second answer — "Monday morning" — had to
 * start meaning something. Two questions come with that answer and both are
 * arithmetic, so both are here where `node --test` can reach them:
 *
 *  1. the next date at which the notice should fire, and
 *  2. **which week it is reporting**, which is not the same for the two days.
 *     A Sunday-evening notice closes the week it lands in; a Monday-morning one
 *     is the first thing you read about the week that ended the night before.
 *     Reporting "this week" on a Monday at 08:00 would mean reporting a week
 *     that is eight hours old, which is not a recap of anything.
 */

/** getDay(): 0 = Sunday, 1 = Monday. */
const WEEKDAY: Record<RecapDay, number> = { sun: 0, mon: 1 };

/**
 * The next occurrence of the recap day at the chosen hour — today, if today is
 * that day and the hour is still ahead.
 */
export function nextRecapDate(hour: number, day: RecapDay, now = new Date()): Date {
  const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0);
  fire.setDate(fire.getDate() + ((WEEKDAY[day] - now.getDay() + 7) % 7));
  if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 7);
  return fire;
}

/**
 * The Monday-first week a notice fired on `fireKey` is reporting.
 *
 * Sunday: the week the notice lands in, up to the notice itself. Monday: the
 * whole week before it, Monday to Sunday.
 */
export function recapWindow(fireKey: DayKey, day: RecapDay): { from: DayKey; to: DayKey } {
  const monday = mondayOf(fireKey);
  if (day === 'mon') {
    return { from: shiftDayKey(monday, -7), to: shiftDayKey(monday, -1) };
  }
  return { from: monday, to: fireKey };
}

/**
 * The same window, clamped to what the record can actually know.
 *
 * The body of a local notification is fixed when it is scheduled, so it is
 * computed for a week that has not finished — and, on the evening the week
 * turns over, for one that has not started. Counting into the future would
 * report a zero as a fact; clamping reports what is true right now, and
 * `refreshRecapNotification` recomputes it on every Today open and every
 * finished session, so the last word before it fires is the current one.
 *
 * `null` when the window has not begun: nothing to count yet, and the caller
 * says so in words rather than printing a zero.
 */
export function knowableWindow(
  fireDate: Date,
  day: RecapDay,
  today: DayKey,
): { from: DayKey; to: DayKey } | null {
  const { from, to } = recapWindow(dayKeyFor(fireDate), day);
  if (from > today) return null;
  return { from, to: to > today ? today : to };
}
