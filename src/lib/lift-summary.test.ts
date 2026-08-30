import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cadenceLine, heaviestLine, summarise, trendLine, type LiftPoint } from './lift-summary.ts';

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const p = (day: string, topWeight: number | null, topReps: number | null = 5): LiftPoint => ({
  day,
  topWeight,
  topReps,
});

const THREE = [p('2026-08-15', 77.5), p('2026-08-22', 80), p('2026-08-26', 82.5)];

test('it counts the sessions and the span', () => {
  const s = summarise(THREE);
  assert.equal(s.sessions, 3);
  assert.equal(s.firstDay, '2026-08-15');
  assert.equal(s.lastDay, '2026-08-26');
});

test('cadence is the MEDIAN gap, so one long break does not redefine it', () => {
  const s = summarise([p('2026-06-01', 70), p('2026-08-15', 77.5), p('2026-08-22', 80), p('2026-08-29', 82.5)]);
  assert.equal(s.cadenceDays, 7, 'two 7-day gaps and one 75-day one');
});

test('one session has no cadence — a rhythm cannot be read from one point', () => {
  assert.equal(summarise([p('2026-08-26', 80)]).cadenceDays, null);
});

test('the heaviest set keeps the day it was FIRST reached', () => {
  const s = summarise([p('2026-08-15', 82.5), p('2026-08-22', 80), p('2026-08-26', 82.5)]);
  assert.equal(s.heaviest?.kg, 82.5);
  assert.equal(s.heaviest?.day, '2026-08-15', 'the day it was earned, not the last time it was matched');
});

test('bodyweight work has no heaviest and no trend', () => {
  const s = summarise([p('2026-08-15', null, 10), p('2026-08-22', null, 12)]);
  assert.equal(s.heaviest, null);
  assert.equal(s.deltaKg, null);
});

test('the trend is latest minus earliest, and it can be negative', () => {
  assert.equal(summarise(THREE).deltaKg, 5);
  assert.equal(summarise([p('2026-08-15', 100), p('2026-08-26', 90)]).deltaKg, -10);
});

test('the working reps are the COMMONEST, never an average nobody did', () => {
  const s = summarise([p('2026-08-15', 80, 5), p('2026-08-22', 80, 5), p('2026-08-26', 80, 8)]);
  assert.equal(s.workingReps, 5, 'an average would say 6, which was never lifted');
});

test('unordered input is sorted before anything is read', () => {
  const s = summarise([THREE[2]!, THREE[0]!, THREE[1]!]);
  assert.equal(s.firstDay, '2026-08-15');
  assert.equal(s.deltaKg, 5);
});

test('an empty record summarises to silence, never to zeroes on screen', () => {
  const s = summarise([]);
  assert.equal(s.sessions, 0);
  assert.equal(cadenceLine(s, fmt), null);
  assert.equal(heaviestLine(s, fmt), null);
  assert.equal(trendLine(s, fmt), null);
});

// --- the lines ---------------------------------------------------------------

test('the cadence line counts times, span and rhythm', () => {
  assert.equal(cadenceLine(summarise(THREE), fmt), 'Trained 3 times over 11 days, about every 5.5 days.');
});

test('one session says once, and claims no rhythm', () => {
  assert.equal(cadenceLine(summarise([p('2026-08-26', 80)]), fmt), 'Trained once.');
});

test('a long span is stated in weeks', () => {
  const s = summarise([p('2026-06-20', 70), p('2026-08-26', 80)]);
  assert.match(cadenceLine(s, fmt)!, /over 10 weeks/);
});

test('the heaviest line names its reps and its day', () => {
  assert.equal(heaviestLine(summarise(THREE), fmt), 'Heaviest 82.5 kg × 5 on Wed 26 Aug.');
});

test('a lift that held its weight is not phrased as a failure', () => {
  const s = summarise([p('2026-08-15', 80), p('2026-08-26', 80)]);
  assert.equal(trendLine(s, fmt), 'Same top weight since Sat 15 Aug.');
});

test('down is stated as plainly as up — a deload is a decision', () => {
  const s = summarise([p('2026-08-15', 100), p('2026-08-26', 90)]);
  assert.equal(trendLine(s, fmt), 'Down 10 kg since Sat 15 Aug.');
});

test('up reads as up', () => {
  assert.equal(trendLine(summarise(THREE), fmt), 'Up 5 kg since Sat 15 Aug.');
});
