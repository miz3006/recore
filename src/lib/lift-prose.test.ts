import assert from 'node:assert/strict';
import { test } from 'node:test';

import { liftProse, type LiftBrief } from './lift-prose.ts';

const base: LiftBrief = {
  canonical: 'Bench Press',
  sessionCount: 0,
  firstDayLabel: null,
  windowSessions: 0,
  firstWeight: null,
  lastWeight: null,
  firstReps: null,
  lastReps: null,
  bestWeight: null,
  bestReps: null,
  bestDayLabel: null,
  e1rmBest: null,
  stallSessions: 0,
};

test('nothing recorded composes an empty paragraph', () => {
  assert.equal(liftProse(base), '');
});

test('a single session says "once" and never "1 times"', () => {
  const out = liftProse({ ...base, sessionCount: 1 });
  assert.equal(out, 'You have logged Bench Press once.');
});

test('the first day is only named when the caller supplies it', () => {
  assert.match(liftProse({ ...base, sessionCount: 24, firstDayLabel: 'Mar 3' }), /24 times since Mar 3\./);
  assert.match(liftProse({ ...base, sessionCount: 24 }), /24 times\./);
});

test('a climbing top set reads as a word, never a bare plus', () => {
  const out = liftProse({
    ...base,
    sessionCount: 10,
    windowSessions: 10,
    firstWeight: 80,
    lastWeight: 90,
  });
  assert.match(out, /went from 80 kg to 90 kg — up 10 kg\./);
  assert.ok(!out.includes('+'));
});

test('a falling top set says "down", with no minus sign anywhere', () => {
  const out = liftProse({
    ...base,
    sessionCount: 6,
    windowSessions: 6,
    firstWeight: 100,
    lastWeight: 92.5,
  });
  assert.match(out, /from 100 kg to 92\.5 kg — down 7\.5 kg\./);
  assert.ok(!/-\d/.test(out));
});

test('a flat window says it held, and does not also say it stalled', () => {
  const out = liftProse({
    ...base,
    sessionCount: 4,
    windowSessions: 4,
    firstWeight: 100,
    lastWeight: 100,
    stallSessions: 4,
  });
  assert.match(out, /has held at 100 kg across those sessions\./);
  assert.ok(!out.includes('topped out'));
});

test('a stall inside a moving window is stated as arithmetic', () => {
  const out = liftProse({
    ...base,
    sessionCount: 8,
    windowSessions: 8,
    firstWeight: 80,
    lastWeight: 100,
    stallSessions: 3,
  });
  assert.match(out, /The last 3 sessions all topped out at 100 kg\./);
});

test('a bodyweight lift carries the story in reps', () => {
  const out = liftProse({
    ...base,
    canonical: 'Pull Ups',
    sessionCount: 24,
    windowSessions: 10,
    firstReps: 12,
    lastReps: 16,
    bestReps: 16,
    bestDayLabel: 'Jun 22',
  });
  assert.match(out, /from 12 to 16 reps — up 4\./);
  assert.match(out, /The best set in the record is 16 reps, on Jun 22\./);
  assert.ok(!out.includes('kg'));
});

test('the heaviest set closes the paragraph with its estimate', () => {
  const out = liftProse({
    ...base,
    sessionCount: 12,
    bestWeight: 100,
    bestReps: 5,
    bestDayLabel: 'Jun 22',
    e1rmBest: 116.5,
  });
  assert.match(out, /heaviest working set in the record is 100 kg × 5, on Jun 22, for an estimated 1RM of 116\.5 kg\./);
});

test('the paragraph never prescribes and never praises', () => {
  const out = liftProse({
    ...base,
    sessionCount: 24,
    firstDayLabel: 'Mar 3',
    windowSessions: 10,
    firstWeight: 80,
    lastWeight: 90,
    bestWeight: 100,
    bestReps: 5,
    bestDayLabel: 'Jun 22',
    e1rmBest: 116.5,
  });
  assert.ok(!/next|try|should|great|nice|keep it up|!/i.test(out));
  // Short enough that a rewrite can stay inside brief-guard's 420 chars.
  assert.ok(out.length < 400, `paragraph too long: ${out.length}`);
});
