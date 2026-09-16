import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { devDoorCredentials, isDevSignInAvailable } from './dev-door.ts';

/**
 * THE ONE RULE THIS FILE EXISTS FOR: the development sign-in is not in
 * production (owner, 16 September 2026).
 *
 * It had no test before, because the module that held the rule could not be
 * imported outside Metro. `dev-door.ts` imports nothing, so the gate itself is
 * now checkable — and a future edit that widens it to a preference, an env
 * flag, or a remote switch fails here instead of shipping.
 */

/**
 * `__DEV__` is declared as a plain `boolean` by the React Native types, and in
 * `node --test` it simply does not exist — which is one of the states under
 * test. Reaching it through a cast is how a test can both delete it and set it
 * without redeclaring the global out from under the rest of the repository.
 */
const G = globalThis as { __DEV__?: boolean };

const CONFIGURED = { EXPO_PUBLIC_DEV_EMAIL: 'dev@example.test', EXPO_PUBLIC_DEV_PASSWORD: 'secret' };

/** Put the module back in the state a fresh import would see. */
function reset() {
  delete G.__DEV__;
  delete process.env.EXPO_PUBLIC_DEV_EMAIL;
  delete process.env.EXPO_PUBLIC_DEV_PASSWORD;
}

afterEach(reset);

test('a production bundle has no door, however well configured', () => {
  G.__DEV__ = false;
  Object.assign(process.env, CONFIGURED);

  assert.equal(isDevSignInAvailable(), false);
  assert.equal(devDoorCredentials(), null);
});

test('a bundle with no __DEV__ global at all is treated as production', () => {
  Object.assign(process.env, CONFIGURED);

  assert.equal(isDevSignInAvailable(), false);
});

test('a development build without an account has no door either', () => {
  G.__DEV__ = true;

  assert.equal(isDevSignInAvailable(), false);
  assert.equal(devDoorCredentials(), null);
});

test('whitespace is not an account', () => {
  G.__DEV__ = true;
  process.env.EXPO_PUBLIC_DEV_EMAIL = '   ';
  process.env.EXPO_PUBLIC_DEV_PASSWORD = '\t';

  assert.equal(isDevSignInAvailable(), false);
});

test('half a credential is not an account', () => {
  G.__DEV__ = true;
  process.env.EXPO_PUBLIC_DEV_EMAIL = CONFIGURED.EXPO_PUBLIC_DEV_EMAIL;

  assert.equal(isDevSignInAvailable(), false);

  delete process.env.EXPO_PUBLIC_DEV_EMAIL;
  process.env.EXPO_PUBLIC_DEV_PASSWORD = CONFIGURED.EXPO_PUBLIC_DEV_PASSWORD;

  assert.equal(isDevSignInAvailable(), false);
});

test('a development build with a configured account opens, and hands the credential back trimmed', () => {
  G.__DEV__ = true;
  process.env.EXPO_PUBLIC_DEV_EMAIL = `  ${CONFIGURED.EXPO_PUBLIC_DEV_EMAIL}  `;
  process.env.EXPO_PUBLIC_DEV_PASSWORD = CONFIGURED.EXPO_PUBLIC_DEV_PASSWORD;

  assert.equal(isDevSignInAvailable(), true);
  assert.deepEqual(devDoorCredentials(), {
    email: CONFIGURED.EXPO_PUBLIC_DEV_EMAIL,
    password: CONFIGURED.EXPO_PUBLIC_DEV_PASSWORD,
  });
});
