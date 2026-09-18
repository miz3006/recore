import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deadlineFetch, withDeadline } from './net-deadline.ts';

/** A request that behaves the way the customer's did: it goes out and nothing
 * ever comes back. It rejects only if somebody aborts it — including before it
 * starts, which is what a real `fetch` does with a spent signal. */
const hangs: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) reject(new Error('Aborted'));
    else signal.addEventListener('abort', () => reject(new Error('Aborted')));
  });

/** A request that answers. */
const answers = (body: string): typeof fetch =>
  ((_input: unknown, _init?: unknown) => Promise.resolve(body)) as unknown as typeof fetch;

// --- withDeadline ------------------------------------------------------------

test('an answer in time is the answer, untouched', async () => {
  assert.equal(await withDeadline(Promise.resolve('read'), 50, null), 'read');
});

test('a promise that never settles settles anyway — the whole point', async () => {
  const forever = new Promise<string | null>(() => {});
  assert.equal(await withDeadline(forever, 20, null), null);
});

test('a failure is still a failure — the clock does not swallow it', async () => {
  await assert.rejects(withDeadline(Promise.reject(new Error('502')), 50, null), /502/);
});

test('work that wins the race is not overtaken by a late clock', async () => {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve('read'), 10));
  assert.equal(await withDeadline(slow, 60, null), 'read');
});

// --- deadlineFetch -----------------------------------------------------------

test('a request that hangs is ended, and says so in the words net-reach reads', async () => {
  // `isOfflineError` names AbortError/"Aborted" as the phone not having got
  // through — which is what puts the line amber and asks again on reconnect.
  await assert.rejects(deadlineFetch(20, hangs)('https://example.test'), /Abort/);
});

test('a request that answers is left alone', async () => {
  assert.equal(await deadlineFetch(50, answers('ok'))('https://example.test'), 'ok');
});

test("the caller's own abort still ends the request", async () => {
  const caller = new AbortController();
  const pending = deadlineFetch(10_000, hangs)('https://example.test', { signal: caller.signal });
  caller.abort();
  await assert.rejects(pending, /Abort/);
});

test('a signal that is already aborted never reaches the network waiting', async () => {
  const caller = new AbortController();
  caller.abort();
  await assert.rejects(
    deadlineFetch(10_000, hangs)('https://example.test', { signal: caller.signal }),
    /Abort/,
  );
});

test('the deadline is handed to the request, not kept as a wrapper', async () => {
  // The inner fetch has to receive a signal it can act on — a timeout that only
  // stops the WAIT would leave the socket open and the request billed.
  let seen: AbortSignal | null = null;
  const spy: typeof fetch = (_input, init) => {
    seen = init?.signal ?? null;
    return Promise.resolve('ok' as unknown as Response);
  };
  await deadlineFetch(50, spy)('https://example.test');
  assert.ok(seen, 'the request was made without a signal');
});
