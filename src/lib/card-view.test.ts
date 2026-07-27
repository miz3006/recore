import assert from 'node:assert/strict';
import { test } from 'node:test';

import { confidenceOf, describeSets, distanceText, pacePerKm, type CardSet } from './card-view.ts';

const set = (over: Partial<CardSet>): CardSet => ({
  kind: 'working',
  reps: null,
  weight_kg: null,
  distance_m: null,
  duration_s: null,
  parent: null,
  ...over,
});

test('identical sets collapse to `3 × 8` (§8.3)', () => {
  const view = describeSets([
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
  ]);
  assert.deepEqual(view.value, { kind: 'loaded', weight: 80, reps: '3 × 8' });
});

test('a varying rep sequence stays a sequence', () => {
  const view = describeSets([
    set({ reps: 8, weight_kg: 82.5 }),
    set({ reps: 8, weight_kg: 82.5 }),
    set({ reps: 7, weight_kg: 82.5 }),
  ]);
  assert.deepEqual(view.value, { kind: 'loaded', weight: 82.5, reps: '8 · 8 · 7' });
});

test('a pyramid keeps every set — collapsing here rewrites the session', () => {
  const view = describeSets([
    set({ reps: 10, weight_kg: 120 }),
    set({ reps: 15, weight_kg: 100 }),
    set({ reps: 8, weight_kg: 90 }),
  ]);
  assert.deepEqual(view.value, { kind: 'perSet', pairs: '120×10 · 100×15 · 90×8' });
});

test('bodyweight work reads as reps alone', () => {
  const view = describeSets([set({ reps: 10 }), set({ reps: 10 }), set({ reps: 10 })]);
  assert.deepEqual(view.value, { kind: 'bodyweight', reps: '3 × 10' });
});

test('warm-ups are shown quietly and never join the working sets', () => {
  const view = describeSets([
    set({ kind: 'warmup', reps: 5, weight_kg: 60 }),
    set({ reps: 8, weight_kg: 100 }),
    set({ reps: 8, weight_kg: 100 }),
  ]);
  assert.deepEqual(view.value, { kind: 'loaded', weight: 100, reps: '2 × 8' });
  assert.equal(view.warmups, '60 × 5');
});

test('a dropset renders as an arrow chain off its parent set', () => {
  const view = describeSets([
    set({ reps: 8, weight_kg: 80 }),
    set({ kind: 'drop', reps: 6, weight_kg: 60, parent: 0 }),
    set({ kind: 'drop', reps: 5, weight_kg: 40, parent: 0 }),
  ]);
  assert.deepEqual(view.value, { kind: 'loaded', weight: 80, reps: '8' });
  assert.deepEqual(view.drops, ['80 → 60 → 40']);
});

test('cardio reads distance, time and pace instead of a load', () => {
  const view = describeSets([set({ distance_m: 5000, duration_s: 1564 })], 'cardio');
  assert.deepEqual(view.value, { kind: 'cardio', parts: ['5.0 km', '26:04', '5:13 /km'] });
});

test('a carry reads as count × distance', () => {
  const view = describeSets(
    [set({ distance_m: 40 }), set({ distance_m: 40 }), set({ distance_m: 40 })],
    'carry',
  );
  assert.deepEqual(view.value, { kind: 'effort', text: '3 × 40 m' });
});

test('a hold reads as count × seconds', () => {
  const view = describeSets(
    [set({ duration_s: 60 }), set({ duration_s: 60 }), set({ duration_s: 60 })],
    'hold',
  );
  assert.deepEqual(view.value, { kind: 'effort', text: '3 × 60 s' });
});

test('an item with nothing countable produces no value row', () => {
  assert.equal(describeSets([]).value, null);
  assert.equal(describeSets([set({ kind: 'warmup', reps: 5, weight_kg: 40 })]).value, null);
});

test('distance switches unit at a kilometre', () => {
  assert.equal(distanceText(400), '400 m');
  assert.equal(distanceText(999), '999 m');
  assert.equal(distanceText(1000), '1.0 km');
  assert.equal(distanceText(5200), '5.2 km');
});

test('pace is silent rather than infinite when a leg is missing', () => {
  assert.equal(pacePerKm(0, 600), null);
  assert.equal(pacePerKm(5000, 0), null);
  assert.equal(pacePerKm(1000, 300), '5:00 /km');
});

test('the §6.4 ladder, including the absent case', () => {
  assert.equal(confidenceOf(0.95), 'high');
  assert.equal(confidenceOf(0.9), 'high');
  assert.equal(confidenceOf(0.7), 'medium');
  assert.equal(confidenceOf(0.6), 'medium');
  assert.equal(confidenceOf(0.45), 'low');
  assert.equal(confidenceOf(0.39), 'none');
  // Not yet measured (the field arrives in 2.3) is not the same as doubted.
  assert.equal(confidenceOf(null), 'high');
  assert.equal(confidenceOf(undefined), 'high');
});
