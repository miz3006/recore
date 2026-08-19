import { StyleSheet, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { type SessionOption } from '@/lib/session-options';
import {
  alpha,
  color,
  hairline,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  spacing,
  type,
} from '@/lib/theme';

import { BottomSheet } from './bottom-sheet';
import { Icon, type IconName } from './icon';
import { PressableScale } from './motion';
import { Eyebrow } from './primitives';

/**
 * The session picker (owner's spec §D.2, 13 Aug 2026).
 *
 * "Start a session" opens this: the session types Recore has detected — the
 * days of the athlete's split, with the one the rotation is DUE for marked —
 * then "Repeat last session", then "Empty session". Choosing one prefills
 * today's canvas with that session's planned movements (§D.3); choosing the
 * empty one is the blank page Today has always been.
 *
 * The list itself is decided by `lib/session-options.ts`, which is pure and
 * tested. This file draws it and nothing else — a sheet that computes what it
 * shows is a sheet whose contents can only be checked by opening it.
 */
export function SessionPickerSheet({
  visible,
  options,
  onClose,
  onChoose,
}: {
  visible: boolean;
  options: readonly SessionOption[];
  onClose: () => void;
  onChoose: (option: SessionOption) => void;
}) {

  const choose = (option: SessionOption) => {
    tap();
    // The canvas is prefilled first and the sheet closes over it, so the
    // athlete sees the checklist arrive rather than an empty page and then a
    // change. No second modal is involved, so there is nothing to sequence.
    onChoose(option);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      sheetStyle={[styles.sheet, { paddingBottom: spacing.lg }]}>
      <Eyebrow tone="muted" style={styles.eyebrow}>
        Today
      </Eyebrow>
      <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE}>
        What are you training?
      </Text>

      <View style={styles.rows}>
        {options.map((option, i) => (
          <View key={option.id}>
            {i > 0 ? <View style={styles.rowRule} /> : null}
            <PressableScale
              onPress={() => choose(option)}
              haptic="none"
              activeScale={0.98}
              accessibilityRole="button"
              accessibilityLabel={
                option.due ? `${option.label}, due today` : option.label
              }
              style={styles.row}>
              <View style={styles.iconCol}>
                <Icon
                  name={iconFor(option)}
                  size={moderateScale(18)}
                  tint={option.due ? color.trained : color.textSecondary}
                />
              </View>
              <View style={styles.rowBody}>
                <Text
                  style={[styles.rowLabel, option.due && styles.rowLabelDue]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  {option.label}
                </Text>
                {option.detail ? (
                  <Text
                    style={styles.rowDetail}
                    numberOfLines={1}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {option.detail}
                  </Text>
                ) : null}
              </View>
              {/* The rotation's answer, said out loud. Recore blue, the
                  product's accent for a resolved choice (§4.2) — never green,
                  which belongs to a load that has not been lifted. */}
              {option.due ? (
                <View style={styles.dueTag}>
                  <Text style={styles.dueText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Due
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          </View>
        ))}
      </View>

      <Text style={styles.footnote} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Nothing is written until you tick a set — or write it yourself.
      </Text>
    </BottomSheet>
  );
}

function iconFor(option: SessionOption): IconName {
  if (option.kind === 'repeat') return 'refresh';
  if (option.kind === 'empty') return 'pencil';
  return 'barbell';
}

const ICON_COL_W = moderateScale(28);

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: color.surface,
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    marginTop: spacing.sm,
  },
  title: {
    marginTop: spacing.xs,
    ...type.title,
    color: color.textPrimary,
  },
  rows: {
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: moderateScale(52),
    paddingVertical: spacing.sm,
  },
  rowRule: {
    height: hairline,
    marginLeft: ICON_COL_W + spacing.sm,
    backgroundColor: color.divider,
  },
  iconCol: {
    width: ICON_COL_W,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },
  rowLabelDue: {
    color: color.trained,
  },
  rowDetail: {
    ...type.caption,
    color: color.textMuted,
  },
  dueTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: alpha(color.trained, 0.12),
  },
  dueText: {
    ...type.caption,
    fontWeight: '600',
    color: color.trained,
  },
  footnote: {
    marginTop: spacing.lg,
    ...type.caption,
    color: color.textMuted,
  },
});
