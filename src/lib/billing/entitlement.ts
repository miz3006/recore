/**
 * The entitlement policy — PURE, zero imports, zero I/O, so it is unit-tested
 * under plain `node --test` like `trial.ts` and `predict/engine.ts`.
 *
 * This file answers ONE question: given what the store last told us and what it
 * is telling us right now (which may be nothing at all), is this person
 * entitled? It is separated from `store.ts` and `state.ts` on purpose — the
 * decision is where the product rules live, and a rule you cannot test is a
 * rule you do not have.
 *
 * THE OWNER'S RULING (29 Jul 2026), which resolves a real conflict:
 *
 *   product-direction §2 wants a HARD paywall — after the trial, logging needs a
 *   valid entitlement. CLAUDE.md §2 invariant 1 says the app "never blocks a
 *   keystroke or workout finish on a model, sync, purchase, or entitlement
 *   check". A naive hard gate breaks the second rule the first time a paying
 *   lifter opens Recore in a basement gym with no signal.
 *
 *   The resolution is LAST KNOWN STATE PLUS GRACE. A verified entitlement keeps
 *   working offline for as long as the period we verified was going to last,
 *   and then for a bounded grace window on top — because a renewal we cannot
 *   confirm is far more likely to have happened than not. Beyond that window,
 *   or when the store says outright that the entitlement is gone, the paywall
 *   is hard.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO is assume entitled when it knows nothing.
 * The V4-era code this replaces resolved every unverifiable state to `entitled`
 * ("a false positive costs one session of revenue"). Under §2 that is no longer
 * a hard paywall at all, so it is gone — but the SHAPE of the mistake it was
 * avoiding is still respected: `never` and `unverified` are separate reasons
 * from `expired`, and the screen says which one it is instead of telling a
 * customer their subscription ended when we simply could not ask.
 */

/** Milliseconds in a day. */
const DAY_MS = 86_400_000;

/**
 * How long a verified entitlement survives past its own expiry while the store
 * is unreachable. Seven days: long enough to cover a holiday with bad signal
 * and a renewal we could not confirm, short enough that a genuinely cancelled
 * subscription does not run free for a month.
 */
export const GRACE_MS = 7 * DAY_MS;

export type Entitlement = 'entitled' | 'lapsed';

/**
 * Why a person is lapsed. It exists so the read-only screen can be truthful:
 * "your subscription ended" and "we could not reach the App Store" are
 * different sentences and only one of them is ever true at a time (§2.2).
 */
export type LapseReason =
  /** The store told us the entitlement is over. */
  | 'expired'
  /** We reached the store and this account has never had one. */
  | 'never'
  /** We have never managed to ask, or cannot ask now and have nothing cached. */
  | 'unverified';

/**
 * One reading of the subscription, as the store described it. Everything here
 * is a fact from the store — nothing is computed by Recore, which is what lets
 * the paywall and the reminder state a date and a price without inventing one.
 */
export interface EntitlementSnapshot {
  /** Did the store say access is active at the moment of the read? */
  active: boolean;
  /** When access ends. Null means the store gave no expiry (lifetime). */
  expiresAtMs: number | null;
  /** The instant this reading came back from the store. */
  checkedAtMs: number;
  /** Is the current period the free trial rather than a paid one? */
  trial: boolean;
  /** Will it renew at the end of the period? False after a cancellation. */
  willRenew: boolean;
  /** The store product behind it, or null when there is none. */
  productId: string | null;
  /**
   * The localized price string the store showed for this product, e.g. "€5,99".
   * Cached so an offline reminder can still state a real price rather than a
   * hardcoded dollar amount (§2: the price is always truthful).
   */
  priceLabel: string | null;
}

export interface EntitlementDecision {
  entitlement: Entitlement;
  /** Set only when `entitlement` is `lapsed`. */
  reason: LapseReason | null;
  /**
   * True when this decision rests on a cached reading rather than a fresh one.
   * The screen uses it to avoid saying anything definite about a renewal it has
   * not actually seen.
   */
  fromCache: boolean;
}

/**
 * Is a snapshot still good at `nowMs`, allowing `graceMs` past its expiry?
 *
 * A snapshot with no expiry never runs out; that is what the store means by a
 * lifetime entitlement, and second-guessing it here would invent a fact.
 */
export function snapshotCoversNow(
  snapshot: EntitlementSnapshot,
  nowMs: number,
  graceMs = GRACE_MS,
): boolean {
  if (!snapshot.active) return false;
  if (snapshot.expiresAtMs == null) return true;
  return nowMs < snapshot.expiresAtMs + graceMs;
}

/**
 * The decision.
 *
 * `fresh` is a reading that just came back from the store, or null when the
 * store could not be reached. `cached` is the last reading that ever came back,
 * or null on an install that has never had one.
 *
 * A fresh reading always wins — it is the store's own current answer, and no
 * cache may outrank it in either direction.
 */
export function decideEntitlement(
  fresh: EntitlementSnapshot | null,
  cached: EntitlementSnapshot | null,
  nowMs: number,
  graceMs = GRACE_MS,
): EntitlementDecision {
  if (fresh) {
    if (fresh.active) return { entitlement: 'entitled', reason: null, fromCache: false };
    // The store answered and said no. `never` and `expired` read differently to
    // a person, and the store already knows which one this is: an account that
    // has never bought anything has no product behind it.
    const reason: LapseReason = fresh.productId == null ? 'never' : 'expired';
    return { entitlement: 'lapsed', reason, fromCache: false };
  }

  // The store is unreachable. Everything below is the offline policy.
  if (!cached) return { entitlement: 'lapsed', reason: 'unverified', fromCache: false };

  if (snapshotCoversNow(cached, nowMs, graceMs)) {
    return { entitlement: 'entitled', reason: null, fromCache: true };
  }

  // A cache that once said active and has now run past its grace is an expiry
  // we simply have not been able to watch happen. A cache that never said
  // active is not evidence of anything.
  const reason: LapseReason = cached.active ? 'expired' : 'unverified';
  return { entitlement: 'lapsed', reason, fromCache: true };
}

/**
 * Whole days of grace left after the period ended, or null when the snapshot is
 * not in grace at all. Shown nowhere as a countdown (§2.2 forbids one) — it
 * exists so support can explain a state, and so the tests can assert the edge.
 */
export function graceDaysLeft(
  snapshot: EntitlementSnapshot,
  nowMs: number,
  graceMs = GRACE_MS,
): number | null {
  if (!snapshot.active || snapshot.expiresAtMs == null) return null;
  if (nowMs < snapshot.expiresAtMs) return null;
  const end = snapshot.expiresAtMs + graceMs;
  if (nowMs >= end) return null;
  return Math.max(0, Math.ceil((end - nowMs) / DAY_MS));
}
