import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sessionDayTitle } from './relative.ts';

/** A fixed "now" — `Date.now()` in a test is a flake waiting for midnight. */
const NOW = new Date(2026, 8, 11, 14, 0, 0); // 11 September 2026, local

const at = (y: number, m: number, d: number) => new Date(y, m, d, 10, 0, 0).toISOString();

test('the recent days are named, not dated', () => {
  assert.equal(sessionDayTitle(at(2026, 8, 11), NOW), 'Today');
  assert.equal(sessionDayTitle(at(2026, 8, 10), NOW), 'Yesterday');
});

test('anything older is a short date, and short is the point', () => {
  // The defect this replaced: "Thursday, 10 September" truncated to
  // "Thursday, 10 Septemb…" as a large title. Nothing here may exceed a bar.
  const older = sessionDayTitle(at(2026, 8, 2), NOW);
  assert.ok(older.length <= 12, `too long for a title: ${older}`);
  assert.ok(!older.includes('September'), 'the month is abbreviated');
});

test('the year appears only when it is not this one', () => {
  assert.ok(!sessionDayTitle(at(2026, 0, 4), NOW).includes('2026'));
  assert.ok(sessionDayTitle(at(2025, 11, 30), NOW).includes('2025'));
});

test('a timestamp that is not one names the screen rather than printing junk', () => {
  assert.equal(sessionDayTitle('not a date', NOW), 'Session');
  assert.equal(sessionDayTitle('', NOW), 'Session');
});

test('a session earlier the same day is still Today', () => {
  // Days are compared at their START, so 06:00 and 23:00 are one day.
  assert.equal(sessionDayTitle(new Date(2026, 8, 11, 6, 0).toISOString(), NOW), 'Today');
  assert.equal(sessionDayTitle(new Date(2026, 8, 11, 23, 30).toISOString(), NOW), 'Today');
});
