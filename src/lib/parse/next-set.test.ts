import assert from 'node:assert/strict';
import { test } from 'node:test';

import { appendRepeatSet, repeatSetText, type RepeatableSet } from './next-set.ts';

const s = (over: Partial<RepeatableSet>): RepeatableSet => ({
  reps: null,
  weight_kg: null,
  rir: null,
  ...over,
});

test('the repeat is the LAST working set, in the reader’s own unit', () => {
  const working = [s({ reps: 8, weight_kg: 80 }), s({ reps: 6, weight_kg: 85 })];
  assert.equal(repeatSetText(working, 'kg'), '85kg x6');
  // 85 kg is 187.39 lb; the reader who thinks in pounds is written to in pounds
  // and the unit is spelled out, so the line can never be read as the wrong one.
  assert.equal(repeatSetText(working, 'lb'), '187.39lb x6');
});

test('bodyweight work repeats the reps alone — the pull-up case', () => {
  assert.equal(repeatSetText([s({ reps: 12 })], 'kg'), 'x12');
  assert.equal(appendRepeatSet('pull ups x12', [s({ reps: 12 })], 'kg'), 'pull ups x12, x12');
});

test('the RIR is NOT carried forward', () => {
  // Load and reps are a plan a body meets or does not; reps-in-reserve is a
  // judgement about a set nobody has done yet, and copying it forward would put
  // a feeling into the record that its author never had.
  assert.equal(repeatSetText([s({ reps: 8, weight_kg: 100, rir: 1 })], 'kg'), '100kg x8');
});

test('nothing to repeat → null, so the control is hidden rather than dead', () => {
  assert.equal(repeatSetText([], 'kg'), null);
  // A run or a hold: no reps, so the set-by-set shortcut does not apply and the
  // parser is never handed a line it would have to guess at.
  assert.equal(repeatSetText([s({ weight_kg: 40 })], 'kg'), null);
  assert.equal(repeatSetText([s({ reps: 0 })], 'kg'), null);
  assert.equal(appendRepeatSet('row 2000m 7:45', [s({ weight_kg: 40 })], 'kg'), null);
});

test('a rep-less last set falls back to the last set that HAS reps', () => {
  const working = [s({ reps: 10, weight_kg: 60 }), s({ weight_kg: 60 })];
  assert.equal(repeatSetText(working, 'kg'), '60kg x10');
});

test('the separator is a comma, and a line never gets two', () => {
  const one = [s({ reps: 5, weight_kg: 100 })];
  assert.equal(appendRepeatSet('bench 100kg x5', one, 'kg'), 'bench 100kg x5, 100kg x5');
  assert.equal(appendRepeatSet('bench 100kg x5, ', one, 'kg'), 'bench 100kg x5, 100kg x5');
  assert.equal(appendRepeatSet('bench 100kg x5  ', one, 'kg'), 'bench 100kg x5, 100kg x5');
});

test('an empty line has nothing to append to', () => {
  assert.equal(appendRepeatSet('   ', [s({ reps: 5 })], 'kg'), null);
});

test('a converted load never prints a database zero', () => {
  // 81.6466 kg is 180.00 lb — "180lb", not "180.0lb".
  assert.equal(repeatSetText([s({ reps: 3, weight_kg: 81.6466 })], 'lb'), '180lb x3');
});
