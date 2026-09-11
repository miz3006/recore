import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sanitizeBriefSummary, sanitizePredictionReason } from './brief-guard.ts';

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

// ---------------------------------------------------------------------------
// sanitizePredictionReason (S4) — the same number whitelist, built from the
// fact bundle that was sent plus the user's own quoted lines.

const facts = { lift: 'Squat', weight_kg: 97.5, next_weight_kg: 100, sessions: 3 };
const quotes = ['squat 92,5 x5 felt easy'];

test('a reason quoting a fact number passes', () => {
  const text = 'You held 97.5 kg for 3 sessions, so 100 kg is the next step.';
  assert.equal(sanitizePredictionReason(text, facts, quotes), text);
});

test('a reason inventing a number is rejected whole', () => {
  assert.equal(
    sanitizePredictionReason('Last time at 140 kg this went up cleanly.', facts, quotes),
    null,
  );
});

test("a number that appears only in the user's own quote passes", () => {
  const text = 'You wrote that 92.5 kg felt easy, so 100 kg is worth a try.';
  assert.equal(sanitizePredictionReason(text, facts, quotes), text);
});

test('a decimal comma in the reason matches its decimal-point fact', () => {
  const text = 'Pri 97,5 kg si zdržal 3 seje, zato je 100 kg naslednji korak.';
  assert.equal(sanitizePredictionReason(text, facts, quotes), text);
});

test('a numberless reason is allowed — nothing to invent', () => {
  const text = 'Your last squat session moved faster than the one before it.';
  assert.equal(sanitizePredictionReason(text, facts, quotes), text);
});

test('non-strings, empty, over-long, newlines, cheering and emoji are rejected', () => {
  assert.equal(sanitizePredictionReason(null, facts, quotes), null);
  assert.equal(sanitizePredictionReason(42, facts, quotes), null);
  assert.equal(sanitizePredictionReason('   ', facts, quotes), null);
  assert.equal(sanitizePredictionReason('x'.repeat(201), facts, quotes), null);
  assert.equal(sanitizePredictionReason('Ready for 100 kg.\nPush day is next.', facts, quotes), null);
  assert.equal(sanitizePredictionReason('100 kg is yours today, go get it!', facts, quotes), null);
  assert.equal(sanitizePredictionReason('100 kg next 💪 and holding there.', facts, quotes), null);
});

test('an empty fact bundle allows no number at all', () => {
  assert.equal(sanitizePredictionReason('Try 100 kg today.', {}, []), null);
  assert.equal(sanitizePredictionReason('Try a little more today.', {}, []), 'Try a little more today.');
});
