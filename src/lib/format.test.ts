import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatDelta,
  formatDuration,
  formatNumber,
  formatSets,
  groupThousands,
} from './format.ts';

test('formatNumber drops a trailing zero — a bar cannot express 80.0', () => {
  assert.equal(formatNumber(80), '80');
  assert.equal(formatNumber(80.0), '80');
  assert.equal(formatNumber(82.5), '82.5');
  assert.equal(formatNumber(82.53), '82.5');
});

test('formatNumber never renders NaN or Infinity at a user', () => {
  assert.equal(formatNumber(NaN), '—');
  assert.equal(formatNumber(Infinity), '—');
});

// U+202F narrow no-break space: keeps the mono grid even, and avoids the
// decimal-comma ambiguity a Slovenian reader would hit with a comma (§9.3).
const NNBSP = '\u202F';

test('groupThousands groups volumes and leaves loads alone', () => {
  assert.equal(groupThousands(12480), `12${NNBSP}480`);
  assert.equal(groupThousands(100), '100');
  assert.equal(groupThousands(1000), `1${NNBSP}000`);
  assert.equal(groupThousands(1234567), `1${NNBSP}234${NNBSP}567`);
});

test('groupThousands separates with a narrow no-break space, never a comma', () => {
  assert.equal(groupThousands(12480).charCodeAt(2), 0x202f);
  assert.ok(!groupThousands(1234567).includes(','));
});

test('groupThousands keeps the fraction and the sign', () => {
  assert.equal(groupThousands(1234.5), `1${NNBSP}234.5`);
  assert.equal(groupThousands(-1234), `-1${NNBSP}234`);
});

test('formatDelta always carries an explicit sign — the glyph is the only signal', () => {
  assert.equal(formatDelta(2.5), '+2.5');
  assert.equal(formatDelta(-5), '−5');
  assert.equal(formatDelta(0), '0', 'zero must not claim a change');
});

test('formatDelta uses a true minus sign, not a hyphen', () => {
  // U+2212. A hyphen is narrower than the digits beside it and breaks the
  // tabular grid that the mono face exists to hold.
  assert.equal(formatDelta(-5).charCodeAt(0), 0x2212);
});

test('formatDuration reads as a clock and only shows hours when there are hours', () => {
  assert.equal(formatDuration(1564), '26:04');
  assert.equal(formatDuration(59), '0:59');
  assert.equal(formatDuration(3600), '1:00:00');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(0), '0:00');
});

test('formatDuration refuses nonsense rather than rendering it', () => {
  assert.equal(formatDuration(-1), '—');
  assert.equal(formatDuration(NaN), '—');
});

test('formatSets collapses identical sets and keeps uneven ones (§8.3)', () => {
  assert.equal(formatSets([8, 8, 7]), '8 · 8 · 7');
  assert.equal(formatSets([8, 8, 8]), '3 × 8');
  assert.equal(formatSets([5, 5, 5, 5, 5]), '5 × 5');
  assert.equal(formatSets([]), '');
});

test('formatSets does not collapse a single set into "1 × 8"', () => {
  assert.equal(formatSets([8]), '8');
});
