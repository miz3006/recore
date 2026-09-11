// Relative + .ts extension: this file is bundled by Metro AND run under
// `node --test`, which cannot resolve the `@/` alias or an extensionless path.
import type { ParseResult } from './types.ts';

/**
 * Re-anchor each parsed item to the line that actually contains it. The model
 * reports a 0-based line index, but that index is untrusted like the rest of
 * its output — off-by-one drift (miscounted blank lines, prose lines) would
 * pin a gutter signal to the wrong row. Every line is its own unit: an item's
 * signal may only sit on a line whose text mentions the exercise as the user
 * wrote it.
 *
 * Rule: if the claimed line is blank or doesn't contain any of the item's
 * aliases (or the canonical name), scan the note for the first line that does
 * and reassign. Items that match nowhere keep their claimed line — the
 * blank-line guard in the note surface hides them rather than mislabeling.
 *
 * THE SEARCH MOVES FORWARD WITH THE NOTE. Items arrive in reading order, so a
 * line already spoken for by an earlier item cannot be the answer for a later
 * one — and a note that works the same movement twice ("bench 60kg 2x10" then
 * "bench 100kg 1x3") is exactly where a plain "first line that mentions it"
 * search puts both readings on line one and leaves the second line looking
 * unread. A REPEAT of the previous item's own words has to land strictly after
 * it; a different movement on the same physical line (an inline superset) does
 * not, and keeps that line.
 */
export function reanchorLines(result: ParseResult, rawText: string): void {
  const lines = rawText.split('\n').map((l) => l.toLowerCase());

  const matches = (line: string, tokens: string[]) =>
    line.trim().length > 0 && tokens.some((t) => t.length > 1 && line.includes(t));

  /** The line the previous item settled on — where this one may start looking. */
  let cursor = 0;
  let previousTokens = '';

  for (const item of result.items) {
    const tokens = [...item.aliases_seen, item.exercise.toLowerCase()];
    const identity = tokens.join('|');
    const floor = identity === previousTokens ? cursor + 1 : cursor;
    previousTokens = identity;

    const claimed = lines[item.line];
    if (claimed !== undefined && item.line >= floor && matches(claimed, tokens)) {
      cursor = Math.max(cursor, item.line);
      continue;
    }

    const forward = lines.findIndex((l, i) => i >= floor && matches(l, tokens));
    const found = forward >= 0 ? forward : lines.findIndex((l) => matches(l, tokens));
    if (found >= 0) {
      item.line = found;
      cursor = Math.max(cursor, found);
    }
  }
}
