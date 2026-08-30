import { NativeModules, Platform } from 'react-native';

import { devLog } from '@/lib/log';

import { ENTITLEMENT_ID } from './pricing';
import { isStoreConfigured } from './store';

/**
 * RevenueCat's OWN paywall and Customer Center — the hosted, dashboard-driven
 * surfaces (RevenueCat Paywalls v2, Customer Center).
 *
 * THE ONLY FILE IN RECORE THAT IMPORTS `react-native-purchases-ui`, for the
 * same reason `store.ts` is the only one that imports `react-native-purchases`:
 * a purchase SDK is the most replaceable dependency in a subscription app, and
 * one import site is what keeps that true.
 *
 * WHY BOTH PAYWALLS EXIST (owner's ruling, 21 Aug 2026). `src/app/paywall.tsx`
 * stays Recore's funnel: it is the screen product-direction §6 designs, it is
 * personalised from onboarding answers, and it holds the plan → account →
 * purchase order §2.1 requires. The hosted paywall is ADDITIVE, and it earns
 * its place on the surfaces where remote control is worth more than a designed
 * funnel:
 *
 *   · **Win-back from the lapsed screen.** A returning subscriber is the one
 *     audience worth testing offers on, and testing them means changing the
 *     screen without shipping a build.
 *   · **Whatever the dashboard is currently selling**, including the weekly
 *     package the two-card funnel screen deliberately does not show.
 *
 * WHAT IT STILL MAY NOT DO. Everything CLAUDE.md forbids applies here as much
 * as to a screen in this repository: no invented price, no fabricated review or
 * testimonial, no countdown pressure, no unverifiable health claim. The
 * dashboard is a place a human types copy, so it is not policed by the code —
 * §12's copy rules bind whoever edits the paywall there. Prices are the one
 * thing that cannot go wrong: they come from StoreKit, exactly as they do on
 * Recore's own screen.
 *
 * NOTHING HERE THROWS. Every entry point returns an outcome word the caller can
 * render, and an unavailable module is a normal outcome — not a crash.
 */

/** How a hosted-paywall presentation ended. */
export type PaywallOutcome =
  /** A purchase completed inside the paywall. */
  | 'purchased'
  /** A restore completed inside the paywall. */
  | 'restored'
  /** Dismissed with nothing bought. Not an error, never phrased as one. */
  | 'cancelled'
  /** `presentPaywallIfNeeded` found the entitlement already active. */
  | 'not-presented'
  /** The paywall could not be shown, or something failed inside it. */
  | 'error';

/**
 * `PAYWALL_RESULT` is a string enum in the SDK. Mapping through its string
 * values rather than importing the enum keeps this module lazily loadable —
 * importing the enum would pull the native module in at module-evaluation time
 * and defeat the guard below.
 */
const OUTCOME_BY_RESULT: Record<string, PaywallOutcome> = {
  PURCHASED: 'purchased',
  RESTORED: 'restored',
  CANCELLED: 'cancelled',
  NOT_PRESENTED: 'not-presented',
  ERROR: 'error',
};

type RevenueCatUIModule = typeof import('react-native-purchases-ui').default;

/** Resolved once. `undefined` means "not tried yet", `null` means "not here". */
let cachedUI: RevenueCatUIModule | null | undefined;

/**
 * Do the paywall pods actually exist in this bundle?
 *
 * WHY THIS IS NOT THE SAME QUESTION AS "does the JS module import". In Expo Go
 * — and in Rork, and on web — `react-native-purchases-ui` imports perfectly
 * well and then silently switches to its PREVIEW API MODE, which routes
 * `presentPaywall` to RevenueCat's *browser* SDK. That SDK renders the paywall
 * into `document`, which Hermes does not have, so the call fails deep inside
 * the dependency with "This SDK requires a browser environment". A resolvable
 * import is therefore no evidence at all; the two native modules are.
 *
 * Recore's own paywall is a better answer than a preview one anyway, so the
 * honest move is to report the hosted surfaces as absent and let every caller
 * take the fallback it already has.
 */
function hasNativePaywallModules(): boolean {
  return !!NativeModules.RNPaywalls && !!NativeModules.RNCustomerCenter;
}

