import { loadUndoneKeys } from '@/lib/db/done-state';
import { computeSignals } from '@/lib/db/history';
import { getDb, nowIso } from '@/lib/db/index';
import { getWorkoutById } from '@/lib/db/workouts';
import { devLog } from '@/lib/log';

import { getParseCache } from './apply';
import { assignLines } from './line-map';
import {
  validateParseResult,
  type LineSignal,
  type ParsedItem,
  type ParsedSet,
  type ParseResult,
} from './types';

/**
 * REBUILDING A READING FROM THE DEVICE'S OWN STRUCTURE — no model, no network.
 *
 * ## The bug this exists for
 *
 * `items` and `sets` SYNC. `parse_cache` DOES NOT — it is a local table and
 * always has been. But `loadDay` reads the ledger out of `parse_cache` and
 * nothing else, so on any device that pulled its history down rather than
 * typing it, **every past day renders as if it had never been parsed**: raw
 * lines, no gutter readings, no receipt.
 *
 * Measured on a real account, 10 September 2026: **66 workouts, 1 parse_cache
 * row.** Sixty-five days of training with the structure sitting right there in
 * SQLite — 114 items, 342 sets — and not one of them showing a reading.
 *
 * And it did not repair itself. `runParse` is called from exactly two places,
 * both of them the composer (`setNote`'s debounce and the ghost accept), so
 * OPENING a day parses nothing; and `pullRemote` writes `needs_parse = 0`, so
 * the sync loop's `retryPendingParses` never picked those days up either. The
 * only way to get a reading onto an old day was to type into it — which
 * rewrites the day you were trying to read.
 *
 * ## Why rebuilding is not inventing
 *
 * CLAUDE.md §3: *"Raw workout text is the source of truth; structured data is a
 * rebuildable projection."* `items`/`sets` ARE that projection — written by a
 * real parse of this exact text, on this device or another one, and pulled down
 * verbatim. Going back the other way makes no claim the record does not already
 * hold: every number here was read out of SQLite, not out of a model. It is the
 * same move `reapplyDoneState` already makes when a checklist toggle
 * re-projects a session without a re-parse.
 *
 * The one thing the projection genuinely lost is **which line each item came
 * from** — `items` stores `position` (its ordinal in the workout), not the
 * physical line. That is the whole difficulty, and §The line rule below is how
 * it is answered without a guess.
 *
 * ## The line rule: prove it, or refuse
 *
 * A reading printed against the wrong line is worse than no reading — it is the
 * app misquoting the athlete. So the mapping is only accepted when it is
 * FORCED rather than inferred:
 *
 *   **the note's non-empty lines and the workout's item-groups must be the same
 *   count.**
 *
 * Items are stored in reading order and an inline superset shares one line
 * (which is what `group_key` marks), so when those two counts agree there is
 * exactly one order-preserving assignment and the i-th group belongs to the
 * i-th non-empty line. Nothing is matched by name, nothing is searched for, and
 * a note with a prose line in it — which produces no item and would slide every
 * item below it up one — fails the count and is refused.
 *
 * Refusing is cheap: the day is queued for a real parse instead
 * (`queueUnreadableDays`), which is what would have happened anyway.
 *
 * Measured against the same real account: **43 of 66 days rebuild, 0 are
 * ambiguous, 23 have no structure at all.** The strict rule cost nothing.
 *
 * ## What it will not touch
 *
 * - **A note edited since the structure was built.** `saveRawText` sets
 *   `needs_parse = 1` on every keystroke, so `needs_parse = 0` is the device's
 *   own statement that the structure belongs to this text. Anything else is
 *   refused.
 * - **`items` / `sets` themselves.** This only writes `parse_cache`. It
 *   deliberately does not go through `rebuildAndSignal`, which would delete and
 *   rewrite the structure and mark the row dirty — a re-push of rows that came
 *   from the server, to say nothing of the write amplification.
 * - **The parse version.** The cache is written with the version the workout
 *   was parsed at, so a later prompt deploy still supersedes it through
 *   `parseWorkout`'s existing version check. A rebuilt reading displays; it does
 *   not pretend to be current.
 */

interface ItemRow {
  id: string;
  position: number;
  group_key: string | null;
  exercise_id: string | null;
  canonical: string | null;
  aliases: string | null;
  modality: string | null;
}

interface SetRow {
  id: string;
  item_id: string;
  position: number;
  kind: string;
  parent_set_id: string | null;
  reps: number | null;
  weight_kg: number | null;
  distance_m: number | null;
  duration_s: number | null;
  rir: number | null;
  note: string | null;
}

