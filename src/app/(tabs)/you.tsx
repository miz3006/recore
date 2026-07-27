import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { useAuth } from '@/lib/auth/provider';
import { signOut } from '@/lib/auth/sign-in';
import { tap, tapMedium } from '@/lib/haptics';
import { DEV_LOCAL_USER_ID, isDevBypassed } from '@/lib/auth/dev-bypass';
import { clearDevSeed, seedDevData } from '@/lib/dev-seed';
import { pickAndImportCsv } from '@/lib/import/pick';
import {
  getName,
  getObLanguage,
  getRestSeconds,
  getSmallestPlateKg,
  getWeeklyTarget,
  getWeightUnit,
  setWeeklyTarget,
  setWeightUnit,
} from '@/lib/prefs';
import {
  eyebrow,
  hairline,
  HIT,
  makeStyles,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
  useTheme,
  space,
} from '@/lib/theme';

/**
 * You (CLAUDE.md §11.3) — "Change something."
 *
 * A grouped list and nothing more elaborate. This tab is opened rarely and §5.1
 * says that is fine. The six groups are §11.3's, in §11.3's order.
 *
 * Rows either do the real thing or say plainly which work brings them. Nothing
 * here pretends: a control that looks live but is not is the same lie as a
 * fabricated review (§13.10), only quieter. The footer states the §4.10 promise
 * because it is the one thing on this screen a user might not believe.
 */

const LANGUAGE_LABEL: Record<string, string> = {
  en: 'English',
  slo: 'Slovenščina',
  both: 'English and Slovenščina',
};

type Styles = ReturnType<typeof useStyles>;

