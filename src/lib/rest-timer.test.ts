import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fmtClock, REST_EXTEND_S, restProgress, useRestTimer } from './rest-timer.ts';

/**
 * The rest clock's arithmetic, which the ring and the bar both read.
 *
 * The one rule these hold to: **the arc and the digits are the same number.**
 * `restProgress` is the only place the fraction is computed, and `extend` moves
 * the end and the denominator together — a ring that reported a different
 * amount of time than the clock beside it would be the one thing a readout may
 * never do.
 */

function reset() {
  useRestTimer.getState().stop();
}

test('a fresh rest is a full ring and the length it was given', () => {
  reset();
  useRestTimer.getState().start(120);
  const s = useRestTimer.getState();
  assert.equal(s.remaining, 120);
  assert.equal(s.total, 120);
  assert.equal(restProgress(s.remaining, s.total), 0);
  assert.equal(s.source, 'manual');
  assert.equal(s.teach, false);
});

test('an automatic rest says so, and carries its one explanation', () => {
  reset();
  useRestTimer.getState().start(90, { source: 'auto', teach: true });
  assert.equal(useRestTimer.getState().source, 'auto');
  assert.equal(useRestTimer.getState().teach, true);
  useRestTimer.getState().taught();
  assert.equal(useRestTimer.getState().teach, false);
});

test('a set landing mid-rest RESTARTS it rather than being ignored', () => {
  reset();
  useRestTimer.getState().start(120);
  useRestTimer.getState().tick(41); // 79 s stood through
  assert.ok(restProgress(41, 120) > 0.6);

  // The set you just did is the one the next rest belongs to (Setgraph's
  // contract): starting again while running is a restart, not a no-op.
  useRestTimer.getState().start(120, { source: 'auto' });
  const s = useRestTimer.getState();
  assert.equal(s.remaining, 120);
  assert.equal(s.total, 120);
  assert.equal(restProgress(s.remaining, s.total), 0);
});

test('+30 s buys time on BOTH the clock and the ring, so they still agree', () => {
  reset();
  useRestTimer.getState().start(120);
  useRestTimer.getState().tick(30); // 90 stood through, ring at 0.75
  assert.equal(restProgress(useRestTimer.getState().remaining, useRestTimer.getState().total), 0.75);

  useRestTimer.getState().extend(REST_EXTEND_S);
  const s = useRestTimer.getState();
  assert.equal(s.remaining, 60);
  assert.equal(s.total, 150);
  // 90 of 150 stood through — the arc slid back by exactly the time bought,
  // it did not jump to a new scale.
  assert.equal(restProgress(s.remaining, s.total), 0.6);
});

test('+30 s is not a way to start a timer', () => {
  reset();
  useRestTimer.getState().extend(REST_EXTEND_S);
  assert.equal(useRestTimer.getState().endsAt, null);
  assert.equal(useRestTimer.getState().total, 0);
});

test('stopping clears the clock, the ring and the explanation together', () => {
  reset();
  useRestTimer.getState().start(120, { source: 'auto', teach: true });
  useRestTimer.getState().stop();
  const s = useRestTimer.getState();
  assert.equal(s.endsAt, null);
  assert.equal(s.remaining, 0);
  assert.equal(s.total, 0);
  assert.equal(s.teach, false);
});

test('progress is clamped, so a stale tick cannot overrun the arc', () => {
  assert.equal(restProgress(0, 0), 0); // nothing running — no denominator
  assert.equal(restProgress(-5, 120), 1); // a tick that arrived late
  assert.equal(restProgress(200, 120), 0); // a tick from a longer rest
});

test('the clock prints one way, zero-padded', () => {
  assert.equal(fmtClock(161), '2:41');
  assert.equal(fmtClock(60), '1:00');
  assert.equal(fmtClock(9), '0:09');
  assert.equal(fmtClock(0), '0:00');
});
