import { loadUndoneKeys } from '@/lib/db/done-state';
import { getDb, nowIso } from '@/lib/db/index';
import { clearParseBackoff, recordParseFailure } from '@/lib/db/parse-backoff';
import { getWorkoutById } from '@/lib/db/workouts';
import { isSupabaseConfigured } from '@/lib/env';
import { bumpParsedItems } from '@/lib/funnel';
import { devLog, errorText } from '@/lib/log';
import { settlePredictionOutcome } from '@/lib/predict/adherence';
import { recachePrediction } from '@/lib/predict/cache';
import { supabase } from '@/lib/supabase';

import { reanchorLines } from './anchor';
import { applyParseResult, getParseCache } from './apply';
import { type ParseFailureKind } from './backoff';
import { mergeItems, planParse, type ParsePlan } from './incremental';
import { buildReceipt, type ReceiptData } from './receipt';
import {
  CLIENT_PARSE_VERSION,
  MAX_RAW_TEXT_CHARS,
  validateParseResult,
  type LineSignal,
  type ParseResult,
} from './types';

/**
 * Background parse (CLAUDE.md §6). The raw line is already saved locally when
 * this runs — the user never waits on it. Flow: call the parse-workout edge
 * function (server-side AI, JWT attached automatically by supabase-js) →
 * validate the JSON → map into items/sets → compute gutter signals → cache the
 * prediction for tomorrow. On failure or offline, the workout keeps
 * needs_parse = 1 and the sync loop retries later. Never throws to the UI.
 *
 * "Retries later" is a schedule, not a loop: a failure that the SERVER answered
 * puts a wait on the note (`db/parse-backoff.ts`), doubling out to a day, so a
 * line the parser cannot read costs one model call a day instead of one per app
 * open. Offline and signed-out are free and are not counted.
 *
 * ## IT ASKS ABOUT WHAT CHANGED (11 September 2026 — owner: *"zakaj toliko časa
 * potrebuje?"*)
 *
 * A parse's wall time is its OUTPUT: ~40 tokens a second, so the whole session
 * written back out on every typing pause meant 21 s for a six-exercise note and
 * 1+2+3+4+5+6 exercises of model time to record six. The plan
 * (`parse/incremental.ts`) diffs the note against the reading already cached
 * and sends only the lines that changed — the whole note still travels as
 * CONTEXT, so nothing the parser relies on is hidden from it. Measured: one
 * added line, **4.4 s** against 21.0 s.
 *
 * Three rules hold the splice honest:
 *
 *  1. **The server has to SAY it narrowed.** `partial: true` in the response is
 *     the contract. A deployment that predates `only_lines` ignores the field
 *     and never says it, so the answer is a whole-note reading and is used
 *     whole — the alternative is every kept line printed twice for as long as
 *     the app is ahead of the function.
 *  2. **An empty narrow answer is not trusted.** If nothing comes back for
 *     lines that still have text on them, the note is read again in full. One
 *     extra call beats a silently missing exercise.
 *  3. **A plan with nothing to ask makes no call at all** — deleting a line
 *     changes the reading without adding anything to read.
 */
export interface ParseOutcome {
  workoutId: string;
  signals: LineSignal[];
  volume: number;
  rawSnapshot: string;
  /** line index → canonical exercise name; drives the tap-to-open sheet. */
  lineExercises: Record<number, string>;
  /** Session summary for receipt mode (CLAUDE.md §9). */
  receipt: ReceiptData | null;
}

function lineExercisesOf(result: { items: { line: number; exercise: string }[] }): Record<number, string> {
  const map: Record<number, string> = {};
  for (const item of result.items) {
    if (map[item.line] === undefined) map[item.line] = item.exercise;
  }
  return map;
}

