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
 */
export function StubScreen({
  title,
  note,
  back = true,
  children,
}: {
  title: string;
  note?: string;
  /** False on a tab root: no chevron, left-aligned title. */
  back?: boolean;
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
        <Text
          style={[styles.title, back ? null : styles.titleRoot]}
          accessibilityRole="header"
          maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        {back ? <View style={styles.back} /> : null}
      </View>

      <View style={styles.body}>
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
  title: {
    flex: 1,
    textAlign: 'center',
    color: color.textPrimary,
    fontSize: type.headline.fontSize,
    fontWeight: '600',
  },
  titleRoot: {
    ...type.title2,
    textAlign: 'left',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.lg,
  },
  note: {
    ...type.subhead,
    color: color.textMuted,
  },
});
