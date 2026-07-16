/**
 * Correction overlay (CLAUDE.md §6.2) — PURE, zero I/O, runs under
 * `node --test`.
 *
 * applyParseResult rebuilds a workout's structure from the model's output on
 * EVERY parse, so without this layer a user's fix would be silently undone the
 * next time they touch the note. The overlay re-applies stored corrections on
 * top of the fresh model output:
 *
 *  - a patch matches an item when the item's PHYSICAL LINE TEXT (trimmed)
 *    equals the text the correction was made on AND the model's exercise
 *    equals what the parser said back then (`before.exercise`) — so a patch
 *    follows its line if the line moves, targets the right item when several
 *    share a line, and steps aside once the parser itself starts agreeing
 *    with the user;
 *  - substitution keeps the model's `line` index (the note may have grown);
 *  - patches chain in creation order (fix A→B, later B→C ⇒ A→C), each used
 *    at most once per item.
 */
import { type ParseResult, type ParsedItem } from './types.ts';

export interface OverlayPatch {
  lineText: string;
  before: ParsedItem | null;
  after: ParsedItem;
}

const MAX_CHAIN = 5;

export function overlayCorrections(
  result: ParseResult,
  rawText: string,
  patches: OverlayPatch[],
): ParseResult {
  if (patches.length === 0) return result;
  const lines = rawText.split('\n').map((l) => l.trim());

  const items = result.items.map((item) => {
    let current = item;
    const used = new Set<number>();

    for (let step = 0; step < MAX_CHAIN; step++) {
      const lineText = lines[current.line] ?? '';
      const idx = patches.findIndex(
        (p, i) =>
          !used.has(i) &&
          p.before !== null &&
          p.lineText === lineText &&
          p.before.exercise === current.exercise,
      );
      if (idx === -1) break;
      used.add(idx);
      current = { ...patches[idx]!.after, line: current.line };
    }
    return current;
  });

  return { ...result, items };
}
