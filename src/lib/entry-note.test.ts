import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ENTRY_NOTE_COUNTER_FROM,
  ENTRY_NOTE_PLACEHOLDER,
  ENTRY_NOTE_PROMPTS,
  entryNoteCharsLeft,
  entryNoteError,
  entryNoteKey,
  isStorableEntryNote,
  MAX_ENTRY_NOTE_CHARS,
  MAX_ENTRY_NOTES_PER_WORKOUT,
  normalizeEntryNote,
  parseEntryNotes,
  readEntryNote,
  serializeEntryNotes,
  setEntryNoteIn,
} from './entry-note.ts';

test('the prompts ask, they never assess or instruct', () => {
  assert.equal(ENTRY_NOTE_PLACEHOLDER, ENTRY_NOTE_PROMPTS[0]);
  for (const p of ENTRY_NOTE_PROMPTS) {
    assert.ok(p.endsWith('?'), `"${p}" is not a question`);
    assert.ok(!/!/.test(p), `"${p}" cheers`);
    assert.ok(!/\byou (should|must|need)\b/i.test(p), `"${p}" instructs`);
  }
});

test('a written note is stored exactly as typed, minus outer whitespace', () => {
  assert.equal(normalizeEntryNote('felt heavy, shoulder tight'), 'felt heavy, shoulder tight');
  assert.equal(normalizeEntryNote('  last set was a grind  '), 'last set was a grind');
  // Any language, verbatim — the same promise §8.1 makes for a reflection.
  assert.equal(normalizeEntryNote('zadnja serija težka'), 'zadnja serija težka');
  assert.equal(normalizeEntryNote('bar slowed\nlockout fine'), 'bar slowed\nlockout fine');
});

test('skipping is free: empty in every form means no note', () => {
  assert.equal(normalizeEntryNote(''), null);
  assert.equal(normalizeEntryNote('   '), null);
  assert.equal(normalizeEntryNote('\n\t '), null);
  assert.equal(normalizeEntryNote(null), null);
  assert.equal(normalizeEntryNote(undefined), null);
  assert.equal(normalizeEntryNote(42 as unknown as string), null);
});

test('an over-long note is refused, never silently truncated', () => {
  const long = 'a'.repeat(MAX_ENTRY_NOTE_CHARS + 1);
  assert.equal(normalizeEntryNote(long), null);
  assert.equal(isStorableEntryNote(long), false);
  const atLimit = 'b'.repeat(MAX_ENTRY_NOTE_CHARS);
  assert.equal(normalizeEntryNote(atLimit), atLimit);
  assert.equal(isStorableEntryNote(atLimit), true);
});

test('the error names the limit and does not scold', () => {
  assert.equal(entryNoteError('short'), null);
  assert.equal(entryNoteError(''), null, 'empty is a skip, not an error');
  const msg = entryNoteError('a'.repeat(MAX_ENTRY_NOTE_CHARS + 1));
  assert.ok(msg);
  assert.ok(msg.includes(String(MAX_ENTRY_NOTE_CHARS)));
  assert.ok(!/!/.test(msg), 'no exclamation');
});

test('the counter stays silent until the limit is actually near', () => {
  assert.equal(entryNoteCharsLeft('a few words'), null);
  assert.equal(entryNoteCharsLeft('a'.repeat(ENTRY_NOTE_COUNTER_FROM - 1)), null);
  assert.equal(entryNoteCharsLeft('a'.repeat(ENTRY_NOTE_COUNTER_FROM)), 60);
  assert.equal(entryNoteCharsLeft('a'.repeat(MAX_ENTRY_NOTE_CHARS)), 0);
});

test('the key finds the same lift across spellings, and nothing else', () => {
  assert.equal(entryNoteKey('Bench Press'), 'bench press');
  assert.equal(entryNoteKey('  bench   press '), 'bench press');
  assert.equal(entryNoteKey('BENCH PRESS'), entryNoteKey('bench press'));
  // Different lifts stay different — the key normalizes, it never matches loosely.
  assert.notEqual(entryNoteKey('Incline Bench Press'), entryNoteKey('Bench Press'));
  assert.equal(entryNoteKey(''), '');
  assert.equal(entryNoteKey(null), '');
});

