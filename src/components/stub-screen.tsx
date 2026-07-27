import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { tap } from '@/lib/haptics';
import { color, HIT, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

import { Icon } from './icon';
import { PressableScale } from './motion';

/**
 * Shared scaffold for stub routes (/stats, /onboarding, /paywall): a quiet
 * header with a back chevron and a muted one-liner. The real screens replace
 * the body later; the routes and navigation are already final.
 */
export function StubScreen({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
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
        <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {title}
        </Text>
        <View style={styles.back} />
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
    height: HIT,
    paddingHorizontal: spacing.lg,
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
