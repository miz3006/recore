import { useSyncExternalStore } from 'react';
import { Linking } from 'react-native';

import { getMeta, setMeta } from '@/lib/db/index';
import {
  markAccountAttached,
  markPurchaseOutcome,
  markRestoreOutcome,
  markTrialStarted,
} from '@/lib/funnel';

import { isBetaUnlocked } from '@/lib/env';
import { devLog } from '@/lib/log';

import { cancelTrialNotification } from './notifications';
import {
  isHostedUIAvailable,
  presentCustomerCenter,
  presentHostedPaywall,
  type PaywallOutcome,
} from './paywall-ui';
import {
  decideEntitlement,
  type Entitlement,
  type EntitlementDecision,
  type EntitlementSnapshot,
  type LapseReason,
} from './entitlement';
import type { Plan } from './pricing';
import {
  attachStoreToAccount,
  detachStoreFromAccount,
  fetchEntitlement,
  isAttachedToAccount,
  isStoreConfigured,
  managementUrl,
  purchasePlan,
  restorePurchases,
  subscribeToCustomerInfo,
  type PurchaseOutcome,
  type RestoreOutcome,
} from './store';
import { trialClockAt, type TrialClock } from './trial';

/**
 * The device's view of the subscription (product-direction §2, implementation
 * order step 1).
 *
 * This is where the store's answer becomes something the app can render. The
 * division of labour, which is the point of the file:
 *
 *   `store.ts`       talks to RevenueCat and never decides anything.
 *   `entitlement.ts` decides, purely, and never talks to anything.
 *   this file        holds the cache, the subscription-to-React plumbing, and
 *                    the one place a trial is recorded as started.
 *
 * WHAT CHANGED ON 29 JUL 2026. Until this change `resolveEntitlement` returned
 * a hardcoded `'entitled'` and `startTrial` had no caller — an honest stub for
 * a repository with no store integration. There is a store now, so the stub is
 * gone and the rules in `entitlement.ts` apply: verified state wins, a verified
 * state survives offline for its own period plus a bounded grace, and an
 * unverifiable state with nothing cached is lapsed rather than free.
 *
 * THE READ HAPPENS ONCE PER SESSION, from `AuthProvider`, and again only when
 * the user themselves taps Restore or finishes a purchase. Never mid-set, never
 * on a write — CLAUDE.md §2 invariant 1 forbids a network call standing in
 * front of a keystroke, and an entitlement check is one.
 */

const KEYS = {
  /** The last snapshot the store ever returned, as JSON. */
  snapshot: 'entitlement_snapshot',
  trialStartedAt: 'trial_started_at',
  trialChargeAt: 'trial_charge_at',
  trialPlan: 'trial_plan',
  reminderShown: 'trial_reminder_shown',
  welcomeShown: 'trial_welcome_shown',
  priceLabel: 'subscription_price_label',
  devLapsed: 'dev_entitlement_lapsed',
} as const;

// --- the cached snapshot ---------------------------------------------------------

function readSnapshot(): EntitlementSnapshot | null {
  const raw = getMeta(KEYS.snapshot);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<EntitlementSnapshot>;
    // Validated on the way out: a snapshot written by an older build must not
    // be trusted into a shape this one assumes.
    if (typeof v.active !== 'boolean' || typeof v.checkedAtMs !== 'number') return null;
    return {
      active: v.active,
      expiresAtMs: typeof v.expiresAtMs === 'number' ? v.expiresAtMs : null,
      checkedAtMs: v.checkedAtMs,
      trial: v.trial === true,
      willRenew: v.willRenew === true,
      productId: typeof v.productId === 'string' ? v.productId : null,
      priceLabel: typeof v.priceLabel === 'string' ? v.priceLabel : null,
    };
  } catch {
    return null;
  }
}

function writeSnapshot(snapshot: EntitlementSnapshot) {
  setMeta(KEYS.snapshot, JSON.stringify(snapshot));
  // The localized price, kept separately so the day-5 reminder and the lapsed
  // screen can state a real amount with no network and no store call (§2).
  if (snapshot.priceLabel) setMeta(KEYS.priceLabel, snapshot.priceLabel);
  recordTrialFrom(snapshot);
}

