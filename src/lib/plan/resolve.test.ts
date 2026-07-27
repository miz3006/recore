import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  maskHasWeekday,
  resolveToday,
  toggleWeekday,
  weekdayMonFirst,
  type PlanDayLite,
} from './resolve.ts';

const day = (position: number, weekdayMask: number | null = null): PlanDayLite => ({
  id: `d${position}`,
  position,
  weekdayMask,
});

// Monday-first bit shorthands.
const MON = 1 << 0;
const TUE = 1 << 1;
const THU = 1 << 3;
const FRI = 1 << 4;
const SAT = 1 << 5;
const SUN = 1 << 6;

test('empty split resolves to null in both modes', () => {
  assert.equal(resolveToday([], 'rotation', 0, null), null);
  assert.equal(resolveToday([], 'weekday', 0, null), null);
});

test('rotation: null cursor starts at the lowest position', () => {
  const days = [day(2), day(0), day(1)];
  assert.equal(resolveToday(days, 'rotation', 3, null)?.id, 'd0');
});

test('rotation: advances to the next position after the cursor', () => {
  const days = [day(0), day(1), day(2)];
  assert.equal(resolveToday(days, 'rotation', 3, 0)?.id, 'd1');
  assert.equal(resolveToday(days, 'rotation', 3, 1)?.id, 'd2');
});

test('rotation: wraps from the last position back to the first', () => {
  const days = [day(0), day(1), day(2)];
  assert.equal(resolveToday(days, 'rotation', 3, 2)?.id, 'd0');
});

test('rotation: a deleted/gapped cursor still finds the next in cycle', () => {
  const days = [day(0), day(2), day(4)];
  assert.equal(resolveToday(days, 'rotation', 3, 1)?.id, 'd2', 'next strictly greater');
  assert.equal(resolveToday(days, 'rotation', 3, 5)?.id, 'd0', 'past the end wraps');
});

test('rotation: a missed calendar day never advances the cursor (caller holds it)', () => {
  // The resolver is stateless: same cursor in → same day out, regardless of
  // how many calendar days passed. The cycle only moves when the caller stamps
  // a new cursor on Finish.
  const days = [day(0), day(1)];
  assert.equal(resolveToday(days, 'rotation', 2, 0)?.id, 'd1');
  assert.equal(resolveToday(days, 'rotation', 5, 0)?.id, 'd1');
});

test('weekday: returns the day that owns today, else null (rest)', () => {
  const upper = day(0, MON | THU);
  const lower = day(1, TUE | FRI);
  assert.equal(resolveToday([upper, lower], 'weekday', 0, null)?.id, 'd0', 'Monday → Upper');
  assert.equal(resolveToday([upper, lower], 'weekday', 1, null)?.id, 'd1', 'Tuesday → Lower');
  assert.equal(resolveToday([upper, lower], 'weekday', 2, null), null, 'Wednesday → rest');
});

test('weekday: the cursor is ignored; the calendar decides', () => {
  const days = [day(0, SAT), day(1, SUN)];
  assert.equal(resolveToday(days, 'weekday', 5, 999)?.id, 'd0');
  assert.equal(resolveToday(days, 'weekday', 6, 999)?.id, 'd1');
});

test('weekdayMonFirst maps Monday to 0 and Sunday to 6', () => {
  // 2026-07-20 is a Monday (the day the light redesign shipped).
  assert.equal(weekdayMonFirst(new Date(2026, 6, 20)), 0);
  assert.equal(weekdayMonFirst(new Date(2026, 6, 26)), 6);
});

test('mask helpers set, test, and clear weekday bits', () => {
  let m = 0;
  m = toggleWeekday(m, 0);
  m = toggleWeekday(m, 3);
  assert.equal(maskHasWeekday(m, 0), true);
  assert.equal(maskHasWeekday(m, 3), true);
  assert.equal(maskHasWeekday(m, 1), false);
  m = toggleWeekday(m, 0);
  assert.equal(maskHasWeekday(m, 0), false, 'toggling again clears it');
  assert.equal(maskHasWeekday(null, 0), false, 'a null mask trains no day');
});
