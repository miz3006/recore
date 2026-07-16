import { createRef } from 'react';
import type { TextInput } from 'react-native';

/**
 * The home editor registers itself here so the bottom toolbar can drop the
 * user straight into writing (the + button = "start a new line"). A module
 * ref, not state: focusing must never re-render the note surface.
 */
export const noteInputRef = createRef<TextInput>();

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
