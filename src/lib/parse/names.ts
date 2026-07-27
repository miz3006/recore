/**
 * Loose exercise-name matching — pure, zero I/O, `node --test`-runnable.
 *
 * Two different questions get asked about a name all over the app: *what did the
 * user actually type here*, and *is this the same lift as that one*. Both were
 * living inside the receipt module, which is gone (1.21); the answers are not,
 * because the parser, the history lookup and the alias echo all need them.
 */

/** The exercise words the user actually typed on a line — everything before
 * the first digit ("tricpes 27kgx12x2" → "tricpes"). Empty when the line
 * starts with a number or has no letters. */
export function typedNameOf(lineText: string): string {
  const beforeDigit = lineText.split(/\d/, 1)[0] ?? '';
  return beforeDigit
    .replace(/[^\p{L} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Letters-only, plural-insensitive comparison key ("Weighted Dips" →
 * "weighteddip"). The shared currency of all loose name matching. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}]+/gu, '')
    .replace(/s$/u, '');
}

/**
 * Loose same-exercise test: keys with containment either way — "dips" matches
 * "Dip", "incline smith machine" matches "Incline Smith Machine Press". A typo
 * like "tricpes" does NOT match "Triceps Pushdown": that's a real correction,
 * worth marking in the ledger. Keys under three letters never match — a
 * two-letter fragment contains no evidence.
 */
export function namesMatch(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (ka.length < 3 || kb.length < 3) return false;
  return ka.includes(kb) || kb.includes(ka);
}

