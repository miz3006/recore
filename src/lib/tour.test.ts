import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  caretOffset,
  inflate,
  pageRect,
  placeCard,
  scrimPathD,
  tabBarRect,
  tabSlotRect,
  TAB_COUNT,
  TOUR_STEPS,
} from './tour.ts';

const WIN = { w: 390, h: 844 };
// The measured floating-bar geometry (`theme/spacing.ts`), restated here so
// this file stays importable from node.
const MARGIN = 22;
const BAR_H = 62;
const SLOT_PAD = 8;

// --- The step list is copy as much as it is structure, so §15 is a test.

test('steps: unique ids, every step titled and bodied', () => {
  const ids = TOUR_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, TOUR_STEPS.length);
  for (const s of TOUR_STEPS) {
    assert.ok(s.title.length > 0);
    assert.ok(s.body.length > 0);
    assert.ok(s.body.endsWith('.'));
  }
});

test('steps: §15 voice — no exclamation, no "AI", no emoji', () => {
  for (const s of TOUR_STEPS) {
    const text = `${s.title} ${s.body}`;
    assert.ok(!text.includes('!'), `"${s.id}" shouts`);
    assert.ok(!/\bAI\b/.test(text), `"${s.id}" says AI`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(text), `"${s.id}" carries an emoji`);
  }
});

test('steps: the tour opens on the page and ends on a tab', () => {
  assert.equal(TOUR_STEPS[0].target, 'page');
  assert.equal(TOUR_STEPS[TOUR_STEPS.length - 1].target, 'tabBar');
});

test('steps: the five of §7, in the specified order', () => {
  // Asserted against the specification rather than against itself. §7's table
  // is: writing surface → finish and check-in → Next → Progress → You.
  assert.deepEqual(
    TOUR_STEPS.map((s) => s.id),
    ['page', 'finish', 'next', 'progress', 'you'],
  );
});

test('steps: the check-in step teaches the check-in', () => {
  // §7 step 2 is "After training, add a few words about energy, fatigue,
  // food/recovery, or anything that mattered." A step that only mentions
  // Finish would leave the reflection untaught, which is what it is for.
  const finish = TOUR_STEPS.find((s) => s.id === 'finish');
  assert.ok(finish);
  const text = `${finish.title} ${finish.body}`.toLowerCase();
  assert.ok(text.includes('finish'), 'never names Finish');
  for (const word of ['energy', 'fatigue']) {
    assert.ok(text.includes(word), `never mentions ${word}`);
  }
  // And it must not promise the app judges any of it (§8.1).
  assert.ok(!/\b(should|must|need to)\b/.test(text), 'instructs the athlete');
});

test('steps: every target is one the component can actually measure', () => {
  for (const s of TOUR_STEPS) {
    assert.ok(['page', 'tabBar', 'dayPill'].includes(s.target), `${s.id} has no target`);
  }
});

test('steps: each tab beat names ONE tab, and never the one already open', () => {
  // The defect this replaced: three beats resolving to the whole bar, so
  // "Next", "Progress" and "You" each lit all four tabs.
  const tabs = TOUR_STEPS.filter((s) => s.target === 'tabBar').map((s) => s.tab);
  assert.ok(tabs.length >= 1);
  for (const t of tabs) {
    assert.equal(typeof t, 'number');
    assert.ok(t !== undefined && t > 0 && t < TAB_COUNT, `tab ${t} is not a tab the tour can show`);
  }
  assert.equal(new Set(tabs).size, tabs.length, 'two beats light the same tab');
});

test('steps: a page beat carries no tab index, and every step carries a glyph', () => {
  for (const s of TOUR_STEPS) {
    if (s.target !== 'tabBar') assert.equal(s.tab, undefined, `${s.id} points at a tab it is not`);
    assert.ok(s.glyph.startsWith('tour-'), `${s.id} has no glyph`);
  }
  assert.equal(new Set(TOUR_STEPS.map((s) => s.glyph)).size, TOUR_STEPS.length);
});

// --- Geometry.

test('inflate grows the rect and clamps the radius to a pill', () => {
  const hole = inflate({ x: 100, y: 200, w: 120, h: 20 }, 6, 999);
  assert.deepEqual(
    { x: hole.x, y: hole.y, w: hole.w, h: hole.h },
    { x: 94, y: 194, w: 132, h: 32 },
  );
  assert.equal(hole.r, 16); // half the hole's height — a pill, not a blob
});

test('pageRect sits between the header and the tab bar', () => {
  const tab = tabBarRect(WIN, MARGIN, BAR_H);
  const page = pageRect(WIN, 120, tab.y, 8);
  // Flush against the header — the weekly line starts a few points under it and
  // an inset here would cut the hole's edge through that text.
  assert.equal(page.y, 120);
  assert.equal(page.x + page.w, WIN.w - 8);
  assert.equal(page.y + page.h, tab.y - 8);
  assert.ok(page.h > 0);
});

