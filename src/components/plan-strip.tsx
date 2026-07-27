import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { tap } from '@/lib/haptics';
import { nameKey, typedNameOf } from '@/lib/parse/receipt';
import { color, fonts, MAX_FONT_SCALE, moderateScale, radius, spacing } from '@/lib/theme';
import { usePlanStrip, useSession } from '@/state/session-store';

import { MonoTag } from './gutter-value';

/**
 * The plan-in-view strip (pre-plan, Surface 1 — wireframe frame 06_R3). Today's
 * declared day is shown as a READ-ONLY reference beside the note: the movement
 * name + the engine's progressed load in green (the app's only green — a future
 * prescription VALUE). A row dims to neutral the moment the parse recognises
 * that exercise in the note. It cannot insert, check off, or count anything —
 * "Planned into Actual" is the one boundary that never bends (design doctrine).
 * "Hide" collapses it to a single row; it's absent when there's no plan today.
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
        <Pressable
          onPress={() => {
            tap();
            setCollapsed((c) => !c);
          }}
          hitSlop={spacing.sm}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Show plan' : 'Hide plan'}>
          <Text style={styles.hide} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {collapsed ? `${remaining} left` : 'Hide'}
          </Text>
        </Pressable>
      </View>

      {collapsed ? null : (
        <>
          <View style={styles.rows}>
            {strip.rows.map((r, i) => {
              const done = doneFlags[i];
              const valText = done
                ? r.value
                  ? `${r.value} — logged`
                  : 'logged'
                : r.value ?? '';
              return (
                <View key={i} style={styles.row}>
                  <Text
                    style={[styles.ex, done && styles.exDone]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {r.name.toLowerCase()}
                  </Text>
                  {valText ? (
                    <Text
                      style={[styles.val, done && styles.valDone]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={MAX_FONT_SCALE}>
                      {valText}
                    </Text>
                  ) : null}
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

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1, fontSize: moderateScale(12.5), color: color.textSecondary },
  hide: { fontSize: moderateScale(12.5), fontWeight: '600', color: color.textSecondary },

  rows: { marginTop: spacing.sm + 2, gap: moderateScale(5) },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  ex: { flexShrink: 1, fontFamily: fonts.mono, fontSize: moderateScale(11.5), color: color.textPrimary },
  exDone: { color: color.textMuted },
  // THE ONLY GREEN: a future prescription value (record contract).
  val: {
    fontFamily: fonts.mono,
    fontSize: moderateScale(11.5),
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: color.signal,
  },
  valDone: { color: color.textMuted, fontWeight: '400' },

  foot: {
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: color.divider,
    fontSize: moderateScale(10.5),
    lineHeight: moderateScale(15),
    color: color.textMuted,
  },
});
