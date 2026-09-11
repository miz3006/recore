// Relative + .ts extension: this file is bundled by Metro AND run under
// `node --test`, which cannot resolve the `@/` alias or an extensionless path.
import { type ParsedItem } from './types.ts';

/**
 * WHAT ACTUALLY HAS TO BE READ AGAIN (11 September 2026 — owner: *"zakaj toliko
 * časa potrebuje?"*).
 *
 * ## The measurement this file exists for
 *
 * A parse's wall time is its OUTPUT, and nothing else. Measured against the
 * deployed function and the same call made directly, on `claude-haiku-4-5`:
 *
 * | note | wall | output |
 * |---|---|---|
 * | 1 exercise | 5.7 s | 166 tok |
 * | 3 exercises | 11.6 s | 450 tok |
 * | 6 exercises | 21.0 s | 855 tok |
 *
 * ~40 tokens a second, start to finish. The 17.9k-token system prompt is NOT
 * the cost — it is cached, and `cache_read` hits moved the total by under 2%.
 *
 * And the app re-read the whole note on every typing pause: `applyParseResult`
 * deletes every item and rebuilds from the model's answer, so the cost was
 * proportional to the SESSION rather than to the edit. Writing six exercises
 * one at a time paid for 1 + 2 + 3 + 4 + 5 + 6 exercises of output — twenty-one
 * exercises' worth of model time to record six, with the last keystroke of the
 * session waiting twenty-one seconds.
 *
 * ## The rule
 *
 * The model still sees the WHOLE note — the note is the context, and a set that
 * continues on the next line, an inline superset, or a shorthand that only
 * makes sense under the exercise above it would all break if it did not. It is
 * only asked to ANSWER for the lines that changed (`only_lines` in the request;
 * the function filters its answer to them). Everything else is spliced back in
 * from the cached reading, re-indexed onto the new text.
 *
 * Measured on the same six-exercise note: **one added line, 4.4 s and 124
 * output tokens**, against 21.0 s and 855 for the whole note.
 *
 * ## Why the diff is prefix/suffix and not something cleverer
 *
 * The changed region is everything between the longest common PREFIX of lines
 * and the longest common SUFFIX. That is deterministic, provable in tests, and
 * exactly matches how a note is actually edited: a line appended at the end, a
 * line corrected in place, a line deleted. Anything it cannot express cleanly
 * — a big paste, a reshuffle, more than `MAX_PARTIAL_LINES` lines touched —
 * falls back to a full read, which is no longer the expensive branch: the
 * function fans a full note out across parallel calls and answers in ~6 s.
 *
 * ## The one cross-line fact the plan has to respect
 *
 * The prompt's line rule: *"If an exercise's sets continue on later lines, the
 * item keeps the FIRST line's index."* So a line does not necessarily belong to
 * an item anchored ON it — a bare "80x8" typed under "bench press" belongs to
 * the bench press above. Two consequences, both handled below:
 *
 *  - a changed line is expanded to the ANCHOR of the cached item that owns it,
 *    because that anchor is the item the model will answer with; and
 *  - the block immediately BEFORE the change is always re-read, because a line
 *    added or removed at its edge may be a set joining or leaving it. That
 *    costs one extra item and is the difference between a reading that follows
 *    the note and one that quietly keeps a set the athlete deleted.
 */

export interface ParsePlan {
  /** `full` — read the whole note again (the caller sends no `only_lines`). */
  mode: 'full' | 'partial';
  /**
   * The line indices, in the NEW text, the model must answer for. Empty is a
   * legitimate partial: deleting a whole exercise changes the reading without
   * anything new to read.
   */
  lines: number[];
  /** Cached items that survive, already re-indexed onto the new text. */
  keep: ParsedItem[];
}

/**
 * Past this many touched lines a partial read stops being worth its
 * bookkeeping: the fan-out reads a whole note in about the time four lines take
 * on their own, and a full read cannot be wrong about what it kept.
 */
export const MAX_PARTIAL_LINES = 4;

const FULL: ParsePlan = { mode: 'full', lines: [], keep: [] };

/** The cached item that owns `line` — the last one anchored at or above it. */
function ownerAnchor(anchors: number[], line: number): number | null {
  let owner: number | null = null;
  for (const a of anchors) {
    if (a <= line) owner = a;
    else break;
  }
  return owner;
}

