/**
 * THE LINE RULES — the pure half of dictation, so it can be tested without a
 * microphone (`voice.test.ts`). `voice.ts` owns the recogniser and re-exports
 * everything here; no call site imports this file directly.
 *
 * What lives here is the answer to the owner's report of 17 September 2026:
 * *"ko hočem zapisati novo vajo zapisuje nazaj v to prvo vrstico"* — a
 * recogniser hands back one growing transcript, the record is written one
 * exercise per line, and nothing was turning the first into the second.
 */

/** One recognised word, placed in the session's audio. */
export interface VoiceSegment {
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * The gap that ends a line.
 *
 * 700 ms is the breath between two exercises, not the breath inside one:
 * "bench press one hundred kilos for five" runs with word gaps well under
 * 300 ms, and a person moving on to the next lift takes noticeably longer than
 * that. Too short and a sentence shatters; too long and the whole workout is
 * one line again, which is the bug this exists to fix.
 */
export const LINE_PAUSE_MS = 700;

/**
 * Break a transcript into lines wherever the speaker paused.
 *
 * Android below SDK 34 and iOS partial results sometimes hand back segments
 * with no usable timings at all (every stamp zero). That is not a session with
 * no pauses, it is a session with no information about pauses — so it degrades
 * to one line rather than inventing breaks.
 */
export function splitOnPauses(segments: VoiceSegment[], pauseMs = LINE_PAUSE_MS): string[] {
  const words = segments.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text.length);
  if (words.length === 0) return [];
  if (words.every((w) => w.endMs === 0)) return [words.map((w) => w.text).join(' ')];

  const lines: string[] = [];
  let current: string[] = [];
  let previousEnd = words[0].startMs;

  for (const word of words) {
    if (current.length > 0 && word.startMs - previousEnd >= pauseMs) {
      lines.push(current.join(' '));
      current = [];
    }
    current.push(word.text);
    previousEnd = Math.max(previousEnd, word.endMs);
  }
  if (current.length > 0) lines.push(current.join(' '));
  return lines;
}

/**
 * THE WORDS THAT END A SESSION OUT LOUD.
 *
 * Owner's ask, 17 September 2026: *"ko konča oz napiše done al that's it"* —
 * then, once the microphone turned out to be pinned to English: the same exit
 * in the languages a person here actually trains in.
 *
 * They are matched at the END of the last line and stripped, so the command
 * never lands in the record. Two rules keep the list honest, and both come out
 * of CLAUDE.md §2 — **the record is the source of truth**, so a false positive
 * (a real remark cut short, dictation stopped mid-set) costs far more than a
 * missed command (the person presses `Stop`, which is right there):
 *
 * 1. **Nothing that is ordinary speech inside a workout remark.** Slovene
 *    *"dovolj"* and Croatian *"dosta"* were both offered and both left out:
 *    "to je bilo dovolj" ends a sentence someone might genuinely write, and
 *    the phrase would be deleted from their note as well as ending the session.
 * 2. **Whole words, from the end.** "done 3 sets of squats" keeps dictating;
 *    only a line that FINISHES with the command is one.
 *
 * Matching folds case, apostrophes and diacritics (below), so "Končaj.",
 * "koncaj" and "KONČAJ" are one phrase and a recogniser that drops the háček
 * does not defeat the exit.
 */
export const STOP_PHRASES = [
  // English
  'stop recording',
  'stop dictation',
  'stop listening',
  'that is it',
  "that's it",
  'done',
  // Slovene — the owner's own language, and the one Apple cannot dictate at
  // all, so these have to survive being heard by an English recogniser.
  'ustavi snemanje',
  'to je to',
  'koncaj',
  'zakljuci',
  'konec',
  // Croatian / Serbian
  'zavrsi',
  'gotovo',
  'kraj',
  // German
  'aufnahme stoppen',
  "das war's",
  'fertig',
  // Italian
  'basta cosi',
  'ho finito',
  'fatto',
] as const;

