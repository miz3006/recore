import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isSessionActive, msUntilSettled, SESSION_IDLE_MS } from './session-activity.ts';

const NOW = 1_760_000_000_000;

test('a set logged minutes ago is a session in progress', () => {
  assert.equal(
    isSessionActive({ hasSets: true, lastActivityAt: NOW - 5 * 60_000, finished: false }, NOW),
    true,
  );
});

test('Finish settles it immediately, however recent the last set', () => {
  assert.equal(
    isSessionActive({ hasSets: true, lastActivityAt: NOW - 60_000, finished: true }, NOW),
    false,
  );
});

test('ninety quiet minutes settle it on their own', () => {
  const a = { hasSets: true, lastActivityAt: NOW - SESSION_IDLE_MS - 1, finished: false };
  assert.equal(isSessionActive(a, NOW), false);
});

test('an empty day is never active', () => {
  assert.equal(isSessionActive({ hasSets: false, lastActivityAt: NOW, finished: false }, NOW), false);
  assert.equal(
    isSessionActive({ hasSets: true, lastActivityAt: null, finished: false }, NOW),
    false,
  );
});

test('the settle moment is scheduled once, not polled', () => {
  const a = { hasSets: true, lastActivityAt: NOW - 60_000, finished: false };
  assert.equal(msUntilSettled(a, NOW), SESSION_IDLE_MS - 60_000);
  // Nothing pending on a day that has already settled.
  assert.equal(msUntilSettled({ ...a, finished: true }, NOW), null);
});
