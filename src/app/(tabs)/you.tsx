import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HistorySheet } from '@/components/history-sheet';
import { Icon } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { AccordionRow, Row, Section, Segmented } from '@/components/settings-rows';
import { EDGE_FADE, ScrollEdgeHeader } from '@/components/scroll-edge';
import { listAliasOverrides } from '@/lib/db/alias-overrides';
import { listPlanDays } from '@/lib/db/plan';
import { clearParseCache } from '@/lib/db/cache';
import { contactSupport, SUPPORT_EMAIL } from '@/lib/support';
import { buildActivityGrid, type GridWeek } from '@/lib/activity';
import { deleteAccount } from '@/lib/account/delete';
import { useAuth } from '@/lib/auth/provider';
import { signOut } from '@/lib/auth/sign-in';
import {
  getPriceLabel,
  getTrialClock,
  isDevLapsed,
  restore,
  setDevLapsed,
  useEntitlementDecision,
} from '@/lib/billing/state';
import { managementUrl } from '@/lib/billing/store';
import { formatChargeDate } from '@/lib/billing/trial';
import { buildWorkoutsCsv } from '@/lib/export-csv';
import { buildExportJson } from '@/lib/export-json';
import { shareExportFile } from '@/lib/export-share';
import { todayKey } from '@/lib/db/dates';
import { getProfileTotals } from '@/lib/db/insights';
import { computeStreak, getLoggedDayKeys } from '@/lib/db/workouts';
import { markImported } from '@/lib/funnel';
import { useOnboardingAnswers } from '@/state/onboarding';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import type { LegalDocId } from '@/lib/legal';
import { groupThousands } from '@/lib/parse/estimate';
import { fmtNumber } from '@/lib/parse/summarize';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import { disableRecap, enableRecap, refreshRecapNotification } from '@/lib/recap';
import { canRateApp, rateApp } from '@/lib/review';
import {
  DAY_LABELS,
  daysLabel,
  formatBodyWeight,
  hasDay,
  parseBodyHeight,
  parseBodyWeight,
  toggleDay,
  type Experience,
  type SessionFeel,
  type TrainingStyle,
} from '@/lib/onboarding';
import {
  getBarWeightKg,
  getBodyHeightCm,
  getBodyWeightKg,
  getExperience,
  getGoal,
  getObLanguage,
  getRecapHour,
  getRestSeconds,
  getSessionFeel,
  getSmallestPlateKg,
  getTrainingStyle,
  getUsualDays,
  getWeightUnit,
  isRecapEnabled,
  setBarWeightKg,
  setBodyHeightCm,
  setBodyWeightKg,
  setExperience,
  setGoal,
  setObLanguage,
  setRecapHour,
  setRestSeconds,
  setSessionFeel,
  setSmallestPlateKg,
  REST_OPTIONS_S,
  setTrainingStyle,
  setUsualDays,
  setWeightUnit,
  type Goal,
  type ObLanguage,
  type WeightUnit,
} from '@/lib/prefs';
import { scheduleSync } from '@/lib/sync/index';
import {
  color,
  FIXED_FONT_SCALE,
  fonts,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
import { useDisplay } from '@/state/display';
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

// Android needs this opt-in for LayoutAnimation (the accordion's soft expand).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * §5's five focus answers, all editable here — "all answers are editable in You
 * after account creation". Three of them reach the prediction engine through
 * `focusForGoal`; the other two change wording only.
 */
const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'sport', label: 'Sport' },
  { id: 'both', label: 'Mixed' },
];

const EXPERIENCE_OPTIONS: { id: Experience; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'building', label: 'Building' },
  { id: 'experienced', label: 'Experienced' },
];

const STYLE_OPTIONS: { id: TrainingStyle; label: string }[] = [
  { id: 'gym', label: 'Gym' },
  { id: 'sport', label: 'Sport' },
  { id: 'hybrid', label: 'Both' },
];

const FEEL_OPTIONS: { id: SessionFeel; label: string }[] = [
  { id: 'structured', label: 'Structured' },
  { id: 'flexible', label: 'Flexible' },
  { id: 'sportLed', label: 'Sport-led' },
  { id: 'hybrid', label: 'Mixed' },
];

const UNIT_OPTIONS: { id: WeightUnit; label: string }[] = [
  { id: 'kg', label: 'kg' },
  { id: 'lb', label: 'lb' },
];

/** OB_04's writing languages — wired to the real parser-language pref. */
const LANGUAGE_OPTIONS: { id: ObLanguage; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'slo', label: 'Slovenščina' },
  { id: 'both', label: 'Both' },
];

/** Same options onboarding offers — one source of plate truth for the picker. */
const PLATE_OPTIONS = [0.5, 1.25, 2.5] as const;
const PLATE_SEG: { id: number; label: string }[] = PLATE_OPTIONS.map((p) => ({ id: p, label: fmtNumber(p) }));