/** The exercise's stored shorthand list, or nothing. Used only to widen what a
 * line may be recognised by; never to decide one. */
function aliasesOf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((a): a is string => typeof a === 'string').slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

/**
 * The workout's structure, as a `ParseResult` — or null when the line mapping
 * cannot be proved (see §The line rule).
 *
 * Exported for the test; callers want `hydrateFromStructure`.
 */
export function resultFromStructure(
  workoutId: string,
  rawText: string,
  parseVersion: number,
): { result: ParseResult; exerciseIdByItem: Map<ParsedItem, string> } | null {
  const db = getDb();

  const items = db.getAllSync<ItemRow>(
    `SELECT i.id, i.position, i.group_key, i.exercise_id,
            e.canonical, e.aliases, e.modality
       FROM items i
       LEFT JOIN exercises e ON e.id = i.exercise_id
      WHERE i.workout_id = ?
      ORDER BY i.position ASC`,
    [workoutId],
  );
  if (items.length === 0) return null;

  // Every set for the workout in one query, then bucketed — one round trip
  // instead of one per item, because this runs for a whole window of days at
  // once on open.
  const sets = db.getAllSync<SetRow>(
    `SELECT s.* FROM sets s
       JOIN items i ON i.id = s.item_id
      WHERE i.workout_id = ?
      ORDER BY s.position ASC`,
    [workoutId],
  );
  const setsByItem = new Map<string, SetRow[]>();
  for (const s of sets) {
    const list = setsByItem.get(s.item_id);
    if (list) list.push(s);
    else setsByItem.set(s.item_id, [s]);
  }

  // --- the line rule (`line-map.ts`, which carries the reasoning) ------------
  const lineOf = assignLines(
    items.map((i) => i.group_key),
    rawText,
  );
  if (!lineOf) return null; // ambiguous — refuse rather than misquote a line

  // --- the result ------------------------------------------------------------
  const rawItems: unknown[] = [];
  const exerciseIds: (string | null)[] = [];

  items.forEach((item, i) => {
    const line = lineOf[i]!;

    const rows = setsByItem.get(item.id) ?? [];
    // `parent` is an index into THIS item's own sets — the inverse of the map
    // `rebuildAndSignal` made when it wrote them.
    const indexById = new Map<string, number>();
    rows.forEach((r, idx) => indexById.set(r.id, idx));

    const parsedSets: ParsedSet[] = rows.map((r) => ({
      kind: r.kind as ParsedSet['kind'],
      reps: r.reps,
      weight_kg: r.weight_kg,
      distance_m: r.distance_m,
      duration_s: r.duration_s,
      rir: r.rir,
      parent: r.parent_set_id != null ? (indexById.get(r.parent_set_id) ?? null) : null,
      note: r.note,
    }));

    rawItems.push({
      exercise: item.canonical ?? '',
      aliases_seen: aliasesOf(item.aliases),
      modality: item.modality ?? 'strength',
      group_key: item.group_key,
      line,
      sets: parsedSets,
    });
    exerciseIds.push(item.exercise_id);
  });

  // Through the SAME validator the model's output goes through, so a rebuilt
  // reading can never carry a shape the live path would have rejected. It drops
  // set-less items, which is why the id list is re-aligned by exercise name
  // below rather than by index.
  const result = validateParseResult({ items: rawItems, parse_version: parseVersion });
  if (!result || result.items.length === 0) return null;

  // `computeSignals` is keyed by item IDENTITY, so the map has to be built from
  // the validated items rather than from the rows. Validation only ever drops
  // items and never reorders them, so a forward walk pairs them exactly.
  const exerciseIdByItem = new Map<ParsedItem, string>();
  let source = 0;
  for (const validated of result.items) {
    while (source < rawItems.length) {
      const candidate = rawItems[source] as { exercise: string; line: number };
      source += 1;
      if (candidate.exercise === validated.exercise && candidate.line === validated.line) {
        const id = exerciseIds[source - 1];
        if (id) exerciseIdByItem.set(validated, id);
        break;
      }
    }
  }

  return { result, exerciseIdByItem };
}

/**
 * Fill a workout's `parse_cache` from its own stored structure. Returns the
 * signals it wrote, or null when the day could not be rebuilt (see above) —
 * in which case the caller should queue it for a real parse.
 *
 * Synchronous and local: a few SQLite reads and one write. Safe to call from
 * `loadDay`, which is on the day-swipe path.
 */
