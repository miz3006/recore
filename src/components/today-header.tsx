import { Keyboard, StyleSheet, Text, View } from 'react-native';

import { longDayLabel } from '@/lib/db/dates';
import { tap } from '@/lib/haptics';
import { color, MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';
import { Icon } from './icon';
import { PressableScale } from './motion';

/** The dateline's own height — enough to hold the count's mono line without
 * letting the row float away from the title above it. See `styles.dateline`. */
const DATELINE_H = moderateScale(30);

/**
 * THE BAR BUTTON IS SIZED BY ITS GLYPH, AND THE TARGET IS `hitSlop`
 * (9 September 2026, owner: *"popravi tudi gor logo za koledar in to tisto
 * poravnavo"*).
 *
 * The first version gave the button `minWidth: HIT`, `minHeight: HIT` and a
 * left padding, then right-aligned the glyph inside it. On an iOS 26 SDK build
 * **the navigation bar draws its own Liquid Glass capsule around whatever the
 * button's bounds are** — so a 52 × 44 box with the mark shoved against one end
 * rendered as a wide white pill with the calendar hanging off its right edge.
 * Photographed on the simulator: a blob, and plainly off-centre inside it.
 *
 * A bar button therefore takes NO frame of its own. The glyph sizes it, the
 * system capsule hugs it and centres it, and the 44 pt target comes from
 * `hitSlop`, which costs no layout — which is what `hitSlop` is for.
 *
 * 18 pt, not 22: UIKit draws a bar-button symbol at roughly the body text size,
 * and SF's `calendar` is a dense mark — a solid header band over a 3 × 3 grid —
 * so at 22 it was the heaviest object on a page whose whole point is that the
 * record is the loudest thing on it.
 */
const BAR_GLYPH = moderateScale(18);
const BAR_HIT = spacing.md;

/**
 * TODAY'S CHROME, AFTER THE ROW WENT AWAY (9 September 2026).
 *
 * This replaces `top-bar.tsx` — the wordmark · day pill · session-count row
 * that sat ABOVE the scroll view and gave the page a lid. Its three facts are
 * all still on screen and each one moved to where iOS puts that kind of thing:
 *
 * | Was | Is |
 * |---|---|
 * | "Recore" wordmark | gone — the tab prints its own name as the large title now, like the other three |
 * | centred day pill → calendar | `TodayBarButton`, a bar button at the trailing edge |
 * | "42 sessions" → consistency | the end of `TodayDateline`, on the page, with its own 44 pt target |
 *
 * Nothing here draws a background. A bar button sits ON the navigation bar,
 * which on an iOS 26 SDK build is already Liquid Glass — a white pill inside it
 * would be a second material stacked on the first, and the design skill's one
 * exception for a tinted surface (a filled CTA) is not this.
 */

/**
 * The trailing bar button. It is the CALENDAR at rest and DONE while the
 * keyboard is up, which is Apple Notes' own arrangement: a note being written
 * offers exactly one thing in the bar, and it is the way out of the keyboard.
 *
 * Done is a word rather than a glyph because it commits nothing and takes
 * something away — §15's rule that a button says exactly what happens — and
 * because that is the label every iOS user has already learned. It is not
 * "Finish": Finish ends the session and lives on the accessory bar with the
 * count it settles.
 */
export function TodayBarButton({
  keyboardOpen,
  onOpenCalendar,
}: {
  keyboardOpen: boolean;
  onOpenCalendar: () => void;
}) {
  if (keyboardOpen) {
    return (
      <PressableScale
        onPress={() => {
          tap();
          Keyboard.dismiss();
        }}
        haptic="none"
        hitSlop={BAR_HIT}
        activeScale={0.94}
        accessibilityRole="button"
        accessibilityLabel="Done — put the keyboard away"
        style={styles.button}>
        <Text style={styles.done} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Done
        </Text>
      </PressableScale>
    );
  }
  return (
    <PressableScale
      onPress={onOpenCalendar}
      haptic="none"
      hitSlop={BAR_HIT}
      activeScale={0.92}
      accessibilityRole="button"
      accessibilityLabel="Open calendar"
      style={styles.button}>
      <Icon name="calendar" size={BAR_GLYPH} tint={color.brand} />
    </PressableScale>
  );
}

/**
 * THE DATELINE — the line under the title, and the first thing on the page.
 *
 * The title says "Today"; this says which day that is. Both halves are needed
 * and neither is enough: "Today" alone is the one thing a person never has to
 * be told, and a bare date two swipes back leaves them counting. The old day
 * pill carried the pair as "Today · Sep 6" because a pill has room for one
 * string; a page has room for the sentence, so it gets one.
 *
 * The session count rides at the end of the row. It is a TOTAL and it is
 * LABELLED (owner, 11 Aug 2026) — never a bare numeral, never a flame, and it
 * only ever grows. Tapping opens the consistency sheet, which is the honest
 * place for a number that needs a paragraph.
 */
export function TodayDateline({
  day,
  sessionCount,
  onOpenStreak,
}: {
  day: string;
  sessionCount: number;
  onOpenStreak: () => void;
}) {
  return (
    <View style={styles.dateline}>
      <Text style={styles.date} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {longDayLabel(day)}
      </Text>
      {sessionCount > 0 ? (
        <PressableScale
          onPress={onOpenStreak}
          haptic="none"
          // The 44 pt target the row itself no longer carries: 30 + 2 × 8
          // vertically, and the padding plus this horizontally.
          hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.md, right: spacing.md }}
          activeScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={`${sessionCount} ${
            sessionCount === 1 ? 'session' : 'sessions'
          } on record. Open consistency`}
          style={styles.countTarget}>
          <Text style={styles.count} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {sessionCount}
            <Text style={styles.countUnit}>{sessionCount === 1 ? ' session' : ' sessions'}</Text>
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * A bar button's own box — deliberately barely a box at all. No fill, no
   * radius and no minimum: the bar is the material and the capsule is the
   * system's (see `BAR_GLYPH` above). The padding is symmetric so whatever the
   * capsule hugs, it hugs evenly.
   */
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  done: {
    ...type.body,
    // iOS weights the confirming bar button and leaves the rest regular.
    fontWeight: '600',
    color: color.brand,
  },
  /**
   * The title and its dateline are ONE BLOCK: no top margin, so the pair hugs
   * and the page's air opens underneath them rather than between them.
   *
   * The minimum height is `DATELINE_H`, not `HIT`: at 44 the row centred a
   * 15 pt line in a box three times its height and pushed the date 11 pt down
   * the page, so the title and its own subtitle read as two separate blocks.
   * The count keeps its 44 pt target through `hitSlop` instead — a tap target
   * is allowed to be bigger than the thing it is on, and a line of type is not
   * allowed to float.
   */
  dateline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: DATELINE_H,
  },
  date: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textSecondary,
  },
  countTarget: {
    minHeight: DATELINE_H,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  // Mono and quiet: it is a reading, and it is the least important thing in the
  // row — the day is what the eye is here for.
  count: {
    ...readingStyle('500'),
    color: color.textSecondary,
    fontSize: type.caption.fontSize,
    letterSpacing: 0.2,
  },
  countUnit: {
    fontWeight: '400',
    color: color.textMuted,
  },
});