/**
 * ONE PARSE PER WORKOUT AT A TIME (11 September 2026).
 *
 * There was no guard at all, and a parse used to take up to twenty-one seconds.
 * Typing during one started a SECOND full parse of the same note nine hundred
 * milliseconds later, and a third behind that — every one of them a model call,
 * all of them racing to rebuild the same rows, and a long session could spend
 * the server's whole 30-calls-per-ten-minutes window on itself. The 429 that
 * followed was recorded as a failure and put the note into parse backoff, so
 * the punishment for writing quickly was a reading that stopped updating.
 *
 * The rule: while a parse is running, at most ONE more is queued behind it, and
 * every caller that arrives meanwhile is handed that same queued run. They all
 * want the same thing — the newest text read once — and the queued run reads
 * the note when it STARTS, so it always reads the newest text there is. If that
 * text has meanwhile been parsed already, the exact-snapshot cache answers it
 * without a network call.
 *
 * It lives here rather than in the session store because the sync loop
 * (`retryPendingParses`) is a second caller with the same workout and no
 * knowledge of the first.
 */
const inFlight = new Map<string, Promise<ParseOutcome | null>>();
const queued = new Set<string>();

export function parseWorkout(userId: string, workoutId: string): Promise<ParseOutcome | null> {
  const forget = (run: Promise<ParseOutcome | null>) => {
    void run.catch(() => null).then(() => {
      if (inFlight.get(workoutId) === run) inFlight.delete(workoutId);
    });
  };

  const running = inFlight.get(workoutId);
  if (!running) {
    const run = parseWorkoutOnce(userId, workoutId);
    inFlight.set(workoutId, run);
    forget(run);
    return run;
  }

  // Already one queued: it has not started reading yet, so it will read
  // whatever the note says by then. Nothing to add.
  if (queued.has(workoutId)) return inFlight.get(workoutId)!;

  queued.add(workoutId);
  const next = running.catch(() => null).then(() => {
    queued.delete(workoutId);
    return parseWorkoutOnce(userId, workoutId);
  });
  inFlight.set(workoutId, next);
  forget(next);
  return next;
}

/**
 * WHAT A FAILED PARSE WAS ABOUT — or `null` when it was about nothing.
 *
 * Two lines get drawn here, and both of them decide how long the note waits
 * (`parse/backoff.ts` holds the schedules and the reasoning).
 *
 * **Did it cost anything?** supabase-js names the difference: a
 * `FunctionsFetchError` is the request never leaving the phone, which is free
 * and is the ordinary state of a gym. It is not counted, and never was.
 *
 * **Was it about the NOTE?** Everything else used to be, which on 11 September
 * 2026 was shown to be wrong in the most expensive way available: the project's
 * AI key stopped answering, every parse came back 502, and a handful of
 * foregrounds would have put every note the app holds into a day-long wait for
 * an outage that had nothing to do with any of them. So the status is read:
 *
 *  - `429`, `402` — a window or an entitlement. Nothing about the words.
 *  - `5xx`, `401` — the service, or a session it would not take. Same.
 *  - `400`, `422` — the function reading THIS text and refusing it: too long,
 *    too many lines, a refusal. That is about the note and keeps the long wait.
 *
 * Anything unrecognised stays `note`, which is the old behaviour and the one
 * that spends the least money when we are not sure.
 */
function failureKind(error: unknown): ParseFailureKind | null {
  if ((error as { name?: string } | null)?.name === 'FunctionsFetchError') return null;
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (status === 429 || status === 402) return 'throttled';
  if (status === 401 || (typeof status === 'number' && status >= 500)) return 'transient';
  return 'note';
}

