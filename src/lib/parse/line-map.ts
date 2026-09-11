/**
 * WHICH LINE EACH STORED ITEM CAME FROM — the one thing the structure lost.
 *
 * `items` stores `position` (its ordinal within the workout), not the physical
 * line of `raw_text` it was read off. Rebuilding a reading from the structure
 * (`parse/rehydrate.ts`) therefore has to answer that question, and a reading
 * printed against the wrong line is worse than no reading at all — it is the
 * app misquoting the athlete.
 *
 * So this does not guess. It accepts the mapping only when it is FORCED:
 *
 *   **the note's non-empty lines and the workout's item-groups must be the same
 *   count.**
 *
 * Items are stored in reading order, and an inline superset — two movements on
 * one physical line — is exactly what a shared `group_key` marks. When the two
 * counts agree there is precisely one order-preserving assignment, so the i-th
 * group belongs to the i-th non-empty line and nothing is matched by name,
 * searched for, or inferred.
 *
 * When they disagree, something in the note produced no item (a prose line, a
 * line the parser could not read) or one line produced items that are not
 * grouped — and every item below it would slide by one. That returns null, and
 * the caller falls back to a real parse.
 *
 * Pure, and separate from `rehydrate.ts` for that reason: this is the part with
 * a rule worth testing, and it must run under `node --test`, which cannot load
 * the SQLite module the rest of that file needs.
 *
 * Relative + `.ts` extension for the same reason `anchor.ts` uses them.
 */

/** Line indices of every line with something on it, in order. A blank line
 * carries nothing and cannot be addressed by an item. */
export function contentLines(rawText: string): number[] {
  const out: number[] = [];
  rawText.split('\n').forEach((line, i) => {
    if (line.trim().length > 0) out.push(i);
  });
  return out;
}

/**
 * A line index per item, or null when the mapping cannot be proved.
 *
 * `groupKeys` is the workout's items in stored order, each carrying its
 * `group_key` (null when the movement stands alone on its line).
 */
export function assignLines(groupKeys: (string | null)[], rawText: string): number[] | null {
  const lines = contentLines(rawText);
  if (groupKeys.length === 0 || lines.length === 0) return null;

  const out: number[] = [];
  let cursor = -1;
  let previous: string | null | undefined;

  for (const key of groupKeys) {
    // A run of consecutive items sharing one NON-NULL key is one line. Two
    // adjacent ungrouped items are two lines, even though both keys are null.
    const continues = previous !== undefined && key !== null && key === previous;
    if (!continues) cursor += 1;
    previous = key;
    const line = lines[cursor];
    if (line === undefined) return null; // more groups than lines
    out.push(line);
  }

  // Fewer groups than lines: a line produced nothing, so every item after it is
  // one line too high. Unprovable either way — refuse.
  if (cursor !== lines.length - 1) return null;

  return out;
}
