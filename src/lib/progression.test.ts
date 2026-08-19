import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildProgression,
  daysBetween,
  describeDelta,
  describeStall,
  median,
  metricValue,
  MIN_SESSIONS_FOR_CARD,
  sortLifts,
  stallOf,
  STALL_RUN_MIN,
  trainingSpread,
  type LiftSession,
} from './progression.ts';

/** A session row with sane defaults; every test overrides only what it means. */
function s(partial: Partial<LiftSession> & { day: string }): LiftSession {
  return {
    key: 'bench press',
    canonical: 'Bench Press',
    workoutId: `w-${partial.day}`,
    topWeight: 100,
    topReps: 5,
    e1rm: 116.7,
    volume: 1500,
    ...partial,
  };
}

const FROM = '2026-06-01';

test('a lift under the session floor gets no card at all', () => {
  const rows = [s({ day: '2026-06-02' }), s({ day: '2026-06-09' })];
  assert.equal(MIN_SESSIONS_FOR_CARD, 3);
  assert.equal(buildProgression(rows, 'e1rm', FROM).lifts.length, 0);
});

test('a lift under the floor is still listed, never dropped from the screen', () => {
  const rows = [s({ day: '2026-06-02', e1rm: 110 }), s({ day: '2026-06-09', e1rm: 115 })];
  const view = buildProgression(rows, 'e1rm', FROM);
  assert.equal(view.belowFloor.length, 1);
  const [brief] = view.belowFloor;
  assert.ok(brief);
  assert.equal(brief.canonical, 'Bench Press');
  assert.equal(brief.sessions, 2);
  assert.equal(brief.latest, 115, 'the row carries the latest value, not the first');
  // A charted lift is never also listed as below the floor.
  assert.equal(view.counted, 0);
});

test('a charted lift never appears in the below-floor list', () => {
  const rows = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day) => s({ day }));
  assert.deepEqual(buildProgression(rows, 'e1rm', FROM).belowFloor, []);
});

test('three sessions in range is enough, and the series is oldest to newest', () => {
  const rows = [
    s({ day: '2026-06-16', e1rm: 120 }),
    s({ day: '2026-06-02', e1rm: 110 }),
    s({ day: '2026-06-09', e1rm: 115 }),
  ];
  const [lift] = buildProgression(rows, 'e1rm', FROM).lifts;
  assert.ok(lift);
  assert.deepEqual(
    lift.points.map((p) => p.value),
    [110, 115, 120],
  );
  assert.equal(lift.first, 110);
  assert.equal(lift.latest, 120);
  assert.equal(lift.delta, 10);
});

test('the all-time best comes from BEFORE the range, so an old PR still sets the bar', () => {
  const rows = [
    s({ day: '2025-01-05', e1rm: 140 }), // a PR from last year, outside the range
    s({ day: '2026-06-02', e1rm: 110 }),
    s({ day: '2026-06-09', e1rm: 115 }),
    s({ day: '2026-06-16', e1rm: 120 }),
  ];
  const [lift] = buildProgression(rows, 'e1rm', FROM).lifts;
  assert.ok(lift);
  assert.equal(lift.best, 140);
  assert.equal(lift.isBest, false);
  // The out-of-range session is the reference, never a plotted point.
  assert.equal(lift.points.length, 3);
});

test('the latest point being the all-time best is what earns the PR label', () => {
  const rows = [
    s({ day: '2026-06-02', e1rm: 110 }),
    s({ day: '2026-06-09', e1rm: 115 }),
    s({ day: '2026-06-16', e1rm: 125 }),
  ];
  const [lift] = buildProgression(rows, 'e1rm', FROM).lifts;
  assert.ok(lift);
  assert.equal(lift.isBest, true);
  assert.equal(lift.workoutId, 'w-2026-06-16', 'the card opens its LATEST session');
});

test('a null metric point is skipped, never zero-filled', () => {
  // Bodyweight dips: no weight, so `weight` has nothing to plot even though
  // there are four sessions.
  const rows = [
    s({ key: 'dips', canonical: 'Dips', day: '2026-06-02', topWeight: null }),
    s({ key: 'dips', canonical: 'Dips', day: '2026-06-09', topWeight: null }),
    s({ key: 'dips', canonical: 'Dips', day: '2026-06-16', topWeight: null }),
    s({ key: 'dips', canonical: 'Dips', day: '2026-06-23', topWeight: null }),
  ];
  assert.equal(buildProgression(rows, 'weight', FROM).lifts.length, 0);
});

test('lifts are ordered by most recently trained', () => {
  const bench = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day) => s({ day }));
  const squat = ['2026-06-03', '2026-06-10', '2026-06-20'].map((day) =>
    s({ key: 'back squat', canonical: 'Back Squat', day }),
  );
  const view = buildProgression([...bench, ...squat], 'e1rm', FROM);
  assert.deepEqual(
    view.lifts.map((l) => l.canonical),
    ['Back Squat', 'Bench Press'],
  );
});

