import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { tap } from '@/lib/haptics';
import { type GutterSignal } from '@/lib/parse/types';
import { color, MAX_FONT_SCALE } from '@/lib/theme';
import { useCurrentNote, useGhostVisible, useSession } from '@/state/session-store';

import { GhostPrediction } from './ghost-prediction';
import { GutterPending, GutterValue, PENDING_STEP_MS, PendingDot } from './gutter-value';
import {
  BODY_PADDING_H,
  BODY_PADDING_TOP,
  GUTTER_GAP,
  GUTTER_WIDTH,
  NOTE_FONT_SIZE,
  NOTE_LINE_HEIGHT,
} from './note-metrics';
import { EmptyDayCards } from './empty-note-cards';
import { noteInputRef } from './note-focus';
import { SessionReceipt } from './session-receipt';

const EMPTY_PLACEHOLDER = 'Start logging your workout…';

/**
 * The blank page (CLAUDE.md §8). Tapping anywhere focuses a multiline input
 * with a WHITE blinking cursor. Every keystroke is written to SQLite in the
 * same tick (optimistic, local-first); the background parse then blooms each
 * line's COMPARISON SIGNAL vs the previous session into the RIGHT gutter —
 * ↑ +2.5, = same, ↓ -2 rep, or a PR flag. A signal is only shown while its
 * line still reads exactly as it did when parsed, so stale results never
 * mislabel edited text. On a new training day the page shows the cached ghost
 * prediction instead.
 *
 * RECEIPT MODE (CLAUDE.md §9): when the whole workout was typed in at once,
 * the gutter disappears entirely — the note runs full width, ONE quiet
 * thinking row sits under the last line while the parse is in flight, and the
 * session summary renders below the text instead of beside it.
 */
