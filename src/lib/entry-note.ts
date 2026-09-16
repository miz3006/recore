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

/**
 * THE FIELD'S OWN PLACEHOLDER — the widest question, not the first of four.
 *
 * It used to BE `ENTRY_NOTE_PROMPTS[0]`, because the prompts were the only
 * thing the sheet had: four chips that re-pointed this string and changed
 * nothing a person could see. The chips below now ANSWER instead of suggesting
 * (`ENTRY_NOTE_TAGS`), which is the 17 August ruling `reflection.ts` already
 * carries for the session, applied one level down to a single lift. With real
 * answers on the sheet, the field asks the widest question it can and gets out
 * of the way — `REFLECTION_PLACEHOLDER`'s exact shape, one scale smaller.
 *
 * The four prompts above stay the spec'd vocabulary for anywhere that still
 * suggests rather than answers.
 */
export const ENTRY_NOTE_PLACEHOLDER = 'Anything about this lift…';

/**
 * THE PRESET ANSWERS — the chips under the field (16 September 2026).
 *
 * This applies the owner's 17 August ruling for the session reflection
 * (`REFLECTION_TAGS`) to the per-entry note, which had been left on the older
 * suggest-only shape: tapping one now WRITES that phrase into the stored note,
 * multi-select, instead of merely re-pointing a placeholder. The reason is the
 * same one and it is stronger here — a remark about ONE lift is written on the
 * gym floor, one-handed, between sets, and a blank box with a rotating hint is
 * not something anyone fills in at that moment.
 *
 * WHICH FIVE, and each is an answer to one of `ENTRY_NOTE_PROMPTS`: the two
 * directions of "how did that feel", the commonest answer to "how was the form
 * or bar speed", the commonest answer to "anything hurting or tight", and the
 * commonest answer to "what would you change next time". They are the things a
 * lifter would otherwise type, in the order the questions are asked.
 *
 * What keeps it honest is what did NOT change: nothing is preselected, the app
 * never infers one from the record, every chip is togglable off, and the text a
 * chip contributes is visible on the sheet the whole time it is armed. The
 * athlete still decides every word that gets stored — they just get five of
 * them as buttons.
 *
 * NONE OF IT IS A NUMBER, and that boundary is load-bearing. "Felt heavy" is
 * prose that Next quotes back beside the lift; it is not RIR, it never reaches
 * the engine, and it moves no load. Effort is a number the athlete picks from a
 * bounded set, per set, and it lives in the correction sheet and the check-in
 * (see this file's header, and `effort.ts`).
 *
 * They are stored INSIDE the note, as its first line, rather than in a column
 * of their own: the note is prose, and "Felt heavy · Go up next time" is prose
 * the person chose. No migration, no second source of truth, and export and
 * sync carry them for free. `splitEntryNote` reads them back out.
 */
export const ENTRY_NOTE_TAGS: readonly string[] = [
  'Felt easy',
  'Felt heavy',
  'Form broke down',
  'Something felt tight',
  'Go up next time',
] as const;

/** What joins two armed chips on the stored line — the app's own separator, so
 * the split is unambiguous against ordinary prose. The same glyph
 * `reflection.ts` uses, because it is the same idea one level down. */
const TAG_SEP = ' · ';

/** The chosen chips in CANONICAL order (the order they stand on the sheet),
 * ignoring anything not on the list. */
export function entryNoteTagLine(tags: readonly string[]): string {
  return ENTRY_NOTE_TAGS.filter((t) => tags.includes(t)).join(TAG_SEP);
}

/**
 * How many characters the free-text field may still take. The stored value is
 * the tag line PLUS the typed words, and `MAX_ENTRY_NOTE_CHARS` is a promise
 * about the whole thing, so arming a chip costs the field its own length (plus
 * the blank line between them).
 */
export function entryNoteRoomFor(tags: readonly string[]): number {
  const line = entryNoteTagLine(tags);
  return line.length === 0 ? MAX_ENTRY_NOTE_CHARS : MAX_ENTRY_NOTE_CHARS - line.length - 2;
}

/**
 * One stored note from the two things the sheet holds: the armed chips and the
 * typed words. Null when there is neither — skipping stays free, and clearing
 * both genuinely leaves nothing behind.
 */
export function composeEntryNote(tags: readonly string[], text: string): string | null {
  const line = entryNoteTagLine(tags);
  const body = text.trim();
  if (line.length === 0) return normalizeEntryNote(body);
  const composed = body.length > 0 ? `${line}\n\n${body}` : line;
  if (composed.length <= MAX_ENTRY_NOTE_CHARS) return composed;
  // Over the limit, one of the two has to go, and it is never the athlete's.
  // The chips are the app's contribution; the words are the record.
  return normalizeEntryNote(body);
}

/**
 * The inverse, so re-opening the sheet shows the chips armed and the words
 * intact. A first line made ENTIRELY of known tags is a tag line; anything else
 * is prose and stays in the field untouched — including, deliberately, a note
 * someone typed as literally "Felt heavy", which round-trips to the identical
 * stored value either way.
 */
export function splitEntryNote(stored: string | null | undefined): {
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

  const isTagLine = parts.length > 0 && parts.every((p) => ENTRY_NOTE_TAGS.includes(p));
  if (!isTagLine) return { tags: [], text: value };

  const rest = nl === -1 ? '' : value.slice(nl + 1);
  return {
    tags: ENTRY_NOTE_TAGS.filter((t) => parts.includes(t)),
    text: rest.replace(/^\s+/, ''),
  };
}

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
