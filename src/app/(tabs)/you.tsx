import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { HistorySheet } from '@/components/history-sheet';
import { glyphTint, Icon, type IconName } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
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
import { openReviewPage, reviewStoreUrl } from '@/lib/review';
import {
  DAY_LABELS,
  daysLabel,
  formatBodyWeight,
  hasDay,
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
  getSessionFeel,
  getSmallestPlateKg,
  getTrainingStyle,
  getUsualDays,
  getWeightUnit,
  setBarWeightKg,
  setExperience,
  setGoal,
  setObLanguage,
  setSessionFeel,
  setSmallestPlateKg,
  setTrainingStyle,
  setUsualDays,
  setWeightUnit,
  type Goal,
  type ObLanguage,
  type WeightUnit,
} from '@/lib/prefs';
import { SPRING } from '@/lib/motion';
import { scheduleSync } from '@/lib/sync/index';
import {
  color,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';
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

type Expand =
  | 'focus'
  | 'experience'
  | 'style'
  | 'feel'
  | 'days'
  | 'unit'
  | 'language'
  | 'plate'
  | 'bar'
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

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  const [busy, setBusy] = useState<null | 'import' | 'signout' | 'delete' | 'restore'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [goal, setGoalState] = useState<Goal | null>(() => getGoal());
  const [language, setLanguageState] = useState<ObLanguage | null>(() => getObLanguage());
  const [plate, setPlateState] = useState<number | null>(() => getSmallestPlateKg());
  const [bar, setBarState] = useState<number>(() => getBarWeightKg());
  // §5's answers, all editable here. Body context is read-only in this pass —
  // it is shown so a person can see what Recore holds, and cleared or changed
  // from the same place it was asked (`Restart onboarding`).
  const [experience, setExperienceState] = useState<Experience | null>(() => getExperience());
  const [style, setStyleState] = useState<TrainingStyle | null>(() => getTrainingStyle());
  const [feel, setFeelState] = useState<SessionFeel | null>(() => getSessionFeel());
  const [days, setDaysState] = useState<number>(() => getUsualDays());
  const [unit, setUnitState] = useState<WeightUnit>(() => getWeightUnit() ?? 'kg');
  const bodyWeightKg = getBodyWeightKg();
  const bodyHeightCm = getBodyHeightCm();
  const [expanded, setExpanded] = useState<Expand>(null);
  const [lapsed, setLapsed] = useState<boolean>(() => isDevLapsed());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null);
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
  };

  /** The usual week. An expectation, never a target — nothing counts a miss. */
  const handleDay = (index: number) => {
    tap();
    const next = toggleDay(days, index);
    setUsualDays(next);
    setDaysState(next);
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
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* A tab root, so no chevron: there is nothing to go back to, and the
          title goes left-aligned per §6.5 rather than centred to balance one. */}
      <View style={styles.nav}>
        <Text style={styles.navTitle} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          You
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          // Content scrolls *behind* the tab bar (§5.2 — glass needs something
          // to refract), so the last row clears it with padding, not an inset.
          { paddingBottom: insets.bottom + spacing.xxl + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}>
        <Stagger step={55} initialDelay={80}>
        {/* PROFILE HEADER — avatar + name + email (Mobbin identity block). */}
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {initialsOf(displayName, email)}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {displayName ?? 'Your account'}
            </Text>
            {email ? (
              <Text style={styles.profileEmail} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {email}
              </Text>
            ) : null}
            {providerLabel ? (
              <Text style={styles.profileProvider} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {providerLabel} account
              </Text>
            ) : null}
          </View>
        </View>

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
                activeScale={0.995}
                accessibilityRole="button"
                accessibilityLabel={`${record.days} training days, ${record.sets} sets, ${groupThousands(record.volume)} kilograms. Open Progress.`}
                style={styles.stats}
                pressedStyle={styles.rowPressed}>
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
                activeScale={0.995}
                accessibilityRole="button"
                accessibilityLabel="Open your full training record"
                style={styles.gridBlock}
                pressedStyle={styles.rowPressed}>
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

        {/* TRAINING — calm value rows that expand inline to a segmented editor. */}
        <Section label="Training" footnote="Predictions round to what your gym’s bar can actually hold.">
          <Row
            icon="calendar"
            label="Your split"
            sub="Plan what you train each day"
            onPress={() => {
              tap();
              router.push('/split');
            }}
          />
          <AccordionRow
            icon="target"
            label="Focus"
            value={labelOf(GOAL_OPTIONS, goal)}
            open={expanded === 'focus'}
            onToggle={() => toggle('focus')}
            divider>
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
          {/* The usual week. The caption says what it is FOR, because a row of
              day chips in a settings screen otherwise reads as a schedule —
              and §11 forbids turning it into one. */}
          <AccordionRow
            icon="calendar"
            label="Usual training days"
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
          <AccordionRow
            icon="language"
            label="Writing language"
            value={labelOf(LANGUAGE_OPTIONS, language)}
            open={expanded === 'language'}
            onToggle={() => toggle('language')}
            divider>
            <Segmented options={LANGUAGE_OPTIONS} selected={language} onSelect={handleLanguage} />
          </AccordionRow>
          <AccordionRow
            icon="plate"
            label="Units"
            value={unit}
            open={expanded === 'unit'}
            onToggle={() => toggle('unit')}
            divider>
            <Segmented options={UNIT_OPTIONS} selected={unit} onSelect={handleUnit} />
          </AccordionRow>
          {/* Body context, shown only when it exists. §5.1: skipping it changes
              nothing essential, so an empty value draws no row at all rather
              than an invitation to fill something in. */}
          {bodyWeightKg != null || bodyHeightCm != null ? (
            <Row
              icon="target"
              label="Body context"
              value={
                [formatBodyWeight(bodyWeightKg, unit), bodyHeightCm ? `${bodyHeightCm} cm` : null]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
              sub="Context for your own numbers. Never a target or a score."
              chevron={false}
              divider
            />
          ) : null}
          <AccordionRow
            icon="plate"
            label="Smallest plate"
            value={plate != null ? `${fmtNumber(plate)} kg` : 'Not set'}
            open={expanded === 'plate'}
            onToggle={() => toggle('plate')}
            divider>
            <Segmented options={PLATE_SEG} selected={plate} onSelect={handlePlate} mono />
          </AccordionRow>
          <AccordionRow
            icon="barbell"
            label="Bar weight"
            value={`${bar} kg`}
            open={expanded === 'bar'}
            onToggle={() => toggle('bar')}
            divider>
            <Segmented options={BAR_SEG} selected={bar} onSelect={handleBar} mono />
          </AccordionRow>
        </Section>

        {/* SUBSCRIPTION — the store's own state, and three real actions. The
            footnote doubles as the result line for Restore, the way "Your data"
            does for import/export. */}
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
          <Row icon="card" label="Manage in App Store" external divider onPress={handleManage} />
          <Row
            icon="refresh"
            label={busy === 'restore' ? 'Restoring…' : 'Restore purchases'}
            divider
            disabled={busy !== null}
            onPress={() => void handleRestore()}
          />
        </Section>

        {/* YOUR DATA — free-forever export/import; caption doubles as result. */}
        <Section label="Your data" footnote={dataCaption} footnoteActive={importMessage != null || exportMessage != null}>
          <Row
            icon="download"
            label="Export everything"
            sub="JSON — your original notes and the full record"
            onPress={() => void handleExport('json')}
          />
          <Row
            icon="table"
            label="Export for a spreadsheet"
            sub="CSV — date, exercise, sets, weight"
            divider
            onPress={() => void handleExport('csv')}
          />
          <Row
            icon="upload"
            label={busy === 'import' ? 'Importing…' : 'Import from Strong or Hevy'}
            divider
            disabled={busy !== null}
            onPress={() => void handleImport()}
          />
        </Section>

        {/* PARSING & PRIVACY — real pages now, and the two links App Review
            also taps on the paywall (PLAN A3 step 3, C3). */}
        <Section label="Privacy">
          <Row icon="sparkle" label="How parsing works" onPress={() => openDoc('parsing')} />
          <Row icon="lock" label="Privacy Policy" divider onPress={() => openDoc('privacy')} />
          <Row icon="document" label="Terms of Use" divider onPress={() => openDoc('terms')} />
        </Section>

        {/* SUPPORT — the real replay-onboarding action, plus the MANUAL door to
            the store listing. That row is not the prompt §16.3 rules on: this
            one is a labelled thing the user chose to tap, it spends none of the
            three system asks, and it is not rendered at all until there is a
            listing to open (§1.1 invariant 6). */}
        <Section label="Support">
          <Row icon="refresh" label="Restart onboarding" onPress={handleReplaySetup} />
          {reviewStoreUrl() ? (
            <Row
              icon="star"
              label="Rate Recore"
              external
              divider
              onPress={() => {
                tap();
                openReviewPage();
              }}
            />
          ) : null}
        </Section>

        {/* ACCOUNT — both actions are real. Delete deletes (PLAN D1). */}
        <Section label="Account">
          <Row
            icon="sign-out"
            label={busy === 'signout' ? 'Signing out…' : 'Sign out'}
            labelBold
            chevron={false}
            disabled={busy !== null}
            onPress={() => void handleSignOut()}
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

        <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore <Text style={styles.versionNum}>{Constants.expoConfig?.version ?? ''}</Text>
        </Text>
        </Stagger>
      </ScrollView>

      {/* The full record, opened from the grid. Mounted here rather than app-
          wide: unlike ExerciseSheet, You is the only screen that opens it. */}
      <HistorySheet visible={historyOpen} onClose={() => setHistoryOpen(false)} />
    </SafeAreaView>
  );
}

