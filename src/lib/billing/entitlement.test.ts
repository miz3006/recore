import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decideEntitlement,
  graceDaysLeft,
  GRACE_MS,
  snapshotCoversNow,
  type EntitlementSnapshot,
} from './entitlement.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 6, 29, 9, 0, 0); // 29 Jul 2026, 09:00 UTC

function snap(over: Partial<EntitlementSnapshot> = {}): EntitlementSnapshot {
  return {
    active: true,
    expiresAtMs: NOW + 20 * DAY,
    checkedAtMs: NOW,
    trial: false,
    willRenew: true,
    productId: 'recore.pro.annual',
    priceLabel: '$59.99',
    ...over,
  };
}

// --- a fresh reading always wins ------------------------------------------------

test('a fresh active reading entitles, whatever the cache says', () => {
  const d = decideEntitlement(snap(), snap({ active: false }), NOW);
  assert.equal(d.entitlement, 'entitled');
  assert.equal(d.reason, null);
  assert.equal(d.fromCache, false);
});

test('a fresh inactive reading lapses, even with a cache that still covers now', () => {
  const cached = snap({ expiresAtMs: NOW + 30 * DAY });
  const d = decideEntitlement(snap({ active: false }), cached, NOW);
  assert.equal(d.entitlement, 'lapsed');
  assert.equal(d.reason, 'expired');
  assert.equal(d.fromCache, false);
});

test('a fresh reading with no product behind it reads as "never", not "expired"', () => {
  const d = decideEntitlement(snap({ active: false, productId: null }), null, NOW);
  assert.equal(d.entitlement, 'lapsed');
  assert.equal(d.reason, 'never');
});

// --- the offline policy ---------------------------------------------------------

test('unreachable store with nothing cached is unverified, never entitled', () => {
  const d = decideEntitlement(null, null, NOW);
  assert.equal(d.entitlement, 'lapsed');
  assert.equal(d.reason, 'unverified');
  assert.equal(d.fromCache, false);
});

test('unreachable store inside the verified period keeps the lifter logging', () => {
  const d = decideEntitlement(null, snap({ expiresAtMs: NOW + 1 * DAY }), NOW);
  assert.equal(d.entitlement, 'entitled');
  assert.equal(d.fromCache, true);
});

test('unreachable store inside the grace window still keeps them logging', () => {
  // Expired yesterday; the renewal almost certainly happened and we cannot ask.
  const d = decideEntitlement(null, snap({ expiresAtMs: NOW - 1 * DAY }), NOW);
  assert.equal(d.entitlement, 'entitled');
  assert.equal(d.fromCache, true);
});

test('the grace window is exactly seven days and its far edge lapses', () => {
  const justInside = decideEntitlement(null, snap({ expiresAtMs: NOW - GRACE_MS + 1 }), NOW);
  assert.equal(justInside.entitlement, 'entitled');

  const atTheEdge = decideEntitlement(null, snap({ expiresAtMs: NOW - GRACE_MS }), NOW);
  assert.equal(atTheEdge.entitlement, 'lapsed');
  assert.equal(atTheEdge.reason, 'expired');
  assert.equal(atTheEdge.fromCache, true);
});

test('a cache that never said active is not evidence of an expiry', () => {
  const d = decideEntitlement(null, snap({ active: false }), NOW);
  assert.equal(d.entitlement, 'lapsed');
  assert.equal(d.reason, 'unverified');
});

test('a lifetime entitlement never runs out offline', () => {
  const d = decideEntitlement(null, snap({ expiresAtMs: null }), NOW + 4000 * DAY);
  assert.equal(d.entitlement, 'entitled');
});

// --- helpers ---------------------------------------------------------------------

test('snapshotCoversNow tracks the same edges as the decision', () => {
  assert.equal(snapshotCoversNow(snap({ expiresAtMs: NOW + DAY }), NOW), true);
  assert.equal(snapshotCoversNow(snap({ expiresAtMs: NOW - GRACE_MS }), NOW), false);
  assert.equal(snapshotCoversNow(snap({ active: false }), NOW), false);
});

test('graceDaysLeft is null before the expiry and after the window', () => {
  assert.equal(graceDaysLeft(snap({ expiresAtMs: NOW + DAY }), NOW), null, 'not expired yet');
  assert.equal(graceDaysLeft(snap({ expiresAtMs: NOW - GRACE_MS }), NOW), null, 'window is over');
  assert.equal(graceDaysLeft(snap({ expiresAtMs: NOW - 2 * DAY }), NOW), 5);
  assert.equal(graceDaysLeft(snap({ expiresAtMs: null }), NOW), null, 'lifetime has no grace');
});
