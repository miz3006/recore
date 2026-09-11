import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Section } from '@/components/settings-rows';
import { PAPER_FIELD_CSS } from '@/lib/paper-field';
import {
  color,
  lineFor,
  MAX_FONT_SCALE,
  spacing,
  TAB_BAR_CLEARANCE,
  type,
} from '@/lib/theme';

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
 *
 * ## THE CHROME IS UIKIT'S, AND THE SCREEN LIVES IN YOU'S STACK (10 Sep 2026)
 *
 * It used to draw its own bar: a `SafeAreaView`, a row, a `chevron-back` glyph
 * and a `Text` at `title2`. That bar could not collapse, could not be Liquid
 * Glass, could not name the screen you came from, and gave the edge-swipe no
 * visible affordance — and it sat one tap away from You, whose bar is the
 * system's. It is UIKit's now, dressed by `_layout.tsx` beside this file. The
 * large title is asked for here because this is a settings page and Settings'
 * own sub-pages set one.
 *
 * It also MOVED, from the root stack into You's. Registered at the root it
 * covered the tab bar, so one tap from a settings row took the whole navigation
 * away. Every app iOS ships keeps the bar through a detail push, and the move
 * gets the back control the word "You" as well.
 *
 * The scroll view is the screen's ROOT and paints the canvas itself, which is
 * what lets the title collapse — the measurement is in `../next/_layout.tsx`.
 */
export default function Health() {
  return (
    <>
      <Stack.Screen options={{ title: 'Apple Health', headerLargeTitle: true }} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        contentInsetAdjustmentBehavior="automatic"
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
   * inset, and content further in would give the page two left edges. */
  body: {
    paddingHorizontal: spacing.lg,
    // The top is UIKit's now (`contentInsetAdjustmentBehavior`), but the bottom
    // is not: content scrolls BEHIND the glass tab bar so the bar has something
    // to refract, and the last line clears it by hand.
    paddingBottom: spacing.huge + TAB_BAR_CLEARANCE,
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
