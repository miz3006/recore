import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  inflate,
  pageRect,
  placeCard,
  scrimPathD,
  tabBarRect,
  TOUR_STEPS,
} from './tour.ts';

const WIN = { w: 390, h: 844 };

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
  const tab = tabBarRect(WIN, 34, 56, 8);
  const page = pageRect(WIN, 120, tab.y, 8);
  assert.equal(page.y, 128);
  assert.equal(page.x + page.w, WIN.w - 8);
  assert.ok(page.y + page.h <= tab.y);
  assert.ok(page.h > 0);
});

test('pageRect never goes negative when the space runs out', () => {
  const page = pageRect(WIN, 800, 810, 8);
  assert.equal(page.h, 0);
});

test('tabBarRect stays inside the window', () => {
  const tab = tabBarRect(WIN, 34, 56, 8);
  assert.equal(tab.y, WIN.h - 34 - 56);
  assert.ok(tab.y + tab.h <= WIN.h);
  assert.equal(tab.w, WIN.w - 16);
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

test('placeCard prefers below the hole', () => {
  const top = placeCard({ x: 0, y: 100, w: 390, h: 50 }, WIN, 180, 20, 60);
  assert.equal(top, 170);
});

test('placeCard flips above when below would leave the window', () => {
  const top = placeCard({ x: 0, y: 700, w: 390, h: 100 }, WIN, 180, 20, 60);
  assert.equal(top, 500); // 700 - 20 - 180
});

test('placeCard clamps under the header when nothing fits', () => {
  const top = placeCard({ x: 0, y: 10, w: 390, h: 820 }, WIN, 180, 20, 60);
  assert.equal(top, 60);
});
