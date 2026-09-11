import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  SESSION_EFFORT_CHOICES,
  SESSION_EFFORT_HINT,
  SESSION_EFFORT_LABEL,
  SESSION_EFFORT_RPE,
  sessionEffortOf,
  sessionLoad,
  sessionMinutes,
  buildLoadWeeks,
  loadTrend,
  MIN_WEEKS_FOR_AVERAGE,
  weekIsComplete,
  weeklyLoad,
} from './session-effort.ts';

const iso = (minutesFromZero: number) => new Date(minutesFromZero * 60_000).toISOString();

test('the scale is three points on CR-10, spaced and ordered', () => {
  assert.deepEqual(SESSION_EFFORT_CHOICES, ['easy', 'moderate', 'hard']);
  const values = SESSION_EFFORT_CHOICES.map((c) => SESSION_EFFORT_RPE[c]);
  assert.deepEqual(values, [3, 5, 8]);
  // Strictly increasing, and every value on the scale it claims to be.
  for (let i = 1; i < values.length; i += 1) assert.ok(values[i]! > values[i - 1]!);
  for (const v of values) assert.ok(v >= 0 && v <= 10);
});

test('every answer carries a label and a hint, and none of them praises', () => {
  const banned = /crush|amazing|great job|beast|smash|well done/i;
  for (const choice of SESSION_EFFORT_CHOICES) {
    assert.ok(SESSION_EFFORT_LABEL[choice].length > 0);
    assert.ok(SESSION_EFFORT_HINT[choice].length > 0);
    assert.doesNotMatch(SESSION_EFFORT_LABEL[choice], banned);
    assert.doesNotMatch(SESSION_EFFORT_HINT[choice], banned);
  }
});

test('the session words are NOT the per-lift words', () => {
  // `effort.ts` asks how close one set came to failure; this asks what the
  // whole session cost. Two questions that read alike teach a person that
  // neither one matters.
  const perLift = ['Could do more', 'Just right', 'Nothing left'];
  for (const choice of SESSION_EFFORT_CHOICES) {
    assert.ok(!perLift.includes(SESSION_EFFORT_LABEL[choice]));
  }
});

test('sessionEffortOf lights the nearest chip, and null for no answer', () => {
  assert.equal(sessionEffortOf(3), 'easy');
  assert.equal(sessionEffortOf(5), 'moderate');
  assert.equal(sessionEffortOf(8), 'hard');
  assert.equal(sessionEffortOf(null), null);
  assert.equal(sessionEffortOf(undefined), null);
  assert.equal(sessionEffortOf(Number.NaN), null);
});

test('a value from a finer scale still arms a chip rather than showing none', () => {
  // A later build (or another device) may store halves. Whatever arrives, the
  // athlete sees an answered control instead of a blank one.
  assert.equal(sessionEffortOf(1), 'easy');
  assert.equal(sessionEffortOf(4.5), 'moderate');
  assert.equal(sessionEffortOf(6.4), 'moderate');
  assert.equal(sessionEffortOf(7), 'hard');
  assert.equal(sessionEffortOf(10), 'hard');
});

test('sessionMinutes reads the span and refuses an implausible one', () => {
  assert.equal(sessionMinutes(iso(0), iso(48)), 48);
  assert.equal(sessionMinutes(iso(0), iso(MIN_SESSION_MINUTES)), MIN_SESSION_MINUTES);
  assert.equal(sessionMinutes(iso(0), iso(MAX_SESSION_MINUTES)), MAX_SESSION_MINUTES);
  // Typed from memory on the sofa, and left open overnight: neither is a
  // session anybody lived, so neither gets a number.
  assert.equal(sessionMinutes(iso(0), iso(4)), null);
  assert.equal(sessionMinutes(iso(0), iso(600)), null);
  assert.equal(sessionMinutes(null, iso(40)), null);
  assert.equal(sessionMinutes('not a date', iso(40)), null);
});

test('sessionLoad is the rating times the minutes', () => {
  assert.equal(sessionLoad(8, 60), 480);
  assert.equal(sessionLoad(3, 45), 135);
});

test('an unrated session has NO load — never a zero, never a guess', () => {
  assert.equal(sessionLoad(null, 60), null);
  assert.equal(sessionLoad(8, null), null);
  assert.equal(sessionLoad(null, null), null);
  assert.equal(sessionLoad(0, 60), null);
});

const S = (day: string, rpe: number | null, minutes: number | null) => ({ day, rpe, minutes });

test('a weekly total counts what it could compute and says what it skipped', () => {
  const week = weeklyLoad([
    S('2026-09-07', 8, 60), // 480
    S('2026-09-08', 5, 40), // 200
    S('2026-09-09', null, 55), // not answered
    S('2026-09-10', 8, null), // span unusable
  ]);
  assert.equal(week.load, 680);
  assert.equal(week.counted, 2);
  assert.equal(week.skipped, 2);
});

