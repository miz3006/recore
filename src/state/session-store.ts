import { create } from 'zustand';

import { shiftDayKey, todayKey, type DayKey } from '@/lib/db/dates';
import { getMeta, setMeta } from '@/lib/db/index';
import { computeStreak, getWorkoutForDay, saveRawText } from '@/lib/db/workouts';
import { getPredictionForOpen, markPredictionAccepted } from '@/lib/db/predictions';
import { getParseCache } from '@/lib/parse/apply';
import { parseWorkout, type ParseOutcome } from '@/lib/parse/client';
import { applyCorrection, getFixTarget, type FixTarget } from '@/lib/parse/correct';
import { parsedVolume } from '@/lib/db/history';
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
  /** The parsed line being corrected (long-press on a gutter value), or null. */
  fixTarget: FixTarget | null;
  streak: number;
  ghost: GhostData | null;
  ghostDismissed: boolean;

  hydrate: (userId: string) => void;
  reset: () => void;
  selectDay: (day: DayKey) => void;
  setNote: (text: string) => void;
  startFromGhost: () => void;
  dismissGhost: () => void;
  openExerciseSheet: (canonical: string) => void;
  closeExerciseSheet: () => void;
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
  let receipt: ReceiptData | null = null;

  if (workout) {
    const cache = getParseCache(workout.id);
    if (cache) {
      try {
        signals = JSON.parse(cache.signals_json) as LineSignal[];
        snapshot = cache.raw_snapshot;
        const result = validateParseResult(JSON.parse(cache.result_json));
        volume = result ? parsedVolume(result) : 0;
        receipt = result ? buildReceipt(result, signals) : null;
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

  return {
    note: workout?.raw_text ?? '',
    workoutId: workout?.id ?? null,
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

export const useSession = create<SessionState>((set, get) => ({
  userId: null,
  selectedDay: todayKey(),
  note: '',
  workoutId: null,
  signals: [],
  parsedSnapshot: null,
  parsedVolume: 0,
  parsing: false,
  lineExercises: {},
  receiptMode: false,
  receipt: null,
  receiptReason: null,
  sheetExercise: null,
  fixTarget: null,
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
      streak: computeStreak(userId, today),
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
      signals: [],
      parsedSnapshot: null,
      parsedVolume: 0,
      parsing: false,
      lineExercises: {},
      receiptMode: false,
      receipt: null,
      receiptReason: null,
      sheetExercise: null,
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
    set({ note: text, workoutId, streak: computeStreak(userId, todayKey()) });

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

  dismissGhost: () => set({ ghostDismissed: true }),

  openExerciseSheet: (canonical) => set({ sheetExercise: canonical }),
  closeExerciseSheet: () => set({ sheetExercise: null }),

  // --- parse correction (CLAUDE.md §6.2) --------------------------------------

  openFixSheet: (line) => {
    const { workoutId } = get();
    if (!workoutId) return;
    const target = getFixTarget(workoutId, line);
    if (target) set({ fixTarget: target });
  },

  closeFixSheet: () => set({ fixTarget: null }),

  /** Persist the user's fix, then re-read the day from the (rebuilt) cache so
   * the gutter reflects the corrected structure immediately. */
  submitFix: (exercise, sets) => {
    const { userId, selectedDay, fixTarget } = get();
    if (!userId || !fixTarget) return;

    const changed = applyCorrection(userId, fixTarget, { exercise, sets });
    set({ fixTarget: null, ...(changed ? loadDay(userId, selectedDay) : {}) });
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
 * Ghost text shows only on a new training day: today, still empty, not yet
 * dismissed, and a cached prediction exists (CLAUDE.md §8). If the AI has
 * nothing useful, it says nothing.
 */
export const useGhostVisible = () =>
  useSession(
    (s) =>
      s.selectedDay === todayKey() &&
      s.note.length === 0 &&
      !s.ghostDismissed &&
      s.ghost !== null,
  );
