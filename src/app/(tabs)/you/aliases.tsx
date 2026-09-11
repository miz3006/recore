import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { Section } from '@/components/settings-rows';
import {
  deleteAliasOverride,
  listAliasOverrides,
  type AliasOverrideView,
} from '@/lib/db/alias-overrides';
import { tapMedium } from '@/lib/haptics';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  color,
  hairline,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  spacing,
  TAB_BAR_CLEARANCE,
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
    <>
      {/* THE CHROME IS UIKIT'S (10 September 2026). The bar this screen used to
          draw — a row, a `chevron-back` glyph and a `Text` at `title2` — could
          not collapse, could not be Liquid Glass and could not say that You is
          what you came from. It is UIKit's now, dressed by `_layout.tsx` beside
          this file; the large title is asked for here because this is a
          settings page.

          The screen MOVED with it, from the root stack into You's, so the tab
          bar survives the push the way it does in every app iOS ships — and so
          the back control can say "You". */}
      <Stack.Screen options={{ title: 'Reading corrections', headerLargeTitle: true }} />

      {/* THE SCROLL VIEW IS THE SCREEN'S ROOT and paints the canvas itself,
          which is what lets the title collapse — the measurement is in
          `(tabs)/next/_layout.tsx`. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        contentInsetAdjustmentBehavior="automatic"
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
                    <Icon name="trash" size={moderateScale(18)} tint={color.onInk} />
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
    </>
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
   * inset, and content further in would give the page two left edges. The top
   * padding is UIKit's now (`contentInsetAdjustmentBehavior`). */
  body: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract, and the last row clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
  },
  aliasRow: {
    backgroundColor: color.surface,
  },
  sep: {
    height: hairline,
    backgroundColor: color.border,
  },
  aliasBody: {
    minHeight: moderateScale(48),
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  aliasText: {
    ...readingStyle('400'),
    fontSize: moderateScale(15),
    lineHeight: lineFor(21),
    color: color.textPrimary,
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
    borderCurve: 'continuous',
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
