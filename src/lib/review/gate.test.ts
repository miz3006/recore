import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MAX_ASKS,
  RE_ASK_DAYS,
  reviewDecision,
  shouldAskForReview,
  type ReviewHistory,
  type ReviewMoment,
} from './gate.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 28, 19, 0, 0); // 28 Jul 2026, after training

/** A session that has earned the ask: five days on record, a PR just landed. */
const GOOD: ReviewMoment = {
  sessionsLogged: 5,
  streak: 4,
  prToday: true,
  predictorProven: false,
  correctedThisSession: false,
  otherSheetDue: false,
};

const FRESH: ReviewHistory = { askCount: 0, lastAskedAtMs: null };

test('a finished session with a PR on a real record asks', () => {
  assert.equal(reviewDecision(GOOD, FRESH, NOW), 'ask');
  assert.equal(shouldAskForReview(GOOD, FRESH, NOW), true);
});

test('any ONE of the three earning signals is enough', () => {
  const bare = { ...GOOD, prToday: false, predictorProven: false, streak: 1 };
  assert.equal(reviewDecision(bare, FRESH, NOW), 'nothing-earned');
  assert.equal(reviewDecision({ ...bare, prToday: true }, FRESH, NOW), 'ask');
  assert.equal(reviewDecision({ ...bare, predictorProven: true }, FRESH, NOW), 'ask');
  assert.equal(reviewDecision({ ...bare, streak: 3 }, FRESH, NOW), 'ask');
});

test('a session that had to be corrected never asks — that is repair work, not delight', () => {
  const repaired = { ...GOOD, correctedThisSession: true };
  assert.equal(reviewDecision(repaired, FRESH, NOW), 'just-repaired');
});

test('two sessions on record is not an opinion yet', () => {
  assert.equal(reviewDecision({ ...GOOD, sessionsLogged: 2 }, FRESH, NOW), 'too-early');
  assert.equal(reviewDecision({ ...GOOD, sessionsLogged: 3 }, FRESH, NOW), 'ask');
});

test('a trial sheet owed on this open wins — never stack two modals', () => {
  assert.equal(reviewDecision({ ...GOOD, otherSheetDue: true }, FRESH, NOW), 'busy');
});

test('the cooldown holds for four months, then reopens', () => {
  const asked = { askCount: 1, lastAskedAtMs: NOW - 30 * DAY };
  assert.equal(reviewDecision(GOOD, asked, NOW), 'cooling-down');
  assert.equal(
    reviewDecision(GOOD, { askCount: 1, lastAskedAtMs: NOW - RE_ASK_DAYS * DAY }, NOW),
    'ask',
  );
});

test('the three asks are spent for good', () => {
  const spent = { askCount: MAX_ASKS, lastAskedAtMs: NOW - 900 * DAY };
  assert.equal(reviewDecision(GOOD, spent, NOW), 'spent');
});

test('a clock skewed backwards stays quiet rather than asking twice', () => {
  const future = { askCount: 1, lastAskedAtMs: NOW + 5 * DAY };
  assert.equal(reviewDecision(GOOD, future, NOW), 'cooling-down');
});

test('a corrupt last-ask stamp does not block the gate forever', () => {
  const broken = { askCount: 1, lastAskedAtMs: Number.NaN };
  assert.equal(reviewDecision(GOOD, broken, NOW), 'ask');
});

test('the objections are ordered by how permanent they are', () => {
  // Everything is wrong at once: the answer is the one that can never change.
  const worst: ReviewMoment = {
    sessionsLogged: 0,
    streak: 0,
    prToday: false,
    predictorProven: false,
    correctedThisSession: true,
    otherSheetDue: true,
  };
  assert.equal(reviewDecision(worst, { askCount: MAX_ASKS, lastAskedAtMs: null }, NOW), 'spent');
  assert.equal(reviewDecision(worst, FRESH, NOW), 'busy');
  assert.equal(reviewDecision({ ...worst, otherSheetDue: false }, FRESH, NOW), 'just-repaired');
});