test('setting, reading and clearing one entry', () => {
  let notes = setEntryNoteIn({}, 'Bench Press', 'felt heavy');
  assert.equal(readEntryNote(notes, 'bench press'), 'felt heavy');
  assert.equal(readEntryNote(notes, 'BENCH PRESS'), 'felt heavy');
  assert.equal(readEntryNote(notes, 'Squat'), null);

  notes = setEntryNoteIn(notes, 'Bench Press', 'felt fine actually');
  assert.equal(readEntryNote(notes, 'Bench Press'), 'felt fine actually');

  // Clearing removes the entry rather than storing an empty string.
  notes = setEntryNoteIn(notes, 'Bench Press', '   ');
  assert.deepEqual(notes, {});
  notes = setEntryNoteIn(notes, 'Bench Press', null);
  assert.deepEqual(notes, {});
});

test('setEntryNoteIn never mutates the map it was given', () => {
  const before = { 'bench press': 'felt heavy' };
  const after = setEntryNoteIn(before, 'Squat', 'depth better');
  assert.deepEqual(before, { 'bench press': 'felt heavy' });
  assert.deepEqual(after, { 'bench press': 'felt heavy', squat: 'depth better' });
});

test('an over-long note is refused at the entry, leaving the old one intact', () => {
  const before = setEntryNoteIn({}, 'Squat', 'depth better');
  const after = setEntryNoteIn(before, 'Squat', 'x'.repeat(MAX_ENTRY_NOTE_CHARS + 1));
  // Normalizes to null → the entry is cleared, not replaced with garbage.
  assert.deepEqual(after, {});
});

test('the per-workout cap refuses a new entry instead of evicting a written one', () => {
  let notes: Record<string, string> = {};
  for (let i = 0; i < MAX_ENTRY_NOTES_PER_WORKOUT; i++) {
    notes = setEntryNoteIn(notes, `lift ${i}`, `note ${i}`);
  }
  assert.equal(Object.keys(notes).length, MAX_ENTRY_NOTES_PER_WORKOUT);
  const full = setEntryNoteIn(notes, 'one more lift', 'no room');
  assert.equal(readEntryNote(full, 'one more lift'), null);
  assert.equal(readEntryNote(full, 'lift 0'), 'note 0', 'nothing already written was dropped');
  // Editing an existing entry still works at the cap.
  const edited = setEntryNoteIn(notes, 'lift 0', 'changed');
  assert.equal(readEntryNote(edited, 'lift 0'), 'changed');
});

test('a round trip through storage keeps the words', () => {
  const notes = setEntryNoteIn(setEntryNoteIn({}, 'Bench Press', 'felt heavy'), 'Squat', 'good depth');
  const json = serializeEntryNotes(notes);
  assert.ok(json);
  assert.deepEqual(parseEntryNotes(json), { 'bench press': 'felt heavy', squat: 'good depth' });
});

test('no notes serializes to null, so the column has one empty state', () => {
  assert.equal(serializeEntryNotes({}), null);
  assert.equal(serializeEntryNotes({ squat: '   ' }), null);
});

test('serialization is stable regardless of insertion order', () => {
  const a = setEntryNoteIn(setEntryNoteIn({}, 'Squat', 'x'), 'Bench Press', 'y');
  const b = setEntryNoteIn(setEntryNoteIn({}, 'Bench Press', 'y'), 'Squat', 'x');
  assert.equal(serializeEntryNotes(a), serializeEntryNotes(b));
});

test('a malformed or hostile stored value resolves to no notes, never a throw', () => {
  assert.deepEqual(parseEntryNotes(null), {});
  assert.deepEqual(parseEntryNotes(undefined), {});
  assert.deepEqual(parseEntryNotes(''), {});
  assert.deepEqual(parseEntryNotes('not json'), {});
  assert.deepEqual(parseEntryNotes('[1,2,3]'), {});
  assert.deepEqual(parseEntryNotes('"a string"'), {});
  assert.deepEqual(parseEntryNotes('42'), {});
  // Non-string values and unusable keys are dropped, the rest survives.
  assert.deepEqual(parseEntryNotes('{"squat":5,"  ":"x","bench":"felt heavy"}'), {
    bench: 'felt heavy',
  });
  // An over-long note from another device is dropped, not stored.
  assert.deepEqual(parseEntryNotes(JSON.stringify({ squat: 'a'.repeat(MAX_ENTRY_NOTE_CHARS + 1) })), {});
});

test('a remote row cannot grow past the per-workout cap', () => {
  const oversized: Record<string, string> = {};
  for (let i = 0; i < MAX_ENTRY_NOTES_PER_WORKOUT + 10; i++) oversized[`lift ${i}`] = 'note';
  assert.equal(
    Object.keys(parseEntryNotes(JSON.stringify(oversized))).length,
    MAX_ENTRY_NOTES_PER_WORKOUT,
  );
});
