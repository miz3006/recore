import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { getRecentSessions, getSessionExerciseNames } from '@/lib/db/insights';
import { groupThousands } from '@/lib/format';
import { tap } from '@/lib/haptics';
import { hasSeenComposerDemo, markComposerDemoSeen } from '@/lib/prefs';
import { HIT, MAX_FONT_SCALE, hairline, makeStyles, radius, spacing, type } from '@/lib/theme';
import { labelForDay, useSession } from '@/state/session-store';

import { DataValue } from './data-value';
import { ExerciseCard } from './exercise-card';
import { CardSettle } from './motion';
import { Eyebrow } from './primitives';

/**
 * An empty Today (CLAUDE.md §8.9, PLAN.md 1.20). **A blank day is never a void.**
 *
 * Three states, in strict priority:
 *
 *   1. **A target exists** — the Coach knows what is next, so show it. This is
 *      the best possible empty state: the app already knows what you are here to
 *      do, and tapping one writes that exercise's name into the composer (§10.4).
 *   2. **History, no target** — last session, collapsed to one line. One tap
 *      re-opens it.
 *   3. **Nothing at all** — the self-writing demo. A line types itself, gets
 *      read, and settles into a card. Once per install, then never again.
 *
 * What none of these is: a zeroed chart, a "No data" label, or an illustration.
 * §12.1 — an empty state says what will fill it, and where it can, offers the
 * action that fills it.
 */
export function TodayEmpty({ onPick }: { onPick: (exerciseName: string) => void }) {
  const styles = useStyles();
  const userId = useSession((s) => s.userId);
  const selectedDay = useSession((s) => s.selectedDay);
  const ghost = useSession((s) => s.ghost);
  const selectDay = useSession((s) => s.selectDay);

  const last = useMemo(() => {
    if (!userId) return null;
    const [brief] = getRecentSessions(userId, 1, selectedDay);
    if (!brief) return null;
    return { ...brief, names: getSessionExerciseNames(brief.workoutId) };
  }, [userId, selectedDay]);

  if (!userId) return null;

  // 1 — the Coach has a session in mind.
  const targets = ghost ? parseGhostLines(ghost.ghostText) : [];
  if (targets.length > 0) {
    return (
      <View style={styles.block}>
        <Eyebrow>Next session</Eyebrow>
        {targets.map((line, i) => (
          <CardSettle key={line.name} index={i}>
            <Pressable
              style={styles.targetRow}
              onPress={() => {
                tap();
                onPick(line.name);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Start ${line.name}, ${line.value}`}>
              <Text style={styles.targetName} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {line.name}
              </Text>
              <DataValue value={line.value} size="m" tone="planned" />
            </Pressable>
          </CardSettle>
        ))}
        {ghost?.reason ? (
          <Text style={styles.reason} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {ghost.reason}
          </Text>
        ) : null}
      </View>
    );
  }

  // 2 — a record exists. Show the last one, collapsed to a single true line.
  if (last) {
    return (
      <Pressable
        style={styles.lastRow}
        onPress={() => {
          tap();
          selectDay(last.day);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Last session, ${labelForDay(last.day)}`}>
        <Text style={styles.lastText} numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          Last: {labelForDay(last.day)} · {last.exercises} exercise
          {last.exercises === 1 ? '' : 's'}
          {last.volume > 0 ? ` · ${groupThousands(last.volume)} kg` : ''}
        </Text>
      </Pressable>
    );
  }

  // 3 — the first day of the rest of it.
  return <ComposerDemo />;
}

/**
 * The self-writing demo (§8.9). A line types itself, is read, and settles into a
 * real §8.3 card — the same component the user's own first line will produce, so
 * what they are watching is the product rather than a picture of it.
 *
 * **Exactly once per install.** A demo that replays is a demo that is in the way,
 * and by the second session the user knows what the app does.
 */
const DEMO_LINE = 'bench 3x8 80kg';
const CHAR_MS = 42;
const READ_MS = 900;

function ComposerDemo() {
  const styles = useStyles();
  const reduce = useReducedMotion();
  const [seen] = useState(() => hasSeenComposerDemo());
  const [typed, setTyped] = useState(seen || reduce ? DEMO_LINE : '');
  const [settled, setSettled] = useState(seen || reduce);

  useEffect(() => {
    markComposerDemoSeen();
    if (seen || reduce) return;
    const queue: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= DEMO_LINE.length; i++) {
      queue.push(setTimeout(() => setTyped(DEMO_LINE.slice(0, i)), i * CHAR_MS));
    }
    queue.push(setTimeout(() => setSettled(true), DEMO_LINE.length * CHAR_MS + READ_MS));
    return () => queue.forEach(clearTimeout);
  }, [seen, reduce]);

  return (
    <View style={styles.block}>
      <Text style={styles.demoLine} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        {typed}
        {settled ? '' : '|'}
      </Text>
      {settled ? (
        <ExerciseCard
          items={[
            {
              name: 'Bench Press',
              alias: 'bench',
              sets: [
                { kind: 'working', reps: 8, weight_kg: 80, distance_m: null, duration_s: null, parent: null },
                { kind: 'working', reps: 8, weight_kg: 80, distance_m: null, duration_s: null, parent: null },
                { kind: 'working', reps: 8, weight_kg: 80, distance_m: null, duration_s: null, parent: null },
              ],
            },
          ]}
          context="first recorded"
        />
      ) : null}
      <Text style={styles.demoCaption} maxFontSizeMultiplier={MAX_FONT_SCALE}>
        Write it the way you&rsquo;d say it. Recore reads the rest.
      </Text>
    </View>
  );
}

/** The engine writes its ghost as lines like `Bench Press 85 kg × 8`. */
function parseGhostLines(text: string): { name: string; value: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((line) => {
      const at = line.search(/\d/);
      if (at <= 0) return { name: line, value: '' };
      return { name: line.slice(0, at).trim(), value: line.slice(at).trim() };
    })
    .filter((l) => l.name.length > 0);
}

const useStyles = makeStyles((t) => ({
  block: {
    gap: spacing.sm,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    // §17 — a tappable row is never shorter than a thumb, whatever it contains.
    minHeight: HIT,
  },
  targetName: {
    ...type.body,
    color: t.ink,
    flexShrink: 1,
  },
  reason: {
    ...type.caption,
    color: t.inkMuted,
  },
  lastRow: {
    borderTopWidth: hairline,
    borderTopColor: t.rule,
    paddingTop: spacing.md,
    minHeight: HIT,
  },
  lastText: {
    ...type.callout,
    color: t.inkMuted,
  },
  demoLine: {
    ...type.body,
    color: t.inkMuted,
    borderRadius: radius.sm,
  },
  demoCaption: {
    ...type.caption,
    color: t.inkFaint,
  },
}));
