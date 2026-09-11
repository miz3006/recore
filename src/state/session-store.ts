import { router } from 'expo-router';
import { create } from 'zustand';

import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { loadUndoneKeys, loadUndoneMap, saveUndone } from '@/lib/db/done-state';
import { getEntryNotes, setEntryNote } from '@/lib/db/entry-notes';
import { getMeta, setMeta } from '@/lib/db/index';
import { setPlanDayChoice } from '@/lib/db/plan';
import { loadPlannedSession, plannedSessionFor, savePlannedSession } from '@/lib/db/planned';
import {
  editSet as editPlannedSetIn,
  logSet as logPlannedSetIn,
  settleFromNote,
  unlogSet as unlogPlannedSetIn,
  type PlannedSession,
} from '@/lib/planned-session';
import type { SessionOption } from '@/lib/session-options';
import { computeStreak, countSessions, getWorkoutForDay, saveRawText } from '@/lib/db/workouts';
import { getPredictionForOpen, markPredictionAccepted } from '@/lib/db/predictions';
import { computePlanStrip, type PlanStrip } from '@/lib/db/strip';
import { setEffortOnLine, type Effort } from '@/lib/effort';
import { readEntryNote, type EntryNotes } from '@/lib/entry-note';
import { markEntryNoteAdded } from '@/lib/funnel';
import { removeLine, restoreLine } from '@/lib/note-lines';
import { getParseCache, reapplyDoneState } from '@/lib/parse/apply';
import { hydrateFromStructure, warmRecentReadings } from '@/lib/parse/rehydrate';
import { parseWorkout, type ParseOutcome } from '@/lib/parse/client';
import { applyCorrection, getFixTarget, type FixTarget } from '@/lib/parse/correct';
import { buildReceipt, type ReceiptData } from '@/lib/parse/receipt';
import { validateParseResult, type LineSignal, type ParsedSet } from '@/lib/parse/types';
import { scheduleSync, setParseListener } from '@/lib/sync/index';

/**
 * Home-screen state, backed by SQLite (CLAUDE.md §6):
 *  - every keystroke writes raw_text to SQLite in the SAME tick (optimistic,
 *    0ms — the DB layer is synchronous), then
 *  - a debounced background call parses it through the edge function, and the
 *    result fades into the right gutter as comparison signals.
 * Nothing in here ever awaits the network before updating the UI.
 *
 * The selected day is any past-or-today calendar date (the date pill opens a
 * calendar sheet); the ghost prediction only ever appears on today.
 */
export interface GhostData {
  /** predictions row id — Start marks it accepted (adherence, §7.2 Gap 3). */
  id: string;
  ghostText: string;
  reason: string | null;
}

interface SessionState {
  userId: string | null;
  /** YYYY-MM-DD (local) of the day being viewed/edited. */
  selectedDay: DayKey;
  note: string;
  /** id of the day's workout row once it exists. */
  workoutId: string | null;
  /** Composer checklist: exercise cards are DONE (filled check) by default; a
   * key here marks one the user un-checked ("recorded but not done yet"). Keyed
   * by exercise+sets so it survives reorder; persisted per workout in meta. */
  undone: Record<string, true>;
  /**
   * The athlete's own note on individual ENTRIES of this session, keyed by
   * `entryNoteKey` (`lib/entry-note.ts`). Prose about one lift — never part of
   * `raw_text`, never read by the parser, never an input to a number. Next
   * quotes it back beside the lift it was written about.
   */
  entryNotes: EntryNotes;
  /** The ledger entry whose note sheet is open, or null. */
  noteTarget: { exercise: string; setText: string; line: number } | null;
  /** Gutter signals + the exact raw text they were computed from. */
  signals: LineSignal[];
  parsedSnapshot: string | null;
  parsedVolume: number;
  /** True while a background parse is in flight — drives the gutter's quiet
   * "analyzing" dots so the user sees something is happening. */
  parsing: boolean;
  /** line index → canonical exercise; tap on a gutter value opens the sheet. */
  lineExercises: Record<number, string>;
  /** RECEIPT MODE (CLAUDE.md §9): the whole workout was typed in at once, so
   * the per-line gutter is replaced by one session summary under the note.
   * Detected once per workout (≥4 exercises parsed from a note that was empty
   * moments before) and remembered in the local meta KV. */
  receiptMode: boolean;
  receipt: ReceiptData | null;
  /** The ONE line the AI may say under the receipt (next-session reason). */
  receiptReason: string | null;
  /** Canonical name of the exercise whose bottom sheet is open, or null. */
  sheetExercise: string | null;
  /** Workout id whose set-by-set SessionSheet is open, or null. */
  sheetSession: string | null;
  /** The note line the sheet was opened from (a live card) — enables Edit /
   * Delete of that entry. Null when opened without a line context. */
  sheetLine: number | null;
  /** A committed line the composer is editing inline (tap a card → Edit). */
  editingLine: number | null;
  /** The parsed line being corrected — opened from a card's alias echo or the
   * inline editor's "fix reading" — or null. */
  fixTarget: FixTarget | null;
  /** Bumped after every landed correction — read-side caches key on it. */
  fixRevision: number;
  streak: number;
  /** Sessions on the record, all time — the top bar's labelled figure. */
  sessionCount: number;
  /**
   * Epoch ms of the last write to THIS day's note, or null on an empty day.
   * Read from `workouts.updated_at`, so it survives a relaunch mid-session.
   * With `sessionFinished` it answers one question (`lib/session-activity.ts`):
   * is the athlete still in the gym?
   */
  lastActivityAt: number | null;
  /** Finish was pressed on this day's session. Sticky per workout in the meta
   * KV, like receipt mode — a settled session must re-open settled. */
  sessionFinished: boolean;
  ghost: GhostData | null;
  ghostDismissed: boolean;
  /** Today's declared day-template resolved to movements + engine loads (the
   * read-only plan-in-view strip). Recomputed on open and after each parse. */
  planStrip: PlanStrip | null;
  /** Answer the session-start question (§8.2): pin a day-template as TODAY's
   * due day. Persisted day-keyed in the meta KV, read by resolveTodayPlanDay —
   * so the strip, calendar, and Next brief all follow the answer. */
  choosePlanDay: (planDayId: string) => void;

