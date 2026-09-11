import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/motion';
import { PaperField } from '@/components/paper-field';
import { SetTable, worthTable } from '@/components/set-table';
import { track } from '@/lib/analytics';
import {
  DEMO_EXAMPLE,
  demoEntryOfItem,
  demoItemOf,
  demoParseText,
  type DemoEntry,
  type DemoReading,
  type DemoSource,
} from '@/lib/demo-parse';
import { remoteDemoParse } from '@/lib/demo-parse-remote';
import { success } from '@/lib/haptics';
import { DUR, SPRING } from '@/lib/motion';
import { buildReceipt, namesMatch, typedNameOf, type ReceiptRow } from '@/lib/parse/receipt';
import type { ParseResult } from '@/lib/parse/types';
import {
  alpha,
  color,
  FIXED_FONT_SCALE,
  HIT,
  lineFor,
  MAX_FONT_SCALE,
  moderateScale,
  radius,
  readingStyle,
  shadow,
  spacing,
  type,
} from '@/lib/theme';
import { startDictation, voiceAvailable, type DictationHandle } from '@/lib/voice';

import { PrimaryCta } from './PrimaryCta';
import { ProgressRail } from './ProgressRail';
import { BACK_DIAMETER, CARD_FILL, INK_CHROME } from './tokens';

/**
 * THE DEMO SCREEN IS TODAY (owner, 23 August 2026: "make the same design as the
 * homepage — the whole Today page — and let them write two or three exercises";
 * then, the same day: "make the parser actually work exactly like it does in
 * Today, everything the same, the table too").
 *
 * What it replaces: `ParseDemo`, a single field in the middle of the funnel
 * template that read ONE line and showed a card underneath it. It proved the
 * parser and it proved nothing about the app — the person met the screen they
 * will spend 85 % of their time on for the first time AFTER paying.
 *
 * ## It is the same pipeline, not a lookalike
 *
 * Today's ledger is not drawn from readings. It is
 *
 *     raw text → ParseResult → buildReceipt() → ReceiptRow[] → SetTable
 *
 * and every step after the first is now shared code, imported from where Today
 * imports it (`lib/parse/receipt.ts`, `lib/parse/summarize.ts`,
 * `components/set-table.tsx`). So the per-set table, the compact set text, the
 * done keys, the numbering that labels a warm-up instead of counting it, the
 * alias echo when the parser renames a word — all of it behaves here because it
 * IS Today's behaviour rather than a copy of it. Several exercises on one line
 * become several cards, exactly as they do one screen later.
 *
 * The one step that CANNOT be shared is the parse itself: `parse-workout` is an
 * edge function behind a user JWT (§7.3) and there is no account on the fourth
 * screen of a funnel. So the `ParseResult` comes from the flow's own offline
 * grammar (`demoParseText`), and when the person happens to be signed in — a
 * replay from You — the real parser is asked as a second opinion and its
 * reading is merged in. What neither can read is NOT lost: the line stays on
 * the page in the app's own words for it ("kept as a note · not counted") and
 * reaches the record verbatim at signup, where the real parser reads it like
 * any other line.
 *
 * ## The one step that is not the template
 *
 * Every other screen of the flow is `OnboardingScreen` and must stay that way —
 * the fixed zones are what keep the headline and the button from drifting
 * between questions. This one is deliberately outside it, because the thing
 * being demonstrated IS a page layout, and a Today page inside a content band
 * under an onboarding headline is a screenshot of Today, not Today.
 *
 * It keeps three things that belong to the FLOW rather than to the page: the
 * back circle, the progress rail, and a SKIP beside them — the button at the
 * bottom waits for a record, and a person with nothing to write must always
 * have a door.
 *
 * ## The page says one thing
 *
 * The instruction lives in the placeholder ("Write your training (bench 100kg
 * 5,5,4)") and nowhere else (owner: *"naj bo s sivo pisal write your training in
 * v oklepajih nek primer, ostalo ni treba"*). The coach block that used to sit
 * above the composer and the "Try this one" chip below it are both gone: the
 * example is in the field, and the way past is the Skip at the top.
 *
 * Nothing here loops (§A.1); every entrance is one-shot and Reduce Motion keeps
 * the record and drops the travel.
 */

