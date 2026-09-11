/**
 * HOW ONE PARSE BECOMES SEVERAL CALLS, AND SEVERAL ANSWERS BECOME ONE READING.
 *
 * Pure and dependency-free on purpose: this is the part of the fan-out that can
 * be WRONG rather than merely slow — a line answered twice is a set counted
 * twice, a line answered by nobody is an exercise the athlete wrote and the app
 * lost — so it runs under `node --test` (`src/lib/parse/fanout.test.ts`)
 * instead of only in production. `index.ts` keeps the model call, the auth and
 * the rate limit; none of that is in here.
 *
 * The measurement it exists for: a parse's wall time is its OUTPUT, at ~40
 * tokens a second on `claude-haiku-4-5`. One call writing a six-exercise
 * session back out took 21.0 s; the same note across six parallel calls took
 * 5.8 s. Every call still receives the WHOLE note as context — only the
 * question narrows.
 */

/** Never more calls than this for one parse, however long the note. */
export const MAX_MODEL_CALLS = 8;
/**
 * The first call goes alone for this long so it WRITES the cached system
 * prompt and the rest READ it. Measured cold, cache deliberately busted: with
 * the head start, 1 write and 3 reads and a 5.4 s wall; fired together, every
 * call writes 17.9k tokens at cache-write price for nothing.
 */
export const CACHE_HEAD_START_MS = 1200;
/** Spacing between the calls that follow the first. */
export const CALL_SPACING_MS = 150;
/**
 * A whole-note parse with fewer answerable lines than this stays ONE call with
 * no line instruction — byte-identical to the request shape every eval run has
 * ever exercised, and already fast because there is little to write.
 */
export const FANOUT_MIN_LINES = 3;

/** The lines a note can actually produce an item for: the ones with words. */
export function answerableLines(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.trim().length > 0) out.push(i);
  }
  return out;
}

/**
 * Which lines each call answers for. `null` means one call with no instruction
 * at all.
 *
 * Chunks are contiguous and cover the targets exactly once, so every line has
 * precisely one call that OWNS it — which is what makes the merge below a
 * choice between duplicates rather than a guess. `forced` is the client having
 * named the lines itself (`only_lines`): then even a single line gets the
 * instruction, because the answer must be narrowed whatever its size.
 */
export function planChunks(targets: number[], forced: boolean): number[][] | null {
  if (targets.length === 0) return null;
  if (!forced && targets.length < FANOUT_MIN_LINES) return null;
  const size = Math.max(1, Math.ceil(targets.length / MAX_MODEL_CALLS));
  const chunks: number[][] = [];
  for (let i = 0; i < targets.length; i += size) chunks.push(targets.slice(i, i + size));
  return chunks;
}

/** When the i-th call may start, given whether the prompt cache is already warm. */
export function startDelayMs(index: number, warm: boolean): number {
  if (index === 0) return 0;
  return (warm ? 0 : CACHE_HEAD_START_MS) + (index - 1) * CALL_SPACING_MS;
}

/** A quoted line is capped — a pointer, not a second copy of the note. */
const MAX_QUOTED_CHARS = 200;

/**
 * What narrows one call to its own lines — and every clause in it is here
 * because a shorter version measurably broke a real eval case.
 *
 * Tested against the ten hardest multi-line cases in
 * `scripts/parse-eval-cases.json` (headers, rounds circuits, metcons,
 * six-line machine sessions, mixed-language lines), fanned out one line per
 * call:
 *
 *  - **"the items whose line index is N" alone: 1 of 10.** Asked for an index,
 *    the model renumbers — it decides which lines are exercise lines and counts
 *    THOSE, so a note with a "Monday" header answered line 0 for the bench
 *    press written on line 1. Every index after it shifted with it.
 *  - **Quoting the line with its index: 8 of 10.** Nothing has to be counted,
 *    so nothing drifts.
 *  - **…plus "anything above that governs these lines still governs them":
 *    the circuits pass.** A "3 rounds" header multiplies the sets of the lines
 *    under it, and a line read in isolation came back with one set instead of
 *    three. The note was always in the message — the model needed telling that
 *    context still applies when the question is narrow.
 *  - **…plus "a line that records no exercise gets an empty list": 10 of 10,
 *    and the fan-out stops being slower than one call.** Asked about the
 *    "5 rounds:" line, the model answered with the WHOLE circuit — 643 output
 *    tokens against 166 for every other chunk, so one runaway call set the wall
 *    clock and the parse took 17 s instead of 6.
 *
 * **The quoted text is stripped of angle brackets** (S16, the same treatment
 * `index.ts` gives an alias): this is the one place a line of the athlete's own
 * writing is interpolated OUTSIDE the `<workout_log>` tags, and a line
 * containing `</answer_lines>` would otherwise close the block early and put
 * user text back on the instruction side of the boundary. Nothing is lost by
 * it — the untouched line is still in the note below, and the index names it.
 */
export function onlyLinesInstruction(chunk: number[], lines: string[]): string {
  const quoted = chunk
    .map((i) => `${i}| ${(lines[i] ?? '').replace(/[<>]/g, '').slice(0, MAX_QUOTED_CHARS)}`)
    .join('\n');
  return (
    ` Answer ONLY for the line(s) quoted here, and give each item exactly the line index shown:\n` +
    `<answer_lines>\n${quoted}\n</answer_lines>\n` +
    `Every other line is CONTEXT, not output: read it for meaning, never answer for it. Anything above that governs these lines still governs them — a rounds or circuit header multiplying their sets, a load or rep scheme stated once for the block, an exercise whose sets continue onto them. If a quoted line does not itself record an exercise — a date, a header, a rounds line, a remark — return an empty items list rather than the exercises it introduces.`
  );
}

/**
 * One reading out of N answers.
 *
 * Every line has exactly one chunk that owns it, so a duplicate is a CHOICE and
 * not a guess: the owner's answer wins. A line only falls back to another
 * chunk's answer when its own chunk said nothing about it — which is the
 * model's known off-by-one drift on line indices, and exactly what
 * `reanchorLines` exists to survive on the client.
 *
 * `requested` is the client's `only_lines`, and when it is present the filter
 * is strict instead: the client is holding its own cached reading for every
 * other line, and an item arriving for one of those would be printed twice.
 */
export function mergeAnswers<T extends { line: number }>(
  chunks: number[][],
  answers: T[][],
  requested: number[] | null,
): T[] {
  const owned = new Map<number, T[]>();
  const stray = new Map<number, T[]>();
  const allowed = requested === null ? null : new Set(requested);

  answers.forEach((items, i) => {
    const mine = new Set(chunks[i] ?? []);
    for (const item of items) {
      if (allowed && !allowed.has(item.line)) continue;
      const bucket = mine.has(item.line) ? owned : stray;
      const at = bucket.get(item.line) ?? [];
      at.push(item);
      bucket.set(item.line, at);
    }
  });

  return [...new Set([...owned.keys(), ...stray.keys()])]
    .sort((a, b) => a - b)
    .flatMap((line) => owned.get(line) ?? stray.get(line) ?? []);
}
