import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeSlideIn, Stagger } from '@/components/motion';
import { AppButton, Eyebrow } from '@/components/primitives';
import {
  markImportCompleted,
  markImported,
  markImportOfferShown,
  markImportStarted,
} from '@/lib/funnel';
import { tap } from '@/lib/haptics';
import { pickAndImportCsv } from '@/lib/import/pick';
import { rowCountBucket } from '@/lib/onboarding';
import { getObTracker, markImportOffered } from '@/lib/prefs';
import { color, MAX_FONT_SCALE, moderateScale, radius, spacing, type } from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * /import-start — the tracker-import fast path (product-direction §2.1).
 *
 * WHY THIS SCREEN EXISTS, in the spec's own words: "an empty history means an
 * empty Progress tab on the day the trial decision is made. Imported history is
 * the single strongest lever on trial-to-paid conversion, so it must not be
 * buried in settings for these users."
 *
 * Before this change import lived in exactly one place — a row in You — and the
 * screen-11 answer that identified these people was stored and read by nothing.
 *
 * THE RULES IT KEEPS:
 *
 *  · It appears ONCE, immediately after the trial starts and before the
 *    first-open walkthrough, so the tour can point at real data (§7).
 *  · **Skipping is one tap and never punished.** No second ask, no guilt line,
 *    no "are you sure". `markImportOffered` fires on arrival, not on success,
 *    so a person who backs out is not shown it again on the next launch.
 *  · Only people who said Strong or Hevy on screen 11 ever reach it
 *    (`wantsImportFastPath`); someone who tracks in notes has no CSV to give
 *    and would just be looking at a dead end.
 *  · It cannot strand anyone: every path out of here lands on Today.
 *
 * The dispatcher (`app/index.tsx`) decides who arrives; this screen only has to
 * be honest once they do.
 */
export default function ImportStart() {
  const router = useRouter();
  const userId = useSession((s) => s.userId);
  const hydrate = useSession((s) => s.hydrate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tracker] = useState(() => getObTracker());

  const appName = tracker === 'hevy' ? 'Hevy' : 'Strong';

  /**
   * Offered means SHOWN, not completed. Marked on mount so a person who taps
   * Skip, force-quits, or fails an import is never asked a second time — §2.1
   * allows one offer, and "never punished" includes not being nagged.
   */
  useEffect(() => {
    markImportOffered();
    markImportOfferShown();
  }, []);

  const leave = () => {
    router.replace('/today');
  };

  const handleSkip = () => {
    tap();
    leave();
  };

  const handleImport = async () => {
    if (busy || !userId) return;
    tap();
    setBusy(true);
    setMessage(null);
    markImportStarted();
    try {
      const outcome = await pickAndImportCsv(userId);
      switch (outcome.status) {
        case 'done': {
          markImported();
          // A bucket, never an exact count (§13: "row count bucket (no lift
          // names)"). An exact number from a small user base starts to
          // identify someone; a bucket cannot.
          markImportCompleted(rowCountBucket(outcome.sets));
          hydrate(userId);
          leave();
          return;
        }
        case 'cancelled':
          // They closed the file picker. Not an error, not phrased as one.
          return;
        case 'invalid':
          setMessage(
            `That file is not a ${appName} export. Look for the CSV ${appName} emails you, or skip and do it later from You.`,
          );
          return;
        default:
          setMessage('That file could not be read. You can try again or skip and do it later.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Stagger initialDelay={60} step={70} distance={14}>
          <Eyebrow tone="secondary">Your history</Eyebrow>
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`Bring your ${appName}\nhistory with you.`}
          </Text>
          <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {`One CSV out of ${appName} carries every session and every set you logged there. Recore reads it into your record directly — no parsing, no waiting, and nothing is sent anywhere to do it.`}
          </Text>

          <View style={styles.steps}>
            <Step index="01" text={`Export your data from ${appName} — it arrives as a CSV.`} />
            <Step index="02" text="Tap the button below and pick that file." />
            <Step index="03" text="Progress and Next have real evidence from your first day." />
          </View>
        </Stagger>

        <FadeSlideIn delay={280} style={styles.bottom}>
          {message ? (
            <Text style={styles.message} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {message}
            </Text>
          ) : null}
          <AppButton
            label={busy ? 'Reading your file…' : `Import from ${appName}`}
            loading={busy}
            disabled={busy}
            onPress={() => void handleImport()}
          />
          {/* One tap out, at full size, with no friction and no warning — §2.1:
              "Skipping import is one tap and never punished." */}
          <AppButton
            label="Not now"
            variant="ghost"
            disabled={busy}
            onPress={handleSkip}
            style={styles.skip}
          />
          <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Import stays in You for whenever you want it.
          </Text>
        </FadeSlideIn>
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ index, text }: { index: string; text: string }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepIndex} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {index}
      </Text>
      <Text style={styles.stepText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  title: {
    marginTop: spacing.sm,
    ...type.title,
    color: color.textPrimary,
  },
  body: {
    marginTop: spacing.md,
    ...type.subhead,
    lineHeight: moderateScale(23),
    color: color.textSecondary,
  },
  steps: {
    marginTop: spacing.xxl,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  stepIndex: {
    ...type.footnote,
    color: color.textMuted,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  stepText: {
    flex: 1,
    ...type.footnote,
    lineHeight: moderateScale(19),
    color: color.textSecondary,
  },
  bottom: {
    marginTop: 'auto',
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  skip: {
    marginTop: spacing.xs,
  },
  message: {
    marginBottom: spacing.sm,
    ...type.footnote,
    lineHeight: moderateScale(18),
    color: color.textSecondary,
    textAlign: 'center',
  },
  foot: {
    marginTop: spacing.xs,
    ...type.footnote,
    color: color.textMuted,
    textAlign: 'center',
  },
});