export function hydrateFromStructure(userId: string, workoutId: string): LineSignal[] | null {
  const workout = getWorkoutById(workoutId);
  if (!workout || workout.user_id !== userId) return null;

  const rawText = workout.raw_text;
  if (rawText.trim().length === 0) return null;
  // The structure belongs to THIS text — `saveRawText` sets the flag on every
  // keystroke, so anything else is a note that has moved on.
  if (workout.needs_parse === 1) return null;

  // A cache that already matches is the answer; never overwrite a real parse
  // with a rebuild of it.
  const cached = getParseCache(workoutId);
  if (cached && cached.raw_snapshot === rawText) return null;

  /**
   * FROM HERE DOWN IT IS ALL-OR-NOTHING, AND IT MAY NOT THROW.
   *
   * This runs inside `loadDay` — on app open and on every day swipe — so a
   * malformed alias blob, a set row with a dangling parent or any other
   * surprise in a table that came off a server would take the SCREEN down, not
   * just the reading. A repair path that can break the thing it repairs is
   * worse than no repair path.
   *
   * Failing here is not a silent loss: the day renders exactly as it did before
   * this file existed, and the warm pass queues it for a real parse.
   */
  let built;
  let signals: LineSignal[];
  try {
    built = resultFromStructure(workoutId, rawText, workout.parse_version ?? 0);
    if (!built) return null;
    signals = computeSignals(
      userId,
      workout.performed_at,
      built.result,
      built.exerciseIdByItem,
      loadUndoneKeys(workoutId),
    );
  } catch (err) {
    devLog('reading not rebuilt:', err instanceof Error ? err.message : err);
    return null;
  }

  getDb().runSync(
    `INSERT INTO parse_cache (workout_id, raw_snapshot, result_json, signals_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workout_id) DO UPDATE SET
       raw_snapshot = excluded.raw_snapshot,
       result_json = excluded.result_json,
       signals_json = excluded.signals_json,
       updated_at = excluded.updated_at`,
    [workoutId, rawText, JSON.stringify(built.result), JSON.stringify(signals), nowIso()],
  );

  return signals;
}

/**
 * THE WARM PASS — run once on open, over the days a person actually looks at.
 *
 * Rebuilding is cheap but it is not free, and `loadDay` runs on the day-swipe
 * path where a few tens of milliseconds is a dropped frame. Doing the recent
 * window up front means the swipe itself reads a cache that is already there.
 *
 * It also does the half rebuilding cannot: a day with text and **no structure
 * at all** has never been parsed anywhere, so it is marked `needs_parse` and
 * the sync loop reads it — newest first, which is the order
 * `getWorkoutsNeedingParse` already returns. Before this, `pullRemote` wrote
 * `needs_parse = 0` and nothing ever queued those days, so they stayed
 * unreadable for ever.
 *
 * Returns what it did, for the log.
 */
export function warmRecentReadings(
  userId: string,
  /** How far back to go. Two weeks covers "the last week and a half" with room
   * for a person who trains on a nine-day rotation. */
  days = WARM_WINDOW_DAYS,
): { rebuilt: number; queued: number } {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = getDb().getAllSync<{ id: string; needs_parse: number }>(
    `SELECT id, needs_parse FROM workouts
      WHERE user_id = ? AND trim(raw_text) <> '' AND performed_at >= ?
      ORDER BY performed_at DESC
      LIMIT ?`,
    [userId, since, WARM_MAX_DAYS],
  );

  let rebuilt = 0;
  let queued = 0;
  for (const row of rows) {
    // One awkward day may not cost the other thirteen — and none of them may
    // cost the app open this runs inside.
    try {
      if (row.needs_parse === 1) continue; // already on the parser's list
      if (hydrateFromStructure(userId, row.id)) {
        rebuilt += 1;
        continue;
      }
      // Could not be rebuilt. If it has NO structure it has never been read at
      // all, and the parser is the only thing that can help — queue it. If it
      // has structure but an unprovable line mapping, queue it for the same
      // reason: a real parse restores the line numbers rebuilding cannot.
      const cached = getParseCache(row.id);
      if (!cached) {
        getDb().runSync('UPDATE workouts SET needs_parse = 1 WHERE id = ?', [row.id]);
        queued += 1;
      }
    } catch (err) {
      devLog('day not warmed:', err instanceof Error ? err.message : err);
    }
  }

  if (rebuilt > 0 || queued > 0) {
    devLog(`readings warmed — ${rebuilt} rebuilt from structure, ${queued} queued to parse`);
  }
  return { rebuilt, queued };
}

/** The window the warm pass covers. */
export const WARM_WINDOW_DAYS = 14;
/** A hard ceiling on the warm pass, so a very dense fortnight cannot turn an
 * app open into a long synchronous job. */
const WARM_MAX_DAYS = 30;
