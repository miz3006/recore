import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstLoggedDay, matchesQuery } from './settings-search.ts';

const units = {
  label: 'Units',
  value: 'Kilograms',
  keywords: 'kg kilograms lbs pounds weight metric imperial',
};

test('matches the label a row prints', () => {
  assert.equal(matchesQuery(units, 'Training', 'units'), true);
  assert.equal(matchesQuery(units, 'Training', 'Uni'), true);
});

test('matches the value a row currently shows', () => {
  assert.equal(matchesQuery(units, 'Training', 'kilograms'), true);
});

// The reason `keywords` exists: neither the label nor the value contains "lbs".
test('matches a keyword the row never prints', () => {
  assert.equal(matchesQuery(units, 'Training', 'lbs'), true);
  assert.equal(matchesQuery({ label: 'Sign out', keywords: 'log out' }, 'Account', 'log out'), true);
});

test('matches the name of the group a row lives in', () => {
  assert.equal(matchesQuery(units, 'Training', 'training'), true);
});

test('ignores case and surrounding whitespace, and nothing else', () => {
  assert.equal(matchesQuery(units, 'Training', '  LBS '), true);
  // No fuzzy matching, on purpose — a typo finds nothing rather than something.
  assert.equal(matchesQuery(units, 'Training', 'lbz'), false);
});

test('an empty query matches everything', () => {
  assert.equal(matchesQuery(units, 'Training', ''), true);
  assert.equal(matchesQuery(units, 'Training', '   '), true);
});

test('a row with no value, sub or keywords still matches on its label', () => {
  const bare = { label: 'Contact support' };
  assert.equal(matchesQuery(bare, 'Support', 'support'), true);
  assert.equal(matchesQuery(bare, 'Support', 'refund'), false);
});

test('the first logged day is the earliest key, in any iteration order', () => {
  assert.equal(firstLoggedDay(['2026-09-01', '2026-07-07', '2026-08-30']), '2026-07-07');
  assert.equal(firstLoggedDay(new Set(['2025-12-31', '2026-01-01'])), '2025-12-31');
});

test('an empty record has no first day rather than a zero', () => {
  assert.equal(firstLoggedDay([]), null);
  assert.equal(firstLoggedDay(new Set<string>()), null);
});