/** Olympic 20 or the common 15 — feeds the checklist's plate math. */
const BAR_OPTIONS = [15, 20] as const;
const BAR_SEG: { id: number; label: string }[] = BAR_OPTIONS.map((b) => ({ id: b, label: `${b}` }));

/** The §12.1 recap's editable hour — Sunday, one of four sensible slots. */
const RECAP_HOUR_SEG: { id: number; label: string }[] = [8, 12, 18, 20].map((h) => ({
  id: h,
  label: `${String(h).padStart(2, '0')}:00`,
}));

const RECAP_TOGGLE: { id: 'off' | 'on'; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'on', label: 'On' },
];

/** How the ledger prints a set: aligned columns, or one spelled-out line each
 * at accessibility size. The names describe the RESULT, not a font size. */
const SET_READING_SEG: { id: 'standard' | 'large'; label: string }[] = [
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Larger' },
];

/** Rest-timer lengths, as the settings picker shows them ("1:30"). */
const REST_SEG: { id: number; label: string }[] = REST_OPTIONS_S.map((s) => ({
  id: s,
  label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
}));

type Expand =
  | 'focus'
  | 'experience'
  | 'style'
  | 'feel'
  | 'days'
  | 'unit'
  | 'rest'
  | 'language'
  | 'body'
  | 'plate'
  | 'bar'
  | 'setreadings'
  | 'recap'
  | null;

/** "Jan Kovač" → "JK"; else the email's initial; else a bare mark. */
function initialsOf(name: string | null, email: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const a = parts[0]?.[0] ?? '';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    const out = (a + b).toUpperCase();
    if (out) return out;
  }
  return email ? email[0]!.toUpperCase() : '—';
}

const labelOf = <T,>(options: { id: T; label: string }[], id: T | null): string =>
  options.find((o) => o.id === id)?.label ?? 'Not set';

/** The stored metric weight as bare text in the DISPLAY unit — what the body
 * field edits. Empty when nothing is stored. */
