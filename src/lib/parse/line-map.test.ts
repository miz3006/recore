import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assignLines, contentLines } from './line-map.ts';

/**
 * The rule a rebuilt reading stands on: prove the line, or refuse the day.
 *
 * Every `null` below is a day that falls back to a real parse. That is the
 * cheap outcome; printing a reading against the wrong line is not.
 */

test('one movement per line is the whole job', () => {
  assert.deepEqual(assignLines([null, null, null], 'bench 100x5\nsquat 140x5\nrow 80x8'), [0, 1, 2]);
});

test('blank lines are skipped, not counted', () => {
  assert.deepEqual(assignLines([null, null], 'bench 100x5\n\n\nsquat 140x5'), [0, 3]);
  assert.deepEqual(contentLines('a\n\n \nb'), [0, 3]);
});

test('an inline superset shares its line', () => {
  // Two movements written on one line, stored as one group.
  assert.deepEqual(assignLines(['g1', 'g1', null], 'bench 100x5 + row 80x8\nsquat 140x5'), [0, 0, 1]);
});

test('two ungrouped items are two lines even though both keys are null', () => {
  assert.deepEqual(assignLines([null, null], 'bench 100x5\nrow 80x8'), [0, 1]);
});

test('two DIFFERENT groups are two lines', () => {
  assert.deepEqual(assignLines(['a', 'a', 'b', 'b'], 'bench + row\nsquat + curl'), [0, 0, 1, 1]);
});

test('a prose line the parser read nothing from refuses the whole day', () => {
  // "felt strong" produces no item, so every item below it would slide up one.
  assert.equal(assignLines([null, null], 'bench 100x5\nfelt strong\nsquat 140x5'), null);
});

test('more groups than lines refuses', () => {
  assert.equal(assignLines([null, null, null], 'bench 100x5\nsquat 140x5'), null);
});

test('an empty note or an empty structure refuses', () => {
  assert.equal(assignLines([], 'bench 100x5'), null);
  assert.equal(assignLines([null], ''), null);
  assert.equal(assignLines([null], '   \n  '), null);
});

test('a trailing blank line does not invent a group', () => {
  assert.deepEqual(assignLines([null], 'bench 100x5\n'), [0]);
});

test('a group key reused later in the note is a different line', () => {
  // Keys only join CONSECUTIVE items. A key that comes back after another one
  // is a new physical line, and joining them would put two readings on a line
  // that carries one.
  assert.deepEqual(assignLines(['a', 'b', 'a'], 'one\ntwo\nthree'), [0, 1, 2]);
});
