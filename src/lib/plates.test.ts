import assert from 'node:assert/strict';
import { test } from 'node:test';

import { plateLine, platesFor } from './plates.ts';

test('platesFor loads each side greedily, heaviest first', () => {
  assert.deepEqual(platesFor(100, 20)!.perSide, [25, 15]);
  assert.deepEqual(platesFor(82.5, 20)!.perSide, [25, 5, 1.25]);
  assert.deepEqual(platesFor(60, 20)!.perSide, [20]);
});

test('platesFor respects the smallest-plate floor and reports the remainder', () => {
  const b = platesFor(82.5, 20, 2.5)!;
  assert.deepEqual(b.perSide, [25, 5]);
  assert.equal(b.remainderKg, 2.5); // 1.25/side unloadable without 1.25s
});

test('platesFor: bar-only and below-bar targets', () => {
  assert.deepEqual(platesFor(20, 20)!.perSide, []);
  assert.equal(platesFor(15, 20), null);
});

test('plateLine phrases the breakdown in one quiet mono line', () => {
  assert.equal(plateLine(100, 20), '25 + 15 a side');
  assert.equal(plateLine(20, 20), 'just the bar (20 kg)');
  assert.equal(plateLine(82.5, 20, 2.5), '25 + 5 a side · 2.5 kg over');
  assert.equal(plateLine(15, 20), null);
});
