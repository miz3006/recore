import assert from 'node:assert/strict';
import { test } from 'node:test';

import { armed, NO_TOUR, spent, tourIsOwed, tourWasShown, type TourFlags } from './tour-gate.ts';

/** What `ensureLocalUser` leaves behind when a different account signs in: the
 * whole `meta` table goes, so both rows go with it. */
const afterAccountWipe = (): TourFlags => ({ ...NO_TOUR });

/** What the funnel does at its end — `markOnboardingDone` → `armTour`. */
const afterFunnel = (f: TourFlags) => armed(f);

/** What Today does the moment the scrim is put up. */
const afterShown = (f: TourFlags) => spent(f);

test('a fresh install is owed nothing until the funnel ends', () => {
  assert.equal(tourIsOwed(NO_TOUR), false);
  assert.equal(tourIsOwed(afterFunnel(NO_TOUR)), true);
});

test('being shown spends it, and a relaunch does not bring it back', () => {
  const shown = afterShown(afterFunnel(NO_TOUR));
  assert.equal(tourIsOwed(shown), false);
  assert.equal(tourWasShown(shown), true);
  // A relaunch is the same rows read again — the gate is a pure read of them.
  assert.equal(tourIsOwed({ ...shown }), false);
});

test('force-quitting mid-tour does NOT replay it', () => {
  // The regression this rule exists for: the old contract wrote the flag on
  // finish/skip only, so steps 1–2 then a swipe-up left `armed` standing.
  const midTour = afterShown(afterFunnel(NO_TOUR)); // spent at OPEN, not at finish
  assert.equal(tourIsOwed(midTour), false);
});

test('finishing after it was already spent changes nothing', () => {
  const shown = afterShown(afterFunnel(NO_TOUR));
  assert.deepEqual(afterShown(shown), shown, 'spending is idempotent');
});

test('a returning athlete on a second phone is owed nothing', () => {
  // They never walk the funnel: screen 1's "I already have an account" hands
  // them a session, and the dispatcher lets a signed-in user straight past.
  assert.equal(tourIsOwed(NO_TOUR), false);
});

test('switching back to your own account does not replay it', () => {
  // Somebody else signs in on this phone, which wipes `meta`; then the owner
  // signs back in. No funnel runs, so nothing arms.
  const mine = afterShown(afterFunnel(NO_TOUR));
  assert.equal(tourWasShown(mine), true);
  const wiped = afterAccountWipe();
  assert.equal(tourIsOwed(wiped), false, 'the wipe must not read as "new profile"');
});

test('"owed" is not the negation of "shown"', () => {
  // The whole defect in one line: for three of the four lives in the header,
  // `!tourWasShown` is true and `tourIsOwed` is false, and only the second is
  // the question worth asking.
  for (const f of [NO_TOUR, afterAccountWipe()]) {
    assert.equal(tourWasShown(f), false);
    assert.equal(tourIsOwed(f), false);
  }
});

test('simulating a fresh install re-arms, because the funnel really does re-run', () => {
  // `dev-fresh-install.ts` drops every `pref_%` row and `onboarding_done`.
  const wiped: TourFlags = { armed: null, done: null };
  assert.equal(tourIsOwed(wiped), false);
  assert.equal(tourIsOwed(afterFunnel(wiped)), true);
});

test('only the exact string "1" arms it', () => {
  // Guards against a truthy-but-wrong row ever reading as armed.
  for (const v of ['0', '', 'true', 'yes']) {
    assert.equal(tourIsOwed({ armed: v, done: null }), false, `armed=${JSON.stringify(v)}`);
  }
});