/**
 * A snapshot in its trial period IS the trial record. Writing it here rather
 * than at a call site means the day-5 reminder works after a reinstall, a
 * restore, or a purchase made on another device — none of which pass through
 * `purchase()` on this phone.
 */
function recordTrialFrom(snapshot: EntitlementSnapshot) {
  if (!snapshot.active || !snapshot.trial || snapshot.expiresAtMs == null) return;
  if (getMeta(KEYS.trialChargeAt) != null) {
    // Already recorded. The charge instant can still MOVE (a plan change mid
    // trial), so keep it current; the start never moves.
    setMeta(KEYS.trialChargeAt, String(snapshot.expiresAtMs));
    return;
  }
  setMeta(KEYS.trialChargeAt, String(snapshot.expiresAtMs));
  setMeta(KEYS.trialStartedAt, new Date(snapshot.checkedAtMs).toISOString());
  markTrialStarted();
}

// --- the entitlement --------------------------------------------------------------

export type { Entitlement, LapseReason };

/**
 * The reading before anything has been asked. `unverified` lapsed is the honest
 * default — except in a beta build, where there is nothing to verify against
 * and the first frame would otherwise be the read-only ledger for the instant
 * before `resolveEntitlement` runs.
 */
let decision: EntitlementDecision = isBetaUnlocked()
  ? { entitlement: 'entitled', reason: null, fromCache: true }
  : { entitlement: 'lapsed', reason: 'unverified', fromCache: false };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshotOfDecision(): EntitlementDecision {
  return decision;
}

function applyDecision(next: EntitlementDecision) {
  if (
    next.entitlement === decision.entitlement &&
    next.reason === decision.reason &&
    next.fromCache === decision.fromCache
  ) {
    return; // no churn, no re-render
  }
  decision = next;
  notify();
}

/**
 * The three overrides, and the reason each one is safe.
 *
 * Two are `__DEV__`-only and cannot ship at all; the third ships only into a
 * build that asked for it by name. In an ordinary release build with no key the
 * entitlement resolves to `lapsed` — the correct reading of a misconfigured
 * binary, not a bug — and that is still what happens here.
 *
 *  · **The lapsed toggle → lapsed** (`__DEV__`). It outranks everything,
 *    including a real store answer, because `read-only-ledger.tsx` is otherwise
 *    unreachable until a sandbox subscription can expire, and an unreachable
 *    screen rots. It is checked first so a beta build can still be inspected in
 *    development from the lapsed side.
 *  · **A beta build → entitled** (`isBetaUnlocked`, `env.ts`). The one override
 *    that survives a release bundle, and the reason it is allowed to: a beta
 *    build never renders the paywall, never prints a price and never starts a
 *    trial clock, so there is no promise for the missing store to break. Read
 *    the full argument at its definition — it is a §2 rule 5 question, and the
 *    answer only holds while the surfaces above stay silent about money.
 *  · **No key at all → entitled** (`__DEV__`). A development machine without a
 *    RevenueCat key has no store to ask, and a hard paywall against a store
 *    that does not exist would make the whole app unreachable to the next
 *    person working on it. This is where the old "assume entitled" behaviour
 *    survives, and only where there is provably nothing to assume about.
 */
function entitlementOverride(): EntitlementDecision | null {
  if (__DEV__ && getMeta(KEYS.devLapsed) === '1') {
    return { entitlement: 'lapsed', reason: 'expired', fromCache: true };
  }
  if (isBetaUnlocked()) {
    return { entitlement: 'entitled', reason: null, fromCache: true };
  }
  if (__DEV__ && !isStoreConfigured()) {
    return { entitlement: 'entitled', reason: null, fromCache: true };
  }
  return null;
}

/**
 * Decide from what is already on the device, with no network at all. Called
 * synchronously so the first frame after sign-in renders the right surface
 * instead of flashing the wrong one while a request is in flight.
 */
function decideFromCache(nowMs: number) {
  const override = entitlementOverride();
  if (override) {
    applyDecision(override);
    return;
  }
  applyDecision(decideEntitlement(null, readSnapshot(), nowMs));
}

