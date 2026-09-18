import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

import { tap, tapMedium } from '@/lib/haptics';
import { startDictation, voiceAvailable, type DictationEnd, type DictationHandle } from '@/lib/voice';

/**
 * THE ONE OWNER OF A DICTATION SESSION.
 *
 * Four surfaces dictate into a note — the Today toolbar and the three demo
 * composers — and until 17 September 2026 each one re-implemented the same
 * fifteen lines. They did not agree, and the two that mattered were both wrong
 * in the way the owner reported: the microphone stayed on after the words were
 * finished, and text kept landing back where the session had started.
 *
 * The rule this hook enforces, and the reason it exists at all:
 *
 * **THE MICROPHONE IS ON ONLY WHILE THE PERSON IS SPEAKING TO IT.** `voice.ts`
 * ends the session on the button, on "done", on silence, on a three-minute cap
 * and on the app backgrounding. This hook adds the two ends that only a screen
 * can see: **typing**, and **the writing surface going away**. A person who
 * reaches for the keyboard has stopped dictating — that is not a guess, it is
 * the same person telling us in the most direct way available.
 *
 * **THE NOTE IS `anchor + block`, RECOMPUTED, NEVER APPENDED.** `anchor` is
 * what the note held when the session began; `block` is everything said since,
 * one line per phrase. Every update rewrites the whole thing, so an interim
 * result revises itself in place instead of stacking, and a session can never
 * print the same set twice. If the note stops matching what this hook last
 * wrote, something else is writing — and rather than fight it, the session
 * ends. That is the fix for *"zapisuje nazaj v to prvo vrstico"*: the two
 * writers are no longer allowed to overlap at all.
 */

/**
 * The note this dictation writes into.
 *
 * Read through `get()` at call time, never captured — dictation results arrive
 * outside React's flow and a closure over the note would be a set behind.
 */
export interface NoteControl {
  get: () => string;
  set: (text: string) => void;
}

export interface Dictation {
  /** True from the moment the recogniser starts until the session has ended. */
  listening: boolean;
  /** The microphone's live input level, 0…1 — the listening readout reads this. */
  level: SharedValue<number>;
  /** Whole seconds of this session, for the clock on the bar. */
  seconds: number;
  /** False in Expo Go and anywhere the native module is not linked. */
  available: boolean;
  /**
   * True while this session is hearing a language the person may not be
   * speaking — their own has no recogniser and English stood in (`voice.ts`,
   * `resolveLocale`). The bar says so; nothing else branches on it.
   */
  usingFallbackLanguage: boolean;
  /** Start if idle, stop if listening. The mic button is this and nothing else. */
  toggle: () => void;
  /** End the session now. Safe to call when nothing is running. */
  stop: (reason?: DictationEnd) => void;
}

