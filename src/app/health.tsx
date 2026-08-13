import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Section } from '@/components/settings-rows';
import { tap } from '@/lib/haptics';
import { color, lineFor, MAX_FONT_SCALE, moderateScale, spacing, type } from '@/lib/theme';

/**
 * APPLE HEALTH — not connected, and this screen says so out loud.
 *
 * TODO(owner): Apple Health is NOT implemented. There is no HealthKit code in
 * this repository — no dependency, no `com.apple.developer.healthkit`
 * entitlement, no `NSHealthShareUsageDescription` /
 * `NSHealthUpdateUsageDescription` in Info.plist. Shipping it needs all four
 * plus a native rebuild, and then a decision about what actually crosses:
 *   · OUT (safe, useful): finished sessions as workouts — start, duration,
 *     energy is NOT derivable so it must not be written.
 *   · IN (needs care): bodyweight, to keep §11's body context current.
 * Nothing is read or written until that exists.
 *
 * WHY THIS IS A SCREEN AND NOT A SWITCH. The settings design called for a
 * toggle here. A toggle is a promise that something happens when you flip it,
 * and a switch that stores a flag while no data moves is a fabricated feature —
 * the exact thing CLAUDE.md §2 invariant 7 forbids "anywhere, including
 * placeholders". Health data raises the stakes: a person who believes their
 * training is going to Health will stop checking, and the app will have lied
 * about the one category of data people trust least. A row that opens an honest
 * "not yet" costs one tap and tells the truth.
 */
export default function Health() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']}>
        <View style={styles.bar}>
          <PressableScale
            onPress={() => {
              tap();
              router.back();
            }}
            hitSlop={spacing.md}
            activeScale={0.9}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Icon name="chevron-back" size={moderateScale(22)} tint={color.textPrimary} />
          </PressableScale>
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Apple Health
          </Text>
          <View style={styles.barSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        <Section label="Not connected">
          <View style={styles.block}>
            <Text style={styles.lede} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recore does not read or write Apple Health.
            </Text>
            <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Nothing about your training leaves this app for Health, and nothing about your body
              comes in from it. There is no switch here yet because a switch would suggest
              otherwise.
            </Text>
            <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              When it does arrive it will be one direction at a time, each one asked for
              separately: finished sessions written out as workouts, and — only if you want it —
              your bodyweight read in so you do not have to type it twice.
            </Text>
          </View>
        </Section>

        <Section
          label="Meanwhile"
          footnote="Your record is complete and portable without Health: the export carries every session, including the words you wrote.">
          <View style={styles.block}>
            <Text style={styles.para} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              You → Your record → Export my record.
            </Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: {
    ...type.title2,
    color: color.textPrimary,
  },
  barSpacer: {
    width: moderateScale(22),
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  block: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  lede: {
    ...type.headline,
    color: color.textPrimary,
  },
  para: {
    ...type.subhead,
    lineHeight: lineFor(21),
    color: color.textSecondary,
  },
});
