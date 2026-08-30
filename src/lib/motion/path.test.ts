import assert from 'node:assert/strict';
import { test } from 'node:test';

import { monotonePathD, pathUpperBound, pointFractions, type P } from './path.ts';

/** Parse the path back into its cubic segments, so the tests measure the curve
 * that will actually be drawn rather than the intent behind it. */
function segments(d: string): { p0: P; c1: P; c2: P; p1: P }[] {
  const nums = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const out: { p0: P; c1: P; c2: P; p1: P }[] = [];
  let cur: P = { x: nums[0]!, y: nums[1]! };
  for (let i = 2; i + 5 < nums.length + 1; i += 6) {
    const c1 = { x: nums[i]!, y: nums[i + 1]! };
    const c2 = { x: nums[i + 2]!, y: nums[i + 3]! };
    const p1 = { x: nums[i + 4]!, y: nums[i + 5]! };
    out.push({ p0: cur, c1, c2, p1 });
    cur = p1;
  }
  return out;
}

const at = (s: { p0: P; c1: P; c2: P; p1: P }, t: number) => {
  const u = 1 - t;
  return {
    x: u ** 3 * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t ** 3 * s.p1.x,
    y: u ** 3 * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t ** 3 * s.p1.y,
  };
};

const pts = (ys: number[]): P[] => ys.map((y, i) => ({ x: i * 30, y }));

/** The whole reason this file is not a Catmull-Rom. */
function assertNoOvershoot(ys: number[]) {
  const points = pts(ys);
  for (const s of segments(monotonePathD(points))) {
    const lo = Math.min(s.p0.y, s.p1.y) - 1e-6;
    const hi = Math.max(s.p0.y, s.p1.y) + 1e-6;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const { y } = at(s, t);
      assert.ok(
        y >= lo && y <= hi,
        `overshoot: between ${s.p0.y} and ${s.p1.y} the curve reached ${y.toFixed(3)}`,
      );
    }
  }
}

test('the curve never leaves the band between the two points it joins', () => {
  assertNoOvershoot([100, 105, 102, 118, 117, 130, 128]); // the shape of a real lift
  assertNoOvershoot([60, 60, 62.5, 62.5, 65, 70, 68, 68, 72]);
  assertNoOvershoot([100, 100, 100, 100]); // a plateau stays flat
  assertNoOvershoot([140, 120, 100, 80]); // a deload only falls
  assertNoOvershoot([80, 200, 81, 199, 82]); // a saw-tooth is the hard case
});

test('a rising run only rises — no dip between two increasing sessions', () => {
  // SVG y grows downward, so a rising lift is a falling y. Either way: monotone.
  for (const s of segments(monotonePathD(pts([100, 110, 130, 131, 160])))) {
    let prev = s.p0.y;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const { y } = at(s, t);
      assert.ok(y >= prev - 1e-6, `the curve dipped inside a rising segment (${y} < ${prev})`);
      prev = y;
    }
  }
});

test('the curve passes exactly through every recorded session', () => {
  const ys = [100, 107.5, 105, 120];
  const points = pts(ys);
  const segs = segments(monotonePathD(points));
  assert.equal(segs.length, ys.length - 1);
  segs.forEach((s, i) => {
    assert.ok(Math.abs(at(s, 0).y - points[i]!.y) < 0.01, 'segment start left the data');
    assert.ok(Math.abs(at(s, 1).y - points[i + 1]!.y) < 0.01, 'segment end left the data');
  });
});

test('two points draw a straight line — a curve between two points is invention', () => {
  const d = monotonePathD(pts([100, 120]));
  assert.ok(d.includes('L'), `two points should not be a cubic: ${d}`);
  assert.ok(!d.includes('C'));
});

test('degenerate input never produces a broken path', () => {
  assert.equal(monotonePathD([]), '');
  assert.equal(monotonePathD([{ x: 0, y: 5 }]), 'M 0 5');
  // Every session on the same day: zero-width, must not divide by zero.
  const d = monotonePathD([
    { x: 0, y: 10 },
    { x: 0, y: 20 },
    { x: 0, y: 30 },
  ]);
  assert.ok(!d.includes('NaN'), d);
  assert.ok(!d.includes('Infinity'), d);
});

test('the dash length is an UPPER bound — a short one leaves the line half-drawn', () => {
  for (const ys of [[100, 130, 105, 160], [10, 20], [50, 55, 52, 58, 51, 60]]) {
    const points = pts(ys);
    const bound = pathUpperBound(points);
    // Measure the real arc length by dense sampling. A two-point series draws
    // `L`, not `C`, so it has no cubic segments to sample — measure the chord.
    const d = monotonePathD(points);
    let arc = 0;
    if (!d.includes('C')) {
      arc = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
    }
    for (const s of segments(d)) {
      let prev = at(s, 0);
      for (let t = 0.005; t <= 1.0001; t += 0.005) {
        const cur = at(s, t);
        arc += Math.hypot(cur.x - prev.x, cur.y - prev.y);
        prev = cur;
      }
    }
    assert.ok(bound >= arc - 1e-6, `bound ${bound} is under the true arc ${arc}`);
    assert.ok(bound < arc * 1.5, `bound ${bound} is wastefully loose against ${arc}`);
  }
  assert.ok(pathUpperBound([]) >= 1, 'an empty path must never yield 0 — it divides');
});

test('point fractions run 0 → 1 in order, so each dot lands as the pen reaches it', () => {
  const f = pointFractions(pts([100, 110, 105, 130, 128]));
  assert.equal(f.length, 5);
  assert.equal(f[0], 0);
  assert.equal(f[f.length - 1], 1);
  for (let i = 1; i < f.length; i += 1) assert.ok(f[i]! > f[i - 1]!, 'fractions must increase');
  assert.deepEqual(pointFractions([]), []);
  assert.deepEqual(pointFractions([{ x: 0, y: 0 }]), [0]);
  assert.deepEqual(pointFractions(pts([1, 2])), [0, 1]);
});
