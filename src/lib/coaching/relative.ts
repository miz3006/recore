/**
 * "Today", "Yesterday", "3 days ago", "12 Mar" — the one relative voice the
 * coaching screens speak, and nothing else in the app owns it.
 *
 * It is here rather than in `lib/db/dates.ts` because everything in there is
 * about the LOCAL record's day keys, and these are timestamps arriving from
 * another person's account. Deliberately plain: no "a while back", no nudge,
 * no guilt about a gap. A coach reading "9 days ago" is being told a fact.
 */
export function relativeDay(iso: string | null): string {
  if (!iso) return 'No sessions yet';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'No sessions yet';

  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(new Date(then))) / 86_400_000);

  if (days <= 0) return 'Trained today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** "Tuesday, 9 September" — a session's own date, spelled out. */
export function sessionDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * THE DAY, SHORT ENOUGH TO BE A TITLE — "Today", "Yesterday", "10 Sep".
 *
 * `sessionDate` above spells the day out, and a spelled-out day is the right
 * thing ON A PAGE and the wrong thing in a navigation bar: as a large title
 * "Thursday, 10 September" truncated to "Thursday, 10 Septemb…" on a 402 pt
 * screen (iOS 26.5 simulator, 11 September 2026).
 *
 * The app already answers this and the answer is not an abbreviation, it is a
 * division of labour: Today's bar says "Today" and the page under it carries
 * "Friday, 11 September" (`labelForDay` + `TodayDateline`). The coach's session
 * screen now does the same, so nothing is lost and nothing is cut.
 *
 * Not `labelForDay` itself: that takes a local `DayKey`, and these are
 * timestamps from another person's account — the reason this whole file exists.
 */
export function sessionDayTitle(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Session';

  const then = new Date(t);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  // The year only when it is not the current one — a date carrying "2026" every
  // time is noise on eleven months out of twelve.
  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