/**
 * The native module, or null wherever it does not exist — web, Expo Go, and any
 * bundle built without the pod. Loaded lazily and exactly once: a top-level
 * import would evaluate native code on a platform that has none.
 */
function ui(): RevenueCatUIModule | null {
  if (cachedUI !== undefined) return cachedUI;
  if (Platform.OS === 'web' || !hasNativePaywallModules()) {
    cachedUI = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-purchases-ui') as { default: RevenueCatUIModule };
    cachedUI = mod.default ?? null;
  } catch (err) {
    devLog('RevenueCatUI unavailable:', err instanceof Error ? err.message : err);
    cachedUI = null;
  }
  return cachedUI;
}

/**
 * May a hosted surface be offered at all? False in Expo Go, on web, and with no
 * configured key — every caller has a real fallback for exactly this case, and
 * a control that leads nowhere is worse than a control that is not there.
 */
export function isHostedUIAvailable(): boolean {
  return isStoreConfigured() && ui() != null;
}

/**
 * Present the paywall configured on the CURRENT offering in the RevenueCat
 * dashboard. Prices, packages and copy all come from there.
 *
 * Returns `error` when there is no paywall to show — an offering with none
 * configured is the common case, and the caller falls back to Recore's own
 * screen rather than leaving the person on a dead tap.
 */
export async function presentHostedPaywall(): Promise<PaywallOutcome> {
  const RevenueCatUI = ui();
  if (!RevenueCatUI || !isStoreConfigured()) return 'error';
  try {
    const result = await RevenueCatUI.presentPaywall({ displayCloseButton: true });
    return OUTCOME_BY_RESULT[String(result)] ?? 'error';
  } catch (err) {
    devLog('hosted paywall failed:', err instanceof Error ? err.message : err);
    return 'error';
  }
}

/**
 * Present the paywall only if Recore Pro is not already active — the store's
 * own check, not ours, so it cannot disagree with `state.ts` about a purchase
 * made seconds ago on another device.
 *
 * Useful anywhere a gated action is attempted: it is a no-op (`not-presented`)
 * for a subscriber and a paywall for everyone else.
 */
export async function presentHostedPaywallIfNeeded(): Promise<PaywallOutcome> {
  const RevenueCatUI = ui();
  if (!RevenueCatUI || !isStoreConfigured()) return 'error';
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
      displayCloseButton: true,
    });
    return OUTCOME_BY_RESULT[String(result)] ?? 'error';
  } catch (err) {
    devLog('hosted paywall (if needed) failed:', err instanceof Error ? err.message : err);
    return 'error';
  }
}

/** What the person did inside Customer Center, as far as we are told. */
export interface CustomerCenterEvents {
  /** A restore finished successfully in there. */
  onRestored?: () => void;
  /** They opened a management option — `cancel`, `change_plans`, `refund_request`. */
  onManagementOption?: (option: string) => void;
}

/**
 * Present RevenueCat's Customer Center — Apple's own manage/cancel sheet plus
 * refund requests, plan changes, restore and the dashboard's cancellation
 * survey, in one place.
 *
 * WHY THIS REPLACED A LINK TO `apps.apple.com/account/subscriptions`. That link
 * is truthful but it is a dead end: it leaves the app, it cannot restore, it
 * cannot request a refund, and it tells Recore nothing about what happened. The
 * Customer Center does all three and reports back — which is what lets the
 * entitlement update the moment someone cancels, instead of at the next cold
 * start. §20's rule still holds: leaving stays exactly as easy as arriving, and
 * nothing in here is allowed to be a retention gauntlet.
 *
 * Returns false when the sheet could not be shown; the caller then opens
 * Apple's URL, which is never wrong, only less useful.
 */
export async function presentCustomerCenter(events: CustomerCenterEvents = {}): Promise<boolean> {
  const RevenueCatUI = ui();
  if (!RevenueCatUI || !isStoreConfigured()) return false;
  try {
    await RevenueCatUI.presentCustomerCenter({
      callbacks: {
        onRestoreCompleted: () => events.onRestored?.(),
        onManagementOptionSelected: (event) => events.onManagementOption?.(event.option),
      },
    });
    return true;
  } catch (err) {
    devLog('customer center failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
