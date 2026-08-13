import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale, Stagger } from '@/components/motion';
import { Eyebrow } from '@/components/primitives';
import { tap } from '@/lib/haptics';
import { legalDoc, type LegalLink } from '@/lib/legal';
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
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.nav}>
        <PressableScale
          onPress={() => {
            tap();
            router.back();
          }}
          haptic="none"
          activeScale={0.9}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
          pressedStyle={styles.pressedFill}>
          <Icon name="chevron-back" size={moderateScale(16)} tint={color.textPrimary} />
        </PressableScale>
        <Text style={styles.navTitle} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {doc.title}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        <Stagger step={40} initialDelay={60}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {doc.title}
          </Text>
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
                  activeScale={0.99}
                  accessibilityRole="button"
                  accessibilityLabel={link.label}
                  style={styles.linkRow}
                  pressedStyle={styles.pressedFill}>
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
    </SafeAreaView>
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
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  backBtn: {
    width: HIT,
    minHeight: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressedFill: {
    backgroundColor: color.surfaceHigh,
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  title: {
    ...type.title,
    color: color.textPrimary,
  },
  updated: {
    marginTop: spacing.xs,
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
    borderRadius: radius.md,
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