/**
 * What must be read again to turn `oldItems` (the reading of `oldText`) into a
 * reading of `newText`.
 *
 * Pure. `oldItems` is the CACHED reading — corrections already overlaid, which
 * is what `parse_cache` stores — so splicing it back in preserves a fix the
 * athlete made instead of quietly re-introducing the parser's original guess.
 */
export function planParse(oldText: string, oldItems: ParsedItem[], newText: string): ParsePlan {
  if (oldItems.length === 0) return FULL;

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // Longest common prefix, then longest common suffix of what is left. The two
  // never overlap: the suffix scan stops at the prefix on both sides.
  let head = 0;
  while (head < oldLines.length && head < newLines.length && oldLines[head] === newLines[head]) {
    head += 1;
  }
  let tail = 0;
  while (
    tail < oldLines.length - head &&
    tail < newLines.length - head &&
    oldLines[oldLines.length - 1 - tail] === newLines[newLines.length - 1 - tail]
  ) {
    tail += 1;
  }

  const oldEnd = oldLines.length - tail; // exclusive, in OLD indices
  const newEnd = newLines.length - tail; // exclusive, in NEW indices
  const shift = newLines.length - oldLines.length;

  // Nothing moved at all — the caller normally serves the cache before asking,
  // but a plan for identical text is still a valid (empty) partial.
  if (head >= oldEnd && head >= newEnd) {
    return { mode: 'partial', lines: [], keep: oldItems.map((i) => ({ ...i })) };
  }

  // The whole note is new. Nothing to splice, so nothing to gain.
  if (head === 0 && tail === 0) return FULL;

  const anchors = [...new Set(oldItems.map((i) => i.line))].sort((a, b) => a - b);
  const targets = new Set<number>();

  // 1. Every NEW line in the changed region may anchor an item of its own.
  //    Blank lines cannot, and asking for them only lengthens the instruction.
  for (let i = head; i < newEnd; i += 1) {
    if (newLines[i]!.trim().length > 0) targets.add(i);
  }

  // 2. Every OLD line in the changed region belonged to some item; that item's
  //    ANCHOR is what the model answers with, and it may sit above the change.
  for (let i = head; i < oldEnd; i += 1) {
    const owner = ownerAnchor(anchors, i);
    // An anchor above the changed region keeps its index (it is in the common
    // prefix); one inside it is already covered by the loop above.
    if (owner !== null && owner < head) targets.add(owner);
  }

  // 3. The block immediately before the change, always — a line joining or
  //    leaving an exercise's sets changes that exercise, not the line itself.
  if (head > 0) {
    const owner = ownerAnchor(anchors, head - 1);
    if (owner !== null) targets.add(owner);
  }

  if (targets.size > MAX_PARTIAL_LINES) return FULL;

  // What survives: items anchored in the common prefix keep their index, items
  // anchored in the common suffix move with it, items anchored inside the
  // changed region are gone — the model is reading those lines again.
  const keep: ParsedItem[] = [];
  for (const item of oldItems) {
    let line: number;
    if (item.line < head) line = item.line;
    else if (item.line >= oldEnd) line = item.line + shift;
    else continue;
    if (targets.has(line)) continue;
    keep.push({ ...item, line });
  }

  return { mode: 'partial', lines: [...targets].sort((a, b) => a - b), keep };
}

/**
 * The spliced reading: what the model just answered, plus what was kept, in
 * reading order.
 *
 * Order is not cosmetic here — `reanchorLines` walks the items with a cursor
 * that only moves forward, so an out-of-order list would push a later item's
 * signal onto the wrong line. Ties keep the fresh item first: two items on one
 * physical line are an inline superset, and the one just read is the one the
 * user is looking at.
 */
export function mergeItems(keep: ParsedItem[], fresh: ParsedItem[]): ParsedItem[] {
  const merged = [...fresh.map((i, n) => ({ i, n, fresh: 1 })), ...keep.map((i, n) => ({ i, n, fresh: 0 }))];
  merged.sort((a, b) => a.i.line - b.i.line || b.fresh - a.fresh || a.n - b.n);
  return merged.map((m) => m.i);
}
