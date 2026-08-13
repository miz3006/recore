/**
 * The per-entry note — PURE, zero imports, zero I/O, so every rule is unit
 * tested under plain `node --test` like `reflection.ts` and `effort.ts`
 * (owner, 4 August 2026).
 *
 * WHAT IT IS. One line in the ledger is one recorded exercise; this is the
 * athlete's own sentence about THAT entry — how the set felt, where the bar
 * slowed, a shoulder that complained. §8.1 already gives the session a
 * reflection; this is the same idea one level down, where a lifter actually
 * has something specific to say.
 *
 * WHAT IT IS NOT, and the distinctions are load-bearing:
 *
 *  · **Not part of the workout text.** `effort.ts` appends `rpe 8` INTO the
 *    line, because RPE is training notation and the words are the record
 *    (CLAUDE.md §3). "felt heavy, shoulder tight" is prose ABOUT the entry —
 *    appending it would hand it to the parser, which would try to read it as
 *    an exercise, and a re-parse could rewrite or lose it.
 *  · **Not an input to any number.** No prescription, chart, PR or streak reads
 *    it. The load that Next prescribes changes through the EFFORT scale
 *    (`effort.ts` → rir → the engine), which is a number the athlete chose from
 *    a bounded set. A sentence never moves a weight.
 *  · **Not a health assessment.** Like a reflection, it is quoted back verbatim
 *    or not at all — Next shows the athlete's own words beside the lift they
 *    were written about, and never draws a conclusion from them.
 *
 * KEYED BY EXERCISE, per workout. A key has to survive the day: line indexes
 * shift when a line is deleted, and the set text changes the moment a number is
 * corrected — both would orphan a note the athlete wrote. The canonical
 * exercise name is what stays put, and it is also the granularity Next needs
 * ("your note on Bench Press last session"). Two entries of the same lift on
 * one day share the note, which is the honest reading of "how did bench go".
 */

/** The longest note we store on one entry. Shorter than a session reflection
 * (1000): this is a remark about one lift, and a paragraph belongs to the
 * check-in. Text beyond it is refused, never truncated. */
export const MAX_ENTRY_NOTE_CHARS = 300;

/** How many entries in ONE session may carry a note. A bound, not a rule about
 * training: it keeps a single synced row small no matter what arrives from
 * another device. Nobody writes 40 notes in one workout. */
export const MAX_ENTRY_NOTES_PER_WORKOUT = 40;

/**
 * The suggestions under an empty field, in §8.1's voice: things to think about,
 * never text that gets written for the person. Tapping one changes what the
 * field suggests and nothing else, so every stored character is one the athlete
 * typed.
 */
export const ENTRY_NOTE_PROMPTS: readonly string[] = [
  'How did that feel?',
  'How was the form or bar speed?',
  'Anything hurting or tight?',
  'What would you change next time?',
] as const;

/** The neutral placeholder before any prompt is chosen. */
export const ENTRY_NOTE_PLACEHOLDER = ENTRY_NOTE_PROMPTS[0]!;

/** The map as it is stored on a workout: exercise key → the athlete's words. */
export type EntryNotes = Record<string, string>;

/**
 * The storage key for one exercise: trimmed, lower-cased, inner whitespace
 * collapsed. Nothing else — the DISPLAY name stays whatever the record says,
 * and this is only how two spellings of the same lift find each other.
 */
export function entryNoteKey(exercise: string | null | undefined): string {
  if (typeof exercise !== 'string') return '';
  return exercise.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Clean a typed note for storage, or return null when there is nothing to
 * store. Empty, whitespace-only and cleared-after-writing all resolve the same
 * way: no note. Over-long is REFUSED rather than cut — the app never edits the
 * athlete's words.
 */
export function normalizeEntryNote(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_ENTRY_NOTE_CHARS) return null;
  return trimmed;
}

/** Is this text storable as written? False for empty and for over-long. */
export function isStorableEntryNote(text: string | null | undefined): boolean {
  return normalizeEntryNote(text) !== null;
}

/** Why a field cannot be saved, or null when it can. States the limit rather
 * than scolding (§12: calm specificity). */
export function entryNoteError(text: string): string | null {
  if (text.trim().length <= MAX_ENTRY_NOTE_CHARS) return null;
  return `That is longer than ${MAX_ENTRY_NOTE_CHARS} characters. Shorten it and it saves.`;
}

/** Characters left, for the quiet counter that appears only near the limit. */
export const ENTRY_NOTE_COUNTER_FROM = MAX_ENTRY_NOTE_CHARS - 60;

export function entryNoteCharsLeft(text: string): number | null {
  const used = text.trim().length;
  if (used < ENTRY_NOTE_COUNTER_FROM) return null;
  return MAX_ENTRY_NOTE_CHARS - used;
}

/**
 * Decode the stored JSON. UNTRUSTED input by design: this string can arrive
 * from the sync pull, i.e. from another device or a hand-edited row, so
 * anything that is not a string-to-string map of storable notes is dropped
 * rather than believed. A malformed blob resolves to "no notes", never to a
 * throw — a bad column must not be able to blank the ledger.
 */
export function parseEntryNotes(json: string | null | undefined): EntryNotes {
  if (typeof json !== 'string' || json.trim().length === 0) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return {};
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};

  const out: EntryNotes = {};
  let kept = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (kept >= MAX_ENTRY_NOTES_PER_WORKOUT) break;
    const key = entryNoteKey(k);
    if (!key) continue;
    const note = normalizeEntryNote(typeof v === 'string' ? v : null);
    if (note === null) continue;
    out[key] = note;
    kept += 1;
  }
  return out;
}

/** Encode for storage, or null when there is nothing left to store — an empty
 * map is written as NULL so "no notes" is one state in the database, not two. */
export function serializeEntryNotes(notes: EntryNotes): string | null {
  const keys = Object.keys(notes).filter((k) => normalizeEntryNote(notes[k]) !== null);
  if (keys.length === 0) return null;
  // Sorted, so the same set of notes always serializes to the same string: the
  // row's dirty flag then means a real change rather than a re-ordering.
  const out: EntryNotes = {};
  for (const k of keys.sort()) out[k] = normalizeEntryNote(notes[k])!;
  return JSON.stringify(out);
}

/** One entry's note, or null. */
export function readEntryNote(notes: EntryNotes, exercise: string): string | null {
  const key = entryNoteKey(exercise);
  return key ? (notes[key] ?? null) : null;
}

/**
 * Set or clear one entry's note, returning a NEW map (the store keeps state
 * immutable). Null — and anything that normalizes to null — removes the entry
 * entirely, so clearing a field genuinely leaves nothing behind.
 */
export function setEntryNoteIn(
  notes: EntryNotes,
  exercise: string,
  text: string | null,
): EntryNotes {
  const key = entryNoteKey(exercise);
  if (!key) return notes;
  const next: EntryNotes = { ...notes };
  const note = normalizeEntryNote(text);
  if (note === null) {
    delete next[key];
    return next;
  }
  // At the cap, a note for a NEW entry is refused rather than silently evicting
  // one the athlete already wrote. Editing an existing entry always works.
  if (next[key] === undefined && Object.keys(next).length >= MAX_ENTRY_NOTES_PER_WORKOUT) {
    return notes;
  }
  next[key] = note;
  return next;
}
