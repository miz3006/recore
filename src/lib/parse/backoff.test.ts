import assert from 'node:assert/strict';
import { test } from 'node:test';

import { backoffMinutes, nextAttemptAt, type ParseFailureKind } from './backoff.ts';

test('a note that has not failed waits for nothing', () => {
  for (const kind of ['note', 'transient', 'throttled'] as ParseFailureKind[]) {
    assert.equal(backoffMinutes(0, kind), 0);
    assert.equal(backoffMinutes(-1, kind), 0);
  }
});

test('the wait grows, and stops growing at a day', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((n) => backoffMinutes(n)),
    [2, 10, 60, 360, 1440],
  );
  // It never gives up and it never exceeds a day — the two properties the
  // header argues for. A hundred failures is still one attempt per day, not
  // silence.
  for (const attempts of [6, 20, 500]) {
    assert.equal(backoffMinutes(attempts), 1440);
  }
});

test('an unreadable note is still the default, so an unnamed failure costs the least', () => {
  assert.equal(backoffMinutes(3), backoffMinutes(3, 'note'));
  assert.equal(nextAttemptAt(3, new Date(0)).getTime(), nextAttemptAt(3, new Date(0), 'note').getTime());
});

test('a service outage is capped at an hour, not a day', () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => backoffMinutes(n, 'transient')),
    [2, 10, 30, 60],
  );
  // The property that matters: however long the provider is down, a note comes
  // back within an hour of it returning — never the day the note ladder would
  // have imposed for a failure that was never about the note.
  for (const attempts of [5, 50, 5000]) {
    assert.equal(backoffMinutes(attempts, 'transient'), 60);
  }
});

test('a window is never re-asked inside the window', () => {
  // The server's own per-user window is ten minutes wide (RATE_LIMIT_WINDOW_
  // SECONDS = 600). Asking again sooner can only be refused again.
  assert.equal(backoffMinutes(1, 'throttled'), 10);
  assert.deepEqual(
    [1, 2, 3, 4].map((n) => backoffMinutes(n, 'throttled')),
    [10, 30, 120, 1440],
  );
  // A standing refusal — an entitlement that will not change — still settles at
  // one ask a day like any other.
  assert.equal(backoffMinutes(9, 'throttled'), 1440);
});

test('a full day of failures costs at most a handful of calls, not hundreds', () => {
  // The defect this replaced: every app open asked again. Twenty opens against
  // one unreadable note was twenty model calls. Walk the schedule forward over
  // 24 hours and count what the same note costs now.
  const start = new Date('2026-09-10T08:00:00.000Z');
  const dayEnd = start.getTime() + 24 * 60 * 60_000;

  let at = start;
  let attempts = 0;
  while (at.getTime() < dayEnd) {
    attempts += 1;
    at = nextAttemptAt(attempts, at);
  }
  assert.equal(attempts, 5);
});

test('a day-long outage costs about a day of hourly asks, and no more', () => {
  // The bound the outage ladder buys: it is still cheap (one ask an hour once
  // it has settled), and it is still TRYING, so the reading lands within the
  // hour after the provider comes back rather than the day.
  const start = new Date('2026-09-11T08:00:00.000Z');
  const dayEnd = start.getTime() + 24 * 60 * 60_000;

  let at = start;
  let attempts = 0;
  while (at.getTime() < dayEnd) {
    attempts += 1;
    at = nextAttemptAt(attempts, at, 'transient');
  }
  // 2 + 10 + 30 minutes to settle, then one an hour: 27 asks in 24 hours,
  // against the 5 the note ladder would have allowed and the ~20 app opens the
  // schedule was written to replace.
  assert.equal(attempts, 27);
});

test('the next attempt is scheduled from the moment it failed, not from a fixed epoch', () => {
  const first = nextAttemptAt(1, new Date('2026-09-10T08:00:00.000Z'));
  assert.equal(first.toISOString(), '2026-09-10T08:02:00.000Z');
  const later = nextAttemptAt(1, new Date('2026-09-10T20:00:00.000Z'));
  assert.equal(later.toISOString(), '2026-09-10T20:02:00.000Z');
});
