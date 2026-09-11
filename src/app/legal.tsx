import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { tap } from '@/lib/haptics';
import { legalDoc, type LegalLink } from '@/lib/legal';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  color,
  HIT,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

/**
 * /legal — the app's plain-text documents: Terms of Use, the Privacy Policy and
 * "How parsing works" (PLAN A3 + C3). One route, three documents, chosen by the
 * `doc` param.
 *
 * WHY A SCREEN AND NOT A BROWSER. These are the two words App Review taps on a
 * subscription screen, so they must open instantly, on a plane, on a phone that
 * has never had a connection — and before the owner has hosted anything. The
 * same text is written to `docs/` by `scripts/build-legal-html.ts` for the two
 * public URLs App Store Connect requires; one source, so the two can never
 * drift (see `src/lib/legal.ts`).
 *
 * It is a reading surface: no green, no emoji (the app is reporting, not
 * asking — §5.7), generous measure, and every tappable row clears 44 pt.
 */
export default function Legal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { doc: param } = useLocalSearchParams<{ doc?: string }>();
  const doc = legalDoc(param);

  const openLink = (link: LegalLink) => {
    tap();
    if (link.url) {
      void Linking.openURL(link.url).catch(() => {});
      return;
    }
    if (link.doc) router.push({ pathname: '/legal', params: { doc: link.doc } });
  };

  return (
    <>
      {/* THE CHROME IS UIKIT'S (10 September 2026), and it deleted a
          duplication: this screen drew a small centred nav title AND the same
          words again at `type.title` two lines below it. The system's large
          title is that second one — it stands at the top of the page, collapses
          into the bar as the document travels under it, and takes the back
          control and the edge-swipe affordance with it. The preset lives in
          `_layout.tsx`.

          It matters here more than anywhere: these are the two words App Review
          taps on a subscription screen, and they are reached from the paywall
          and from sign-in, before an account exists. */}
      <Stack.Screen options={{ title: doc.title, headerLargeTitle: true }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <Stagger step={40} initialDelay={60}>
          <Text style={styles.updated} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Last updated {doc.updated}
          </Text>
          <Text style={styles.intro} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {doc.intro}
          </Text>

          {doc.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Eyebrow tone="secondary">{section.heading}</Eyebrow>
              {section.body.map((line, i) => (
                <Paragraph key={i} line={line} onOpenUrl={(url) => openLink({ label: url, url })} />
              ))}
              {section.links?.map((link) => (
                <PressableScale
                  key={link.label}
                  onPress={() => openLink(link)}
                  haptic="none"
                  activeScale={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={link.label}
                  style={styles.linkRow}>
                  <Text style={styles.linkRowLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {link.label}
                  </Text>
                  <Icon
                    name={link.url ? 'share' : 'chevron-forward'}
                    size={moderateScale(14)}
                    tint={color.textMuted}
                  />
                </PressableScale>
              ))}
            </View>
          ))}
        </Stagger>
      </ScrollView>
    </>
  );
}

/** A paragraph, a "· " bullet, or a bare URL rendered as a tappable link. */
function Paragraph({ line, onOpenUrl }: { line: string; onOpenUrl: (url: string) => void }) {
  if (line.startsWith('http')) {
    return (
      <Text
        style={[styles.body, styles.inlineLink]}
        onPress={() => onOpenUrl(line)}
        accessibilityRole="link"
        maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {line}
      </Text>
    );
  }
  if (line.startsWith('· ')) {
    return (
      <View style={styles.bulletRow}>
        <Text style={styles.bulletDot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          ·
        </Text>
        <Text style={[styles.body, styles.bulletText]} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {line.slice(2)}
        </Text>
      </View>
    );
  }
  return (
    <Text style={styles.body} maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  /**
   * THE CANVAS IS THE SCROLL VIEW'S OWN BACKGROUND, and that is the whole
   * reason this screen can have both a paper canvas and a collapsing title.
   * `(tabs)/next/_layout.tsx` has the measurement.
   */
  scroll: {
    flex: 1,
    experimental_backgroundImage: PAPER_FIELD_CSS,
  },
  /** ONE GUTTER, `spacing.lg` — the system's large title hangs off its own
   * inset. The top padding is UIKit's now. */
  content: {
    paddingHorizontal: spacing.lg,
  },
  updated: {
    ...type.footnote,
    color: color.textMuted,
  },
  intro: {
    marginTop: spacing.lg,
    ...type.subhead,
    lineHeight: lineFor(24),
    color: color.textPrimary,
  },
  section: {
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  body: {
    ...type.subhead,
    lineHeight: lineFor(24),
    color: color.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulletDot: {
    ...type.subhead,
    lineHeight: lineFor(24),
    color: color.textMuted,
  },
  bulletText: {
    flex: 1,
  },
  inlineLink: {
    color: color.textPrimary,
    textDecorationLine: 'underline',
  },
  linkRow: {
    marginTop: spacing.xs,
    minHeight: HIT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    // A row, so `lg` 20 — `md` 14 is a button's radius.
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: color.surface,
  },
  linkRowLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
});