  /**
   * The day's PREFILLED CHECKLIST (owner's spec §E, 13 Aug 2026), or null.
   *
   * It is not the record and never becomes one on its own: planned sets are
   * excluded from today's totals, the week, the streak and every statistic,
   * because none of them has been written into `raw_text`. A tapped circle
   * writes its line through `setNote` like any keystroke — one path in, one
   * source of truth, and from that instant the set counts everywhere.
   */
  plannedSession: PlannedSession | null;
  /** Prefill today from a picker option (`lib/session-options.ts`). Choosing a
   * split day also pins it as today's due day, so the strip, the calendar and
   * the Next brief follow the same answer the picker gave. */
  startPlannedSession: (option: SessionOption) => void;
  /**
   * START, from Next (owner, 28 August 2026).
   *
   * Next is where the plan lives, so Next is where a session begins. The
   * targets on that screen — the engine's, with any the athlete overrode —
   * arrive here as a `PlannedSession` and become today's checklist.
   *
   * IT WRITES NOTHING. The one invariant this had to keep is that a plan is
   * not a record: `raw_text` is untouched, so today's totals, the week, the
   * streak and every statistic still see an unwritten day. A set counts when
   * its circle is ticked and the line is written, through the path a typed
   * line has always taken. That is the whole reason the checklist was the
   * right destination and "fill the note with the plan" was not.
   *
   * `predictionId` is the ghost that earned the Start, when the plan came from
   * one — adherence, §7.2 Gap 3, the same accept `startFromGhost` records.
   */
  startFromNext: (session: PlannedSession, predictionId: string | null) => void;
  /** Put the checklist away. The record it has already written stays. */
  clearPlannedSession: () => void;
  /** Tap a circle: done at the planned values, into the note, counting. */
  logPlannedSet: (id: string) => void;
  /** Untap it: back to planned, and out of the note again. */
  unlogPlannedSet: (id: string) => void;
  /** Log what actually happened instead of the plan. */
  editPlannedSet: (id: string, values: { weightKg?: number | null; reps?: number | null }) => void;

  hydrate: (userId: string) => void;
  reset: () => void;
  selectDay: (day: DayKey) => void;
  setNote: (text: string) => void;
  startFromGhost: () => void;
  /** Strong-style check-off: commit ONE prescribed line into the note. */
  checkGhostLine: (lineText: string) => void;
  dismissGhost: () => void;
  openExerciseSheet: (canonical: string, line?: number | null) => void;
  closeExerciseSheet: () => void;
  /** Open the forensic set-by-set sheet for one recorded workout. */
  openSessionSheet: (workoutId: string) => void;
  closeSessionSheet: () => void;
  /** Toggle a composer card between DONE and "recorded, not done yet". The
   * card never leaves the note — only its check state flips. */
  toggleDone: (key: string) => void;
  /**
   * Remove a physical line from the note (delete an entry). `label` is the
   * entry's name, purely so the undo can say WHAT it would bring back.
   */
  deleteNoteLine: (line: number, label?: string | null) => void;
  /**
   * THE LAST DELETED LINE, for as long as it is still offered back.
   *
   * Until 11 September 2026 a delete was the one edit in Recore with nothing
   * behind it: `deleteNoteLine` spliced `raw_text`, which IS the record, and
   * the app's whole answer was a confirmation dialog that said so out loud.
   * Two places in `note-surface.tsx` had already written "on a line with no
   * undo behind it" into their comments as the reason they had to be made
   * scarier. This is that undo.
   *
   * It holds the line's TEXT, not its reading — the reading is a projection
   * that rebuilds itself, so putting the words back puts the entry, its sets,
   * its effort token and its check state back with them.
   *
   * `day` is what stops it being a footgun: an undo offered for yesterday's
   * line must never splice into today's note, and the pill outlives a swipe
   * unless something says otherwise. `id` rises on every delete so the pill can
   * tell "a second delete" from "the same one re-rendered" and restart its
   * window.
   */
  lastDelete: { line: number; text: string; label: string | null; day: DayKey; id: number } | null;
  /** Put the deleted line back where it was. A no-op with nothing to restore. */
  undoDelete: () => void;
  /** Withdraw the offer — the window closed, or the athlete moved on. */
  clearUndo: () => void;
  /** Rewrite one line's words from the correction sheet — see the action. */
  replaceNoteLine: (line: number, text: string) => void;
  /**
   * Mark how hard one physical line was, as an RPE token in the user's own
   * words (`src/lib/effort.ts`). Null clears it. It goes through `setNote`
   * like any keystroke, so the parser reads it and the engine gets the RIR
   * through the ONE path it already has — no overlay, nothing to re-apply.
   */
  setLineEffort: (line: number, effort: Effort | null) => void;
  /**
   * The per-entry note sheet (owner, 4 Aug): opened from the card's ⋯ sheet,
   * it carries that entry's effort and the athlete's own words about it. Two
   * different writes — see `saveEntryNote`.
   */
  openEntryNote: (target: { exercise: string; setText: string; line: number }) => void;
  closeEntryNote: () => void;
  /** Store (or clear) the note on one entry of the open session. */
  saveEntryNote: (exercise: string, text: string | null) => void;
  /**
   * The post-finish CHECK-IN sheet — the reflection (§8.1) and the effort
   * scale on one surface. Also reachable later, from the receipt.
   */
  checkInOpen: boolean;
  openCheckIn: () => void;
  /**
   * The ROUTE reports its own presence, and is the ONLY writer of
   * `checkInOpen` — see `app/check-in.tsx`. Two writers for one flag is how it
   * ends up stuck true and `bottom-toolbar` silently stops asking for ratings.
   */
  setCheckInOnScreen: (on: boolean) => void;
  /** Enter / leave inline edit of a committed line (tap a card → Edit). */
  startEditLine: (line: number) => void;
  stopEditLine: () => void;
  openFixSheet: (line: number) => void;
  closeFixSheet: () => void;
  /** `remember` teaches the parser the athlete's phrase; only ever meaningful
   * when the EXERCISE changed, and the sheet defaults it on. */
  submitFix: (exercise: string, sets: ParsedSet[], remember?: boolean) => void;
  /** Drop the open fix target's READING (its parsed sets) while leaving the
   * written line untouched — see the action for why that is one and the same
   * correction path. */
  removeReading: () => void;
  /** Mark this session done: the pill stops reporting a live set and the
   * reflection row appears. Writing another line re-opens it. */
  finishSession: () => void;
}

