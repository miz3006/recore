import { createRef } from 'react';
import type { ScrollView, TextInput } from 'react-native';

/**
 * The home editor registers itself here so the bottom toolbar can drop the
 * user straight into writing (the + button = "start a new line"). A module
 * ref, not state: focusing must never re-render the note surface.
 */
export const noteInputRef = createRef<TextInput>();

/** The note's scroll container, registered the same way, so the accessory
 * bar's Finish can settle the eye on the session receipt under the text. */
export const noteScrollRef = createRef<ScrollView>();

/** Finish session: bring the receipt (the settled ledger card at the bottom
 * of the note) into view. `animated` is gated on reduceMotion by the caller. */
export function revealReceipt(animated = true): void {
  noteScrollRef.current?.scrollToEnd({ animated });
}

const RETRY_MS = 30;
const RETRIES = 5;

/**
 * Focus the editor. When the ghost prediction was just dismissed the editor
 * mounts on the NEXT render, so retry across a few frames until it exists.
 */
export function focusNote(attempt = 0): void {
  const input = noteInputRef.current;
  if (input) {
    input.focus();
    return;
  }
  if (attempt < RETRIES) {
    setTimeout(() => focusNote(attempt + 1), RETRY_MS);
  }
}
