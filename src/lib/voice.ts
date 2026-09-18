import { AppState, type AppStateStatus } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

import { devLog } from '@/lib/log';
import { deviceLocale } from '@/lib/locale';
import {
  applyResult,
  blockLines,
  EMPTY_BLOCK,
  matchLocale,
  splitOnPauses,
  stripStopPhrase,
  type DictationBlock,
} from '@/lib/voice-lines';

export {
  applyResult,
  blockLines,
  EMPTY_BLOCK,
  LINE_PAUSE_MS,
  matchLocale,
  splitOnPauses,
  STOP_PHRASES,
  stripStopPhrase,
  type DictationBlock,
  type VoiceSegment,
} from '@/lib/voice-lines';

/**
 * On-device dictation (CLAUDE.md §2: native speech recognition, NEVER a cloud
 * transcription API). expo-speech-recognition is a native module that only
 * exists in a dev build — in Expo Go we probe for it with
 * requireOptionalNativeModule (which returns null instead of THROWING, so no
 * red error ever hits the console) and every entry point degrades gracefully.
 *
 * ## THE DICTAPHONE RULES (owner, 17 September 2026)
 *
 * The complaint was two bugs wearing one coat: *"kr ostane vklopljen … in ko
 * hočem zapisati novo vajo zapisuje nazaj v to prvo vrstico"* — it stays on,
 * and the next exercise lands back in the first line. Both came from this file
 * treating a recogniser as a text firehose. Four rules replace that:
 *
 * **1. A DICTATION SESSION ALWAYS ENDS.** It ends on the button, on a spoken
 * "done" / "that's it", on {@link SILENCE_STOP_MS} of nothing recognised, on
 * {@link MAX_SESSION_MS} in total, and on the app going to the background. It
 * also ends when the caller says so — typing is a caller-side end (see
 * `use-dictation.ts`). There is no path that leaves the microphone live.
 *
 * **2. STOPPING IS GUARANTEED, NOT REQUESTED.** `stop()` asks the recogniser
 * for a last result, then WATCHES: if `end` has not arrived it aborts, and if
 * abort is not honoured either it declares the session over locally. A UI that
 * says "listening" while the recogniser is wedged is the same lie as a mic that
 * never switched off.
 *
 * **3. A PAUSE IS A LINE BREAK.** The recogniser hands back one growing
 * transcript; the record is written in lines, one exercise per line. Word
 * timings (`segments`) turn the pauses between phrases into `\n`, so
 * *"bench 100 times 5"* … pause … *"squat 140 times 3"* arrives as two lines
 * and the second exercise stops landing back on the first. {@link splitOnPauses}
 * is pure and tested.
 *
 * **4. THE SESSION'S TEXT IS A BLOCK, NOT A STREAM.** Every update carries the
 * WHOLE dictated block, so the caller can write `anchor + block` and nothing
 * accumulates twice — the old `onTranscript` contract made every call site
 * re-derive that, and every call site got it slightly wrong.
 *
 * The level meter (`onLevel`) exists so the bar over the keyboard can show the
 * microphone actually hearing something. It is a readout of live input, not
 * decoration: see `dictation-bar.tsx`.
 */
type SpeechModule = typeof import('expo-speech-recognition');

let cached: SpeechModule | null | undefined;

