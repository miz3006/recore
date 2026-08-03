import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesEntitlementInfo,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import { REVENUECAT_IOS_KEY } from '@/lib/env';
import { devLog } from '@/lib/log';

import type { EntitlementSnapshot } from './entitlement';
import { ENTITLEMENT_ID, MANAGE_SUBSCRIPTIONS_URL, type Plan } from './pricing';

/**
 * The store adapter — THE ONLY FILE IN RECORE THAT IMPORTS `react-native-purchases`
 * (product-direction §2, implementation order step 1).
 *
 * Everything above it (`state.ts`, the paywall, the lapsed screen) speaks in
 * Recore's own vocabulary: a `Plan`, an `EntitlementSnapshot`, an outcome word.
 * That boundary is deliberate. A purchase SDK is the single most replaceable
 * dependency in a subscription app, and the last time this file was a stub the
 * whole product had to be re-read to find what "billing" touched. Now it is one
 * import site and one set of return types.
 *
 * THREE RULES THIS FILE KEEPS, all of them CLAUDE.md invariants:
 *
 *  1. **Nothing here throws.** Every function catches its own failure and
 *     returns a value the caller can render. A store outage may not surface as
 *     a red screen, and §2 invariant 1 forbids it standing in front of a
 *     keystroke.
 *  2. **Nothing here is called on a write.** The entitlement is read once per
 *     session from `AuthProvider`, and again only when the user themselves
 *     taps Restore or completes a purchase.
 *  3. **The key is publishable.** RevenueCat's iOS SDK key is a client key, in
 *     the same category as the Supabase anon key — it identifies the app, it
 *     does not authorise anything. The secret key never enters the bundle, and
 *     nothing in this file needs it.
 *
 * ACCOUNT ATTACHMENT (§2: "the trial attaches to an account") is the
 * `appUserID` passed to `configure`: the Supabase user id. A purchase made on
 * one device is therefore the same customer on the next, and a sign-out
 * detaches it. There is no anonymous purchase path — the funnel puts sign-in
 * before the purchase precisely so this id exists when it is needed.
 */

/** Is there a key to configure with? False in Expo Go and on web. */
export function isStoreConfigured(): boolean {
  return Platform.OS !== 'web' && REVENUECAT_IOS_KEY.length > 0;
}

/** Has `configure` run at all this launch? */
let configured = false;
/** The account the SDK is currently logged in as, or null while anonymous. */
let configuredFor: string | null = null;

/**
 * Start the SDK, anonymously. This is what lets the PAYWALL SHOW REAL PRICES
 * BEFORE THERE IS AN ACCOUNT — and the funnel requires exactly that: §2.1 puts
 * plan selection before sign-in, so the offer has to be readable first.
 *
 * Reading an offering anonymously is safe; BUYING anonymously is not, and
 * `purchasePlan` refuses it (§2: the trial attaches to an account). RevenueCat
 * aliases the anonymous customer onto the real one at `logIn`, so nothing is
 * lost in the handover.
 */
