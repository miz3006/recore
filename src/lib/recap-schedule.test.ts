import assert from 'node:assert/strict';
import { test } from 'node:test';

import { knowableWindow, nextRecapDate, recapWindow } from './recap-schedule.ts';

// A Wednesday, 27 August 2026, mid-afternoon. Every case below is stated
// against it so the expected dates can be checked by eye.
const WED = new Date(2026, 7, 26, 15, 0, 0, 0); // Wed 26 Aug 2026

test('the Sunday recap fires on the coming Sunday at the chosen hour', () => {
  const fire = nextRecapDate(18, 'sun', WED);
  assert.equal(fire.getDay(), 0);
  assert.equal(fire.getDate(), 30); // Sun 30 Aug 2026
  assert.equal(fire.getHours(), 18);
});

test('the Monday recap fires on the coming Monday, not on Sunday', () => {
  const fire = nextRecapDate(8, 'mon', WED);
  assert.equal(fire.getDay(), 1);
  assert.equal(fire.getDate(), 31); // Mon 31 Aug 2026
  assert.equal(fire.getHours(), 8);
});

test('the day itself counts while the hour is still ahead, and rolls over once it is not', () => {
  const sundayNoon = new Date(2026, 7, 30, 12, 0, 0, 0);
  assert.equal(nextRecapDate(18, 'sun', sundayNoon).getDate(), 30);
  const sundayNight = new Date(2026, 7, 30, 21, 0, 0, 0);
  assert.equal(nextRecapDate(18, 'sun', sundayNight).getDate(), 6); // Sun 6 Sep
});

test('a Sunday notice reports the week it lands in; a Monday notice the week before it', () => {
  assert.deepEqual(recapWindow('2026-08-30', 'sun'), { from: '2026-08-24', to: '2026-08-30' });
  assert.deepEqual(recapWindow('2026-08-31', 'mon'), { from: '2026-08-24', to: '2026-08-30' });
});

test('the window never counts into the future', () => {
  // Scheduled Wednesday for Sunday: the week is under way, so it is counted as
  // far as today and no further.
  assert.deepEqual(knowableWindow(new Date(2026, 7, 30, 18), 'sun', '2026-08-26'), {
    from: '2026-08-24',
    to: '2026-08-26',
  });
});

test('a week that has not started yet is not reported as an empty one', () => {
  // Sunday evening, after the hour: the next Sunday notice is about a week that
  // begins tomorrow. There is nothing to count, and a zero would read as a fact.
  assert.equal(knowableWindow(new Date(2026, 8, 6, 18), 'sun', '2026-08-30'), null);
});
