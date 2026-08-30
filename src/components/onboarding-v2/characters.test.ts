import assert from 'node:assert/strict';
import test from 'node:test';

import { characterFor, ORDER, PRESENCE, RESOLVED } from './characters.ts';
import { FLOW, LAST_STEP, railProgress } from './flow.ts';

/**
 * The character rule is the one piece of this flow that is asserted rather than
 * looked at, because §4 states it as data and then states two rules that
 * contradict the data. A screenshot cannot tell you the resolver still holds
 * after someone edits the table; this can.
 */

test('rule 1 — the character never sits next to a number', () => {
  for (const [id, decl] of Object.entries(PRESENCE)) {
    if (!decl.nearNumber) continue;
    assert.equal(
      characterFor(id),
      null,
      `${id} puts the character beside a figure and must be dropped`,
    );
  }
});

/**
 * The table is keyed by id and the resolver walks `ORDER`, which is a hand-kept
 * copy of the flow's running order (`characters.ts` has no imports so it can be
 * tested here). This is what stops the copy drifting from the real thing.
 */
test('ORDER matches FLOW exactly', () => {
  assert.deepEqual(ORDER, FLOW.map((s) => s.id));
});

test('rule 2 — the character never appears on two consecutive screens', () => {
  const positions = Object.keys(RESOLVED)
    .map((id) => ORDER.indexOf(id))
    .sort((a, b) => a - b);
  for (let i = 1; i < positions.length; i += 1) {
    assert.notEqual(
      positions[i] - positions[i - 1],
      1,
      `${ORDER[positions[i - 1]]} and ${ORDER[positions[i]]} are adjacent and both show it`,
    );
  }
});

test('a conflicting pair is resolved by weight, not by order', () => {
  // commit and building are both declared present and adjacent. building
  // carries more weight (the flow's signature placement) so commit yields.
  assert.equal(characterFor('commit'), null);
  assert.notEqual(characterFor('building'), null);
});

test('the resolved set is welcome, the obstacle insight, greeting and building', () => {
  assert.deepEqual(Object.keys(RESOLVED).sort(), [
    'building',
    'greeting',
    'obstacle-insight',
    'welcome',
  ]);
});

/**
 * The reason the table stopped being keyed by position. Inserting the two
 * insight screens on 28 Aug 2026 would have moved the mascot onto whichever
 * screens inherited 8, 14, 15, 16 and 17 — silently, with every test still
 * green.
 */
test('inserting a screen never moves the character', () => {
  for (const id of Object.keys(RESOLVED)) {
    assert.ok(FLOW.some((s) => s.id === id), `${id} is not a screen in the flow`);
  }
});

test('every declared screen is a real screen in the flow', () => {
  for (const id of Object.keys(PRESENCE)) {
    assert.ok(FLOW.some((s) => s.id === id), `${id} is not a screen in the flow`);
  }
});

/** §2: "The screen list below is fixed." A test is the cheapest way to notice
 * that somebody added, removed or reordered one. */
test('the flow is twenty screens, numbered in order', () => {
  // Eighteen by the original spec; the two insight screens were added by the
  // owner on 28 Aug 2026 and the spec was amended in the same change.
  assert.equal(FLOW.length, 20);
  assert.equal(LAST_STEP, 20);
  FLOW.forEach((screen, i) => {
    assert.equal(screen.step, i + 1, `screen at index ${i} claims step ${screen.step}`);
  });
});

test('every screen has a unique analytics id', () => {
  const ids = new Set(FLOW.map((s) => s.id));
  assert.equal(ids.size, FLOW.length);
});

test('every option has a unique id and a label', () => {
  for (const screen of FLOW) {
    if (!screen.options) continue;
    const ids = new Set(screen.options.map((o) => o.id));
    assert.equal(ids.size, screen.options.length, `${screen.id} has duplicate option ids`);
    for (const option of screen.options) {
      assert.ok(option.label.length > 0, `${screen.id}/${option.id} has no label`);
    }
  }
});

/**
 * THE GLYPH RULES. The flow contains NO EMOJI — the last two became drawn
 * marks on 28 Aug 2026 — so these guard the replacement and the door the emoji
 * came in through. Asserted rather than trusted because the failure mode is
 * incremental: nobody adds five mismatched glyphs at once, they add one to the
 * screen they happen to be editing.
 */

test('no emoji anywhere in the flow — every glyph is a drawn mark', () => {
  const SURROGATE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/u;
  for (const screen of FLOW) {
    const strings = [screen.headline, screen.subline ?? '', screen.banner ?? ''];
    for (const option of screen.options ?? []) strings.push(option.label, option.sub ?? '');
    for (const text of strings) {
      assert.ok(!SURROGATE.test(text), `${screen.id} carries an emoji in "${text}"`);
    }
  }
});

