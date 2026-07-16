/**
 * Dev-only logging. PII minimization: raw workout text, tokens, and emails are
 * never logged in production builds — this helper is compiled out of release
 * bundles by the __DEV__ guard, and callers still must not pass raw_text or
 * session tokens through it.
 */
export function devLog(...args: unknown[]) {
  if (__DEV__) {
    console.log('[recore]', ...args);
  }
}

export function devWarn(...args: unknown[]) {
  if (__DEV__) {
    console.warn('[recore]', ...args);
  }
}
