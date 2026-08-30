import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { NoteInput, PLACEHOLDER } from '@/components/note-surface';
import { track } from '@/lib/analytics';
import { DEMO_EXAMPLE, demoEntryOfItem, demoParseText } from '@/lib/demo-parse';
import { tap } from '@/lib/haptics';
import { Enter, PressScale } from '@/lib/motion/index';
import { MAX_FONT_SCALE, spacing, type } from '@/lib/theme';
import { useV2 } from '@/state/onboarding-v2';

import { Frame } from '../Frame';
import { LiveLedger } from '../LiveLedger';
import { v2color } from './../tokens';
import type { ScreenProps } from './types';

/**
 * SCREEN 6 — TRY IT. The aha moment.
 *
 * §2: "The aha moment. Neither reference app has this because neither can show
 * its magic in three seconds. This one can."
 *
 * ## IT IS NOT A MOCKUP (owner, 28 August 2026)
 *
 * The field is `NoteInput` from `components/note-surface.tsx` — the same
 * component Today writes on, with the same placeholder, the same
 * autocorrect-off/spellcheck-off/no-capitalisation trio and the same
 * `returnKeyType`. The reading below is `ExerciseCard`, the same component
 * Today draws an entry with. Neither is a copy; both are imported.
 *
 * "Anything that makes it behave differently from Today is a bug" — so the
 * things that differ are down to two, both listed in FINDINGS §21: the parse
 * runs on the offline grammar instead of the edge function (which is what
 * makes the screen work with no network and no account), and the three
 * store-backed sheets are inert.
 *
 * ## It works offline, by construction
 *
 * `demoParseText` is the local grammar — no network, no edge function, no key.
 * §2 asks for "a local fallback parser so it works offline"; this is not a
 * fallback, it is the only thing this screen ever calls, which is stronger. A
 * person on aeroplane mode sees exactly what everyone else sees.
 *
 * ## What happens when it cannot read the line
 *
 * The screen says so, plainly, and lets them continue anyway. Recore's contract
 * is that the raw text is the record (CLAUDE.md §3) — a line the small offline
 * grammar missed is a line the real parser may well read, and pretending
 * otherwise here would be the app calling someone's writing wrong. The typed
 * text is kept either way.
 */
export function DemoScreen({ def, progress, onAdvance, onBack, echo }: ScreenProps) {
  const set = useV2((s) => s.set);
  const stored = useV2((s) => s.answers.demoText);
  const [text, setText] = useState(stored);
  const [read, setRead] = useState<'idle' | 'ok' | 'unreadable'>('idle');
  const attempts = useRef(0);
  const field = useRef<TextInput>(null);

  const readLine = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        setRead('idle');
        return;
      }
      attempts.current += 1;
      const lines = trimmed.split('\n');
      const result = demoParseText(trimmed);
      const parsed = result.items.map((item) => demoEntryOfItem(item, lines[item.line] ?? trimmed));
      // A reading with no load and no reps is not a reading; it is the grammar
      // echoing the words back. Do not dress that up as success.
      //
      // This is only the ANSWER the later screens read (key lifts, the
      // projection, the seed). The RENDERING comes from `LiveLedger`, which
      // re-parses the same text through the same grammar.
      const usable = parsed.filter((e) => e.weightKg != null || e.reps.length > 0);
      setRead(usable.length > 0 ? 'ok' : 'unreadable');
      set('demoText', trimmed);
      set('demoEntries', usable);
      if (usable.length > 0) {
        track('onboarding_demo_parsed', {
          flow: 'v2',
          source: 'typed',
          parsed_locally: true,
          attempts: attempts.current,
          lines: usable.length,
        });
      } else {
        track('onboarding_demo_failed', { flow: 'v2', reason: 'no_load_or_reps' });
      }
    },
    [set],
  );

  const useExample = useCallback(() => {
    tap();
    setText(DEMO_EXAMPLE);
    readLine(DEMO_EXAMPLE);
    track('onboarding_demo_parsed', {
      flow: 'v2',
      source: 'example',
      parsed_locally: true,
      attempts: attempts.current,
    });
    field.current?.blur();
  }, [readLine]);

  return (
    <Frame
      headline={def.headline}
      subline={def.subline}
      progress={progress}
      echo={echo}
      onBack={onBack}
      scroll={false}
      avoidKeyboard
      cta={{
        enabled: text.trim().length > 0,
        onPress: () => {
          if (read === 'idle') readLine(text);
          onAdvance();
        },
      }}
      testID="v2-screen-demo">
      <View style={styles.flex}>
        <Enter index={2}>
          {/* Today's own field, on Today's own writing surface — no card, no
              border, no rounded box. The empty page opens exactly the way a
              new note does, which is the thing this screen is demonstrating. */}
          <View style={styles.surface}>
            <NoteInput
              inputRef={field}
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => readLine(text)}
              placeholder={PLACEHOLDER}
              testID="v2-demo-field"
            />
          </View>
        </Enter>

        <Enter index={3} style={styles.exampleRow}>
          <PressScale
            onPress={useExample}
            haptic="none"
            accessibilityLabel={`Use this example: ${DEMO_EXAMPLE}`}
            style={styles.example}>
            <View style={styles.exampleInner}>
              <Text style={styles.exampleLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                Use this example
              </Text>
            </View>
          </PressScale>
        </Enter>

        {read === 'ok' ? (
          <View style={styles.result}>
            <LiveLedger text={text} />
          </View>
        ) : null}

        {read === 'unreadable' ? (
          <Enter index={4} style={styles.result}>
            <Text style={styles.miss} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              I can&apos;t read that line yet. It stays written exactly as you typed it, and you
              can carry on.
            </Text>
          </Enter>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  exampleRow: { marginTop: spacing.md, alignSelf: 'flex-start' },
  example: {},
  exampleInner: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  exampleLabel: { ...type.subhead, color: v2color.blue, fontWeight: '600' },
  /**
   * Today writes on the canvas itself — no field chrome, and no inset. Today's
   * `BODY_PADDING_H` is 24 and this flow's gutter is 24, so with nothing added
   * here the cursor opens at exactly the x it will on the real page, and the
   * cards that appear below it share that edge.
   */
  surface: { minHeight: 28 },
  result: { marginTop: spacing.xl },
  miss: { ...type.subhead, color: v2color.inkSecondary },
});
