/**
 * HOW LONG A NOTE THAT WILL NOT READ WAITS BEFORE ASKING AGAIN.
 *
 * A PURE MODULE, and that is deliberate — the same reason `lib/csv-field.ts`
 * is one. The rule's only caller reaches SQLite through `db/index`, which
 * reaches `expo-sqlite`, which cannot be imported under `node --test`; a rule
 * that lives beside its caller is a rule with no test, and this one decides
 * how much money the project spends on a note nobody can read.
 *
 * ## What it is for
 *
 * `needs_parse` is a flag, not a memory: it says "this text has no reading".
 * Until 10 September 2026 that was the whole retry policy — every sync pass
 * took the newest five flagged notes and called the model again, and a sync
 * pass runs on every foreground. So a note the parser genuinely cannot read
 * asked again every single time the app was opened, for ever, and each ask is
 * a model call on the project owner's account. Twenty opens a day against five
 * such notes is a hundred calls a day that were never going to land.
 *
 * ## Why it never gives up
 *
 * A reading is the app's core promise (CLAUDE.md §2), so a note abandoned
 * after N tries is that promise quietly withdrawn — and a week-long provider
 * outage must not cost anybody their history. The wait is therefore BOUNDED,
 * not surrendered: it grows to a day and stays there. The worst a note the
 * parser cannot read can cost is one call a day rather than one per app open,
 * and it is still trying.
 *
 * ## WHAT FAILED IS NOT ALWAYS THE NOTE (11 September 2026)
 *
 * The schedule above was written for ONE failure — the parser read the line and
 * could not make sense of it — and then applied to every failure there is. On
 * 11 September the project's AI key stopped answering: `parse-workout` and
 * `explain-brief` both returned 502, for every note, for every account. Under a
 * single schedule that outage is indistinguishable from a note full of nonsense,
 * so five foregrounds put EVERY note the app has into a day-long wait — and the
 * day keeps running after the key comes back. The parser would have looked
 * broken for a day longer than it actually was.
 *
 * So the wait now depends on what the answer said about the note:
 *
 *  - **`note`** — the model ran and the reading was unusable: a refusal, an
 *    answer that failed validation, a schema mismatch. Asking again in a minute
 *    is the least likely thing to change it, and this is the case the original
 *    schedule was measured for. It keeps it, day and all.
 *  - **`transient`** — the service answered for itself, not for the note: 5xx,
 *    or a session the function would not accept. The note is fine and will read
 *    the moment the service does, so the wait is capped at an HOUR. That bound
 *    is the whole point: a provider outage costs at most an hour of staleness
 *    after it ends, instead of a day.
 *  - **`throttled`** — a window or an entitlement said no: 429, 402. Waiting
 *    less than the server's own ten-minute window cannot help, so it starts
 *    there; an entitlement that will not change climbs to a day like any other
 *    standing refusal.
 *
 * Two things this deliberately does NOT do. It does not give any of them a
 * separate counter — `parse_attempts` stays one number and the LAST failure
 * picks the ladder, because a second column is a migration and this is a
 * schedule, not an audit. And it does not touch the foreground: typing re-parses
 * immediately whatever the backoff says (`parse/client.ts` never reads it), so
 * no wait here can ever leave a person looking at a line the app refuses to
 * re-read.
 */

/** What the failure was about — the note, or the service answering for it. */
export type ParseFailureKind = 'note' | 'transient' | 'throttled';

const LADDERS: Record<ParseFailureKind, readonly number[]> = {
  note: [2, 10, 60, 360, 1440],
  transient: [2, 10, 30, 60],
  throttled: [10, 30, 120, 1440],
};

/**
 * The wait after `attempts` consecutive failed readings of one text, in
 * minutes. Zero for a note that has not failed; the last step for ever after.
 */
export function backoffMinutes(attempts: number, kind: ParseFailureKind = 'note'): number {
  if (attempts <= 0) return 0;
  const ladder = LADDERS[kind];
  const index = Math.min(attempts, ladder.length) - 1;
  return ladder[index]!;
}

/** The instant a note that has just failed for the `attempts`th time may be
 * asked again. `from` is passed in so the rule has no clock of its own. */
export function nextAttemptAt(
  attempts: number,
  from: Date,
  kind: ParseFailureKind = 'note',
): Date {
  return new Date(from.getTime() + backoffMinutes(attempts, kind) * 60_000);
}
