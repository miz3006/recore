import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  composeReflection,
  isStorableReflection,
  MAX_REFLECTION_CHARS,
  normalizeReflection,
  REFLECTION_COUNTER_FROM,
  REFLECTION_PLACEHOLDER,
  REFLECTION_PROMPTS,
  REFLECTION_TAGS,
  reflectionCharsLeft,
  reflectionError,
  reflectionRoomFor,
  reflectionTagLine,
  splitReflection,
} from './reflection.ts';

test('the four prompts are §8.1 verbatim', () => {
  assert.deepEqual(REFLECTION_PROMPTS, [
    'How did that feel?',
    'Energy and fatigue?',
    'Recovery or food today?',
    'Anything that affected the session?',
  ]);
});

test('the field asks the widest question it can', () => {
  // The placeholder stopped being one of the prompts when the chips started
  // answering (owner, 17 Aug 2026) — but it still asks, never assesses.
  assert.equal(REFLECTION_PLACEHOLDER, 'Anything about today…');
  assert.ok(!/!/.test(REFLECTION_PLACEHOLDER));
});

test('the prompts ask, they never assess', () => {
  // §8.1: "Answers are the athlete's own notes, not a health assessment." A
  // prompt that states a conclusion would make the note one.
  for (const p of REFLECTION_PROMPTS) {
    assert.ok(p.endsWith('?'), `"${p}" is not a question`);
    assert.ok(!/!/.test(p), `"${p}" cheers`);
    assert.ok(!/\byou (should|must|need)\b/i.test(p), `"${p}" instructs`);
  }
});

test('a written reflection is stored exactly as typed, minus outer whitespace', () => {
  assert.equal(normalizeReflection('legs felt heavy'), 'legs felt heavy');
  assert.equal(normalizeReflection('  slept badly, still hit it  '), 'slept badly, still hit it');
  // Any language, verbatim — §8.1 allows Slovenian, English or anything else.
  assert.equal(normalizeReflection('noge težke, spal slabo'), 'noge težke, spal slabo');
  // Inner formatting is the athlete's, not ours to tidy.
  assert.equal(normalizeReflection('energy low\nback ok'), 'energy low\nback ok');
});

test('skipping is free: empty in every form means no reflection', () => {
  assert.equal(normalizeReflection(''), null);
  assert.equal(normalizeReflection('   '), null);
  assert.equal(normalizeReflection('\n\t '), null);
  assert.equal(normalizeReflection(null), null);
  assert.equal(normalizeReflection(undefined), null);
  // A field that was filled and then cleared resolves the same way.
  assert.equal(normalizeReflection('   '), normalizeReflection(''));
});

test('a non-string never reaches storage', () => {
  assert.equal(normalizeReflection(42 as unknown as string), null);
  assert.equal(normalizeReflection({} as unknown as string), null);
});

test('an over-long note is refused, never silently truncated', () => {
  const long = 'a'.repeat(MAX_REFLECTION_CHARS + 1);
  assert.equal(normalizeReflection(long), null);
  assert.equal(isStorableReflection(long), false);
  // Exactly at the limit is fine.
  const atLimit = 'b'.repeat(MAX_REFLECTION_CHARS);
  assert.equal(normalizeReflection(atLimit), atLimit);
  assert.equal(isStorableReflection(atLimit), true);
});

test('the error names the limit and does not scold', () => {
  assert.equal(reflectionError('short'), null);
  assert.equal(reflectionError(''), null, 'empty is not an error, it is a skip');
  const msg = reflectionError('a'.repeat(MAX_REFLECTION_CHARS + 1));
  assert.ok(msg);
  assert.ok(msg.includes(String(MAX_REFLECTION_CHARS)));
  assert.ok(!/!/.test(msg), 'no exclamation');
});

