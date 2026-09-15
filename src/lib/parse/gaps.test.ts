import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bareNotationLine, gapOfTable, gapOfUnreadLine } from './gaps.ts';
import { setTableOf, type SummarizableSet } from './summarize.ts';

const set = (over: Partial<SummarizableSet>): SummarizableSet => ({
  kind: 'working',
  reps: null,
  weight_kg: null,
  distance_m: null,
  duration_s: null,
  ...over,
});

test('bare set notation is recognised, prose and named lines are not', () => {
  // Continuation shapes — everything a set-by-set logger writes without
  // repeating the exercise name.
  for (const line of ['120 10', '100x8', 'x12', '80kg 8/7/6', '3x8 @8', '120,5kg x 5', '2x16 1x15', '4 serije po 10', 'bw x12']) {
    assert.equal(bareNotationLine(line), true, line);
  }
  // A named line, prose, a date header, an empty line — none of these are
  // orphan sets, whatever else they are.
  for (const line of ['bench 120', 'Bench Press', 'utrujen sem danes', 'push day', '', '   ', 'felt tired, 2 sad']) {
    assert.equal(bareNotationLine(line), false, line);
  }
});

test('a loaded set with no work is missing its reps — on any movement', () => {
  const table = setTableOf([set({ weight_kg: 120 })]);
  assert.equal(gapOfTable('Bench Press', table), 'reps');
  assert.equal(gapOfTable('Cable Fly', table), 'reps');
});

test('an unloaded reading is missing its weight only on a lift that cannot be unloaded', () => {
  const table = setTableOf([set({ reps: 12 })]);
  assert.equal(gapOfTable('Bench Press', table), 'weight');
  assert.equal(gapOfTable('Squat', table), 'weight');
  // Real unloaded work — never a gap.
  assert.equal(gapOfTable('Pull-up', table), null);
  assert.equal(gapOfTable('Dip', table), null);
  assert.equal(gapOfTable('Biceps Curl', table), null);
});

test('complete readings and unjudgeable ones are silent', () => {
  assert.equal(gapOfTable('Bench Press', setTableOf([set({ reps: 8, weight_kg: 80 })])), null);
  // A run has neither reps nor load and is complete as written.
  assert.equal(gapOfTable('Run', setTableOf([set({ distance_m: 5000 })])), null);
  // A drop set without reps is chained context, not counted work — no gap.
  assert.equal(
    gapOfTable('Bench Press', setTableOf([set({ reps: 8, weight_kg: 80 }), set({ kind: 'drop', weight_kg: 60, parent: 0 })])),
    null,
  );
  // A warm-up with a load and no reps is outside the counted record too.
  assert.equal(
    gapOfTable('Squat', setTableOf([set({ kind: 'warmup', weight_kg: 60 }), set({ reps: 5, weight_kg: 140 })])),
    null,
  );
});

test('mixed loads use the bw marker, which is not a missing weight', () => {
  // "bench 80x8, then one at bw" — the bw row is a statement, not a gap.
  const table = setTableOf([set({ reps: 8, weight_kg: 80 }), set({ reps: 12 })]);
  assert.equal(gapOfTable('Bench Press', table), null);
});

test('a settled line with no reading is described by what it is missing', () => {
  assert.equal(gapOfUnreadLine('120 10', false), 'no-exercise');
  assert.equal(gapOfUnreadLine('Bench Press', true), 'no-sets');
  assert.equal(gapOfUnreadLine('Bench Press 120', true), 'unread');
  // Prose stays a note — known to nobody, claimed as nothing.
  assert.equal(gapOfUnreadLine('utrujen sem danes', false), null);
  // Unknown words with digits: not provable, stays a note.
  assert.equal(gapOfUnreadLine('novi stroj 45 3x10', false), null);
});
