import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recapAnswerFor, recapChoiceFor, trackerToPref } from './onboarding-v2-map.ts';

test('one combined "Hevy or Strong" answer is stored as itself, never as one of them', () => {
  assert.equal(trackerToPref('app'), 'app');
});

test('everything without a CSV to hand over collapses to notes', () => {
  assert.equal(trackerToPref('notes'), 'notes');
  assert.equal(trackerToPref('excel'), 'notes');
  assert.equal(trackerToPref('paper'), 'notes');
});

test('"I do not log anywhere" is none, and an unanswered screen writes nothing', () => {
  assert.equal(trackerToPref('memory'), 'none');
  assert.equal(trackerToPref(null), null);
  assert.equal(trackerToPref('something-else'), null);
});

test('both recap times mean yes, and each keeps its own day', () => {
  assert.deepEqual(recapChoiceFor('sunday'), { intent: 'yes', day: 'sun', hour: 18 });
  assert.deepEqual(recapChoiceFor('monday'), { intent: 'yes', day: 'mon', hour: 8 });
});

test('"No thanks" is a recorded no, and no answer changes nothing', () => {
  assert.equal(recapChoiceFor('never')?.intent, 'no');
  assert.equal(recapChoiceFor(null), null);
});

test('every recap answer survives the trip out to the prefs and back', () => {
  for (const answer of ['sunday', 'monday', 'never']) {
    const stored = recapChoiceFor(answer);
    assert.ok(stored, `${answer} should map to a setting`);
    assert.equal(recapAnswerFor(stored.intent, stored.day), answer);
  }
});

test('an install that never answered the recap screen reads back as unanswered', () => {
  // Sunday is the default DAY for everyone (`prefs.getRecapDay`), so the day
  // alone must never be mistaken for a yes.
  assert.equal(recapAnswerFor(null, 'sun'), null);
  assert.equal(recapAnswerFor(null, 'mon'), null);
});
