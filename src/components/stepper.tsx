import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { formatNumber } from '@/lib/format';
import { HIT, MAX_FONT_SCALE, hairline, makeStyles, radius, spacing, type } from '@/lib/theme';

import { DataValue } from './data-value';
import { RepairFlash } from './motion';

/**
 * `Stepper` — the repair path, in place (CLAUDE.md §8.4, PLAN.md 1.13).
 *
 * Typing is the fast path; this is the touch path, and it has to be excellent,
 * because **a parser that cannot be corrected in two seconds is a parser nobody
 * trusts.** The number stays exactly where it was and grows two controls beside
 * it — nothing navigates, nothing opens, the card does not move.
 *
 * The increment is the exercise's own (`increment_kg`, §10.2), so a bench steps
 * 2.5 and a dumbbell press steps 2. That is not a preference, it is what the
 * rack in front of the user actually contains — a stepper that offers a weight
 * you cannot load is a stepper that gets ignored.
 *
 * **Long-press accelerates.** Correcting 82.5 to 100 is seven taps at 2.5, and
 * seven taps is where a good idea becomes an annoying one, so a held button
 * ramps: one step at 400ms, then faster, capped. Each step ticks — the haptic is
 * the only way to feel the ramp without watching the number.
 *
 * Every change writes to SQLite immediately (§4.2 — nothing waits on a network)
 * and flashes `card.repair`, so a correction that landed looks like one.
 */

/** The ramp: interval in ms per step, indexed by how many steps have fired. */
const RAMP = [400, 300, 220, 160, 120, 90, 70] as const;
const rampAt = (n: number) => RAMP[Math.min(n, RAMP.length - 1)];

export function Stepper({
  value,
  step,
  unit,
  min = 0,
  max = 2000,
  onChange,
  onDone,
  accessibilityLabel,
}: {
  value: number;
  /** The exercise's own increment. Loads step in pairs; reps step by 1. */
  step: number;
  unit?: string;
  min?: number;
  max?: number;
  /** Fires on every step — the write is local and synchronous (§4.2). */
  onChange: (next: number) => void;
  /** Dismiss the stepper (tapping the value again, or anywhere else). */
  onDone?: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const [held, setHeld] = useState<null | 1 | -1>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(0);
  const latest = useRef(value);
  latest.current = value;

  const apply = (direction: 1 | -1) => {
    const next = Math.min(max, Math.max(min, Math.round((latest.current + direction * step) * 100) / 100));
    if (next === latest.current) return;
    latest.current = next;
    tap();
    onChange(next);
  };

  // The ramp lives in an effect so a released finger always stops it, including
  // when the release lands on a different component (a scroll, a sheet opening).
  useEffect(() => {
    if (held === null) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      fired.current = 0;
      return;
    }
    const tick = () => {
      apply(held);
      fired.current += 1;
      timer.current = setTimeout(tick, rampAt(fired.current));
    };
    timer.current = setTimeout(tick, rampAt(0));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held]);

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      <StepButton
        glyph="−"
        onPress={() => apply(-1)}
        onHoldStart={() => setHeld(-1)}
        onHoldEnd={() => setHeld(null)}
        label={`Decrease by ${formatNumber(step)}`}
        disabled={value <= min}
      />
      <RepairFlash trigger={value} style={styles.valueWrap}>
        <Pressable onPress={onDone} hitSlop={spacing.md} accessibilityRole="button">
          <DataValue value={value} unit={unit} size="l" />
        </Pressable>
      </RepairFlash>
      <StepButton
        glyph="+"
        onPress={() => apply(1)}
        onHoldStart={() => setHeld(1)}
        onHoldEnd={() => setHeld(null)}
        label={`Increase by ${formatNumber(step)}`}
        disabled={value >= max}
      />
    </View>
  );
}

function StepButton({
  glyph,
  onPress,
  onHoldStart,
  onHoldEnd,
  label,
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  label: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onHoldStart}
      onPressOut={onHoldEnd}
      delayLongPress={260}
      disabled={disabled}
      // 44×44 even though the glyph is smaller (§6.6, §17) — a lifter mid-set
      // has sweat on the screen and a shaking hand.
      hitSlop={spacing.sm}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.step, pressed && styles.stepPressed, disabled && styles.stepOff]}>
      <Text style={styles.stepGlyph} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  valueWrap: {
    minWidth: HIT,
    alignItems: 'center',
  },
  step: {
    minWidth: HIT,
    minHeight: HIT,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.capsule,
    borderWidth: hairline,
    borderColor: t.rule,
    backgroundColor: t.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPressed: {
    backgroundColor: t.rule,
  },
  stepOff: {
    opacity: 0.35,
  },
  stepGlyph: {
    ...type.title3,
    color: t.ink,
  },
}));
