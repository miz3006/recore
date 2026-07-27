import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Share, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { useAuth } from '@/lib/auth/provider';
import { signOut } from '@/lib/auth/sign-in';
import { buildWorkoutsCsv } from '@/lib/export-csv';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { fmtNumber } from '@/lib/parse/summarize';
import { recachePredictionFromLatest } from '@/lib/predict/cache';
import {
  getBarWeightKg,
  getGoal,
  getObLanguage,
  getSmallestPlateKg,
  setBarWeightKg,
  setGoal,
  setObLanguage,
  setSmallestPlateKg,
  type Goal,
  type ObLanguage,
} from '@/lib/prefs';
import { scheduleSync } from '@/lib/sync/index';
import {
  easing,
  hairline,
  makeStyles,
  MAX_FONT_SCALE,
  moderateScale,
  mono,
  radius,
  spacing,
  spring,
  timing,
  type,
  useTheme,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /settings — a proper profile-and-settings screen (Mobbin-referenced: a clean
 * identity header over grouped rows, à la ChatGPT / Viator). NOT a bottom sheet:
 * it's a pushed screen with a back header, so there's no misleading grabber.
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


const GOAL_OPTIONS: { id: Goal; label: string }[] = [
  { id: 'strength', label: 'Strength' },
  { id: 'muscle', label: 'Muscle' },
  { id: 'both', label: 'Both' },
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

/** Apple's own subscription surface — the only honest "manage" before billing. */
const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

type Expand = 'focus' | 'language' | 'plate' | 'bar' | null;

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
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  const [busy, setBusy] = useState<null | 'import' | 'signout'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [goal, setGoalState] = useState<Goal | null>(() => getGoal());
  const [language, setLanguageState] = useState<ObLanguage | null>(() => getObLanguage());
  const [plate, setPlateState] = useState<number | null>(() => getSmallestPlateKg());
  const [bar, setBarState] = useState<number>(() => getBarWeightKg());
  const [expanded, setExpanded] = useState<Expand>(null);

  // The real account, never a placeholder: name (best-effort) + email + provider.
  const meta = session?.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const displayName = meta?.full_name ?? meta?.name ?? null;
  const email = session?.user.email ?? null;
  const provider = session?.user.app_metadata.provider;
  const providerLabel = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : null;

  const toggle = (key: Exclude<Expand, null>) => {
    // The expand itself is animated by the row (Reanimated `layout`), not by
    // `LayoutAnimation`: the app already runs one motion engine, and the legacy
    // one both fights it and is a no-op on parts of the New Architecture.
    tap();
    setExpanded((cur) => (cur === key ? null : key));
  };

  const handleClose = () => {
    tap();
    router.back();
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

  const handleExport = async () => {
    if (!userId) return;
    tap();
    const csv = buildWorkoutsCsv(userId);
    if (!csv) {
      setExportMessage('Nothing to export yet.');
      return;
    }
    setExportMessage(null);
    await Share.share({ title: 'Recore export', message: csv });
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
    router.push('/onboarding');
  };

  const handleManage = () => {
    tap();
    void Linking.openURL(MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
  };

  const handleRestore = () => {
    tap();
    Alert.alert(
      'Restore Purchases',
      'Restore checks your App Store receipts and never charges you. It goes live with billing in the App Store build.',
    );
  };

  const handleParsingPrivacy = () => {
    tap();
    Alert.alert(
      'How parsing works',
      'Notes are parsed on Recore’s server; the AI key lives only there, never on your phone. Your note text is never logged, and your raw words stay the record — on this device and in your own account.',
    );
  };

  const handleDeleteAccount = () => {
    tap();
    Alert.alert(
      'Delete account',
      'This removes your notes, records and plans within 30 days. Account deletion ships with the App Store build — export everything from Your data first; your words are never held hostage.',
    );
  };

  const dataCaption =
    importMessage ??
    exportMessage ??
    'Export and deletion stay available even without an active subscription.';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Back header — a pushed screen, so a chevron, not a fake grabber. */}
      <View style={styles.nav}>
        <PressableScale
          onPress={handleClose}
          haptic="none"
          activeScale={0.92}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
          pressedStyle={styles.backBtnPressed}>
          <Icon name="chevron-back" size={moderateScale(16)} tint={t.ink} />
        </PressableScale>
        <Text style={styles.navTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Settings
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
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

        {/* TRAINING — calm value rows that expand inline to a segmented editor. */}
        <Section label="Training" footnote="Predictions round to what your gym’s bar can actually hold.">
          <AccordionRow
            label="Focus"
            value={labelOf(GOAL_OPTIONS, goal)}
            open={expanded === 'focus'}
            onToggle={() => toggle('focus')}
            divider>
            <Segmented options={GOAL_OPTIONS} selected={goal} onSelect={handleGoal} />
          </AccordionRow>
          <AccordionRow
            label="Writing language"
            value={labelOf(LANGUAGE_OPTIONS, language)}
            open={expanded === 'language'}
            onToggle={() => toggle('language')}
            divider>
            <Segmented options={LANGUAGE_OPTIONS} selected={language} onSelect={handleLanguage} />
          </AccordionRow>
          <AccordionRow
            label="Smallest plate"
            value={plate != null ? `${fmtNumber(plate)} kg` : 'Not set'}
            open={expanded === 'plate'}
            onToggle={() => toggle('plate')}
            divider>
            <Segmented options={PLATE_SEG} selected={plate} onSelect={handlePlate} mono />
          </AccordionRow>
          <AccordionRow
            label="Bar weight"
            value={`${bar} kg`}
            open={expanded === 'bar'}
            onToggle={() => toggle('bar')}
            divider>
            <Segmented options={BAR_SEG} selected={bar} onSelect={handleBar} mono />
          </AccordionRow>
        </Section>

        {/* SUBSCRIPTION — honest beta state; all three real actions preserved. */}
        <Section label="Subscription" footnote="Everything is unlocked while Recore is in beta.">
          <Row
            label="Recore Pro"
            value="Beta · billing off"
            onPress={() => {
              tap();
              router.push('/paywall');
            }}
          />
          <Row label="Manage in App Store" external divider onPress={handleManage} />
          <Row label="Restore purchases" divider onPress={handleRestore} />
        </Section>

        {/* YOUR DATA — free-forever CSV export/import; caption doubles as result. */}
        <Section label="Your data" footnote={dataCaption} footnoteActive={importMessage != null || exportMessage != null}>
          <Row
            label="Export everything"
            sub="Original notes + structured record"
            onPress={() => void handleExport()}
          />
          <Row
            label={busy === 'import' ? 'Importing…' : 'Import from Strong or Hevy'}
            divider
            disabled={busy !== null}
            onPress={() => void handleImport()}
          />
        </Section>

        {/* PARSING & PRIVACY — the real explainer + the static guarantee. */}
        <Section label="Privacy">
          <Row label="How parsing works" onPress={handleParsingPrivacy} />
          <Row
            label="Note parsing"
            sub="Only note text is sent, never stored in logs"
            chevron={false}
            divider
          />
        </Section>

        {/* SUPPORT — the real replay-onboarding action. */}
        <Section label="Support">
          <Row label="Restart onboarding" onPress={handleReplaySetup} />
        </Section>

        {/* ACCOUNT — real sign out; delete is an honest disclosure (beta). */}
        <Section label="Account">
          <Row
            label={busy === 'signout' ? 'Signing out…' : 'Sign out'}
            labelBold
            chevron={false}
            disabled={busy !== null}
            onPress={() => void handleSignOut()}
          />
          <Row
            label="Delete account"
            danger
            labelBold
            sub="Removes notes, records and plans within 30 days"
            chevron={false}
            divider
            onPress={handleDeleteAccount}
          />
        </Section>

        <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore <Text style={styles.versionNum}>{Constants.expoConfig?.version ?? ''}</Text>
        </Text>
        </Stagger>
      </ScrollView>
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
  const styles = useStyles();
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

/** A grouped-list row: label (+ optional subline) left, value / chevron right. */
function Row({
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
  const styles = useStyles();
  const t = useTheme();
  const body = (
    <>
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
        {chevron ? <Icon name="chevron-forward" size={moderateScale(14)} tint={t.inkFaint} /> : null}
      </View>
    </>
  );

  if (!onPress) return <View style={[styles.row, divider && styles.rowDivider]}>{body}</View>;
  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      haptic="none"
      activeScale={0.99}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.row, divider && styles.rowDivider]}
      pressedStyle={styles.rowPressed}>
      {body}
    </PressableScale>
  );
}

/** A value row (label · current value · chevron) that expands inline to reveal
 * its segmented editor — the calm "settings" read, with the control on demand. */
function AccordionRow({
  label,
  value,
  open,
  onToggle,
  divider = false,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  divider?: boolean;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const reduce = useReducedMotion();
  return (
    <Animated.View
      layout={reduce ? undefined : LinearTransition.duration(timing.base.duration).easing(easing.emphasized)}
      style={divider ? styles.rowDivider : undefined}>
      <PressableScale
        onPress={onToggle}
        haptic="none"
        activeScale={0.99}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={styles.row}
        pressedStyle={styles.rowPressed}>
        <Text style={styles.rowLabel} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
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
      {open ? (
        <Animated.View
          entering={reduce ? undefined : FadeIn.duration(timing.fast.duration).delay(40)}
          exiting={reduce ? undefined : FadeOut.duration(timing.fast.duration)}
          style={styles.editor}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** The accordion's disclosure chevron — springs 0°→180° on open (reduceMotion-safe).
 * The row height still animates via LayoutAnimation; this just spins the caret. */
function Chevron({ open }: { open: boolean }) {
  // `palette`, not `t` — this component already owns a shared value called `t`.
  const palette = useTheme();
  const reduce = useReducedMotion();
  const t = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    t.value = reduce ? (open ? 1 : 0) : withSpring(open ? 1 : 0, spring.snap);
  }, [open, reduce, t]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 180}deg` }] }));
  return (
    <Animated.View style={spin}>
      <Icon name="chevron-down" size={moderateScale(14)} tint={palette.inkFaint} />
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
  const styles = useStyles();
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

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backBtn: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: radius.capsule,
    borderWidth: 1,
    borderColor: t.rule,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    backgroundColor: t.surfaceHigh,
  },
  navTitle: {
    ...type.title3,
    fontWeight: '700',
    color: t.ink,
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
    borderColor: t.rule,
    backgroundColor: t.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    ...type.title3,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: t.ink,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    ...type.title2,
    color: t.ink,
  },
  profileEmail: {
    marginTop: 2,
    ...type.callout,
    color: t.inkMuted,
  },
  profileProvider: {
    marginTop: 2,
    ...type.caption,
    color: t.inkFaint,
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
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.rule,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg + 2,
    ...t.shadow.card,
  },

  // Rows.
  row: {
    minHeight: moderateScale(48),
    paddingVertical: spacing.md + 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowDivider: {
    // A row rule, not a container edge — hairline at `border` (see Divider).
    borderTopWidth: hairline,
    borderTopColor: t.rule,
  },
  rowPressed: {
    backgroundColor: t.surfaceHigh,
  },
  rowLeft: {
    flexShrink: 1,
  },
  rowLabel: {
    ...type.callout,
    color: t.ink,
  },
  rowLabelBold: {
    fontWeight: '600',
  },
  rowLabelDanger: {
    color: t.danger,
  },
  rowSub: {
    ...type.caption,
    lineHeight: moderateScale(16),
    color: t.inkFaint,
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
    ...type.callout,
    color: t.inkMuted,
    textAlign: 'right',
  },
  rowValueOpen: {
    color: t.ink,
    fontWeight: '600',
  },
  external: {
    fontFamily: mono.medium,
    fontSize: moderateScale(14),
    color: t.inkFaint,
  },

  // Inline segmented editor (revealed by an AccordionRow).
  editor: {
    paddingBottom: spacing.md,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: t.surfaceHigh,
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
    backgroundColor: t.surface,
    borderColor: t.rule,
  },
  segmentLabel: {
    ...type.caption,
    fontWeight: '600',
    color: t.inkMuted,
  },
  segmentMono: {
    fontFamily: mono.medium,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  segmentLabelSelected: {
    color: t.ink,
  },

  footnote: {
    ...type.caption,
    lineHeight: moderateScale(16),
    color: t.inkFaint,
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
  },
  footnoteActive: {
    color: t.inkMuted,
  },
  version: {
    ...type.caption,
    color: t.inkFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  versionNum: {
    fontFamily: mono.medium,
    fontVariant: ['tabular-nums'],
    color: t.inkFaint,
  },
}));
