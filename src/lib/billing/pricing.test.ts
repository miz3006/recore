import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ALL_PLANS,
  NATIVE_PAYWALL_PLANS,
  PACKAGE_IDS,
  PRODUCT_IDS,
  perMonth,
  savePct,
  type Plan,
} from './pricing.ts';

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

/**
 * The plan tables, checked against the union rather than against each other.
 *
 * These exist because adding a plan is three edits in three places and the
 * compiler only catches two of them: a `Record<Plan, …>` forces a key, but
 * nothing forces the VALUE to be distinct or non-empty, and `ALL_PLANS` is a
 * hand-written array the type system is happy to see go stale. Weekly was added
 * on 21 Aug 2026 and this is what makes the fourth plan safe.
 */
test('every plan has a package and a product identifier', () => {
  for (const plan of ALL_PLANS) {
    assert.ok(PACKAGE_IDS[plan], `no package id for ${plan}`);
    assert.ok(PRODUCT_IDS[plan], `no product id for ${plan}`);
  }
});

test('ALL_PLANS lists every plan exactly once', () => {
  // Reading the keys off a Record<Plan, …> is the only way to enumerate the
  // union at runtime, so the table is the source and the array is the copy.
  const fromTable = Object.keys(PACKAGE_IDS).sort();
  assert.deepEqual([...ALL_PLANS].sort(), fromTable);
  assert.equal(new Set(ALL_PLANS).size, ALL_PLANS.length, 'a plan is listed twice');
});

test('package identifiers are distinct RevenueCat package types', () => {
  const ids = Object.values(PACKAGE_IDS);
  assert.equal(new Set(ids).size, ids.length, 'two plans resolve the same package');
  for (const id of ids) {
    assert.match(id, /^\$rc_/, `${id} is not a predefined package identifier`);
  }
});

test('the two-card paywall sells a real subset of the plans', () => {
  // Owner's ruling, 21 Aug 2026: the funnel screen stays annual + monthly even
  // though the dashboard offering carries weekly too.
  assert.deepEqual([...NATIVE_PAYWALL_PLANS], ['annual', 'monthly']);
  for (const plan of NATIVE_PAYWALL_PLANS) {
    assert.ok(ALL_PLANS.includes(plan), `${plan} is not a plan`);
  }
  const hidden = ALL_PLANS.filter((p: Plan) => !NATIVE_PAYWALL_PLANS.includes(p));
  assert.deepEqual(hidden, ['weekly'], 'weekly is the only plan the funnel hides');
});
