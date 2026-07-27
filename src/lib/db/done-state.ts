import { getMeta, setMeta } from './index';

/**
 * The composer checklist's "done" state (CLAUDE.md §9, UX roadmap N2). Cards are
 * DONE by default; the user can un-check one to mark it recorded-but-not-
 * performed. We store only the EXCEPTIONS — the keys the user un-checked — per
 * workout in the local meta KV (never synced as UI state; the exclusion reaches
 * the record as a `'skipped'` set kind written by the parse apply). Keyed by
 * `doneKeyFor(exercise, setText)` so a check survives reorder/re-parse.
 */
const metaKey = (workoutId: string) => `done_off:${workoutId}`;

function parseKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const keys = JSON.parse(raw) as unknown;
    return Array.isArray(keys) ? keys.map(String) : [];
  } catch {
    return [];
  }
}

/** The store's shape: a membership map for O(1) card lookups. */
export function loadUndoneMap(workoutId: string | null): Record<string, true> {
  if (!workoutId) return {};
  return Object.fromEntries(parseKeys(getMeta(metaKey(workoutId))).map((k) => [k, true as const]));
}

/** The parse pipeline's shape: a Set for filtering items during apply. */
export function loadUndoneKeys(workoutId: string): Set<string> {
  return new Set(parseKeys(getMeta(metaKey(workoutId))));
}

export function saveUndone(workoutId: string, keys: string[]): void {
  setMeta(metaKey(workoutId), keys.length ? JSON.stringify(keys) : null);
}
