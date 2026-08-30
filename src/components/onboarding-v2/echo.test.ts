import assert from 'node:assert/strict';
import test from 'node:test';

import { echoFor } from './echo.ts';
import { ASSUMED_BAR_KG, FLOW } from './flow.ts';
import { insightFor, yearInsight } from './insights.ts';
import { firstSessionTargets, loadableKg } from './projection.ts';
import type { V2Answers } from '../../state/onboarding-v2.ts';

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

// --- (d) the answer echo -------------------------------------------------------

test('an unanswered flow echoes nothing at all', () => {
  for (const screen of FLOW) {
    assert.equal(echoFor(screen.id, answers()), null, `${screen.id} echoed with no answers`);
  }
});

test('the echo states the CONSEQUENCE, not the answer', () => {
  // "2 to 5 years" must not come back as "2 to 5 years".
  const e = echoFor('frequency', answers({ experience: '2y5y' }));
  assert.equal(e, 'Steps of 2.5 kg, every 3 sessions');
  assert.ok(!e.includes('2 to 5 years'));

  const split = echoFor('lifts', answers({ split: 'flat' }));
  assert.equal(split, 'Scheduled by lift, not by day');
  assert.ok(!split.toLowerCase().includes("don't follow"));
});

test('every echoed number is computed from the answer, not asserted', () => {
  assert.equal(
    echoFor('frequency', answers({ experience: 'under6m' })),
    'Steps of 5 kg, every 1 session',
  );
  assert.equal(
    echoFor('frequency', answers({ experience: 'over5y' })),
    'Steps of 1.25 kg, every 4 sessions',
  );
  assert.equal(
    echoFor('year-insight', answers({ frequency: '4' })),
    '4 sessions a week to schedule',
  );
});

test('attribution never echoes — it changes nothing in the product', () => {
  assert.equal(echoFor('demo', answers({ attribution: 'tiktok' })), null);
});