/** How many written lines the guidance is aiming at. */
const TARGET_LINES = 2;

/** How far the page reaches up over the scrolling record at its bottom edge. */
const PAGE_FADE = spacing.xxl;

export function DemoToday({
  headline,
  progress,
  onBack,
  onSkip,
  onContinue,
  onPage,
  written,
  cta,
}: {
  /** The step's question. It is not printed — the placeholder carries it — but
   * VoiceOver still announces it as the composer's label. */
  headline: string;
  progress: { total: number; completed: number };
  onBack: () => void;
  /** Past the screen with nothing written. Available from the first frame. */
  onSkip: () => void;
  onContinue: () => void;
  /** Everything written, after every change: the readings and the raw page. */
  onPage: (page: { entries: DemoEntry[]; text: string }) => void;
  /** The page as it was left, verbatim (`demoText`) — see the note on `lines`. */
  written?: string;
  /** The step's CTA label, used once the page holds two lines. */
  cta: string;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);

  /**
   * THE PAGE IS ITS RAW TEXT, exactly as Today's is (`note`). Everything drawn
   * below is derived from it on every render — there is no second copy of the
   * record in component state, which is the same reason the composer keeps the
   * note as one string rather than as a list of cards.
   *
   * It survives a back-swipe: every step of this funnel is its own route, so
   * walking back remounts the screen, and a session the person wrote two
   * screens ago vanishing off the page would be the app losing their words.
   */
  const [lines, setLines] = useState<string[]>(() => hydrate(written));
  const [text, setText] = useState('');
  /** Cards the person has un-checked. Same shape and same keys as Today's. */
  const [undone, setUndone] = useState<Record<string, boolean>>({});
  /**
   * Readings the REAL parser gave us for lines the offline grammar could not
   * read — keyed by the line's own words, so a re-render or a re-order can
   * never attach one to the wrong line.
   */
  const [remote, setRemote] = useState<Record<string, DemoReading>>({});

  /** The field's current words, readable from a callback that is not a render —
   * dictation ends outside React's flow and must not read a stale closure. */
  const latest = useRef('');
  const [recording, setRecording] = useState(false);
  const [mic] = useState(() => voiceAvailable());
  /** With the keyboard up the avoiding view already owns the bottom of the
   * screen, home indicator included — adding the inset over it would float the
   * button a second time. Exactly what the Today toolbar does. */
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const dictation = useRef<DictationHandle | null>(null);
  /** How many times this person asked the screen to read something (§13). */
  const attempts = useRef(0);
  /** Whether dictation produced words — an utterance is its own submission. */
  const spoken = useRef(false);

  const write = useCallback((value: string) => {
    latest.current = value;
    setText(value);
  }, []);

  // The keyboard opens by itself, a beat after the push has finished — asking
  // for it during the transition makes the platform animate two things at once
  // and the page arrives with a stutter.
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(show, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hide, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  useEffect(
    () => () => {
      dictation.current?.stop();
    },
    [],
  );

  const page = lines.join('\n');

  /** The written page as the app's own parse result, second opinions folded in. */
  const result = useMemo<ParseResult>(() => {
    const base = demoParseText(page);
    const covered = new Set(base.items.map((i) => i.line));
    const items = [...base.items];
    lines.forEach((raw, i) => {
      if (covered.has(i)) return;
      const reading = remote[raw.trim()];
      if (reading) items.push(demoItemOf(reading, i));
    });
    items.sort((a, b) => a.line - b.line);
    return { ...base, items };
  }, [page, lines, remote]);

  /** THE LEDGER, built by the same function that builds Today's. */
  const receipt = useMemo(() => buildReceipt(result, []), [result]);
  const rowsByLine = useMemo(() => {
    const map = new Map<number, ReceiptRow[]>();
    for (const row of receipt.rows) {
      const at = map.get(row.line);
      if (at) at.push(row);
      else map.set(row.line, [row]);
    }
    return map;
  }, [receipt]);

  // The page travels up after every change — never from inside a state updater,
  // which React may run twice.
  useEffect(() => {
    if (lines.length === 0) return;
    const entries = result.items.map((item) => demoEntryOfItem(item, lines[item.line] ?? ''));
    onPage({ entries, text: page });
  }, [lines, page, result, onPage]);

  /** Put a line on the page: the field clears, the success haptic fires on the
   * frame the record arrives, and the page scrolls to it. */
  const land = useCallback(
    (raw: string) => {
      setLines((current) => [...current, raw]);
      write('');
      success();
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: !reduce }));
    },
    [reduce, write],
  );

  /**
   * Commit what is written. The line LANDS FIRST and is read afterwards, which
   * is the order Today uses too: the words are the record and a reading is a
   * projection over them, so nothing on the page ever waits on a parse.
   */
  const commit = useCallback(
    (source: DemoSource, value: string) => {
      const line = value.trim();
      if (!line) return;
      attempts.current += 1;
      land(line);

      if (demoParseText(line).items.length > 0) {
        track('onboarding_demo_parsed', {
          source,
          parsed_locally: true,
          attempts: attempts.current,
        });
        return;
      }

      // Nothing the grammar could read. Ask the real parser when there is a
      // session for it to use; either way the words stay on the page.
      void remoteDemoParse(line).then((reading) => {
        if (reading) {
          setRemote((current) => ({ ...current, [line]: reading }));
          track('onboarding_demo_parsed', {
            source,
            parsed_locally: false,
            attempts: attempts.current,
          });
          return;
        }
        // The reason is a CATEGORY, never the line itself: what a person wrote
        // does not leave the device (§7.3), not even to explain a miss.
        track('onboarding_demo_failed', { reason: 'unreadable', attempts: attempts.current });
      });
    },
    [land],
  );

  const toggleMic = useCallback(async () => {
    if (recording) {
      dictation.current?.stop();
      return;
    }
    spoken.current = false;
    const handle = await startDictation({
      onTranscript: (transcript) => {
        spoken.current = true;
        write(transcript);
      },
      onEnd: () => {
        dictation.current = null;
        setRecording(false);
        // The utterance is the submission: nobody dictates a line and then
        // reaches for a return key.
        if (spoken.current) commit('dictated', latest.current);
      },
    });
    if (handle) {
      dictation.current = handle;
      setRecording(true);
    }
  }, [commit, recording, write]);

  /** The live read-out of the line being typed — Today draws exactly this. */
  const preview = useMemo(
    () => (text.trim() ? buildReceipt(demoParseText(text), []).rows : []),
    [text],
  );

  const empty = lines.length === 0;
  const enough = lines.length >= TARGET_LINES;

  return (
    <View style={styles.root}>
      {/* The canvas Today draws, and the reason this page reads as the app
          rather than as a picture of it. Static, behind everything, untouchable. */}
      <PaperField />

      <SafeAreaView edges={['top']}>
        {/* The flow's own chrome: where you are, the way back, and the way past.
            SKIP is here rather than at the bottom because the bottom belongs to
            the button that waits for a record — a person with nothing to write
            must not have to invent something to get on. */}
        <View style={styles.chrome}>
          <PressableScale
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.back}>
            <Icon name="chevron-back" size={20} tint={color.textPrimary} />
          </PressableScale>
          <ProgressRail
            total={progress.total}
            completed={progress.completed}
            style={styles.progressRail}
          />
          <PressableScale
            onPress={onSkip}
            activeScale={0.96}
            hitSlop={spacing.sm}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
            style={styles.skip}>
            <Text style={styles.skipLabel} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Skip
            </Text>
          </PressableScale>
        </View>

        {/* Today's navigation row, to the letter: the wordmark, the day pill.
            The pill carries NO chevron and takes no touch — the calendar it
            opens does not exist yet, and a control that does nothing is worse
            than no control (§6). The session count is absent for the same
            reason it is absent on a real first open: there are none. */}
        <View style={styles.bar}>
          <View style={styles.side}>
            <Text style={styles.wordmark} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Recore
            </Text>
          </View>
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              Today
            </Text>
          </View>
          <View style={styles.side} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.flex}>
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            <Pressable style={styles.fill} onPress={() => input.current?.focus()}>
              {lines.map((raw, i) => {
                const rows = rowsByLine.get(i);
                if (!rows?.length) {
                  // A line with no reading is kept exactly as Today keeps one.
                  return (
                    <Animated.View
                      key={`n:${i}:${raw}`}
                      entering={reduce ? undefined : FadeInDown.duration(DUR.base)}>
                      <NoteCard text={raw.trim()} />
                    </Animated.View>
                  );
                }
                // The echoed word only makes sense when ONE exercise came off
                // the line; a run-on line has no single typed name.
                const alias = rows.length === 1 ? aliasEchoOf(raw, rows[0]!.exercise) : null;
                return rows.map((row, j) => {
                  const key = row.doneKey;
                  return (
                    <Animated.View
                      key={`${i}:${j}:${row.exercise}`}
                      entering={reduce ? undefined : FadeInDown.duration(DUR.base)}
                      layout={reduce ? undefined : LinearTransition.duration(DUR.base)}>
                      <ExerciseCard
                        row={row}
                        alias={alias}
                        done={!undone[key]}
                        reduceMotion={reduce}
                        onToggle={() => setUndone((u) => ({ ...u, [key]: !u[key] }))}
                      />
                    </Animated.View>
                  );
                });
              })}

              {/* The active line. On a blank page it sits at the top-left with
                  no rail to indent past — a new note in Apple Notes — and takes
                  the rail's indent once the page has a record on it. */}
              <Animated.View
                style={[styles.activeRow, !empty && styles.activeRowAfterRecord]}
                layout={reduce ? undefined : LinearTransition.duration(DUR.slow)}>
                {empty ? null : <View style={styles.rail} />}
                <View style={styles.activeBody}>
                  <View style={styles.activeLine}>
                    <TextInput
                      ref={input}
                      style={styles.input}
                      value={text}
                      onChangeText={write}
                      onSubmitEditing={() => commit('typed', text)}
                      blurOnSubmit={false}
                      returnKeyType="next"
                      placeholder={empty ? PLACEHOLDER : NEXT_PLACEHOLDER}
                      placeholderTextColor={color.textMuted}
                      selectionColor={color.accent}
                      cursorColor={color.accent}
                      keyboardAppearance="light"
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      maxLength={200}
                      accessibilityLabel={headline}
                      accessibilityHint="Write one exercise per line, then press return"
                      maxFontSizeMultiplier={MAX_FONT_SCALE}
                    />
                    {/* A dead control is worse than no control (§6): in Expo Go
                        the speech module is not linked, and then there is no
                        microphone here at all. */}
                    {mic ? (
                      <PressableScale
                        onPress={() => void toggleMic()}
                        activeScale={0.94}
                        accessibilityRole="button"
                        accessibilityLabel={recording ? 'Stop dictation' : 'Dictate a line'}
                        accessibilityState={{ selected: recording }}
                        style={styles.mic}>
                        <Icon
                          name={recording ? 'mic-on' : 'mic'}
                          size={moderateScale(19)}
                          tint={recording ? color.brand : color.textSecondary}
                        />
                      </PressableScale>
                    ) : null}
                  </View>

                  {preview.length > 0 ? (
                    <Animated.View entering={reduce ? undefined : FadeIn.duration(DUR.fast)}>
                      {preview.map((row, j) => (
                        <View key={`pv:${j}`} style={styles.previewRow}>
                          <Text
                            style={styles.previewName}
                            numberOfLines={1}
                            maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {row.exercise}
                          </Text>
                          <Text
                            style={styles.previewValue}
                            numberOfLines={1}
                            maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {row.setText}
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.previewHint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {preview.length > 1
                          ? `return to add ${preview.length} exercises`
                          : 'return to add'}
                      </Text>
                    </Animated.View>
                  ) : null}
                </View>
              </Animated.View>

              {/* ONE line of guidance, and only while it has something to say:
                  the person has written once and the screen asked for two or
                  three. It retires the moment the second line lands. */}
              {lines.length > 0 && !enough ? (
                <Animated.View entering={reduce ? undefined : FadeIn.duration(DUR.base)}>
                  <Text style={styles.hint} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Add another line — a session is a few of them.
                  </Text>
                </Animated.View>
              ) : null}
            </Pressable>
          </ScrollView>
          {/* The page takes the record over at the bottom edge instead of
              cutting it off against the button — the same fade the funnel
              template draws over its content band. */}
          <LinearGradient
            colors={[alpha(color.canvas, 0), color.canvas]}
            style={styles.pageFade}
            pointerEvents="none"
          />
        </View>

        {/* The button waits for the first record, so it arrives as the
            consequence of the moment rather than as a way past it. Skip is the
            way past it, and it is on the page from the first frame. */}
        <View
          style={[
            styles.ctaBand,
            { paddingBottom: keyboardOpen ? spacing.md : Math.max(insets.bottom, spacing.lg) },
          ]}>
          {empty ? null : (
            <Animated.View entering={reduce ? undefined : FadeInDown.duration(DUR.base)}>
              <PrimaryCta label={enough ? cta : 'Continue'} onPress={onContinue} />
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * One exercise, drawn the way the ledger draws it: the ring, the name, and the
 * sets — as a TABLE when there is more than one of them (`worthTable`), as the
 * compact one-liner when a single plain set would only be making a header for
 * itself. Both branches are Today's own component and Today's own rule.
 */
function ExerciseCard({
  row,
  alias,
  done,
  reduceMotion,
  onToggle,
}: {
  row: ReceiptRow;
  /** The word the person typed, when the parser resolved it to another name. */
  alias: string | null;
  done: boolean;
  reduceMotion: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.card}>
      {/* The check is its own tap target: done ↔ not-done, never deletes. */}
      <Pressable
        onPress={onToggle}
        hitSlop={spacing.sm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`${row.exercise} done`}
        style={styles.rail}>
        <AnimatedCheck done={done} reduceMotion={reduceMotion} />
      </Pressable>
      <View style={styles.cardBody}>
        <View style={styles.cardHead}>
          <Text
            style={[styles.exName, !done && styles.exNameUndone]}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.exercise}
          </Text>
          {alias ? (
            // The auto-fix made visible. On Today it is a button into the
            // correction sheet; that sheet does not exist yet here, so it is
            // the echo alone rather than a control that would do nothing.
            <Text style={styles.aliasEcho} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
              {`· “${alias}”`}
            </Text>
          ) : null}
        </View>
        {worthTable(row.table) ? (
          <SetTable table={row.table} />
        ) : (
          <Text style={styles.exValue} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {row.setText}
          </Text>
        )}
      </View>
    </View>
  );
}

/** A written line the parser had nothing to say about — kept, never lost, and
 * labelled with the app's own words for it. */
function NoteCard({ text }: { text: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.rail} />
      <View style={styles.cardBody}>
        <Text style={styles.proseText} numberOfLines={3} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          {text}
        </Text>
        <Text style={styles.proseMeta} maxFontSizeMultiplier={MAX_FONT_SCALE}>
          kept as a note · not counted
        </Text>
      </View>
    </View>
  );
}

/** The ledger's own check: a ring that is always there and a fill that springs
 * into it. Same shape, same spring and same ink as `note-surface.tsx`. */
function AnimatedCheck({ done, reduceMotion }: { done: boolean; reduceMotion: boolean }) {
  const s = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    s.set(reduceMotion ? (done ? 1 : 0) : withSpring(done ? 1 : 0, SPRING.snappy));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }], opacity: s.get() }));
  return (
    <View style={styles.mark}>
      <View style={styles.markRing} />
      <Animated.View style={[styles.markFill, fill]}>
        <Text style={styles.checkMark} maxFontSizeMultiplier={FIXED_FONT_SCALE}>
          ✓
        </Text>
      </Animated.View>
    </View>
  );
}

