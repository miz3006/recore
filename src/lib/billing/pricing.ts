/**
 * The two products and the arithmetic around them (product-direction §2, §6).
 *
 * THE STORE IS THE PRICE. Every number a person reads on the paywall comes from
 * `PurchasesStoreProduct.priceString` — Apple's own localized string for their
 * storefront, tax and currency. That is not a nicety: §2 says the price is
 * "always truthful", and a hardcoded "$8.99" is a lie to everyone outside the
 * US the moment it renders.
 *
 * THERE IS THEREFORE NO PRICE IN THIS FILE, and that is deliberate. A paywall
 * whose offerings request has not landed shows no amount at all rather than a
 * placeholder someone will eventually forget to replace; `state.ts` caches the
 * real localized string so even an offline reminder quotes the real one. What
 * lives here is identifiers and arithmetic — the two things the store does not
 * give us.
 *
 * The product identifiers must match App Store Connect and the RevenueCat
 * dashboard exactly. They are read by `store.ts` only.
 */
export type Plan = 'annual' | 'monthly';

/**
 * The RevenueCat entitlement identifier. One entitlement, both products —
 * "does this person have Recore Pro" is the only question the app asks.
 */
export const ENTITLEMENT_ID = 'pro';

/** The App Store Connect product ids, mirrored in the RevenueCat dashboard. */
export const PRODUCT_IDS: Record<Plan, string> = {
  annual: 'com.recore.app.pro.annual',
  monthly: 'com.recore.app.pro.monthly',
};

/**
 * The honest saving, computed from whatever two prices are actually on screen —
 * never from the constants above (§6: "the stated saving is arithmetically
 * correct against the actual monthly price").
 *
 * Returns null when the comparison cannot be made honestly: a missing price, a
 * nonsensical one, or an annual plan that is not actually cheaper. A null means
 * the badge is not rendered, which is the correct outcome — a "SAVE 0%" badge
 * is worse than no badge.
 */
export function savePct(monthlyPrice: number | null, annualPrice: number | null): number | null {
  if (monthlyPrice == null || annualPrice == null) return null;
  if (!Number.isFinite(monthlyPrice) || !Number.isFinite(annualPrice)) return null;
  if (monthlyPrice <= 0 || annualPrice <= 0) return null;
  const yearAtMonthly = monthlyPrice * 12;
  if (annualPrice >= yearAtMonthly) return null;
  const pct = Math.round((1 - annualPrice / yearAtMonthly) * 100);
  return pct > 0 ? pct : null;
}

/**
 * The annual plan's true per-month equivalent, as a number. §6 requires the
 * annual card to show "its real total and its true per-month equivalent", and
 * this is the second half of that when the store does not supply a
 * `pricePerMonthString` of its own.
 */
export function perMonth(annualPrice: number | null): number | null {
  if (annualPrice == null || !Number.isFinite(annualPrice) || annualPrice <= 0) return null;
  return Math.round((annualPrice / 12) * 100) / 100;
}

/** Apple's own subscription surface — the only place a subscription is cancelled. */
export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
