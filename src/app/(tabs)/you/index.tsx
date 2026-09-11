import Constants from 'expo-constants';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Stagger } from '@/components/motion';
import { Identity } from '@/components/profile/identity';
import { AnswerSheet } from '@/components/profile/answer-sheet';
import { LiftsSheet } from '@/components/profile/lifts-sheet';
import { ObstaclesSheet } from '@/components/profile/obstacles-sheet';
import { PrefSheet, prefLabel, type PrefId } from '@/components/profile/pref-sheet';
import { RecapSheet, recapRowValue } from '@/components/profile/recap-sheet';
import { RecordStrip } from '@/components/profile/record-strip';
import { Row, Section } from '@/components/settings-rows';
import {
  isCoach,
  listClients,
  myCoach,
  revokeLink,
  setCoachRole,
  type MyCoach,
} from '@/lib/coaching';
import { unregisterForComments } from '@/lib/coaching/push';
import { isBetaUnlocked, isCoachModeOn } from '@/lib/env';
import type { IconName } from '@/components/icon';
import { listAliasOverrides } from '@/lib/db/alias-overrides';
import { listPlanDays } from '@/lib/db/plan';
import { clearParseCache } from '@/lib/db/cache';
import { contactSupport, SUPPORT_EMAIL } from '@/lib/support';
import { deleteAccount } from '@/lib/account/delete';
import { signOut } from '@/lib/auth/sign-in';
import {
  getPriceLabel,
  getTrialClock,
  isDevLapsed,
  openSubscriptionManagement,
  restore,
  setDevLapsed,
  useEntitlementDecision,
} from '@/lib/billing/state';
import { formatChargeDate } from '@/lib/billing/trial';
import { buildWorkoutsCsv } from '@/lib/export-csv';
import { buildExportJson } from '@/lib/export-json';
import { shareExportFile } from '@/lib/export-share';
import { getProfileTotals } from '@/lib/db/insights';
import { countUnsyncedSessions, getLoggedDayKeys } from '@/lib/db/workouts';
import { getFunnelSnapshot, markImported } from '@/lib/funnel';
import {
  keyLiftsLabel,
  labelFor,
  obstaclesLabel,
  obstaclesSub,
  type AnswerId,
} from '@/lib/profile-answers';
import { seedV2FromRecord } from '@/lib/onboarding-v2-seed';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import { simulateFreshInstall } from '@/lib/dev-fresh-install';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import type { LegalDocId } from '@/lib/legal';
import { groupThousands } from '@/lib/parse/estimate';
import { canRateApp, rateApp } from '@/lib/review';
import { firstLoggedDay, matchesQuery } from '@/lib/settings-search';
import { scheduleSync } from '@/lib/sync/index';
import { color, MAX_FONT_SCALE, spacing, TAB_BAR_CLEARANCE, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * You (CLAUDE.md §5.1 — "Change something."), the fourth tab: a profile and
 * settings screen — an identity, the career record, and thirty-odd rows that
 * each change something real. NOT a bottom sheet, and no back chevron: it is a
 * tab root, opened rarely, and §5.1 says that is fine.
 *
 * ## The iOS 26 pass (9 September 2026)
 *
 * The chrome moved to the navigator (`_layout.tsx` has the whole argument), and
 * this file is now nothing but its scroll view — which is what makes the large
 * title collapse and, for the first time, gives the tab bar a scroll view it
 * can minimize against.
 *
 * Three things changed here in the same pass:
 *
 * **1. The page is DATA now, and that bought a search field.** Every row was a
 * literal `<Row>` in a 500-line return, so the only way to find "bar weight"
 * was to scroll for it. The rows are a list of specs, the list renders itself,
 * and `UISearchController` — the system's own, in the navigation item, with the
 * cancel button and the dismiss gesture a person already knows — filters it.
 * Nothing about a settings screen justifies thirty-three rows and no way to
 * search them; it is the single most useful thing on this screen.
 *
 * The specs carry `keywords`: the words a person would actually type that the
 * row does not print. Somebody looking for pounds types "lbs", not "Units";
 * somebody leaving types "log out". A search that only matches visible labels
 * is a search that fails on exactly the queries worth having one for.
 *
 * **2. The title is "You", not "Profile".** One place had two names, and the
 * anti-slop laws are blunt about it: one label per intent. The tab says You.
 *
 * **3. The groups were reordered and one was folded in.** Integrations held a
 * single row — Apple Health, which is a door onto the record like import and
 * export — so it joined "Your record", and Preferences moved up beside Training
 * because the two are read together: both are about how a session is written
 * and read back. Nine groups became seven.
 *
 * Everything else is unchanged and deliberately so: every real handler is
 * preserved — identity and sign out, subscription (paywall / manage / restore),
 * the editable training prefs (feeding `roundToPlate` and the parser's
 * language), the free-forever CSV/JSON export and the tracker import. Nothing
 * is paywalled; account actions never touch history.
 */

/** One row, as data. The fields are `Row`'s own, minus `divider` — which is
 * position, not content, and is decided by the renderer. */
type RowSpec = {
  /** Stable across a filter, so React never re-mounts a row while typing. */
  key: string;
  icon?: IconName;
  label: string;
  sub?: string;
  value?: string;
  reading?: boolean;
  labelBold?: boolean;
  danger?: boolean;
  warn?: boolean;
  chevron?: boolean;
  external?: boolean;
  disabled?: boolean;
  /** A two-state fact about the account rather than a door — see `Row`. */
  toggle?: { value: boolean; onChange: (next: boolean) => void; disabled?: boolean };
  onPress?: () => void;
  /** Words a person would type that the row does not print — see the note above. */
  keywords?: string;
};

type SectionSpec = {
  key: string;
  label: string;
  footnote?: string;
  footnoteActive?: boolean;
  rows: RowSpec[];
};

/**
 * Read once, at module scope: `isBetaUnlocked` is a build-time constant that
 * Metro inlines, so this is a literal and every branch behind it is dead code
 * the bundler drops out of a normal release build.
 */
const BETA_UNLOCKED = isBetaUnlocked();

export default function You() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  // Bumped by every landed correction — the shorthand count follows it.
  const fixRevision = useSession((s) => s.fixRevision);
  const [busy, setBusy] = useState<null | 'import' | 'signout' | 'delete' | 'restore'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [lapsed, setLapsed] = useState<boolean>(() => isDevLapsed());
  /**
   * COACHING (10 September 2026). Two independent facts, because one person can
   * be both: how many clients they coach, and who coaches them. The spec calls
   * that out as an edge case; modelling it as two unrelated pieces of state is
   * what makes it stop being one.
   *
   * Both are null until the first answer arrives, and both stay null forever
   * when `coachMode` is off — the queries are never sent.
   */
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [coach, setCoach] = useState<MyCoach | null>(null);
  /**
   * WHETHER THIS PERSON IS HERE TO COACH — a third, independent fact.
   *
   * It is not derivable from the other two. Someone can coach nobody yet and
   * still be a coach, and someone with a coach is usually not one. Until it
   * existed this screen offered every account BOTH ends of the relationship,
   * which is the defect the owner reported on 10 September 2026: a client, one
   * tap after typing somebody's code, was invited to invite clients of their
   * own.
   */
  const [coachRole, setRole] = useState(false);
  /** True while the switch is waiting on the server. */
  const [roleBusy, setRoleBusy] = useState(false);

  /** What the system search field currently holds. Empty is the whole page. */
  const [query, setQuery] = useState('');
  /**
   * WHICH "About you" PICKER IS OPEN, and whether it is on screen.
   *
   * Two pieces of state and not one, on purpose: clearing the id on close would
   * unmount the sheet's content on the same frame the dismissal starts, and the
   * exit animation would play over an empty card. The id survives the close and
   * is simply replaced on the next open.
   */
  const [editing, setEditing] = useState<AnswerId | null>(null);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [liftsOpen, setLiftsOpen] = useState(false);
  const [obstaclesOpen, setObstaclesOpen] = useState(false);
  /**
   * THE SAME TWO-PIECE PATTERN, for the settings that are not flow answers:
   * which picker is open, and whether it is on screen. `PrefSheet` is one
   * mounted sheet driven by an id, exactly as `AnswerSheet` is — six mounted
   * sheets would be six native presentation contexts fighting for one slot.
   */
  const [prefEditing, setPrefEditing] = useState<PrefId | null>(null);
  const [prefOpen, setPrefOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  /** Bumped by every landed answer — the "About you" labels are derived from it. */
  const [answerRevision, setAnswerRevision] = useState(0);
  /** The same, for the rows whose value lives in a pref rather than an answer. */
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const entitlement = useEntitlementDecision();

  /**
   * What the subscription row says — read from the store's own cached answer,
   * never asserted. Before this change the row read "Beta · billing off" beside
   * a paywall quoting real prices; the two could not both be true (§2).
   */
  const subscriptionValue = useMemo(() => {
    if (entitlement.entitlement === 'lapsed') {
      return entitlement.reason === 'unverified' ? 'Not confirmed' : 'Not active';
    }
    const clock = getTrialClock();
    if (clock && clock.phase !== 'charged') return 'Free trial';
    return 'Active';
  }, [entitlement]);

  /**
   * The renewal or charge date under the row, when the store told us one. Null
   * means nothing is claimed — never a guessed date (§2).
   */
  const subscriptionSub = useMemo(() => {
    const clock = getTrialClock();
    const price = getPriceLabel();
    if (clock && clock.phase !== 'charged') {
      return price
        ? `${price} on ${formatChargeDate(clock.chargeAtMs)} unless you cancel`
        : `Begins ${formatChargeDate(clock.chargeAtMs)} unless you cancel`;
    }
    if (entitlement.entitlement === 'entitled' && price) return `${price}, renews until you cancel`;
    return undefined;
  }, [entitlement]);

  /**
   * The record, read once per visit. Four synchronous SQLite reads on a tab
   * opened rarely — §17's "under 400 ms shows nothing" applies, so there is no
   * spinner and no loading state here on purpose.
   *
   * `hydrate`'s streak is deliberately not reused: it tracks the note being
   * typed on Today, and this screen wants the record as it stands.
   */
  const record = useMemo(() => {
    if (!userId) return null;
    const days = getLoggedDayKeys(userId);
    if (days.size === 0) return null; // nothing to draw is not a zero, it is silence
    const totals = getProfileTotals(userId);
    // Sessions ARE logged days here: the record is one note per day, so the two
    // counts are the same number and the card names the one a person thinks in.
    return { days: days.size, sets: totals.sets, volume: totals.volume, since: earliest(days) };
  }, [userId]);

  /**
   * The seven "About you" values, as the rows print them. Derived rather than
   * held: `labelFor` reads the flow's own option list, so a row can never show a
   * label for a choice the flow no longer offers.
   */
  const answers = useMemo(
    () => ({
      goal: labelFor('goal'),
      experience: labelFor('experience'),
      frequency: labelFor('frequency'),
      split: labelFor('split'),
      keyLifts: keyLiftsLabel(),
      tracker: labelFor('tracker'),
      obstacles: obstaclesLabel(),
      // The frustrations themselves, in the flow's words, on the row's second
      // line — the value column is one line wide and these are sentences.
      obstaclesSub: obstaclesSub(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answerRevision],
  );

  /**
   * The settings rows' values, derived the same way the answers are. `prefLabel`
   * and the picker read one table (`profile/pref-sheet`), so a row and the sheet
   * it opens cannot print different words for the same stored value.
   */
  const prefs = useMemo(
    () => ({
      unit: prefLabel('unit'),
      rest: prefLabel('rest'),
      restauto: prefLabel('restauto'),
      bar: prefLabel('bar'),
      language: prefLabel('language'),
      setreadings: prefLabel('setreadings'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsRevision],
  );

  /**
   * §9.3's alarm, made readable without a debugger (S4/S5, 10 Sep 2026): how
   * many model answers the brief and prediction guards refused on this device.
   *
   * ZERO IS THE EXPECTED READING. A number that climbs means the prompt has
   * drifted into inventing facts and the guard is the only thing catching it —
   * which is precisely the failure that was invisible before the counters
   * existed. Summed across both surfaces because the question this row answers
   * is "is anything being refused at all", not "which one".
   */
  const guardRejections = useMemo(() => {
    const f = getFunnelSnapshot();
    return f.guard_rejected_brief + f.guard_rejected_prediction;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRevision]);

  /** "Sundays 18:00", "Mondays 08:00", or "Off" — the DAY included, because the
   * v2 flow asks for it and `lib/recap.ts` schedules on it. */
  const recapValue = useMemo(
    () => recapRowValue(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsRevision],
  );

  const openAnswer = (id: AnswerId) => {
    tap();
    setEditing(id);
    setAnswerOpen(true);
  };

  const openPref = (id: PrefId) => {
    tap();
    setPrefEditing(id);
    setPrefOpen(true);
  };

  /**
   * An "About you" answer just landed.
   *
   * The rows re-read, and the v2 store is re-seeded from the record — the
   * paywall builds its copy from that store (`paywall-v2/plan.tsx`) and is
   * reachable from the subscription row two groups down, so an edit that did
   * not travel would show up as a paywall quoting the answer that was just
   * replaced. `lib/onboarding-v2-seed.ts` has the whole argument.
   */
  const noteAnswerChanged = () => {
    seedV2FromRecord();
    setAnswerRevision((n) => n + 1);
  };

  const noteSettingChanged = () => setSettingsRevision((n) => n + 1);

  /** How many shorthands the parser has been taught — the count on the
   * "Reading corrections" row. Re-read on every landed correction. */
  const aliasCount = useMemo(
    () => (userId ? listAliasOverrides(userId).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, fixRevision],
  );

  /**
   * The session types, named — "Push, Pull, Legs". Read from the split's own
   * days, because that is what a session type IS here; there is no second
   * list to keep in step. Silent when no split exists rather than showing a
   * zero, and truncated to three names so the row cannot outgrow its line.
   */
  const splitValue = useMemo(() => {
    if (!userId) return 'Not set';
    const labels = listPlanDays(userId).map((d) => d.label.trim()).filter(Boolean);
    if (labels.length === 0) return 'Not set';
    return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}` : labels.join(', ');
  }, [userId]);

  const handleImport = async () => {
    if (busy || !userId) return;
    tap();
    setImportMessage(null);
    setBusy('import');
    try {
      const outcome = await pickAndImportCsv(userId);
      if (outcome.status === 'cancelled') return;
      if (outcome.status === 'invalid') {
        setImportMessage('That file is not a Hevy or Strong CSV export.');
        return;
      }
      if (outcome.status === 'too-large') {
        setImportMessage(
          `That file is over ${outcome.limitMb} MB — more than the import can read at once. Export a shorter date range and try again.`,
        );
        return;
      }
      if (outcome.status === 'failed') {
        setImportMessage('Import failed — export a fresh CSV and try again.');
        return;
      }

      hydrate(userId); // streak, calendar dots, today's view
      scheduleSync();
      // The split that divides every trial-window number (§2.1, PLAN D4).
      if (outcome.importedDays > 0) markImported();
      // A row the ceiling dropped is SAID, not swallowed (S10): an import that
      // quietly loses the tail of someone's history is a record they cannot
      // trust.
      const dropped =
        outcome.droppedRows > 0 ? ` · ${outcome.droppedRows} rows past the limit were not read` : '';
      setImportMessage(
        (outcome.importedDays > 0
          ? `Imported ${outcome.importedDays} workouts (${outcome.sets} sets)` +
            (outcome.skippedDays > 0 ? ` · ${outcome.skippedDays} days already logged` : '')
          : 'Nothing new to import — those days are already logged.') + dropped,
      );
    } finally {
      setBusy(null);
    }
  };

  /**
   * Export, as a FILE (PLAN C6). This used to be `Share.share({ message: csv })`
   * — the whole export as a message body, which reaches Mail and Notes and
   * cannot be saved to Files. Both formats now write a real file and go out
   * through the system sheet with a real UTI.
   *
   * JSON is listed first because it is the complete one: it carries `raw_text`,
   * and the user's own words are the record (§1.1). CSV is the interchange
   * format for a spreadsheet, and it necessarily loses them.
   */
  const handleExport = async (format: 'csv' | 'json') => {
    if (!userId) return;
    tap();
    const contents = format === 'json' ? buildExportJson(userId) : buildWorkoutsCsv(userId);
    if (!contents) {
      setExportMessage('Nothing to export yet.');
      return;
    }
    setExportMessage(null);
    const outcome = await shareExportFile(format, contents);
    if (outcome === 'unavailable') setExportMessage('Sharing is unavailable on this device.');
    else if (outcome === 'failed') setExportMessage('Export failed — try again.');
  };

  /**
   * ONE export row, two real files (§20 — the export is complete and free
   * forever). JSON leads because it is the only one that carries `raw_text`:
   * the words are the record, and an export that dropped them would not be a
   * copy of the record at all. The sheet says so in those terms rather than
   * naming file formats at someone who just wants their training.
   */
  const handleExportChoice = () => {
    tap();
    Alert.alert(
      'Export my record',
      'Everything includes the sessions exactly as you wrote them. The spreadsheet is the numbers only — useful elsewhere, but it cannot carry your words.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Everything (your words too)', onPress: () => void handleExport('json') },
        { text: 'Spreadsheet (CSV)', onPress: () => void handleExport('csv') },
      ],
    );
  };

  const handleContact = async () => {
    tap();
    const opened = await contactSupport();
    if (!opened) setSupportMessage(`No mail app is set up. Write to ${SUPPORT_EMAIL}.`);
  };

  const handleRate = async () => {
    tap();
    const opened = await rateApp();
    if (!opened) setSupportMessage('The App Store is not reachable from this build yet.');
  };

  /**
   * Clear local cache — the readings, never the record.
   *
   * It deletes the stored parse results and asks for them again; `raw_text`,
   * sets, reflections, notes and corrections are untouched (`db/cache.ts`
   * spells out exactly what moves). That is why the confirmation can promise
   * that nothing is lost and mean it, and why this is amber rather than red.
   */
  const handleClearCache = () => {
    if (busy || !userId) return;
    tap();
    Alert.alert(
      'Clear local cache?',
      'Recore will read your notes again from scratch. Nothing you wrote is deleted — your sessions, notes and corrections all stay exactly as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear cache',
          onPress: () => {
            tapMedium();
            const queued = clearParseCache(userId);
            hydrate(userId);
            scheduleSync();
            setAccountMessage(
              queued > 0
                ? `Cleared — ${queued} ${queued === 1 ? 'session' : 'sessions'} will be read again as you open them.`
                : 'Cleared. There was nothing cached.',
            );
          },
        },
      ],
    );
  };

  /**
   * Sign out ASKS FIRST (6 September 2026). It sat between "Clear local cache"
   * and "Delete account" — both of which have always confirmed — as the one row
   * in the destructive zone that fired on the first tap, and it is a one-way
   * door for anyone signed in with Apple who does not remember which Apple
   * Account they used.
   *
   * It is a system alert, like every other confirmation in the app: a real
   * `UIAlertController`, `destructive` on the verb and `cancel` on the way out,
   * so the app has one destructive voice (`note-surface.tsx` says the same).
   *
   * THE MESSAGE USED TO BE FALSE, and it was false in the one direction that
   * costs something (10 September 2026). It read "Your training stays on this
   * device and on the server". It does not stay on the device: signing out
   * re-scopes the local database to the pre-account id, and re-scoping to a
   * different user WIPES every table — `ensureLocalUser` in `db/index.ts`, and
   * that wipe is correct, because a device with nobody signed in should not be
   * holding an account's training.
   *
   * What made it worth fixing rather than rewording is the second half. The
   * wipe is only harmless while sync has already carried the record, and
   * `dirty = 1` is exactly the set of rows for which it has not. Somebody who
   * logged three sessions underground and signs out before the phone finds
   * signal loses them, silently, having just been told they would not.
   *
   * So the alert says what is true, and when there is unsynced work it says how
   * much and offers the way out. It still does not try to talk anybody out of
   * signing out (§20: never harder to leave than to arrive) — naming a cost is
   * not the same as arguing against the decision.
   */
  const handleSignOut = () => {
    if (busy) return;
    tap();

    const pending = userId ? countUnsyncedSessions(userId) : 0;
    const message =
      pending > 0
        ? `${pending === 1 ? '1 session has' : `${pending} sessions have`} not reached the server yet. Signing out removes this device's copy, so ${pending === 1 ? 'it' : 'they'} would be lost. Reconnect first if you can.`
        : 'Your training stays on the server and comes back when you sign in. The copy on this device is removed.';

    Alert.alert('Sign out?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void runSignOut() },
    ]);
  };

  const runSignOut = async () => {
    tapMedium();
    setBusy('signout');
    try {
      await signOut(); // the guard swaps back to /sign-in
    } finally {
      setBusy(null);
    }
  };

  /**
   * REPLAY THE FLOW ON TODAY'S ANSWERS, not on the ones the last run left behind.
   *
   * The row promises "your answers already ticked". What the flow's own store
   * holds is whatever was true when that run finished, which is not the same
   * thing the moment anybody edits a row above — and finishing the replay would
   * then commit the stale answer straight back over the edit. Seeding first
   * closes that loop: the screens open on the record, and the commit at the end
   * writes back what the person actually confirmed.
   */
  const handleReplaySetup = () => {
    tap();
    seedV2FromRecord();
    router.push('/onboarding-v2/1');
  };

  /**
   * THE ONE DEVELOPMENT ENTRANCE (owner's ask, 31 August 2026): put the device
   * back to the second after a download and walk the whole funnel —
   * onboarding → paywall → sign-in → Today.
   *
   * It asks first, and the alert states the two things the label cannot: that
   * this is not a sandboxed replay (it really does clear the answers and sign
   * out) and that the training record survives. A destructive dev row that
   * reads like a preview is how somebody loses an afternoon of settings.
   */
  const handleFreshInstall = () => {
    tap();
    Alert.alert(
      'Simulate a fresh install?',
      'Clears every onboarding answer and preference on this device and signs you out, then starts the funnel from screen 1. This is the real flow, not a sandboxed replay. Your training record is not touched.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start over',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await simulateFreshInstall();
              router.replace('/onboarding-v2/1');
            })();
          },
        },
      ],
    );
  };

  const handleManage = () => {
    tap();
    // Customer Center where the build has it, Apple's subscriptions page
    // otherwise. One entry point, so all three surfaces stay identical, and
    // never a dead control (§2).
    void openSubscriptionManagement();
  };

  /** Real Restore: it asks the store, it never charges, and it says what it found. */
  const handleRestore = async () => {
    if (busy) return;
    tap();
    setBusy('restore');
    setSubscriptionMessage(null);
    try {
      const outcome = await restore();
      setSubscriptionMessage(
        outcome.status === 'restored'
          ? 'Your subscription is restored.'
          : outcome.status === 'nothing'
            ? 'No Recore subscription is attached to this Apple Account.'
            : 'Restore could not reach the App Store. Try again in a moment.',
      );
    } finally {
      setBusy(null);
    }
  };

  /** Three real pages now, not an Alert (PLAN C3 + A3). */
  const openDoc = (doc: LegalDocId) => {
    tap();
    router.push({ pathname: '/legal', params: { doc } });
  };

  /**
   * Delete account, for real (PLAN D1). Apple requires this wherever an account
   * can be made in-app, and until 28 July it was an Alert promising deletion
   * "within 30 days" and doing nothing.
   *
   * Two taps, because it cannot be undone — and the confirmation says what goes
   * and offers the export first, rather than trying to talk the user out of it
   * (§20: never harder to leave than to arrive).
   */
  const handleDeleteAccount = () => {
    if (busy) return;
    tap();
    Alert.alert(
      'Delete account',
      'This deletes your account and every note, session and plan in it, on this phone and on the server. It cannot be undone.\n\nExport everything from Your record first if you want to keep it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void runDeleteAccount(),
        },
      ],
    );
  };

  const runDeleteAccount = async () => {
    tapMedium();
    setBusy('delete');
    try {
      const outcome = await deleteAccount();
      if (outcome === 'offline') {
        Alert.alert(
          'Not deleted',
          'Recore could not reach the server. Nothing was deleted — try again on a connection.',
        );
      } else if (outcome === 'failed') {
        Alert.alert('Not deleted', 'The account could not be deleted. Nothing was changed.');
      }
      // On success the auth guard swaps the whole navigator; there is no screen
      // left to show a message on, and a "done" alert over a paywall is noise.
    } finally {
      setBusy(null);
    }
  };

  const dataCaption =
    importMessage ??
    exportMessage ??
    'Export and deletion stay available even without an active subscription.';

  /**
   * THE PAGE, AS DATA.
   *
   * The order is the argument. Identity and the record sit above all of it;
   * then the answers a person came here to change, then the two groups about
   * how a session is written and read back, then the record's own doors, then
   * the account state, then the things read once and never again, then the two
   * that cannot be undone.
   */
  /**
   * Coaching state, refreshed EVERY TIME You comes forward.
   *
   * It was a `useEffect` keyed on `userId`, with a comment claiming exactly the
   * behaviour written above — and a plain effect cannot do it. This screen is a
   * tab: it mounts once and stays mounted, in the background, for the life of
   * the session (see the tab-switching note in `(tabs)/_layout.tsx`). So the
   * effect ran once, at launch, and the two facts it reads were then frozen.
   *
   * That is the whole of the bug the owner hit on 10 September 2026: a client
   * typed a valid code, `redeem_coach_invite` created the link, `join.tsx`
   * popped back to here — and this screen still held the answer it had fetched
   * before the link existed, so it went on offering "Join a coach" and named no
   * coach anywhere. Nothing was wrong on the server; it was never asked again.
   * The coach's half had the same shape: a client redeeming a code could not
   * make the "Clients" row appear until the app was killed and relaunched.
   *
   * `useFocusEffect` is the fix and it is also the cheapest correct refresh
   * this screen can have — two RPCs when a person navigates to You, never while
   * they are logging. Still fire-and-forget, and still completely absent with
   * the flag off: with `coachMode` false this returns before it touches the
   * network, so a build without the feature makes no coaching request at all.
   */
  useFocusEffect(
    useCallback(() => {
      if (!isCoachModeOn()) return;
      let alive = true;
      void (async () => {
        const [clients, mine, role] = await Promise.all([
          listClients(),
          myCoach(),
          userId ? isCoach(userId) : Promise.resolve(false),
        ]);
        if (!alive) return;
        setClientCount(clients.length);
        setCoach(mine);
        setRole(role);
      })();
      return () => {
        alive = false;
      };
      // FOCUS is the trigger, not a value; `userId` is in the list only because
      // the body reads it. The account cannot change under a mounted You —
      // `_layout.tsx` unmounts the whole `(tabs)` group through
      // `Stack.Protected` when the session ends.
    }, [userId]),
  );

  /**
   * THE SWITCH. Optimistic, because a toggle that lags a finger reads as
   * broken — and corrected from the server's own answer rather than from a
   * guess, so the one refusal that matters arrives as a sentence instead of a
   * silent snap-back.
   */
  const toggleCoachRole = useCallback((next: boolean) => {
    setRoleBusy(true);
    setRole(next);
    void (async () => {
      const result = await setCoachRole(next);
      setRoleBusy(false);
      if ('on' in result) {
        setRole(result.on);
        if (!result.on) setClientCount(0);
        return;
      }
      setRole(!next);
      Alert.alert(
        result.error === 'still_coaching' ? 'You still coach people' : 'That did not work',
        result.error === 'still_coaching'
          ? 'Turning coaching off would take their sessions off your screen while you could still read them. Remove each client from the Clients list first.'
          : 'Try again in a moment.',
      );
    })();
  }, []);

  const sections = useMemo<SectionSpec[]>(() => {
    const out: SectionSpec[] = [
      // ---------------------------------------------------------------------
      // COACHING. Behind the build flag, and it draws NOTHING when the flag is
      // off — not a disabled row, not an upsell. A feature that is not in this
      // build should be invisible, not advertised.
      //
      // The two halves are independent on purpose (the spec's edge case): the
      // coach half appears once there is a client, the client half once there
      // is a coach, and a person holding both ends sees both.
      // ---------------------------------------------------------------------
      ...(isCoachModeOn()
        ? [
            {
              key: 'coaching',
              label: 'Coaching',
              /**
               * ONE SECTION, TWO SIDES, AND THEY ARE NOT SYMMETRICAL.
               *
               * The client side belongs to everybody: anyone may be given a
               * code, and anyone who has used one needs to see who reads their
               * training and how to stop it. The coach side belongs to people
               * who say they coach — and until 10 September 2026 it belonged to
               * everybody too, so a client was invited to invite clients. The
               * switch at the bottom is the whole difference.
               *
               * The order follows that: what is being done TO you, then what
               * you do for others, then the statement that puts you in the
               * second group.
               */
              footnote: coach
                ? 'Your coach can read the sessions you log and comment on them. They can never edit your record.'
                : coachRole
                  ? 'Coaching lets you hand out codes. You can read somebody’s training only after they enter one.'
                  : 'Turn this on if you train other people. On its own it gives you access to nobody.',
              rows: [
                // --- the client's side ---------------------------------------
                //
                // WHO YOUR COACH IS, SAID PLAINLY. The only thing that named
                // them used to be the `sub` line of a red "Remove access" row,
                // which is a strange place to learn a link exists: the first
                // sentence about the relationship was attached to the control
                // that ends it. It is a reading now, not a control — no
                // chevron, no action (design skill §Structure).
                ...(coach
                  ? [
                      {
                        key: 'your-coach',
                        icon: 'person' as const,
                        label: 'Your coach',
                        value: coach.displayName ?? undefined,
                        sub: coach.displayName ? undefined : 'They have not set a name in Recore.',
                        chevron: false,
                        keywords: 'coach trainer who linked connected',
                      },
                      {
                        key: 'coach-comments',
                        // A speech bubble — the same glyph the athlete's own
                        // per-entry note wears, because it is the same kind of
                        // thing: somebody's words about a lift.
                        icon: 'note' as const,
                        label: 'Comments from your coach',
                        value: coach.unreadCount > 0 ? String(coach.unreadCount) : undefined,
                        keywords: 'coach comments feedback replies thread unread',
                        onPress: () => {
                          tap();
                          // The COACH's own two screens, with this person's own
                          // id: `clientFeed` reads `workouts` by `user_id`, and
                          // RLS lets an owner read their own rows, so one
                          // implementation serves both ends of the link.
                          router.push({
                            pathname: '/you/coaching/client/[id]',
                            params: { id: userId ?? '', name: coach.displayName ?? 'Coach' },
                          });
                        },
                      },
                      {
                        key: 'remove-coach',
                        icon: 'lock' as const,
                        label: 'Remove access',
                        danger: true,
                        chevron: false,
                        keywords: 'coach revoke remove unlink disconnect',
                        onPress: () => {
                          tap();
                          Alert.alert(
                            'Remove your coach?',
                            'They will immediately stop being able to read your sessions. The comments already written stay in your record.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Remove',
                                style: 'destructive',
                                onPress: () => {
                                  void (async () => {
                                    if (!(await revokeLink(coach.linkId))) return;
                                    setCoach(null);
                                    // Nothing can notify this device any more,
                                    // so the token should not still be
                                    // reachable — unless this person also
                                    // coaches someone, in which case replies
                                    // still arrive.
                                    if (!clientCount && userId) {
                                      void unregisterForComments(userId);
                                    }
                                  })();
                                },
                              },
                            ],
                          );
                        },
                      },
                    ]
                  : [
                      {
                        key: 'join',
                        icon: 'plus' as const,
                        label: 'Join a coach',
                        keywords: 'coach join code enter invite trainer',
                        onPress: () => {
                          tap();
                          router.push('/you/coaching/join');
                        },
                      },
                    ]),

                // --- the coach's side, which has to be claimed ----------------
                ...(coachRole
                  ? [
                      {
                        key: 'clients',
                        icon: 'barbell' as const,
                        label: 'Clients',
                        // Shown at zero too. A coach who has just turned this
                        // on and issued a code should find the roster where it
                        // will be, not have it appear from nowhere later.
                        value: String(clientCount ?? 0),
                        keywords: 'coach clients athletes roster',
                        onPress: () => {
                          tap();
                          router.push('/you/coaching/clients');
                        },
                      },
                      {
                        key: 'invite',
                        icon: 'share' as const,
                        label: 'Invite a client',
                        keywords: 'coach invite code share athlete',
                        onPress: () => {
                          tap();
                          router.push('/you/coaching/invite');
                        },
                      },
                    ]
                  : []),

                // --- and the statement itself --------------------------------
                {
                  key: 'coach-role',
                  icon: 'person' as const,
                  label: 'I coach other people',
                  keywords: 'coach trainer role enable turn on off pt personal',
                  toggle: {
                    value: coachRole,
                    onChange: toggleCoachRole,
                    disabled: roleBusy,
                  },
                },
              ],
            } as SectionSpec,
          ]
        : []),

      {
        key: 'about',
        label: 'About you',
        footnote:
          'Everything you answered when you set Recore up. Change any of it whenever it changes.',
        rows: [
          {
            key: 'goal',
            icon: 'crosshair',
            label: 'Goal',
            value: answers.goal,
            keywords: 'strength muscle fat loss objective',
            onPress: () => openAnswer('goal'),
          },
          {
            key: 'experience',
            icon: 'hourglass',
            label: 'Training experience',
            value: answers.experience,
            keywords: 'beginner intermediate advanced years lifting',
            onPress: () => openAnswer('experience'),
          },
          {
            key: 'frequency',
            icon: 'calendar',
            label: 'Sessions a week',
            value: answers.frequency,
            keywords: 'frequency days per week how often',
            onPress: () => openAnswer('frequency'),
          },
          {
            key: 'split',
            icon: 'layers',
            label: 'Split',
            value: answers.split,
            keywords: 'push pull legs upper lower full body programme program routine',
            onPress: () => openAnswer('split'),
          },
          {
            key: 'lifts',
            icon: 'barbell',
            label: 'Key lifts',
            value: answers.keyLifts,
            keywords: 'squat bench deadlift press one rep max current',
            onPress: () => {
              tap();
              setLiftsOpen(true);
            },
          },
          // WHERE THEY LOG NOW, and WHAT GETS IN THE WAY — screens 2 and 3 of
          // the flow. The first decides whether the CSV import fast path is
          // offered; the second decides which value proposition leads on the
          // reveal and on the paywall. Both are answers about the person and
          // both change over a year of training.
          {
            key: 'tracker',
            icon: 'document',
            label: 'Where you log now',
            value: answers.tracker,
            keywords: 'strong hevy notes app paper spreadsheet tracker',
            onPress: () => openAnswer('tracker'),
          },
          {
            key: 'obstacles',
            icon: 'wrench',
            label: 'What gets in the way',
            value: answers.obstacles,
            sub: answers.obstaclesSub,
            keywords: 'frustration problem blocker time motivation',
            onPress: () => {
              tap();
              setObstaclesOpen(true);
            },
          },
          // THE WHOLE FLOW AGAIN, under the answers it rewrites. A real run,
          // not the sandboxed replay in Development: it opens with the previous
          // answers already ticked and commits through the same single commit
          // point when it finishes.
          {
            key: 'replay',
            icon: 'refresh',
            label: 'Run setup again',
            sub: 'Every question from the start, with your answers already ticked',
            keywords: 'onboarding questions redo restart setup',
            onPress: handleReplaySetup,
          },
        ],
      },
      // TRAINING — the settings that change how a SESSION works, and not one of
      // them is an onboarding answer. The v2 flow writes and shows kilograms,
      // takes the writing language from the locale and states a 20 kg Olympic
      // bar as an assumption rather than a question (`flow.ts`), so these belong
      // here and not in "About you" above. They are still real settings with
      // live readers — `bottom-toolbar` starts the timer from the rest pref,
      // `ghost-prediction` racks a prediction with the bar.
      {
        key: 'training',
        label: 'Training',
        footnote: 'Predictions round to what your gym’s bar can actually hold.',
        rows: [
          {
            key: 'unit',
            icon: 'plate',
            label: 'Units',
            value: prefs.unit,
            keywords: 'kg kilograms lbs pounds weight metric imperial',
            onPress: () => openPref('unit'),
          },
          {
            key: 'rest',
            icon: 'timer',
            label: 'Rest timer default',
            value: prefs.rest,
            reading: true,
            keywords: 'seconds minutes between sets countdown',
            onPress: () => openPref('rest'),
          },
          // The rest timer starts itself when a set lands in the note (10 Sep
          // 2026, `rest-controls.tsx`). It defaults ON and the bar says so the
          // first time it happens, so this row is where somebody who does not
          // want it comes to say so — and where somebody who liked it and then
          // turned it off comes back.
          {
            key: 'restauto',
            // `arrow.clockwise` — the row's whole meaning is "and it restarts
            // on the next set". `sparkle` is Pro and parsing; a timer that
            // follows the record is not magic, it is a repeat.
            icon: 'refresh',
            label: 'Start rest automatically',
            value: prefs.restauto,
            keywords: 'auto automatic rest timer set logged restart countdown',
            onPress: () => openPref('restauto'),
          },
          {
            key: 'bar',
            icon: 'barbell',
            label: 'Bar weight',
            value: prefs.bar,
            reading: true,
            keywords: 'olympic barbell 20 kg empty bar rounding plates',
            onPress: () => openPref('bar'),
          },
          // The §12.1 weekly recap — the one recurring notification that
          // exists. It lives here rather than in a Notifications group of its
          // own: it is a training habit, and one row does not need a section.
          // The value names the DAY as well as the hour, because the flow asks
          // for the day and the scheduler honours it.
          {
            key: 'recap',
            icon: 'bell',
            label: 'Weekly recap',
            value: recapValue,
            reading: recapValue !== 'Off',
            keywords: 'notification reminder sunday weekly summary push alert',
            onPress: () => {
              tap();
              setRecapOpen(true);
            },
          },
        ],
      },
      // PREFERENCES — how Recore reads what you write, and how it prints it
      // back. Neither is an answer about the person and neither is asked by the
      // v2 flow, which is exactly why they are one group — and why the group
      // sits directly under Training rather than six screens below it.
      {
        key: 'preferences',
        label: 'Preferences',
        footnote:
          'Recore already follows your iPhone’s text size. Set readings makes the sets larger on their own.',
        rows: [
          {
            key: 'language',
            icon: 'language',
            label: 'Writing language',
            value: prefs.language,
            keywords: 'slovenian english parser words locale',
            onPress: () => openPref('language'),
          },
          {
            key: 'setreadings',
            icon: 'table',
            label: 'Set readings',
            value: prefs.setreadings,
            keywords: 'text size larger bigger font display ledger',
            onPress: () => openPref('setreadings'),
          },
        ],
      },
      // YOUR RECORD — every door onto the record itself: what a session is
      // called, what Recore has learned to read, the two ways the whole thing
      // moves in or out, and (since 9 Sep 2026) Health, which is a door of the
      // same kind and was a one-row group of its own.
      {
        key: 'record',
        label: 'Your record',
        footnote: dataCaption,
        footnoteActive: importMessage != null || exportMessage != null,
        rows: [
          // Session types = the split's own days, which is where they are
          // named, renamed and deleted (`/split` → `/plan-day`).
          {
            key: 'sessiontypes',
            icon: 'calendar',
            label: 'Session types',
            value: splitValue,
            keywords: 'day names push pull legs rename plan',
            onPress: () => {
              tap();
              router.push('/split');
            },
          },
          {
            key: 'aliases',
            icon: 'wrench',
            label: 'Reading corrections',
            value: aliasCount === 1 ? '1 shorthand' : `${aliasCount} shorthands`,
            keywords: 'shorthand abbreviation parser taught fix misread',
            onPress: () => {
              tap();
              router.push('/you/aliases');
            },
          },
          {
            key: 'import',
            icon: 'upload',
            label: busy === 'import' ? 'Importing…' : 'Import from Strong or Hevy',
            keywords: 'csv migrate transfer bring history strong hevy',
            disabled: busy !== null,
            onPress: () => void handleImport(),
          },
          {
            key: 'export',
            icon: 'download',
            label: 'Export my record',
            sub: 'Your sessions, including the words you wrote',
            keywords: 'csv json backup download share data copy',
            onPress: handleExportChoice,
          },
          // ONE ROW, and it opens an honest "not connected". A switch here would
          // be a promise the app cannot keep: there is no HealthKit code in the
          // project (see `app/(tabs)/you/health.tsx`).
          {
            key: 'health',
            icon: 'target',
            label: 'Apple Health',
            value: 'Not connected',
            sub: 'Recore does not read or write Health data',
            keywords: 'healthkit fitness activity rings sync',
            onPress: () => {
              tap();
              router.push('/you/health');
            },
          },
        ],
      },
      // SUBSCRIPTION — the store's own state, and three real actions. The
      // footnote doubles as the result line for Restore.
      //
      // IT NEVER ASSERTS A DATE IT WAS NOT TOLD. `subscriptionSub` is built from
      // the store's own clock and is undefined when the store has not answered,
      // so this group can say "renews 30 Aug" only when RevenueCat said so
      // (§2 rule 5). A hardcoded renewal date would be the exact billing claim
      // the invariant forbids.
      //
      // A BETA BUILD REPLACES ALL THREE ROWS WITH ONE STATEMENT. Its store is
      // unconfigured by construction (`isBetaUnlocked`, `env.ts`), so the
      // paywall would quote no price, Manage would open an Apple page listing
      // nothing, and Restore would answer "no subscription" to a person who
      // never bought one. Three controls that cannot do what they say is worse
      // than one sentence that is true, and §2 forbids a dead control.
      {
        key: 'subscription',
        label: 'Subscription',
        footnote: BETA_UNLOCKED
          ? 'No store is attached to this build. Nothing can be bought, charged or restored.'
          : (subscriptionMessage ?? 'Managed by your Apple Account. Cancel any time.'),
        footnoteActive: !BETA_UNLOCKED && subscriptionMessage != null,
        rows: BETA_UNLOCKED
          ? [
              {
                key: 'pro',
                icon: 'sparkle',
                label: 'Recore Pro',
                value: 'Beta · billing off',
                sub: 'Everything is open while this build is being tested',
                keywords: 'plan price trial billing upgrade paywall beta testflight',
              },
            ]
          : [
              {
                key: 'pro',
                icon: 'sparkle',
                label: 'Recore Pro',
                value: subscriptionValue,
                sub: subscriptionSub,
                keywords: 'plan price trial billing upgrade paywall',
                onPress: () => {
                  tap();
                  router.push('/paywall-v2/plan');
                },
              },
              {
                key: 'manage',
                icon: 'card',
                label: 'Manage subscription',
                external: true,
                keywords: 'cancel change payment apple account billing',
                onPress: handleManage,
              },
              {
                key: 'restore',
                icon: 'refresh',
                label: busy === 'restore' ? 'Restoring…' : 'Restore purchases',
                keywords: 'already paid transfer new phone receipt',
                disabled: busy !== null,
                onPress: () => void handleRestore(),
              },
            ],
      },
      // SUPPORT — a real mailbox, the store listing, and what this build is.
      // The credo is the one line of belief the app is allowed: it is not a
      // claim about the product, it is the rule the code follows.
      {
        key: 'support',
        label: 'Support',
        footnote: supportMessage ?? undefined,
        footnoteActive: supportMessage != null,
        rows: [
          {
            key: 'contact',
            icon: 'document',
            label: 'Contact support',
            keywords: 'email help bug report problem feedback',
            onPress: () => void handleContact(),
          },
          // Not the §16.3 prompt: a labelled thing the user chose to tap. It
          // spends none of the three system asks unless iOS actually draws the
          // sheet, and the row is absent when there is no door at all.
          ...(canRateApp()
            ? [
                {
                  key: 'rate',
                  icon: 'star' as IconName,
                  label: 'Rate Recore',
                  external: true,
                  keywords: 'review stars app store',
                  onPress: () => void handleRate(),
                },
              ]
            : []),
          {
            key: 'parsing',
            icon: 'sparkle',
            label: 'How parsing works',
            keywords: 'ai reading notes understand shorthand',
            onPress: () => openDoc('parsing'),
          },
          {
            key: 'privacy',
            icon: 'lock',
            label: 'Privacy Policy',
            keywords: 'data gdpr legal',
            onPress: () => openDoc('privacy'),
          },
          {
            key: 'terms',
            icon: 'document',
            label: 'Terms of Use',
            keywords: 'legal eula agreement',
            onPress: () => openDoc('terms'),
          },
          {
            key: 'about',
            icon: 'wrench',
            label: 'About',
            value: Constants.expoConfig?.version ?? '',
            sub: 'Your words are the record.',
            chevron: false,
            keywords: 'version build number',
          },
        ],
      },
      // ACCOUNT — the destructive zone, in order of how much it costs: a cache
      // that rebuilds itself, then the two that cannot be undone. Every one of
      // them is real (PLAN D1).
      {
        key: 'account',
        label: 'Account',
        footnote: accountMessage ?? undefined,
        footnoteActive: accountMessage != null,
        rows: [
          {
            key: 'cache',
            icon: 'refresh',
            label: 'Clear local cache',
            warn: true,
            sub: 'Reads your notes again. Nothing you wrote is deleted.',
            chevron: false,
            keywords: 'reset reparse rebuild readings stale',
            disabled: busy !== null,
            onPress: handleClearCache,
          },
          {
            key: 'delete',
            icon: 'trash',
            label: busy === 'delete' ? 'Deleting…' : 'Delete account',
            danger: true,
            labelBold: true,
            sub: 'Deletes your account and everything in it, here and on the server',
            chevron: false,
            keywords: 'remove erase close wipe',
            disabled: busy !== null,
            onPress: handleDeleteAccount,
          },
          {
            key: 'signout',
            icon: 'sign-out',
            label: busy === 'signout' ? 'Signing out…' : 'Sign out',
            danger: true,
            labelBold: true,
            chevron: false,
            keywords: 'log out logout leave switch account',
            disabled: busy !== null,
            onPress: handleSignOut,
          },
        ],
      },
    ];

    // DEVELOPMENT — one funnel entrance, plus the one billing state that has no
    // other way in until a sandbox subscription can expire
    // (docs/onboarding-v2-spec.md §0, PLAN B4). `__DEV__` compiles the whole
    // thing out of a release build.
    if (__DEV__) {
      out.push({
        key: 'development',
        label: 'Development',
        footnote:
          'The simulation is the real funnel, not a replay: it clears this device’s answers and signs you out. Your training record is not touched.',
        rows: [
          {
            key: 'fresh',
            icon: 'wrench',
            label: 'Simulate a fresh install',
            sub: 'Wipes onboarding and signs out, then walks the funnel: onboarding → paywall → sign-in → Today',
            chevron: false,
            onPress: handleFreshInstall,
          },
          {
            key: 'guard-rejections',
            icon: 'wrench',
            label: 'Guard rejections',
            sub: 'Model answers the brief and prediction guards refused on this device. Zero is the expected reading — anything else means the prompt is inventing facts.',
            value: String(guardRejections),
            warn: guardRejections > 0,
            chevron: false,
          },
          {
            key: 'lapsed',
            icon: 'wrench',
            label: 'Simulate lapsed subscription',
            value: lapsed ? 'On' : 'Off',
            chevron: false,
            onPress: () => {
              tap();
              setDevLapsed(!lapsed);
              setLapsed(!lapsed);
            },
          },
        ],
      });
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // THE COACHING PAIR WAS MISSING FROM THIS LIST (10 September 2026), and it
    // is the second half of the same bug `useFocusEffect` above fixes. Even
    // once the two RPCs were being asked again, the page a person looked at
    // was the memoised one built before the link existed — the state changed
    // and the rows did not. Both halves had to be wrong for the symptom to be
    // "absolutely nothing happens", and both were.
    coach,
    clientCount,
    coachRole,
    roleBusy,
    toggleCoachRole,
    answers,
    prefs,
    recapValue,
    splitValue,
    aliasCount,
    busy,
    lapsed,
    guardRejections,
    dataCaption,
    importMessage,
    exportMessage,
    subscriptionValue,
    subscriptionSub,
    subscriptionMessage,
    supportMessage,
    accountMessage,
  ]);

  const searching = query.trim().length > 0;

  /**
   * The filtered page. A group survives if any of its rows does, and it keeps
   * its label so a result still says WHERE it lives — "Bar weight" alone is a
   * row without an address. The footnotes go: they are prose about a whole
   * group, and a group of one matching row is not that group.
   */
  const shown = useMemo<SectionSpec[]>(() => {
    if (!searching) return sections;
    return sections
      .map((s) => ({
        ...s,
        footnote: undefined,
        footnoteActive: false,
        rows: s.rows.filter((r) => matchesQuery(r, s.label, query)),
      }))
      .filter((s) => s.rows.length > 0);
  }, [sections, query, searching]);

  /**
   * The header's options, built ONCE. `setQuery` is stable, so nothing here
   * changes between renders — which matters: these cross to native every time
   * the object identity does, and rebuilding a `UISearchController`'s
   * configuration on every keystroke is how a search field starts dropping
   * characters.
   */
  const clearQuery = useCallback(() => setQuery(''), []);
  const searchOptions = useMemo(
    () => ({
      placeholder: 'Search settings',
      autoCapitalize: 'none' as const,
      // VISIBLE AT REST, like Settings' own — not hidden until you pull down.
      // The default hides it, which is right for a list you mostly read (Mail,
      // Photos) and wrong for one you arrive at with an errand: a person who
      // opens this tab to change the rest timer should not have to discover a
      // gesture first. It costs one row of height and removes the discovery.
      hideWhenScrolling: false,
      onChangeText: (e: { nativeEvent: { text: string } }) => setQuery(e.nativeEvent.text),
      onCancelButtonPress: clearQuery,
      onClose: clearQuery,
    }),
    [clearQuery],
  );

  const groups = shown.map((s) => (
    <Section key={s.key} label={s.label} footnote={s.footnote} footnoteActive={s.footnoteActive}>
      {s.rows.map((r, i) => (
        <Row
          key={r.key}
          icon={r.icon}
          label={r.label}
          sub={r.sub}
          value={r.value}
          reading={r.reading}
          labelBold={r.labelBold}
          danger={r.danger}
          warn={r.warn}
          chevron={r.chevron}
          external={r.external}
          disabled={r.disabled}
          toggle={r.toggle}
          divider={i > 0}
          onPress={r.onPress}
        />
      ))}
    </Section>
  ));

  return (
    <>
      <Stack.Screen
        options={{
          title: 'You',
          headerLargeTitle: true,
          headerSearchBarOptions: searchOptions,
        }}
      />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT, and that is load-bearing rather
          than tidy — `_layout.tsx` explains what UIKit does with it and what it
          cannot do without it. `automatic` hands the insets to the system: the
          large title's height, the search field's, the safe area and the tab
          bar are all UIKit's arithmetic now, not ours. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        // The one input on this page is the inline rename in the identity block.
        // Scrolling puts its keyboard away the iOS way — following the finger
        // down rather than snapping shut — and the field commits on blur, so a
        // scroll IS a way to finish typing rather than a way to lose it.
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        {/* THE HERO, and it steps aside during a search: results are the whole
            screen while a query is live, which is what Settings does. */}
        {searching ? null : (
          <>
            <Identity sub={record ? `Logging since ${record.since}` : undefined} />
            {/* THE CAREER NUMBERS. Absent entirely on an empty account: three
                zeros is noise, and §1.1 invariant 6 says say nothing instead of
                saying zero. */}
            {record ? (
              <View style={styles.recordSection}>
                <RecordStrip
                  stats={[
                    { value: String(record.days), label: 'Sessions' },
                    { value: String(record.sets), label: 'Sets' },
                    { value: compactKg(record.volume), label: 'Kg lifted' },
                  ]}
                />
              </View>
            ) : null}
          </>
        )}

        {/* The entrance staggers on arrival and NOT on every keystroke: a list
            that re-animates as it filters is a list you cannot read while you
            type. */}
        {searching ? (
          groups
        ) : (
          <Stagger step={55} initialDelay={80}>
            {groups}
          </Stagger>
        )}

        {searching && shown.length === 0 ? (
          <Text style={styles.empty} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Nothing here matches “{query.trim()}”.
          </Text>
        ) : null}
      </ScrollView>

      {/* THE "About you" PICKERS. Mounted here rather than per row: a sheet is
          a native modal, and six of them stacked in a list would be six
          presentation contexts fighting for one slot. */}
      <AnswerSheet
        id={editing}
        visible={answerOpen}
        onClose={() => setAnswerOpen(false)}
        onChange={noteAnswerChanged}
      />
      <LiftsSheet
        visible={liftsOpen}
        onClose={() => setLiftsOpen(false)}
        onChange={noteAnswerChanged}
      />
      <ObstaclesSheet
        visible={obstaclesOpen}
        onClose={() => setObstaclesOpen(false)}
        onChange={noteAnswerChanged}
      />

      {/* THE SETTINGS PICKERS, on the same terms: one sheet driven by an id for
          the four single-choice prefs, and the recap's own — it carries a
          second control and a permission request, so it closes on Done rather
          than on the tap. */}
      <PrefSheet
        id={prefEditing}
        visible={prefOpen}
        onClose={() => setPrefOpen(false)}
        onChange={noteSettingChanged}
      />
      <RecapSheet
        visible={recapOpen}
        onClose={() => setRecapOpen(false)}
        onChange={noteSettingChanged}
        userId={userId}
      />
    </>
  );
}

