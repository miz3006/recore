import { requireOptionalNativeModule } from 'expo-modules-core';

import { devLog } from '@/lib/log';

/**
 * On-device dictation (CLAUDE.md §2: native speech recognition, NEVER a cloud
 * transcription API). expo-speech-recognition is a native module that only
 * exists in a dev build — in Expo Go we probe for it with
 * requireOptionalNativeModule (which returns null instead of THROWING, so no
 * red error ever hits the console) and every entry point degrades gracefully.
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

export interface DictationHandle {
  stop: () => void;
}

/**
 * Start dictating. `onTranscript` fires with the CURRENT utterance's text
 * (interim and final — `final` marks a settled segment), `onEnd` when the
 * session closes for any reason. Returns null if unavailable or denied.
 */
export async function startDictation(handlers: {
  onTranscript: (text: string, final: boolean) => void;
  onEnd: () => void;
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

  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript ?? '';
      if (transcript) handlers.onTranscript(transcript, event.isFinal ?? false);
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      cleanup();
      handlers.onEnd();
    }),
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      devLog('dictation error:', event.error);
      cleanup();
      handlers.onEnd();
    }),
  ];

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const s of subs) s.remove();
  };

  try {
    ExpoSpeechRecognitionModule.start({
      interimResults: true,
      continuous: true, // keep listening through rest-pause breathing
      // lang omitted → device locale; workout terms parse fine either way.
    });
  } catch {
    cleanup();
    return null;
  }

  return {
    stop: () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        cleanup();
        handlers.onEnd();
      }
    },
  };
}