test('the verdict counts only lifts that ended above where they started', () => {
  const up = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day, i) =>
    s({ day, e1rm: 110 + i * 5 }),
  );
  const flat = ['2026-06-03', '2026-06-10', '2026-06-17'].map((day) =>
    s({ key: 'ohp', canonical: 'Overhead Press', day, e1rm: 60 }),
  );
  const down = ['2026-06-04', '2026-06-11', '2026-06-18'].map((day, i) =>
    s({ key: 'row', canonical: 'Barbell Row', day, e1rm: 90 - i * 2 }),
  );
  const view = buildProgression([...up, ...flat, ...down], 'e1rm', FROM);
  assert.equal(view.counted, 3);
  assert.equal(view.improved, 1);
});

test('the summary splits the lifts into up, same, and down', () => {
  const up = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day, i) =>
    s({ day, e1rm: 100 + i * 5 }),
  );
  const flat = ['2026-06-03', '2026-06-10', '2026-06-17'].map((day) =>
    s({ key: 'ohp', canonical: 'Overhead Press', day, e1rm: 60 }),
  );
  const down = ['2026-06-04', '2026-06-11', '2026-06-18'].map((day, i) =>
    s({ key: 'row', canonical: 'Barbell Row', day, e1rm: 90 - i * 2 }),
  );
  const view = buildProgression([...up, ...flat, ...down], 'e1rm', FROM);
  assert.equal(view.improved, 1);
  assert.equal(view.unchanged, 1);
  assert.equal(view.declined, 1);
  // 10% up, 0%, and 4/90 down — the median lift is the flat one.
  assert.equal(view.medianPercent, 0);
});

test('a percentage is the move as a share of where the lift started', () => {
  const rows = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day, i) =>
    s({ day, e1rm: 100 + i * 10 }),
  );
  const [lift] = buildProgression(rows, 'e1rm', FROM).lifts;
  assert.ok(lift);
  assert.equal(lift.percent, 20);
  assert.equal(lift.firstDay, '2026-06-02');
});

test('a best set inside the range counts as a new best, an older one does not', () => {
  const inside = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day, i) =>
    s({ day, e1rm: 100 + i * 5 }),
  );
  assert.equal(buildProgression(inside, 'e1rm', FROM).newBests, 1);
  // The same range, but the bar was set last winter.
  const older = [s({ day: '2025-12-01', e1rm: 200 }), ...inside];
  assert.equal(buildProgression(older, 'e1rm', FROM).newBests, 0);
});

test('the gain sort ranks on the SHARE moved, so a light lift can outrank a heavy one', () => {
  // Overhead press: 40 → 48, +20%. Deadlift: 200 → 220, +10% (twice the kilos).
  const ohp = ['2026-06-02', '2026-06-09', '2026-06-16'].map((day, i) =>
    s({ key: 'ohp', canonical: 'Overhead Press', day, e1rm: 40 + i * 4 }),
  );
  const dl = ['2026-06-03', '2026-06-10', '2026-06-17'].map((day, i) =>
    s({ key: 'deadlift', canonical: 'Deadlift', day, e1rm: 200 + i * 10 }),
  );
  const view = buildProgression([...ohp, ...dl], 'e1rm', FROM);
  assert.deepEqual(
    sortLifts(view.lifts, 'gain').map((l) => l.canonical),
    ['Overhead Press', 'Deadlift'],
  );
  assert.deepEqual(
    sortLifts(view.lifts, 'recent').map((l) => l.canonical),
    ['Deadlift', 'Overhead Press'],
  );
  assert.deepEqual(
    sortLifts(view.lifts, 'name').map((l) => l.canonical),
    ['Deadlift', 'Overhead Press'],
  );
  // Sorting never mutates the view it was handed.
  assert.deepEqual(
    view.lifts.map((l) => l.canonical),
    ['Deadlift', 'Overhead Press'],
  );
});

