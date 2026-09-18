import { useSyncExternalStore } from 'react';

import { devLog } from '@/lib/log';

import {
  onConsumed,
  onReachable,
  onSynced,
  onUnreachable,
  REACH_ONLINE,
  sameReach,
  type Reach,
} from './net-reach.ts';

/**
 * CAN THE PHONE REACH THE SERVICE RIGHT NOW — and nothing more than that.
 *
 * ## Why this is not a reachability module
 *
 * The obvious build is `NetInfo` reporting "Wi-Fi: yes". This file deliberately
 * does not do that, for three reasons:
 *
 * 1. **A radio bar is not the fact the app needs.** What Recore promises is
 *    that the words reach the account; a phone joined to a gym's captive Wi-Fi
 *    portal reports a perfect connection and cannot reach anything. The only
 *    honest evidence is a request that either came back or never left — and the
 *    app is already making those, every few seconds.
 * 2. **It costs no native module.** A reachability library is a pod, a rebuild,
 *    and a new permission surface, bought to learn something the sync loop
 *    finds out on its own.
 * 3. **It cannot drift from the truth it is drawn from.** The line under
 *    Today's dateline and the amber mark on a record are fed by the same
 *    outcomes that decide whether the backup got anywhere, so the screen can
 *    never claim one thing while the queue is doing another.
 *
 * ## Who feeds it
 *
 * Exactly two callers, and both are places a request is made:
 *
 *   `lib/sync/index.ts`   push / pull — the backup loop
 *   `lib/parse/client.ts` the reading — `parse-workout`
 *
 * Each reports what happened to the REQUEST, never what it thinks of the
 * network: `reportReachable()` when the service answered (an error status is an
 * answer — the phone got through), `reportUnreachable()` when it never left.
 *
 * ## Who reads it
 *
 *   `components/offline-line.tsx` the quiet amber line under Today's dateline
 *   `state/session-store.ts`      `parseStalled` — set when a reading fails
 *                                 underground, and asked again on reconnect,
 *                                 which is what `note-surface.tsx` draws amber
 *
 * Signing out resets it (`reset()`): the reachability of an account's service
 * is not a fact about a phone with no account on it, and an amber page left
 * behind by the last session would be the app reporting on something it is no
 * longer doing.
 *
 * Every transition lives in `net-reach.ts`, pure and unit-tested. This file
 * holds the cell, the subscription plumbing, and the probe.
 */

let snapshot: Reach = REACH_ONLINE;

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Reach {
  return snapshot;
}

function apply(next: Reach) {
  if (sameReach(next, snapshot)) return;
  snapshot = next;
  notify();
}

/** The service answered — an error status is still an answer. */
export function reportReachable() {
  if (!snapshot.offline) return;
  devLog('net: service reachable again');
  apply(onReachable(snapshot));
  stopProbe();
  runReconnects();
}

/** The request never left the phone. */
export function reportUnreachable(at: number = Date.now()) {
  if (!snapshot.offline) devLog('net: service unreachable');
  apply(onUnreachable(snapshot, at));
  scheduleProbe();
}

/**
 * A whole backup pass finished, with nothing having failed to leave the phone.
 * A no-op unless the app had been offline — see `onSynced`.
 */
export function reportSynced(at: number = Date.now()) {
  apply(onSynced(snapshot, at));
}

/** The page has shown the "back online" beat; it does not get a second one. */
export function clearSettled() {
  apply(onConsumed(snapshot));
}

/** Back to the opening state — no claim about the network either way. */
export function reset() {
  stopProbe();
  apply(REACH_ONLINE);
}

/** For the code that cannot hold a hook — the session store, the sync loop. */
export function isOffline(): boolean {
  return snapshot.offline;
}

export function useNetState(): Reach {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- coming back ------------------------------------------------------------

/**
 * WHAT HAPPENS WHILE THE SIGNAL IS GONE, and why this file owns it.
 *
 * Before this existed, an offline sync pass failed, logged, and scheduled
 * NOTHING. The dirty flags kept the work safe — that was never the problem —
 * but the next attempt waited for a foreground, a keystroke, or a parse
 * landing. Somebody who wrote a set in a basement, walked up the stairs and put
 * the phone in their pocket had a backup that did not resume until they next
 * opened the app.
 *
 * That is the exact gap Today now promises is not there — *keep writing, it
 * syncs itself the moment you're back* — so the promise is made true here.
 * While offline, and only while offline, a probe re-runs the sync pass on a
 * widening schedule. Each probe is one request that fails in milliseconds when
 * there is still no signal (the OS refuses it without waking the radio), and
 * the first one that gets through reports reachable, which stops the chain and
 * lets the reconnect listeners ask for whatever a screen is still waiting on.
 *
 * The schedule widens to 90 s and stays there: this is a backup catching up,
 * not a live connection, and nothing on screen is waiting for the next tick.
 */
const PROBE_SCHEDULE_MS = [4_000, 10_000, 20_000, 45_000, 90_000];

let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeAttempt = 0;
let probe: (() => void) | null = null;
const reconnects = new Set<() => void>();

/** The sync loop registers itself here — this file may not import it back. */
export function setProbe(fn: (() => void) | null) {
  probe = fn;
}

/**
 * Run this when the service comes back.
 *
 * The session store registers the one thing a screen cannot do without: a
 * reading asked for underground is still owed, and the page draws it as owed
 * until this fires.
 */
export function onReconnect(fn: () => void): () => void {
  reconnects.add(fn);
  return () => reconnects.delete(fn);
}

function runReconnects() {
  for (const onBack of reconnects) {
    try {
      onBack();
    } catch (err) {
      // A listener must never be able to hold the recovery open.
      devLog('net: reconnect listener failed:', String(err));
    }
  }
}

function scheduleProbe() {
  if (!probe || probeTimer) return;
  const delay = PROBE_SCHEDULE_MS[Math.min(probeAttempt, PROBE_SCHEDULE_MS.length - 1)]!;
  probeAttempt += 1;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    if (!snapshot.offline) return;
    probe?.();
    // The chain keeps itself alive rather than waiting on the pass to report
    // back: a pass that finds another already running returns without touching
    // the network, and a probe that only re-armed on a fresh failure would stop
    // there — one unlucky beat and the backup waits for a foreground again.
    // `reportReachable` clears this timer the moment one gets through.
    scheduleProbe();
  }, delay);
}

function stopProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  probeAttempt = 0;
}
