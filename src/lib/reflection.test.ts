import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  isStorableReflection,
  MAX_REFLECTION_CHARS,
  normalizeReflection,
  REFLECTION_COUNTER_FROM,
  REFLECTION_PLACEHOLDER,
  REFLECTION_PROMPTS,
  reflectionCharsLeft,
  reflectionError,
} from './reflection.ts';

test('the four prompts are §8.1 verbatim', () => {
  assert.deepEqual(REFLECTION_PROMPTS, [
    'How did that feel?',
    'Energy and fatigue?',
    'Recovery or food today?',
    'Anything that affected the session?',
  ]);
  assert.equal(REFLECTION_PLACEHOLDER, 'How did that feel?');
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