const weightTextOf = (kg: number | null, unit: WeightUnit): string =>
  kg == null ? '' : (formatBodyWeight(kg, unit)?.split(' ')[0] ?? '');

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Measured, not guessed: the title row grows with Dynamic Type.
  const [headerH, setHeaderH] = useState(0);
  const { session } = useAuth();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  // Bumped by every landed correction — the shorthand count follows it.
  const fixRevision = useSession((s) => s.fixRevision);
  const [busy, setBusy] = useState<null | 'import' | 'signout' | 'delete' | 'restore'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [goal, setGoalState] = useState<Goal | null>(() => getGoal());
  const [language, setLanguageState] = useState<ObLanguage | null>(() => getObLanguage());
  const [plate, setPlateState] = useState<number | null>(() => getSmallestPlateKg());
  const [bar, setBarState] = useState<number>(() => getBarWeightKg());
  // §5's answers, all editable here — body context included (§11).
  const [experience, setExperienceState] = useState<Experience | null>(() => getExperience());
  const [style, setStyleState] = useState<TrainingStyle | null>(() => getTrainingStyle());
  const [feel, setFeelState] = useState<SessionFeel | null>(() => getSessionFeel());
  const [days, setDaysState] = useState<number>(() => getUsualDays());
  const [unit, setUnitState] = useState<WeightUnit>(() => getWeightUnit() ?? 'kg');
  // Body context, editable in place (§11: every onboarding answer stays
  // editable). The texts are what the fields show; the numbers are what is
  // stored — a field only writes when its text parses, and an emptied field
  // is a real answer that clears the value.
  const [bodyWeightKg, setBodyWeightKgState] = useState<number | null>(() => getBodyWeightKg());
  const [bodyHeightCm, setBodyHeightCmState] = useState<number | null>(() => getBodyHeightCm());
  const [weightText, setWeightText] = useState<string>(() =>
    weightTextOf(getBodyWeightKg(), getWeightUnit() ?? 'kg'),
  );
  const [heightText, setHeightText] = useState<string>(() => {
    const cm = getBodyHeightCm();
    return cm == null ? '' : String(cm);
  });
  const [expanded, setExpanded] = useState<Expand>(null);
  // Display preference — held in its own live store so the ledger follows the
  // tap immediately (`state/display.ts`), with the value itself in the meta KV.
  const largeSets = useDisplay((s) => s.largeSetReadings);
  const setLargeSets = useDisplay((s) => s.setLargeSetReadings);
  const [lapsed, setLapsed] = useState<boolean>(() => isDevLapsed());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
  // The §12.1 weekly recap — the ONE recurring notification, off by default,
  // off in one tap, its hour user-visible and editable right here.
  const [recapOn, setRecapOnState] = useState<boolean>(() => isRecapEnabled());
  const [recapHour, setRecapHourState] = useState<number>(() => getRecapHour());
  const [recapMessage, setRecapMessage] = useState<string | null>(null);
  const [rest, setRestState] = useState<number>(() => getRestSeconds());
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
    const today = todayKey();
    return {
      days: days.size,
      sets: totals.sets,
      volume: totals.volume,
      streak: computeStreak(userId, today),
      grid: buildActivityGrid(days, today),
    };
  }, [userId]);

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

  // The real account, never a placeholder: name (best-effort) + email + provider.
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const displayName = meta?.full_name ?? meta?.name ?? null;
  const email = session?.user.email ?? null;
  const provider = session?.user.app_metadata.provider;
  const providerLabel = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : null;

  const toggle = (key: Exclude<Expand, null>) => {
    tap();
    LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
    setExpanded((cur) => (cur === key ? null : key));
  };

  const handleBar = (kg: number) => {
    tap();
    setBarWeightKg(kg);
    setBarState(kg);
  };

  /** Writes the pref AND the live copy, so Today's ledger changes behind this
   * screen rather than after a relaunch. */
  const handleSetReadings = (id: 'standard' | 'large') => {
    tap();
    setLargeSets(id === 'large');
  };

  const handleGoal = (g: Goal) => {
    tap();
    setGoal(g);
    setGoalState(g);
  };

  const handleLanguage = (l: ObLanguage) => {
    tap();
    setObLanguage(l);
    setLanguageState(l);
  };

  const handleExperience = (e: Experience) => {
    tap();
    setExperience(e);
    setExperienceState(e);
  };

  const handleStyle = (s: TrainingStyle) => {
    tap();
    setTrainingStyle(s);
    setStyleState(s);
  };

  const handleFeel = (f: SessionFeel) => {
    tap();
    setSessionFeel(f);
    setFeelState(f);
  };

  const handleUnit = (u: WeightUnit) => {
    tap();
    setWeightUnit(u);
    setUnitState(u);
    // The weight field speaks the display unit — re-derive its text from the
    // stored metric value so a unit switch never reinterprets typed digits.
    setWeightText(weightTextOf(getBodyWeightKg(), u));
  };

  /** Write-through body weight: parses in the display unit, stores metric.
   * Empty clears; text that doesn't parse yet just stays on screen. */
  const handleBodyWeightText = (text: string) => {
    setWeightText(text);
    if (text.trim() === '') {
      setBodyWeightKg(null);
      setBodyWeightKgState(null);
      return;
    }
    const kg = parseBodyWeight(text, unit);
    if (kg != null) {
      setBodyWeightKg(kg);
      setBodyWeightKgState(kg);
    }
  };

  const handleBodyHeightText = (text: string) => {
    setHeightText(text);
    if (text.trim() === '') {
      setBodyHeightCm(null);
      setBodyHeightCmState(null);
      return;
    }
    const cm = parseBodyHeight(text, 'cm');
    if (cm != null) {
      setBodyHeightCm(cm);
      setBodyHeightCmState(cm);
    }
  };

  /** On blur a field that never parsed snaps back to what is stored, so the
   * row and its editor cannot disagree about the record. */
  const snapWeightText = () => setWeightText(weightTextOf(getBodyWeightKg(), unit));
  const snapHeightText = () => {
    const cm = getBodyHeightCm();
    setHeightText(cm == null ? '' : String(cm));
  };

  /** The usual week. An expectation, never a target — nothing counts a miss. */
  const handleDay = (index: number) => {
    tap();
    const next = toggleDay(days, index);
    setUsualDays(next);
    setDaysState(next);
  };

  /** On asks the OS in context and only claims On when a notice can actually
   * fire (§2: never a state the app cannot keep). Off cancels the pending one. */
  const handleRecapToggle = async (id: 'off' | 'on') => {
    tap();
    if (!userId) return;
    setRecapMessage(null);
    if (id === 'off') {
      await disableRecap();
      setRecapOnState(false);
      return;
    }
    const ok = await enableRecap(userId);
    setRecapOnState(ok);
    if (!ok) {
      setRecapMessage('Notifications are off for Recore in iOS Settings. Allow them there, then turn this on.');
    }
  };

  const handleRecapHour = (h: number) => {
    tap();
    setRecapHour(h);
    setRecapHourState(h);
    if (userId) void refreshRecapNotification(userId);
  };

  const handlePlate = (kg: number) => {
    tap();
    setSmallestPlateKg(kg);
    setPlateState(kg);
    // The plate shapes every prescribed load (roundToPlate) — rebuild the
    // cached ghost so the change is visible on the very next open.
    if (userId) {
      recachePredictionFromLatest(userId);
      hydrate(userId);
    }
  };

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
   * The rest timer's default length. It was reachable only by LONG-PRESSING
   * the timer chip on Today — a gesture with no label anywhere — so the value
   * most people never discovered they could change now sits where a default
   * belongs. The chip reads the same pref, so the two can never disagree.
   */
  const handleRest = (seconds: number) => {
    tap();
    setRestSeconds(seconds);
    setRestState(seconds);
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

  const handleSignOut = async () => {
    if (busy) return;
    tapMedium();
    setBusy('signout');
    try {
      await signOut(); // the guard swaps back to /sign-in
    } finally {
      setBusy(null);
    }
  };

  const handleReplaySetup = () => {
    tap();
    router.push('/onboarding/1');
  };

  const handleManage = () => {
    tap();
    // The customer-specific URL when the store has one, Apple's generic
    // subscriptions page otherwise. Never a dead control (§2).
    void managementUrl()
      .then((url) => Linking.openURL(url))
      .catch(() => {});
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            // The list runs UNDER the title and fades out into it (§ScrollEdge);
            // its own top padding is what the header measured, plus the fade, so
            // nothing ever rests beneath the gradient.
            paddingTop: headerH + EDGE_FADE,
            // Content scrolls *behind* the tab bar (§5.2 — glass needs something
            // to refract), so the last row clears it with padding, not an inset.
            paddingBottom: insets.bottom + spacing.xxl + TAB_BAR_CLEARANCE,
          },
        ]}
        // The list is now the FIRST view in the controller, so UIKit would
        // helpfully add its own safe-area inset on top of the padding the
        // header just measured. It is our header; we do the arithmetic.
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <Stagger step={55} initialDelay={80}>
        {/* PROFILE — the identity block became a proper grouped card (12 Aug):
            the avatar heads it, and what the account actually IS reads as
            rows underneath. Read-only on purpose — the name and address belong
            to the Apple or Google account that signs you in, and Recore
            editing them here would be a second, disagreeing copy. */}
        <Section label="Profile">
          <View style={styles.profile}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
                {initialsOf(displayName, email)}
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text
                style={styles.profileName}
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {displayName ?? 'Your account'}
              </Text>
              {providerLabel ? (
                <Text style={styles.profileProvider} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Signed in with {providerLabel}
                </Text>
              ) : null}
            </View>
          </View>
          <Row label="Name" value={displayName ?? 'Not set'} chevron={false} divider />
          <Row label="Email" value={email ?? 'Not set'} chevron={false} divider />
        </Section>

        {/* THE RECORD — the career numbers and the shape of the training year,
            in one card that is also a door to Progress (Mobbin: komoot and
            AllTrails both make the stat block tappable rather than decorative).
            Absent entirely on an empty account: three zeros over an empty grid
            is noise, and §1.1 invariant 6 says say nothing instead. */}
        {record ? (
          <View style={styles.section}>
            <View style={[styles.card, styles.recordCard]}>
              {/* The numbers go to Progress — that is where a number is
                  explained. Two controls in one card, each its own 44 pt
                  target, because they answer different questions. */}
              <PressableScale
                onPress={() => {
                  tap();
                  router.push('/progress');
                }}
                haptic="none"
                activeScale={0.98}
                accessibilityRole="button"
                accessibilityLabel={`${record.days} training days, ${record.sets} sets, ${groupThousands(record.volume)} kilograms. Open Progress.`}
                style={styles.stats}>
                <Stat value={String(record.days)} label="Training days" />
                <View style={styles.statRule} />
                <Stat value={String(record.sets)} label="Sets" />
                <View style={styles.statRule} />
                <Stat value={compactKg(record.volume)} label="Kg lifted" />
              </PressableScale>

              {/* The grid opens ITSELF, in full: the card can only hold thirty
                  weeks, and the obvious question a partial record raises is
                  "what about before that". */}
              <PressableScale
                onPress={() => {
                  tap();
                  setHistoryOpen(true);
                }}
                haptic="none"
                activeScale={0.98}
                accessibilityRole="button"
                accessibilityLabel="Open your full training record"
                style={styles.gridBlock}>
                <ActivityGrid weeks={record.grid} />
                <View style={styles.gridFoot}>
                  <Text style={styles.gridFootLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Last 30 weeks
                  </Text>
                  <View style={styles.gridFootMore}>
                    <Text style={styles.gridFootLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      See all
                    </Text>
                    <Icon name="chevron-forward" size={moderateScale(12)} tint={color.textMuted} />
                  </View>
                </View>
              </PressableScale>
            </View>
            <Text style={styles.footnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {record.streak > 1
                ? `${record.streak} training days in a row. Rest days never break it.`
                : 'Every day you wrote something down.'}
            </Text>
          </View>
        ) : null}

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
              router.push('/paywall');
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

        {/* TRAINING — the four settings that change how a SESSION works, in
            the order they come up in a gym: what you lift in, how long you
            rest, which days you train, and whether Sunday brings a recap.
            Everything that describes YOU rather than the session moved to its
            own card below (12 Aug) — this one used to be eleven rows deep and
            the two most-changed values were buried in the middle of it. */}
        <Section
          label="Training"
          footnote={recapMessage ?? 'Predictions round to what your gym’s bar can actually hold.'}
          footnoteActive={recapMessage != null}>
          <AccordionRow
            icon="plate"
            label="Units"
            value={unit}
            open={expanded === 'unit'}
            onToggle={() => toggle('unit')}>
            <Segmented options={UNIT_OPTIONS} selected={unit} onSelect={handleUnit} />
          </AccordionRow>
          <AccordionRow
            icon="timer"
            label="Rest timer default"
            value={REST_SEG.find((o) => o.id === rest)?.label ?? '2:00'}
            reading
            open={expanded === 'rest'}
            onToggle={() => toggle('rest')}
            divider>
            <Segmented options={REST_SEG} selected={rest} onSelect={handleRest} reading />
          </AccordionRow>
          {/* The usual week. The caption says what it is FOR, because a row of
              day chips in a settings screen otherwise reads as a schedule —
              and §11 forbids turning it into one. */}
          <AccordionRow
            icon="calendar"
            label="Training days"
            value={daysLabel(days) || 'Not set'}
            open={expanded === 'days'}
            onToggle={() => toggle('days')}
            divider>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, i) => {
                const on = hasDay(days, i);
                return (
                  <PressableScale
                    key={label}
                    onPress={() => handleDay(i)}
                    haptic="none"
                    activeScale={0.94}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: on }}
                    style={[styles.dayChip, on && styles.dayChipOn]}>
                    <Text
                      style={[styles.dayChipText, on && styles.dayChipTextOn]}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {label}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </AccordionRow>
          {/* The §12.1 weekly recap — the one recurring notification that
              exists. It lives here rather than in a Notifications card of its
              own: it is a training habit, and one row does not need a section. */}
          <AccordionRow
            icon="bell"
            label="Weekly recap"
            value={recapOn ? `Sundays ${String(recapHour).padStart(2, '0')}:00` : 'Off'}
            reading={recapOn}
            open={expanded === 'recap'}
            onToggle={() => toggle('recap')}
            divider>
            <View style={styles.recapEditor}>
              <Segmented
                options={RECAP_TOGGLE}
                selected={recapOn ? 'on' : 'off'}
                onSelect={(id) => void handleRecapToggle(id)}
              />
              {recapOn ? (
                <Segmented
                  options={RECAP_HOUR_SEG}
                  selected={recapHour}
                  onSelect={handleRecapHour}
                  reading
                />
              ) : null}
            </View>
          </AccordionRow>
        </Section>

        {/* ABOUT YOU — the onboarding answers, still editable in place (§11: a
            replay of onboarding is not an editor). */}
        <Section label="About you">
          <AccordionRow
            icon="target"
            label="Focus"
            value={labelOf(GOAL_OPTIONS, goal)}
            open={expanded === 'focus'}
            onToggle={() => toggle('focus')}>
            <Segmented options={GOAL_OPTIONS} selected={goal} onSelect={handleGoal} />
          </AccordionRow>
          <AccordionRow
            icon="target"
            label="Experience"
            value={labelOf(EXPERIENCE_OPTIONS, experience)}
            open={expanded === 'experience'}
            onToggle={() => toggle('experience')}
            divider>
            <Segmented
              options={EXPERIENCE_OPTIONS}
              selected={experience}
              onSelect={handleExperience}
            />
          </AccordionRow>
          <AccordionRow
            icon="barbell"
            label="How you train"
            value={labelOf(STYLE_OPTIONS, style)}
            open={expanded === 'style'}
            onToggle={() => toggle('style')}
            divider>
            <Segmented options={STYLE_OPTIONS} selected={style} onSelect={handleStyle} />
          </AccordionRow>
          <AccordionRow
            icon="sparkle"
            label="Session style"
            value={labelOf(FEEL_OPTIONS, feel)}
            open={expanded === 'feel'}
            onToggle={() => toggle('feel')}
            divider>
            <Segmented options={FEEL_OPTIONS} selected={feel} onSelect={handleFeel} />
          </AccordionRow>
          <AccordionRow
            icon="language"
            label="Writing language"
            value={labelOf(LANGUAGE_OPTIONS, language)}
            open={expanded === 'language'}
            onToggle={() => toggle('language')}
            divider>
            <Segmented options={LANGUAGE_OPTIONS} selected={language} onSelect={handleLanguage} />
          </AccordionRow>
          {/* Body context, editable in place (§11: every onboarding answer
              stays editable — a replay of onboarding is not an editor). Both
              fields are optional; clearing one removes it from the record. */}
          <AccordionRow
            icon="target"
            label="Body context"
            value={
              [formatBodyWeight(bodyWeightKg, unit), bodyHeightCm ? `${bodyHeightCm} cm` : null]
                .filter(Boolean)
                .join(' · ') || 'Not set'
            }
            open={expanded === 'body'}
            onToggle={() => toggle('body')}
            divider>
            <View style={styles.bodyFields}>
              <View style={styles.bodyField}>
                <Text style={styles.bodyFieldLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Weight
                </Text>
                <View style={styles.bodyInputWrap}>
                  <TextInput
                    style={styles.bodyInput}
                    value={weightText}
                    onChangeText={handleBodyWeightText}
                    onEndEditing={snapWeightText}
                    placeholder="—"
                    placeholderTextColor={color.textMuted}
                    keyboardType="decimal-pad"
                    keyboardAppearance="light"
                    selectionColor={color.accent}
                    cursorColor={color.accent}
                    allowFontScaling
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    accessibilityLabel={`Body weight in ${unit === 'lb' ? 'pounds' : 'kilograms'}`}
                  />
                  <Text style={styles.bodyUnit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {unit}
                  </Text>
                </View>
              </View>
              <View style={styles.bodyField}>
                <Text style={styles.bodyFieldLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  Height
                </Text>
                <View style={styles.bodyInputWrap}>
                  <TextInput
                    style={styles.bodyInput}
                    value={heightText}
                    onChangeText={handleBodyHeightText}
                    onEndEditing={snapHeightText}
                    placeholder="—"
                    placeholderTextColor={color.textMuted}
                    keyboardType="number-pad"
                    keyboardAppearance="light"
                    selectionColor={color.accent}
                    cursorColor={color.accent}
                    allowFontScaling
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    accessibilityLabel="Height in centimetres"
                  />
                  <Text style={styles.bodyUnit} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    cm
                  </Text>
                </View>
              </View>
              <Text style={styles.bodyHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Context for your own numbers. Never a target or a score. Clear a field to remove
                it.
              </Text>
            </View>
          </AccordionRow>
          <AccordionRow
            icon="plate"
            label="Smallest plate"
            value={plate != null ? `${fmtNumber(plate)} kg` : 'Not set'}
            reading={plate != null}
            open={expanded === 'plate'}
            onToggle={() => toggle('plate')}
            divider>
            <Segmented options={PLATE_SEG} selected={plate} onSelect={handlePlate} reading />
          </AccordionRow>
          <AccordionRow
            icon="barbell"
            label="Bar weight"
            value={`${bar} kg`}
            reading
            open={expanded === 'bar'}
            onToggle={() => toggle('bar')}
            divider>
            <Segmented options={BAR_SEG} selected={bar} onSelect={handleBar} reading />
          </AccordionRow>
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

        {/* DISPLAY — how the record is printed, not what is in it (owner,
            9 Aug). Recore already follows the system text size; this is for the
            person who wants their sets bigger HERE without enlarging every app
            on their phone. It changes the ledger the moment it is tapped. */}
        <Section
          label="Display"
          footnote="Recore already follows your iPhone’s text size. This makes the sets larger on their own.">
          <AccordionRow
            icon="table"
            label="Set readings"
            value={largeSets ? 'Larger' : 'Standard'}
            open={expanded === 'setreadings'}
            onToggle={() => toggle('setreadings')}>
            <Segmented
              options={SET_READING_SEG}
              selected={largeSets ? 'large' : 'standard'}
              onSelect={handleSetReadings}
            />
          </AccordionRow>
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
          <Row icon="refresh" label="Restart onboarding" divider onPress={handleReplaySetup} />
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
            onPress={() => void handleSignOut()}
          />
        </Section>

        {/* DEV — the lapsed surface has no other way in until a sandbox
            subscription can expire (PLAN B4). `__DEV__` compiles it out. */}
        {__DEV__ ? (
          <Section label="Dev" footnote="Development only — never in a release build.">
            <Row
              icon="wrench"
              label="Simulate lapsed subscription"
              value={lapsed ? 'On' : 'Off'}
              chevron={false}
              onPress={() => {
                tap();
                setDevLapsed(!lapsed);
                setLapsed(!lapsed);
              }}
              divider
            />
            <Row
              icon="wrench"
              label="Run illustrated onboarding"
              sub="Resets its answers and opens step 1"
              chevron={false}
              onPress={() => {
                tap();
                useOnboardingAnswers.getState().reset();
                router.push('/onboarding/1');
              }}
            />
          </Section>
        ) : null}

        {/* The version used to sit loose at the foot of the screen. It is a
            fact about this build, so it moved onto the About row where the
            rest of them are — one place, not two. */}
        </Stagger>
      </ScrollView>

      {/* Drawn after the list so it sits over it. A tab root, so no chevron:
          there is nothing to go back to, and the title goes left-aligned per
          §6.5 rather than centred to balance one. */}
      <ScrollEdgeHeader onHeight={setHeaderH}>
        <View style={styles.nav}>
          <Text
            style={styles.navTitle}
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            You
          </Text>
        </View>
      </ScrollEdgeHeader>

      {/* The full record, opened from the grid. Mounted here rather than app-
          wide: unlike ExerciseSheet, You is the only screen that opens it. */}
      <HistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} />
    </View>
  );
}

// --- building blocks ---------------------------------------------------------
// The grouped-card vocabulary (Section / Row / AccordionRow / Segmented) moved
// to `components/settings-rows.tsx` on 12 Aug 2026, when a second settings
// surface needed it. What is left here is what only THIS screen draws.

/**
 * A career number: a big numeral over a small caption (Mobbin — Tonal, Open and
 * Peloton Strength+ all land on the same shape). Tabular figures, so three of
 * them side by side sit on one optical baseline whatever the digits.
 */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The shape of the training year: one dot per day, one column per week, filled
 * where the athlete trained. The rule lives in `src/lib/activity.ts` (pure,
 * eight tests); this only draws it.
 *
 * TWO MARKS AND NO MORE. A trained day is the blue trained mark (§5.1, ruled
 * 28 Jul), an untrained day is the recessed paper, and a day that has not
 * happened yet is nothing at all. There is no intensity ramp — grading days by
 * volume would quietly tell someone their deload week counted less (§15), and
 * one flat mark keeps §20's "no rings, no daily goals" intact. It is a record,
 * drawn.
 *
 * Not individually tappable: a 7pt dot cannot be a 44pt target (§14), so the
 * whole card is the one control and it opens Progress.
 */
function ActivityGrid({ weeks }: { weeks: GridWeek[] }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.gridMonths}>
        {weeks.map((week, i) => (
          <View key={`m:${i}`} style={styles.gridMonthSlot}>
            {week.monthLabel ? (
              <Text style={styles.gridMonth} numberOfLines={1} allowFontScaling={false}>
                {week.monthLabel}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {weeks.map((week, i) => (
          <View key={`w:${i}`} style={styles.gridWeek}>
            {week.days.map((day) => (
              <View
                key={day.key}
                style={[
                  styles.gridDot,
                  day.trained && styles.gridDotOn,
                  day.future && styles.gridDotFuture,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/** A lifetime tonnage runs into the millions; seven grouped digits would set
 * the whole strip's type size by its longest member. Past a million it reads
 * "1.2M kg" — still specific (§15), and it stops the row shrinking. */
function compactKg(kg: number): string {
  return kg >= 1_000_000 ? `${(kg / 1_000_000).toFixed(1)}M` : groupThousands(kg);
}


const AVATAR = moderateScale(52);
const ROW_ICON = moderateScale(18);
/** Where a separator starts: past the glyph column, so the icons read as one
 * vertical run rather than as marks floating in a ruled table. */
const ROW_ICON_SLOT = ROW_ICON + spacing.md;
/** The activity grid's dot. Laid out `space-between`, so the column count
 * (`GRID_WEEKS`) is what keeps the horizontal gaps equal to the vertical ones —
 * see the note on that constant before changing either. */
const DOT = moderateScale(7);
/**
 * How far a pressed row's highlight bleeds past its content, toward the card's
 * edge. A press fill drawn on the row's own box is a hard-cornered grey
 * rectangle floating inside the card's padding — the tap reads as a mis-drawn
 * box rather than as the row lighting up. Bleeding it out and rounding it
 * (`radius.sm`) makes the highlight a band that belongs to the card. Content
 * does not move: every row that bleeds pays the margin back as padding.
 */
const PRESS_BLEED = spacing.sm;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  navTitle: {
    ...type.title2,
    color: color.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },

  // Profile identity block.
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...type.headline,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: color.textPrimary,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    ...type.title2,
    color: color.textPrimary,
  },
  profileEmail: {
    marginTop: 2,
    ...type.subhead,
    color: color.textSecondary,
  },
  profileProvider: {
    marginTop: 2,
    ...type.footnote,
    color: color.textMuted,
  },

  // Sections & cards.
  section: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    marginBottom: spacing.sm - 1,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    paddingHorizontal: spacing.lg + 2,
    // A hair of vertical padding so the first and last row's pressed highlight
    // (PRESS_BLEED below) stays inside the card's own rounded corner instead of
    // poking a square grey nub past it.
    paddingVertical: spacing.xs,
    ...shadow.card,
  },

  // The record card: career numbers over the training year, and a door to
  // Progress. Tighter horizontal padding than a row card — the grid wants the
  // width, and the numbers read better with air above and below than beside.
  recordCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  // A CARD-SHAPED TARGET DIPS, IT DOES NOT SHADE (owner, 18 Aug 2026).
  //
  // Both blocks used to fill `surfaceHigh` while held. A grey rectangle inside
  // a white card is the one press treatment that always looks cheap: it cannot
  // reach the card's edge (the card's own rounded corner has no clip to hide
  // behind, and clipping it would cost the shadow), so it lands as a floating
  // grey box with white margins either side. iOS shades LIST ROWS, which run
  // wall to wall; a block this size is a card, and a card presses by moving.
  // The scale dip does all of it now — hence no fill, and no bleed to carry.
  gridBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  gridFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridFootMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  gridFootLabel: {
    ...type.footnote,
    color: color.textMuted,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statRule: {
    width: hairline,
    alignSelf: 'stretch',
    backgroundColor: color.divider,
  },
  // The usual week, inside its accordion. Ink when chosen — the trained-day
  // blue marks a day that happened, and an expected day is not one.
  dayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    flex: 1,
    minHeight: moderateScale(44),
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: {
    borderColor: color.accent,
    backgroundColor: color.accent,
  },
  dayChipText: {
    ...type.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
  dayChipTextOn: {
    color: color.onInk,
  },
  bodyFields: {
    gap: spacing.sm,
  },
  bodyField: {
    minHeight: moderateScale(44),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  bodyFieldLabel: {
    ...type.subhead,
    color: color.textSecondary,
  },
  bodyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    backgroundColor: color.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  bodyInput: {
    minWidth: moderateScale(64),
    textAlign: 'right',
    padding: 0,
    color: color.textPrimary,
    fontFamily: fonts.reading,
    fontSize: type.subhead.fontSize,
    fontVariant: ['tabular-nums'],
  },
  bodyUnit: {
    ...type.caption,
    color: color.textMuted,
  },
  bodyHint: {
    ...type.footnote,
    color: color.textMuted,
  },
  recapEditor: {
    gap: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(24),
    fontWeight: '600',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    color: color.textPrimary,
  },
  statLabel: {
    ...type.footnote,
    color: color.textMuted,
  },

  // The activity grid.
  gridMonths: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  gridMonthSlot: {
    width: DOT,
  },
  gridMonth: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(8.5),
    letterSpacing: 0.4,
    color: color.textMuted,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridWeek: {
    gap: DOT * 0.55,
  },
  gridDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: color.surfaceHigh,
  },
  gridDotOn: {
    backgroundColor: color.trained,
  },
  // Not yet lived. Invisible, never drawn as a missed day.
  gridDotFuture: {
    backgroundColor: 'transparent',
  },

  // Rows.
  row: {
    minHeight: moderateScale(48),
    paddingVertical: spacing.md + 1,
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: ROW_ICON,
    alignItems: 'center',
  },
  rowSep: {
    height: hairline,
    marginLeft: ROW_ICON_SLOT,
    backgroundColor: color.divider,
  },
  rowLeft: {
    flex: 1,
  },
  rowLabel: {
    ...type.subhead,
    color: color.textPrimary,
  },
  rowLabelBold: {
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: color.error,
  },
  rowSub: {
    ...type.caption,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: 2,
  },
  rowRight: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  rowValue: {
    flexShrink: 1,
    ...type.subhead,
    color: color.textSecondary,
    textAlign: 'right',
  },
  rowValueOpen: {
    color: color.textPrimary,
    fontWeight: '600',
  },
  external: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    fontSize: moderateScale(14),
    color: color.textMuted,
  },

  // Inline segmented editor (revealed by an AccordionRow).
  editor: {
    paddingBottom: spacing.md,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
    padding: moderateScale(3),
    gap: moderateScale(3),
  },
  segment: {
    flex: 1,
    paddingVertical: moderateScale(8),
    borderRadius: radius.sm - 3,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: hairline,
    borderColor: 'transparent',
  },
  segmentSelected: {
    backgroundColor: color.surface,
    borderColor: color.border,
  },
  segmentLabel: {
    ...type.caption,
    fontWeight: '600',
    color: color.textSecondary,
  },
  segmentMono: {
    fontFamily: fonts.reading,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  segmentLabelSelected: {
    color: color.textPrimary,
  },

  footnote: {
    ...type.footnote,
    lineHeight: lineFor(16),
    color: color.textMuted,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  footnoteActive: {
    color: color.textSecondary,
  },
  version: {
    ...type.footnote,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  versionNum: {
    fontFamily: fonts.reading,
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
});
