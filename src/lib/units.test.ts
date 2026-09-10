import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  displayLoad,
  displayWeightText,
  sameDisplay,
  spokenUnit,
  toDisplayWeight,
  toKg,
  WEIGHT_STEP,
} from './units.ts';

test('kilograms pass through untouched for a kg user', () => {
  assert.equal(toDisplayWeight(102.1, 'kg'), 102.1);
  assert.equal(toKg(102.1, 'kg'), 102.1);
  assert.equal(displayWeightText(82.5, 'kg'), '82.5');
});

test('a lb user sees the pounds they wrote', () => {
  // The parser stores "225" (a plate number) as 102.06 kg — the sheet has to
  // show that back as the 225 they typed, not as an alien 102.
  assert.equal(displayWeightText(102.06, 'lb'), '225');
});

test('a pound round-trip lands back on the same kilograms', () => {
  // Two decimals of pounds is FINER than two decimals of kilograms (2.2 lb to
  // the kg), so display → edit → store cannot lose a hundredth. Coarser
  // display rounding could, which is what `sameDisplay` is insurance against.
  for (const kg of [20, 60.5, 82.5, 100, 102.06, 102.1, 137.75, 0.5]) {
    assert.equal(toKg(Number(displayWeightText(kg, 'lb')), 'lb'), kg, `${kg} kg`);
  }
});

test('an untouched field is recognised as untouched, whitespace and all', () => {
  const shown = displayWeightText(102.1, 'lb');
  assert.ok(sameDisplay(shown, ` ${shown} `));
  assert.ok(!sameDisplay(shown, '225'));
});

test('bodyweight has no number to show', () => {
  assert.equal(displayWeightText(null, 'kg'), '');
  assert.equal(displayWeightText(null, 'lb'), '');
});

test('the step is a plate pair in whichever unit is on screen', () => {
  assert.equal(WEIGHT_STEP, 2.5);
});

test('a reading is scannable, not precise to the hundredth', () => {
  // 140 kg is 308.647... lb. A column of readings printed to two decimals is
  // false precision on a number that is an estimate in the first place.
  assert.equal(displayLoad(140, 'lb'), 309);
  assert.equal(displayLoad(140, 'kg'), 140);
  // Kilograms keep the half-kilo grain the estimates are computed on.
  assert.equal(displayLoad(116.5, 'kg'), 116.5);
});

test('a delta converts like the load it is the difference of', () => {
  assert.equal(displayLoad(7.5, 'lb'), 17);
  assert.equal(displayLoad(-7.5, 'lb'), -17);
  assert.equal(displayLoad(0, 'lb'), 0);
});

test('the unit is spoken as a word, not as its letters', () => {
  assert.equal(spokenUnit('kg'), 'kilograms');
  assert.equal(spokenUnit('lb'), 'pounds');
});