async function parseWorkoutOnce(userId: string, workoutId: string): Promise<ParseOutcome | null> {
  const workout = getWorkoutById(workoutId);
  if (!workout || workout.user_id !== userId) return null;

  const rawText = workout.raw_text;
  if (rawText.trim().length === 0) {
    // Cleared note: drop the projection, nothing to parse.
    const db = getDb();
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM items WHERE workout_id = ?', [workoutId]);
      db.runSync('DELETE FROM parse_cache WHERE workout_id = ?', [workoutId]);
      db.runSync(
        `UPDATE workouts SET needs_parse = 0, structure_dirty = 1, dirty = 1, updated_at = ?,
           parse_attempts = 0, parse_next_at = NULL
         WHERE id = ?`,
        [nowIso(), workoutId],
      );
    });
    return { workoutId, signals: [], volume: 0, rawSnapshot: rawText, lineExercises: {}, receipt: null };
  }

  // Already parsed this exact text WITH THE CURRENT PROMPT? Serve the cache (and
  // settle the retry flag so the sync loop stops re-checking this workout). A
  // cache produced by an OLDER PARSE_VERSION is ignored and re-parsed — the
  // cache is keyed on raw_text only, so without this guard a freshly deployed
  // prompt would never reach text the user had already typed.
  const cached = getParseCache(workoutId);
  // Read once: the same cached reading either IS the answer (the text has not
  // moved) or is what the incremental plan splices the new answer onto.
  let cachedResult: ParseResult | null = null;
  if (cached) {
    try {
      const parsed = validateParseResult(JSON.parse(cached.result_json));
      if (parsed && parsed.parse_version >= CLIENT_PARSE_VERSION) cachedResult = parsed;
    } catch {
      // An unusable cache is no cache: fall through to a fresh parse.
    }
  }

  if (cached && cachedResult && cached.raw_snapshot === rawText) {
    try {
      const signals = JSON.parse(cached.signals_json) as LineSignal[];
      getDb().runSync('UPDATE workouts SET needs_parse = 0 WHERE id = ?', [workoutId]);
      clearParseBackoff(workoutId);
      const receipt = buildReceipt(cachedResult, signals, loadUndoneKeys(workoutId));
      return {
        workoutId,
        signals,
        volume: receipt.volume,
        rawSnapshot: rawText,
        lineExercises: lineExercisesOf(cachedResult),
        receipt,
      };
    } catch {
      // fall through to a fresh parse
    }
  }

  if (!isSupabaseConfigured()) return null;

  /**
   * NO SESSION, NO REQUEST.
   *
   * `parse-workout` sits behind `verify_jwt` AND runs its own `getUser()` check
   * (`supabase/config.toml`), so signed out it can only refuse. Asking first
   * costs nothing and keeps the pre-account funnel at zero network — the same
   * rule `demo-parse-remote.ts` already follows for the same function.
   *
   * The workout keeps `needs_parse = 1`, so the first sync pass after sign-in
   * reads it through `retryPendingParses`. Nothing is dropped; the reading
   * simply arrives with the account, which is when it could first have existed.
   */
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    devLog('parse skipped: no session yet — queued until sign-in');
    return null;
  }

  // Client-side input cap mirrors the server's.
  const capped = rawText.slice(0, MAX_RAW_TEXT_CHARS);

  /**
   * What has to be read again. Computed against `capped`, the exact text the
   * server will see, so a plan can never be about characters the request drops.
   */
  const plan: ParsePlan =
    cached && cachedResult
      ? planParse(cached.raw_snapshot.slice(0, MAX_RAW_TEXT_CHARS), cachedResult.items, capped)
      : { mode: 'full', lines: [], keep: [] };

  /**
   * Everything after an answer: pin the items to their real lines, rebuild the
   * projection, settle the retry state, and hand the screen its outcome.
   *
   * `freshCount` is the funnel's denominator (§2.1, PLAN D4) and counts only
   * what the PARSER just produced — a spliced item is the same reading again,
   * and counting it would quietly deflate the repair rate.
   */
  const settle = (result: ParseResult, freshCount: number): ParseOutcome | null => {
    // Pin every item to the line that really contains it — the model's line
    // index is a hint, not a fact.
    reanchorLines(result, capped);

    // Re-read the note: if the user kept typing while the request was in
    // flight, this result belongs to stale text — apply it (structure is still
    // useful) but the gutter equality check hides mismatched lines.
    const fresh = getWorkoutById(workoutId);
    if (!fresh) return null;

    const { signals, volume } = applyParseResult(userId, workoutId, capped, result);
    clearParseBackoff(workoutId);
    if (freshCount > 0) bumpParsedItems(freshCount);

    // Settle what happened to the ghost that was on offer today (§7.2 Gap 3),
    // then compute + cache the NEXT session (CLAUDE.md §7) — reading on open
    // never computes. Both best-effort.
    try {
      settlePredictionOutcome(userId, fresh.performed_at, capped);
    } catch {
      // adherence is telemetry; never let it break the parse flow
    }
    recachePrediction(userId, workoutId);

    return {
      workoutId,
      signals,
      volume,
      rawSnapshot: capped,
      lineExercises: lineExercisesOf(result),
      receipt: buildReceipt(result, signals, loadUndoneKeys(workoutId)),
    };
  };

  // NOTHING TO ASK. A deletion changes the reading without adding a line to
  // read, so the splice is the whole answer and no model runs at all.
  if (plan.mode === 'partial' && plan.lines.length === 0 && cachedResult) {
    return settle({ items: plan.keep, parse_version: cachedResult.parse_version }, 0);
  }

  try {
    /** One request. `narrowed` is the server's own word for "I answered only
     * about the lines you named" — never assumed from what we sent. */
    const invoke = async (
      only: number[] | null,
    ): Promise<{ result: ParseResult; narrowed: boolean } | null> => {
      const { data, error } = await supabase.functions.invoke('parse-workout', {
        body: only ? { raw_text: capped, only_lines: only } : { raw_text: capped },
      });
      if (error || !data) {
        /**
         * THE FUNCTION'S OWN WORDS, INCLUDING THE ONE IT ADDED (11 Sep 2026).
         *
         * `errorText` reads the status off the `FunctionsHttpError` but never
         * the body, and the body is where `parse-workout` now says WHY the
         * model call failed — `provider_rate_limited`, `provider_auth`,
         * `provider_rejected_request`, `provider_unreachable`. Reading it costs
         * one `await` on a response that has already arrived, and it is the
         * difference between "parse failed" and "the provider refused the key".
         * Best-effort by construction: an unreadable body just leaves it out.
         */
        let reason = '';
        try {
          const ctx = (error as { context?: Response } | null)?.context;
          if (ctx && typeof ctx.json === 'function') {
            const body = (await ctx.clone().json()) as { reason?: string };
            if (typeof body?.reason === 'string') reason = ` · ${body.reason}`;
          }
        } catch {
          // an unreadable body is not worth a second failure
        }
        devLog(
          'parse failed, will retry on sync:',
          (error ? errorText(error) : 'empty response') + reason,
        );
        // A REFUSAL COUNTS; BEING UNDERGROUND DOES NOT — and a refusal that is
        // about the SERVICE rather than about this text waits on a different,
        // shorter schedule. `failureKind` above draws both lines.
        const kind = failureKind(error);
        if (kind) recordParseFailure(workoutId, kind);
        return null;
      }

      // Treat the response as untrusted until validated.
      const result = validateParseResult(data);
      if (!result) {
        devLog('parse response failed validation');
        // The costly failure: the model DID run, the answer was unusable, and
        // asking the same question again is the least likely thing to change it.
        recordParseFailure(workoutId);
        return null;
      }
      return { result, narrowed: only !== null && (data as { partial?: boolean }).partial === true };
    };

    const asked = plan.mode === 'partial' ? plan.lines : null;
    let answer = await invoke(asked);
    if (!answer) return null;

    // An empty narrow answer, on lines that still have words on them, is the one
    // shape of this that could LOSE a reading — the model drifting by a line
    // index looks exactly like "there was nothing there". Read the note whole
    // rather than splice a hole into it.
    if (answer.narrowed && answer.result.items.length === 0 && asked) {
      const noteLines = capped.split('\n');
      const someLineHasText = asked.some((l) => (noteLines[l] ?? '').trim().length > 0);
      if (someLineHasText) {
        devLog('narrow parse came back empty on written lines — reading the whole note');
        answer = await invoke(null);
        if (!answer) return null;
      }
    }

    const items =
      answer.narrowed && plan.mode === 'partial'
        ? mergeItems(plan.keep, answer.result.items)
        : answer.result.items;

    return settle({ items, parse_version: answer.result.parse_version }, answer.result.items.length);
  } catch {
    devLog('parse unreachable (offline?), will retry on sync');
    return null;
  }
}
