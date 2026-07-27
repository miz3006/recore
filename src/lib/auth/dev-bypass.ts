import { useSyncExternalStore } from 'react';

import { getMeta, setMeta } from '@/lib/db/index';

/**
 * The development bypass (PLAN.md 0.7 dev entrance). `__DEV__` only.
 *
 * Lets a dev past the hard paywall with NO account, so the app can be worked on
 * without signing in every launch. Sign-in still exists and still works — this
 * only removes the gate.
 *
 * It carries a fixed local user id because the data layer is not optional: the
 * SQLite mirror is scoped per user (`ensureLocalUser`), and without an id the
 * app would render with nothing behind it. The id is a constant, so the local
 * database survives reloads and yesterday's test data is still there.
 *
 * Sync stays OFF while bypassed, which is the honest behaviour — there is no
 * account for rows to belong to, and pushing them anywhere would be a lie about
 * where the data lives. Signing in properly later takes over from here.
 *
 * `__DEV__` compiles the whole path out of release bundles, and the flag is
 * read through it everywhere, so a shipped build can never be in this state.
 */

/** A real UUID so anything that parses one is satisfied. Local-only; never synced. */
export const DEV_LOCAL_USER_ID = '00000000-dev0-4000-8000-000000000001';

const KEY = 'dev_paywall_bypassed';

let enabled = __DEV__ && getMeta(KEY) === '1';
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): boolean {
  return enabled;
}

/** True when the dev bypass is active. Always false in a release build. */
export function isDevBypassed(): boolean {
  return __DEV__ && enabled;
}

/** Turn the bypass on or off and persist it, so a reload keeps you inside. */
export function setDevBypass(next: boolean): void {
  if (!__DEV__ || next === enabled) return;
  enabled = next;
  setMeta(KEY, next ? '1' : '0');
  for (const listener of listeners) listener();
}

/** Subscribe from a component — the guard and the dispatcher both need this. */
export function useDevBypass(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot) && __DEV__;
}
