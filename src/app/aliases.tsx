import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Section } from '@/components/settings-rows';
import {
  deleteAliasOverride,
  listAliasOverrides,
  type AliasOverrideView,
} from '@/lib/db/alias-overrides';
import { tap, tapMedium } from '@/lib/haptics';
import {
  color,
  fonts,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';
import { useSession } from '@/state/session-store';

/**
 * READING CORRECTIONS (You → Your record) — every shorthand this account has
 * taught the parser, and the exercise it now resolves to.
 *
 * WHY THE SCREEN EXISTS. Fixing a reading writes an alias override that lasts
 * forever and applies to every future note (`parse/correct.ts`). That is the
 * flywheel working, and until now it was completely invisible: a person who
 * once corrected "db" to Dumbbell Press had no way to see the rule, let alone
 * change their mind about it. A permanent decision the user cannot inspect is
 * not a preference, it is a surprise waiting to happen (§12 — the record is
 * theirs, and the rules it is read by are part of it).
 *
 * WHAT DELETING ONE DOES. It forgets the RULE, never the training. The lines
 * already written keep their corrected reading — that is stored separately, as
 * a correction row against the line text — and only the next new note will read
 * the shorthand the way the model does. Nothing in the record moves.
 */
export default function Aliases() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.userId);

  const [rows, setRows] = useState<AliasOverrideView[]>(() =>
    userId ? listAliasOverrides(userId) : [],
  );

  const remove = useCallback(
    (row: AliasOverrideView) => {
      if (!userId) return;
      Alert.alert(
        `Forget “${row.alias}”?`,
        `Recore will stop reading “${row.alias}” as ${row.canonical} in new notes. Everything you have already written keeps the reading it has.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Forget',
            style: 'destructive',
            onPress: () => {
              tapMedium();
              deleteAliasOverride(userId, row.alias);
              setRows(listAliasOverrides(userId));
            },
          },
        ],
      );
    },
    [userId],
  );

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
            Reading corrections
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
        {rows.length === 0 ? (
          <Section>
            <View style={styles.empty}>
              <Text style={styles.emptyTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Nothing taught yet
              </Text>
              <Text style={styles.emptyBody} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                When Recore reads a line wrong, fix it from the card — “Fix reading” — and change
                the exercise name. The shorthand you wrote is remembered here, and every note after
                it reads the way you meant.
              </Text>
            </View>
          </Section>
        ) : (
          <Section
            label={rows.length === 1 ? '1 shorthand' : `${rows.length} shorthands`}
            footnote="Swipe a row to forget it. Forgetting a shorthand never changes a session you have already written.">
            {rows.map((row, i) => (
              <Swipeable
                key={row.alias}
                renderRightActions={() => (
                  <PressableScale
                    onPress={() => remove(row)}
                    haptic="none"
                    activeScale={0.96}
                    accessibilityRole="button"
                    accessibilityLabel={`Forget ${row.alias}`}
                    style={styles.deleteAction}>
                    <Icon name="trash" size={moderateScale(18)} tint={color.bg} />
                  </PressableScale>
                )}
                overshootRight={false}>
                <View style={styles.aliasRow}>
                  {i > 0 ? <View style={styles.sep} /> : null}
                  <View style={styles.aliasBody}>
                    {/* Both halves are the record's own words, so both are set
                        in the reading face — the arrow is the only thing here
                        Recore wrote. */}
                    <Text
                      style={styles.aliasText}
                      numberOfLines={2}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {row.alias}
                      <Text style={styles.arrow}> → </Text>
                      <Text style={styles.canonical}>{row.canonical}</Text>
                    </Text>
                  </View>
                </View>
              </Swipeable>
            ))}
          </Section>
        )}
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
  // Balances the back chevron so the title sits optically centred.
  barSpacer: {
    width: moderateScale(22),
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  aliasRow: {
    backgroundColor: color.surface,
  },
  sep: {
    height: hairline,
    backgroundColor: color.divider,
  },
  aliasBody: {
    minHeight: moderateScale(48),
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  aliasText: {
    fontFamily: fonts.reading,
    fontSize: moderateScale(15),
    lineHeight: lineFor(21),
    color: color.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    color: color.textMuted,
  },
  canonical: {
    color: color.textSecondary,
  },
  deleteAction: {
    width: moderateScale(72),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.error,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  empty: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {
    ...type.headline,
    color: color.textPrimary,
  },
  emptyBody: {
    ...type.subhead,
    lineHeight: lineFor(21),
    color: color.textSecondary,
  },
});