/**
 * Apply a reading that just came back from the store, wherever it came from —
 * the session read, a purchase, a Restore, or the push listener below. One
 * function so the cache, the trial record and the decision can never disagree
 * about the same snapshot.
 */
function applyFreshSnapshot(snapshot: EntitlementSnapshot) {
  writeSnapshot(snapshot);
  const override = entitlementOverride();
  applyDecision(override ?? decideEntitlement(snapshot, snapshot, Date.now()));
}

/** Live for as long as an account is attached; torn down on sign-out. */
let stopCustomerInfoWatch: (() => void) | null = null;

/**
 * Listen for the store's own updates (added 21 Aug 2026).
 *
 * RevenueCat pushes a fresh `CustomerInfo` whenever its view of the customer
 * changes: a renewal, an expiry, a purchase on another device, a cancellation
 * made inside Customer Center, an Ask-to-Buy request a parent just approved.
 *
 * This does NOT weaken the once-per-session rule at the top of this file. That
 * rule forbids Recore ASKING the store on a write; this only accepts what the
 * store volunteers, on its own schedule, over a connection the SDK already
 * holds. Nothing waits on it and no screen blocks for it.
 *
 * It closes the one gap the old design had: a person who cancels or resubscribes
 * outside the app kept the stale answer until the next cold start.
 */
function watchCustomerInfo() {
  if (stopCustomerInfoWatch) return;
  stopCustomerInfoWatch = subscribeToCustomerInfo(applyFreshSnapshot);
}

/**
 * Attach the store to the account and resolve the entitlement. Called ONCE per
 * session from `AuthProvider` (§2 invariant 1: never on a write, never mid-set).
 *
 * Resolves the cached answer first and synchronously, then upgrades to the
 * store's own answer when it lands. A slow or absent store therefore delays
 * nothing — it only means the cached decision stands, which is exactly the
 * offline policy.
 */
export async function resolveEntitlement(userId: string): Promise<void> {
  const nowMs = Date.now();
  decideFromCache(nowMs);

  if (!(await ensureStoreAccount(userId))) return;

  const fresh = await fetchEntitlement();
  if (fresh) writeSnapshot(fresh);
  const override = entitlementOverride();
  if (override) {
    applyDecision(override); // an override outranks even a real store answer
    return;
  }
  applyDecision(decideEntitlement(fresh, readSnapshot(), Date.now()));
}

/**
 * Attach the store to this account, once, and start listening. Idempotent, and
 * it is the ONE place the funnel counter and the customer-info watch are wired
 * — a second caller cannot half-attach.
 *
 * IT HAS A SECOND CALLER FOR A REASON (28 August 2026). `resolveEntitlement`
 * runs from `AuthProvider` the moment a session appears, and the paywall runs
 * its deferred purchase off the same event: whichever effect fires first wins,
 * and when the purchase won, `purchasePlan` found no attached customer, refused
 * to buy — correctly, §2 forbids an anonymous receipt — and the screen said
 * "that plan is not available on your App Store account right now". A race, not
 * a store problem, and it cost the first tap of every account on this device.
 * Awaiting the same attach from `purchase()` closes it; the second call is a
 * no-op whenever the first has already landed.
 */
async function ensureStoreAccount(userId: string): Promise<boolean> {
  if (!(await attachStoreToAccount(userId))) return false;
  markAccountAttached();
  watchCustomerInfo();
  return true;
}

/** Drop the customer on sign-out so the next account starts from nothing. */
export async function releaseEntitlement(): Promise<void> {
  // Stop listening BEFORE detaching: `logOut` emits a customer-info update for
  // the fresh anonymous customer, and applying that would write an empty
  // snapshot over the signed-out account's cached one.
  stopCustomerInfoWatch?.();
  stopCustomerInfoWatch = null;
  await detachStoreFromAccount();
  applyDecision({ entitlement: 'lapsed', reason: 'unverified', fromCache: false });
}

/**
 * Ask the store again, now. Called only where a person has just done something
 * that could have changed the answer — finishing in Customer Center, or coming
 * back from the hosted paywall — never on a write and never on a timer.
 */
