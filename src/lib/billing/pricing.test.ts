import assert from 'node:assert/strict';
import { test } from 'node:test';

import { perMonth, savePct } from './pricing.ts';

test('savePct is the real discount against twelve monthly payments', () => {
  // A worked example, not a shipped price — no price is hardcoded in the app.
  // 59.99 against 12 × 8.99 = 107.88 → 44%.
  assert.equal(savePct(8.99, 59.99), 44);
  assert.equal(savePct(10, 60), 50);
});

test('savePct refuses a comparison it cannot make honestly', () => {
  assert.equal(savePct(null, 59.99), null, 'no monthly price');
  assert.equal(savePct(8.99, null), null, 'no annual price');
  assert.equal(savePct(0, 59.99), null, 'a free monthly is not a baseline');
  assert.equal(savePct(Number.NaN, 59.99), null);
  assert.equal(savePct(-1, 59.99), null);
});

test('savePct returns null rather than a badge that flatters', () => {
  assert.equal(savePct(5, 60), null, 'annual costs exactly a year of monthly');
  assert.equal(savePct(5, 120), null, 'annual is worse');
  // 0.4% rounds to 0 — no badge rather than "SAVE 0%".
  assert.equal(savePct(5, 59.8), null);
});

test('perMonth is the annual price divided by twelve, to the cent', () => {
  assert.equal(perMonth(59.99), 5);
  assert.equal(perMonth(120), 10);
  assert.equal(perMonth(100), 8.33);
});

test('perMonth refuses a price it cannot divide', () => {
  assert.equal(perMonth(null), null);
  assert.equal(perMonth(0), null);
  assert.equal(perMonth(Number.NaN), null);
});