const PARSE_DEBOUNCE_MS = 900;
let parseTimer: ReturnType<typeof setTimeout> | null = null;

/** Rises on every delete, so `lastDelete` is a NEW offer even when the second
 * delete happens to name the same line and the same words as the first. */
let undoToken = 0;

// A transient parse failure (offline blip, server rate limit) retries with
// backoff while the user is still looking at the workout — a silent failure
// that never retries reads as "the AI didn't understand me". After the last
// attempt the sync loop + foreground listener remain the safety net.
const PARSE_RETRY_DELAYS_MS = [3_000, 8_000, 20_000];
let parseRetryTimer: ReturnType<typeof setTimeout> | null = null;
let parseRetryAttempt = 0;

function clearParseRetry() {
  if (parseRetryTimer) clearTimeout(parseRetryTimer);
  parseRetryTimer = null;
  parseRetryAttempt = 0;
}

// --- receipt-mode detection (CLAUDE.md §9) -----------------------------------
// A "dump" = the note went from empty to ≥4 parsed exercises inside a minute:
// someone typing their whole training at the end. Incremental logging during
// a session never trips this. Accepting a ghost is explicitly NOT a dump.
const RECEIPT_MIN_EXERCISES = 4;
const RECEIPT_DUMP_WINDOW_MS = 60_000;
const receiptModeKey = (workoutId: string) => `receipt_mode:${workoutId}`;
let dumpStartedAt: number | null = null;

/** Finish, remembered per workout — the same sticky-meta shape receipt mode
 * uses, so a session that was settled yesterday re-opens settled today. */
const sessionDoneKey = (workoutId: string) => `session_done:${workoutId}`;

/** The receipt's one AI line: the freshly cached next-session reason. Only on
 * today — a past day's receipt must not carry tomorrow's justification. */
