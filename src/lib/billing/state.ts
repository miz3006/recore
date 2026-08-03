import { useSyncExternalStore } from 'react';

import { getMeta, setMeta } from '@/lib/db/index';
import {
  markAccountAttached,
  markPurchaseOutcome,
  markRestoreOutcome,
  markTrialStarted,
} from '@/lib/funnel';

import { cancelTrialNotification } from './notifications';
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
  isStoreConfigured,
  purchasePlan,
  restorePurchases,
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

let decision: EntitlementDecision = { entitlement: 'lapsed', reason: 'unverified', fromCache: false };
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
 * The two development overrides, and the reason each one is safe.
 *
 * `__DEV__` is false in every release bundle, so neither of these can ship. In
 * a release build with no key the entitlement resolves to `lapsed` — which is
 * the correct reading of a misconfigured binary, not a bug.
 *
 *  · **No key at all → entitled.** A development machine without a RevenueCat
 *    key has no store to ask, and a hard paywall against a store that does not
 *    exist would make the whole app unreachable to the next person working on
 *    it. This is the one place the old "assume entitled" behaviour survives,
 *    and it now survives only where there is provably nothing to assume about.
 *  · **The lapsed toggle → lapsed.** It outranks everything, including a real
 *    store answer, because `read-only-ledger.tsx` is otherwise unreachable
 *    until a sandbox subscription can expire, and an unreachable screen rots.
 */
function devOverride(): EntitlementDecision | null {
  if (!__DEV__) return null;
  if (getMeta(KEYS.devLapsed) === '1') {
    return { entitlement: 'lapsed', reason: 'expired', fromCache: true };
  }
  if (!isStoreConfigured()) {
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
  const override = devOverride();
  if (override) {
    applyDecision(override);
    return;
  }
  applyDecision(decideEntitlement(null, readSnapshot(), nowMs));
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

  const attached = await attachStoreToAccount(userId);
  if (!attached) return;
  markAccountAttached();

  const fresh = await fetchEntitlement();
  if (fresh) writeSnapshot(fresh);
  const override = devOverride();
  if (override) {
    applyDecision(override); // the dev toggle outranks even a real store answer
    return;
  }
  applyDecision(decideEntitlement(fresh, readSnapshot(), Date.now()));
}

/** Drop the customer on sign-out so the next account starts from nothing. */
export async function releaseEntitlement(): Promise<void> {
  await detachStoreFromAccount();
  applyDecision({ entitlement: 'lapsed', reason: 'unverified', fromCache: false });
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
export async function purchase(plan: Plan): Promise<PurchaseOutcome> {
  const outcome = await purchasePlan(plan);
  markPurchaseOutcome(outcome.status);
  if (outcome.status === 'purchased') {
    setMeta(KEYS.trialPlan, plan);
    writeSnapshot(outcome.snapshot);
    applyDecision(decideEntitlement(outcome.snapshot, outcome.snapshot, Date.now()));
  }
  return outcome;
}

/** Restore. Never charges, always tells the truth about what it found. */
export async function restore(): Promise<RestoreOutcome> {
  const outcome = await restorePurchases();
  markRestoreOutcome(outcome.status);
  if (outcome.status !== 'failed') {
    writeSnapshot(outcome.snapshot);
    applyDecision(decideEntitlement(outcome.snapshot, outcome.snapshot, Date.now()));
  }
  return outcome;
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
