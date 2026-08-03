import assert from 'node:assert/strict';
import { test } from 'node:test';

import { effortToken, readEffort, setEffortOnLine } from './effort.ts';

test('the token is training notation, not app metadata', () => {
  assert.equal(effortToken('easy'), 'rpe 7');
  assert.equal(effortToken('moderate'), 'rpe 8');
  assert.equal(effortToken('hard'), 'rpe 9');
  assert.equal(effortToken('max'), 'rpe 10');
});

test('marking a line appends the token and leaves the words alone', () => {
  assert.equal(setEffortOnLine('bench 5x5 100kg', 'moderate'), 'bench 5x5 100kg rpe 8');
  assert.equal(setEffortOnLine('počepi 5x5 100', 'hard'), 'počepi 5x5 100 rpe 9');
});

test('re-marking replaces the token instead of stacking them', () => {
  const once = setEffortOnLine('bench 5x5 100kg', 'moderate');
  assert.equal(setEffortOnLine(once, 'max'), 'bench 5x5 100kg rpe 10');
});

test('it replaces a marker the user typed themselves, in their notation', () => {
  assert.equal(setEffortOnLine('deadlift 180x3 RPE9', 'easy'), 'deadlift 180x3 rpe 7');
  assert.equal(setEffortOnLine('bench 100x5 @8', 'max'), 'bench 100x5 rpe 10');
});

test('clearing removes the marker and nothing else', () => {
  assert.equal(setEffortOnLine('bench 5x5 100kg rpe 8', null), 'bench 5x5 100kg');
  assert.equal(setEffortOnLine('bench 100x5 @8', null), 'bench 100x5');
});

test('an empty line is never given a marker', () => {
  assert.equal(setEffortOnLine('', 'hard'), '');
  assert.equal(setEffortOnLine('   ', 'hard'), '');
});

test('readEffort finds both notations and rounds onto the scale', () => {
  assert.equal(readEffort('bench 5x5 100kg rpe 8'), 'moderate');
  assert.equal(readEffort('deadlift 180x3 RPE9'), 'hard');
  assert.equal(readEffort('bench 100x5 @10'), 'max');
  assert.equal(readEffort('bench 100x5 @8,5'), 'hard', 'decimal comma');
  assert.equal(readEffort('bench 100x5 @6'), 'easy', 'anything under 7 is still easy');
});

test('readEffort says nothing when the line carries no marker', () => {
  assert.equal(readEffort('bench 5x5 100kg'), null);
  assert.equal(readEffort(''), null);
});

// The bug this file did not catch: every case above wrote the RPE as one or two
// digits, so an `@` carrying a LOAD read as an effort and marking one stripped
// the weight back out of the line. "bench 5x5 @100kg" became "bench 5x5 0kg".
test('an @ carrying a load is a load, never an effort', () => {
  for (const line of [
    'bench 3x8 @80kg',
    'bench 5x5 @100kg',
    'squat 5x5 @100',
    'bench 3x8 @ 82.5 kg',
    'ohp 3x5 @40kg',
    'row 4x10 @ 60 kg',
    'bench 3x8 @8kg',
    'deadlift 5x3 @180lb',
  ]) {
    assert.equal(readEffort(line), null, line);
  }
});

test('marking effort never rewrites a load written with @', () => {
  assert.equal(setEffortOnLine('bench 5x5 @100kg', 'moderate'), 'bench 5x5 @100kg rpe 8');
  assert.equal(setEffortOnLine('bench 3x8 @80kg', 'hard'), 'bench 3x8 @80kg rpe 9');
  assert.equal(setEffortOnLine('squat 5x5 @100', 'max'), 'squat 5x5 @100 rpe 10');
  // …and re-marking still replaces only the marker, with the load left alone.
  const once = setEffortOnLine('bench 5x5 @100kg', 'moderate');
  assert.equal(setEffortOnLine(once, 'max'), 'bench 5x5 @100kg rpe 10');
  assert.equal(setEffortOnLine(once, null), 'bench 5x5 @100kg');
});

test('an @ carrying a real RPE is still read, next to a load', () => {
  assert.equal(readEffort('bench 5x5 100kg @8'), 'moderate');
  assert.equal(readEffort('bench 5x5 @100kg @8'), 'moderate', 'load first, effort second');
  assert.equal(readEffort('bench @8 100kg'), 'moderate', 'effort first, load second');
  assert.equal(readEffort('bench 5x5 100kg rpe 10'), 'max');
  assert.equal(readEffort('bench 5x5 100kg @7,5'), 'moderate', 'decimal comma, on the scale');
  // Only the marker is touched, whichever order they came in.
  assert.equal(setEffortOnLine('bench 5x5 @100kg @8', 'hard'), 'bench 5x5 @100kg rpe 9');
});

test('a round trip through the sheet is stable', () => {
  const line = 'incline bench 3x8 60kg';
  const marked = setEffortOnLine(line, 'hard');
  assert.equal(readEffort(marked), 'hard');
  assert.equal(setEffortOnLine(marked, null), line);
});