test('the counter stays silent until the limit is actually near', () => {
  assert.equal(reflectionCharsLeft('a few words'), null);
  assert.equal(reflectionCharsLeft('a'.repeat(REFLECTION_COUNTER_FROM - 1)), null);
  assert.equal(reflectionCharsLeft('a'.repeat(REFLECTION_COUNTER_FROM)), 100);
  assert.equal(reflectionCharsLeft('a'.repeat(MAX_REFLECTION_CHARS)), 0);
});

// --- the preset answers (owner, 17 Aug 2026) ---------------------------------

test('nothing is preselected and the chips are plain words', () => {
  assert.deepEqual(REFLECTION_TAGS, ['Slept badly', 'Felt strong', 'Short on time']);
  // No verdicts, no praise (§15, §20) — three things about a session, stated
  // flatly enough that a person can mean them.
  for (const t of REFLECTION_TAGS) {
    assert.ok(!/!/.test(t), `"${t}" cheers`);
    assert.ok(t.length <= 20, `"${t}" is a sentence, not a chip`);
  }
  // An empty sheet stores nothing at all: skipping stays free.
  assert.equal(composeReflection([], ''), null);
  assert.equal(composeReflection([], '   '), null);
});

test('chips are stored in canonical order, whatever order they were tapped', () => {
  assert.equal(reflectionTagLine(['Short on time', 'Slept badly']), 'Slept badly · Short on time');
  // Anything not on the list contributes nothing — the app never stores a word
  // it did not offer.
  assert.equal(reflectionTagLine(['Crushed it']), '');
  assert.equal(composeReflection(['Crushed it'], ''), null);
});

test('chips and typed words round-trip through one stored column', () => {
  const stored = composeReflection(['Felt strong', 'Slept badly'], '  legs heavy on the last set ');
  assert.equal(stored, 'Slept badly · Felt strong\n\nlegs heavy on the last set');

  const back = splitReflection(stored);
  assert.deepEqual(back.tags, ['Slept badly', 'Felt strong']);
  assert.equal(back.text, 'legs heavy on the last set');
  // Re-saving an untouched sheet stores the identical value.
  assert.equal(composeReflection(back.tags, back.text), stored);
});

test('chips alone, and words alone, both store cleanly', () => {
  assert.equal(composeReflection(['Short on time'], ''), 'Short on time');
  assert.deepEqual(splitReflection('Short on time'), { tags: ['Short on time'], text: '' });

  assert.equal(composeReflection([], 'noge težke, spal slabo'), 'noge težke, spal slabo');
  assert.deepEqual(splitReflection('noge težke, spal slabo'), {
    tags: [],
    text: 'noge težke, spal slabo',
  });
});

test('prose is never mistaken for chips', () => {
  // A first line that merely CONTAINS a chip phrase is prose and stays whole.
  const prose = 'Slept badly but the bar moved\n\nsecond line';
  assert.deepEqual(splitReflection(prose), { tags: [], text: prose });
  // Nothing at all reads as nothing at all.
  assert.deepEqual(splitReflection(null), { tags: [], text: '' });
  assert.deepEqual(splitReflection('   '), { tags: [], text: '' });
});

test('arming a chip costs the field its own room, and never the athlete words', () => {
  assert.equal(reflectionRoomFor([]), MAX_REFLECTION_CHARS);
  const line = 'Slept badly · Short on time';
  assert.equal(reflectionRoomFor(['Slept badly', 'Short on time']), MAX_REFLECTION_CHARS - line.length - 2);
  // Composed at that room, the whole stored value still fits the promise.
  const body = 'a'.repeat(reflectionRoomFor(['Slept badly', 'Short on time']));
  const stored = composeReflection(['Slept badly', 'Short on time'], body);
  assert.equal(stored?.length, MAX_REFLECTION_CHARS);

  // And if something ever gets past the field's cap, the chips give way — the
  // app's words go, the person's stay.
  const long = 'b'.repeat(MAX_REFLECTION_CHARS);
  assert.equal(composeReflection(['Slept badly'], long), long);
});
