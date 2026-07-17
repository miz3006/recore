import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildReceipt, namesMatch, typedNameOf } from './receipt.ts';
import { echoTextOf, topOfSets } from './summarize.ts';
import { type LineSignal, type ParseResult, type ParsedItem, type ParsedSet } from './types.ts';

const set = (over: Partial<ParsedSet>): ParsedSet => ({
  kind: 'working',
  reps: null,
  weight_kg: null,
  distance_m: null,
  duration_s: null,
  rir: null,
  parent: null,
  ...over,
});

const item = (exercise: string, line: number, sets: ParsedSet[]): ParsedItem => ({
  exercise,
  aliases_seen: [],
  modality: 'strength',
  group_key: null,
  line,
  sets,
});

const resultOf = (...items: ParsedItem[]): ParseResult => ({ items, parse_version: 2 });

test('echo voice: loaded, bodyweight, hold', () => {
  assert.equal(
    echoTextOf(topOfSets([set({ reps: 8, weight_kg: 82.5 }), set({ reps: 8, weight_kg: 82.5 })])),
    '2×8 82.5',
  );
  assert.equal(echoTextOf(topOfSets([set({ reps: 12 })])), '1×12');
  assert.equal(echoTextOf(topOfSets([set({ duration_s: 60 })])), '60 s');
});

test('warm-ups and drops shape neither the scheme nor the totals', () => {
  const bench = item('Bench Press', 0, [
    set({ kind: 'warmup', reps: 10, weight_kg: 40 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
    set({ kind: 'drop', reps: 8, weight_kg: 60 }),
  ]);
  const receipt = buildReceipt(resultOf(bench), []);
  assert.equal(receipt.rows[0]!.setText, '2×8 80');
  assert.equal(receipt.totalSets, 2);
  // volume counts working + drop, never warm-ups (parsedVolume semantics)
  assert.equal(receipt.volume, 8 * 80 + 8 * 80 + 8 * 60);
});

test('comparison signal attaches, echo-kind does not', () => {
  const signals: LineSignal[] = [
    { line: 0, signal: { kind: 'up', delta: '+2.5' } },
    { line: 1, signal: { kind: 'set', text: '3×12 30' } },
  ];
  const receipt = buildReceipt(
    resultOf(
      item('Bench Press', 0, [set({ reps: 8, weight_kg: 82.5 })]),
      item('Incline DB Press', 1, [set({ reps: 12, weight_kg: 30 })]),
    ),
    signals,
  );
  assert.deepEqual(receipt.rows[0]!.signal, { kind: 'up', delta: '+2.5' });
  assert.equal(receipt.rows[1]!.signal, null, 'first-time exercise stays silent');
});

test('superset sharing a line: signal only on the first item', () => {
  const signals: LineSignal[] = [{ line: 0, signal: { kind: 'pr' } }];
  const receipt = buildReceipt(
    resultOf(
      item('Bench Press', 0, [set({ reps: 10, weight_kg: 60 })]),
      item('Chest Fly', 0, [set({ reps: 12, weight_kg: 12 })]),
    ),
    signals,
  );
  assert.equal(receipt.rows.length, 2);
  assert.deepEqual(receipt.rows[0]!.signal, { kind: 'pr' });
  assert.equal(receipt.rows[1]!.signal, null);
});

test('prose lines never reach the receipt (no items → no rows)', () => {
  const receipt = buildReceipt(resultOf(item('Squat', 2, [set({ reps: 5, weight_kg: 140 })])), []);
  assert.equal(receipt.rows.length, 1);
  assert.equal(receipt.rows[0]!.line, 2);
});

// --- typedNameOf / namesMatch (ghost checklist + correction marks) -----------

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
});

test('a run-only session totals in distance, not an empty 0 kg', () => {
  const run: ParsedItem = {
    ...item('Run', 0, [set({ distance_m: 5000, kind: 'working' })]),
    modality: 'cardio',
  };
  const receipt = buildReceipt(resultOf(run), []);
  assert.equal(receipt.volume, 0);
  assert.equal(receipt.distanceM, 5000);
  assert.equal(receipt.totalSets, 1);
});
