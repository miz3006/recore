import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sanitizeBriefSummary } from './brief-guard.ts';

const source =
  'Today reads as Push — 3 movements, loads already set below. ' +
  'Deadlift is moving — up 16 kg of estimated 1RM in 8 weeks. ' +
  'Overhead Press has held 40 kg for 3 sessions — the next session backs off to 35 kg unless reps move. ' +
  'You followed 7 of the last 9 prescriptions.';

test('a faithful rewrite passes', () => {
  const text =
    'Push je na vrsti — 3 gibi s pripravljenimi obremenitvami. Mrtvi dvig raste, 16 kg ocenjenega 1RM v 8 tednih, potisk nad glavo pa že 3 seje stoji pri 40 kg.';
  assert.equal(sanitizeBriefSummary(text, source), text);
});

test('a decimal comma matches its decimal-point source', () => {
  const src = 'Bench Press is moving — up 2.5 kg of estimated 1RM in 8 weeks.';
  const text = 'Bench press raste — za 2,5 kg ocenjenega 1RM v 8 tednih se je premaknil.';
  assert.equal(sanitizeBriefSummary(text, src), text);
});

test('an invented number kills the whole rewrite', () => {
  const text =
    'Deadlift is up 16 kg in 8 weeks, and next week you could try 150 kg for a single.';
  assert.equal(sanitizeBriefSummary(text, source), null);
});

test('dropping facts is allowed — the subset of numbers still passes', () => {
  const text = 'Deadlift is climbing, up 16 kg of estimated 1RM across the last 8 weeks of training.';
  assert.equal(sanitizeBriefSummary(text, source), text);
});

test('exclamation marks, emoji, the word AI, and newlines are all rejected', () => {
  assert.equal(sanitizeBriefSummary('Deadlift up 16 kg in 8 weeks — great work, keep going!', source), null);
  assert.equal(sanitizeBriefSummary('Deadlift up 16 kg in 8 weeks 💪 and holding steady there.', source), null);
  assert.equal(sanitizeBriefSummary('Your AI summary: Deadlift is up 16 kg over the 8 weeks.', source), null);
  assert.equal(sanitizeBriefSummary('Deadlift up 16 kg in 8 weeks.\n- Push day is next today.', source), null);
});

test('non-strings, too short and too long are rejected', () => {
  assert.equal(sanitizeBriefSummary(null, source), null);
  assert.equal(sanitizeBriefSummary(42, source), null);
  assert.equal(sanitizeBriefSummary('Too short.', source), null);
  assert.equal(sanitizeBriefSummary(`Deadlift up 16 kg. ${'x'.repeat(420)}`, source), null);
});
