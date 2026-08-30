import assert from 'node:assert/strict';
import test from 'node:test';

import type { V2Answers } from '../../state/onboarding-v2.ts';
import { ALL_HEADLINES, MAX_LINE_DELTA, paywallCopy } from './copy.ts';
import { reminderDay, trialTimeline } from './timeline.ts';

/**
 * The paywall is the one screen in the funnel where a wrong number costs money
 * and a fabricated line is a release blocker (CLAUDE.md §3). Both of its
 * variable parts are pure functions for exactly that reason, and this is what
 * holds them to their contract.
 *
 * **THE EMPTY RUN IS TESTED FIRST AND HARDEST.** It is the version that ships
 * the day something upstream breaks, the version someone reaching the paywall
 * from Settings sees, and the version a person who did v1 onboarding sees. The
 * personalised cases below it are the ones that have to earn their place.
 */

function answers(partial: Partial<V2Answers> = {}): V2Answers {
  return {
    tracker: null,
    obstacles: [],
    attribution: null,
    demoText: '',
    demoEntries: [],
    name: '',
    goal: null,
    experience: null,
    frequency: null,
    split: null,
    keyLifts: [],
    liftLoads: {},
    smallestPlateKg: null,
    committed: false,
    recap: null,
    notificationsGranted: null,
    ...partial,
  };
}

/** A complete run: named, obstacle picked, goal and frequency answered, lifts
 * entered, plates known. */
function lifter(obstacle: string) {
  return answers({
    name: 'Edis',
    obstacles: [obstacle],
    goal: 'strength',
    frequency: '4',
    experience: '2y5y', // +2.5 kg
    keyLifts: ['Bench press', 'Squat'],
    liftLoads: { 'Bench press': 80, Squat: 100 },
    smallestPlateKg: 1.25,
  });
}

/* ── the fallback, which is the real screen ───────────────────────────────── */

test('an empty run still produces a complete screen', () => {
  const c = paywallCopy(answers());
  for (const [field, value] of Object.entries({
    headline: c.headline,
    support: c.support,
    today: c.today,
  })) {
    assert.ok(value.trim().length > 0, `${field} is empty`);
  }
  assert.equal(c.hasNumber, false);
  assert.equal(c.hasName, false);
  assert.equal(c.todayStrong, null);
});

test('an empty run states no number anywhere — never an invented one', () => {
  const c = paywallCopy(answers());
  assert.doesNotMatch(c.today, /\d/);
  assert.doesNotMatch(c.support, /\d/);
  assert.doesNotMatch(c.headline, /\d/);
});

test('every sentence in the fallback ends as a sentence', () => {
  const c = paywallCopy(answers());
  assert.match(c.headline.trim(), /\.$/);
  assert.match(c.support.trim(), /\.$/);
  assert.match(c.today.trim(), /\.$/);
});

test('the fallback survives an answer set that is present but unrecognised', () => {
  // A stale persisted answer from a flow that has since changed its option ids.
  const c = paywallCopy(answers({ goal: 'telepathy', frequency: '99', obstacles: ['nostalgia'] }));
  assert.ok(c.headline.length > 0);
  assert.doesNotMatch(c.support, /telepathy|99|undefined|null/);
});

/* ── the headline: screen 3 ───────────────────────────────────────────────── */

test('the headline names the obstacle they picked on screen 3', () => {
  const seen = new Set<string>();
  for (const id of ['typing', 'supersets', 'forget', 'whatnext', 'quit']) {
    const { headline } = paywallCopy(lifter(id));
    assert.ok(headline.length > 0, `${id} has no headline`);
    assert.ok(!seen.has(headline), `${id} reuses another obstacle's headline`);
    seen.add(headline);
  }
});

