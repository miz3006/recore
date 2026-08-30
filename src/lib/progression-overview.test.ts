import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildOverview, directionOf, DELTA_SUSPECT_RATIO } from './progression-overview.ts';
import type { LiftSession } from './progression.ts';

/** One (lift, workout) row. Workouts are shared by passing the same `w`. */
const r = (
  canonical: string,
  day: string,
  w: string,
  over: Partial<LiftSession> = {},
): LiftSession => ({
  key: canonical.toLowerCase(),
  canonical,
  workoutId: w,
  day,
  topWeight: 100,
  topReps: 5,
  e1rm: 116.5,
  volume: 1500,
  ...over,
});

/** A push/pull/legs rotation, three rounds — the case groups exist for. */
function ppl(): LiftSession[] {
  const rounds = [
    ['2026-08-01', '2026-08-03', '2026-08-05'],
    ['2026-08-08', '2026-08-10', '2026-08-12'],
    ['2026-08-15', '2026-08-17', '2026-08-19'],
  ];
  const out: LiftSession[] = [];
  rounds.forEach((days, i) => {
    out.push(r('Bench Press', days[0]!, `push${i}`), r('Overhead Press', days[0]!, `push${i}`));
    out.push(r('Barbell Row', days[1]!, `pull${i}`), r('Pull-up', days[1]!, `pull${i}`));
    out.push(r('Squat', days[2]!, `legs${i}`), r('Leg Curl', days[2]!, `legs${i}`));
  });
  return out;
}

test('groups come from what is trained together, not from an anatomy chart', () => {
  const v = buildOverview(ppl(), '2026-07-01');
  assert.equal(v.groups.length, 3, 'a three-way rotation should yield three groups');
  // Each group is named after a lift the person actually performed.
  const names = v.groups.map((g) => g.name).sort();
  const canonicals = new Set(ppl().map((x) => x.canonical));
  for (const n of names) {
    assert.ok(
      n.split(' · ').every((part) => canonicals.has(part)),
      `"${n}" is not made of the user's own lift names`,
    );
  }
  // Every lift lands in exactly one group.
  const assigned = v.groups.flatMap((g) => g.liftKeys);
  assert.equal(new Set(assigned).size, assigned.length, 'a lift is in two groups');
  assert.equal(assigned.length, 6);
});

test('the lifts of one group are the ones trained on that day', () => {
  const v = buildOverview(ppl(), '2026-07-01');
  const group = v.groups.find((g) => g.liftKeys.includes('bench press'))!;
  assert.deepEqual([...group.liftKeys].sort(), ['bench press', 'overhead press']);
  assert.equal(group.sessions, 3);
});

test('one repeating session is not a grouping, and the strip stays empty', () => {
  const rows = ['2026-08-01', '2026-08-08', '2026-08-15'].flatMap((d, i) => [
    r('Squat', d, `w${i}`),
    r('Bench Press', d, `w${i}`),
    r('Barbell Row', d, `w${i}`),
  ]);
  const v = buildOverview(rows, '2026-07-01');
  assert.deepEqual(v.groups, [], 'a full-body routine must not be split into fake groups');
  assert.equal(v.lifts.length, 3, 'the lifts are still all there');
  for (const l of v.lifts) assert.equal(l.groupId, 0);
});

test('two groups topped by the same lift are told apart by their second, never by a number', () => {
  // Two distinct squat days: one with front squats, one with leg press.
  const rows = [
    ...['2026-08-01', '2026-08-08', '2026-08-15'].flatMap((d, i) => [
      r('Squat', d, `a${i}`),
      r('Front Squat', d, `a${i}`),
    ]),
    ...['2026-08-04', '2026-08-11', '2026-08-18'].flatMap((d, i) => [
      r('Squat', d, `b${i}`),
      r('Leg Press', d, `b${i}`),
    ]),
  ];
  const v = buildOverview(rows, '2026-07-01');
  const names = v.groups.map((g) => g.name);
  assert.equal(new Set(names).size, names.length, `groups share a name: ${names.join(', ')}`);
  for (const n of names) assert.ok(!/\d/.test(n), `"${n}" names nothing`);
});

test('lifts are ordered by recency and carry their own sparkline', () => {
  const rows = [
    r('Squat', '2026-08-01', 'w1', { e1rm: 100 }),
    r('Bench Press', '2026-08-02', 'w2', { e1rm: 80 }),
    r('Squat', '2026-08-20', 'w3', { e1rm: 110 }),
  ];
  const v = buildOverview(rows, '2026-07-01');
  assert.deepEqual(v.lifts.map((l) => l.canonical), ['Squat', 'Bench Press']);
  assert.deepEqual(v.lifts[0]!.spark, [100, 110]);
  assert.equal(v.lifts[0]!.latest, 110);
  assert.equal(v.lifts[0]!.delta, 10);
  assert.equal(v.lifts[0]!.direction, 'up');
});

test('a session that carries no honest estimate is skipped, never zero-filled', () => {
  const v = buildOverview(
    [
      r('Pull-up', '2026-08-01', 'w1', { e1rm: null }),
      r('Pull-up', '2026-08-08', 'w2', { e1rm: null }),
    ],
    '2026-07-01',
  );
  assert.deepEqual(v.lifts[0]!.spark, []);
  assert.equal(v.lifts[0]!.latest, null);
  assert.equal(v.lifts[0]!.delta, null);
  assert.equal(v.lifts[0]!.direction, 'none');
  assert.equal(v.lifts[0]!.sessions, 2, 'the sessions still happened and are still counted');
});

