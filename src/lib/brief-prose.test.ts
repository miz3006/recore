import assert from 'node:assert/strict';
import { test } from 'node:test';

import { briefDateline, briefProse, splitLede } from './brief-prose.ts';
import type { Brief } from './db/brief.ts';

const empty: Brief = {
  dayLabel: null,
  forToday: false,
  lines: [],
  headline: null,
  stalls: [],
  movers: [],
  adherence: null,
  prReach: null,
  sessions7: 0,
  sessions8w: 0,
};

const line = { name: 'Bench Press', value: '82.5 kg × 5·5·5', why: null };

test('an empty brief composes an empty paragraph', () => {
  assert.equal(briefProse(empty), '');
});

test("today's declared day names the day and counts the movements", () => {
  const out = briefProse({
    ...empty,
    forToday: true,
    dayLabel: 'Push',
    lines: [line, line, line],
  });
  assert.equal(out, 'Today reads as Push — 3 movements, loads already set below.');
});

test('the week opens the lede when there are recent sessions', () => {
  const out = briefProse({
    ...empty,
    forToday: true,
    dayLabel: 'Push',
    lines: [line, line, line],
    sessions7: 2,
  });
  assert.equal(
    out,
    '2 sessions in the last seven days, and today reads as Push — 3 movements, loads already set below.',
  );
});

test('a single recent session reads in words and stands alone without a plan', () => {
  const out = briefProse({ ...empty, sessions7: 1 });
  assert.equal(out, 'One session in the last seven days.');
});

test('the ghost phrases the next session, singular movement included', () => {
  const out = briefProse({ ...empty, lines: [line] });
  assert.match(out, /^Your next session is ready — one movement/);
});

test('the week folds into the ghost sentence too', () => {
  const out = briefProse({ ...empty, lines: [line], sessions7: 3 });
  assert.match(out, /^3 sessions in the last seven days, and your next session is ready — one movement/);
});

test('a single mover carries its own delta and no tail', () => {
  const out = briefProse({
    ...empty,
    movers: [{ canonical: 'Deadlift', deltaKg: 16, weeks: 8 }],
  });
  assert.equal(out, 'Deadlift is moving — up 16 kg of estimated 1RM in 8 weeks.');
});

test('extra movers fold into a counted tail', () => {
  const out = briefProse({
    ...empty,
    movers: [
      { canonical: 'Deadlift', deltaKg: 16, weeks: 8 },
      { canonical: 'Squat', deltaKg: 10, weeks: 8 },
      { canonical: 'Bench Press', deltaKg: 5, weeks: 8 },
    ],
  });
  assert.match(out, /with 2 more lifts climbing behind it\./);
});

test('a stall states the fact, and the watch item carries the deload', () => {
  const out = briefProse({
    ...empty,
    stalls: [{ canonical: 'Overhead Press', weight: 40, sessions: 3, deloadTo: 35 }],
  });
  assert.equal(
    out,
    'Overhead Press has held 40 kg for 3 sessions. ' +
      'Worth watching next session: whether reps move on Overhead Press — one more flat session and the prescription backs off to 35 kg.',
  );
});

test('a stall without a plate still closes with a watch item, minus the deload', () => {
  const out = briefProse({
    ...empty,
    stalls: [{ canonical: 'Overhead Press', weight: 40, sessions: 3, deloadTo: null }],
  });
  assert.equal(
    out,
    'Overhead Press has held 40 kg for 3 sessions. ' +
      'Worth watching next session: whether reps move on Overhead Press at 40 kg.',
  );
});

test('no stall means no watch item — the close is earned, not padded', () => {
  const out = briefProse({ ...empty, lines: [line] });
  assert.doesNotMatch(out, /Worth watching/);
});

test('a within-reach load is stated as arithmetic, never a cheer', () => {
  const out = briefProse({
    ...empty,
    prReach: { name: 'Bench Press', weightKg: 82.5 },
  });
  assert.equal(out, '82.5 kg on Bench Press would be your heaviest ever.');
});

test('the record reads as followed-of-settled', () => {
  const out = briefProse({
    ...empty,
    adherence: { followed: 7, settled: 9 } as Brief['adherence'],
  });
  assert.equal(out, 'You followed 7 of the last 9 prescriptions.');
});

test('a full brief keeps §9 order: week+next, stakes, moving, stuck, record, watch', () => {
  const out = briefProse({
    dayLabel: 'Push',
    forToday: true,
    lines: [line, line],
    headline: null,
    stalls: [{ canonical: 'Overhead Press', weight: 40, sessions: 3, deloadTo: 35 }],
    movers: [{ canonical: 'Deadlift', deltaKg: 16, weeks: 8 }],
    adherence: { followed: 7, settled: 9 } as Brief['adherence'],
    prReach: { name: 'Bench Press', weightKg: 82.5 },
    sessions7: 2,
    sessions8w: 14,
  });
  const order = [
    out.indexOf('2 sessions in the last seven days, and today reads as Push'),
    out.indexOf('82.5 kg on Bench Press'),
    out.indexOf('Deadlift is moving'),
    out.indexOf('Overhead Press has held'),
    out.indexOf('You followed'),
    out.indexOf('Worth watching'),
  ];
  assert.ok(order.every((i) => i >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('splitLede cuts at the first sentence and never inside a number', () => {
  const { lead, rest } = splitLede(
    '2 sessions in the last seven days, and today reads as Push — 3 movements, loads already set below. 82.5 kg on Bench Press would be your heaviest ever.',
  );
  assert.equal(
    lead,
    '2 sessions in the last seven days, and today reads as Push — 3 movements, loads already set below.',
  );
  assert.equal(rest, '82.5 kg on Bench Press would be your heaviest ever.');
});

test('a one-sentence paragraph is all lede', () => {
  const { lead, rest } = splitLede('Deadlift is moving — up 16 kg of estimated 1RM in 8 weeks.');
  assert.match(lead, /^Deadlift is moving/);
  assert.equal(rest, '');
});

test('the dateline reads as a written date', () => {
  assert.equal(briefDateline(new Date(2026, 6, 30)), 'Thursday, 30 July');
});
