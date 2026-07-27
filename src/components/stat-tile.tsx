import { Text, View } from 'react-native';

import { DataValue, type DataTone } from '@/components/data-value';
import { eyebrow, hairline, makeStyles, MAX_FONT_SCALE, radius, spacing } from '@/lib/theme';

/**
 * `StatTile` (§11.1 zoom 1, §20) — a big mono number, a `micro` label, and an
 * optional delta. No icons and no colour: §11.1's rule for Progress is that
 * every number must be true and nothing may be flattering, and a green arrow is
 * how a flat month gets dressed up as a good one.
 *
 * The delta is typographic (§6.3) — a signed number in muted mono. A lifter
 * reading `−5 kg` after a deload does not need the app to colour it as failure.
 */
export function StatTile({
  value,
  unit,
  label,
  delta,
  tone = 'recorded',
  grouped,
}: {
  value: number | string;
  unit?: string;
  label: string;
  /** Pre-formatted, e.g. `+6%`. Rendered muted; never coloured. */
  delta?: string;
  tone?: DataTone;
  grouped?: boolean;
}) {
  const styles = useStyles();

  return (
    <View style={styles.tile}>
      <DataValue value={value} unit={unit} size="l" tone={tone} grouped={grouped} />
      <View style={styles.footer}>
        <Text style={styles.label} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {label.toUpperCase()}
        </Text>
        {delta ? (
          <Text style={styles.delta} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {delta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  tile: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    ...eyebrow,
    color: t.inkFaint,
    flexShrink: 1,
  },
  delta: {
    ...eyebrow,
    color: t.inkMuted,
  },
}));
