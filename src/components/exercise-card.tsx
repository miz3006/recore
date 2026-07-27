import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { confidenceOf, describeSets, type CardSet, type Confidence } from '@/lib/card-view';
import { tap, tapMedium } from '@/lib/haptics';
import { type Modality } from '@/lib/parse/types';
import {
  MAX_FONT_SCALE,
  hairline,
  makeStyles,
  moderateScale,
  radius,
  space,
  spacing,
  spring,
  timing,
  type,
  useTheme,
} from '@/lib/theme';

import { DataValue } from './data-value';
import { CardSettle, RepairFlash } from './motion';
import { Tag } from './primitives';
import { Stepper } from './stepper';

/**
 * `ExerciseCard` — the most important component in the app (CLAUDE.md §8.3,
 * §20, PLAN.md 1.11–1.14).
 *
 * Four zones, and **never a fifth**:
 *
 *   1 NAME     the resolved name, plus a quiet echo of the user's own word
 *   2 VALUE    the load in `dataL`, then the rep sequence in `dataM`
 *   3 CONTEXT  one line — a comparison, "first recorded", or the PR capsule
 *   4 TARGET   optional: a hairline, then the ember prescription and its reason
 *
 * No muscle-group tag, no equipment icon, no set-by-set table, no volume
 * subtotal. Those live in the Lift detail (§11.2). **A card is a receipt line,
 * not a dashboard**, and the discipline is the design: a card that fits in one
 * glance is what makes a five-exercise session readable while standing up.
 *
 * The alias echo (`· "incline db"`) is the single highest-trust element on the
 * screen — it is how the user sees that we understood *their* word — and §9.6
 * says it is never hidden, including when we silently fixed a typo.
 *
 * **Repair lives here too** (§8.4, §8.5): tap the load for an in-place stepper,
 * tap a rep to edit that set alone, tap the name for the lift, long-press for
 * the full repair sheet, swipe left to delete with an undo. Deleting strikes the
 * line in `raw_text` rather than removing it — the words survive, the record
 * does not (§4.3).
 */

export interface CardItem {
  /** The resolved canonical name. */
  name: string;
  /** The user's own word, when it differs. Never hidden (§9.6). */
  alias?: string | null;
  modality?: Modality;
  sets: readonly CardSet[];
  /** §6.4. Absent means "not measured yet" (2.3 wires it), not "doubted". */
  confidence?: number | null;
  /** Which field the parser guessed at — it wears the dotted underline. */
  uncertain?: 'name' | 'value';
  /** The exercise's own increment (§10.2). Loads step in pairs. */
  incrementKg?: number;
}

export interface CardTarget {
  /** `85 kg × 8` — computed by the engine, never by a model (§10.1). */
  text: string;
  /** One line, in the user's words. No reason → no line (§10.5). */
  reason?: string | null;
}

