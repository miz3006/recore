/**
 * THE REACHABILITY RULES, PURE — no React, no timers, no imports at all, so
 * every one of them is unit-tested under plain `node --test` like `streak.ts`
 * and `effort.ts` beside it.
 *
 * `net-state.ts` is the mutable half: it holds the one cell these functions
 * move, the listeners, and the probe that keeps knocking while the phone is
 * underground. Everything that decides anything is here.
 *
 * WHAT THE STATE MEANS. Not "is there Wi-Fi" — the app never asks a radio.
 * These four transitions are fed by the outcome of requests the app was making
 * anyway (the sync loop's pull, the parse function), because the only fact
 * worth drawing amber on Today is whether the athlete's writing can reach the
 * account, and a phone joined to a gym's sign-in portal reports four bars and
 * reaches nothing. `net-state.ts`'s header carries the full argument.
 */

export interface Reach {
  /** A request has failed to leave the phone, and none has succeeded since. */
  offline: boolean;
  /** When that started, ms since epoch — null while online. */
  since: number | null;
  /**
   * When the backup loop last completed a whole pass AFTER an offline stretch.
   *
   * The one stamp that licenses the page to say "back online, it's saved":
   * being reachable again is not the same as the queue having drained, and the
   * second is what was promised. Null until it happens, and null again once
   * the page has shown it.
   */
  settledAt: number | null;
  /**
   * Has this stretch been underground at all?
   *
   * Carried in the state rather than in a module variable so the whole machine
   * is one value a test can hold. It is what stops an ordinary sync pass — of
   * which there are dozens an hour — from claiming a recovery that never
   * happened.
   */
  wasOffline: boolean;
}

/**
 * THE OPENING STATE IS ONLINE, AND THAT IS A DECISION.
 *
 * It only ever goes offline on evidence: a request that was made and did not
 * leave. A person who has never had a signal is told nothing is wrong until the
 * app has actually tried and failed, which is the difference between a status
 * and an accusation — and it means a cold start on a plane is silent until
 * there is something real to report.
 */
export const REACH_ONLINE: Reach = {
  offline: false,
  since: null,
  settledAt: null,
  wasOffline: false,
};

/** The request never left the phone. */
export function onUnreachable(state: Reach, at: number): Reach {
  if (state.offline) return state;
  // The pending confirmation goes with it: whatever had just drained, the
  // phone is underground again and the page must not say otherwise.
  return { offline: true, since: at, settledAt: null, wasOffline: true };
}

/**
 * The service answered — and an error status is an answer. A 500 from the parse
 * function proves the phone got through; treating it as "no signal" would send
 * somebody outside to fix an outage they cannot reach.
 */
export function onReachable(state: Reach): Reach {
  if (!state.offline) return state;
  return { offline: false, since: null, settledAt: state.settledAt, wasOffline: true };
}

/**
 * A WHOLE BACKUP PASS FINISHED with nothing having failed to leave the phone.
 *
 * Stamps only when the app had been offline — the stamp is what lets Today say
 * the one sentence the offline line promised, and it says it about the queue
 * having drained rather than about a radio coming back. A pass that limped
 * (still offline) is not a pass that landed.
 */
export function onSynced(state: Reach, at: number): Reach {
  if (state.offline || !state.wasOffline) return state;
  return { offline: false, since: null, settledAt: at, wasOffline: false };
}

/** The page has shown the "back online" beat; it does not get a second one. */
export function onConsumed(state: Reach): Reach {
  if (state.settledAt === null) return state;
  return { ...state, settledAt: null };
}

export function sameReach(a: Reach, b: Reach): boolean {
  return (
    a.offline === b.offline &&
    a.since === b.since &&
    a.settledAt === b.settledAt &&
    a.wasOffline === b.wasOffline
  );
}

/**
 * IS THIS ERROR THE PHONE BEING UNDERGROUND, or the service saying no?
 *
 * The line matters more than it looks: a 502 from the parse function and a
 * request that never left arrive at the same `catch`, and telling somebody they
 * have no signal when the service is simply down is a lie that sends them
 * outside for nothing.
 *
 * supabase-js names the first case in the two places it has a name for it
 * (`FunctionsFetchError` from an edge function, `AuthRetryableFetchError` from
 * the auth client). PostgREST has no such class — a failed `fetch` comes back
 * as an ordinary error carrying the platform's own words — so the rest is a
 * string test against what React Native, WebKit, CFNetwork and undici each say
 * when a request cannot be made.
 *
 * **Anything unrecognised is treated as the service having ANSWERED**, which is
 * the safe direction to be wrong in: the page stays quiet rather than blaming a
 * connection that is working. A missed offline costs one un-drawn amber line; a
 * false one costs the app's word.
 */
export function isOfflineError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as { name?: string }).name ?? '';
  if (
    name === 'FunctionsFetchError' ||
    name === 'AuthRetryableFetchError' ||
    name === 'AbortError' ||
    name === 'TimeoutError'
  ) {
    return true;
  }
  const text = [(error as { message?: string }).message, (error as { details?: string }).details]
    .filter((part): part is string => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  if (text.length === 0) return false;
  return (
    text.includes('network request failed') || // React Native's own wording
    text.includes('failed to fetch') || // undici / Chrome
    text.includes('load failed') || // WebKit
    text.includes('internet connection appears to be offline') || // CFNetwork
    text.includes('network connection was lost') ||
    text.includes('timed out') ||
    text.includes('timeout') ||
    /**
     * THE CLASS, FLATTENED INTO THE SENTENCE (17 September 2026).
     *
     * `lib/net-deadline.ts` ends a request that will not answer, and the app
     * has to read its own abort as what it is. Through an edge function that
     * works already — supabase-js wraps it as `FunctionsFetchError`, named
     * above. Through PostgREST it does NOT: `postgrest-js` builds a plain
     * object, writes `${err.name}: ${err.message}` into `message`, and the
     * thing that reaches here HAS NO `name` AT ALL. Probed against the real
     * service rather than assumed — a cut pull arrives as the string
     * *"AbortError: This operation was aborted"*, and every test above it
     * missed, so the pass would have reported the phone reachable on a request
     * that never got an answer.
     *
     * The class name is matched rather than the sentence, because the sentence
     * is three different sentences (undici: *this operation was aborted*;
     * React Native: *Aborted*; WebKit: *Fetch is aborted*) and because the
     * obvious loose test for "abort" would swallow a genuine answer from
     * Postgres — *"current transaction is aborted"* is the service talking, and
     * painting the page amber over it is the false report `net-state` is most
     * careful about.
     */
    text.includes('aborterror') ||
    text.includes('timeouterror')
  );
}
