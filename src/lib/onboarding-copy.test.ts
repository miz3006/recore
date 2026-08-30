import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  projectionHeadline,
  projectionSubject,
  RECAP_NEUTRAL,
  recapSubtext,
  weekReadback,
  WHY_WRITTEN_NEUTRAL,
  WHY_WRITTEN_REST,
  whyWrittenBody,
  whyWrittenOpening,
} from './onboarding-copy.ts';

test('the essay opens on the tracker the person actually uses', () => {
  assert.match(whyWrittenOpening('strong'), /^You track in Strong today\./);
  assert.match(whyWrittenOpening('hevy'), /^You track in Hevy today\./);
  assert.match(whyWrittenOpening('notes'), /^You already write your training\./);
  assert.match(whyWrittenOpening('sheet'), /^A spreadsheet remembers everything/);
  assert.match(whyWrittenOpening('none'), /^Starting clean is the easy case\./);
});

test('an unanswered tracker gets the neutral opening, never a guess', () => {
  assert.equal(whyWrittenOpening(null), WHY_WRITTEN_NEUTRAL);
  assert.equal(whyWrittenOpening(undefined), WHY_WRITTEN_NEUTRAL);
  assert.equal(whyWrittenOpening('a tracker that does not exist'), WHY_WRITTEN_NEUTRAL);
});

test('only the first paragraph varies — the argument itself does not', () => {
  const strong = whyWrittenBody('strong');
  const nowhere = whyWrittenBody('none');
  assert.equal(strong.length, 3);
  assert.notEqual(strong[0], nowhere[0]);
  assert.deepEqual(strong.slice(1), [...WHY_WRITTEN_REST]);
  assert.deepEqual(nowhere.slice(1), [...WHY_WRITTEN_REST]);
});

test('the recap answers the friction the person named', () => {
  assert.match(recapSubtext(['forget']), /^You said you forget to log\./);
  assert.match(recapSubtext(['target']), /numbers worth beating this week/);
  assert.equal(recapSubtext(['slow']), RECAP_NEUTRAL);
  assert.equal(recapSubtext([]), RECAP_NEUTRAL);
});

test('forgetting outranks not knowing what to beat when both are ticked', () => {
  assert.match(recapSubtext(['target', 'forget']), /^You said you forget to log\./);
});

test('the projection headline carries the goal, and nothing when there is none', () => {
  assert.equal(projectionHeadline(null, 'strength'), 'Your next 12 weeks of load');
  assert.equal(projectionHeadline('Marko', 'muscle'), 'Marko — your next 12 weeks of volume');
  assert.equal(projectionHeadline('Marko', 'sport'), 'Marko — your next 12 weeks of training');
  assert.equal(projectionHeadline('Marko', null), 'Marko — your next 12 weeks');
  assert.equal(projectionHeadline('  ', null), 'Your next 12 weeks');
  assert.equal(projectionSubject('both'), 'load');
  assert.equal(projectionSubject('nonsense'), null);
});

test('the week card reads its own count back, singular and plural', () => {
  assert.equal(weekReadback(4, 'structured').title, '4 days a week');
  assert.equal(weekReadback(1, 'structured').title, '1 day a week');
  assert.match(weekReadback(4, 'structured').detail, /Next tab/);
  assert.match(weekReadback(4, 'flexible').detail, /never counts a miss/);
});

test('an empty week is an answer when the person decides on the day', () => {
  assert.equal(weekReadback(0, 'flexible').title, 'No fixed days');
  assert.match(weekReadback(0, 'flexible').detail, /follows what you write/);
  // Nothing chosen at all is still an invitation, never a demand.
  assert.equal(weekReadback(0, null).title, 'Pick your days');
  assert.match(weekReadback(0, undefined).detail, /change it any time/);
});

test('nothing the week card says can be read as a target', () => {
  for (const days of [0, 1, 3, 7]) {
    for (const feel of ['structured', 'flexible', null]) {
      const { title, detail } = weekReadback(days, feel);
      for (const line of [title, detail]) {
        assert.ok(!/\btarget\b|\bgoal\b|\bstreak\b|\bmissed\b/i.test(line), `"${line}" scores the week`);
      }
    }
  }
});

test('every line in the file keeps the §12 tone', () => {
  const lines = [
    WHY_WRITTEN_NEUTRAL,
    ...WHY_WRITTEN_REST,
    ...['strong', 'hevy', 'notes', 'sheet', 'none', null].map(whyWrittenOpening),
    ...[['forget'], ['target'], []].map(recapSubtext),
    ...[
      weekReadback(4, 'structured'),
      weekReadback(0, 'flexible'),
      weekReadback(0, null),
    ].flatMap((r) => [r.title, r.detail]),
    projectionHeadline('Marko', 'strength'),
  ];
  for (const line of lines) {
    assert.ok(!line.includes('!'), `"${line}" carries an exclamation mark`);
    assert.ok(
      !/\b(amazing|awesome|incredible|crush|smash|beast|unlock)\b/i.test(line),
      `"${line}" is hype, not Recore`,
    );
    // Sentence case: a line may not open on a shouted word.
    const first = line.split(' ')[0]!;
    assert.ok(first !== first.toUpperCase() || first.length <= 1, `"${line}" opens in caps`);
  }
});