test('each headline is written for its obstacle, not filled in from a template', () => {
  // A template would leave every headline the same but for one slot. If any two
  // share their opening AND their closing clause, that is what has happened.
  const shapes = new Set<string>();
  for (const id of ['typing', 'supersets', 'forget', 'whatnext', 'quit']) {
    const [first, second] = paywallCopy(lifter(id)).headline.split('\n');
    const shape = `${first.split(' ').length}/${second.split(' ').length}`;
    shapes.add(shape);
  }
  assert.ok(shapes.size > 1, 'every headline has the same word shape — that is a template');
});

test('the first obstacle leads — the second does not change the headline', () => {
  const first = paywallCopy(answers({ obstacles: ['forget', 'quit'] }));
  const alone = paywallCopy(answers({ obstacles: ['forget'] }));
  assert.equal(first.headline, alone.headline);
});

test('every headline is two authored lines, balanced for optical centring', () => {
  for (const headline of ALL_HEADLINES) {
    const lines = headline.split('\n');
    assert.equal(lines.length, 2, `not two lines: ${JSON.stringify(headline)}`);
    const delta = Math.abs(lines[0].length - lines[1].length);
    assert.ok(
      delta <= MAX_LINE_DELTA,
      `lines differ by ${delta} characters, budget ${MAX_LINE_DELTA}: ${JSON.stringify(headline)}`,
    );
  }
});

/* ── the supporting line: screens 7, 9 and 11 ─────────────────────────────── */

test('the supporting line uses the name, the goal and the frequency', () => {
  const { support, hasName } = paywallCopy(lifter('whatnext'));
  assert.equal(hasName, true);
  assert.match(support, /Edis/);
  assert.match(support, /strength/);
  assert.match(support, /four sessions a week/);
});

test('a missing goal drops the goal clause and keeps the rest', () => {
  const { support } = paywallCopy(answers({ name: 'Edis', frequency: '3' }));
  assert.match(support, /Edis/);
  assert.match(support, /three sessions a week/);
  assert.doesNotMatch(support, /strength|muscle|consistency/);
});

test('a missing frequency drops the frequency clause and keeps the rest', () => {
  const { support } = paywallCopy(answers({ name: 'Edis', goal: 'hypertrophy' }));
  assert.match(support, /Edis/);
  assert.match(support, /muscle/);
  assert.doesNotMatch(support, /week/);
});

test('a skipped name leaves a sentence that still reads', () => {
  const { support, hasName } = paywallCopy(answers({ goal: 'both', frequency: '5' }));
  assert.equal(hasName, false);
  assert.match(support, /^Set up for strength and muscle, five sessions a week\.$/);
});

test('only a name, and nothing else, is still a sentence about them', () => {
  const { support } = paywallCopy(answers({ name: 'Edis' }));
  assert.match(support, /^Edis, /);
  assert.match(support, /\.$/);
});

test('the name is the first word only, and a long one is dropped rather than wrapped', () => {
  assert.match(paywallCopy(answers({ name: '  Edis Mizic ' })).support, /^Edis, /);
  const long = paywallCopy(answers({ name: 'Bartholomewwwwwwww', goal: 'strength' }));
  assert.equal(long.hasName, false);
  assert.doesNotMatch(long.support, /Bartholomew/);
  assert.match(long.support, /strength/);
});

test('every goal and every frequency the flow offers produces a line', () => {
  for (const goal of ['hypertrophy', 'strength', 'both', 'consistency', 'hybrid']) {
    for (const frequency of ['2', '3', '4', '5', '6']) {
      const { support } = paywallCopy(answers({ goal, frequency }));
      assert.match(support, /^Set up for .+\.$/, `${goal} / ${frequency}`);
      assert.doesNotMatch(support, /undefined|null/);
    }
  }
});

/* ── the number: screen 17 ────────────────────────────────────────────────── */

test('the number is the reveal’s prescribed load, not the load they typed', () => {
  // Typed 80, +2.5 for a two-to-five-year lifter, loadable on 1.25s → 82.5.
  const { today, hasNumber } = paywallCopy(lifter('whatnext'));
  assert.equal(hasNumber, true);
  assert.match(today, /82\.5 kg/);
  assert.doesNotMatch(today, /80 kg/);
});

