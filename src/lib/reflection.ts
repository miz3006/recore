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

/** The neutral placeholder before any prompt is chosen. */
export const REFLECTION_PLACEHOLDER = REFLECTION_PROMPTS[0]!;

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
