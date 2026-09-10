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

/**
 * WHATEVER WAS THROWN, AS ONE READABLE LINE.
 *
 * `err instanceof Error ? err.message : ''` is the pattern this repository
 * reached for, and against Supabase it prints an empty string more often than
 * not: `PostgrestError` is a plain object (`message`, `details`, `hint`,
 * `code`), and a `FunctionsHttpError` carries the status a caller actually
 * needs on a `context` Response rather than in its message. So the log said
 * "sync pass failed (offline?)" and then nothing at all, and a 401 from RLS was
 * indistinguishable from a gym with no signal.
 *
 * This reads the fields that exist and joins them. It never throws and never
 * returns an empty string — "unknown error" is still more than nothing.
 */
export function errorText(err: unknown): string {
  if (err == null) return 'unknown error';
  if (typeof err === 'string') return err;

  const o = err as Record<string, unknown>;
  const parts: string[] = [];
  const push = (label: string, v: unknown) => {
    if (typeof v === 'string' && v.trim()) parts.push(`${label}${v.trim()}`);
    else if (typeof v === 'number') parts.push(`${label}${v}`);
  };

  if (err instanceof Error && err.name && err.name !== 'Error') parts.push(err.name);
  push('', o.message);
  push('status ', (o.context as Record<string, unknown> | undefined)?.status ?? o.status);
  push('code ', o.code);
  push('', o.details);
  push('hint: ', o.hint);

  if (parts.length > 0) return parts.join(' · ');
  try {
    return JSON.stringify(err) || 'unknown error';
  } catch {
    return String(err);
  }
}

export function devWarn(...args: unknown[]) {
  if (__DEV__) {
    console.warn('[recore]', ...args);
  }
}
