/**
 * What "Start a session" offers (owner's spec §D.2, 13 Aug 2026) — pure, zero
 * I/O, runs under `node --test`.
 *
 * The picker is deliberately dumb about where its session types come from. The
 * caller hands it whatever the app has ALREADY detected — the declared split's
 * day templates (Push / Pull / Legs, Day A / Day B), which is the same list the
 * plan strip and the Next brief resolve against — plus which of them the
 * rotation says is due today, plus the last session if there is one. This file
 * only decides what the sheet shows and in which order, so the answer can be
 * asserted without a database.
 *
 * The two constants at the bottom of every list are the escape hatches the
 * spec names: repeat what was done last time, or start with nothing and write.
 * "Empty session" is ALWAYS offered — a suggestion layer that cannot be
 * declined is a gate, and Recore's canvas is never gated.
 */

export type SessionOptionKind =
  /** A detected session type: a day of the athlete's split. */
  | 'type'
  /** Do again what was done last session. */
  | 'repeat'
  /** A blank page — the behaviour Today has always had. */
  | 'empty';

export interface SessionOption {
  kind: SessionOptionKind;
  /** Plan-day id for a type; the two constants below for the others. */
  id: string;
  label: string;
  /** The one the rotation is due for. At most one option ever carries it. */
  due: boolean;
  /** One quiet line of provenance under the label, or null. */
  detail: string | null;
}

export const REPEAT_OPTION_ID = 'repeat';
export const EMPTY_OPTION_ID = 'empty';

export interface DetectedSessionType {
  id: string;
  label: string;
  /** e.g. "5 movements" — evidence, never a promise. */
  detail?: string | null;
}

export interface SessionOptionsInput {
  /** Detected session types, in the order the split declares them. */
  types: readonly DetectedSessionType[];
  /** Which of those the rotation resolved to for today, or null. */
  dueTypeId: string | null;
  /** The last session on the record, or null on a blank account. */
  last: { label: string; detail?: string | null } | null;
}

/**
 * The picker's options, in the order they are shown: the detected types with
 * the due one marked, then "Repeat last session" when there IS a last session,
 * then "Empty session".
 *
 * Types with no id or no label are dropped and duplicates collapse to the first
 * one seen — a malformed split may not put an unpressable row on a sheet.
 */
export function sessionOptions(input: SessionOptionsInput): SessionOption[] {
  const options: SessionOption[] = [];
  const seen = new Set<string>();

  for (const type of input.types) {
    const id = type.id?.trim();
    const label = type.label?.trim();
    if (!id || !label || seen.has(id)) continue;
    seen.add(id);
    options.push({
      kind: 'type',
      id,
      label,
      due: id === input.dueTypeId,
      detail: type.detail?.trim() || null,
    });
  }

  if (input.last) {
    options.push({
      kind: 'repeat',
      id: REPEAT_OPTION_ID,
      label: 'Repeat last session',
      // Never due: repeating is a choice the athlete makes against the
      // rotation, so marking it as owed would contradict the type above it.
      due: false,
      detail: input.last.detail?.trim() || input.last.label.trim() || null,
    });
  }

  options.push({
    kind: 'empty',
    id: EMPTY_OPTION_ID,
    label: 'Empty session',
    due: false,
    detail: null,
  });

  return options;
}

/** The option the sheet opens on: the due type, else the first thing offered. */
export function defaultOption(options: readonly SessionOption[]): SessionOption | null {
  return options.find((o) => o.due) ?? options[0] ?? null;
}
