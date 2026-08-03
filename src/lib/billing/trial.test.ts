import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatChargeDate,
  REMINDER_LEAD_DAYS,
  shouldShowTrialReminder,
  trialClock,
  trialClockAt,
} from './trial.ts';

const DAY = 86_400_000;
const START = Date.UTC(2026, 6, 28, 9, 0, 0); // 28 Jul 2026, 09:00 UTC

test('the trial runs quietly until day 5', () => {
  for (const day of [0, 1, 2, 3, 4]) {
    const c = trialClock(START, START + day * DAY);
    assert.equal(c.phase, 'running', `day ${day}`);
    assert.equal(c.day, day);
  }
});

test('day 5 owes the reminder, and it is two days before the charge', () => {
  const c = trialClock(START, START + 5 * DAY);
  assert.equal(c.phase, 'reminder');
  assert.equal(c.daysUntilCharge, REMINDER_LEAD_DAYS); // exactly what §2.2 promises
});

test('day 6 still owes it — a missed day 5 is not a forfeited reminder', () => {
  assert.equal(trialClock(START, START + 6 * DAY).phase, 'reminder');
  assert.equal(trialClock(START, START + 6.5 * DAY).daysUntilCharge, 1);
});

test('the charge lands exactly 7×24h after the start', () => {
  assert.equal(trialClock(START, START).chargeAtMs, START + 7 * DAY);
  assert.equal(trialClock(START, START + 7 * DAY).phase, 'charged');
  assert.equal(trialClock(START, START + 7 * DAY).daysUntilCharge, 0);
  assert.equal(trialClock(START, START + 30 * DAY).daysUntilCharge, 0);
});

test('a clock skewed backwards never owes the reminder early', () => {
  const c = trialClock(START, START - 3 * DAY);
  assert.equal(c.day, 0);
  assert.equal(c.phase, 'running');
});

// --- the store's own instants ---------------------------------------------------

test('trialClockAt trusts the charge instant the store reported', () => {
  // A store that says the trial expires in three days outranks any local
  // "start plus seven" arithmetic.
  const c = trialClockAt(START, START + 3 * DAY, START);
  assert.equal(c.chargeAtMs, START + 3 * DAY);
  assert.equal(c.daysUntilCharge, 3);
  assert.equal(c.phase, 'running');
});

test('the reminder window follows the charge, not the day number', () => {
  // A trial of a different length still owes its reminder two days out, which
  // is the promise — "before the charge", never "on day five".
  const chargeAt = START + 3 * DAY;
  assert.equal(trialClockAt(START, chargeAt, START + 1 * DAY).phase, 'reminder');
  assert.equal(trialClockAt(START, chargeAt, START).phase, 'running');
  assert.equal(trialClockAt(START, chargeAt, START + 3 * DAY).phase, 'charged');
});

test('shouldShowTrialReminder: once, and only inside the window', () => {
  const inWindow = trialClock(START, START + 5 * DAY);
  assert.equal(shouldShowTrialReminder(inWindow, false), true);
  assert.equal(shouldShowTrialReminder(inWindow, true), false, 'already shown');
  assert.equal(shouldShowTrialReminder(trialClock(START, START + 2 * DAY), false), false, 'too early');
  assert.equal(shouldShowTrialReminder(trialClock(START, START + 8 * DAY), false), false, 'charged');
});

test('shouldShowTrialReminder: no trial means nothing to remind about', () => {
  assert.equal(shouldShowTrialReminder(null, false), false);
});

test('formatChargeDate reads as a date a human would say out loud', () => {
  assert.equal(formatChargeDate(new Date(2026, 7, 4).getTime()), '4 Aug 2026');
  assert.equal(formatChargeDate(new Date(2026, 11, 31).getTime()), '31 Dec 2026');
});