export function configureStore(): boolean {
  if (!isStoreConfigured()) return false;
  if (configured) return true;
  try {
    if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_IOS_KEY });
    configured = true;
    return true;
  } catch (err) {
    devLog('store configure failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Attach the store to the signed-in account. Idempotent per user: calling it
 * again for the same id is a no-op.
 *
 * Returns whether the SDK is usable afterwards — false is a normal state (Expo
 * Go, web, an unconfigured .env) and every other function here handles it.
 */
export async function attachStoreToAccount(userId: string): Promise<boolean> {
  if (!configureStore()) return false;
  if (configuredFor === userId) return true;
  try {
    await Purchases.logIn(userId);
    configuredFor = userId;
    return true;
  } catch (err) {
    devLog('store attach failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/** Is the store attached to a real account, i.e. may a purchase be made? */
export function isAttachedToAccount(): boolean {
  return configuredFor != null;
}

/**
 * Detach on sign-out, so the next account on this device does not inherit the
 * previous customer's entitlement. Never throws; a failure here must not block
 * signing out.
 */
export async function detachStoreFromAccount(): Promise<void> {
  if (configuredFor == null) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    devLog('store detach failed:', err instanceof Error ? err.message : err);
  } finally {
    configuredFor = null;
  }
}

// --- reading the entitlement ------------------------------------------------------

/** The localized price string for the product behind an entitlement, if we know it. */
let lastKnownPriceLabels: Partial<Record<string, string>> = {};

function snapshotFrom(info: CustomerInfo, nowMs: number): EntitlementSnapshot {
  const active: PurchasesEntitlementInfo | undefined = info.entitlements.active[ENTITLEMENT_ID];
  // An inactive-but-known entitlement still tells us the product, which is what
  // separates "expired" from "never bought anything" (§2.2).
  const known: PurchasesEntitlementInfo | undefined =
    active ?? info.entitlements.all[ENTITLEMENT_ID];

  const productId = known?.productIdentifier ?? null;
  return {
    active: active != null,
    expiresAtMs: active?.expirationDateMillis ?? known?.expirationDateMillis ?? null,
    checkedAtMs: nowMs,
    trial: (active?.periodType ?? '').toUpperCase() === 'TRIAL',
    willRenew: active?.willRenew ?? false,
    productId,
    priceLabel: productId ? (lastKnownPriceLabels[productId] ?? null) : null,
  };
}

/**
 * Ask the store what this customer has. Returns null when the store cannot be
 * reached at all — the caller (`state.ts`) turns that into the offline policy
 * rather than guessing here.
 */
export async function fetchEntitlement(nowMs: number = Date.now()): Promise<EntitlementSnapshot | null> {
  if (configuredFor == null) return null;
  try {
    return snapshotFrom(await Purchases.getCustomerInfo(), nowMs);
  } catch (err) {
    devLog('entitlement read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// --- reading the offer -------------------------------------------------------------

/**
 * One plan as the paywall needs to render it. Every string here came from the
 * store, in the user's own storefront currency (§2: the price is truthful).
 */
export interface StorePlan {
  plan: Plan;
  /** The price as Apple formats it: "$59.99", "€59,99", "59,99 €". */
  priceLabel: string;
  /** The same price as a number, for the honest-saving arithmetic. */
  price: number;
  /** Apple's own per-month string for an annual plan, when it supplies one. */
  pricePerMonthLabel: string | null;
  /** Whole days of introductory free trial the store offers, or 0 if none. */
  trialDays: number;
}

export interface StoreOffer {
  annual: StorePlan | null;
  monthly: StorePlan | null;
}

/** ISO-8601-ish period unit → days. Only used to state a trial length honestly. */
function trialDaysOf(product: PurchasesStoreProduct): number {
  const intro = product.introPrice;
  // A non-zero introductory price is a discount, not a free trial, and calling
  // it one would be exactly the misleading copy §2 forbids.
  if (!intro || intro.price > 0) return 0;
  const n = intro.periodNumberOfUnits;
  switch ((intro.periodUnit ?? '').toUpperCase()) {
    case 'DAY':
      return n;
    case 'WEEK':
      return n * 7;
    case 'MONTH':
      return n * 30;
    case 'YEAR':
      return n * 365;
    default:
      return 0;
  }
}

function planFrom(plan: Plan, pkg: PurchasesPackage | null): StorePlan | null {
  if (!pkg) return null;
  const p = pkg.product;
  lastKnownPriceLabels[p.identifier] = p.priceString;
  return {
    plan,
    priceLabel: p.priceString,
    price: p.price,
    pricePerMonthLabel: plan === 'annual' ? p.pricePerMonthString : null,
    trialDays: trialDaysOf(p),
  };
}

let packagesByPlan: Partial<Record<Plan, PurchasesPackage>> = {};

/**
 * The current offering, mapped onto Recore's two plans. Returns null when the
 * store is unreachable — the paywall then renders its fallback frame and says
 * so, rather than inventing a price.
 */
export async function fetchOffer(): Promise<StoreOffer | null> {
  // Readable while anonymous on purpose — the paywall runs before sign-in.
  if (!configureStore()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    packagesByPlan = {
      annual: current.annual ?? undefined,
      monthly: current.monthly ?? undefined,
    };
    return {
      annual: planFrom('annual', current.annual),
      monthly: planFrom('monthly', current.monthly),
    };
  } catch (err) {
    devLog('offerings read failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// --- buying and restoring ----------------------------------------------------------

export type PurchaseOutcome =
  | { status: 'purchased'; snapshot: EntitlementSnapshot }
  /** The user backed out of Apple's sheet. Not an error, and never phrased as one. */
  | { status: 'cancelled' }
  /** The product is not on this storefront, or the offering has not loaded. */
  | { status: 'unavailable' }
  | { status: 'failed' };

/**
 * Buy a plan. The store owns every step of this: the sheet, the price, the
 * trial eligibility and the charge. Recore learns the result and nothing more.
 *
 * `fetchOffer` must have run first — the package it returns is what Apple's
 * sheet is opened with, and buying a product id we never displayed is how a
 * paywall ends up charging a price it did not show.
 */
export async function purchasePlan(
  plan: Plan,
  nowMs: number = Date.now(),
): Promise<PurchaseOutcome> {
  // No anonymous purchases: §2 requires the trial to attach to an account, and
  // an anonymous receipt is exactly the one a person cannot get back later.
  if (configuredFor == null) return { status: 'unavailable' };
  const pkg = packagesByPlan[plan];
  if (!pkg) return { status: 'unavailable' };
  try {
    const result = await Purchases.purchasePackage(pkg);
    return { status: 'purchased', snapshot: snapshotFrom(result.customerInfo, nowMs) };
  } catch (err) {
    if (isCancellation(err)) return { status: 'cancelled' };
    devLog('purchase failed:', err instanceof Error ? err.message : err);
    return { status: 'failed' };
  }
}

export type RestoreOutcome =
  | { status: 'restored'; snapshot: EntitlementSnapshot }
  /** The store answered and this Apple Account owns nothing to restore. */
  | { status: 'nothing'; snapshot: EntitlementSnapshot }
  | { status: 'failed' };

/**
 * Restore Purchases. Real, and it never charges — which is the whole reason
 * §2 requires it to be reachable and truthful.
 */
export async function restorePurchases(nowMs: number = Date.now()): Promise<RestoreOutcome> {
  if (configuredFor == null) return { status: 'failed' };
  try {
    const snapshot = snapshotFrom(await Purchases.restorePurchases(), nowMs);
    return snapshot.active ? { status: 'restored', snapshot } : { status: 'nothing', snapshot };
  } catch (err) {
    devLog('restore failed:', err instanceof Error ? err.message : err);
    return { status: 'failed' };
  }
}

/**
 * Where this subscription is actually managed. The store gives a customer-
 * specific URL when it has one; Apple's generic subscriptions page is the
 * fallback, and it is never wrong, only less direct.
 */
export async function managementUrl(): Promise<string> {
  if (configuredFor == null) return MANAGE_SUBSCRIPTIONS_URL;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.managementURL ?? MANAGE_SUBSCRIPTIONS_URL;
  } catch {
    return MANAGE_SUBSCRIPTIONS_URL;
  }
}

/** Apple's sheet dismissed by the user — the one "failure" that is not one. */
function isCancellation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; userCancelled?: unknown };
  return (
    e.userCancelled === true || e.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}