export default function You() {
  const styles = useStyles();
  const t = useTheme();
  const router = useRouter();
  const { session } = useAuth();

  const [unit, setUnit] = useState(() => getWeightUnit() ?? 'kg');
  const [target, setTarget] = useState(getWeeklyTarget);

  const plate = getSmallestPlateKg();
  const rest = getRestSeconds();
  const language = getObLanguage() ?? 'en';
  const name = getName();

  const toggleUnit = () => {
    tap();
    const next = unit === 'kg' ? 'lb' : 'kg';
    setUnit(next);
    setWeightUnit(next);
  };

  // Cycles 2 → 6 and wraps. §11.3's caption is the point: pick what you actually
  // do, not what you wish you did — it is the only input to the streak (§15.3).
  const cycleTarget = () => {
    tap();
    const next = target >= 6 ? 2 : target + 1;
    setTarget(next);
    setWeeklyTarget(next);
  };

  const handleSignOut = () => {
    tapMedium();
    Alert.alert('Sign out', 'Your training stays on this phone and syncs back when you return.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const handleImport = () => {
    tap();
    const userId = session?.user.id;
    if (!userId) {
      Alert.alert('Import', 'Sign in first — an import needs an account to belong to.');
      return;
    }
    void pickAndImportCsv(userId).catch(() => {
      Alert.alert('Import', 'That file could not be read. Export a fresh CSV and try again.');
    });
  };

  const seedUserId = session?.user.id ?? (isDevBypassed() ? DEV_LOCAL_USER_ID : null);

  const handleSeed = () => {
    tapMedium();
    if (!seedUserId) return;
    const { sessions, sets } = seedDevData(seedUserId);
    Alert.alert('Demo data', `Wrote ${sessions} sessions and ${sets} sets across 12 weeks.`);
  };

  const handleClearSeed = () => {
    tapMedium();
    if (!seedUserId) return;
    clearDevSeed(seedUserId);
    Alert.alert('Demo data', 'Removed. Anything you logged yourself is untouched.');
  };

  /** An honest placeholder: names the row and the work that finishes it. */
  const pending = (what: string, when: string) => () => {
    tap();
    Alert.alert(what, `${what} arrives with ${when}.`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          You
        </Text>

        {/* Identity as a block, not a list row (Starbucks, BeReal, Satispay all
            separate "who you are" from "what you can change"). No avatar: §6.10
            ships no custom icon set and an initial in a circle is decoration. */}
        <View style={styles.identity}>
          <Text style={styles.identityName} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {name ?? 'Your record'}
          </Text>
          <Text style={styles.identityMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {session?.user.email ?? 'Saved on this phone'}
          </Text>
        </View>

        <Group title="Account" styles={styles}>
          <Row
            styles={styles}
            label="Replay setup"
            hint="Name, goal, language, units"
            onPress={() => router.push('/onboarding')}
            last
          />
        </Group>

        <Group title="Subscription" styles={styles}>
          <Row styles={styles} label="Plan" value="Free while in beta" />
          <Row
            styles={styles}
            label="Manage in App Store"
            onPress={() => {
              tap();
              void Linking.openURL('https://apps.apple.com/account/subscriptions');
            }}
          />
          <Row styles={styles} label="Restore purchases" onPress={pending('Restore purchases', 'billing')} last />
        </Group>

        <Group title="Training" styles={styles}>
          <Row styles={styles} label="Units" mono value={unit} onPress={toggleUnit} />
          <Row styles={styles} label="Smallest plate" mono value={`${plate} kg`} onPress={pending('Smallest plate', 'the training settings')} />
          <Row styles={styles} label="Default rest" mono value={`${Math.round(rest / 60)} min`} onPress={pending('Default rest', 'the rest timer')} />
          <Row styles={styles} label="Weekly target" mono value={`${target} / week`} onPress={cycleTarget} last />
        </Group>

        <Group title="Parsing" styles={styles}>
          <Row
            styles={styles}
            label="Writing language"
            value={LANGUAGE_LABEL[language] ?? 'English'}
            onPress={pending('Writing language', 'the parser work')}
          />
          <Row styles={styles} label="What we send, and what we don't" onPress={pending('What we send', 'the privacy page')} last />
        </Group>

        <Group title="Your data" styles={styles}>
          <Row styles={styles} label="Export CSV" onPress={pending('Export CSV', 'the export work')} />
          <Row styles={styles} label="Export JSON" onPress={pending('Export JSON', 'the export work')} />
          <Row styles={styles} label="Import from Hevy or Strong" onPress={handleImport} last />
        </Group>

        {__DEV__ ? (
          <Group title="Development" styles={styles}>
            <Row
              styles={styles}
              label="Seed demo data"
              hint="12 weeks, push/pull/legs, with a deload and a missed week"
              onPress={handleSeed}
            />
            <Row styles={styles} label="Remove demo data" onPress={handleClearSeed} last />
          </Group>
        ) : null}

        <Group title="About" styles={styles}>
          <Row styles={styles} label="Terms" onPress={pending('Terms', 'launch')} />
          <Row styles={styles} label="Privacy" onPress={pending('Privacy', 'launch')} />
          <Row styles={styles} label="Contact" onPress={pending('Contact', 'launch')} last />
        </Group>

        {/* Destructive actions sit OUTSIDE the groups, at the end — the shape
            Starbucks, TIDE, Satispay and Todoist all converge on. You cannot
            reach them by drifting down a list of preferences. */}
        <View style={styles.dangerZone}>
          <PressableScale onPress={handleSignOut} activeScale={0.99} haptic="none" accessibilityRole="button">
            <View style={styles.dangerRow}>
              <Text style={[styles.dangerLabel, { color: t.ink }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Sign out
              </Text>
            </View>
          </PressableScale>
          <PressableScale
            onPress={pending('Delete everything', 'the data work')}
            activeScale={0.99}
            haptic="none"
            accessibilityRole="button">
            <View style={[styles.dangerRow, styles.dangerRowLast]}>
              <Text style={[styles.dangerLabel, { color: t.danger }]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Delete everything
              </Text>
            </View>
          </PressableScale>
        </View>

        <Text style={styles.footer} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your record is yours. Export is free and always available — including if you cancel.
        </Text>
        <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Recore 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({ title, children, styles }: { title: string; children: ReactNode; styles: Styles }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  label,
  value,
  hint,
  mono,
  onPress,
  tint,
  last,
  styles,
}: {
  label: string;
  value?: string;
  /** A muted second line naming what the row contains (the Satispay pattern). */
  hint?: string;
  /** True when the value is a training fact — those are set in mono (§6.5). */
  mono?: boolean;
  onPress?: () => void;
  tint?: string;
  last?: boolean;
  styles: Styles;
}) {
  const body = (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <View style={styles.rowText}>
        <Text
          style={[styles.rowLabel, tint ? { color: tint } : null]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label}
        </Text>
        {hint ? (
          <Text style={styles.rowHint} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={[styles.rowValue, mono ? styles.rowValueMono : null]}
          numberOfLines={1}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {value}
        </Text>
      ) : null}
    </View>
  );

  // A row with no action is information, not a control, so it must not press.
  if (!onPress) return body;
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.995}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}>
      {body}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  root: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: space[9],
  },
  title: {
    ...type.title1,
    color: t.ink,
    marginTop: spacing.md,
  },
  identity: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  identityName: {
    ...type.title2,
    color: t.ink,
  },
  identityMeta: {
    ...type.callout,
    color: t.inkFaint,
  },
  dangerZone: {
    marginTop: spacing.xxl,
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    overflow: 'hidden',
  },
  dangerRow: {
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: t.rule,
  },
  dangerRowLast: {
    borderBottomWidth: 0,
  },
  dangerLabel: {
    ...type.body,
    fontWeight: '600',
  },
  version: {
    ...eyebrow,
    color: t.inkFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  group: {
    marginTop: spacing.xl,
  },
  groupTitle: {
    ...eyebrow,
    color: t.inkFaint,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    overflow: 'hidden',
  },
  row: {
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderBottomWidth: hairline,
    borderBottomColor: t.rule,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowText: {
    flexShrink: 1,
  },
  rowLabel: {
    ...type.body,
    color: t.ink,
  },
  rowHint: {
    ...type.caption,
    color: t.inkFaint,
  },
  rowValue: {
    ...type.callout,
    color: t.inkMuted,
    textAlign: 'right',
    flexShrink: 0,
  },
  rowValueMono: {
    ...type.dataM,
    fontSize: moderateScale(14),
    color: t.inkMuted,
  },
  footer: {
    ...type.caption,
    color: t.inkFaint,
    lineHeight: moderateScale(19),
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
}));