/** When the parser resolved a line to a name the person did NOT type ("bench" →
 * "Bench press"), echo their word beside the card — the same test Today uses. */
function aliasEchoOf(rawLine: string, canonical: string): string | null {
  const typed = typedNameOf(rawLine);
  return typed && !namesMatch(typed, canonical) ? typed : null;
}

/** The stored page, back into lines. The raw text is the record, so a remount
 * re-reads it rather than restoring a second copy of what it once meant. */
function hydrate(written: string | undefined): string[] {
  if (!written) return [];
  return written
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * THE ONLY INSTRUCTION ON THE PAGE (owner, 23 Aug 2026). Today's own
 * placeholder, carrying the example the "Try this one" chip used to type — one
 * grey line that says what to write and shows what it looks like, in the one
 * place the person is already looking.
 */
const PLACEHOLDER = `Write your training (${DEMO_EXAMPLE})`;
const NEXT_PLACEHOLDER = 'Next exercise…';

const RAIL_W = moderateScale(34);
const MARK = moderateScale(22);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // What shows wherever the gradient cannot render — the same page.
    backgroundColor: color.canvas,
  },
  flex: {
    flex: 1,
  },
  fill: {
    flexGrow: 1,
  },

  // --- the flow's chrome ------------------------------------------------
  chrome: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HIT,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xxl,
    gap: spacing.lg,
  },
  back: {
    width: BACK_DIAMETER,
    height: BACK_DIAMETER,
    borderRadius: BACK_DIAMETER,
    borderCurve: 'continuous',
    backgroundColor: INK_CHROME,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRail: {
    flex: 1,
  },
  skip: {
    minHeight: HIT,
    justifyContent: 'center',
  },
  /** A text button, never a second filled pill: the CTA is the one filled thing
   * on any screen of this flow, and Skip must not compete with it. */
  skipLabel: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textSecondary,
  },

  // --- Today's navigation row -------------------------------------------
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  side: {
    flex: 1,
  },
  wordmark: {
    ...type.headline,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: color.textPrimary,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: CARD_FILL,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  dayPillText: {
    ...type.subhead,
    fontWeight: '600',
    color: color.textPrimary,
  },

  // --- the page ----------------------------------------------------------
  page: {
    flexGrow: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xxl,
    // The fade's own height, so the last thing written comes to rest above it.
    paddingBottom: PAGE_FADE,
  },
  pageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: PAGE_FADE,
  },

  // A block per exercise: the rail (the ring) + the reading. Today's metrics.
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rail: {
    width: RAIL_W,
    alignItems: 'center',
    paddingTop: 1,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRing: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    borderWidth: 1.5,
    borderColor: color.textMuted,
  },
  markFill: {
    position: 'absolute',
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: color.onInk,
    fontSize: moderateScale(12),
    fontWeight: '700',
    lineHeight: lineFor(14),
  },
  exName: {
    flexShrink: 1,
    fontSize: moderateScale(17),
    fontWeight: '600',
    letterSpacing: -0.2,
    color: color.textPrimary,
  },
  exNameUndone: {
    // Recorded, but not marked done — a touch quieter, never struck out.
    color: color.textSecondary,
  },
  aliasEcho: {
    flexShrink: 1,
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  exValue: {
    ...readingStyle('400'),
    fontSize: moderateScale(14),
    color: color.textSecondary,
  },
  proseText: {
    fontSize: moderateScale(16),
    lineHeight: lineFor(22),
    color: color.textSecondary,
  },
  proseMeta: {
    fontSize: moderateScale(12),
    color: color.textSecondary,
  },

  // --- the active line ----------------------------------------------------
  activeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  /** The boundary the hairline used to draw: the gap above the line being
   * written is larger than any gap between two settled records. */
  activeRowAfterRecord: {
    paddingTop: spacing.xl,
  },
  activeBody: {
    flex: 1,
    gap: spacing.xs,
  },
  activeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: moderateScale(17),
    lineHeight: lineFor(23),
    color: color.textPrimary,
    padding: 0,
    minHeight: moderateScale(24),
  },
  /** The one floating control on the page — a white circle, like every
   * accessory in the app, with the colour on the glyph and never on the disc. */
  mic: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_FILL,
    ...shadow.card,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  previewName: {
    flexShrink: 1,
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: color.textSecondary,
  },
  previewValue: {
    ...readingStyle('400'),
    fontSize: moderateScale(13),
    color: color.textSecondary,
  },
  previewHint: {
    fontSize: moderateScale(11.5),
    color: color.textMuted,
  },

  hint: {
    ...type.subhead,
    color: color.textSecondary,
    marginTop: spacing.xl,
  },

  ctaBand: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
});
