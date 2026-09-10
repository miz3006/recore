import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LiftSession } from './progression.ts';
import {
  buildPeriod,
  changePercent,
  metricOf,
  splitShares,
  totalsOf,
  WEEK_DAYS,
} from './progress-summary.ts';

const s = (day: string, key: string, volume: number): LiftSession => ({
  key,
  canonical: key,
  workoutId: `${day}-${key}`,
  day,
  topWeight: null,
  topReps: null,
  e1rm: null,
  volume,
});

// --- totals ------------------------------------------------------------------

test('totals: days and lifts are DISTINCT, volume is summed', () => {
  const rows = [
    s('2026-09-01', 'bench', 1000),
    s('2026-09-01', 'row', 500), // same day, second lift
    s('2026-09-03', 'bench', 1200), // same lift, second day
  ];
  assert.deepEqual(totalsOf(rows, '2026-09-01', '2026-09-09'), {
    volume: 2700,
    sessions: 2,
    lifts: 2,
  });
});

test('totals: the window is inclusive at both ends and excludes outside it', () => {
  const rows = [
    s('2026-08-31', 'bench', 100),
    s('2026-09-01', 'bench', 200),
    s('2026-09-09', 'bench', 400),
    s('2026-09-10', 'bench', 800),
  ];
  assert.equal(totalsOf(rows, '2026-09-01', '2026-09-09').volume, 600);
});

// --- buckets -----------------------------------------------------------------

test('weeks: every bucket is WEEK_DAYS long and the last one ends on the end day', () => {
  const p = buildPeriod([], '2026-09-09', 8);
  assert.equal(p.weeks.length, 8);
  assert.equal(p.weeks[7]!.end, '2026-09-09');
  assert.equal(p.weeks[7]!.start, '2026-09-03');
  assert.equal(p.weeks[0]!.start, p.from);
  assert.equal(p.from, '2026-07-16'); // 56 days ending 9 Sep, inclusive
  for (const w of p.weeks) {
    const [ys, ms, ds] = w.start.split('-').map(Number);
    const [ye, me, de] = w.end.split('-').map(Number);
    const days =
      (Date.UTC(ye!, me! - 1, de!) - Date.UTC(ys!, ms! - 1, ds!)) / 86_400_000 + 1;
    assert.equal(days, WEEK_DAYS);
  }
});

test('weeks: a week with no training keeps its slot as a real zero', () => {
  const p = buildPeriod([s('2026-09-09', 'bench', 900)], '2026-09-09', 8);
  assert.equal(p.weeks.length, 8);
  assert.equal(p.weeks[7]!.volume, 900);
  assert.equal(p.weeks[6]!.volume, 0);
  assert.equal(p.weeks[6]!.sessions, 0);
});

test('weeks: buckets do not overlap — one session lands in exactly one', () => {
  const rows = [s('2026-08-20', 'bench', 500)];
  const p = buildPeriod(rows, '2026-09-09', 8);
  assert.equal(p.weeks.filter((w) => w.sessions > 0).length, 1);
});

test('window lifts are distinct ACROSS weeks, never the sum of the weekly counts', () => {
  const rows = [
    s('2026-09-01', 'bench', 100),
    s('2026-09-08', 'bench', 100), // the following week, same lift
  ];
  const p = buildPeriod(rows, '2026-09-09', 8);
  assert.equal(p.now.lifts, 1);
  assert.equal(
    p.weeks.reduce((n, w) => n + w.lifts, 0),
    2,
  );
});

// --- the comparison ----------------------------------------------------------

test('before: null when the record does not reach into the earlier window', () => {
  const p = buildPeriod([s('2026-09-01', 'bench', 100)], '2026-09-09', 8);
  assert.equal(p.before, null);
});

test('before: measured when the record does reach back', () => {
  const rows = [
    s('2026-06-01', 'bench', 400), // inside the previous 8 weeks
    s('2026-09-01', 'bench', 600),
  ];
  const p = buildPeriod(rows, '2026-09-09', 8);
  assert.ok(p.before);
  assert.equal(p.before!.volume, 400);
  assert.equal(p.now.volume, 600);
  assert.equal(changePercent(p.now.volume, p.before!.volume), 50);
});

test('changePercent: refuses to divide by nothing', () => {
  assert.equal(changePercent(500, 0), null);
  assert.equal(changePercent(0, 0), null);
  assert.equal(changePercent(90, 100), -10);
  assert.equal(changePercent(100, 100), 0);
});

test('metricOf reads the named series', () => {
  const t = { volume: 1000, sessions: 3, lifts: 5 };
  assert.equal(metricOf(t, 'volume'), 1000);
  assert.equal(metricOf(t, 'sessions'), 3);
  assert.equal(metricOf(t, 'lifts'), 5);
});

// --- the split ---------------------------------------------------------------

test('splitShares: shares are of training days and sum to one', () => {
  const out = splitShares([
    { id: 0, name: 'Bench press', sessions: 6 },
    { id: 1, name: 'Squat', sessions: 2 },
  ]);
  assert.equal(out[0]!.share, 0.75);
  assert.equal(out[1]!.share, 0.25);
  assert.equal(out.reduce((n, g) => n + g.share, 0), 1);
});

test('splitShares: nothing recorded means no strip, not a division by zero', () => {
  assert.deepEqual(splitShares([{ id: 0, name: 'Bench press', sessions: 0 }]), []);
});
