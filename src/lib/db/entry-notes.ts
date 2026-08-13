import {
  entryNoteKey,
  parseEntryNotes,
  readEntryNote,
  serializeEntryNotes,
  setEntryNoteIn,
  type EntryNotes,
} from '@/lib/entry-note';
import { namesMatch } from '@/lib/parse/receipt';

import { dayKeyFor, dayRangeIso, shiftDayKey, todayKey, type DayKey } from './dates';
import { getDb, nowIso } from './index';

/**
 * The per-entry notes of a session — the athlete's own words about ONE lift,
 * stored as a small JSON map on the workout row (schema v5, and the reasoning
 * lives on `MIGRATION_5_SQL`).
 *
 * Everything here is synchronous, like every other local write: opening the
 * note sheet, saving it and closing it never wait on a network round trip
 * (CLAUDE.md §3 — local-first, usable offline).
 */

/** Every note on one session, keyed by `entryNoteKey`. */
export function getEntryNotes(workoutId: string | null): EntryNotes {
  if (!workoutId) return {};
  const row = getDb().getFirstSync<{ entry_notes: string | null }>(
    'SELECT entry_notes FROM workouts WHERE id = ?',
    [workoutId],
  );
  return parseEntryNotes(row?.entry_notes);
}

/** One entry's note on one session, or null. */
export function getEntryNote(workoutId: string | null, exercise: string): string | null {
  return readEntryNote(getEntryNotes(workoutId), exercise);
}

/**
 * Write (or clear) one entry's note and return the session's whole map.
 *
 * Marks the row `dirty` so sync carries it, and deliberately does NOT touch
 * `needs_parse`: a note is not part of `raw_text`, and re-parsing because of one
 * would spend a model call on prose the parser must never read.
 */
export function setEntryNote(
  workoutId: string,
  exercise: string,
  text: string | null,
): EntryNotes {
  const next = setEntryNoteIn(getEntryNotes(workoutId), exercise, text);
  getDb().runSync('UPDATE workouts SET entry_notes = ?, updated_at = ?, dirty = 1 WHERE id = ?', [
    serializeEntryNotes(next),
    nowIso(),
    workoutId,
  ]);
  return next;
}

/** How many entry notes exist across the account — the §13 counter's own
 * denominator, and the only thing any caller needs in aggregate. */
export function countEntryNotes(userId: string): number {
  const rows = getDb().getAllSync<{ entry_notes: string | null }>(
    "SELECT entry_notes FROM workouts WHERE user_id = ? AND entry_notes IS NOT NULL AND trim(entry_notes) <> ''",
    [userId],
  );
  return rows.reduce((n, r) => n + Object.keys(parseEntryNotes(r.entry_notes)).length, 0);
}

export interface RecentEntryNote {
  /** The lift as the record spells it ("Bench Press"), not the storage key. */
  exercise: string;
  /** The athlete's words, verbatim. */
  note: string;
  /** The local day the note was written about. */
  day: DayKey;
}

/** How far back a note is still worth quoting. Older than this it is history,
 * not context — the brief would be reading out something the athlete has long
 * since trained past. */
const NOTE_WINDOW_DAYS = 60;
/** Sessions scanned. Bounded because this runs while Next is opening. */
const SCAN_SESSIONS = 40;

/**
 * The most recent note per lift, newest first — what Next quotes back.
 *
 * Only the LATEST note for a lift survives: three sessions of remarks about
 * bench would bury the briefing, and the newest one is the one that describes
 * the state the athlete is actually in.
 */
export function recentEntryNotes(userId: string, limit = 6): RecentEntryNote[] {
  // Local days, like every other window in the app — `dayRangeIso` is what
  // turns a local day into the ISO instant the column is compared against.
  const [since] = dayRangeIso(shiftDayKey(todayKey(), -NOTE_WINDOW_DAYS));
  const rows = getDb().getAllSync<{ performed_at: string; entry_notes: string | null }>(
    `SELECT performed_at, entry_notes FROM workouts
     WHERE user_id = ? AND entry_notes IS NOT NULL AND trim(entry_notes) <> ''
       AND performed_at >= ?
     ORDER BY performed_at DESC LIMIT ?`,
    [userId, since, SCAN_SESSIONS],
  );
  if (rows.length === 0) return [];

  // Display spellings, resolved once: the map is keyed lower-case, and quoting a
  // lift back as "bench press" would read as a different app than the ledger.
  const display = new Map<string, string>();
  for (const e of getDb().getAllSync<{ canonical: string }>(
    'SELECT canonical FROM exercises WHERE user_id = ? OR user_id IS NULL',
    [userId],
  )) {
    const key = entryNoteKey(e.canonical);
    if (key && !display.has(key)) display.set(key, e.canonical);
  }

  const out: RecentEntryNote[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const day = dayKeyFor(new Date(row.performed_at));
    for (const [key, note] of Object.entries(parseEntryNotes(row.entry_notes))) {
      if (seen.has(key)) continue; // an older remark about the same lift
      seen.add(key);
      out.push({ exercise: display.get(key) ?? key, note, day });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * The note attached to one lift, out of an already-read list. Exact key first;
 * then the same loose name match the rest of the app uses, so a brief line that
 * says "Bench Press" finds a note written on "bench". Ambiguity is silence —
 * quoting the wrong lift's words back at someone is worse than quoting none.
 */
export function noteForLift(notes: RecentEntryNote[], name: string): RecentEntryNote | null {
  const key = entryNoteKey(name);
  if (!key) return null;

  const exact = notes.find((n) => entryNoteKey(n.exercise) === key);
  if (exact) return exact;

  let loose: RecentEntryNote | null = null;
  for (const n of notes) {
    if (!namesMatch(name, n.exercise)) continue;
    if (loose && entryNoteKey(loose.exercise) !== entryNoteKey(n.exercise)) return null;
    loose = loose ?? n;
  }
  return loose;
}