function reasonForReceipt(userId: string, day: DayKey): string | null {
  if (day !== todayKey()) return null;
  return getPredictionForOpen(userId, shiftDayKey(todayKey(), 1))?.reason ?? null;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The day DATED, always — "Sep 6", and carrying the year when it is not this
 * one. The half of `labelForDay` that a relative word replaces. */
function datedDay(day: DayKey): string {
  const [y, m, d] = day.split('-').map(Number);
  const monthName = MONTHS_SHORT[(m ?? 1) - 1];
  const yearSuffix = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${monthName} ${d}${yearSuffix}`;
}

/** A day named the way a person names it: Today, Yesterday, or a quiet short
 * date. Used wherever a day is a label — history rows, sheet titles, prose
 * (`lib/day-phrase.ts` handles the grammar of dropping it into a sentence). */
export function labelForDay(day: DayKey): string {
  const today = todayKey();
  if (day === today) return 'Today';
  if (day === shiftDayKey(today, -1)) return 'Yesterday';
  return datedDay(day);
}

/**
 * THE DAY PILL SAYS BOTH (owner, 6 September 2026): "Today · Sep 6".
 *
 * The pill is the only place in the app where the open day is named as a
 * PLACE rather than mentioned in a sentence — it is what the calendar opens
 * from, and what tells you where you landed after swiping days. "Today" alone
 * is the one thing a person never needs told, and a bare "Sep 4" two swipes
 * back leaves them counting; the pill has room for both, so it carries both
 * and nothing is lost either way.
 *
 * Every other surface keeps `labelForDay`: "last Today · Sep 6" on Progress
 * and a sheet titled "Yesterday · Sep 5" would be the same fact printed twice
 * beside itself.
 */
export function dayPillLabel(day: DayKey): string {
  const label = labelForDay(day);
  const dated = datedDay(day);
  return label === dated ? dated : `${label} · ${dated}`;
}

/** Load a day's note + cached parse state straight from SQLite (synchronous). */
function loadDay(userId: string, day: DayKey) {
  const workout = getWorkoutForDay(userId, day);
  let signals: LineSignal[] = [];
  let snapshot: string | null = null;
  let volume = 0;
  let lineExercises: Record<number, string> = {};
  let receipt: ReceiptData | null = null;

  if (workout) {
    /**
     * REBUILD THE READING BEFORE READING IT, if this day has none.
     *
     * `parse_cache` is a LOCAL table and `items`/`sets` are not — they sync. So
     * a day pulled down from the server arrives with its whole structure and no
     * cache, and this function, which reads nothing but the cache, used to
     * render it as raw unparsed lines. On a real account that was 65 days out
     * of 66 (`parse/rehydrate.ts` has the measurement).
     *
     * The rebuild is local, synchronous and refuses to guess: it only runs when
     * the note is unchanged since the structure was written, and only when the
     * line mapping is forced rather than inferred. When it declines, the day
     * falls through exactly as before and the warm pass queues it for a real
     * parse. Nothing here can block or slow a day that already has its cache —
     * the first thing the rebuild does is notice one.
     */
    hydrateFromStructure(userId, workout.id);

    const cache = getParseCache(workout.id);
    if (cache) {
      try {
        signals = JSON.parse(cache.signals_json) as LineSignal[];
        snapshot = cache.raw_snapshot;
        const result = validateParseResult(JSON.parse(cache.result_json));
        // Totals + comparisons exclude anything the user marked NOT DONE.
        receipt = result ? buildReceipt(result, signals, loadUndoneKeys(workout.id)) : null;
        volume = receipt ? receipt.volume : 0;
        if (result) {
          for (const item of result.items) {
            if (lineExercises[item.line] === undefined) lineExercises[item.line] = item.exercise;
          }
        }
      } catch {
        signals = [];
        snapshot = null;
        lineExercises = {};
        receipt = null;
      }
    }
  }

  const receiptMode = workout ? getMeta(receiptModeKey(workout.id)) === '1' : false;
  const sessionFinished = workout ? getMeta(sessionDoneKey(workout.id)) === '1' : false;
  // `updated_at` is written on every keystroke (saveRawText), so it is the
  // honest answer to "when was this session last touched" without inventing a
  // per-set timestamp the record doesn't have.
  const touchedAt = workout ? Date.parse(workout.updated_at) : NaN;

  return {
    note: workout?.raw_text ?? '',
    workoutId: workout?.id ?? null,
    sessionFinished,
    lastActivityAt: Number.isFinite(touchedAt) ? touchedAt : null,
    undone: loadUndoneMap(workout?.id ?? null),
    entryNotes: getEntryNotes(workout?.id ?? null),
    signals,
    parsedSnapshot: snapshot,
    parsedVolume: volume,
    lineExercises,
    receiptMode,
    receipt,
    // The one AI line under the ledger — today only, silence otherwise.
    receiptReason: receipt ? reasonForReceipt(userId, day) : null,
  };
}

/**
 * One shape for every checklist action (§E): run the pure edit, persist the
 * session, and put the text it produced through `setNote`.
 *
 * The order matters. The session is stored BEFORE the note is written, so that
 * when `setNote` reconciles the checklist against the new text it recognises
 * the line as the checklist's own and does not read it as the athlete taking
 * the movement over.
 */
function applyPlannedEdit(
  get: () => SessionState,
  set: (partial: Partial<SessionState>) => void,
  edit: (session: PlannedSession, note: string) => { session: PlannedSession; note: string },
): void {
  const { plannedSession, note, selectedDay } = get();
  if (!plannedSession) return;

  const next = edit(plannedSession, note);
  if (next.session === plannedSession && next.note === note) return;

  savePlannedSession(selectedDay, next.session);
  set({ plannedSession: next.session });
  if (next.note !== note) get().setNote(next.note);
}

export const useSession = create<SessionState>((set, get) => ({
  userId: null,
  selectedDay: todayKey(),
  note: '',
  workoutId: null,
  undone: {},
  entryNotes: {},
  noteTarget: null,
  signals: [],
  parsedSnapshot: null,
  parsedVolume: 0,
  parsing: false,
  lineExercises: {},
  receiptMode: false,
  receipt: null,
  receiptReason: null,
  sheetExercise: null,
  sheetSession: null,
  sheetLine: null,
  editingLine: null,
  fixTarget: null,
  fixRevision: 0,
  streak: 0,
  sessionCount: 0,
  lastActivityAt: null,
  sessionFinished: false,
  ghost: null,
  ghostDismissed: false,
  planStrip: null,
  plannedSession: null,
  lastDelete: null,

  hydrate: (userId) => {
    dumpStartedAt = null;
    const today = todayKey();
    /**
     * THE RECENT DAYS ARE READY BEFORE THEY ARE ASKED FOR (10 Sep 2026).
     *
     * `loadDay` can rebuild a day on demand, but it runs on the day-swipe path,
     * where a few tens of milliseconds is a dropped frame. Doing the last two
     * weeks here means the swipe reads a cache that is already sitting there.
     *
     * It also queues the days that CANNOT be rebuilt because they have no
     * structure at all — those have never been parsed anywhere, and before this
     * nothing ever asked for them: `pullRemote` writes `needs_parse = 0` and
     * `runParse` is only ever reached by typing. They stayed unreadable for
     * ever, which is the other half of the same bug.
     */
    // Guarded at the call site as well as inside: `hydrate` is the app's first
    // action after sign-in, and nothing in a repair path may stand between a
    // person and their record.
    try {
      warmRecentReadings(userId);
    } catch {
      // Every day falls back to the parser, which is where they were anyway.
    }
    const prediction = getPredictionForOpen(userId, today);
    set({
      userId,
      selectedDay: today,
      ...loadDay(userId, today),
      streak: computeStreak(userId, today),
      sessionCount: countSessions(userId),
      ghost: prediction
        ? { id: prediction.id, ghostText: prediction.ghost_text, reason: prediction.reason }
        : null,
      ghostDismissed: false,
      planStrip: computePlanStrip(userId, today),
      plannedSession: loadPlannedSession(today),
      lastDelete: null,
    });
  },

  reset: () => {
    if (parseTimer) clearTimeout(parseTimer);
    clearParseRetry();
    dumpStartedAt = null;
    set({
      userId: null,
      selectedDay: todayKey(),
      note: '',
      workoutId: null,
      undone: {},
      entryNotes: {},
      noteTarget: null,
      signals: [],
      parsedSnapshot: null,
      parsedVolume: 0,
      parsing: false,
      lineExercises: {},
      receiptMode: false,
      receipt: null,
      receiptReason: null,
      sheetExercise: null,
      sheetSession: null,
      sheetLine: null,
      editingLine: null,
      fixTarget: null,
      streak: 0,
      sessionCount: 0,
      lastActivityAt: null,
      sessionFinished: false,
      ghost: null,
      ghostDismissed: false,
      planStrip: null,
      plannedSession: null,
      lastDelete: null,
    });
  },

  selectDay: (day) => {
    const { userId, selectedDay } = get();
    if (!userId || day === selectedDay) return;
    if (parseTimer) clearTimeout(parseTimer);
    clearParseRetry();
    dumpStartedAt = null;
    set({
      selectedDay: day,
      ...loadDay(userId, day),
      // A note sheet belongs to the entry it was opened from; another day's
      // ledger is not that entry.
      noteTarget: null,
      planStrip: computePlanStrip(userId, day),
      plannedSession: loadPlannedSession(day),
      // The undo travels with the day it belongs to. `undoDelete` would refuse
      // to splice across the boundary anyway; withdrawing the offer here is so
      // the pill never stands on a day where tapping it does nothing.
      lastDelete: null,
    });
  },

  setNote: (text) => {
    const { userId, selectedDay, note: prevNote } = get();
    if (!userId) return;

    // Receipt-mode detection: remember when an EMPTY note first got content.
    if (prevNote.length === 0 && text.trim().length > 0) dumpStartedAt = Date.now();
    else if (text.trim().length === 0) dumpStartedAt = null;

    // 1. Optimistic local-first write: raw_text hits SQLite in this tick.
    const workoutId = saveRawText(userId, selectedDay, text);
    set({
      note: text,
      workoutId,
      streak: computeStreak(userId, todayKey()),
      sessionCount: countSessions(userId),
      // Writing IS the session being live again: the athlete logging another
      // set after Finish has not finished, whatever they pressed earlier.
      lastActivityAt: Date.now(),
      sessionFinished: false,
    });
    if (prevNote !== text) setMeta(sessionDoneKey(workoutId), null);

    // §E.4 — the written line always wins. Any movement the athlete has written
    // themselves is released by the checklist, which from then on tracks its
    // rows without touching its text. Cheap: a scan of the note's lines.
    const planned = get().plannedSession;
    if (planned) {
      const settled = settleFromNote(planned, text);
      if (settled !== planned) {
        savePlannedSession(selectedDay, settled);
        set({ plannedSession: settled });
      }
    }

    // 2. Fire the background parse after the typing pause; push in background.
    // A fresh keystroke supersedes any failure-retry chain in flight.
    if (parseTimer) clearTimeout(parseTimer);
    clearParseRetry();
    parseTimer = setTimeout(() => void runParse(workoutId), PARSE_DEBOUNCE_MS);
    scheduleSync();
  },

  startFromGhost: () => {
    const { ghost } = get();
    if (!ghost) return;
    markPredictionAccepted(ghost.id); // adherence: the ghost earned a Start
    get().setNote(ghost.ghostText);
    // Accepting a ghost fills the note in one shot but the session is only
    // STARTING — that's live-logging territory, not an end-of-training dump.
    dumpStartedAt = null;
    set({ ghostDismissed: true });
    // Parse the accepted prescription right away — no need to wait for typing.
    const workoutId = get().workoutId;
    if (workoutId) {
      if (parseTimer) clearTimeout(parseTimer);
      void runParse(workoutId);
    }
  },

  /** Tap the circle on a planned line: the prescription becomes real typed
   * text in the note (raw_text stays the source of truth), the parse confirms
   * it, and the checklist row turns into a volt check. First check = the
   * ghost earned an accept (adherence, §7.2 Gap 3). */
  checkGhostLine: (lineText) => {
    const { ghost, note } = get();
    if (!ghost) return;
    // Idempotent: a line already in the note never appends twice (covers the
    // fast double-tap and plan rows whose name can't be extracted).
    if (note.split('\n').some((l) => l.trim() === lineText.trim())) return;
    markPredictionAccepted(ghost.id);
    const base = note.replace(/\s+$/, '');
    get().setNote(base.length > 0 ? `${base}\n${lineText}` : lineText);
    // Checking off the plan is live-logging, never an end-of-training dump.
    dumpStartedAt = null;
  },

  dismissGhost: () => set({ ghostDismissed: true }),

  choosePlanDay: (planDayId) => {
    const { userId, selectedDay } = get();
    if (!userId || selectedDay !== todayKey()) return;
    setPlanDayChoice(userId, selectedDay, planDayId);
    set({ planStrip: computePlanStrip(userId, selectedDay) });
  },

  // --- the prefilled checklist (§D.3, §E) ------------------------------------
  // Every one of these does the same two things: move rows in the pure state
  // machine (`lib/planned-session.ts`), then push whatever text that implies
  // through `setNote`. The note is written by the ONE path that has always
  // written it, so a tapped set and a typed set are the same kind of fact.

  startPlannedSession: (option) => {
    const { userId, selectedDay } = get();
    if (!userId) return;
    // Choosing a split day answers the session-start question too — one answer,
    // so the strip, the calendar and the Next brief cannot disagree with the
    // checklist about what today is.
    if (option.kind === 'type') get().choosePlanDay(option.id);

    const session = plannedSessionFor(userId, option, selectedDay);
    savePlannedSession(selectedDay, session);
    set({ plannedSession: session });
  },

  startFromNext: (session, predictionId) => {
    const { userId, selectedDay } = get();
    if (!userId || session.sets.length === 0) return;
    if (predictionId) markPredictionAccepted(predictionId);
    savePlannedSession(selectedDay, session);
    set({ plannedSession: session });
  },

  clearPlannedSession: () => {
    const { selectedDay } = get();
    savePlannedSession(selectedDay, null);
    set({ plannedSession: null });
  },

  logPlannedSet: (id) => {
    applyPlannedEdit(get, set, (session, note) => logPlannedSetIn(session, note, id));
  },

  unlogPlannedSet: (id) => {
    applyPlannedEdit(get, set, (session, note) => unlogPlannedSetIn(session, note, id));
  },

  editPlannedSet: (id, values) => {
    applyPlannedEdit(get, set, (session, note) => editPlannedSetIn(session, note, id, values));
  },

  openExerciseSheet: (canonical, line = null) => set({ sheetExercise: canonical, sheetLine: line }),
  closeExerciseSheet: () => set({ sheetExercise: null, sheetLine: null }),

  openSessionSheet: (workoutId) => set({ sheetSession: workoutId }),
  closeSessionSheet: () => set({ sheetSession: null }),

  toggleDone: (key) => {
    const { undone, workoutId, userId, selectedDay } = get();
    const next = { ...undone };
    if (next[key]) delete next[key];
    else next[key] = true;

    if (!workoutId || !userId) {
      set({ undone: next });
      return;
    }
    // Persist the checklist, re-project the structure (un-checked → 'skipped'
    // sets, no signal) so the pill, this-week, /stats and PRs all agree, then
    // re-read the day so the receipt/gutter reflect it immediately.
    saveUndone(workoutId, Object.keys(next));
    reapplyDoneState(userId, workoutId);
    set({ ...loadDay(userId, selectedDay) });
    scheduleSync();
  },

  deleteNoteLine: (line, label = null) => {
    const { note, selectedDay } = get();
    const cut = removeLine(note, line);
    if (!cut) return;
    set({
      editingLine: null,
      sheetExercise: null,
      sheetLine: null,
      // Remembered BEFORE the write, so the offer is already standing by the
      // time the record re-renders without the entry in it.
      lastDelete: { line: cut.line, text: cut.text, label, day: selectedDay, id: ++undoToken },
    });
    get().setNote(cut.note);
  },

  /**
   * PUT IT BACK — through `setNote`, like a keystroke, because that is the only
   * path into the record (§3).
   *
   * Nothing here re-applies a parse, a check state or an effort token: the
   * restored TEXT is read again by the debounced parse `setNote` fires, and the
   * reading it produces is the reading the line had. That is the same reason
   * "Edit my words instead" needs no separate re-parse path.
   *
   * It REFUSES ACROSS A DAY BOUNDARY rather than clamping like `restoreLine`
   * does, because the two failures are not the same size: restoring at the
   * wrong index costs a position inside a session the athlete is looking at,
   * while restoring into the wrong DAY writes a lift into a session that never
   * happened — a fabricated record, which §3 does not allow at any price.
   */
  undoDelete: () => {
    const { lastDelete, note, selectedDay } = get();
    if (!lastDelete) return;
    set({ lastDelete: null });
    if (lastDelete.day !== selectedDay) return;
    get().setNote(restoreLine(note, lastDelete.line, lastDelete.text));
  },

  clearUndo: () => {
    if (get().lastDelete) set({ lastDelete: null });
  },

  /**
   * Replace one physical line's TEXT — "Edit my words instead", inside the
   * correction sheet.
   *
   * This is the one repair that touches `raw_text`, and it is allowed to
   * because it is the athlete rewriting their own words: the new text becomes
   * the record, exactly as if they had typed it (§3). It goes out through
   * `setNote` like any keystroke, so SQLite is written in the same tick and the
   * debounced parse re-reads the line — no separate re-parse path, no way for
   * the reading and the words to be updated by different code.
   *
   * A blank replacement is refused rather than silently emptying the line: the
   * way to remove an entry is Delete, which says so.
   */
  replaceNoteLine: (line, text) => {
    const { note } = get();
    const lines = note.split('\n');
    if (line < 0 || line >= lines.length) return;
    const next = text.replace(/\n+/g, ' ').trim();
    if (!next || next === lines[line]) return;
    lines[line] = next;
    set({ fixTarget: null });
    get().setNote(lines.join('\n'));
  },

  setLineEffort: (line, effort) => {
    const { note } = get();
    const lines = note.split('\n');
    if (line < 0 || line >= lines.length) return;
    const next = setEffortOnLine(lines[line]!, effort);
    if (next === lines[line]) return;
    lines[line] = next;
    // Straight through setNote: SQLite in the same tick, then the debounced
    // parse reads the marker like any other word the user typed.
    get().setNote(lines.join('\n'));
  },

  openEntryNote: (target) => set({ noteTarget: target }),
  closeEntryNote: () => set({ noteTarget: null }),

  /**
   * Store one entry's note. It goes to its OWN column on the workout, never
   * into `raw_text`: the parser must never see prose, and a re-parse must never
   * be able to rewrite or drop words the athlete wrote (`lib/entry-note.ts`).
   *
   * Clearing is a real answer — an emptied field leaves no note behind — so the
   * §13 counter is bumped only when a note appears where there was none.
   */
  saveEntryNote: (exercise, text) => {
    const { workoutId, entryNotes } = get();
    if (!workoutId) return;
    const had = readEntryNote(entryNotes, exercise) !== null;
    const next = setEntryNote(workoutId, exercise, text);
    const has = readEntryNote(next, exercise) !== null;
    if (has && !had) markEntryNoteAdded();
    set({ entryNotes: next });
    scheduleSync();
  },

  checkInOpen: false,
  /**
   * The check-in is a native form sheet on the root stack (`app/check-in.tsx`),
   * so opening it is a NAVIGATION, not a flag flip. It deliberately does not
   * touch `checkInOpen`: the route sets that on mount and clears it on unmount,
   * which is the only way a swipe-dismiss can leave it honest.
   *
   * ONE CALLER RULE. The sheet is presented by the root navigator, so pushing
   * it while an RN `Modal` (any `bottom-sheet.tsx` sheet) is still on screen
   * would render it BEHIND that modal — invisible, exactly like UIKit refusing
   * a second modal. Every live caller today is a control on the page, which by
   * construction cannot be tapped while a modal covers it. A caller inside a
   * sheet must close its host first and push from `onClosed`.
   */
  openCheckIn: () => router.push('/check-in'),
  setCheckInOnScreen: (on) => set({ checkInOpen: on }),

  startEditLine: (line) => set({ editingLine: line, sheetExercise: null, sheetLine: null }),
  stopEditLine: () => set({ editingLine: null }),

  // --- parse correction (CLAUDE.md §6.2) --------------------------------------

  openFixSheet: (line) => {
    const { workoutId } = get();
    if (!workoutId) return;
    const target = getFixTarget(workoutId, line);
    if (target) set({ fixTarget: target });
  },

  closeFixSheet: () => set({ fixTarget: null }),

  /** Persist the user's fix, then re-read the day from the (rebuilt) cache so
   * the gutter reflects the corrected structure immediately. `fixRevision`
   * lets read-side caches (the last-time hint) drop stale resolutions. */
  submitFix: (exercise, sets, remember = true) => {
    const { userId, selectedDay, fixTarget } = get();
    if (!userId || !fixTarget) return;

    const changed = applyCorrection(userId, fixTarget, { exercise, sets, remember });
    set({
      fixTarget: null,
      ...(changed ? { ...loadDay(userId, selectedDay), fixRevision: get().fixRevision + 1 } : {}),
    });
    if (changed) scheduleSync();
  },

  /**
   * Remove a READING the parser should never have made — the line that says
   * "felt strong today, 10/10" and came back as an exercise called Felt.
   *
   * It is the ordinary correction with an empty set list, deliberately, because
   * that is what makes it safe: `raw_text` is not touched (§3 — the words are
   * the record), the correction row re-applies on every future re-parse so the
   * ghost reading cannot come back, and every count that reads the projection
   * simply stops seeing it. `validateParseResult` drops a set-less item when
   * the cache is read back, and `buildReceipt` skips it either way, so the card
   * gives way to the quiet "kept as a note · not counted" block the line
   * deserved in the first place.
   */
  removeReading: () => {
    const { fixTarget } = get();
    if (!fixTarget) return;
    get().submitFix(fixTarget.item.exercise, []);
  },

  finishSession: () => {
    const { workoutId } = get();
    if (!workoutId) return;
    setMeta(sessionDoneKey(workoutId), '1');
    set({ sessionFinished: true });
  },
}));

/** Surface a landed parse on the open screen — shared by the foreground
 * debounce path and the sync loop's retry path (via setParseListener), so a
 * parse that lands EITHER way reaches the gutter/receipt immediately. */
function applyParseOutcome(userId: string, outcome: ParseOutcome) {
  // Only surface signals if the user is still looking at this workout.
  const state = useSession.getState();
  if (state.workoutId !== outcome.workoutId) return;

  // Receipt-mode detection (CLAUDE.md §9): this parse turned a just-empty
  // note into a full session → it's an end-of-training dump. Sticky per
  // workout via the meta KV, so the day re-opens in receipt mode too.
  let receiptMode = state.receiptMode;
  if (!receiptMode && outcome.receipt) {
    const distinctExercises = new Set(Object.values(outcome.lineExercises)).size;
    if (
      distinctExercises >= RECEIPT_MIN_EXERCISES &&
      dumpStartedAt !== null &&
      Date.now() - dumpStartedAt <= RECEIPT_DUMP_WINDOW_MS
    ) {
      receiptMode = true;
      setMeta(receiptModeKey(outcome.workoutId), '1');
    }
  }

  useSession.setState({
    signals: outcome.signals,
    parsedSnapshot: outcome.rawSnapshot,
    parsedVolume: outcome.volume,
    lineExercises: outcome.lineExercises,
    receiptMode,
    receipt: outcome.receipt,
    receiptReason: outcome.receipt ? reasonForReceipt(userId, state.selectedDay) : null,
    planStrip: computePlanStrip(userId, state.selectedDay),
  });
}

/** Background parse → applies items/sets → signals fade into the gutter.
 * Transient failures retry with backoff (the dots stay on while a retry is
 * queued — the machine is honestly still working); the sync loop remains the
 * long-tail safety net. */
async function runParse(workoutId: string) {
  const { userId } = useSession.getState();
  if (!userId) return;

  if (useSession.getState().workoutId === workoutId) {
    useSession.setState({ parsing: true });
  }

  let outcome: ParseOutcome | null = null;
  try {
    outcome = await parseWorkout(userId, workoutId);
    if (outcome) {
      clearParseRetry();
      applyParseOutcome(userId, outcome);
      scheduleSync();
    } else if (
      useSession.getState().workoutId === workoutId &&
      parseRetryAttempt < PARSE_RETRY_DELAYS_MS.length
    ) {
      const delay = PARSE_RETRY_DELAYS_MS[parseRetryAttempt]!;
      parseRetryAttempt += 1;
      if (parseRetryTimer) clearTimeout(parseRetryTimer);
      parseRetryTimer = setTimeout(() => {
        parseRetryTimer = null;
        void runParse(workoutId);
      }, delay);
    }
  } finally {
    if (useSession.getState().workoutId === workoutId) {
      // Dots stay on while a retry is pending; off on success or final failure.
      useSession.setState({ parsing: outcome === null && parseRetryTimer !== null });
    }
  }
}

// A parse that lands via the sync loop (offline recovery, app-foreground
// re-sync) must reach the open screen too — without this the data updates in
// SQLite while the gutter and receipt stay stale until an app restart.
setParseListener((outcome) => {
  const { userId } = useSession.getState();
  if (!userId) return;
  applyParseOutcome(userId, outcome);
});

/** The note text for the currently-selected day. */
export const useCurrentNote = () => useSession((s) => s.note);

/**
 * Has this day produced a READING yet?
 *
 * The empty-canvas test (owner, 12 Aug 2026). Today's furniture — the weekly
 * line, the session-start card, the resting pill — is hidden until there is
 * something for it to describe, and all three ask here so they can never
 * disagree about whether the page is blank. A note with words but no parsed
 * exercise ("felt rough today") is deliberately NOT an entry: there is no
 * reading to total, and "0 sets · 0 kg" under it would be the app reporting on
 * something it did not understand.
 */
export const useHasEntries = () =>
  useSession((s) => s.note.trim().length > 0 && (s.receipt?.rows.length ?? 0) > 0);

/**
 * The planned-session checklist shows on today whenever a cached prediction
 * exists and wasn't dismissed (CLAUDE.md §8). It SURVIVES typing — grey rows
 * check off as the note fills, Strong-style — but never appears over a
 * receipt-mode dump. If the AI has nothing useful, it says nothing.
 */
export const useGhostVisible = () =>
  useSession(
    (s) =>
      s.selectedDay === todayKey() &&
      !s.ghostDismissed &&
      !s.receiptMode &&
      s.ghost !== null,
  );

/**
 * The plan-in-view strip shows today's declared day as a read-only reference
 * (pre-plan, Surface 1). Hidden during a receipt-mode dump, like the ghost;
 * `planStrip` is already null on any day but today.
 */
export const usePlanStrip = () => useSession((s) => (s.receiptMode ? null : s.planStrip));