function getSpeech(): SpeechModule | null {
  if (cached !== undefined) return cached;
  const native = requireOptionalNativeModule('ExpoSpeechRecognition');
  if (native == null) {
    cached = null; // Expo Go / module not linked — quiet no-op
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech-recognition') as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function voiceAvailable(): boolean {
  return getSpeech() !== null;
}

/* ------------------------------------------------------------------ *
 * Which language the microphone listens in
 * ------------------------------------------------------------------ */

/**
 * THE RECOGNISER IS NOT AUTOMATICALLY IN YOUR LANGUAGE, AND CANNOT ALWAYS BE.
 *
 * Two facts, both measured on 17 September 2026 rather than assumed, because
 * the comment that used to stand here asserted the opposite of the first one:
 *
 * 1. **Omitting `lang` means English, not "the device's language".** The
 *    module's `SpeechRecognitionOptions.swift` declares
 *    `var lang: String = "en-US"`. Until this function existed, Recore dictated
 *    in English on every phone on earth.
 * 2. **Apple dictates 63 locales and Slovene is not one of them.** Read off
 *    `getSupportedLocales()` on iOS 26.5: the Slavic ones are `cs-CZ`, `hr-HR`,
 *    `pl-PL`, `ru-RU`, `sk-SK`, `uk-UA`. Handing the recogniser `sl-SI` throws
 *    `language-not-supported` and the session dies on the spot.
 *
 * So the device's language is USED WHEN APPLE HAS IT and English stands in when
 * it does not — and the caller is told which happened (`fellBack`), because a
 * microphone quietly hearing a different language than the one being spoken is
 * the kind of thing a person should be told once rather than deduce from
 * nonsense in their record.
 *
 * The parse side needs none of this: `parse-workout/prompt.ts` reads any
 * language, spelled-out numbers included ("osemdeset kil", "4 serije po 10").
 * The gap is hearing, never reading.
 */
export interface DictationLocale {
  /** What the recogniser is told to listen for, e.g. `de-DE` or `en-US`. */
  lang: string;
  /** True when the device's own language has no recogniser and English stood in. */
  fellBack: boolean;
}

export const FALLBACK_LANG = 'en-US';

let localeCache: DictationLocale | undefined;

async function resolveLocale(speech: SpeechModule): Promise<DictationLocale> {
  if (localeCache) return localeCache;
  const want = deviceLocale();
  try {
    const { locales } = await speech.ExpoSpeechRecognitionModule.getSupportedLocales({});
    const hit = matchLocale(want, locales ?? []);
    localeCache = hit ? { lang: hit, fellBack: false } : { lang: FALLBACK_LANG, fellBack: true };
  } catch {
    // No list means no way to know it is safe, and an unsupported locale kills
    // the session outright. English is the one answer that always starts.
    localeCache = { lang: FALLBACK_LANG, fellBack: true };
  }
  devLog('dictation locale:', want, '→', localeCache.lang, localeCache.fellBack ? '(fallback)' : '');
  return localeCache;
}

/* ------------------------------------------------------------------ *
 * The session
 * ------------------------------------------------------------------ */

/** Why a session ended — the caller decides what, if anything, to say about it. */
export type DictationEnd = 'user' | 'phrase' | 'silence' | 'limit' | 'background' | 'error';

export interface DictationHandle {
  /** Ask for a final result, then guarantee the session is over either way. */
  stop: (reason?: DictationEnd) => void;
  /** Drop the session now, final result or not. */
  abort: (reason?: DictationEnd) => void;
  /** What this session is actually listening for — see {@link DictationLocale}. */
  locale: DictationLocale;
}

/** Nothing recognised for this long and the microphone lets go by itself. */
export const SILENCE_STOP_MS = 8_000;
/** No dictation runs longer than this, whatever happens. */
export const MAX_SESSION_MS = 180_000;
/** How often the level meter is sampled. 80 ms ≈ 12 readings a second. */
const VOLUME_INTERVAL_MS = 80;
/** `stop()` gets this long to produce an `end` before we abort. */
const STOP_GRACE_MS = 1_200;
/** `abort()` gets this long before the session is declared over locally. */
const ABORT_GRACE_MS = 600;

/**
 * Start dictating.
 *
 * `onLines` carries the WHOLE dictated block every time — replace, never
 * append. `onLevel` is the microphone's input level, 0…1, for a listening
 * readout. `onEnd` always fires exactly once. Returns null if dictation is
 * unavailable or permission was refused.
 */
export async function startDictation(handlers: {
  onLines: (lines: string[], final: boolean) => void;
  onLevel?: (level: number) => void;
  onEnd: (reason: DictationEnd) => void;
}): Promise<DictationHandle | null> {
  const speech = getSpeech();
  if (!speech) return null;

  const { ExpoSpeechRecognitionModule } = speech;
  try {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) return null;
  } catch {
    return null;
  }

  const locale = await resolveLocale(speech);

  let block: DictationBlock = EMPTY_BLOCK;
  let ended = false;
  let stopping: DictationEnd | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    if (capTimer) clearTimeout(capTimer);
    if (graceTimer) clearTimeout(graceTimer);
    silenceTimer = capTimer = graceTimer = null;
  };

  /** The one exit. Everything that ends a session comes through here. */
  const finish = (reason: DictationEnd) => {
    if (ended) return;
    ended = true;
    clearTimers();
    for (const s of subs) s.remove();
    appState.remove();
    handlers.onEnd(reason);
  };

  const stop = (reason: DictationEnd = 'user') => {
    if (ended || stopping) return;
    stopping = reason;
    clearTimers();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      finish(reason);
      return;
    }
    // RULE 2: stopping is guaranteed. If `end` does not arrive, abort; if the
    // abort is not honoured either, the session is over as far as the app is
    // concerned — the alternative is a UI that claims to be listening forever.
    graceTimer = setTimeout(() => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        finish(reason);
        return;
      }
      graceTimer = setTimeout(() => finish(reason), ABORT_GRACE_MS);
    }, STOP_GRACE_MS);
  };

  const abort = (reason: DictationEnd = 'user') => {
    if (ended) return;
    stopping = reason;
    clearTimers();
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      finish(reason);
      return;
    }
    graceTimer = setTimeout(() => finish(reason), ABORT_GRACE_MS);
  };

  /** RULE 1: silence lets go. Only RECOGNISED WORDS keep the session alive —
   * a noisy gym would hold the microphone open forever if the meter counted. */
  const heard = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => stop('silence'), SILENCE_STOP_MS);
  };

  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      if (ended || stopping) return;
      const first = event.results?.[0];
      if (!first) return;

      const fromSegments = splitOnPauses(
        (first.segments ?? []).map((s) => ({
          startMs: s.startTimeMillis,
          endMs: s.endTimeMillis,
          text: s.segment,
        })),
      );
      const lines = fromSegments.length > 0 ? fromSegments : [first.transcript];
      if (lines.every((l) => l.trim().length === 0)) return;

      heard();
      const next = applyResult(block, { lines, final: event.isFinal ?? false });
      const spoken = stripStopPhrase(blockLines(next));
      block = next;
      handlers.onLines(spoken.lines, event.isFinal ?? false);
      // RULE 1: the spoken end. The command is already off the text above, so
      // what the caller wrote is what the person meant to keep.
      if (spoken.stopped) stop('phrase');
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      finish(stopping ?? 'user');
    }),
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      devLog('dictation error:', event.error);
      finish(stopping ?? (event.error === 'aborted' ? 'user' : 'error'));
    }),
  ];

  if (handlers.onLevel) {
    const onLevel = handlers.onLevel;
    subs.push(
      ExpoSpeechRecognitionModule.addListener('volumechange', (event) => {
        if (ended) return;
        // The module documents −2…10, "anything below 0 is inaudible". Normal
        // speech sits around 3–6, so 6 is the top of the meter rather than 10:
        // a bar that only moves when you shout is not a readout.
        onLevel(Math.max(0, Math.min(1, event.value / 6)));
      }),
    );
  }

  /** RULE 1: a backgrounded app has no business holding the microphone. */
  const appState = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state !== 'active') abort('background');
  });

  try {
    ExpoSpeechRecognitionModule.start({
      interimResults: true,
      continuous: true, // keep listening through rest-pause breathing
      volumeChangeEventOptions: handlers.onLevel
        ? { enabled: true, intervalMillis: VOLUME_INTERVAL_MS }
        : undefined,
      // The device's language when Apple has it, English when it does not —
      // `resolveLocale` above carries the whole reason, and the numbers behind
      // it. Never omitted: omitting it is English by accident rather than by
      // decision, which is how this shipped English-only until 17 Sep 2026.
      lang: locale.lang,
    });
  } catch {
    ended = true;
    for (const s of subs) s.remove();
    appState.remove();
    return null;
  }

  heard();
  capTimer = setTimeout(() => stop('limit'), MAX_SESSION_MS);

  return { stop, abort, locale };
}