// --- building blocks ---------------------------------------------------------

/** A labelled group: quiet Title-case header + a bordered card + optional caption. */
function Section({
  label,
  footnote,
  footnoteActive = false,
  children,
}: {
  label?: string;
  footnote?: string;
  footnoteActive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      {label ? <Eyebrow tone="secondary" style={styles.sectionLabel}>{label}</Eyebrow> : null}
      <View style={styles.card}>{children}</View>
      {footnote ? (
        <Text
          style={[styles.footnote, footnoteActive && styles.footnoteActive]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A career number: a big mono numeral over a small caption (Mobbin — Tonal,
 * Open and Peloton Strength+ all land on the same shape). Tabular figures, so
 * three of them side by side sit on one optical baseline whatever the digits.
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

/** A grouped-list row: leading glyph, label (+ optional subline), value / chevron. */
function Row({
  icon,
  label,
  sub,
  value,
  labelBold = false,
  danger = false,
  chevron = true,
  external = false,
  divider = false,
  disabled = false,
  onPress,
}: {
  icon?: IconName;
  label: string;
  sub?: string;
  value?: string;
  labelBold?: boolean;
  danger?: boolean;
  chevron?: boolean;
  external?: boolean;
  divider?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Icon
            name={icon}
            size={ROW_ICON}
            // Each glyph carries its own colour (`glyphTint`), except on a
            // destructive row — red is already spoken for there, and a row
            // that deletes an account does not get a decorative hue.
            tint={danger ? color.error : glyphTint(icon)}
          />
        </View>
      ) : null}
      <View style={styles.rowLeft}>
        <Text
          style={[styles.rowLabel, labelBold && styles.rowLabelBold, danger && styles.rowLabelDanger]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rowSub} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        {value != null ? (
          <Text style={styles.rowValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {value}
          </Text>
        ) : null}
        {external ? (
          <Text style={styles.external} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            ↗
          </Text>
        ) : null}
        {chevron ? <Icon name="chevron-forward" size={moderateScale(14)} tint={color.textMuted} /> : null}
      </View>
    </>
  );

  const row = !onPress ? (
    <View style={styles.row}>{body}</View>
  ) : (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      haptic="none"
      activeScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.row}
      pressedStyle={styles.rowPressed}>
      {body}
    </PressableScale>
  );

  // The separator is a sibling, not a border on the row, so it can start at the
  // LABEL rather than under the glyph (Mobbin — Granola). A border cannot be
  // inset; this can, and the inset is what keeps the icons reading as one column.
  if (!divider) return row;
  return (
    <>
      <View style={styles.rowSep} />
      {row}
    </>
  );
}

/** A value row (label · current value · chevron) that expands inline to reveal
 * its segmented editor — the calm "settings" read, with the control on demand. */
function AccordionRow({
  icon,
  label,
  value,
  open,
  onToggle,
  divider = false,
  children,
}: {
  icon?: IconName;
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      {divider ? <View style={styles.rowSep} /> : null}
      <PressableScale
        onPress={onToggle}
        haptic="none"
        activeScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.row}
        pressedStyle={styles.rowPressed}>
        {icon ? (
          <View style={styles.rowIcon}>
            <Icon name={icon} size={ROW_ICON} tint={glyphTint(icon)} />
          </View>
        ) : null}
        <View style={styles.rowLeft}>
          <Text style={styles.rowLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {label}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text
            style={[styles.rowValue, open && styles.rowValueOpen]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {value}
          </Text>
          <Chevron open={open} />
        </View>
      </PressableScale>
      {open ? <View style={styles.editor}>{children}</View> : null}
    </>
  );
}

/** The accordion's disclosure chevron — springs 0°→180° on open (reduceMotion-safe).
 * The row height still animates via LayoutAnimation; this just spins the caret. */
function Chevron({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (open ? 1 : 0) : withSpring(open ? 1 : 0, SPRING.snappy);
  }, [open, reduce, t]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 180}deg` }] }));
  return (
    <Animated.View style={spin}>
      <Icon name="chevron-down" size={moderateScale(14)} tint={color.textMuted} />
    </Animated.View>
  );
}

/** The inline segmented editor revealed by an AccordionRow. */
function Segmented<T extends string | number>({
  options,
  selected,
  onSelect,
  mono = false,
}: {
  options: { id: T; label: string }[];
  selected: T | null;
  onSelect: (id: T) => void;
  mono?: boolean;
}) {
  return (
    <View style={styles.segments}>
      {options.map((o) => {
        const isSelected = selected === o.id;
        return (
          <PressableScale
            key={String(o.id)}
            onPress={() => onSelect(o.id)}
            haptic="none"
            activeScale={0.94}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, isSelected && styles.segmentSelected]}>
            <Text
              style={[styles.segmentLabel, mono && styles.segmentMono, isSelected && styles.segmentLabelSelected]}
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
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
    paddingTop: spacing.sm,
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
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
  },
  // The grid keeps its own inner width (margin out, padding back), so bleeding
  // the press highlight never changes where the dots sit.
  gridBlock: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    marginHorizontal: -PRESS_BLEED,
    paddingHorizontal: PRESS_BLEED,
    borderRadius: radius.sm,
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
    color: color.bg,
  },
  statValue: {
    fontFamily: fonts.mono,
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
    fontFamily: fonts.mono,
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
  rowPressed: {
    backgroundColor: color.surfaceHigh,
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
    lineHeight: moderateScale(16),
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
    fontFamily: fonts.mono,
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
    padding: moderateScale(3),
    gap: moderateScale(3),
  },
  segment: {
    flex: 1,
    paddingVertical: moderateScale(8),
    borderRadius: radius.sm - 3,
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
    fontFamily: fonts.mono,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  segmentLabelSelected: {
    color: color.textPrimary,
  },

  footnote: {
    ...type.footnote,
    lineHeight: moderateScale(16),
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
    fontFamily: fonts.mono,
    fontVariant: ['tabular-nums'],
    color: color.textMuted,
  },
});