test('median takes the middle of odd sets and the mean of the two middles of even ones', () => {
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('sessions in range count distinct DAYS, not exercise rows', () => {
  // One training day carrying three exercises is one session.
  const rows = [
    s({ day: '2026-06-02' }),
    s({ key: 'back squat', canonical: 'Back Squat', day: '2026-06-02' }),
    s({ key: 'row', canonical: 'Barbell Row', day: '2026-06-02' }),
    s({ day: '2026-06-09' }),
  ];
  assert.equal(buildProgression(rows, 'e1rm', FROM).sessions, 2);
});

test('sessions before the range are not counted', () => {
  const rows = [s({ day: '2026-05-01' }), s({ day: '2026-06-02' }), s({ day: '2026-06-09' })];
  assert.equal(buildProgression(rows, 'e1rm', FROM).sessions, 2);
});

test('trainingSpread reports the longest rest between two training days', () => {
  // Mon 1st, Wed 3rd, then a nine-day break to the 12th.
  const spread = trainingSpread(['2026-06-01', '2026-06-03', '2026-06-12']);
  assert.equal(spread.sessions, 3);
  assert.equal(spread.longestGapDays, 9);
});

test('trainingSpread has no gap to report from a single day', () => {
  assert.deepEqual(trainingSpread(['2026-06-01']), { sessions: 1, longestGapDays: null });
  assert.deepEqual(trainingSpread([]), { sessions: 0, longestGapDays: null });
});

test('daysBetween crosses a month and a year boundary', () => {
  assert.equal(daysBetween('2026-06-28', '2026-07-01'), 3);
  assert.equal(daysBetween('2025-12-30', '2026-01-02'), 3);
});

test('a delta is a word — never a bare sign, never a colour', () => {
  assert.equal(describeDelta(7.5, 'kg', 'May 26'), 'up 7.5 kg');
  assert.equal(describeDelta(-2.5, 'kg', 'May 26'), 'down 2.5 kg');
  assert.equal(describeDelta(0, 'kg', 'May 26'), 'same as May 26');
  // A deload never reaches the screen as a leading minus (CLAUDE.md §5.1).
  assert.ok(!describeDelta(-10, 'kg', 'May 26').startsWith('-'));
});

test('a unitless delta drops the trailing space', () => {
  assert.equal(describeDelta(3, '', 'May 26'), 'up 3');
});

test('metricValue reads the right column, and volume of zero is nothing to plot', () => {
  const row = s({ day: '2026-06-02', topWeight: 100, e1rm: 116.7, volume: 1500 });
  assert.equal(metricValue(row, 'weight'), 100);
  assert.equal(metricValue(row, 'e1rm'), 116.7);
  assert.equal(metricValue(row, 'volume'), 1500);
  assert.equal(metricValue(s({ day: '2026-06-02', volume: 0 }), 'volume'), null);
});

// --- the tail of a series (owner, 17 Aug 2026) --------------------------------

/** Points straight from values, one a week apart — `stallOf` only reads order. */
function pts(values: number[]) {
  return values.map((value, i) => ({ day: `2026-06-${String(i + 1).padStart(2, '0')}`, value }));
}

test('stallOf reads the LAST sessions, not the whole range', () => {
  // Up over the range, but the last two sessions dropped: both facts are true
  // and the screen shows both, so neither reading may swallow the other.
  assert.deepEqual(stallOf(pts([100, 120, 115, 110])), { kind: 'down', sessions: 2 });
  assert.deepEqual(stallOf(pts([100, 105, 110])), { kind: 'up', sessions: 0 });
  assert.deepEqual(stallOf(pts([40, 40, 40, 40])), { kind: 'flat', sessions: 4 });
  // A dip then a hold is a hold — the flat run is what the eye sees at the end.
  assert.deepEqual(stallOf(pts([50, 48, 48])), { kind: 'flat', sessions: 2 });
  // Too short to have a tail at all.
  assert.deepEqual(stallOf(pts([100])), { kind: 'up', sessions: 0 });
});

test('one lighter session is not a regression — "red only when truly regressing"', () => {
  assert.equal(STALL_RUN_MIN, 2);
  // One drop says nothing: the card keeps its session count and its ink.
  assert.equal(describeStall(stallOf(pts([100, 120, 118]))), null);
  assert.equal(describeStall(stallOf(pts([100, 110, 120]))), null);
  // Two drops is a trend, and it is spelled out in words beside the colour.
  assert.equal(describeStall(stallOf(pts([100, 120, 118, 115]))), 'down 2 sessions running');
  assert.equal(describeStall(stallOf(pts([40, 40, 40, 40]))), 'no change in 4 sessions');
});

test('a stall is never a signed number, so a colour is never its only carrier', () => {
  for (const values of [[100, 98, 96], [40, 40, 40], [100, 120, 130]]) {
    const note = describeStall(stallOf(pts(values)));
    if (note) assert.ok(!/[+\-−]/.test(note), `"${note}" must not carry a sign`);
  }
});

test('the Stalled ordering puts falling first, then held longest, then climbing', () => {
  const rows = [
    // falling hardest: 120 → 100 over the range, last two sessions down
    ...pts([120, 110, 100]).map((p) => s({ day: p.day, key: 'ohp', canonical: 'OHP', e1rm: p.value })),
    // held for four sessions
    ...pts([40, 40, 40, 40]).map((p) =>
      s({ day: p.day, key: 'incline', canonical: 'Incline', e1rm: p.value }),
    ),
    // held for three
    ...pts([70, 70, 70]).map((p) => s({ day: p.day, key: 'pulldown', canonical: 'Pulldown', e1rm: p.value })),
    // still climbing
    ...pts([90, 95, 101]).map((p) => s({ day: p.day, key: 'bench', canonical: 'Bench', e1rm: p.value })),
  ];
  const view = buildProgression(rows, 'e1rm', FROM);
  assert.equal(view.lifts.length, 4);
  assert.deepEqual(
    sortLifts(view.lifts, 'stalled').map((l) => l.canonical),
    ['OHP', 'Incline', 'Pulldown', 'Bench'],
  );
  // And it only RE-ORDERS: the same four lifts, none relabelled or dropped.
  assert.equal(sortLifts(view.lifts, 'stalled').length, view.lifts.length);
});