test('pageRect never goes negative when the space runs out', () => {
  // A header taller than the space above the bar: the step is dropped rather
  // than drawn as an inverted rectangle.
  const page = pageRect(WIN, 810, 800, 8);
  assert.equal(page.h, 0);
});

test('tabBarRect is the capsule: inset equally left, right and below', () => {
  const tab = tabBarRect(WIN, MARGIN, BAR_H);
  assert.equal(tab.x, MARGIN);
  assert.equal(tab.w, WIN.w - MARGIN * 2);
  assert.equal(tab.h, BAR_H);
  assert.equal(WIN.h - (tab.y + tab.h), MARGIN);
});

test('tabSlotRect splits the capsule into even slots inside its padding', () => {
  const bar = tabBarRect(WIN, MARGIN, BAR_H);
  const slots = [0, 1, 2, 3].map((i) => tabSlotRect(bar, i, TAB_COUNT, SLOT_PAD));
  const w = slots[0].w;
  for (const s of slots) {
    assert.equal(s.w, w);
    assert.equal(s.y, bar.y);
    assert.equal(s.h, bar.h);
  }
  // The four together fill the capsule minus its padding, with no gaps.
  assert.equal(slots[0].x, bar.x + SLOT_PAD);
  assert.equal(slots[3].x + slots[3].w, bar.x + bar.w - SLOT_PAD);
  for (let i = 1; i < slots.length; i++) {
    assert.ok(Math.abs(slots[i].x - (slots[i - 1].x + w)) < 1e-9, 'slots drifted apart');
  }
});

test('tabSlotRect centres match a real bar', () => {
  // Read off the running app on a 402 x 874 pt window (iPhone 17 Pro, iOS 26.5,
  // 9 Sep 2026): the four tab centres landed on 73.5 / 159 / 244.5 / 330.
  const bar = tabBarRect({ w: 402, h: 874 }, MARGIN, BAR_H);
  const centres = [0, 1, 2, 3].map((i) => {
    const s = tabSlotRect(bar, i, TAB_COUNT, SLOT_PAD);
    return s.x + s.w / 2;
  });
  for (const [i, measured] of [73.5, 159, 244.5, 330].entries()) {
    assert.ok(Math.abs(centres[i] - measured) <= 1, `tab ${i} is ${centres[i]}, measured ${measured}`);
  }
});

test('scrimPathD is one outer rect plus one rounded hole', () => {
  const d = scrimPathD(WIN.w, WIN.h, { x: 20, y: 30, w: 100, h: 40, r: 10 });
  assert.ok(d.startsWith('M0 0H390V844H0Z'));
  assert.equal(d.match(/Z/g)?.length, 2);
  assert.equal(d.match(/A10 10/g)?.length, 4);
});

test('scrimPathD clamps an oversized radius to the hole', () => {
  const d = scrimPathD(WIN.w, WIN.h, { x: 20, y: 30, w: 100, h: 40, r: 999 });
  assert.ok(d.includes('A20 20')); // half of h=40
});

test('placeCard prefers below the hole, and points up at it', () => {
  const p = placeCard({ x: 0, y: 100, w: 390, h: 50 }, WIN, 180, 20, 60);
  assert.deepEqual(p, { top: 170, caret: 'up' });
});

test('placeCard flips above when below would leave the window', () => {
  const p = placeCard({ x: 0, y: 700, w: 390, h: 100 }, WIN, 180, 20, 60);
  assert.deepEqual(p, { top: 500, caret: 'down' }); // 700 - 20 - 180
});

test('placeCard rests INSIDE a hole too tall to stand outside of', () => {
  // The page steps. Neither side fits, so the card sits on the hole's bottom
  // edge with no caret — a pointer at the surface it is lying on says nothing.
  const p = placeCard({ x: 0, y: 10, w: 390, h: 820 }, WIN, 180, 20, 60);
  assert.deepEqual(p, { top: 630, caret: 'none' }); // 10 + 820 - 20 - 180
});

test('placeCard never goes above the header, even inside the hole', () => {
  const p = placeCard({ x: 0, y: 10, w: 390, h: 120 }, WIN, 800, 20, 60);
  assert.equal(p.top, 60);
  assert.equal(p.caret, 'none');
});

test('caretOffset aims at the hole centre', () => {
  const bar = tabBarRect(WIN, MARGIN, BAR_H);
  const slot = tabSlotRect(bar, 1, TAB_COUNT, SLOT_PAD);
  const left = 20;
  const w = WIN.w - left * 2;
  const off = caretOffset(slot, left, w, 16, 24);
  assert.equal(off + 8, slot.x + slot.w / 2 - left);
});

test('caretOffset never rides onto a rounded corner', () => {
  const w = 350;
  const far = caretOffset({ x: 380, y: 0, w: 10, h: 10 }, 20, w, 16, 24);
  assert.equal(far, w - 24 - 16); // hard against the right corner's inner edge
  const near = caretOffset({ x: 0, y: 0, w: 4, h: 10 }, 20, w, 16, 24);
  assert.equal(near, 24); // and against the left one
});
