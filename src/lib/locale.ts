import type { ObLanguage, WeightUnit } from '@/lib/prefs';

/**
 * Locale-derived defaults for onboarding (§5: an answer that can be derived is
 * not worth a screen of a stranger's attention). Both are DEFAULTS, not
 * decisions — You keeps the editable setting, and nothing here overwrites a
 * value the user has chosen.
 *
 * Hermes ships Intl on RN 0.81, but the try/catch keeps a missing
 * implementation (or an exotic locale string) from ever crashing onboarding —
 * English and kilograms are the honest fallbacks.
 */
export function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale ?? 'en';
  } catch {
    return 'en';
  }
}

/** Slovene devices get the Slovene voice; everything else starts in English. */
export function defaultLanguage(): ObLanguage {
  return deviceLocale().toLowerCase().startsWith('sl') ? 'slo' : 'en';
}

/** The three countries that lift in pounds; storage stays metric regardless. */
export function defaultWeightUnit(): WeightUnit {
  const region = deviceLocale().split('-')[1]?.toUpperCase();
  return region === 'US' || region === 'LR' || region === 'MM' ? 'lb' : 'kg';
}
