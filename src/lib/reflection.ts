/**
 * The end-of-session check-in — PURE, zero imports, zero I/O, so every rule is
 * unit-tested under plain `node --test` like `effort.ts` and `streak.ts`
 * (product-direction §8.1, implementation order step 3).
 *
 * WHAT A REFLECTION IS. The athlete's own words about a session that has just
 * finished: how it felt, energy, fatigue, recovery, whatever mattered. §8.1 is
 * explicit that these are "the athlete's own notes, not a health assessment",
 * and that they may be written "in Slovenian, English, or another language, or
 * skip with no penalty".
 *
 * WHAT IT IS NOT, and this is the load-bearing distinction:
 *
 *  · **Not part of the workout text.** `effort.ts` appends `rpe 8` INTO the
 *    line the user wrote, because RPE is training notation and CLAUDE.md §3
 *    says the words are the record. A reflection is prose about the session,
 *    not notation inside it — appending it to `raw_text` would hand it to the
 *    parser, which would try to read "legs felt heavy" as an exercise.
 *  · **Not a rebuildable projection.** §3 says structured data can be rebuilt
 *    from raw text; a reflection cannot be, so it is stored as its own column
 *    on the workout and a re-parse never touches it.
 *  · **Not an input to any number.** No prescription, no chart and no streak
 *    reads it. Step 4 may let the guarded brief QUOTE one; it will never let a
 *    reflection change a load.
 */

/** The longest note we store. Long enough for a paragraph, short enough that a
 * pasted essay cannot bloat every sync payload. Text beyond it is kept, not
 * silently cut — `normalizeReflection` refuses rather than truncates. */
export const MAX_REFLECTION_CHARS = 1000;

/**
 * The four lightweight prompts of §8.1, verbatim.
 *
 * They are SUGGESTIONS OF WHAT TO THINK ABOUT, never text that gets written for
 * the person. The sheet uses them as placeholders on an empty field: tapping
 * one changes what the field suggests and nothing else, so every character
 * stored is a character the athlete typed. Inserting the prompt into the note
 * would put words in their mouth and then keep them as if they were theirs.
 */
export const REFLECTION_PROMPTS: readonly string[] = [
  'How did that feel?',
  'Energy and fatigue?',
  'Recovery or food today?',
  'Anything that affected the session?',
] as const;

/**
 * The neutral placeholder in the check-in's own field.
 *
 * It used to be the first §8.1 prompt, and the chips under the field re-pointed
 * it at the others. Since the owner's 17 Aug 2026 ruling those chips ANSWER
 * instead of suggesting (see `REFLECTION_TAGS`), so the field asks the widest
 * question it can and gets out of the way. The four prompts above stay the
 * spec'd vocabulary for anywhere that still suggests rather than answers.
 */
export const REFLECTION_PLACEHOLDER = 'Anything about today…';

/**
 * THE PRESET ANSWERS (owner, 17 Aug 2026) — the chips under the field.
 *
 * This reverses the older ruling directly above `REFLECTION_PROMPTS`, and the
 * reversal is the owner's: tapping one now WRITES that phrase into the stored
 * reflection, multi-select, instead of merely re-pointing a placeholder. The
 * reason is that a placeholder tap changed nothing a person could see, and the
 * commonest three things worth remembering about a session are the three things
 * nobody wants to type one-handed on the gym floor.
 *
 * What keeps it honest is what did NOT change: nothing is preselected, the app
 * never infers one from the record, every chip is togglable off, and the text a
 * chip contributes is visible on the sheet the whole time it is armed. The
 * athlete still decides every word that gets stored — they just get three of
 * them as buttons.
 *
 * They are stored INSIDE the reflection column, as its first line, rather than
 * in a column of their own: a reflection is prose, and "Slept badly · Short on
 * time" is prose the person chose. No migration, no second source of truth, and
 * export/sync carry them for free. `splitReflection` reads them back out.
 */
export const REFLECTION_TAGS: readonly string[] = [
  'Slept badly',
  'Felt strong',
  'Short on time',
] as const;

