import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeItems, planParse, type ParsePlan } from './incremental.ts';
import { type ParsedItem } from './types.ts';

/**
 * The incremental plan is the one piece of the speed work that can be WRONG
 * rather than merely slow: it decides what the model is not asked about, and
 * everything it does not ask about is served from the cached reading. So every
 * shape of edit a note actually takes gets a test, and the two that matter most
 * are the ones where a line does not belong to the item anchored on it.
 */

const item = (exercise: string, line: number): ParsedItem => ({
  exercise,
  aliases_seen: [exercise.toLowerCase()],
  modality: 'strength',
  group_key: null,
  line,
  sets: [{ kind: 'working', reps: 8, weight_kg: 80, distance_m: null, duration_s: null, rir: null, parent: null, note: null }],
});

const NOTE = ['bench press 80x8', 'barbell row 60x10', 'lateral raise 12.5x15'].join('\n');
const ITEMS = [item('Bench Press', 0), item('Barbell Row', 1), item('Lateral Raise', 2)];

const partial = (p: ParsePlan) => {
  assert.equal(p.mode, 'partial');
  return p;
};

describe('planParse', () => {
  it('an appended exercise reads that line and the block above it', () => {
    const p = partial(planParse(NOTE, ITEMS, `${NOTE}\ncurl 20x12`));
    // The new line, plus the exercise it might be a continuation of.
    assert.deepEqual(p.lines, [2, 3]);
    assert.deepEqual(
      p.keep.map((i) => [i.exercise, i.line]),
      [
        ['Bench Press', 0],
        ['Barbell Row', 1],
      ],
    );
  });

  it('a bare set typed under an exercise re-reads that exercise, not the line', () => {
    // "80x8" on its own line belongs to the bench press above it — the model
    // answers with an item anchored at line 0, so line 0 must be in the ask.
    const p = partial(planParse('bench press 80x8', [item('Bench Press', 0)], 'bench press 80x8\n80x8'));
    assert.ok(p.lines.includes(0));
    assert.deepEqual(p.keep, []);
  });

  it('editing one line in place asks for that line and the one above', () => {
    const edited = ['bench press 80x8', 'barbell row 62.5x10', 'lateral raise 12.5x15'].join('\n');
    const p = partial(planParse(NOTE, ITEMS, edited));
    assert.deepEqual(p.lines, [0, 1]);
    assert.deepEqual(
      p.keep.map((i) => [i.exercise, i.line]),
      [['Lateral Raise', 2]],
    );
  });

  it('the first line edited asks for nothing above it', () => {
    const edited = ['bench press 85x8', 'barbell row 60x10', 'lateral raise 12.5x15'].join('\n');
    const p = partial(planParse(NOTE, ITEMS, edited));
    assert.deepEqual(p.lines, [0]);
    assert.equal(p.keep.length, 2);
  });

  it('deleting a line needs no model call at all, and re-indexes what is left', () => {
    const p = partial(planParse(NOTE, ITEMS, ['bench press 80x8', 'lateral raise 12.5x15'].join('\n')));
    // Only the block above the deletion is re-read; nothing new to read.
    assert.deepEqual(p.lines, [0]);
    assert.deepEqual(
      p.keep.map((i) => [i.exercise, i.line]),
      [['Lateral Raise', 1]],
    );
  });

  it('an inserted line re-reads the block it split', () => {
    const p = partial(planParse(NOTE, ITEMS, ['bench press 80x8', 'squat 100x5', 'barbell row 60x10', 'lateral raise 12.5x15'].join('\n')));
    assert.deepEqual(p.lines, [0, 1]);
    assert.deepEqual(
      p.keep.map((i) => [i.exercise, i.line]),
      [
        ['Barbell Row', 2],
        ['Lateral Raise', 3],
      ],
    );
  });

  it('a blank line added at the end asks for no blank line', () => {
    const p = partial(planParse(NOTE, ITEMS, `${NOTE}\n`));
    assert.deepEqual(p.lines, [2]);
  });

  it('falls back to a full read when the whole note is new', () => {
    assert.equal(planParse(NOTE, ITEMS, 'squat 100x5\ndeadlift 140x3').mode, 'full');
  });

  it('falls back to a full read when too many lines are touched', () => {
    const big = ['a 1x1', 'b 2x2', 'c 3x3', 'd 4x4', 'e 5x5', 'f 6x6'].join('\n');
    const items = ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => item(n, i));
    const changed = ['a 1x1', 'B 9x9', 'C 9x9', 'D 9x9', 'E 9x9', 'f 6x6'].join('\n');
    assert.equal(planParse(big, items, changed).mode, 'full');
  });

  it('falls back to a full read with no cached reading to splice', () => {
    assert.equal(planParse(NOTE, [], `${NOTE}\ncurl 20x12`).mode, 'full');
  });

  it('identical text keeps everything and asks for nothing', () => {
    const p = partial(planParse(NOTE, ITEMS, NOTE));
    assert.deepEqual(p.lines, []);
    assert.equal(p.keep.length, 3);
  });

  it('never keeps an item it also asked about', () => {
    const p = partial(planParse(NOTE, ITEMS, `${NOTE}\ncurl 20x12`));
    for (const kept of p.keep) assert.ok(!p.lines.includes(kept.line));
  });
});

describe('mergeItems', () => {
  it('orders by line so the re-anchor cursor cannot run backwards', () => {
    const merged = mergeItems([item('Kept', 0), item('Also kept', 4)], [item('Fresh', 2)]);
    assert.deepEqual(
      merged.map((i) => i.line),
      [0, 2, 4],
    );
  });

  it('puts the just-read item first when two share a line', () => {
    const merged = mergeItems([item('Kept', 1)], [item('Fresh', 1)]);
    assert.deepEqual(
      merged.map((i) => i.exercise),
      ['Fresh', 'Kept'],
    );
  });
});
