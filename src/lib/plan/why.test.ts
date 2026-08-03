import assert from 'node:assert/strict';
import { test } from 'node:test';

import { whyFor } from './prescribe.ts';

test('whyFor states the fact behind each progression, as a fragment', () => {
  assert.equal(
    whyFor({ code: 'top_of_range', weight: 80, increment: 2.5, top: 5, bottom: 3 }),
    'you filled every set of 5 at 80',
  );
  assert.equal(
    whyFor({ code: 'rir_surplus', weight: 100, increment: 2.5, minRir: 3 }),
    '3 left in reserve at 100',
  );
  assert.equal(whyFor({ code: 'deload', from: 120, to: 107.5 }), 'two sessions stuck at 120');
  assert.equal(whyFor({ code: 'hold', weight: 90, bottom: 6 }), 'short of 6 reps last time');
});

test('add_rep only speaks when the note said it was hard', () => {
  assert.equal(
    whyFor({ code: 'add_rep', weight: 90, minRir: 1 }),
    'nothing much left at 90 last time',
  );
  assert.equal(whyFor({ code: 'add_rep', weight: 90, minRir: null }), null, 'no RIR, no claim');
});

test('a repeat is not a reason — no reason, no line (§8.3)', () => {
  assert.equal(whyFor({ code: 'repeat' }), null);
});

test('fractional plate loads read without trailing zeroes', () => {
  assert.equal(
    whyFor({ code: 'top_of_range', weight: 82.5, increment: 2.5, top: 8, bottom: 6 }),
    'you filled every set of 8 at 82.5',
  );
});
