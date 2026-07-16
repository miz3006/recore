import { type ParseResult } from './types';

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
 */
export function reanchorLines(result: ParseResult, rawText: string): void {
  const lines = rawText.split('\n').map((l) => l.toLowerCase());

  const matches = (line: string, tokens: string[]) =>
    line.trim().length > 0 && tokens.some((t) => t.length > 1 && line.includes(t));

  for (const item of result.items) {
    const tokens = [...item.aliases_seen, item.exercise.toLowerCase()];
    const claimed = lines[item.line];

    if (claimed !== undefined && matches(claimed, tokens)) continue;

    const found = lines.findIndex((l) => matches(l, tokens));
    if (found >= 0) item.line = found;
  }
}