export function useDictation({
  control,
  value,
  onSettled,
  onUnavailable,
  settleOnEnd = false,
}: {
  control: NoteControl;
  /**
   * The note as the SCREEN currently renders it. Passing it is what lets a
   * keystroke end the session on the frame it happens rather than at the next
   * recognised word. Optional only because one caller has no render-time copy.
   */
  value?: string;
  /** Fired once per session, after it has ended. `spoke` is false if nothing
   * was ever recognised — a demo submits on the first, not on the second. */
  onSettled?: (reason: DictationEnd, spoke: boolean) => void;
  /** Replaces the default "needs the development build" alert. */
  onUnavailable?: () => void;
  /**
   * Leave a fresh empty line behind when the session ends with words.
   *
   * For a composer that writes one line at a time — Today's note, the v2 demo's
   * page — this is the OTHER half of the owner's report. Ending with the last
   * spoken phrase still sitting in the input means the next thing typed joins
   * it, which is "zapisuje nazaj v to prvo vrstico" all over again by a
   * different route. Settling the block and opening an empty line is exactly
   * what `settleActive` does when a line is committed by hand.
   *
   * Off for single-line fields, where a trailing newline is meaningless.
   */
  settleOnEnd?: boolean;
}): Dictation {
  const [listening, setListening] = useState(false);
  const [fellBack, setFellBack] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const level = useSharedValue(0);

  const handle = useRef<DictationHandle | null>(null);
  /** The note as it stood when this session started. */
  const anchor = useRef('');
  /** The last text this hook wrote. Anything else in the note is a foreign edit. */
  const written = useRef<string | null>(null);
  const spoke = useRef(false);

  // Callers re-create these every render; the session outlives a render, and
  // its callbacks all fire well after commit — so the refresh belongs in an
  // effect rather than in the render body.
  const latest = useRef({ control, onSettled, onUnavailable });
  useEffect(() => {
    latest.current = { control, onSettled, onUnavailable };
  });

  const stop = useCallback((reason: DictationEnd = 'user') => {
    handle.current?.stop(reason);
  }, []);

  /** The session is over: nothing here may leave state claiming otherwise. */
  const settle = useCallback((reason: DictationEnd) => {
    const dictated = written.current;
    handle.current = null;
    written.current = null;
    level.set(0);
    // The spoken block becomes record and the composer opens empty — but only
    // if the note is still exactly what this session wrote. If something else
    // has touched it since, it is not ours to reshape.
    if (
      settleOnEnd &&
      spoke.current &&
      dictated &&
      !dictated.endsWith('\n') &&
      latest.current.control.get() === dictated
    ) {
      latest.current.control.set(`${dictated}\n`);
    }
    setListening(false);
    setSeconds(0);
    // The app let go on its own — a spoken "done", a silence, the cap. The bar
    // leaving is the signal; this is the same sentence in the hand, so putting
    // the phone down mid-set still tells you the microphone is off.
    if (reason !== 'user') tap();
    latest.current.onSettled?.(reason, spoke.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleOnEnd]);

  const start = useCallback(async () => {
    tap();
    if (!voiceAvailable()) {
      const custom = latest.current.onUnavailable;
      if (custom) custom();
      else
        Alert.alert(
          'Voice input',
          'Dictation needs the development build (npx expo run:ios) — it is not available in Expo Go.',
        );
      return;
    }

    anchor.current = latest.current.control.get().replace(/\s+$/, '');
    written.current = anchor.current;
    spoke.current = false;

    const started = await startDictation({
      onLines: (lines) => {
        // A foreign edit means two writers on one note. Stop rather than
        // overwrite: whatever is there now was put there deliberately.
        if (written.current === null) return;
        if (latest.current.control.get() !== written.current) {
          stop('user');
          return;
        }
        const block = lines.join('\n');
        const base = anchor.current;
        const next = block ? (base ? `${base}\n${block}` : block) : base;
        if (block) spoke.current = true;
        written.current = next;
        latest.current.control.set(next);
      },
      onLevel: (v) => level.set(v),
      onEnd: settle,
    });

    if (started) {
      handle.current = started;
      setFellBack(started.locale.fellBack);
      setListening(true);
      setSeconds(0);
    } else {
      written.current = null;
      Alert.alert('Voice input', 'Microphone or speech permission was not granted.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settle, stop]);

  const toggle = useCallback(() => {
    if (listening) {
      tapMedium();
      stop('user');
      return;
    }
    void start();
  }, [listening, start, stop]);

  /** TYPING ENDS DICTATION. See the header — this is half the reported bug. */
  useEffect(() => {
    if (!listening || value === undefined || written.current === null) return;
    if (value !== written.current) stop('user');
  }, [listening, stop, value]);

  /** The clock on the bar. One reading a second, like the rest timer's. */
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  /** The screen is gone; the microphone goes with it. */
  useEffect(
    () => () => {
      handle.current?.abort('user');
      handle.current = null;
    },
    [],
  );

  return {
    listening,
    level,
    seconds,
    available: voiceAvailable(),
    usingFallbackLanguage: fellBack,
    toggle,
    stop,
  };
}