export function ExerciseCard({
  items,
  context,
  isPR = false,
  target,
  index = 0,
  onOpenLift,
  onRepair,
  onDelete,
  onChangeWeight,
  onChangeReps,
}: {
  /** One exercise, or several sharing this card as a superset (§8.3). */
  items: readonly CardItem[];
  /** Zone 3, already phrased: `+2.5 kg vs 21 Jul`, or `first recorded`. */
  context?: string | null;
  isPR?: boolean;
  target?: CardTarget | null;
  /** Position in the session — drives the 40ms `card.settle` stagger. */
  index?: number;
  onOpenLift?: (item: CardItem) => void;
  onRepair?: (item: CardItem) => void;
  onDelete?: () => void;
  /** Every change is written locally and synchronously (§4.2). */
  onChangeWeight?: (item: CardItem, next: number) => void;
  onChangeReps?: (item: CardItem, setIndex: number, next: number) => void;
}) {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const x = useSharedValue(0);
  const gone = useSharedValue(false);

  // Declared before the early return below: a hook after a conditional return
  // would change hook order between renders, and lint is right to refuse it.
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: reduce ? 0 : x.value }] }));

  const lowest = items.reduce<Confidence>((worst, item) => {
    const c = confidenceOf(item.confidence);
    const rank = { high: 0, medium: 1, low: 2, none: 3 } as const;
    return rank[c] > rank[worst] ? c : worst;
  }, 'high');

  // Below 0.4 the app produces no card at all: the line stays in the note and
  // nothing happens (§4.4, §6.4). Silence is the design, not a gap in it.
  if (lowest === 'none') return null;

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12]) // never steal the session's vertical scroll
    .enabled(Boolean(onDelete))
    .onChange((e) => {
      if (gone.value) return;
      x.value = Math.min(0, x.value + e.changeX);
    })
    .onEnd(() => {
      const threshold = -moderateScale(96);
      if (x.value < threshold && onDelete) {
        gone.value = true;
        x.value = withTiming(-moderateScale(600), timing.base, (finished) => {
          if (finished) runOnJS(onDelete)();
        });
        return;
      }
      x.value = withSpring(0, spring.snap);
    });

  return (
    <CardSettle index={index}>
      <View style={styles.swipeBed}>
        {/* What the swipe reveals. Words, not a red block — §6.3 keeps colour
            for planned numbers, and "Delete" is unambiguous without one. */}
        <View style={styles.deleteHint} pointerEvents="none">
          <Text style={styles.deleteText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Delete
          </Text>
        </View>

        <GestureDetector gesture={swipe}>
          <Animated.View
            style={[
              styles.card,
              lowest === 'low' && styles.cardUnsure,
              slide,
            ]}>
            <View style={styles.superset}>
              {items.map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.supersetPart}>
                  {i > 0 ? <View style={styles.supersetRule} /> : null}
                  <ExerciseBody
                    item={item}
                    onOpenLift={onOpenLift}
                    onRepair={onRepair}
                    onChangeWeight={onChangeWeight}
                    onChangeReps={onChangeReps}
                  />
                </View>
              ))}
            </View>

            {/* ZONE 3 — one line, and only when there is something true to say. */}
            {context || isPR ? (
              <View style={styles.context}>
                {context ? (
                  <Text style={styles.contextText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {context}
                  </Text>
                ) : null}
                {isPR ? <Tag label="PR" tone="ink" /> : null}
              </View>
            ) : null}

            {/* §6.4 — the low rung asks for a confirmation rather than asserting. */}
            {lowest === 'low' ? (
              <Pressable
                onPress={() => {
                  tap();
                  onRepair?.(items[0]);
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm this reading">
                <Text style={styles.confirm} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                  tap to confirm
                </Text>
              </Pressable>
            ) : null}

            {target ? <TargetZone target={target} /> : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </CardSettle>
  );
}

/** Zones 1 and 2 for a single exercise. A superset stacks two of these. */
function ExerciseBody({
  item,
  onOpenLift,
  onRepair,
  onChangeWeight,
  onChangeReps,
}: {
  item: CardItem;
  onOpenLift?: (item: CardItem) => void;
  onRepair?: (item: CardItem) => void;
  onChangeWeight?: (item: CardItem, next: number) => void;
  onChangeReps?: (item: CardItem, setIndex: number, next: number) => void;
}) {
  const styles = useStyles();
  const [editing, setEditing] = useState(false);
  const view = describeSets(item.sets, item.modality ?? 'strength');
  const confidence = confidenceOf(item.confidence);
  const guessedName = confidence === 'medium' && item.uncertain !== 'value';
  const guessedValue = confidence === 'medium' && item.uncertain !== 'name';

  return (
    <Pressable
      onLongPress={() => {
        tapMedium();
        onRepair?.(item);
      }}
      delayLongPress={380}
      accessible
      // §17 — one element reading as one sentence, never seven fragments.
      accessibilityLabel={accessibleSentence(item, view)}>
      {/* ZONE 1 — the name, and the user's own word beside it. */}
      <View style={styles.nameRow}>
        <Pressable
          onPress={() => {
            tap();
            onOpenLift?.(item);
          }}
          // §17 — the target is a line of text, so the slop is what carries it to
          // 44: a 22pt line box plus 12 a side is 46. `spacing.sm` gave 38.
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.name}`}>
          <Text
            style={[styles.name, guessedName && styles.guessed]}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {item.name}
          </Text>
        </Pressable>
        {item.alias ? (
          <Text style={styles.alias} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            · &ldquo;{item.alias}&rdquo;
          </Text>
        ) : null}
      </View>

      {/* ZONE 2 — the number the whole composer exists to produce. */}
      {view.value ? (
        <View style={styles.valueRow}>
          {editing && view.value.kind === 'loaded' && onChangeWeight ? (
            <Stepper
              value={view.value.weight}
              step={item.incrementKg ?? 2.5}
              unit="kg"
              onChange={(next) => onChangeWeight(item, next)}
              onDone={() => setEditing(false)}
              accessibilityLabel={`${item.name} load`}
            />
          ) : (
            <>
              {view.value.kind === 'loaded' ? (
                <Pressable
                  onPress={() => {
                    if (!onChangeWeight) return;
                    tap();
                    setEditing(true);
                  }}
                  hitSlop={spacing.md}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name} load`}>
                  <RepairFlash trigger={view.value.weight}>
                    <View style={guessedValue ? styles.guessedBox : undefined}>
                      <DataValue value={view.value.weight} unit="kg" size="l" />
                    </View>
                  </RepairFlash>
                </Pressable>
              ) : null}
              <RepsRow item={item} view={view.value} onChangeReps={onChangeReps} />
            </>
          )}
        </View>
      ) : null}

      {/* Dropset chains hang under the working sets, never beside them. */}
      {view.drops.map((chain, i) => (
        <Text key={i} style={styles.drop} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {chain}
        </Text>
      ))}

      {/* Warm-ups are recorded, shown quietly, and counted nowhere (§8.3). */}
      {view.warmups ? (
        <Text style={styles.warmup} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          warm-up {view.warmups}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * The rep sequence. Each rep is its own target when the card can be corrected:
 * §8.4 asks for a numeric keyboard on the tapped set, not a sheet — a rep that
 * needs a modal to fix is a rep that stays wrong.
 */
function RepsRow({
  item,
  view,
  onChangeReps,
}: {
  item: CardItem;
  view: NonNullable<ReturnType<typeof describeSets>['value']>;
  onChangeReps?: (item: CardItem, setIndex: number, next: number) => void;
}) {
  const styles = useStyles();
  const t = useTheme();
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  if (view.kind === 'cardio') {
    return (
      <Text style={styles.cardio} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {view.parts.join('  ·  ')}
      </Text>
    );
  }
  if (view.kind === 'effort') {
    return <DataValue value={view.text} size="m" tone="recorded" />;
  }
  if (view.kind === 'perSet') {
    return <DataValue value={view.pairs} size="m" tone="recorded" />;
  }

  // `loaded` and `bodyweight` both end in a rep sequence. Only the raw,
  // uncollapsed form is individually tappable: `3 × 8` is one claim about three
  // sets, and tapping it would have to guess which one the user meant.
  const working = item.sets.filter((s) => s.kind !== 'warmup' && s.parent == null);
  const collapsed = view.reps.includes('×');
  if (collapsed || !onChangeReps) {
    return <DataValue value={view.reps} size="m" tone="recorded" />;
  }

  return (
    <View style={styles.reps}>
      {working.map((s, i) => {
        if (s.reps == null) return null;
        const isEditing = editing === i;
        return (
          <View key={i} style={styles.repCell}>
            {i > 0 ? (
              <Text style={styles.repDot} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                ·
              </Text>
            ) : null}
            {isEditing ? (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                keyboardType="number-pad"
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                selectionColor={t.ink}
                style={[type.dataM, styles.repInput]}
                onBlur={() => {
                  const next = Number(draft);
                  if (Number.isFinite(next) && next > 0 && next !== s.reps) {
                    onChangeReps(item, i, Math.round(next));
                  }
                  setEditing(null);
                }}
                onSubmitEditing={() => setEditing(null)}
              />
            ) : (
              <Pressable
                onPress={() => {
                  tap();
                  setDraft(String(s.reps));
                  setEditing(i);
                }}
                hitSlop={spacing.md}
                accessibilityRole="button"
                accessibilityLabel={`Edit set ${i + 1}, ${s.reps} reps`}>
                <RepairFlash trigger={s.reps}>
                  <DataValue value={s.reps} size="m" tone="recorded" />
                </RepairFlash>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * ZONE 4 — the Coach, inside the card (§10.4). It appears the moment the
 * exercise is named and collapses away the moment real numbers are typed: it was
 * a reading, not a contract. **No reason → no line** (§10.5); "keep it up" is
 * not a reason.
 */
function TargetZone({ target }: { target: CardTarget }) {
  const styles = useStyles();
  return (
    <View style={styles.target}>
      <View style={styles.targetRule} />
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          next
        </Text>
        <DataValue value={target.text} size="m" tone="planned" />
      </View>
      {target.reason ? (
        <Text style={styles.targetReason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {target.reason}
        </Text>
      ) : null}
    </View>
  );
}

/** §17 — "Bench Press, 82.5 kilograms, 8, 8 and 7 reps." One sentence. */
function accessibleSentence(item: CardItem, view: ReturnType<typeof describeSets>): string {
  const parts: string[] = [item.name];
  const v = view.value;
  if (v?.kind === 'loaded') parts.push(`${v.weight} kilograms`, `${v.reps.replace('×', 'sets of')} reps`);
  else if (v?.kind === 'bodyweight') parts.push(`${v.reps.replace('×', 'sets of')} reps`);
  else if (v?.kind === 'perSet') parts.push(v.pairs);
  else if (v?.kind === 'cardio') parts.push(v.parts.join(', '));
  else if (v?.kind === 'effort') parts.push(v.text);
  if (view.warmups) parts.push(`warm-up ${view.warmups}`);
  return parts.join(', ');
}

const useStyles = makeStyles((t) => ({
  swipeBed: {
    justifyContent: 'center',
  },
  deleteHint: {
    ...({ position: 'absolute' } as const),
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingRight: spacing.lg,
  },
  deleteText: {
    ...type.micro,
    color: t.inkMuted,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: t.rule,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardUnsure: {
    // §6.4's low rung: the card is visibly a claim rather than a record.
    opacity: 0.7,
    borderStyle: 'dashed',
  },
  superset: {
    gap: spacing.md,
  },
  supersetPart: {
    gap: spacing.xs,
  },
  supersetRule: {
    height: hairline,
    backgroundColor: t.rule,
    marginBottom: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: space[1],
  },
  name: {
    ...type.title3,
    color: t.ink,
  },
  alias: {
    ...type.caption,
    color: t.inkFaint,
  },
  guessed: {
    // §6.4's medium rung — a dotted underline says "we guessed at this one".
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: t.inkFaint,
  },
  guessedBox: {
    borderBottomWidth: 1,
    borderBottomColor: t.inkFaint,
    borderStyle: 'dotted',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  reps: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  repCell: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  repDot: {
    ...type.dataM,
    color: t.inkFaint,
    paddingHorizontal: space[1],
  },
  repInput: {
    color: t.ink,
    minWidth: moderateScale(28),
    padding: 0,
  },
  cardio: {
    ...type.dataM,
    color: t.ink,
  },
  drop: {
    ...type.dataS,
    color: t.inkMuted,
  },
  warmup: {
    ...type.dataS,
    color: t.inkFaint,
  },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.xs,
  },
  contextText: {
    ...type.dataS,
    color: t.inkMuted,
  },
  confirm: {
    ...type.caption,
    color: t.inkMuted,
    textDecorationLine: 'underline',
  },
  target: {
    gap: spacing.xs,
  },
  targetRule: {
    height: hairline,
    backgroundColor: t.rule,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: spacing.md,
  },
  targetLabel: {
    ...type.micro,
    color: t.inkFaint,
  },
  targetReason: {
    ...type.caption,
    color: t.inkMuted,
  },
}));
