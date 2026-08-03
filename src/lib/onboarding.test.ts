import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FOCUS_REP_RANGE } from './predict/engine.ts';
import {
  ALL_DAYS_MASK,
  dayCount,
  DAY_LABELS,
  daysLabel,
  focusForGoal,
  formatBodyWeight,
  GOALS,
  gymLeads,
  hasDay,
  isExperience,
  isGoal,
  isSessionFeel,
  isTrainingStyle,
  normalizeDayMask,
  OB_SCREENS,
  OB_STEP_COUNT,
  parseBodyHeight,
  parseBodyWeight,
  questionFraction,
  rowCountBucket,
  screenIndex,
  toggleDay,
  wantsExplanation,
  wantsImportFastPath,
} from './onboarding.ts';

// --- the flow matches the specification ------------------------------------------

test('the flow is the fourteen screens of §5, in the specified order', () => {
  assert.equal(OB_STEP_COUNT, 14);
  // Each screen implements exactly its own row of the §5 table, 1..14 in order.
  OB_SCREENS.forEach((s, i) => assert.equal(s.spec, i + 1, `${s.id} is out of order`));
  assert.equal(OB_SCREENS[0]!.id, 'welcome');
  assert.equal(OB_SCREENS[13]!.id, 'ready');
});

test('screen ids are unique', () => {
  assert.equal(new Set(OB_SCREENS.map((s) => s.id)).size, OB_SCREENS.length);
});

test('the bounded counter runs over the question screens only', () => {
  const questions = OB_SCREENS.filter((s) => s.question);
  assert.equal(questions.length, 9);
  assert.equal(questionFraction(screenIndex('name')), '01/09');
  assert.equal(questionFraction(screenIndex('tracker')), '09/09');
  // An explaining screen carries no fraction — it is a payoff, not a step.
  assert.equal(questionFraction(screenIndex('welcome')), null);
  assert.equal(questionFraction(screenIndex('ready')), null);
  assert.equal(questionFraction(-1), null, 'out of range');
  assert.equal(questionFraction(99), null, 'out of range');
});

// --- goal → focus, the owner's 29 Jul ruling -------------------------------------

test('five goals are offered and every one maps to a real engine focus', () => {
  assert.equal(GOALS.length, 5);
  for (const goal of GOALS) {
    const focus = focusForGoal(goal);
    assert.ok(focus, `${goal} has no focus`);
    assert.ok(FOCUS_REP_RANGE[focus], `${goal} maps to a focus the engine does not know`);
  }
});

test('the two new goals resolve to the classic middle, changing no prescription', () => {
  assert.equal(focusForGoal('fitness'), 'both');
  assert.equal(focusForGoal('sport'), 'both');
  assert.equal(focusForGoal('both'), 'both');
  // The two that already drove the engine are untouched.
  assert.equal(focusForGoal('strength'), 'strength');
  assert.equal(focusForGoal('muscle'), 'muscle');
});

test('an unanswered goal has no focus, and the engine falls back on its own', () => {
  assert.equal(focusForGoal(null), null);
  assert.equal(focusForGoal(undefined), null);
});

test('isGoal rejects the old three-value union leaking back in as a string', () => {
  assert.equal(isGoal('strength'), true);
  assert.equal(isGoal('sport'), true);
  assert.equal(isGoal('hypertrophy'), false);
  assert.equal(isGoal(''), false);
  assert.equal(isGoal(null), false);
});

// --- the other answers -------------------------------------------------------------

test('experience changes explanation, never prescription', () => {
  assert.equal(isExperience('new'), true);
  assert.equal(isExperience('pro'), false);
  assert.equal(wantsExplanation('new'), true);
  assert.equal(wantsExplanation('building'), true);
  assert.equal(wantsExplanation('experienced'), false);
  assert.equal(wantsExplanation(null), true, 'unanswered still explains');
});

test('training style decides whether gym examples lead (§5.1)', () => {
  assert.equal(isTrainingStyle('gym'), true);
  assert.equal(isTrainingStyle('crossfit'), false);
  assert.equal(gymLeads('gym'), true);
  assert.equal(gymLeads('hybrid'), true);
  assert.equal(gymLeads('sport'), false, 'a sport athlete does not get gym screens first');
  assert.equal(gymLeads(null), true);
});

test('session feel is a closed set', () => {
  assert.equal(isSessionFeel('structured'), true);
  assert.equal(isSessionFeel('sportLed'), true);
  assert.equal(isSessionFeel('whatever'), false);
});

// --- the weekly rhythm ---------------------------------------------------------------

