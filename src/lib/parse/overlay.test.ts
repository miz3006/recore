import assert from 'node:assert/strict';
import { test } from 'node:test';

import { overlayCorrections, type OverlayPatch } from './overlay.ts';
import { type ParseResult, type ParsedItem, type ParsedSet } from './types.ts';

const workingSet = (reps: number, weight: number | null): ParsedSet => ({
  kind: 'working',
  reps,
  weight_kg: weight,
  distance_m: null,
  duration_s: null,
  rir: null,
  parent: null,
});

const item = (exercise: string, line: number, sets: ParsedSet[]): ParsedItem => ({
  exercise,
  aliases_seen: [exercise.toLowerCase()],
  modality: 'strength',
  group_key: null,
  line,
  sets,
});

const resultOf = (...items: ParsedItem[]): ParseResult => ({ items, parse_version: 2 });

const patch = (lineText: string, before: ParsedItem, after: ParsedItem): OverlayPatch => ({
  lineText,
  before,
  after,
});

test('re-applies a fix when the model repeats its original output', () => {
  const model = item('Barbell Row', 0, [workingSet(8, 60)]);
  const fixed = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const out = overlayCorrections(resultOf(model), 'rows 3x8 60kg', [
    patch('rows 3x8 60kg', model, fixed),
  ]);
  assert.equal(out.items[0]!.exercise, 'Pendlay Row');
});

test('follows the line when it moves within the note', () => {
  const before = item('Barbell Row', 0, [workingSet(8, 60)]);
  const after = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const moved = item('Barbell Row', 1, [workingSet(8, 60)]);
  const out = overlayCorrections(resultOf(moved), 'warmup stuff\nrows 3x8 60kg', [
    patch('rows 3x8 60kg', before, after),
  ]);
  assert.equal(out.items[0]!.exercise, 'Pendlay Row');
  assert.equal(out.items[0]!.line, 1, 'keeps the model line index');
});

test('does not apply when the line text was edited', () => {
  const before = item('Barbell Row', 0, [workingSet(8, 60)]);
  const after = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const fresh = item('Barbell Row', 0, [workingSet(8, 65)]);
  const out = overlayCorrections(resultOf(fresh), 'rows 3x8 65kg', [
    patch('rows 3x8 60kg', before, after),
  ]);
  assert.equal(out.items[0]!.exercise, 'Barbell Row');
});

test('steps aside once the parser agrees with the user', () => {
  const before = item('Barbell Row', 0, [workingSet(8, 60)]);
  const after = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const nowCorrect = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const out = overlayCorrections(resultOf(nowCorrect), 'rows 3x8 60kg', [
    patch('rows 3x8 60kg', before, after),
  ]);
  assert.equal(out.items[0]!.exercise, 'Pendlay Row');
  assert.equal(out.items[0]!.sets.length, 1);
});

test('number-only fixes stick across re-parses', () => {
  const model = item('Bench Press', 0, [workingSet(8, 84)]);
  const fixed = item('Bench Press', 0, [workingSet(8, 84.5)]);
  const out = overlayCorrections(resultOf(model), 'bench 8 @ 84.5ish', [
    patch('bench 8 @ 84.5ish', model, fixed),
  ]);
  assert.equal(out.items[0]!.sets[0]!.weight_kg, 84.5);
});

test('chains two fixes of the same line in creation order', () => {
  const a = item('Barbell Row', 0, [workingSet(8, 60)]);
  const b = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const c = item('Seal Row', 0, [workingSet(8, 60)]);
  const out = overlayCorrections(resultOf(a), 'rows 3x8 60kg', [
    patch('rows 3x8 60kg', a, b),
    patch('rows 3x8 60kg', b, c),
  ]);
  assert.equal(out.items[0]!.exercise, 'Seal Row');
});

test('targets only the matching item when a line holds a superset', () => {
  const bench = item('Bench Press', 0, [workingSet(10, 60)]);
  const wrong = item('Chest Fly', 0, [workingSet(12, 12)]);
  const right = item('Cable Fly', 0, [workingSet(12, 12)]);
  const out = overlayCorrections(
    resultOf(bench, wrong),
    'incline 3x10 60 ss flyes 3x12 12',
    [patch('incline 3x10 60 ss flyes 3x12 12', wrong, right)],
  );
  assert.equal(out.items[0]!.exercise, 'Bench Press', 'untouched sibling');
  assert.equal(out.items[1]!.exercise, 'Cable Fly');
});

test('same fix applies to every occurrence of identical line text', () => {
  const first = item('Barbell Row', 0, [workingSet(8, 60)]);
  const second = item('Barbell Row', 1, [workingSet(8, 60)]);
  const fixed = item('Pendlay Row', 0, [workingSet(8, 60)]);
  const out = overlayCorrections(resultOf(first, second), 'rows 3x8 60kg\nrows 3x8 60kg', [
    patch('rows 3x8 60kg', first, fixed),
  ]);
  assert.equal(out.items[0]!.exercise, 'Pendlay Row');
  assert.equal(out.items[1]!.exercise, 'Pendlay Row');
});
