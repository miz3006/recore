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
export type Plan = 'annual' | 'monthly' | 'weekly';

/** Every plan the billing layer can read, price and buy. */
export const ALL_PLANS: readonly Plan[] = ['annual', 'monthly', 'weekly'] as const;

/**
 * The plans the DESIGNED paywall renders, in the order it renders them.
 *
 * Owner's ruling, 21 Aug 2026: the dashboard offering carries three packages
 * ($rc_annual, $rc_monthly, $rc_weekly) but `paywall.tsx` stays the two-card
 * screen product-direction §6 specifies. Weekly is fully supported below this
 * line — it prices, it buys, it restores, and the RevenueCat-hosted paywall
 * sells it — it simply is not a third card on Recore's own funnel screen.
 *
 * This constant is what makes that a decision rather than an omission. It is
 * documentation with a type attached: `paywall.tsx` still names its two cards
 * inline, because the pair is measured, animated and laid out as a pair, and a
 * loop over an array would buy nothing but a harder screen to read. What this
 * gives a future reader is the answer to "where did weekly go" without having
 * to diff the dashboard against the JSX.
 */
export const NATIVE_PAYWALL_PLANS: readonly Plan[] = ['annual', 'monthly'] as const;

/**
 * The RevenueCat entitlement identifier — confirmed against the dashboard by
 * the owner, 21 Aug 2026. "Recore Pro" is its DISPLAY name; `pro` is the key
 * `customerInfo.entitlements.active` is indexed by, and the display name is
 * never what an SDK returns.
 *
 * One entitlement, every product — "does this person have Recore Pro" is the
 * only question the app asks.
 */
export const ENTITLEMENT_ID = 'pro';

/**
 * The RevenueCat PACKAGE identifiers behind each plan. These, not product ids,
 * are what `store.ts` resolves an offering through — a package is stable across
 * stores, and it is the level the dashboard actually configures.
 */
export const PACKAGE_IDS: Record<Plan, string> = {
  annual: '$rc_annual',
  monthly: '$rc_monthly',
  weekly: '$rc_weekly',
};

/**
 * The App Store Connect product ids, mirrored in the RevenueCat dashboard.
 * DOCUMENTATION ONLY — no code path reads them, because resolving by package
 * (above) is what survives a store swap. They are here so App Store Connect and
 * this repository can be diffed by eye.
 *
 * The Test Store products the dashboard currently serves are named differently
 * and deliberately so: `yearly`, `monthly`, `weekly`. Nothing in `src/` depends
 * on either naming.
 */
export const PRODUCT_IDS: Record<Plan, string> = {
  annual: 'com.recore.app.pro.annual',
  monthly: 'com.recore.app.pro.monthly',
  weekly: 'com.recore.app.pro.weekly',
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
