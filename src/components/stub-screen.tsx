import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { color, HIT, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { Icon } from './icon';
import { PressableScale } from './motion';

/**
 * Shared scaffold for Progress and Lifts — the two screens that wear a plain
 * header: a quiet header and a muted one-liner. (It read "stub routes
 * (/onboarding, /paywall)" until 29 July; both of those have owned their own
 * chrome for a while. §0.3 — the code wins, and the line is fixed here.)
 *
 * `back` is false on a tab root — a tab is not a push, so there is nothing to go
 * back to, and a chevron that pops to nowhere is a lie about the navigation. In
 * that shape the title also goes left-aligned, which is the §6.5 headline
 * direction anyway; the centred title only exists to balance the chevron.
 *
 * `large` + `subtitle` are the 17 Aug shape (owner, Progression mockup): a
 * standing-large title with one counted line under it, tight, the way iOS sets
 * a large-title header. `subtitle` belongs to the HEADER and hugs the title;
 * `note` stays a body line with the body's own breathing room. A screen that
 * passes a subtitle also loses the body's top padding, because the subtitle has
 * already done that job and doubling it opens a hole under the header.
 */
export function StubScreen({
  title,
  subtitle,
  note,
  back = true,
  large = false,
  children,
}: {
  title: string;
  /** One counted line directly under the title, inside the header. */
  subtitle?: string;
  note?: string;
  /** False on a tab root: no chevron, left-aligned title. */
  back?: boolean;
  /** Tab-root only: set the title at `largeTitle` instead of `title2`. */
  large?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={[styles.header, back ? null : styles.headerRoot]}>
        {back ? (
          <PressableScale
            onPress={() => {
              tap();
              router.back();
            }}
            haptic="none"
            activeScale={0.9}
            hitSlop={spacing.sm}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Icon name="chevron-back" size={moderateScale(22)} tint={color.textSecondary} />
          </PressableScale>
        ) : null}
        <View style={styles.titleWrap}>
          <Text
            style={[styles.title, back ? null : large ? styles.titleLarge : styles.titleRoot]}
            accessibilityRole="header"
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {back ? <View style={styles.back} /> : null}
      </View>

      <View style={[styles.body, subtitle ? styles.bodyTight : null]}>
        {note ? (
          <Text style={styles.note} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {note}
          </Text>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // minHeight, never height: at accessibilityLarge a 22pt title is taller than
    // the 44pt tap target and a fixed height would crop its own label.
    minHeight: HIT,
    paddingHorizontal: spacing.lg,
  },
  headerRoot: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  back: {
    width: HIT,
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    textAlign: 'center',
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
  titleRoot: {
    ...type.title2,
    textAlign: 'left',
  },
  titleLarge: {
    ...type.largeTitle,
    textAlign: 'left',
  },
  subtitle: {
    ...type.subhead,
    marginTop: 2,
    color: color.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  bodyTight: {
    paddingTop: spacing.lg,
  },
  note: {
    ...type.subhead,
    color: color.textMuted,
  },
});
