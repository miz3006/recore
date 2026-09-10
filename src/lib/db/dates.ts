/**
 * Day handling. A workout belongs to a LOCAL calendar day (gyms don't train in
 * UTC): `performed_at` is stored as the UTC instant of local noon on that day,
 * and every day-scoped query works on [local midnight, next local midnight).
 */
export type DayKey = string; // YYYY-MM-DD (local)

export function dayKeyFor(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): DayKey {
  return dayKeyFor(new Date());
}

export function shiftDayKey(key: DayKey, days: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  return dayKeyFor(new Date(y!, m! - 1, d! + days));
}

/**
 * Whole days from `from` to `to` (negative if `to` is earlier). Computed in UTC
 * on purpose: a local-time subtraction across a DST boundary is 23 or 25 hours
 * and would round to the wrong day exactly twice a year.
 */
export function daysBetween(from: DayKey, to: DayKey): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(ty!, tm! - 1, td!) - Date.UTC(fy!, fm! - 1, fd!)) / 86_400_000,
  );
}

/** UTC ISO range covering the local day — for lexicographic ISO comparison. */
export function dayRangeIso(key: DayKey): [string, string] {
  const [y, m, d] = key.split('-').map(Number);
  const start = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const end = new Date(y!, m! - 1, d! + 1, 0, 0, 0, 0);
  return [start.toISOString(), end.toISOString()];
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * "Fri 8 Aug" — a day named the way a lifter names it when they think back to
 * a session. The weekday is the half that does the work: "8 Aug" is a lookup,
 * "Fri" is a memory. Used wherever a comparison points at a specific past
 * session ("same as last · Fri 8 Aug") so "last" is never left to mean
 * "sometime before now".
 */
export function shortDayLabel(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return `${WEEKDAYS_SHORT[date.getDay()]} ${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`;
}

/**
 * "14 Jul" — a day with no weekday on it, for an AXIS rather than a memory.
 *
 * `shortDayLabel` above puts the weekday first because a past session is
 * remembered as "that Friday". A chart's axis is the opposite problem: the
 * label sits under a column in a row of eight, it is read as a position on a
 * timeline rather than as a day, and the weekday is three characters of noise
 * competing for width that Dynamic Type will want back.
 */
export function monthDayLabel(key: DayKey): string {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`;
}

/**
 * "Tuesday, 9 September" — the DATELINE under Today's title, and the only place
 * in the app a day is spelled out in full.
 *
 * The title above it carries the relative word ("Today", "Yesterday"), which is
 * the half a person navigates by; this is the half they need when the relative
 * word has stopped being enough — which day of the week was that, and what was
 * the date. Day One prints exactly this pair over a journal entry, and Apple
 * Notes prints the same thing one size down under a note's title.
 *
 * The year appears only when it is not the current one: a dateline that says
 * 2026 every day of 2026 is a field nobody reads.
 */
export function longDayLabel(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const year = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${WEEKDAYS_LONG[date.getDay()]}, ${d} ${MONTHS_LONG[(m ?? 1) - 1]}${year}`;
}

/** The stored performed_at instant for a day: local noon, expressed in UTC. */
export function performedAtIso(key: DayKey): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0, 0).toISOString();
}