/**
 * Fold one word for comparison: case, apostrophes, diacritics, edge
 * punctuation.
 *
 * Diacritic folding is why matching is done WORD BY WORD rather than by string
 * index — stripping combining marks changes a string's length, so an
 * index-based cut would slice the original line in the wrong place. Comparing
 * word lists and rebuilding from the original words cannot drift.
 */
function fold(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
}

const STOP_PHRASE_WORDS: string[][] = STOP_PHRASES.map((phrase) =>
  phrase.split(' ').map(fold),
);

/**
 * Take the spoken end-of-dictation command off the block, if it is there.
 *
 * `stopped` is what the engine acts on; `lines` is what gets written. A line
 * that is ONLY the command disappears with it — "done" is not a set.
 */
export function stripStopPhrase(lines: string[]): { lines: string[]; stopped: boolean } {
  if (lines.length === 0) return { lines, stopped: false };

  const last = lines[lines.length - 1].trim();
  if (!last) return { lines, stopped: false };

  const words = last.split(/\s+/);
  const folded = words.map(fold);

  for (const phrase of STOP_PHRASE_WORDS) {
    if (phrase.length > words.length) continue;
    const tail = folded.slice(folded.length - phrase.length);
    if (tail.some((w, i) => w !== phrase[i])) continue;

    // Rebuild from the ORIGINAL words: what is kept keeps its own casing,
    // punctuation and accents. Only the command is gone.
    const kept = words.slice(0, words.length - phrase.length).join(' ').trim();
    return {
      lines: kept ? [...lines.slice(0, -1), kept] : lines.slice(0, -1),
      stopped: true,
    };
  }
  return { lines, stopped: false };
}

/** What the engine knows about the session's text so far. */
export interface DictationBlock {
  /** Utterances the recogniser has settled. Never revised again. */
  committed: string[];
  /** The utterance still being revised — replaced by every new result. */
  live: string[];
}

export const EMPTY_BLOCK: DictationBlock = { committed: [], live: [] };

/** The whole dictated text, in the order it was spoken. */
export function blockLines(block: DictationBlock): string[] {
  return [...block.committed, ...block.live].filter((l) => l.trim().length > 0);
}

/**
 * Fold one recogniser result into the session's block.
 *
 * The two platforms disagree about what a result IS, and this is where that
 * disagreement is settled once:
 *
 * - **iOS 18+ / Android** finalise each utterance and then start the transcript
 *   over, so a final result is a new line and interim results replace the line
 *   being spoken.
 * - **iOS 17 and earlier** in `continuous` mode never finalise until `stop()`
 *   and hand back ONE transcript that grows all session — which is how a whole
 *   workout used to end up on the first line. It arrives here as a live block
 *   that `splitOnPauses` has already broken up, and the final result at stop is
 *   the same text again.
 *
 * That last case is why a final result whose text already CONTAINS everything
 * committed replaces the committed lines instead of appending to them: on iOS
 * 17 the closing result repeats the session, and appending it would print the
 * workout twice.
 */
export function applyResult(
  block: DictationBlock,
  result: { lines: string[]; final: boolean },
): DictationBlock {
  const lines = result.lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (!result.final) return { committed: block.committed, live: lines };
  if (lines.length === 0) return { committed: block.committed, live: [] };

  const spoken = lines.join(' ').toLowerCase();
  const settled = block.committed.join(' ').toLowerCase();
  const repeatsEverything = settled.length > 0 && spoken.startsWith(settled);

  return {
    committed: repeatsEverything ? lines : [...block.committed, ...lines],
    live: [],
  };
}

/** Best match for `want` among what this device can actually dictate. */
export function matchLocale(want: string, supported: string[]): string | null {
  const normalised = want.replace(/_/g, '-');
  const exact = supported.find((l) => l.toLowerCase() === normalised.toLowerCase());
  if (exact) return exact;
  // `sl` should not match `sl-SI` only — a device set to plain `de` is still a
  // German device, and `de-DE` is the right recogniser for it.
  const base = normalised.split('-')[0].toLowerCase();
  if (!base) return null;
  return supported.find((l) => l.toLowerCase().split('-')[0] === base) ?? null;
}