export async function refreshEntitlement(): Promise<void> {
  const fresh = await fetchEntitlement();
  if (fresh) applyFreshSnapshot(fresh);
}

export function getEntitlement(): Entitlement {
  return decision.entitlement;
}

export function getEntitlementDecision(): EntitlementDecision {
  return decision;
}

export function useEntitlement(): Entitlement {
  return useSyncExternalStore(subscribe, snapshotOfDecision, snapshotOfDecision).entitlement;
}

export function useEntitlementDecision(): EntitlementDecision {
  return useSyncExternalStore(subscribe, snapshotOfDecision, snapshotOfDecision);
}

// --- buying and restoring ----------------------------------------------------------

/**
 * Buy a plan and apply the result. The store's own sheet does the charging;
 * this records the outcome, refreshes the entitlement and starts the trial
 * clock from the instants the store reported.
 */
export async function purchase(plan: Plan, userId?: string): Promise<PurchaseOutcome> {
  // The account may have arrived a beat ago — see `ensureStoreAccount`.
  if (userId && !isAttachedToAccount()) await ensureStoreAccount(userId);
  const outcome = await purchasePlan(plan);
  markPurchaseOutcome(outcome.status);
  if (outcome.status === 'purchased') {
    setMeta(KEYS.trialPlan, plan);
    applyFreshSnapshot(outcome.snapshot);
  }
  return outcome;
}

/** Restore. Never charges, always tells the truth about what it found. */
export async function restore(userId?: string): Promise<RestoreOutcome> {
  // Same race as `purchase`: a Restore tapped straight after sign-in must not
  // report "nothing to restore" merely because the customer is not attached yet.
  if (userId && !isAttachedToAccount()) await ensureStoreAccount(userId);
  const outcome = await restorePurchases();
  markRestoreOutcome(outcome.status);
  if (outcome.status !== 'failed') {
    applyFreshSnapshot(outcome.snapshot);
  }
  return outcome;
}

// --- RevenueCat's own surfaces -----------------------------------------------------

/** Is the hosted paywall / Customer Center reachable at all on this build? */
export { isHostedUIAvailable };

/**
 * Show the paywall configured in the RevenueCat dashboard, then reconcile.
 *
 * The reconciliation is belt and braces: the customer-info listener has almost
 * certainly already applied the purchase by the time this resolves. Asking once
 * more costs one request on a path the person explicitly took, and it means the
 * screen behind the sheet is correct on the very next frame rather than on the
 * next push.
 */
export async function openHostedPaywall(): Promise<PaywallOutcome> {
  const outcome = await presentHostedPaywall();

  // Same funnel counters as Recore's own paywall, so the two surfaces are
  // comparable (§13). `not-presented` is not an attempt and is not counted.
  if (outcome === 'purchased') markPurchaseOutcome('purchased');
  else if (outcome === 'cancelled') markPurchaseOutcome('cancelled');
  else if (outcome === 'error') markPurchaseOutcome('failed');
  if (outcome === 'restored') markRestoreOutcome('restored');

  if (outcome === 'purchased' || outcome === 'restored') await refreshEntitlement();
  return outcome;
}

/**
 * The one "Manage subscription" action, for every surface that offers one.
 *
 * Customer Center when it exists, Apple's URL when it does not. Callers get a
 * control that always leads somewhere real, which is the whole requirement in
 * §2 — three screens previously repeated the URL-opening themselves.
 */
