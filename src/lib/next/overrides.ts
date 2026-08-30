import { getMeta, setMeta } from '@/lib/db/index';
import { entryNoteKey } from '@/lib/entry-note';
import { devWarn } from '@/lib/log';

/**
 * THE ATHLETE'S OWN TARGETS — Next's inline override store (owner, 28 August
 * 2026).
 *
 * *"A plan you can't argue with is a plan you fight."* Symmetry answers that
 * with a whole Edit Workout bar; this is the lighter version the owner asked
 * for. Any target on Next can be overwritten in place, and the row that takes
 * an override visibly stops being a derived value — it loses its reason line
 * and its planned green and reads as the athlete's own number.
 *
 * ## This is not a record
 *
 * Nothing here is ever written into `raw_text`, counted, exported as a set, or
 * synced. It is a note about what the athlete intends to put on the bar, and
 * the invariant that survives it is the one that matters: **nothing counts
 * until it is lifted and written.** That is why this lives in `meta` — the
 * local key-value scratch — rather than in a table with an RLS policy and a
 * sync path. An override that failed to reach another device costs a person
 * one retype; a fabricated set costs the record its meaning.
 *
 * ## Why each override remembers what it displaced
 *
 * An override is an argument with a specific number. Store it bare and it
 * silently outlives the argument: the engine deloads to 90, the athlete's old
 * "85" from three weeks ago is still sitting there, and the screen shows a
 * number that no longer disagrees with anything.
 *
 * So each entry carries `was` — the derived load it replaced — and a stale
 * entry is one whose `was` no longer matches what the engine says today. Stale
 * entries are IGNORED on read and dropped on the next write. The override
 * expires exactly when the reason it existed expires, and no session identity,
 * date key or cache invalidation rule is needed to make that true.
 */

const KEY = 'next_overrides';

export interface Override {
  /** The athlete's number, in kilograms. */
  kg: number;
  /** The derived load it displaced. The override is void once this stops
   * matching the engine — see the header. */
  was: number | null;
}

type Book = Record<string, Override>;

function read(): Book {
  const raw = getMeta(KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Book;
  } catch (err) {
    devWarn('next overrides: unreadable, starting empty', err);
    return {};
  }
}

function write(book: Book): void {
  setMeta(KEY, Object.keys(book).length > 0 ? JSON.stringify(book) : null);
}

/** Every override on file, keyed the way every other surface keys a lift. */
export function getOverrides(): Book {
  return read();
}

/**
 * The athlete's number for one lift, or null.
 *
 * `derived` is what the engine says TODAY. Passing it is not optional and not
 * a convenience: it is the staleness check, and a caller that skips it would
 * be showing an argument with a number that is no longer on screen.
 */
export function overrideFor(name: string, derived: number | null): number | null {
  const entry = read()[entryNoteKey(name)];
  if (!entry) return null;
  return entry.was === derived ? entry.kg : null;
}

/** Set or clear one lift's override. `kg` of null removes it. */
export function setOverride(name: string, kg: number | null, derived: number | null): void {
  const key = entryNoteKey(name);
  const book = read();
  if (kg == null) {
    delete book[key];
  } else {
    book[key] = { kg, was: derived };
  }
  write(book);
}

/** Drop every override — the session was written, so the argument is over. */
export function clearOverrides(): void {
  setMeta(KEY, null);
}
