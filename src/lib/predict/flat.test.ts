import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  DEFAULT_GAP_DAYS,
  dueLifts,
  gapsOf,
  median,
  overdueScore,
  typicalSessionSize,
  type LiftCadence,
} from './flat.ts';

const lift = (key: string, since: number, gap: number | null): LiftCadence => ({ key, since, gap });

// --- the cadence -------------------------------------------------------------

test('the median is the middle, and the mean of the middle two when even', () => {
  assert.equal(median([7, 3, 5]), 5);
  assert.equal(median([2, 4, 6, 8]), 5);
  assert.equal(median([]), null);
});

test('gaps come from consecutive sessions, newest first', () => {
  // Done 2, 9 and 23 days ago → gaps of 7 and 14.
  assert.deepEqual(gapsOf([2, 9, 23]), [7, 14]);
});

test('two entries on one day are one session of that lift, not a zero gap', () => {
  assert.deepEqual(gapsOf([2, 2, 9]), [7]);
});

test('one session yields no gap at all', () => {
  assert.deepEqual(gapsOf([4]), []);
  assert.equal(median(gapsOf([4])), null);
});

// --- how overdue ------------------------------------------------------------

test('overdue is measured against the lift\'s OWN cadence, not raw days', () => {
  const press = lift('press', 10, 7); // weekly, ten days ago
  const deadlift = lift('deadlift', 14, 21); // three-weekly, a fortnight ago
  assert.ok(
    overdueScore(press) > overdueScore(deadlift),
    'the press is waiting even though the deadlift has the longer raw gap',
  );
});

test('a lift with no cadence yet falls back to a week, and is not dropped', () => {
  assert.equal(overdueScore(lift('new', 14, null)), 14 / DEFAULT_GAP_DAYS);
});

test('a nonsense gap never divides by zero or ranks negative', () => {
  assert.equal(overdueScore(lift('a', 7, 0)), 1);
  assert.equal(overdueScore(lift('b', 7, -3)), 1);
});

// --- the session -------------------------------------------------------------

test('the most overdue lifts come first', () => {
  const picked = dueLifts(
    [lift('a', 3, 7), lift('b', 21, 7), lift('c', 10, 7)],
    2,
  );
  assert.deepEqual(picked.map((l) => l.key), ['b', 'c']);
});

test('the session is only as long as it was asked to be', () => {
  const all = [lift('a', 9, 7), lift('b', 8, 7), lift('c', 7, 7), lift('d', 6, 7)];
  assert.equal(dueLifts(all, 2).length, 2);
  assert.deepEqual(dueLifts(all, 0), []);
});

test('the same record always produces the same session', () => {
  // Equal score AND equal days: the key breaks the tie, so two reads agree.
  const all = [lift('zercher', 7, 7), lift('anderson', 7, 7)];
  assert.deepEqual(dueLifts(all, 2).map((l) => l.key), ['anderson', 'zercher']);
});

test('between two equally overdue lifts, the longer-untouched one leads', () => {
  const picked = dueLifts([lift('a', 7, 7), lift('b', 21, 21)], 2);
  assert.deepEqual(picked.map((l) => l.key), ['b', 'a']);
});

test('nothing is gated out — ranking is arithmetic, a cutoff would be advice', () => {
  // Every lift was trained yesterday: none is "due", and all are still ranked.
  const picked = dueLifts([lift('a', 1, 7), lift('b', 1, 7), lift('c', 1, 7)], 3);
  assert.equal(picked.length, 3);
});

// --- how long a session is ---------------------------------------------------

test('the session length is the median of the athlete\'s own sessions', () => {
  assert.equal(typicalSessionSize([4, 5, 5, 6, 5]), 5);
});

test('one marathon session does not stretch every session after it', () => {
  assert.equal(typicalSessionSize([4, 4, 4, 14]), 4);
});

test('the length is clamped at both ends', () => {
  assert.equal(typicalSessionSize([20, 20, 20]), 8);
  assert.equal(typicalSessionSize([]), 1);
});
