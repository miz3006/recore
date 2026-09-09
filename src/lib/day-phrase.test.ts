import assert from 'node:assert/strict';
import test from 'node:test';

import { isRelativeDayLabel, lastDayPhrase, onDayPhrase } from './day-phrase.ts';

test('relative labels are the two words labelForDay can return', () => {
  assert.equal(isRelativeDayLabel('Today'), true);
  assert.equal(isRelativeDayLabel('Yesterday'), true);
  assert.equal(isRelativeDayLabel('Sep 4'), false);
  assert.equal(isRelativeDayLabel('Fri 4 Sep'), false);
  // Not a fuzzy match: a date that merely contains the word is still a date.
  assert.equal(isRelativeDayLabel('Today 4 Sep'), false);
});

test('an absolute date keeps its preposition', () => {
  assert.equal(onDayPhrase('Sep 4'), 'on Sep 4');
  assert.equal(onDayPhrase('Fri 4 Sep'), 'on Fri 4 Sep');
  assert.equal(onDayPhrase('Sep 4 2025'), 'on Sep 4 2025');
});

test('a relative day drops the preposition and the capital', () => {
  assert.equal(onDayPhrase('Today'), 'today');
  assert.equal(onDayPhrase('Yesterday'), 'yesterday');
});

test('"last" falls away for a relative day too', () => {
  assert.equal(lastDayPhrase('Sep 4'), 'last Sep 4');
  assert.equal(lastDayPhrase('Today'), 'today');
  assert.equal(lastDayPhrase('Yesterday'), 'yesterday');
});
