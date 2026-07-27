import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nameKey, namesMatch, typedNameOf } from './names.ts';

test('typedNameOf extracts the words before the first digit', () => {
  assert.equal(typedNameOf('tricpes 27kgx12x2'), 'tricpes');
  assert.equal(typedNameOf('incline smith machine 70kgx10x3'), 'incline smith machine');
  assert.equal(typedNameOf('  Weighted Dips 12-10-8'), 'weighted dips');
  assert.equal(typedNameOf('3x8 80kg bench'), '');
  assert.equal(typedNameOf('felt tired today'), 'felt tired today');
});

test('namesMatch is plural-insensitive containment, so typos do NOT match', () => {
  assert.ok(namesMatch('dips', 'Dip'));
  assert.ok(namesMatch('rows', 'Row'));
  assert.ok(namesMatch('incline smith machine', 'Incline Smith Machine Press'));
  assert.ok(namesMatch('biceps', 'Biceps Curl'));
  assert.ok(!namesMatch('tricpes', 'Triceps Pushdown'));
  assert.ok(!namesMatch('', 'Bench Press'));
  assert.ok(!namesMatch('bench press', 'Row'));
  // Two-letter fragments carry no evidence — mid-keystroke text never matches.
  assert.ok(!namesMatch('d', 'Deadlift'));
  assert.ok(!namesMatch('be', 'Bench Press'));
});

test('nameKey strips to letters and singular', () => {
  assert.equal(nameKey('Weighted Dips'), 'weighteddip');
  assert.equal(nameKey('21s'), ''); // digit-led names key to nothing
});

