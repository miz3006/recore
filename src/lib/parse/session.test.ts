import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSessionTotals } from './session.ts';
import { doneKeyFor, echoTextOf, setsLineText, topOfSets } from './summarize.ts';
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
  const receipt = buildSessionTotals(resultOf(bench), []);
  assert.equal(receipt.rows[0]!.setText, '80 kg × 8·8');
  assert.equal(receipt.totalSets, 2);
  // volume counts working + drop, never warm-ups (parsedVolume semantics)
  assert.equal(receipt.volume, 8 * 80 + 8 * 80 + 8 * 60);
});

test('faithful set text: pyramid keeps every weight AND rep (the display-bug fix)', () => {
  const squat = item('Squat', 0, [
    set({ reps: 10, weight_kg: 120 }),
    set({ reps: 15, weight_kg: 100 }),
    set({ reps: 8, weight_kg: 90 }),
  ]);
  assert.equal(buildSessionTotals(resultOf(squat), []).rows[0]!.setText, '120·100·90 kg × 10·15·8');
});

test('un-checked (not-done) exercises stay as rows but leave the totals (N2)', () => {
  const bench = item('Bench Press', 0, [
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 8, weight_kg: 80 }),
  ]);
  const squat = item('Squat', 1, [set({ reps: 5, weight_kg: 100 })]);
  const result = resultOf(bench, squat);
  // The user marked the squat NOT DONE — keyed by exercise + its sets text.
  const undone = new Set([doneKeyFor('Squat', setsLineText(squat.sets)!)]);
  const receipt = buildSessionTotals(result, [], undone);

  // Both exercises still render — the record is never lost...
  assert.equal(receipt.rows.length, 2);
  assert.equal(receipt.rows[1]!.exercise, 'Squat');
  // ...but only performed work counts toward the session totals.
  assert.equal(receipt.totalSets, 2); // bench's two sets only
  assert.equal(receipt.volume, 8 * 80 + 8 * 80); // the squat's 100×5 is excluded
});

test('faithful set text: rep list at one weight shows the real reps, not repeated', () => {
  const bench = item('Bench Press', 0, [
    set({ reps: 8, weight_kg: 80 }),
    set({ reps: 7, weight_kg: 80 }),
    set({ reps: 6, weight_kg: 80 }),
  ]);
  assert.equal(buildSessionTotals(resultOf(bench), []).rows[0]!.setText, '80 kg × 8·7·6');
});

test('faithful set text: bodyweight with a dropped last rep', () => {
  const dips = item('Dip', 0, [set({ reps: 16 }), set({ reps: 16 }), set({ reps: 15 })]);
  assert.equal(buildSessionTotals(resultOf(dips), []).rows[0]!.setText, '16·16·15');
});

test('faithful set text: uniform work stays compact', () => {
  const squat = item('Squat', 0, [
    set({ reps: 5, weight_kg: 100 }),
    set({ reps: 5, weight_kg: 100 }),
    set({ reps: 5, weight_kg: 100 }),
  ]);
  assert.equal(buildSessionTotals(resultOf(squat), []).rows[0]!.setText, '100 kg × 5·5·5');
});

test('comparison signal attaches, echo-kind does not', () => {
  const signals: LineSignal[] = [
    { line: 0, signal: { kind: 'up', delta: '+2.5' } },
    { line: 1, signal: { kind: 'set', text: '3×12 30' } },
  ];
  const receipt = buildSessionTotals(
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
  const receipt = buildSessionTotals(
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
  const receipt = buildSessionTotals(resultOf(item('Squat', 2, [set({ reps: 5, weight_kg: 140 })])), []);
  assert.equal(receipt.rows.length, 1);
  assert.equal(receipt.rows[0]!.line, 2);
});

// --- typedNameOf / namesMatch (ghost checklist + correction marks) -----------

test('a run-only session totals in distance, not an empty 0 kg', () => {
  const run: ParsedItem = {
    ...item('Run', 0, [set({ distance_m: 5000, kind: 'working' })]),
    modality: 'cardio',
  };
  const receipt = buildSessionTotals(resultOf(run), []);
  assert.equal(receipt.volume, 0);
  assert.equal(receipt.distanceM, 5000);
  assert.equal(receipt.totalSets, 1);
});
