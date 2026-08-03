import assert from 'node:assert/strict';
import { test } from 'node:test';

import { currentStreak, longestStreak } from './streak.ts';

// A real Mon/Wed/Fri week. 2026-07-27 is a Monday.
const MON = '2026-07-27';
const WED = '2026-07-29';
const FRI = '2026-07-31';

test('Mon/Wed/Fri reads 3, not 1 — a rest day never breaks it', () => {
  assert.equal(currentStreak([MON, WED, FRI], FRI), 3);
});

test('the streak survives today being a rest day', () => {
  // Trained Friday, today is Sunday. Still 3.
  assert.equal(currentStreak([MON, WED, FRI], '2026-08-02'), 3);
});

test('a two-week layoff reads 0', () => {
  assert.equal(currentStreak([MON, WED, FRI], '2026-08-14'), 0);
});

test('exactly a week between sessions still counts; eight days does not', () => {
  assert.equal(currentStreak(['2026-07-20', '2026-07-27'], '2026-07-27'), 2);
  assert.equal(currentStreak(['2026-07-19', '2026-07-27'], '2026-07-27'), 1);
});

test('exactly a week since the last session still counts', () => {
  assert.equal(currentStreak([FRI], '2026-08-07'), 1);
  assert.equal(currentStreak([FRI], '2026-08-08'), 0);
});

test('a same-day double session counts once', () => {
  assert.equal(currentStreak([WED, WED, FRI, FRI], FRI), 2);
});

test('no history is 0, not a crash', () => {
  assert.equal(currentStreak([], FRI), 0);
  assert.equal(longestStreak([]), 0);
});

test('days in the future are ignored rather than counted', () => {
  assert.equal(currentStreak([MON, WED, '2026-12-25'], WED), 2);
});

test('the streak walks back across a break in the middle of the log', () => {
  // …a solid block, three weeks off, then a fresh block ending today.
  const days = ['2026-06-01', '2026-06-03', '2026-06-05', '2026-07-27', '2026-07-29'];
  assert.equal(currentStreak(days, '2026-07-29'), 2);
});

test('longestStreak finds the best run anywhere, by the same rule', () => {
  const days = ['2026-06-01', '2026-06-03', '2026-06-05', '2026-06-08', '2026-07-27', '2026-07-29'];
  assert.equal(longestStreak(days), 4);
});

test('longestStreak counts a lone session as 1', () => {
  assert.equal(longestStreak([MON]), 1);
});
