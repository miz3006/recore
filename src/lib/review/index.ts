import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Linking } from 'react-native';

import { isTrialReminderDue, isTrialWelcomeDue } from '@/lib/billing/state';
import { getCorrectionPatches } from '@/lib/db/corrections';
import { todayKey } from '@/lib/db/dates';
import { getMeta, setMeta } from '@/lib/db/index';
import { getAdherenceRecord, predictorIsProven } from '@/lib/db/insights';
import { computeStreak, getLoggedDayKeys } from '@/lib/db/workouts';
import { devLog } from '@/lib/log';

import { reviewDecision, type ReviewMoment } from './gate';

/**
 * The App Store review prompt (CLAUDE.md §16 — retention is evidence, not
 * gamification; §20 — never a fabricated review).
 *
 * THERE IS NO RECORE UI IN THIS FEATURE, and that is not a shortcut. App Store
 * Review Guideline 1.1.7 disallows a custom rating prompt, so the only legal
 * ask is the system sheet — and a pre-flight "enjoying Recore?" dialog that
 * routes happy people to the store and unhappy people to a feedback form is
 * exactly the kind of thing that gets an app rejected. It would also be the
 * app talking about itself, which §15 has no room for.
 *
 * WHEN it may ask is the whole design, and it lives in `gate.ts` — pure and
 * tested. This file only reads the world and hands the gate its facts.
 *
 * THE ONE CALL SITE IS FINISH SESSION (`bottom-toolbar.tsx`), after the receipt
 * has settled. Never on launch, never on a screen the user did not ask for,
 * never in the middle of writing, and never while a trial sheet is owed.
 *
 * Failure is silence, everywhere. An unavailable module, a missing store URL, a
 * TestFlight build, an over-quota device — none of them is an error the user
 * should ever see, and none of them spends an ask.
 */

const KEYS = {
  askCount: 'review_ask_count',
  lastAskedAt: 'review_last_asked_at',
} as const;

// --- the native sheet ----------------------------------------------------------

/** Only the two calls this module makes — a hand-written surface, so the lazy
 * require below stays honest about how little of the module is used. */
interface StoreReviewModule {
  hasAction: () => Promise<boolean>;
  requestReview: () => Promise<void>;
}

let cached: StoreReviewModule | null | undefined;

/**
 * `expo-store-review` binds its native module with `requireNativeModule`, which
 * THROWS on import when the module is not linked (Expo Go, or a stale dev
 * build). Probing first with the optional variant — the same pattern
 * `voice.ts` uses for dictation — keeps that quiet instead of red.
 */
function getStoreReview(): StoreReviewModule | null {
  if (cached !== undefined) return cached;
  if (requireOptionalNativeModule('ExpoStoreReview') == null) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-store-review') as StoreReviewModule;
  } catch {
    cached = null;
  }
  return cached;
}

// --- the record of asking ------------------------------------------------------

function getAskCount(): number {
  const n = Number.parseInt(getMeta(KEYS.askCount) ?? '', 10);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function getLastAskedAtMs(): number | null {
  const v = getMeta(KEYS.lastAskedAt);
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Record the ATTEMPT, not the outcome — iOS never says whether it drew the
 * sheet, and a device already over its yearly quota no-ops in silence. Counting
 * attempts is the only honest ledger, and erring toward "we asked" is the right
 * direction: the cost of a missed ask is nothing, the cost of a repeat is a
 * user who thinks the app nags.
 */
function markAsked(atMs: number) {
  setMeta(KEYS.askCount, String(getAskCount() + 1));
  setMeta(KEYS.lastAskedAt, new Date(atMs).toISOString());
}

// --- the ask -------------------------------------------------------------------

export interface FinishedSession {
  userId: string;
  /** The workout just finished — its correction rows are the veto (§7.5). */
  workoutId: string | null;
  /** A PR landed in this session's receipt (`signal.kind === 'pr'`). */
  prToday: boolean;
}

/**
 * Ask for a review if this session earned it. Fire-and-forget: it never blocks,
 * never throws, and returns whether the sheet was requested (for tests and
 * `devLog`, not for UI — nothing in the app may branch on the answer).
 */
export async function maybeAskForReview(session: FinishedSession): Promise<boolean> {
  try {
    const nowMs = Date.now();
    const moment = readMoment(session);
    const decision = reviewDecision(
      moment,
      { askCount: getAskCount(), lastAskedAtMs: getLastAskedAtMs() },
      nowMs,
    );

    if (decision !== 'ask') {
      devLog('review prompt skipped:', decision);
      return false;
    }

    const store = getStoreReview();
    // No module (Expo Go), or nothing to open (TestFlight, no store URL yet):
    // stay silent AND do not spend the ask — `requestReview` would fall back to
    // a console warning about a missing appStoreUrl, which helps nobody.
    if (!store || !(await store.hasAction())) {
      devLog('review prompt unavailable — not spent');
      return false;
    }

    await store.requestReview();
    markAsked(nowMs);
    return true;
  } catch (error) {
    devLog('review prompt failed:', error);
    return false;
  }
}

// --- the manual door ------------------------------------------------------------

/**
 * The user-initiated "Rate Recore" link, or null while there is no listing.
 *
 * THIS IS NOT THE THING §0.1 RULES AGAINST. That ruling forbids a custom
 * *prompt* — a dialog the app raises by itself to decide who gets sent to the
 * store. This is a labelled row in a settings list that the user chose to tap,
 * which Apple documents as the supported deep link and which spends none of the
 * three system asks. The two are opposites: one interrupts, one waits.
 *
 * It returns null until `ios.appStoreUrl` is set in `app.json`, which cannot
 * happen before there is an App Store listing. The row is not rendered at all
 * until then — §1.1 invariant 6, silence over a dead control.
 */
export function reviewStoreUrl(): string | null {
  const base = Constants.expoConfig?.ios?.appStoreUrl;
  if (typeof base !== 'string' || base.length === 0) return null;
  return `${base}${base.includes('?') ? '&' : '?'}action=write-review`;
}

export function openReviewPage() {
  const url = reviewStoreUrl();
  if (!url) return;
  void Linking.openURL(url).catch(() => {});
}

/** Everything the gate needs, read straight out of SQLite. All synchronous. */
function readMoment(session: FinishedSession): ReviewMoment {
  const { userId, workoutId, prToday } = session;
  return {
    sessionsLogged: getLoggedDayKeys(userId).size,
    streak: computeStreak(userId, todayKey()),
    prToday,
    predictorProven: predictorIsProven(getAdherenceRecord(userId)),
    // A correction on THIS note means the parser got it wrong and the user
    // fixed it by hand minutes ago. Asking them to rate the app now is the
    // single worst moment in the product (§7.5).
    correctedThisSession: workoutId != null && getCorrectionPatches(workoutId).length > 0,
    otherSheetDue: isTrialReminderDue() || isTrialWelcomeDue(),
  };
}