test('the figure carries the set count, exactly as the reveal prints it', () => {
  const { today, todayStrong } = paywallCopy(lifter('whatnext'));
  // `strength` → three sets, per `firstSessionTargets`.
  assert.equal(todayStrong, '82.5 kg × 3');
  assert.ok(today.includes('82.5 kg × 3'));
});

test('the highlighted figure is a verbatim substring of the sentence', () => {
  for (const goal of ['strength', 'hypertrophy']) {
    const c = paywallCopy(answers({ ...lifter('whatnext'), goal }));
    assert.ok(c.todayStrong);
    assert.ok(
      c.today.indexOf(c.todayStrong as string) >= 0,
      `${goal}: the highlight is not in the body`,
    );
  }
});

test('the lead lift is the first one they picked', () => {
  const { today } = paywallCopy(lifter('whatnext'));
  assert.match(today, /bench press/);
  assert.doesNotMatch(today, /squat/);
});

test('no lifts entered means no number — never an invented one', () => {
  const { today, todayStrong, hasNumber } = paywallCopy(answers({ obstacles: ['typing'] }));
  assert.equal(hasNumber, false);
  assert.equal(todayStrong, null);
  assert.doesNotMatch(today, /\d/);
});

test('a key lift with no load against it produces no number either', () => {
  const bare = answers({ obstacles: ['typing'], keyLifts: ['Squat'], liftLoads: {} });
  assert.equal(paywallCopy(bare).hasNumber, false);
  assert.equal(paywallCopy(bare).todayStrong, null);
});

/* ── the line budget the layout depends on ────────────────────────────────── */

/**
 * The brief: "the screen must not scroll on a standard iPhone at default type".
 * The screen's height is fixed except for the copy, so the copy is what is
 * held to a budget. 40 characters is one line of `type.subhead` in the
 * timeline's text column on a 393 pt phone; the supporting line has the full
 * column and gets more.
 *
 * These are the numbers that were measured, not guesses — see the change log
 * entry in `docs/implementation-status.md`. A copy edit that busts one of them
 * costs a line of height, and the CTA is what pays for it.
 *
 * The two budgets are different SHAPES, not different sizes. The timeline body
 * has to hold ONE line in a 297 pt column, because three rows each gaining a
 * line is what pushed the button off the fold the first time. The supporting
 * line has the full 345 pt column and is allowed TWO — most combinations come
 * in under one, and the ceiling exists to catch a third.
 */
const TIMELINE_BODY_BUDGET = 40;
const SUPPORT_BUDGET = 84;

test('every timeline body fits one line at default type', () => {
  for (const days of [0, 7]) {
    for (const step of trialTimeline(
      days,
      { body: paywallCopy(lifter('whatnext')).today, strong: null },
      '39,99 €',
      Date.UTC(2026, 7, 28),
    )) {
      assert.ok(
        step.body.length <= TIMELINE_BODY_BUDGET,
        `${step.body.length} chars, budget ${TIMELINE_BODY_BUDGET}: ${step.body}`,
      );
    }
  }
});

test('the today line fits one line with the longest lift and load the flow allows', () => {
  const worst = answers({
    keyLifts: ['Overhead press'],
    liftLoads: { 'Overhead press': 137.5 },
    goal: 'hypertrophy',
    experience: 'under6m',
    smallestPlateKg: 1.25,
  });
  const { today } = paywallCopy(worst);
  assert.ok(today.length <= TIMELINE_BODY_BUDGET, `${today.length} chars: ${today}`);
});

test('the supporting line fits its budget in every combination', () => {
  const names = ['', 'Edis', 'Bartholomewwww']; // '' and the longest allowed
  for (const name of names) {
    for (const goal of [null, 'hypertrophy', 'strength', 'both', 'consistency', 'hybrid']) {
      for (const frequency of [null, '2', '3', '4', '5', '6']) {
        const { support } = paywallCopy(answers({ name, goal, frequency }));
        assert.ok(
          support.length <= SUPPORT_BUDGET,
          `${support.length} chars, budget ${SUPPORT_BUDGET}: ${support}`,
        );
      }
    }
  }
});