test('one reading is not a move', () => {
  const v = buildOverview([r('Squat', '2026-08-01', 'w1', { e1rm: 100 })], '2026-07-01');
  assert.equal(v.lifts[0]!.latest, 100);
  assert.equal(v.lifts[0]!.delta, null);
  assert.equal(v.lifts[0]!.direction, 'none');
});

test('the window is respected and training days are counted once', () => {
  const rows = [
    r('Squat', '2026-05-01', 'old'),
    r('Squat', '2026-08-01', 'w1'),
    r('Bench Press', '2026-08-01', 'w1'),
    r('Squat', '2026-08-02', 'w2'),
  ];
  const v = buildOverview(rows, '2026-07-01');
  assert.equal(v.sessions, 2, 'two lifts on one day is one training day');
  assert.equal(v.lifts.find((l) => l.key === 'squat')!.sessions, 2, 'the May session is outside');
});

test('an empty record yields an empty, non-throwing view', () => {
  const v = buildOverview([], '2026-07-01');
  assert.deepEqual(v.lifts, []);
  assert.deepEqual(v.groups, []);
  assert.equal(v.sessions, 0);
});

test('directionOf never guesses', () => {
  assert.equal(directionOf(null), 'none');
  assert.equal(directionOf(0), 'flat');
  assert.equal(directionOf(2), 'up');
  assert.equal(directionOf(-2), 'down');
});

// --- the plateau, arrived from Next on 29 Aug 2026 ---------------------------

const lift = (day: string, w: string, over: Partial<LiftSession> = {}) =>
  r('Bench Press', day, w, over);

test('three sessions at one weight with flat reps reads as a plateau', () => {
  const v = buildOverview(
    [
      lift('2026-08-05', 'a', { topWeight: 100, topReps: 5 }),
      lift('2026-08-12', 'b', { topWeight: 100, topReps: 5 }),
      lift('2026-08-19', 'c', { topWeight: 100, topReps: 5 }),
    ],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.stalledAt, 100);
});

test('a rising rep count at one weight is progress, and no plateau is claimed', () => {
  const v = buildOverview(
    [
      lift('2026-08-05', 'a', { topWeight: 100, topReps: 5 }),
      lift('2026-08-12', 'b', { topWeight: 100, topReps: 6 }),
      lift('2026-08-19', 'c', { topWeight: 100, topReps: 8 }),
    ],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.stalledAt, null);
});

test('the plateau reads the whole history, so an eight-week window cannot hide one', () => {
  // The third-newest session predates the window; the lift is still stuck.
  const v = buildOverview(
    [
      lift('2026-05-01', 'a', { topWeight: 100, topReps: 5 }),
      lift('2026-08-12', 'b', { topWeight: 100, topReps: 5 }),
      lift('2026-08-19', 'c', { topWeight: 100, topReps: 5 }),
    ],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.stalledAt, 100, 'a display window must not change what is true');
});

// --- the trust guard, arrived with the delta it protects ---------------------

test('a believable delta is not flagged', () => {
  const v = buildOverview(
    [lift('2026-08-05', 'a', { e1rm: 133.5 }), lift('2026-08-19', 'b', { e1rm: 140 })],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.deltaSuspect, false);
  assert.equal(v.lifts[0]!.delta, 6.5);
});

test('the absurd +64 kg is flagged rather than printed', () => {
  const v = buildOverview(
    [lift('2026-08-05', 'a', { e1rm: 76 }), lift('2026-08-19', 'b', { e1rm: 140 })],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.deltaSuspect, true, 'a quarter of 140 is 35, and this claims 64');
  assert.equal(v.lifts[0]!.direction, 'up', 'the direction is still true and still shown');
});

test('the threshold is a quarter of the CURRENT estimate', () => {
  assert.equal(DELTA_SUSPECT_RATIO, 0.25);
  // Exactly a quarter is believed; a hair over is not.
  const at = buildOverview(
    [lift('2026-08-05', 'a', { e1rm: 75 }), lift('2026-08-19', 'b', { e1rm: 100 })],
    '2026-07-01',
  );
  assert.equal(at.lifts[0]!.deltaSuspect, false);
  const over = buildOverview(
    [lift('2026-08-05', 'a', { e1rm: 74 }), lift('2026-08-19', 'b', { e1rm: 100 })],
    '2026-07-01',
  );
  assert.equal(over.lifts[0]!.deltaSuspect, true);
});

test('a refused NEGATIVE trend still reads as falling', () => {
  const v = buildOverview(
    [lift('2026-08-05', 'a', { e1rm: 140 }), lift('2026-08-19', 'b', { e1rm: 76 })],
    '2026-07-01',
  );
  assert.equal(v.lifts[0]!.deltaSuspect, true);
  assert.equal(v.lifts[0]!.direction, 'down');
});

test('one reading is not a move, and nothing is flagged', () => {
  const v = buildOverview([lift('2026-08-19', 'a', { e1rm: 140 })], '2026-07-01');
  assert.equal(v.lifts[0]!.delta, null);
  assert.equal(v.lifts[0]!.deltaSuspect, false);
});