test('marks are a per-screen decision — a list is all or none', () => {
  for (const screen of FLOW) {
    const listed = (screen.options ?? []).filter((o) => !o.optOut);
    if (listed.length === 0) continue;
    const withMark = listed.filter((o) => o.icon).length;
    assert.ok(
      withMark === 0 || withMark === listed.length,
      `${screen.id} has ${withMark} marks across ${listed.length} options — ` +
        'a list with some glyphs and some bare rows is the case this rule exists to stop',
    );
  }
});

test('exactly two screens carry a leading mark, and they are the expected two', () => {
  const withMarks = FLOW.filter((screen) => (screen.options ?? []).some((o) => o.icon)).map(
    (s) => s.id,
  );
  // 4 attribution (brand marks) · 18 recap (time of day).
  assert.deepEqual(withMarks.sort(), ['attribution', 'recap']);
});

test('an opt-out never carries a mark — it is outside the family by definition', () => {
  for (const screen of FLOW) {
    for (const option of screen.options ?? []) {
      if (!option.optOut) continue;
      assert.equal(option.icon, undefined, `${screen.id}/${option.id} opt-out has a mark`);
    }
  }
});

test('numbers, durations and abstract states carry no mark at all', () => {
  for (const id of ['frequency', 'experience', 'goal', 'split', 'obstacles', 'lifts', 'tracker']) {
    const screen = FLOW.find((s) => s.id === id);
    if (!screen) continue;
    for (const option of screen.options ?? []) {
      assert.equal(option.icon, undefined, `${id}/${option.id} should carry no mark`);
    }
  }
});

/**
 * THE GHOST-ROW RULE (owner, 28 Aug 2026): a ghost row is for an answer that
 * gives the app NOTHING, not for one that merely declines the question. An
 * option that turns on a distinct code path is a peer row, because a branch
 * that is visually demoted gets under-selected and a branch that is
 * under-selected ships under-tested.
 */
test('an option that drives a branch in app logic is never an opt-out', () => {
  for (const screen of FLOW) {
    for (const option of screen.options ?? []) {
      if (!option.drivesBranch) continue;
      assert.ok(
        !option.optOut,
        `${screen.id}/${option.id} drives a branch and must be a peer row, not a ghost row`,
      );
    }
  }
});

test('"I don\'t follow a split" is a peer row on a five-row screen', () => {
  const split = FLOW.find((s) => s.id === 'split');
  assert.ok(split);
  const options = split.options ?? [];
  assert.equal(options.length, 5);
  assert.equal(options.filter((o) => o.optOut).length, 0, 'screen 12 has no ghost row');
  const flat = options.find((o) => o.id === 'flat');
  assert.ok(flat?.drivesBranch, 'flat mode is a branch and must be declared as one');
  assert.equal(flat?.icon, undefined);
});

/**
 * The emoji are gone, but the door they came in through is still there: a label
 * is a string and nothing stops somebody typing a glyph into one. These guard
 * the copy rather than a glyph field.
 */
test('no keycap sequence, skin tone, flag or human figure in any label', () => {
  for (const screen of FLOW) {
    const strings = [screen.headline, screen.subline ?? '', screen.banner ?? ''];
    for (const option of screen.options ?? []) strings.push(option.label, option.sub ?? '');
    for (const text of strings) {
      for (const ch of text) {
        const cp = ch.codePointAt(0) ?? 0;
        assert.ok(cp !== 0x20e3, `${screen.id}: keycap sequence in "${text}"`);
        assert.ok(cp < 0x1f3fb || cp > 0x1f3ff, `${screen.id}: skin tone in "${text}"`);
        assert.ok(cp < 0x1f1e6 || cp > 0x1f1ff, `${screen.id}: flag in "${text}"`);
        assert.ok(
          !(cp >= 0x1f645 && cp <= 0x1f64f) && !(cp >= 0x1f3c3 && cp <= 0x1f3ce),
          `${screen.id}: human figure in "${text}"`,
        );
      }
    }
  }
});

test('the attribution screen uses brand marks, never emoji approximations', () => {
  const screen = FLOW.find((s) => s.id === 'attribution');
  assert.ok(screen);
  for (const option of screen.options ?? []) {
    if (option.optOut) continue;
    assert.ok(option.icon, `attribution/${option.id} needs a real mark`);
  }
});




/** §3: "Reaches 100% at screen 17, not at the paywall." */
test('the rail is absent on welcome and full from the reveal', () => {
  assert.equal(railProgress('welcome'), null);
  assert.equal(railProgress('reveal'), 1);
  assert.equal(railProgress('recap'), 1);
  const second = railProgress('tracker');
  assert.ok(second !== null && second > 0 && second < 1);
});

test('the rail only ever moves forward', () => {
  let previous = 0;
  for (const screen of FLOW.slice(1)) {
    const value = railProgress(screen.id);
    assert.ok(value !== null);
    assert.ok(value >= previous, `rail went backwards at ${screen.id}`);
    previous = value;
  }
});