/* ── nothing anywhere is a claim about anybody else ───────────────────────── */

/**
 * The copy rules `echo.test.ts` enforces two screens earlier, enforced here.
 * A paywall is where the pressure to write one of these is highest.
 */
test('nothing in the copy is a claim about other people or a health promise', () => {
  const banned =
    /\d\s?%|users say|most people|studies show|proven|guaranteed|burn fat|lose weight|hurry|limited time|only today/i;
  for (const id of ['typing', 'supersets', 'forget', 'whatnext', 'quit', 'none']) {
    const c = paywallCopy(id === 'none' ? answers() : lifter(id));
    assert.doesNotMatch(c.headline, banned, `${id} headline`);
    assert.doesNotMatch(c.support, banned, `${id} support`);
    assert.doesNotMatch(c.today, banned, `${id} today`);
  }
});

/* ── the timeline ─────────────────────────────────────────────────────────── */

const NOW = Date.UTC(2026, 7, 28, 12, 0, 0); // 28 Aug 2026, injected so the
// charge date is a fact rather than whatever day the suite happens to run.

/** The "Today" copy the timeline is handed, in the shape it now takes. */
const TODAY = { body: 'Today body.', strong: null };

test('a seven-day offer gives the spec’s day 5 reminder and day 7 charge', () => {
  const steps = trialTimeline(7, TODAY, '39,99 €', NOW);
  assert.equal(steps.length, 3);
  assert.match(steps[1].title, /Day 5/);
  assert.match(steps[2].title, /Day 7/);
  assert.equal(steps[2].last, true);
});

test('the reminder never lands before day 1, however short the offer', () => {
  assert.equal(reminderDay(1), 1);
  assert.equal(reminderDay(2), 1);
  assert.equal(reminderDay(3), 1);
  assert.equal(reminderDay(7), 5);
});

test('the charge date is trialDays from now, not a constant', () => {
  const steps = trialTimeline(7, TODAY, '39,99 €', NOW);
  assert.match(steps[2].body, /4 Sep 2026/);
});

test('no introductory offer means no trial is promised anywhere', () => {
  const steps = trialTimeline(0, TODAY, '39,99 €', NOW);
  assert.equal(steps.length, 2);
  for (const step of steps) {
    assert.doesNotMatch(`${step.title} ${step.body}`, /free|trial/i);
  }
});

test('no price from the store means no amount is printed', () => {
  for (const days of [0, 7]) {
    for (const step of trialTimeline(days, TODAY, null, NOW)) {
      assert.doesNotMatch(step.body, /\d+[.,]\d\d/, `${days}-day timeline printed an amount`);
      assert.doesNotMatch(step.title, /\d+[.,]\d\d/);
    }
  }
});

test('the number from the copy is what the timeline’s first row carries', () => {
  const { today, todayStrong } = paywallCopy(lifter('whatnext'));
  const steps = trialTimeline(7, { body: today, strong: todayStrong }, '39,99 €', NOW);
  assert.match(steps[0].body, /82\.5 kg × 3/);
  assert.equal(steps[0].strong, '82.5 kg × 3');
});

test('the highlight only ever rides the row the number is on', () => {
  const { today, todayStrong } = paywallCopy(lifter('whatnext'));
  const steps = trialTimeline(7, { body: today, strong: todayStrong }, '39,99 €', NOW);
  for (const step of steps.slice(1)) {
    assert.ok(!step.strong, `${step.title} carries a highlight it did not earn`);
  }
});

test('a run with no number hands the timeline no highlight at all', () => {
  const { today, todayStrong } = paywallCopy(answers());
  const steps = trialTimeline(7, { body: today, strong: todayStrong }, '39,99 €', NOW);
  assert.equal(steps[0].strong, null);
});