export async function openSubscriptionManagement(): Promise<void> {
  if (await openCustomerCenter()) return;
  // No Customer Center on this build. Apple's own subscriptions page is the
  // fallback and it is never wrong, only less useful — it cannot restore, it
  // cannot request a refund, and it tells Recore nothing on the way back.
  try {
    await Linking.openURL(await managementUrl());
  } catch (err) {
    devLog('manage subscription failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Open Customer Center — manage, change plan, request a refund, restore, cancel.
 *
 * Returns false when the sheet is not available on this build; the caller then
 * falls back to Apple's subscriptions URL, which is never wrong, only less
 * useful. A cancellation made in there lands on the entitlement immediately,
 * through the listener and through the refresh below.
 */
export async function openCustomerCenter(): Promise<boolean> {
  const shown = await presentCustomerCenter({
    onRestored: () => {
      markRestoreOutcome('restored');
      void refreshEntitlement();
    },
    onManagementOption: (option) => devLog('customer center option:', option),
  });
  if (shown) await refreshEntitlement();
  return shown;
}

// --- the trial ---------------------------------------------------------------------

export function getTrialStartedAtMs(): number | null {
  const v = getMeta(KEYS.trialStartedAt);
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

function getTrialChargeAtMs(): number | null {
  const n = Number.parseInt(getMeta(KEYS.trialChargeAt) ?? '', 10);
  return Number.isFinite(n) ? n : null;
}

export function getTrialPlan(): Plan {
  return getMeta(KEYS.trialPlan) === 'monthly' ? 'monthly' : 'annual';
}

/**
 * The localized price of the subscription this device knows about, or null.
 * Never a hardcoded currency — a surface with nothing here says nothing about
 * price rather than guessing one (§2).
 */
export function getPriceLabel(): string | null {
  const v = getMeta(KEYS.priceLabel)?.trim();
  return v ? v : null;
}

/**
 * The trial clock, built from the two instants the STORE reported, or null when
 * there is no trial running on this account.
 */
export function getTrialClock(nowMs: number = Date.now()): TrialClock | null {
  const started = getTrialStartedAtMs();
  const chargeAt = getTrialChargeAtMs();
  if (started == null || chargeAt == null) return null;
  return trialClockAt(started, chargeAt, nowMs);
}

/** Is the in-app reminder owed on this open? Shown at most once. */
export function isTrialReminderDue(nowMs: number = Date.now()): boolean {
  if (hasShownTrialReminder()) return false;
  // Only while the entitlement is genuinely in its trial period: a subscription
  // that already converted has nothing to warn about.
  const snapshot = readSnapshot();
  if (!snapshot?.active || !snapshot.trial) return false;
  return getTrialClock(nowMs)?.phase === 'reminder';
}

export function hasShownTrialReminder(): boolean {
  return getMeta(KEYS.reminderShown) === '1';
}

export function markTrialReminderShown() {
  setMeta(KEYS.reminderShown, '1');
  // At most one notice (§2.2). The in-app sheet has just said it, so the
  // scheduled notification would be the same three facts a second time.
  void cancelTrialNotification();
}

/**
 * The trial-start welcome, which is the ONE place notification permission may
 * be asked. Due on the first open after a trial starts and before the reminder
 * window — asking on day 6 for a day-5 reminder is theatre.
 */
export function isTrialWelcomeDue(nowMs: number = Date.now()): boolean {
  if (getMeta(KEYS.welcomeShown) === '1') return false;
  const snapshot = readSnapshot();
  if (!snapshot?.active || !snapshot.trial) return false;
  return getTrialClock(nowMs)?.phase === 'running';
}

export function markTrialWelcomeShown() {
  setMeta(KEYS.welcomeShown, '1');
}

/**
 * Development toggle for the lapsed surface. `__DEV__` only, compiled out of
 * release bundles. It exists because `read-only-ledger.tsx` is otherwise
 * unreachable until a sandbox subscription can expire, and an unreachable
 * screen rots.
 */
export function setDevLapsed(next: boolean) {
  if (!__DEV__) return;
  setMeta(KEYS.devLapsed, next ? '1' : '0');
  decideFromCache(Date.now());
}

export function isDevLapsed(): boolean {
  return __DEV__ && getMeta(KEYS.devLapsed) === '1';
}

/**
 * Forget every billing fact this device has cached — the entitlement snapshot,
 * the trial clock, the price label, the two one-shot flags and the lapsed
 * toggle. `__DEV__` only, and it exists for the fresh-install simulation in the
 * You tab.
 *
 * **It changes nothing at the store.** A real subscription is the store's fact,
 * not ours; this drops the local copy so the app has to ask again, which is the
 * state a genuinely fresh install is in. Every key lives in this module's own
 * `KEYS`, so the reset cannot drift from the writes.
 */
export function devResetBillingState() {
  if (!__DEV__) return;
  for (const key of Object.values(KEYS)) setMeta(key, null);
  decideFromCache(Date.now());
}
