import { create } from 'zustand';

import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { loadUndoneKeys, loadUndoneMap, saveUndone } from '@/lib/db/done-state';
import { getMeta, setMeta } from '@/lib/db/index';
import { computeWeekStreak, getWorkoutForDay, saveRawText } from '@/lib/db/workouts';
import { getPredictionForOpen, markPredictionAccepted } from '@/lib/db/predictions';
import { getParseCache, reapplyDoneState } from '@/lib/parse/apply';
import { parseWorkout, type ParseOutcome } from '@/lib/parse/client';
import { applyCorrection, getFixTarget, type FixTarget } from '@/lib/parse/correct';
import { buildSessionTotals, type SessionTotals } from '@/lib/parse/session';
import {
  validateParseResult,
  type LineSignal,
  type ParsedItem,
  type ParsedSet,
} from '@/lib/parse/types';
import { getWeeklyTarget } from '@/lib/prefs';
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
  receipt: SessionTotals | null;
  /** The parsed items behind the cards — §8.3 renders per set, not per line. */
  parsedItems: ParsedItem[];
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
  /** The parsed line being corrected (long-press on a gutter value), or null. */
  fixTarget: FixTarget | null;
  /** Bumped after every landed correction — read-side caches key on it. */
  fixRevision: number;
  streak: number;
  ghost: GhostData | null;
  ghostDismissed: boolean;

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
  /** Remove a physical line from the note (delete an entry). */
  deleteNoteLine: (line: number) => void;
  /** Enter / leave inline edit of a committed line (tap a card → Edit). */
  startEditLine: (line: number) => void;
  stopEditLine: () => void;
  openFixSheet: (line: number) => void;
  closeFixSheet: () => void;
  submitFix: (exercise: string, sets: ParsedSet[]) => void;
}

const PARSE_DEBOUNCE_MS = 900;
let parseTimer: ReturnType<typeof setTimeout> | null = null;

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

/** The receipt's one AI line: the freshly cached next-session reason. Only on
 * today — a past day's receipt must not carry tomorrow's justification. */
function reasonForReceipt(userId: string, day: DayKey): string | null {
  if (day !== todayKey()) return null;
  return getPredictionForOpen(userId, shiftDayKey(todayKey(), 1))?.reason ?? null;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date pill's label: Today, Yesterday, or a quiet short date. */
export function labelForDay(day: DayKey): string {
  const today = todayKey();
  if (day === today) return 'Today';
  if (day === shiftDayKey(today, -1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  const monthName = MONTHS_SHORT[(m ?? 1) - 1];
  const yearSuffix = y === new Date().getFullYear() ? '' : ` ${y}`;
  return `${monthName} ${d}${yearSuffix}`;
}

/** Load a day's note + cached parse state straight from SQLite (synchronous). */
function loadDay(userId: string, day: DayKey) {
  const workout = getWorkoutForDay(userId, day);
  let signals: LineSignal[] = [];
  let snapshot: string | null = null;
  let volume = 0;
  let lineExercises: Record<number, string> = {};
  let receipt: SessionTotals | null = null;
  let items: ParsedItem[] = [];

  if (workout) {
    const cache = getParseCache(workout.id);
    if (cache) {
      try {
        signals = JSON.parse(cache.signals_json) as LineSignal[];
        snapshot = cache.raw_snapshot;
        const result = validateParseResult(JSON.parse(cache.result_json));
        // Totals + comparisons exclude anything the user marked NOT DONE.
        receipt = result ? buildSessionTotals(result, signals, loadUndoneKeys(workout.id)) : null;
        items = result ? result.items : [];
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
        items = [];
      }
    }
  }

  const receiptMode = workout ? getMeta(receiptModeKey(workout.id)) === '1' : false;

  return {
    note: workout?.raw_text ?? '',
    workoutId: workout?.id ?? null,
    undone: loadUndoneMap(workout?.id ?? null),
    signals,
    parsedSnapshot: snapshot,
    parsedVolume: volume,
    lineExercises,
    receiptMode,
    receipt,
    parsedItems: items,
    // The one AI line under the ledger — today only, silence otherwise.
    receiptReason: receipt ? reasonForReceipt(userId, day) : null,
  };
}

export const useSession = create<SessionState>((set, get) => ({
  userId: null,
  selectedDay: todayKey(),
  note: '',
  workoutId: null,
  undone: {},
  signals: [],
  parsedSnapshot: null,
  parsedVolume: 0,
  parsing: false,
  lineExercises: {},
  receiptMode: false,
  receipt: null,
  parsedItems: [],
  receiptReason: null,
  sheetExercise: null,
  sheetSession: null,
  sheetLine: null,
  editingLine: null,
  fixTarget: null,
  fixRevision: 0,
  streak: 0,
  ghost: null,
  ghostDismissed: false,

  hydrate: (userId) => {
    dumpStartedAt = null;
    const today = todayKey();
    const prediction = getPredictionForOpen(userId, today);
    set({
      userId,
      selectedDay: today,
      ...loadDay(userId, today),
      streak: computeWeekStreak(userId, today, getWeeklyTarget()),
      ghost: prediction
        ? { id: prediction.id, ghostText: prediction.ghost_text, reason: prediction.reason }
        : null,
      ghostDismissed: false,
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
      signals: [],
      parsedSnapshot: null,
      parsedVolume: 0,
      parsing: false,
      lineExercises: {},
      receiptMode: false,
      receipt: null,
      parsedItems: [],
      receiptReason: null,
      sheetExercise: null,
      sheetSession: null,
      sheetLine: null,
      editingLine: null,
      fixTarget: null,
      streak: 0,
      ghost: null,
      ghostDismissed: false,
        });
  },

  selectDay: (day) => {
    const { userId, selectedDay } = get();
    if (!userId || day === selectedDay) return;
    if (parseTimer) clearTimeout(parseTimer);
    clearParseRetry();
    dumpStartedAt = null;
    set({ selectedDay: day, ...loadDay(userId, day) });
  },

  setNote: (text) => {
    const { userId, selectedDay, note: prevNote } = get();
    if (!userId) return;

    // Receipt-mode detection: remember when an EMPTY note first got content.
    if (prevNote.length === 0 && text.trim().length > 0) dumpStartedAt = Date.now();
    else if (text.trim().length === 0) dumpStartedAt = null;

    // 1. Optimistic local-first write: raw_text hits SQLite in this tick.
    const workoutId = saveRawText(userId, selectedDay, text);
    set({ note: text, workoutId, streak: computeWeekStreak(userId, todayKey(), getWeeklyTarget()) });

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

  deleteNoteLine: (line) => {
    const { note } = get();
    const lines = note.split('\n');
    if (line < 0 || line >= lines.length) return;
    lines.splice(line, 1);
    set({ editingLine: null, sheetExercise: null, sheetLine: null });
    get().setNote(lines.join('\n'));
  },

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
  submitFix: (exercise, sets) => {
    const { userId, selectedDay, fixTarget } = get();
    if (!userId || !fixTarget) return;

    const changed = applyCorrection(userId, fixTarget, { exercise, sets });
    set({
      fixTarget: null,
      ...(changed ? { ...loadDay(userId, selectedDay), fixRevision: get().fixRevision + 1 } : {}),
    });
    if (changed) scheduleSync();
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
    parsedItems: outcome.items,
    receiptReason: outcome.receipt ? reasonForReceipt(userId, state.selectedDay) : null,
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

