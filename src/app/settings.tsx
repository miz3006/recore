import Constants from 'expo-constants';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { StubScreen } from '@/components/stub-screen';
import { signOut } from '@/lib/auth/sign-in';
import { tap, tapMedium } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { scheduleSync } from '@/lib/sync/index';
import { color, CONTROL_HEIGHT, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /settings: import (Hevy/Strong CSV — the fastest way to make predictions and
 * comparisons useful on day one) and sign out. Profile, goals, gym profile,
 * units, and export land here later.
 */
export default function Settings() {
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  const [busy, setBusy] = useState<null | 'import' | 'signout'>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

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

  return (
    <StubScreen title="Settings">
      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          data
        </Text>
        <View style={styles.card}>
          <Pressable
            disabled={busy !== null}
            onPress={() => void handleImport()}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.rowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {busy === 'import' ? 'Importing…' : 'Import from Hevy or Strong'}
            </Text>
            <Icon name="chevron-forward" size={moderateScale(15)} tint={color.textMuted} />
          </Pressable>
        </View>
        <Text
          style={[styles.sectionFootnote, importMessage != null && styles.footnoteActive]}
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {importMessage ?? 'Your history makes comparisons and predictions useful from day one.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          account
        </Text>
        <View style={styles.card}>
          <Pressable
            disabled={busy !== null}
            onPress={() => void handleSignOut()}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Text style={styles.signOutLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {busy === 'signout' ? 'Signing out…' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.version} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Recore {Constants.expoConfig?.version ?? ''}
      </Text>
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...type.caption,
    color: color.textMuted,
    marginLeft: spacing.lg,
  },
  // Grouped inset card — rows separated by hairlines, never heavy dividers.
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    height: CONTROL_HEIGHT,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: color.surfaceHigh,
  },
  rowLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.textPrimary,
  },
  sectionFootnote: {
    ...type.caption,
    color: color.textMuted,
    marginLeft: spacing.lg,
  },
  footnoteActive: {
    color: color.textSecondary, // an actual result speaks a step louder
  },
  signOutLabel: {
    fontSize: type.subhead.fontSize,
    fontWeight: '500',
    color: color.error, // destructive: error text only (CLAUDE.md §5)
  },
  version: {
    ...type.caption,
    color: color.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
    paddingBottom: spacing.lg,
  },
});
