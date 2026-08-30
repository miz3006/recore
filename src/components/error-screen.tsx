import type { ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton, Eyebrow } from '@/components/primitives';
import { reportCrash } from '@/lib/crash';
import { color, lineFor, MAX_FONT_SCALE, radius, spacing, type } from '@/lib/theme';

/**
 * THE LAST SCREEN. Exported as `ErrorBoundary` from `app/_layout.tsx`, so it
 * catches anything that throws while rendering the app under it.
 *
 * Until this existed, an uncaught render error in a release bundle closed
 * Recore outright: no screen, no explanation, and — with no crash reporter
 * installed — no way for the person to tell us anything except "it quit". A
 * beta tester cannot report a stack trace they never saw.
 *
 * ## What it says, and what it refuses to say
 *
 * The one fact that matters to someone whose training app just fell over is
 * that their record is untouched, and that is true by construction: every line
 * is written to the local database in the instant it is typed (CLAUDE.md §3 —
 * raw text is the source of truth), so a screen that failed to draw has lost
 * nothing. The copy states exactly that and nothing more. No apology theatre,
 * no "oops", no blame, and no promise that trying again will work — `retry`
 * re-renders the route, which fixes a transient failure and repeats a
 * deterministic one, and the button says only what it does.
 *
 * The error's own message is printed, selectable, even though `lib/crash.ts`
 * now sends the same failure to Sentry. The two are not redundant: a report
 * only leaves a build with a DSN compiled in and a connection to send it on,
 * and a person is entitled to see what their app said about itself either way.
 * A screenshot of this line is still a complete bug report.
 *
 * ## It cannot use the app's context
 *
 * A boundary exported from the ROOT layout replaces that layout, so nothing it
 * would have mounted is available here: no `SafeAreaProvider`, no
 * `GestureHandlerRootView`, no auth. Hence plain views, generous padding
 * instead of insets, and only components that stand on their own
 * (`AppButton` → `PressableScale` → RN `Pressable` + Reanimated). Anything
 * reaching for a provider would throw a second error inside the first one.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // `_layout.tsx` holds the splash until the persisted session resolves. If the
  // crash happened before that, the native image is still covering the window —
  // including this screen. Nothing here waits on anything, so it can go now.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // React hands a render error to this boundary and never to the global
  // handler, so the one crash the person actually SEES is the one Sentry would
  // otherwise never hear about. Keyed on the error, so a retry that fails again
  // is reported again — a second failure is the interesting one. A no-op when
  // no DSN is compiled in (`lib/crash.ts`).
  useEffect(() => {
    reportCrash(error, 'root-error-boundary');
  }, [error]);

  const detail = error?.message?.trim() || error?.name || 'No further detail.';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Eyebrow tone="secondary">Recore</Eyebrow>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
          This screen stopped.
        </Text>
        <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Your record is safe. Everything you have written is on this device and none of it was
          lost — the screen failed to draw, not the training underneath it.
        </Text>

        <AppButton label="Try again" onPress={() => void retry()} style={styles.cta} />

        <View style={styles.detail}>
          <Eyebrow>What happened</Eyebrow>
          <Text style={styles.detailText} selectable maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {detail}
          </Text>
        </View>
        <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          If it happens again, a screenshot of this line is the whole bug report.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    // No safe-area provider here (see the header): the vertical padding is
    // generous enough to clear a notch and a home indicator on its own, and the
    // content is centred, so it never sits under either.
    paddingVertical: spacing.giant,
  },
  title: {
    ...type.title,
    color: color.textPrimary,
    marginTop: spacing.sm,
  },
  body: {
    ...type.body,
    lineHeight: lineFor(25),
    color: color.textSecondary,
    marginTop: spacing.md,
  },
  cta: {
    marginTop: spacing.xxl,
  },
  detail: {
    marginTop: spacing.xxl,
    padding: spacing.lg,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  detailText: {
    ...type.caption,
    color: color.textSecondary,
  },
  note: {
    ...type.footnote,
    color: color.textMuted,
    marginTop: spacing.md,
  },
});
