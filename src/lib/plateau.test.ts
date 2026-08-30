import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stalledWeight, STALL_SESSIONS, type TopSet } from './plateau.ts';

const s = (weight: number | null, reps: number | null): TopSet => ({ weight, reps });

test('three sessions at the same weight with flat reps is a plateau', () => {
  assert.equal(stalledWeight([s(100, 5), s(100, 5), s(100, 5)]), 100);
});

test('two is not enough — the engine deloads on three', () => {
  assert.equal(stalledWeight([s(100, 5), s(100, 5)]), null);
  assert.equal(STALL_SESSIONS, 3);
});

test('only the newest three are read, so older history cannot un-stick a lift', () => {
  assert.equal(stalledWeight([s(100, 5), s(100, 5), s(100, 5), s(80, 8), s(75, 8)]), 100);
});

test('a rising rep count at the same weight is double progression, not a stall', () => {
  // Newest first: 8 reps now, 6 before, 5 before that — climbing.
  assert.equal(stalledWeight([s(100, 8), s(100, 6), s(100, 5)]), null);
});

test('falling reps at the same weight IS a stall — both levers stopped', () => {
  assert.equal(stalledWeight([s(100, 5), s(100, 6), s(100, 8)]), 100);
});

test('a weight that moved at all is not a plateau', () => {
  assert.equal(stalledWeight([s(102.5, 5), s(100, 5), s(100, 5)]), null);
  assert.equal(stalledWeight([s(100, 5), s(100, 5), s(97.5, 5)]), null);
});

test('bodyweight and unloaded work have no weight to be stuck at', () => {
  assert.equal(stalledWeight([s(null, 10), s(null, 10), s(null, 10)]), null);
  assert.equal(stalledWeight([s(0, 10), s(0, 10), s(0, 10)]), null);
});

test('missing reps never read as improvement', () => {
  assert.equal(stalledWeight([s(100, null), s(100, null), s(100, null)]), 100);
  assert.equal(stalledWeight([s(100, 5), s(100, null), s(100, 5)]), 100);
});

test('an empty history says nothing', () => {
  assert.equal(stalledWeight([]), null);
});