test('a week with ONE unrated session is not complete, at any count', () => {
  // Not "enough of them": a sum over four of six sessions is smaller than the
  // week was, and a smaller number on a chart is a lighter week that never
  // happened.
  assert.equal(weekIsComplete(weeklyLoad([S('2026-09-07', 8, 60)])), true);
  assert.equal(
    weekIsComplete(weeklyLoad([S('2026-09-07', 8, 60), S('2026-09-08', null, 40)])),
    false,
  );
  // An empty week is not complete either — there is nothing to be a total of.
  assert.equal(weekIsComplete(weeklyLoad([])), false);
});

test('the buckets are rolling seven days ending today, oldest first', () => {
  const weeks = buildLoadWeeks([S('2026-09-10', 8, 60)], '2026-09-10', 3);
  assert.equal(weeks.length, 3);
  assert.deepEqual(
    weeks.map((w) => [w.start, w.end]),
    [
      ['2026-08-21', '2026-08-27'],
      ['2026-08-28', '2026-09-03'],
      ['2026-09-04', '2026-09-10'],
    ],
  );
  // A week with no training is a real zero and keeps its slot.
  assert.equal(weeks[0]!.counted, 0);
  assert.equal(weeks[2]!.load, 480);
});

test('the average needs two earlier COMPLETE weeks before it speaks', () => {
  const one = loadTrend([
    weeklyLoad([S('a', 5, 60)], '2026-08-28', '2026-09-03'),
    weeklyLoad([S('b', 8, 60)], '2026-09-04', '2026-09-10'),
  ]);
  assert.equal(one.average, null, 'one earlier week is that week, not an average');
  assert.equal(one.percent, null);
  assert.equal(MIN_WEEKS_FOR_AVERAGE, 2);

  const two = loadTrend([
    weeklyLoad([S('a', 5, 60)], '2026-08-21', '2026-08-27'), // 300
    weeklyLoad([S('b', 5, 40)], '2026-08-28', '2026-09-03'), // 200
    weeklyLoad([S('c', 8, 60)], '2026-09-04', '2026-09-10'), // 480
  ]);
  assert.equal(two.average, 250);
  assert.equal(two.averageWeeks, 2);
  assert.equal(two.percent, 92); // 480 vs 250
});

test('an incomplete current week gets no comparison', () => {
  // Comparing a half-rated week to an average of whole ones is comparing two
  // different quantities and calling the difference a trend.
  const t = loadTrend([
    weeklyLoad([S('a', 5, 60)], '2026-08-21', '2026-08-27'),
    weeklyLoad([S('b', 5, 40)], '2026-08-28', '2026-09-03'),
    weeklyLoad([S('c', 8, 60), S('d', null, 45)], '2026-09-04', '2026-09-10'),
  ]);
  assert.equal(t.average, 250, 'the average still stands on the complete weeks');
  assert.equal(t.percent, null, 'but nothing is compared to it');
  assert.equal(t.current?.skipped, 1);
});

test('an incomplete earlier week never enters the average', () => {
  const t = loadTrend([
    weeklyLoad([S('a', 5, 60), S('x', null, 30)], '2026-08-14', '2026-08-20'), // dropped
    weeklyLoad([S('b', 5, 60)], '2026-08-21', '2026-08-27'), // 300
    weeklyLoad([S('c', 5, 40)], '2026-08-28', '2026-09-03'), // 200
    weeklyLoad([S('d', 8, 60)], '2026-09-04', '2026-09-10'),
  ]);
  assert.equal(t.average, 250);
  assert.equal(t.averageWeeks, 2);
});

test('no buckets at all is silence, not a zero', () => {
  const t = loadTrend([]);
  assert.equal(t.current, null);
  assert.equal(t.average, null);
  assert.equal(t.percent, null);
});

test('coverage is counted in TRAINING DAYS, the word this tab already uses', () => {
  // Two entries written on one evening are one day of training — the rule
  // `progress-summary.ts` states for its own metrics. "1 of 13 sessions" beside
  // a hero reading "8 training days" is one screen using one word for two
  // things.
  const week = weeklyLoad([
    S('2026-09-08', 8, 60),
    S('2026-09-08', 5, 40), // same evening, second entry
    S('2026-09-09', null, 50),
    S('2026-09-10', 8, null),
  ]);
  assert.equal(week.days, 3);
  assert.equal(week.ratedDays, 1, 'only the day whose every entry computed');
  assert.equal(week.counted, 2, 'the completeness rule still counts rows');
  assert.equal(week.skipped, 2);
});

test('a day is rated only when EVERY entry on it is', () => {
  const half = weeklyLoad([S('2026-09-08', 8, 60), S('2026-09-08', null, 40)]);
  assert.equal(half.days, 1);
  assert.equal(half.ratedDays, 0);
  assert.equal(weekIsComplete(half), false);

  const whole = weeklyLoad([S('2026-09-08', 8, 60), S('2026-09-08', 5, 40)]);
  assert.equal(whole.ratedDays, 1);
  assert.equal(weekIsComplete(whole), true);
  assert.equal(whole.load, 680);
});