test('the echo never praises, encourages or claims anything about the person', () => {
  const BANNED = /\b(great|nice|awesome|perfect|well done|amazing|you're|congrat|keep it up)\b/i;
  const filled = answers({
    tracker: 'app',
    obstacles: ['typing', 'quit'],
    goal: 'strength',
    experience: '2y5y',
    frequency: '4',
    split: 'ppl',
    keyLifts: ['Bench press'],
    liftLoads: { 'Bench press': 80 },
    smallestPlateKg: 1.25,
    committed: true,
    demoEntries: [{} as never],
  });
  for (const screen of FLOW) {
    const line = echoFor(screen.id, filled);
    if (!line) continue;
    assert.ok(!BANNED.test(line), `${screen.id} echoed praise: "${line}"`);
    assert.ok(line.length <= 64, `${screen.id} echo is too long to be a caption: "${line}"`);
  }
});

// --- (c) plates ----------------------------------------------------------------

test('an unknown smallest plate rounds nothing', () => {
  assert.equal(loadableKg(82.5, null), 82.5);
  const t = firstSessionTargets(
    answers({ keyLifts: ['Bench press'], liftLoads: { 'Bench press': 80 }, experience: '6m2y' }),
  )[0];
  assert.equal(t.targetKg, 82.5);
  assert.equal(t.rounded, false);
  assert.equal(t.platesKnown, false);
});

test('a known smallest plate makes every target loadable on a real bar', () => {
  // 2.5 is the smallest plate, so loads move in 5 kg steps from the bar.
  assert.equal(loadableKg(82.5, 2.5), 80);
  assert.equal(loadableKg(80, 2.5), 80);
  // 1.25 a side gives 2.5 kg steps, so 82.5 is reachable.
  assert.equal(loadableKg(82.5, 1.25), 82.5);
  assert.equal(loadableKg(81, 1.25), 80);
});

test('loadableKg itself always rounds down to something buildable', () => {
  for (const plate of [1.25, 2.5, 5]) {
    for (const target of [61, 72.4, 83.7, 100.1]) {
      const got = loadableKg(target, plate);
      assert.ok(got <= target, `${target} with ${plate} rounded UP to ${got}`);
      assert.ok(target - got < plate * 2, `${target} with ${plate} lost more than one step`);
      // And what is left is buildable: bar + whole steps of two plates.
      const above = got - ASSUMED_BAR_KG;
      assert.ok(Math.abs(above / (plate * 2) - Math.round(above / (plate * 2))) < 1e-6);
    }
  }
});

test('a prescription is never a non-increase', () => {
  // 82.5 is not loadable with 2.5s. Rounding down would land on 80 — the load
  // they already lift — so the target goes UP to the next loadable weight.
  const t = firstSessionTargets(
    answers({
      keyLifts: ['Bench press'],
      liftLoads: { 'Bench press': 80 },
      experience: '6m2y',
      smallestPlateKg: 2.5,
    }),
  )[0];
  assert.equal(t.targetKg, 85);
  assert.ok(t.targetKg > t.currentKg);
  assert.equal(t.rounded, true);
  assert.equal(t.platesKnown, true);
});

test('the stated increment always equals the real delta', () => {
  for (const plate of [null, 1.25, 2.5, 5]) {
    for (const current of [60, 80, 82.5, 100]) {
      for (const exp of ['under6m', '6m2y', '2y5y', 'over5y']) {
        const t = firstSessionTargets(
          answers({
            keyLifts: ['Bench press'],
            liftLoads: { 'Bench press': current },
            experience: exp,
            smallestPlateKg: plate,
          }),
        )[0];
        assert.equal(
          t.addedKg,
          Math.round((t.targetKg - t.currentKg) * 100) / 100,
          `plate ${plate}, ${current} kg, ${exp}: the line under the number would be a lie`,
        );
        assert.ok(t.targetKg > t.currentKg, `plate ${plate}, ${current} kg, ${exp}: no increase`);
      }
    }
  }
});

// --- (a) notifications ---------------------------------------------------------

test('exactly one screen asks the OS for a permission, and it is the recap', () => {
  const asking = FLOW.filter((s) => s.requestsNotifications).map((s) => s.id);
  assert.deepEqual(asking, ['recap']);
});

// --- the two insight screens ---------------------------------------------------

test('an insight screen says nothing when the answer it needs is missing', () => {
  assert.equal(insightFor('obstacle-insight', answers()), null);
  assert.equal(insightFor('year-insight', answers()), null);
  assert.equal(insightFor('year-insight', answers({ frequency: 'nonsense' })), null);
});

test('the obstacle insight answers the obstacle they actually picked', () => {
  const forget = insightFor('obstacle-insight', answers({ obstacles: ['forget'] }));
  assert.ok(forget?.headline.toLowerCase().includes('last time'));
  const typing = insightFor('obstacle-insight', answers({ obstacles: ['typing'] }));
  assert.ok(typing?.headline.toLowerCase().includes('one line'));
  assert.notEqual(forget?.headline, typing?.headline);
});

test('the tracker answer changes the obstacle insight without changing its claim', () => {
  const plain = insightFor('obstacle-insight', answers({ obstacles: ['forget'] }));
  const fromApp = insightFor(
    'obstacle-insight',
    answers({ obstacles: ['forget'], tracker: 'app' }),
  );
  assert.equal(plain?.headline, fromApp?.headline);
  assert.ok(fromApp!.body.length > plain!.body.length);
  assert.ok(fromApp!.body.includes('history can come with you'));
});

test('the year insight is multiplication, and nothing but multiplication', () => {
  for (const [freq, expected] of [
    ['2', 104],
    ['3', 156],
    ['4', 208],
    ['5', 260],
    ['6', 312],
  ] as const) {
    const i = yearInsight(answers({ frequency: freq }));
    assert.equal(i?.sessions, expected);
    assert.equal(i?.sessions, Number(freq) * 52);
    assert.ok(i!.headline.includes(String(expected)));
    assert.equal(i!.accent, String(expected));
  }
});

/**
 * THE RULE THESE SCREENS EXIST UNDER.
 *
 * Cal AI's equivalent reads "90% of users say that the change is obvious" —
 * a fabricated statistic about other people, which CLAUDE.md §2 rule 2 and §3
 * forbid outright. Every line in `insights.ts` has to be either arithmetic on
 * this person's own answers or a fact about how the app works.
 */
test('no insight claims anything about other people or about health', () => {
  const BANNED =
    /\b(\d+\s*%|percent|users say|most people|studies|research shows|proven|scientifically|burn fat|lose weight|guarantee|will get|you'll gain|transform)\b/i;
  const filled = answers({
    tracker: 'app',
    obstacles: ['typing', 'quit'],
    goal: 'strength',
    experience: '2y5y',
    frequency: '4',
  });
  for (const id of ['obstacle-insight', 'year-insight']) {
    for (const obstacle of ['typing', 'supersets', 'forget', 'whatnext', 'quit']) {
      for (const tracker of ['app', 'paper', 'notes', 'excel', 'memory']) {
        const i = insightFor(id, { ...filled, obstacles: [obstacle], tracker });
        if (!i) continue;
        for (const text of [i.headline, i.body]) {
          assert.ok(!BANNED.test(text), `${id}/${obstacle}: unsupported claim in "${text}"`);
        }
        assert.ok(i.headline.includes(i.accent), `${id}/${obstacle}: accent is not in the headline`);
      }
    }
  }
});

test('every obstacle and every goal has an insight — no silent gaps', () => {
  const obstacles = FLOW.find((s) => s.id === 'obstacles')?.options ?? [];
  for (const option of obstacles) {
    assert.ok(
      insightFor('obstacle-insight', answers({ obstacles: [option.id] })),
      `no insight written for obstacle "${option.id}"`,
    );
  }
  const goals = FLOW.find((s) => s.id === 'goal')?.options ?? [];
  for (const option of goals) {
    const i = yearInsight(answers({ frequency: '3', goal: option.id }));
    assert.ok(i, `no year insight for goal "${option.id}"`);
    assert.ok(i.body.length > 40, `goal "${option.id}" got a stub`);
  }
});

test('the insight screens sit where the answers they need already exist', () => {
  const at = (id: string) => FLOW.findIndex((s) => s.id === id);
  // The obstacle insight must come after the obstacles are picked.
  assert.ok(at('obstacle-insight') > at('obstacles'));
  // The year insight needs the frequency, and reads better once the goal is in.
  assert.ok(at('year-insight') > at('frequency'));
  assert.ok(at('year-insight') > at('goal'));
  // Neither may reach forward for a lift or a load it cannot have yet.
  assert.ok(at('year-insight') < at('lifts'));
});