test('days are a Monday-first mask', () => {
  assert.equal(DAY_LABELS[0], 'Mon');
  assert.equal(DAY_LABELS[6], 'Sun');
  const monWedFri = toggleDay(toggleDay(toggleDay(0, 0), 2), 4);
  assert.equal(hasDay(monWedFri, 0), true);
  assert.equal(hasDay(monWedFri, 1), false);
  assert.equal(dayCount(monWedFri), 3);
  assert.equal(daysLabel(monWedFri), 'Mon, Wed, Fri');
});

test('toggling a day twice returns the mask untouched', () => {
  assert.equal(toggleDay(toggleDay(0b0000101, 3), 3), 0b0000101);
});

test('a day outside the week cannot corrupt the mask', () => {
  assert.equal(toggleDay(0b0000001, 7), 0b0000001);
  assert.equal(toggleDay(0b0000001, -1), 0b0000001);
  assert.equal(hasDay(ALL_DAYS_MASK, 7), false);
});

test('normalizeDayMask treats anything that is not a rhythm as unanswered', () => {
  assert.equal(normalizeDayMask(0b1010101), 0b1010101);
  assert.equal(normalizeDayMask('5'), 5);
  assert.equal(normalizeDayMask(0), 0);
  assert.equal(normalizeDayMask(-3), 0);
  assert.equal(normalizeDayMask('nonsense'), 0);
  assert.equal(normalizeDayMask(null), 0);
  // Bits above the week are discarded rather than trusted.
  assert.equal(normalizeDayMask(0b11111111), ALL_DAYS_MASK);
});

test('daysLabel says nothing when nothing was chosen', () => {
  assert.equal(daysLabel(0), '');
});

// --- body context, which is optional and must stay optional ---------------------------

test('bodyweight is stored in kilograms whatever was typed', () => {
  assert.equal(parseBodyWeight('82.5', 'kg'), 82.5);
  assert.equal(parseBodyWeight('82,5', 'kg'), 82.5, 'a decimal comma is how half of Europe types');
  assert.equal(parseBodyWeight('180', 'lb'), 81.6);
});

test('a bodyweight that is not a body is refused rather than guessed', () => {
  assert.equal(parseBodyWeight('', 'kg'), null);
  assert.equal(parseBodyWeight('abc', 'kg'), null);
  assert.equal(parseBodyWeight('0', 'kg'), null);
  assert.equal(parseBodyWeight('-80', 'kg'), null);
  assert.equal(parseBodyWeight('12', 'kg'), null, 'below the human floor');
  assert.equal(parseBodyWeight('900', 'kg'), null, 'above the human ceiling');
});

test('height is stored in centimetres whatever was typed', () => {
  assert.equal(parseBodyHeight('183', 'cm'), 183);
  assert.equal(parseBodyHeight('72', 'in'), 183);
  assert.equal(parseBodyHeight('50', 'cm'), null, 'below the human floor');
  assert.equal(parseBodyHeight('300', 'cm'), null, 'above the human ceiling');
  assert.equal(parseBodyHeight('', 'cm'), null);
});

test('a stored bodyweight reads back in the unit the person uses', () => {
  assert.equal(formatBodyWeight(82.5, 'kg'), '82.5 kg');
  assert.equal(formatBodyWeight(81.6, 'lb'), '179.9 lb');
  assert.equal(formatBodyWeight(null, 'kg'), null, 'skipping changes nothing');
});

// --- the import fast path (§2.1) --------------------------------------------------------

test('the fast path is offered only to trackers Recore can actually read', () => {
  assert.equal(wantsImportFastPath('strong', false, null), true);
  assert.equal(wantsImportFastPath('hevy', false, 'import'), true);
  // Notes and a fresh start have no CSV to hand an importer.
  assert.equal(wantsImportFastPath('notes', false, null), false);
  assert.equal(wantsImportFastPath('none', false, null), false);
  assert.equal(wantsImportFastPath(null, false, null), false);
});

test('the fast path is offered once and never again', () => {
  assert.equal(wantsImportFastPath('strong', true, null), false);
});

test('someone who said they would rather just write is not sent to import', () => {
  // The last onboarding screen asks this. Until the fast path existed the
  // answer was stored and read by nothing, which is what §5 deletes a question
  // for — honouring it is what makes the question real.
  assert.equal(wantsImportFastPath('strong', false, 'write'), false);
});

test('row counts are reported as buckets, never as an exact count', () => {
  assert.equal(rowCountBucket(0), '0');
  assert.equal(rowCountBucket(-5), '0');
  assert.equal(rowCountBucket(1), '1-49');
  assert.equal(rowCountBucket(49), '1-49');
  assert.equal(rowCountBucket(50), '50-199');
  assert.equal(rowCountBucket(199), '50-199');
  assert.equal(rowCountBucket(200), '200-999');
  assert.equal(rowCountBucket(1000), '1000-4999');
  assert.equal(rowCountBucket(50_000), '5000+');
});
