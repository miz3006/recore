import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';

import { tap } from '@/lib/haptics';
import { nameKey, typedNameOf } from '@/lib/parse/receipt';
import {
  color,
  fonts,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { usePlanStrip, useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';
import { PressableScale } from './motion';

/**
 * The plan-in-view strip (pre-plan, Surface 1). Today's declared day is shown
 * as a READ-ONLY reference beside the note: the movement name + the engine's
 * progressed load in green (the app's only green — a future prescription
 * VALUE). A row settles to neutral — ring fills, value loses its green — the
 * moment the parse recognises that exercise in the note. It cannot insert,
 * check off, or count anything — "Planned into Actual" is the one boundary
 * that never bends (design doctrine).
 *
 * Drawn in the shared card vocabulary (28 Jul — the same surface/divider/
 * shadow.card language as Next's "What's next" card, which carries the same
 * rows one tab over), with the composer's own leading check column so the
 * strip and the ledger below it read as one system. The rings echo the
 * ghost's: an empty ring is a row still owed, an ink fill is one the note
 * already carries. "Hide" collapses it to a single row; it's absent when
 * there's no plan today.
 */
export function PlanStrip() {
  const strip = usePlanStrip();
  const note = useSession((s) => s.note);
  const lineExercises = useSession((s) => s.lineExercises);
  const reduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);

  // A movement is "logged" when the note already carries that exercise — parsed
  // (canonical) or freshly typed. Pure name-matching, display-only; the strip
  // never touches settlement math.
  const doneKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const canonical of Object.values(lineExercises)) keys.add(nameKey(canonical));
    for (const line of note.split('\n')) {
      const n = typedNameOf(line);
      if (n) keys.add(nameKey(n));
    }
    return keys;
  }, [note, lineExercises]);

  if (!strip) return null;

  const doneFlags = strip.rows.map((r) => doneKeys.has(nameKey(r.name)));
  const remaining = doneFlags.filter((d) => !d).length;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      style={styles.card}>
      <View style={styles.top}>
        <MonoTag label="PLANNED" />
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {strip.label} in view
        </Text>
        <PressableScale
          onPress={() => {
            tap();
            setCollapsed((c) => !c);
          }}
          haptic="none"
          hitSlop={spacing.sm}
          activeScale={0.94}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show plan' : 'Hide plan'}>
          <Text style={styles.hide} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {collapsed ? `${remaining} left` : 'Hide'}
          </Text>
        </PressableScale>
      </View>

      {collapsed ? null : (
        <>
          <View style={styles.rows}>
            {strip.rows.map((r, i) => {
              const done = doneFlags[i];
              return (
                <View key={i}>
                  {i > 0 ? <View style={styles.rowSep} /> : null}
                  <View
                    style={styles.row}
                    accessible
                    accessibilityLabel={`${r.name}${r.value ? `, ${r.value}` : ''}${done ? ', logged' : ''}`}>
                    {done ? (
                      <Animated.View
                        entering={reduceMotion ? undefined : ZoomIn.duration(220)}
                        style={[styles.ring, styles.ringDone]}>
                        <Text style={styles.ringMark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                          ✓
                        </Text>
                      </Animated.View>
                    ) : (
                      <View style={styles.ring} />
                    )}
                    <Text
                      style={[styles.ex, done && styles.exDone]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {r.name}
                    </Text>
                    {r.value ? (
                      <Text
                        style={[styles.val, done && styles.valDone]}
                        numberOfLines={1}
                        maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {r.value}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.foot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Reference only — never written into your note, never counted.
          </Text>
        </>
      )}
    </Animated.View>
  );
}

/** The strip's ring — a size down from the ghost's tappable check, because
 * this one only reports. */
const RING = moderateScale(18);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.divider,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadow.card,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, ...type.caption, color: color.textSecondary },
  hide: { ...type.caption, fontWeight: '600', color: color.textSecondary },

  rows: { marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: moderateScale(38),
    paddingVertical: spacing.xs,
  },
  // Inset past the ring column, like the composer's rule past its check
  // column (§6) — the marks stay one vertical run.
  rowSep: {
    height: hairline,
    marginLeft: RING + spacing.md,
    backgroundColor: color.divider,
  },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.5,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDone: {
    backgroundColor: color.accent,
    borderColor: color.accent,
  },
  ringMark: {
    color: color.bg,
    fontSize: type.footnote.fontSize,
    fontWeight: '700',
  },
  ex: { flex: 1, ...type.subhead, color: color.textPrimary },
  exDone: { color: color.textMuted },
  // THE ONLY GREEN: a future prescription value (record contract). A logged
  // row's value is no longer a future number, so it hands back the ink.
  val: {
    fontFamily: fonts.mono,
    fontSize: type.caption.fontSize,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.signal,
  },
  valDone: { color: color.textMuted, fontWeight: '400' },

  foot: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: hairline,
    borderTopColor: color.divider,
    ...type.footnote,
    color: color.textMuted,
  },
});
