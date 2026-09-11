/**
 * LINE SURGERY ON THE RECORD, and its exact inverse.
 *
 * `raw_text` is the source of truth (CLAUDE.md §3), and the note is that text
 * split on newlines. Removing an entry means removing one physical line; the
 * whole reason a delete was frightening enough to need a confirmation dialog is
 * that nothing could put the line back.
 *
 * These two functions are that pair, and they are pure and in one file for one
 * reason: **an undo is only worth offering if it is exact.** A restore that
 * lands the line in the wrong place, drops a trailing blank, or collapses the
 * empty composer line has not undone anything — it has written a second,
 * different record and called it the first. So the inverse is tested against
 * the forward operation directly (`note-lines.test.ts`), rather than each being
 * spot-checked on its own.
 *
 * They know nothing about parsing. The reading is a projection that rebuilds
 * itself from the text, so restoring the text restores the entry, its sets, its
 * effort token and its check state — see `session-store.ts`'s `undoDelete`.
 */

/** What was cut out, and where it was — everything `restoreLine` needs back. */
export interface RemovedLine {
  /** The note with the line gone. */
  note: string;
  /** The line's text, verbatim, including whatever whitespace it carried. */
  text: string;
  /** Its index in the ORIGINAL note — where `restoreLine` puts it back. */
  line: number;
}

/**
 * Cut one physical line out of the note. `null` when the index names no line,
 * so a stale tap is a no-op rather than a silent edit of a neighbour.
 */
export function removeLine(note: string, line: number): RemovedLine | null {
  const lines = note.split('\n');
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return null;
  const [text = ''] = lines.splice(line, 1);
  return { note: lines.join('\n'), text, line };
}

/**
 * Put it back exactly where it was.
 *
 * `''` IS ONE EMPTY LINE HERE, not zero, because that is what `split` says and
 * because it is what the app means: a note showing one settled card is
 * `'bench…\n'` — the entry, then the blank line being typed into — so cutting
 * the entry leaves the composer's own line behind, and the undo has to land
 * above it. (The cost is that `''` serialises both `[]` and `['']`, so a note
 * of exactly one line and no composer line cannot round-trip. The app cannot
 * reach that: a delete control is only ever drawn on a line ABOVE the one being
 * typed. `note-lines.test.ts` pins both halves.)
 *
 * The index is CLAMPED rather than rejected, because the note is free to have
 * changed while the undo was on offer — the athlete can type another line, or
 * tick a planned set, in the seconds the pill is up. Clamping restores the line
 * at the end in that case, which is wrong by position but never wrong by
 * content; refusing would lose the line for good, which is the only outcome
 * this whole file exists to prevent.
 */
export function restoreLine(note: string, line: number, text: string): string {
  const lines = note.split('\n');
  const at = Math.min(Math.max(Number.isInteger(line) ? line : lines.length, 0), lines.length);
  lines.splice(at, 0, text);
  return lines.join('\n');
}