// --- building blocks ---------------------------------------------------------
// The grouped-card vocabulary (Section / Row / AccordionRow / Segmented) lives
// in `components/settings-rows.tsx`. What is left here is what only THIS screen
// draws.

/** The day the record starts, as a person would say it. Day and month; the
 * year only when it is not this one, because "4 March" is how somebody refers
 * to this year and "4 March 2025" is how they refer to any other. The picking
 * and the matching both live in `lib/settings-search.ts`, where they can be
 * tested without a renderer. */
function earliest(days: ReadonlySet<string>): string {
  const min = firstLoggedDay(days);
  if (min === null) return '';
  const [y, m, d] = min.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const sameYear = y === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** A lifetime tonnage runs into the millions; seven grouped digits would set
 * the whole strip's type size by its longest member. Past a million it reads
 * "1.2M kg" — still specific (§15), and it stops the column shrinking. */
function compactKg(kg: number): string {
  return kg >= 1_000_000 ? `${(kg / 1_000_000).toFixed(1)}M` : groupThousands(kg);
}

/**
 * ONE GUTTER, AND EVERYTHING HANGS OFF IT (28 August 2026).
 *
 * The page had two left edges: cards at `spacing.lg` and the title, the group
 * labels and the footnotes 4 pt further in, because each of those carried its
 * own `spacing.xs` nudge. Four points is small enough to look like a rendering
 * artefact and large enough to see, which is the worst size a misalignment can
 * be. There is one number — the ScrollView's own horizontal padding — and
 * nothing adds to it. The system's large title hangs off the same edge.
 */
const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND (9 September 2026).
   *
   * `PaperField` cannot draw it on this screen. Hoisted beside the navigator it
   * is painted over by the navigator's opaque container view and the tab reads
   * flat neutral grey; brought back in as a sibling of this scroll view it
   * costs UIKit the scroll view it tracks, and the large title stops
   * collapsing. Both were measured — the account is in `../next/_layout.tsx`.
   * A background on the scroll view itself is neither, and it is the same three
   * stops, derived from them.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  content: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract (§5.2), and the last row clears it by hand.
    paddingBottom: spacing.xxl + TAB_BAR_CLEARANCE,
  },
  /** The same trailing gap a `Section` leaves, so the record reads as a group. */
  recordSection: {
    marginBottom: spacing.xxl,
  },
  empty: {
    ...type.subhead,
    color: color.textSecondary,
    paddingTop: spacing.xxl,
    textAlign: 'center',
  },
});
