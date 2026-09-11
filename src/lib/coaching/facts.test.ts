import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compactKg, factsLine, groupThousands, previewOf } from './facts.ts';

test('a session says what it was', () => {
  assert.equal(factsLine({ lifts: 4, sets: 12, volumeKg: 4320 }), '4 lifts · 12 sets · 4,320 kg');
});

test('one of a thing is not “1 lifts”', () => {
  assert.equal(factsLine({ lifts: 1, sets: 1, volumeKg: 120 }), '1 lift · 1 set · 120 kg');
});

test('an unparsed session says nothing rather than zero', () => {
  // Zero of everything means the parser has not read the text yet, not that
  // the day was empty — the caller shows the person's own words instead.
  assert.equal(factsLine({ lifts: 0, sets: 0, volumeKg: 0 }), null);
});

test('bodyweight work keeps its counts and drops the tonnage', () => {
  assert.equal(factsLine({ lifts: 2, sets: 6, volumeKg: 0 }), '2 lifts · 6 sets');
});

test('a lifetime of tonnage stays short', () => {
  assert.equal(compactKg(999_999), groupThousands(999_999));
  assert.equal(compactKg(1_240_000), '1.2M');
});

test('the coach reads the SAME number the athlete does', () => {
  // This file had its own `groupThousands` grouping by DEVICE LOCALE, so a
  // Slovenian phone printed `1.500 kg` on the coach's session header while
  // Today printed `27,869 kg` from the app's formatter. Photographed on the
  // simulator, 11 September 2026. The separator is a comma for everybody: the
  // labels beside it are English, and `1.500` reads as one and a half.
  assert.equal(groupThousands(1500), '1,500');
  assert.equal(compactKg(1500), '1,500');
  assert.equal(compactKg(27_869), '27,869');
  // And it does not follow whatever locale the test host happens to be in.
  assert.ok(!compactKg(1500).includes('.'), 'a full stop is a decimal point, not a group');
});

test('the preview is their own first lines, never a summary', () => {
  assert.equal(previewOf('bench 100x5x3\nsquat 120x5\nrow 60x8'), 'bench 100x5x3 · squat 120x5');
  assert.equal(previewOf('  \n\n  bench 100x5x3  \n'), 'bench 100x5x3');
  assert.equal(previewOf(''), '');
});
