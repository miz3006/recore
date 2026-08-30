import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/primitives';
import type { SessionRow } from '@/lib/next/sections';
import { color, MAX_FONT_SCALE, moderateScale, readingStyle, spacing, type } from '@/lib/theme';

/**
 * WHAT THIS FILE USED TO BE (28 August 2026).
 *
 * It held `LiftCard` — Next's session as one raised card per lift, at
 * `radius.xl`, with a lever chip, a 28 pt load, a two-ended footer and an
 * accordion that opened onto WHY and WATCH. That shape is gone; the session is
 * `components/next/lift-row.tsx` now, one bare row per lift, with the reason
 * for its target permanently on screen instead of one tap under it.
 *
 * The whole argument is in `lift-row.tsx`'s own header. The short version:
 * the card existed to give an accordion an edge to grow inside of, and a
 * reason that is always present has no accordion.
 *
 * What survived the move: the quoted note (to `lift-row.tsx`, unchanged — it
 * is the one thing on the screen that is not derived), and `UnknownLifts`,
 * below.
 */

/**
 * The lifts this session names that have nothing to progress from — the same
 * block Progression gives lifts too shallow to chart, doing the same job on
 * this side of the app.
 *
 * §7.3: never extrapolate from nothing. There is no load to print, so the row
 * prints none and says what would change that — rather than dropping a lift the
 * athlete is about to do off the page they opened to find out what they are
 * about to do.
 */
export function UnknownLifts({ rows }: { rows: SessionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.building}>
      <Eyebrow>{`Also in this session · ${rows.length}`}</Eyebrow>
      {rows.map((row) => (
        <View
          key={row.key || row.name}
          style={styles.buildRow}
          accessible
          accessibilityLabel={`${row.name}, no history yet`}>
          <Text style={styles.buildName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.name}
          </Text>
          <Text style={styles.buildMeta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            no history yet
          </Text>
        </View>
      ))}
      <Text style={styles.buildingNote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        One logged session each and Recore has something for these to beat.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // --- lifts with nothing to progress from (Progression's "building" block) --
  building: {
    gap: spacing.xs,
  },
  // BARE ROWS. These are lifts the record simply has nothing on yet, so they
  // are the record's own voice and take none of its chrome: the rule that used
  // to close each one is gone (skill §Structure), and the row grew from 40 to
  // 52 so the air does the separating the line was doing.
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: moderateScale(52),
  },
  buildName: {
    ...type.subhead,
    flexShrink: 1,
    color: color.textPrimary,
  },
  buildMeta: {
    ...readingStyle('400'),
    fontSize: moderateScale(11),
    color: color.textMuted,
  },
  buildingNote: {
    ...type.caption,
    marginTop: spacing.xs,
    color: color.textMuted,
  },
});
