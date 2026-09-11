import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reanchorLines } from './anchor.ts';
import type { ParsedItem, ParseResult } from './types.ts';

const item = (exercise: string, line: number, aliases: string[] = []): ParsedItem => ({
  exercise,
  aliases_seen: aliases,
  modality: 'strength',
  group_key: null,
  line,
  sets: [
    {
      kind: 'working',
      reps: 5,
      weight_kg: 100,
      distance_m: null,
      duration_s: null,
      rir: null,
      parent: null,
      note: null,
    },
  ],
});

const linesOf = (result: ParseResult) => result.items.map((i) => i.line);

test('a claimed line that really holds the exercise is kept', () => {
  const result: ParseResult = {
    items: [item('Bench Press', 0, ['bench']), item('Squat', 1, ['squat'])],
    parse_version: 6,
  };
  reanchorLines(result, 'bench 100kg 3x5\nsquat 140kg 5x5');
  assert.deepEqual(linesOf(result), [0, 1]);
});

test('a drifted index is pulled back to the line that names the movement', () => {
  // The model miscounts blank and prose lines; the index is a hint, not a fact.
  const result: ParseResult = {
    items: [item('Bench Press', 3, ['bench']), item('Squat', 4, ['squat'])],
    parse_version: 6,
  };
  reanchorLines(result, 'felt good today\n\nbench 100kg 3x5\nsquat 140kg 5x5');
  assert.deepEqual(linesOf(result), [2, 3]);
});

test('the same movement on three lines stays on three lines', () => {
  // The defect: a plain "first line that mentions it" search sent all three
  // readings to line 0, so two of the three lines looked unread and their
  // cards stacked under the first.
  const result: ParseResult = {
    items: [
      item('Bench Press', 0, ['bench']),
      item('Bench Press', 0, ['bench']),
      item('Bench Press', 0, ['bench']),
    ],
    parse_version: 6,
  };
  reanchorLines(result, 'bench 60kg 2x10\nbench 80kg 3x5\nbench 100kg 1x3');
  assert.deepEqual(linesOf(result), [0, 1, 2]);
});

test('an inline superset keeps both movements on their one line', () => {
  const result: ParseResult = {
    items: [item('Bench Press', 0, ['bench']), item('Barbell Row', 0, ['bb row'])],
    parse_version: 6,
  };
  reanchorLines(result, 'bench 80 3x8 ss bb row 60 3x8\ncurls 15kg 3x12');
  assert.deepEqual(linesOf(result), [0, 0]);
});

test('an item that matches nowhere keeps the line it claimed', () => {
  const result: ParseResult = { items: [item('Leg Press', 2, ['leg press'])], parse_version: 6 };
  reanchorLines(result, 'bench 100kg 3x5\nsquat 140kg 5x5\n');
  assert.deepEqual(linesOf(result), [2]);
});

test('a one-letter alias never anchors anything', () => {
  // "x" appears in every set notation ever written; a token that short would
  // pin an item to whatever line came first.
  const result: ParseResult = { items: [item('Squat', 9, ['x'])], parse_version: 6 };
  reanchorLines(result, 'bench 3x8 80kg\nsquat 5x5 140kg');
  assert.deepEqual(linesOf(result), [1]);
});
