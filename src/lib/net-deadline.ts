/**
 * EVERY REQUEST ENDS (owner, 17 September 2026 — a customer's screenshot).
 *
 * The screenshot is a finished session with every line of it still being read:
 * six records, six reading lines, six sets of dots, on a phone that had been
 * left to it. The parse that Finish asked for went out and never came back,
 * and nothing in the app was ever going to decide that.
 *
 * `fetch` on React Native has no deadline of its own. A request whose socket
 * the network dropped WITHOUT SAYING SO — a 5G→LTE handoff mid-request, a
 * gym's sign-in portal, a carrier NAT that forgot the connection — leaves a
 * promise that is neither resolved nor rejected for as long as the app is
 * alive. Nothing in supabase-js adds one either, so until this file the app
 * had no ceiling on any request it made anywhere.
 *
 * WHAT THAT COSTS IS NOT ONE SLOW SCREEN. Every guard the app holds AROUND a
 * request is held for as long as the request is, and each of them is a lock
 * somebody has to be inside:
 *
 *   `parsing`    `state/session-store.ts` — the beam and the dots on every
 *                unread line, and `requestParse` refusing to ask again while
 *                it is up. The screenshot IS this flag, stuck.
 *   `inFlight`   `lib/parse/client.ts` — one parse per workout, so every later
 *                reading of that note queues behind a promise that is dead.
 *   `syncing`    `lib/sync/index.ts` — one pass at a time, so a hang inside a
 *                pass stops the backup, silently, for the life of the app.
 *
 * None of the three is wrong. Each is a guard that exists for a good reason,
 * and every one of them assumes the thing it guards eventually finishes. This
 * file is what makes that assumption true. Only killing the app cleared any of
 * it before, which is a thing no one should have to know.
 *
 * The rule is the one the demo reader already states for the same reason
 * (`lib/demo-parse-remote.ts`: *"a request that has not answered by then has
 * missed its moment"*), applied to the app the customer is actually training
 * in: **a request either answers or ends.**
 *
 * NOTHING HERE DECIDES WHAT A FAILURE MEANS. An expired request comes back
 * through the same door as one that never left — `net-reach.ts` already counts
 * an `AbortError` as the phone not having got through — so it draws the amber
 * line, costs nothing, keeps `needs_parse`, and is asked again the moment the
 * signal is back. Local-first is untouched: the words were on disk before any
 * of this ran (CLAUDE.md §2).
 */

/**
 * THE CEILING ON ANYTHING THE APP ASKS THE SERVICE.
 *
 * It has to clear the slowest HONEST answer: a whole-note parse is output-
 * bound at roughly forty tokens a second and was measured at 21 s for a six-
 * exercise session (`lib/parse/client.ts`), and a long session is longer. Every
 * other request the app makes — a push, a pull, a token refresh — is a second
 * or two, and a per-call number for each of them would be four numbers to keep
 * true instead of one.
 *
 * So this is deliberately generous. It is a BACKSTOP, not a policy: it is not
 * here to make a slow answer fail, it is here so a dead one cannot be waited
 * on for ever.
 */
export const REQUEST_DEADLINE_MS = 45_000;

/**
 * THE CEILING ON "IS SOMEBODY SIGNED IN", which is a different question.
 *
 * `supabase.auth.getSession()` is a memory read in the ordinary case and a
 * LOCK in the case that matters: supabase-js serialises auth work, so a token
 * refresh that is stuck holds every later reader behind it — including the one
 * the parse path makes before it will spend a request (`parse/client.ts`). The
 * fetch deadline above ends the refresh, and this ends the wait on anything
 * else that could hold the same lock.
 *
 * Ten seconds is far past a keychain read and far short of a session. The
 * reading is not lost when it expires: it stays owed on `needs_parse` and the
 * sync loop asks again.
 */
export const SESSION_DEADLINE_MS = 10_000;

/**
 * Race a promise against the clock and settle on `expired` if the clock wins.
 *
 * The work is not CANCELLED — a promise cannot generally be — it is abandoned:
 * whatever it was doing may still finish later, and every caller here is one
 * where that is harmless (a reading that lands late is written to the same
 * cache the next request would have filled). What ends is the WAIT, which is
 * the only thing a person can see.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, expired: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clock = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      timer = null;
      resolve(expired);
    }, ms);
  });
  return Promise.race([work, clock]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

type FetchLike = typeof fetch;

/**
 * The same `fetch`, with an end to it — what the Supabase client is built with
 * (`lib/supabase.ts`), so auth, PostgREST and the edge functions all inherit it
 * rather than three call sites remembering to.
 *
 * TWO SIGNALS, ONE REQUEST. supabase-js passes its own `signal` when an invoke
 * carries a timeout, and a caller that aborts must not be kept waiting by our
 * clock — so the caller's abort is relayed onto ours and the request ends on
 * whichever comes first. The timer is cleared on the way out either way: a
 * request that answered in two seconds must not leave a live abort behind it.
 *
 * `underlying` is a parameter so the behaviour is testable without a network
 * (`net-deadline.test.ts`); nothing in the app passes it.
 */
export function deadlineFetch(ms: number, underlying: FetchLike = fetch): FetchLike {
  return (input, init) => {
    const controller = new AbortController();
    const caller = init?.signal ?? null;
    const relay = () => controller.abort();
    if (caller) {
      if (caller.aborted) relay();
      else caller.addEventListener('abort', relay);
    }
    const timer = setTimeout(relay, ms);
    return underlying(input, { ...init, signal: controller.signal }).finally(() => {
      clearTimeout(timer);
      caller?.removeEventListener('abort', relay);
    });
  };
}
