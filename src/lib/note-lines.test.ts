import assert from 'node:assert/strict';
import { test } from 'node:test';

import { removeLine, restoreLine, type RemovedLine } from './note-lines.ts';

/** Forward then back — the property the undo pill actually promises. */
function roundTrip(note: string, line: number): string {
  const cut = removeLine(note, line);
  assert.ok(cut, `expected line ${line} to exist in ${JSON.stringify(note)}`);
  return restoreLine(cut.note, cut.line, cut.text);
}

test('a delete removes exactly the line it names', () => {
  const note = 'bench 3x8 80kg\nrows 3x10 60kg\nsquat 5x5 100kg';
  assert.deepEqual(removeLine(note, 1), {
    note: 'bench 3x8 80kg\nsquat 5x5 100kg',
    text: 'rows 3x10 60kg',
    line: 1,
  } satisfies RemovedLine);
});

test('undo restores the note byte for byte, from any position', () => {
  const note = 'bench 3x8 80kg\nrows 3x10 60kg\nsquat 5x5 100kg';
  for (let i = 0; i < 3; i++) assert.equal(roundTrip(note, i), note);
});

test('the empty composer line at the end survives the round trip', () => {
  // The note always ends in the line being typed, and it is usually blank.
  // Losing it would move the cursor into the last settled entry.
  const note = 'bench 3x8 80kg\nrows 3x10 60kg\n';
  assert.equal(roundTrip(note, 0), note);
  assert.equal(roundTrip(note, 1), note);
});

test('a blank line in the middle is a line like any other', () => {
  const note = 'bench 3x8 80kg\n\nsquat 5x5 100kg';
  assert.equal(roundTrip(note, 1), note);
  assert.equal(removeLine(note, 1)?.text, '');
});

test('emptying the note keeps the composer line, and undo brings the entry back above it', () => {
  // THE ONE ASYMMETRY, and the case it is tuned for. A note showing one settled
  // card is 'bench…\n' — the entry, then the blank line being typed into. Cut
  // the entry and the note is '', which is still ONE (empty) line, and undo has
  // to put the entry back ABOVE it rather than replacing it.
  const note = 'bench 3x8 80kg\n';
  assert.equal(removeLine(note, 0)?.note, '');
  assert.equal(roundTrip(note, 0), note);
});

test('a note of one line and no composer line cannot round-trip, and says so', () => {
  // '' serialises both [] and [''], so the trailing blank cannot be recovered
  // from the string alone. The app never reaches this: a card is only drawn for
  // a line ABOVE the one being typed, so the only line in a note is always the
  // composer's own and has no delete control on it.
  assert.equal(roundTrip('bench 3x8 80kg', 0), 'bench 3x8 80kg\n');
});

test('whitespace inside the line is the record and is not touched', () => {
  const note = 'a\n  bench   3x8   80kg  \nb';
  assert.equal(removeLine(note, 1)?.text, '  bench   3x8   80kg  ');
  assert.equal(roundTrip(note, 1), note);
});

test('an index that names no line is a no-op, never an edit of a neighbour', () => {
  const note = 'bench 3x8 80kg\nrows 3x10 60kg';
  assert.equal(removeLine(note, 2), null);
  assert.equal(removeLine(note, -1), null);
  assert.equal(removeLine(note, 1.5), null);
});

test('undo still lands the line when the note grew while the pill was up', () => {
  // Delete line 0 of two, then type two more lines before tapping Undo.
  const cut = removeLine('bench 3x8 80kg\nrows 3x10 60kg', 0);
  assert.ok(cut);
  const grown = `${cut.note}\nsquat 5x5 100kg\n`;
  assert.equal(
    restoreLine(grown, cut.line, cut.text),
    'bench 3x8 80kg\nrows 3x10 60kg\nsquat 5x5 100kg\n',
  );
});

test('undo past the end appends rather than losing the line', () => {
  // The position is wrong, the content never is — the whole point of clamping.
  assert.equal(restoreLine('a\nb', 9, 'bench 3x8 80kg'), 'a\nb\nbench 3x8 80kg');
  assert.equal(restoreLine('', 3, 'bench 3x8 80kg'), '\nbench 3x8 80kg');
});
