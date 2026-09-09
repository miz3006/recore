import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stagger } from '@/components/motion';
import { PaperField } from '@/components/paper-field';
import { EDGE_FADE, ScrollEdgeHeader } from '@/components/scroll-edge';
import { AnswerSheet } from '@/components/profile/answer-sheet';
import { Identity } from '@/components/profile/identity';
import { LiftsSheet } from '@/components/profile/lifts-sheet';
import { ObstaclesSheet } from '@/components/profile/obstacles-sheet';
import { PrefSheet, prefLabel, type PrefId } from '@/components/profile/pref-sheet';
import { RecapSheet, recapRowValue } from '@/components/profile/recap-sheet';
import { StatCard } from '@/components/profile/stat-card';
import { Row, Section } from '@/components/settings-rows';
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
import { getLoggedDayKeys } from '@/lib/db/workouts';
import { markImported } from '@/lib/funnel';
import {
  keyLiftsLabel,
  labelFor,
  obstaclesLabel,
  obstaclesSub,
  type AnswerId,
} from '@/lib/profile-answers';
import { seedV2FromRecord } from '@/lib/onboarding-v2-seed';
import { simulateFreshInstall } from '@/lib/dev-fresh-install';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import type { LegalDocId } from '@/lib/legal';
import { groupThousands } from '@/lib/parse/estimate';
import { canRateApp, rateApp } from '@/lib/review';
import { scheduleSync } from '@/lib/sync/index';
import { color, MAX_FONT_SCALE, spacing, TAB_BAR_CLEARANCE, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * You (CLAUDE.md §5.1 — "Change something."), the fourth tab: a proper
 * profile-and-settings screen (Mobbin-referenced: a clean identity header over
 * grouped rows, à la ChatGPT / Viator). NOT a bottom sheet, and no back chevron
 * — it is a tab root, opened rarely, and §5.1 says that is fine.
 *
 * The training prefs (focus / language / plate / bar) read as calm value rows
 * that expand INLINE to a segmented editor on tap — the app has no detail
 * screens to push to, and a wall of always-open segmented controls read like a
 * form, not settings. Every real handler is preserved: identity + sign out,
 * subscription (paywall / manage / restore), parsing privacy, the editable
 * training prefs (feeding roundToPlate and the parser's language), and the
 * free-forever CSV export/import. Nothing is paywalled; account actions never
 * touch history.
 */

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Measured, not guessed: the safe area is what the bare scroll edge occupies.
  const [headerH, setHeaderH] = useState(0);
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  // Bumped by every landed correction — the shorthand count follows it.
  const fixRevision = useSession((s) => s.fixRevision);
  const [busy, setBusy] = useState<null | 'import' | 'signout' | 'delete' | 'restore'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [lapsed, setLapsed] = useState<boolean>(() => isDevLapsed());
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
    return { days: days.size, sets: totals.sets, volume: totals.volume };
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
      bar: prefLabel('bar'),
      language: prefLabel('language'),
      setreadings: prefLabel('setreadings'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settingsRevision],
  );

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
      if (outcome.status === 'failed') {
        setImportMessage('Import failed — export a fresh CSV and try again.');
        return;
      }

      hydrate(userId); // streak, calendar dots, today's view
      scheduleSync();
      // The split that divides every trial-window number (§2.1, PLAN D4).
      if (outcome.importedDays > 0) markImported();
      setImportMessage(
        outcome.importedDays > 0
          ? `Imported ${outcome.importedDays} workouts (${outcome.sets} sets)` +
              (outcome.skippedDays > 0 ? ` · ${outcome.skippedDays} days already logged` : '')
          : 'Nothing new to import — those days are already logged.',
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
   * The message is the honest one — the record is on the device and on the
   * server, and signing out is not deletion. It does not try to talk anybody
   * out of it (§20: never harder to leave than to arrive).
   */
  const handleSignOut = () => {
    if (busy) return;
    tap();
    Alert.alert(
      'Sign out?',
      'Your training stays on this device and on the server. You will need to sign in again to reach it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void runSignOut() },
      ],
    );
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
   * "Restart onboarding" replays THE FLOW A NEW PERSON MEETS — v2 since 28
   * August 2026. It used to open the illustrated v1 flow, which would now show
   * a returning user a funnel the app no longer uses and re-write their
   * preferences in the older vocabulary on the way out.
   *
   * The previous answers are kept rather than cleared, so the run opens with
   * their own choices already ticked; finishing it commits again through the
   * same single commit point. It is a real run, so it carries no `dev` flag —
   * the development rows in the section below are the sandboxed way in.
   */
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
   *
   * The navigation is a belt-and-braces `replace`, not the thing that makes it
   * work: `simulateFreshInstall` ends by dropping the session, which closes
   * `_layout.tsx`'s guard and leaves the dispatcher — with no onboarding flag
   * and no session — sending us to screen 1 on its own. Being explicit costs
   * nothing and removes a frame of whatever the fallback would have been.
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
    // The customer-specific URL when the store has one, Apple's generic
    // subscriptions page otherwise. Never a dead control (§2).
    // Customer Center where the build has it, Apple's subscriptions page
    // otherwise. One entry point, so all three surfaces stay identical.
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
      'This deletes your account and every note, session and plan in it, on this phone and on the server. It cannot be undone.\n\nExport everything from Your data first if you want to keep it.',
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

  return (
    <View style={styles.root}>
      {/* The canvas — the same field every other screen draws (skill §Canvas:
          one canvas runs the whole app). It is an `absoluteFill` and therefore
          anchored to the VIEWPORT, not to the scroll: the peach corner stays put
          while the list travels through it, which is what makes it a page rather
          than wallpaper on the content. */}
      <PaperField />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            // The title is the first thing IN the list now, so the edge above it
            // carries no row — but it still carries the FADE, or rows would run
            // under the clock and the Dynamic Island untreated. Content starts
            // below the gradient, never under it (§ScrollEdge).
            paddingTop: headerH + EDGE_FADE,
            // Content scrolls *behind* the tab bar (§5.2 — glass needs something
            // to refract), so the last row clears it with padding, not an inset.
            paddingBottom: insets.bottom + spacing.xxl + TAB_BAR_CLEARANCE,
          },
        ]}
        // The list is the FIRST view in the controller, so UIKit would helpfully
        // add its own safe-area inset on top of the one applied above. The
        // arithmetic is ours and it is done once.
        contentInsetAdjustmentBehavior="never"
        // The one input left on this page is the inline rename in the identity
        // block. Scrolling puts its keyboard away the iOS way — following the
        // finger down rather than snapping shut — and the field commits on blur,
        // so a scroll IS a way to finish typing rather than a way to lose it.
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <Stagger step={55} initialDelay={80}>
        {/* THE PAGE TITLE — large, left, and it SCROLLS AWAY (Pin Trading,
            `6751493504/oth_hirl5`).

            It used to be a fixed `ScrollEdgeHeader` that the list ran under and
            faded into. That chrome earns its keep on Today, where a person is
            writing and the header has to stay reachable; on a page that is read
            top to bottom and left alone, a permanent 34 pt title is a permanent
            tax on the first screenful. Both references put the title in the
            content and let it go.

            ONE HEADER, NO ICONS. No gear (everything settings-shaped is already
            a row below), no crown (the subscription is a row in Account, never a
            banner — that is the Pin Trading pattern this app rejects), and no
            second anything. */}
        <Text
          style={styles.pageTitle}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Profile
        </Text>

        <Identity />

        {/* THE CAREER NUMBERS. Absent entirely on an empty account: three zeros
            over an empty card is noise, and §1.1 invariant 6 says say nothing
            instead of saying zero. */}
        {record ? (
          <View style={styles.statSection}>
            <StatCard
              stats={[
                { value: String(record.days), label: 'Sessions' },
                { value: String(record.sets), label: 'Sets' },
                { value: compactKg(record.volume), label: 'Kg lifted' },
              ]}
            />
          </View>
        ) : null}

        {/* ABOUT YOU — the onboarding answers, and the POINT of the section is
            that none of them is locked once the flow closes. Every row opens the
            same picker the flow asked the question on (`profile/answer-sheet`),
            so the wording, the order and the opt-out demotion are the flow's own
            and cannot drift from it.

            The answers themselves live in `lib/profile-answers.ts` rather than in
            v2's in-memory store, which by design forgets everything when the app
            is killed. See that file for why, and for the v1 keys each write
            mirrors so the prediction engine never reads a stale goal. */}
        <Section
          label="About you"
          footnote="Everything you answered when you set Recore up. Change any of it whenever it changes.">
          <Row
            icon="crosshair"
            label="Goal"
            value={answers.goal}
            onPress={() => openAnswer('goal')}
          />
          <Row
            icon="hourglass"
            label="Training experience"
            value={answers.experience}
            divider
            onPress={() => openAnswer('experience')}
          />
          <Row
            icon="calendar"
            label="Sessions a week"
            value={answers.frequency}
            divider
            onPress={() => openAnswer('frequency')}
          />
          <Row
            icon="layers"
            label="Split"
            value={answers.split}
            divider
            onPress={() => openAnswer('split')}
          />
          <Row
            icon="barbell"
            label="Key lifts"
            value={answers.keyLifts}
            sub="And what you lift now"
            divider
            onPress={() => {
              tap();
              setLiftsOpen(true);
            }}
          />
          {/* WHERE THEY LOG NOW, and WHAT GETS IN THE WAY — screens 2 and 3,
              which the flow has always asked and Profile could not show until
              29 August 2026. The first decides whether the CSV import fast path
              is offered; the second decides which value proposition leads on
              the reveal and on the paywall. Both are answers about the person,
              both change over a year of training, and neither was reachable
              once the flow closed. They sit under the training answers rather
              than in the flow's order, so the thing a person opens this section
              for — their goal — stays at the top of it. */}
          <Row
            icon="document"
            label="Where you log now"
            value={answers.tracker}
            divider
            onPress={() => openAnswer('tracker')}
          />
          <Row
            icon="wrench"
            label="What gets in the way"
            value={answers.obstacles}
            sub={answers.obstaclesSub}
            divider
            onPress={() => {
              tap();
              setObstaclesOpen(true);
            }}
          />

          {/* THE WHOLE FLOW AGAIN, under the answers it rewrites. It sat in
              Support until 28 August 2026, between the privacy policy and the
              build number, which is a filing cabinet for things nobody expects
              to change anything — and this row rewrites every value above it.
              A real run, not the sandboxed replay in Development: it opens with
              the previous answers already ticked and commits through the same
              single commit point when it finishes. */}
          <Row
            icon="refresh"
            label="Run setup again"
            sub="Replays the questions from the start, with your answers already ticked"
            divider
            onPress={handleReplaySetup}
          />
        </Section>


        {/* SUBSCRIPTION — the store's own state, and three real actions. The
            footnote doubles as the result line for Restore, the way "Your
            record" does for import/export.

            IT NEVER ASSERTS A DATE IT WAS NOT TOLD. `subscriptionSub` is built
            from the store's own clock and is undefined when the store has not
            answered, so this card can say "Active · renews 30 Aug" only when
            RevenueCat said so (§2 rule 5). A hardcoded renewal date would be
            the exact billing claim the invariant forbids. */}
        <Section
          label="Subscription"
          footnote={subscriptionMessage ?? 'Managed by your Apple Account. Cancel any time.'}
          footnoteActive={subscriptionMessage != null}>
          <Row
            icon="sparkle"
            label="Recore Pro"
            value={subscriptionValue}
            sub={subscriptionSub}
            onPress={() => {
              tap();
              router.push('/paywall-v2/plan');
            }}
          />
          <Row icon="card" label="Manage subscription" external divider onPress={handleManage} />
          <Row
            icon="refresh"
            label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            divider
            disabled={busy !== null}
            onPress={() => void handleRestore()}
          />
        </Section>

        {/* TRAINING — the settings that change how a SESSION works, and NOT
            one of them is an onboarding answer. The v2 flow writes and shows
            kilograms, takes the writing language from the locale and states a
            20 kg Olympic bar as an assumption rather than a question
            (`flow.ts`), so these belong here and not in "About you" above.
            They are still real settings with live readers — `bottom-toolbar`
            starts the timer from the rest pref, `ghost-prediction` racks a
            prediction with the bar — which is why they stay on this screen.

            THEY OPEN SHEETS NOW (28 August 2026). Every one of these used to
            expand inline into a segmented control, so Profile had two ways to
            change a value: the flow's picker for the onboarding answers, and a
            different control with a different gesture for everything else. One
            screen, one vocabulary — `profile/pref-sheet`.

            The USUAL-WEEK row went with the accordions, and did not come back:
            `pref_usual_days` is a v1 onboarding question (the v2 flow asks how
            many sessions a week, which is the "Sessions a week" row above) and
            grep says NOTHING in the app reads it. A row that writes a value no
            code consumes is a setting that does nothing. The days a person
            actually trains on are named in the split — the "Session types" row
            below. */}
        <Section
          label="Training"
          footnote="Predictions round to what your gym’s bar can actually hold.">
          <Row icon="plate" label="Units" value={prefs.unit} onPress={() => openPref('unit')} />
          <Row
            icon="timer"
            label="Rest timer default"
            value={prefs.rest}
            reading
            divider
            onPress={() => openPref('rest')}
          />
          <Row
            icon="barbell"
            label="Bar weight"
            value={prefs.bar}
            reading
            divider
            onPress={() => openPref('bar')}
          />
          {/* The §12.1 weekly recap — the one recurring notification that
              exists. It lives here rather than in a Notifications card of its
              own: it is a training habit, and one row does not need a section.
              The value names the DAY as well as the hour, because the flow
              asks for the day and the scheduler honours it. */}
          <Row
            icon="bell"
            label="Weekly recap"
            value={recapValue}
            reading={recapValue !== 'Off'}
            sub="One short read on your week"
            divider
            onPress={() => {
              tap();
              setRecapOpen(true);
            }}
          />
        </Section>

        {/* YOUR RECORD — the four doors to the record itself: what a session is
            called, what Recore has learned to read, and the two ways the whole
            thing moves in or out. */}
        <Section
          label="Your record"
          footnote={dataCaption}
          footnoteActive={importMessage != null || exportMessage != null}>
          {/* Session types = the split's own days, which is where they are
              named, renamed and deleted (`/split` → `/plan-day`). There is no
              separate rename sheet to reuse — see the note in the change log:
              MERGING two day types does not exist anywhere yet, so nothing
              here pretends it does. */}
          <Row
            icon="calendar"
            label="Session types"
            value={splitValue}
            sub="Name the days you train"
            onPress={() => {
              tap();
              router.push('/split');
            }}
          />
          <Row
            icon="wrench"
            label="Reading corrections"
            value={aliasCount === 1 ? '1 shorthand' : `${aliasCount} shorthands`}
            sub="What Recore has learned to read"
            divider
            onPress={() => {
              tap();
              router.push('/aliases');
            }}
          />
          <Row
            icon="upload"
            label={busy === 'import' ? 'Importing…' : 'Import from Strong or Hevy'}
            divider
            disabled={busy !== null}
            onPress={() => void handleImport()}
          />
          <Row
            icon="download"
            label="Export my record"
            sub="Your sessions, including the words you wrote"
            divider
            onPress={handleExportChoice}
          />
        </Section>

        {/* INTEGRATIONS — one row, and it opens an honest "not connected".
            A switch here would be a promise the app cannot keep: there is no
            HealthKit code in the project (see `app/health.tsx`). */}
        <Section label="Integrations">
          <Row
            icon="target"
            label="Apple Health"
            value="Not connected"
            sub="Recore does not read or write Health data"
            onPress={() => {
              tap();
              router.push('/health');
            }}
          />
        </Section>

        {/* PREFERENCES — how Recore reads what you write, and how it prints it
            back. Neither is an answer about the person and neither is asked by
            the v2 flow, which is exactly why they are one group.

            The writing language sat in Training only because it had live
            readers (`brief-explain`, `empty-note-cards`) and nowhere else to
            go; its own note asked for this group to be built. "Set readings"
            was a one-row Display card. Recore already follows the system text
            size — this is for the person who wants their sets bigger HERE
            without enlarging every app on their phone, and it changes the
            ledger the moment it is tapped. */}
        <Section
          label="Preferences"
          footnote="Recore already follows your iPhone’s text size. Set readings makes the sets larger on their own.">
          <Row
            icon="language"
            label="Writing language"
            value={prefs.language}
            onPress={() => openPref('language')}
          />
          <Row
            icon="table"
            label="Set readings"
            value={prefs.setreadings}
            divider
            onPress={() => openPref('setreadings')}
          />
        </Section>

        {/* SUPPORT — a real mailbox, the store listing, and what this build
            is. The credo is the one line of belief the app is allowed: it is
            not a claim about the product, it is the rule the code follows. */}
        <Section
          label="Support"
          footnote={supportMessage ?? undefined}
          footnoteActive={supportMessage != null}>
          <Row icon="document" label="Contact support" onPress={() => void handleContact()} />
          {/* Not the §16.3 prompt: a labelled thing the user chose to tap. It
              spends none of the three system asks unless iOS actually draws
              the sheet, and the row is absent when there is no door at all. */}
          {canRateApp() ? (
            <Row icon="star" label="Rate Recore" external divider onPress={() => void handleRate()} />
          ) : null}
          <Row icon="sparkle" label="How parsing works" divider onPress={() => openDoc('parsing')} />
          <Row icon="lock" label="Privacy Policy" divider onPress={() => openDoc('privacy')} />
          <Row icon="document" label="Terms of Use" divider onPress={() => openDoc('terms')} />
          <Row
            icon="wrench"
            label="About"
            value={Constants.expoConfig?.version ?? ''}
            sub="Your words are the record."
            chevron={false}
            divider
          />
        </Section>

        {/* ACCOUNT — the destructive zone, in order of how much it costs:
            a cache that rebuilds itself, then the two that cannot be undone.
            Every one of them is real (PLAN D1). */}
        <Section
          label="Account"
          footnote={accountMessage ?? undefined}
          footnoteActive={accountMessage != null}>
          <Row
            icon="refresh"
            label="Clear local cache"
            warn
            sub="Reads your notes again. Nothing you wrote is deleted."
            chevron={false}
            disabled={busy !== null}
            onPress={handleClearCache}
          />
          <Row
            icon="trash"
            label={busy === 'delete' ? 'Deleting…' : 'Delete account'}
            danger
            labelBold
            sub="Deletes your account and everything in it, here and on the server"
            chevron={false}
            divider
            disabled={busy !== null}
            onPress={handleDeleteAccount}
          />
          <Row
            icon="sign-out"
            label={busy === 'signout' ? 'Signing out…' : 'Sign out'}
            danger
            labelBold
            chevron={false}
            divider
            disabled={busy !== null}
            onPress={handleSignOut}
          />
        </Section>

        {/* DEVELOPMENT — ONE funnel entrance, plus the one billing state that
            has no other way in until a sandbox subscription can expire
            (docs/onboarding-v2-spec.md §0, PLAN B4). `__DEV__` compiles the
            whole thing out of a release build; to expose it in TestFlight,
            change this one condition.

            IT WAS FIVE ROWS UNTIL 31 AUGUST 2026 (owner's ask): run v2
            sandboxed, run the illustrated v1 flow, reset the sandbox, open the
            v1 paywall, and the lapsed toggle. The first four each simulated a
            PIECE of the funnel and none of them could reach the joins between
            the pieces, which is the part that actually breaks. The sandboxed v2
            row could not even get to the paywall, because a run that commits
            nothing never satisfies the dispatcher.

            One row replaces the four, and it is NOT sandboxed on purpose: it
            wipes the device, drops the session, and walks the real thing —
            onboarding → paywall → sign-in → Today. `lib/dev-fresh-install.ts`
            says what it clears and what it refuses to.

            THIS LEAVES TWO SCREENS WITHOUT A DOOR: the illustrated funnel at
            `src/app/onboarding/` and the v1 paywall at `src/app/paywall.tsx`.
            Both still exist, still work and are still registered in
            `app/_layout.tsx`; nothing was deleted. Their only entrance was the
            two rows removed here, so they are now reachable by typing the route
            and no other way. CLAUDE.md still describes them as reachable from
            these development rows — that line is now stale and is the owner's
            to rule on (§8), not this change's to rewrite. */}
        {__DEV__ ? (
          <Section
            label="Development"
            footnote="The simulation is the real funnel, not a replay: it clears this device's answers and signs you out. Your training record is not touched.">
            <Row
              icon="wrench"
              label="Simulate a fresh install"
              sub="Wipes onboarding and signs out, then walks the funnel: onboarding → paywall → sign-in → Today"
              chevron={false}
              onPress={handleFreshInstall}
            />
            <Row
              icon="wrench"
              label="Simulate lapsed subscription"
              value={lapsed ? 'On' : 'Off'}
              chevron={false}
              divider
              onPress={() => {
                tap();
                setDevLapsed(!lapsed);
                setLapsed(!lapsed);
              }}
            />
          </Section>
        ) : null}

        {/* The version used to sit loose at the foot of the screen. It is a
            fact about this build, so it moved onto the About row where the
            rest of them are — one place, not two. */}
        </Stagger>
      </ScrollView>

      {/* The scroll edge, with nothing pinned in it: this page's title is
          content and scrolls away, but the top of the list still has to fade
          into the canvas rather than run under the status bar. */}
      <ScrollEdgeHeader onHeight={setHeaderH} />

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
    </View>
  );
}

// --- building blocks ---------------------------------------------------------
// The grouped-card vocabulary (Section / Row / AccordionRow / Segmented) moved
// to `components/settings-rows.tsx` on 12 Aug 2026, when a second settings
// surface needed it. What is left here is what only THIS screen draws.

/** A lifetime tonnage runs into the millions; seven grouped digits would set
 * the whole strip's type size by its longest member. Past a million it reads
 * "1.2M kg" — still specific (§15), and it stops the row shrinking. */
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
 * be. There is now one number — the ScrollView's own horizontal padding — and
 * nothing adds to it. `settings-rows.tsx` lost the matching nudges in the same
 * change, so every settings-shaped surface in the app lines up the same way.
 */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  /**
   * The page title. `largeTitle` (34), not `title2` (22): both references lead
   * with a title that is unmistakably the biggest thing on the screen, and this
   * one has no navigation bar left to share the row with.
   */
  pageTitle: {
    ...type.largeTitle,
    color: color.textPrimary,
  },
  /** The same trailing gap a `Section` leaves, so the stat card is a group. */
  statSection: {
    marginBottom: spacing.xxl,
  },
});