/** What joins two armed chips on the stored line. The app's own separator, so
 * the split is unambiguous against ordinary prose. */
const TAG_SEP = ' · ';

/** The chosen chips in CANONICAL order (the order they appear on the sheet),
 * ignoring anything not on the list. */
export function reflectionTagLine(tags: readonly string[]): string {
  return REFLECTION_TAGS.filter((t) => tags.includes(t)).join(TAG_SEP);
}

/**
 * How many characters the free-text field may still take. The stored value is
 * the tag line PLUS the typed words, and `MAX_REFLECTION_CHARS` is a promise
 * about the whole thing, so arming a chip costs the field its own length.
 */
export function reflectionRoomFor(tags: readonly string[]): number {
  const line = reflectionTagLine(tags);
  return line.length === 0 ? MAX_REFLECTION_CHARS : MAX_REFLECTION_CHARS - line.length - 2;
}

/**
 * One stored reflection from the two things the sheet holds: the armed chips
 * and the typed words. Null when there is neither — skipping stays free.
 */
export function composeReflection(tags: readonly string[], text: string): string | null {
  const line = reflectionTagLine(tags);
  const body = text.trim();
  if (line.length === 0) return normalizeReflection(body);
  const composed = body.length > 0 ? `${line}\n\n${body}` : line;
  if (composed.length <= MAX_REFLECTION_CHARS) return composed;
  // Over the limit, one of the two has to go, and it is never the athlete's.
  // The chips are the app's contribution; the words are the record.
  return normalizeReflection(body);
}

/**
 * The inverse, so re-opening the sheet shows the chips armed and the words
 * intact. A first line made ENTIRELY of known tags is a tag line; anything else
 * is prose and stays in the field untouched — including, deliberately, a
 * reflection someone typed as literally "Felt strong", which round-trips to the
 * identical stored value either way.
 */
export function splitReflection(stored: string | null | undefined): {
  tags: string[];
  text: string;
} {
  const value = typeof stored === 'string' ? stored : '';
  if (value.trim().length === 0) return { tags: [], text: '' };

  const nl = value.indexOf('\n');
  const head = (nl === -1 ? value : value.slice(0, nl)).trim();
  const parts = head
    .split(TAG_SEP)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const isTagLine = parts.length > 0 && parts.every((p) => REFLECTION_TAGS.includes(p));
  if (!isTagLine) return { tags: [], text: value };

  const rest = nl === -1 ? '' : value.slice(nl + 1);
  return {
    tags: REFLECTION_TAGS.filter((t) => parts.includes(t)),
    text: rest.replace(/^\s+/, ''),
  };
}

/**
 * Clean a typed reflection for storage, or return null when there is nothing to
 * store.
 *
 * Null is a first-class answer: §8.1 says skipping is free, so an empty field,
 * a field of spaces, and a field that was filled and then cleared all resolve
 * the same way — no reflection. Trailing whitespace is dropped; the words
 * themselves are never edited, reworded or truncated.
 */
export function normalizeReflection(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_REFLECTION_CHARS) return null;
  return trimmed;
}

/** Is this text storable as written? False for empty and for over-long. */
export function isStorableReflection(text: string | null | undefined): boolean {
  return normalizeReflection(text) !== null;
}

/**
 * Why a field cannot be saved, or null when it can. Only one failure is
 * possible and it is the person's own doing, so the message states the limit
 * rather than scolding (§12: calm specificity).
 */
export function reflectionError(text: string): string | null {
  if (text.trim().length <= MAX_REFLECTION_CHARS) return null;
  return `That is longer than ${MAX_REFLECTION_CHARS} characters. Shorten it and it saves.`;
}

/**
 * Characters left, for the quiet counter that appears only near the limit.
 * Never a live count from zero — a counter on every keystroke turns a note into
 * a form.
 */
export const REFLECTION_COUNTER_FROM = MAX_REFLECTION_CHARS - 100;

export function reflectionCharsLeft(text: string): number | null {
  const used = text.trim().length;
  if (used < REFLECTION_COUNTER_FROM) return null;
  return MAX_REFLECTION_CHARS - used;
}