export function NoteSurface() {
  const note = useCurrentNote();
  const setNote = useSession((s) => s.setNote);
  const startFromGhost = useSession((s) => s.startFromGhost);
  const dismissGhost = useSession((s) => s.dismissGhost);
  const signals = useSession((s) => s.signals);
  const parsedSnapshot = useSession((s) => s.parsedSnapshot);
  const parsing = useSession((s) => s.parsing);
  const lineExercises = useSession((s) => s.lineExercises);
  const receiptMode = useSession((s) => s.receiptMode);
  const receipt = useSession((s) => s.receipt);
  const receiptReason = useSession((s) => s.receiptReason);
  const openExerciseSheet = useSession((s) => s.openExerciseSheet);
  const openFixSheet = useSession((s) => s.openFixSheet);
  const ghostVisible = useGhostVisible();

  // The module-level ref (note-focus.ts) so the toolbar's + can focus us too.
  const inputRef = noteInputRef;
  const [autoFocus, setAutoFocus] = useState(false);
  // Height of each logical line as actually laid out (accounts for wrapping),
  // measured off an invisible mirror so the gutter column can match it row-for-row.
  const [lineHeights, setLineHeights] = useState<number[]>([]);

  const focusInput = () => inputRef.current?.focus();

  const handleStart = () => {
    setAutoFocus(true); // the editor mounts next; drop the user straight into it
    startFromGhost();
  };
  const handleSomethingElse = () => {
    dismissGhost(); // just clears — no keyboard
  };

  const lines = note.split('\n');
  const snapshotLines = useMemo(() => (parsedSnapshot ?? '').split('\n'), [parsedSnapshot]);

  // Rank of each signal within the parse sweep (top-to-bottom stagger).
  const sweepOrder = useMemo(() => {
    const map = new Map<number, number>();
    [...signals].sort((a, b) => a.line - b.line).forEach((s, i) => map.set(s.line, i));
    return map;
  }, [signals]);

  // A parsed signal stays attached to its line only while that line's text is
  // unchanged since the parse — edits silence the gutter until the next parse —
  // and a blank line NEVER carries a signal: every line is its own unit.
  const signalForLine = (i: number): GutterSignal | null => {
    if (parsedSnapshot === null) return null;
    if (!lines[i] || lines[i].trim().length === 0) return null;
    if (lines[i] !== snapshotLines[i]) return null;
    return signals.find((s) => s.line === i)?.signal ?? null;
  };

  // While the analysis is in flight, lines still waiting for their result
  // breathe quiet dots in the exact spot the result will land.
  const pendingForLine = (i: number): boolean => {
    if (!parsing) return false;
    if (!lines[i] || lines[i].trim().length === 0) return false;
    return parsedSnapshot === null || lines[i] !== snapshotLines[i];
  };

  if (ghostVisible) {
    return (
      <View style={styles.body}>
        <GhostPrediction onStart={handleStart} onSomethingElse={handleSomethingElse} />
      </View>
    );
  }

  // RECEIPT MODE: full-width note, no gutter, no measuring mirror. One quiet
  // thinking row while the parse is in flight; the summary settles below.
  if (receiptMode) {
    return (
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}>
        <Pressable
          style={styles.fill}
          onPress={() => {
            tap();
            focusInput();
          }}>
          <TextInput
            ref={inputRef}
            style={[styles.input, styles.inputFullWidth]}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus={autoFocus}
            scrollEnabled={false}
            placeholder={EMPTY_PLACEHOLDER}
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          {parsing && !receipt ? (
            <View style={styles.thinkingRow}>
              <PendingDot delay={0} />
              <PendingDot delay={PENDING_STEP_MS} />
              <PendingDot delay={PENDING_STEP_MS * 2} />
            </View>
          ) : null}

          {receipt ? (
            <SessionReceipt
              data={receipt}
              reason={receiptReason}
              revision={parsedSnapshot ?? ''}
              stale={parsedSnapshot !== null && parsedSnapshot !== note}
              parsing={parsing}
              onExercise={openExerciseSheet}
              onFix={openFixSheet}
            />
          ) : null}
        </Pressable>
      </ScrollView>
    );
  }

  const setLineHeight = (i: number, h: number) =>
    setLineHeights((prev) => {
      if (prev[i] === h && prev.length === lines.length) return prev;
      const next = prev.slice(0, lines.length);
      next[i] = h;
      return next;
    });

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}>
      <Pressable
        style={styles.fill}
        onPress={() => {
          tap();
          focusInput();
        }}>
        <View style={styles.editor}>
          {/* EDITING LAYER — the real, editable note. */}
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus={autoFocus}
            scrollEnabled={false}
            placeholder={EMPTY_PLACEHOLDER}
            placeholderTextColor={color.textMuted}
            selectionColor={color.accent}
            cursorColor={color.accent}
            keyboardAppearance="dark"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textAlignVertical="top"
            allowFontScaling
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          />

          {/* MEASURING MIRROR — invisible read-only TextInputs, one per logical
              line, with the SAME component, type, and horizontal metrics as the
              editor. Because it is the same native text engine (not a Text
              approximation), a line wraps in the mirror exactly when it wraps
              in the editor — the gutter can never drift a row. */}
          <View aria-hidden pointerEvents="none" style={styles.mirror}>
            {lines.map((line, i) => (
              <TextInput
                key={i}
                style={styles.mirrorLine}
                value={line.length ? line : ' '}
                editable={false}
                multiline
                scrollEnabled={false}
                focusable={false}
                allowFontScaling
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                onLayout={(e) => setLineHeight(i, Math.round(e.nativeEvent.layout.height))}
              />
            ))}
          </View>

          {/* GUTTER — fixed-width right column; each value occupies its line's
              measured height with the signal pinned to the FIRST row, so a long
              line wraps on the left without ever colliding. Tapping a value
              opens the exercise sheet (history + chart + e1RM); long-pressing
              opens the parse correction sheet (CLAUDE.md §6.2). */}
          <View pointerEvents="box-none" style={styles.gutter}>
            {lines.map((_, i) => {
              const signal = signalForLine(i);
              const exercise = signal ? lineExercises[i] : undefined;
              return (
                <View key={i} pointerEvents="box-none" style={{ height: lineHeights[i] ?? NOTE_LINE_HEIGHT }}>
                  {!signal && pendingForLine(i) ? (
                    <GutterPending rowHeight={NOTE_LINE_HEIGHT} />
                  ) : exercise ? (
                    <Pressable
                      hitSlop={{ left: 8, right: 0, top: 0, bottom: 0 }}
                      onPress={() => {
                        tap();
                        openExerciseSheet(exercise);
                      }}
                      onLongPress={() => {
                        tap();
                        openFixSheet(i);
                      }}>
                      <GutterValue
                        rowHeight={NOTE_LINE_HEIGHT}
                        signal={signal}
                        order={sweepOrder.get(i) ?? 0}
                        revision={parsedSnapshot ?? ''}
                      />
                    </Pressable>
                  ) : (
                    <GutterValue
                      rowHeight={NOTE_LINE_HEIGHT}
                      signal={signal}
                      order={sweepOrder.get(i) ?? 0}
                      revision={parsedSnapshot ?? ''}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* The blank page is never a void: last session peek / first-run demo. */}
        {note.trim().length === 0 ? <EmptyDayCards /> : null}

        {/* THE LEDGER: every parsed session settles into one structured card
            under the note — resolved names, top sets, deltas, a total. The
            gutter answers per line; this is where the AI's reading of the
            whole session becomes impossible to miss (CLAUDE.md §9). */}
        {note.trim().length > 0 && receipt && receipt.rows.length >= 2 ? (
          <SessionReceipt
            data={receipt}
            reason={receiptReason}
            revision={parsedSnapshot ?? ''}
            stale={parsedSnapshot !== null && parsedSnapshot !== note}
            parsing={parsing}
            onExercise={openExerciseSheet}
            onFix={openFixSheet}
          />
        ) : null}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: BODY_PADDING_TOP,
    paddingHorizontal: BODY_PADDING_H,
  },
  fill: {
    flexGrow: 1,
  },
  editor: {
    position: 'relative',
  },
  input: {
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    color: color.textPrimary,
    fontWeight: '400',
    padding: 0,
    paddingRight: GUTTER_WIDTH + GUTTER_GAP,
    minHeight: NOTE_LINE_HEIGHT * 8, // blank page gets real breathing room
  },
  // Receipt mode: no gutter → the note gets the full page width.
  inputFullWidth: {
    paddingRight: 0,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingTop: NOTE_LINE_HEIGHT / 4,
  },
  mirror: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
    zIndex: -1,
  },
  // Identical metrics to the editor input: same font, same right reservation,
  // and — being a TextInput — the same intrinsic text insets.
  mirrorLine: {
    fontSize: NOTE_FONT_SIZE,
    lineHeight: NOTE_LINE_HEIGHT,
    fontWeight: '400',
    padding: 0,
    paddingRight: GUTTER_WIDTH + GUTTER_GAP,
  },
  gutter: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: GUTTER_WIDTH,
  },
});
