import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps } from 'react';

import { color, glyph as glyphColor } from '@/lib/theme';

/** Semantic icon names used across the app. */
export type IconName =
  | 'chevron-down'
  | 'gear'
  | 'flame'
  | 'mic'
  | 'camera'
  | 'plus'
  | 'keyboard'
  | 'keyboard-hide'
  | 'apple'
  | 'google'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chart'
  | 'timer'
  | 'share'
  | 'plan'
  // The ledger's per-entry note: outline while the entry has nothing written on
  // it, filled once it carries the athlete's words. State, not decoration.
  | 'note'
  | 'note-on'
  // --- You: one leading glyph per settings row, so a long list is scannable
  // --- by shape before it is read (Granola / Cosmos / Zocdoc on Mobbin).
  | 'calendar'
  | 'target'
  | 'language'
  | 'plate'
  | 'barbell'
  | 'sparkle'
  | 'card'
  | 'bell'
  | 'refresh'
  | 'download'
  | 'table'
  | 'upload'
  | 'lock'
  // The trial timeline's "everything is unlocked today" node.
  | 'unlock'
  | 'document'
  | 'star'
  | 'sign-out'
  | 'trash'
  | 'wrench'
  // The settled card's ⋯ (entry-actions-sheet) and its Edit row.
  | 'ellipsis'
  | 'pencil'
  // Clear a field's text — filled, because it is a control on top of an input
  // rather than a label beside one.
  | 'close';

type Glyph =
  | { set: 'ion'; name: ComponentProps<typeof Ionicons>['name'] }
  | { set: 'mci'; name: ComponentProps<typeof MaterialCommunityIcons>['name'] };

// A single consistent, monochrome outline set (Ionicons), plus the two MCI
// keyboard glyphs, which Ionicons lacks.
const MAP: Record<IconName, Glyph> = {
  'chevron-down': { set: 'ion', name: 'chevron-down' },
  gear: { set: 'ion', name: 'settings-outline' },
  flame: { set: 'ion', name: 'flame-outline' },
  mic: { set: 'ion', name: 'mic-outline' },
  camera: { set: 'ion', name: 'camera-outline' },
  plus: { set: 'ion', name: 'add' },
  keyboard: { set: 'mci', name: 'keyboard-outline' },
  // The accessory bar's "put the keyboard away" button — the outline variant,
  // so it sits in the same weight as every other glyph in the bar.
  'keyboard-hide': { set: 'mci', name: 'keyboard-close-outline' },
  apple: { set: 'ion', name: 'logo-apple' },
  google: { set: 'ion', name: 'logo-google' },
  'chevron-back': { set: 'ion', name: 'chevron-back' },
  'chevron-forward': { set: 'ion', name: 'chevron-forward' },
  chart: { set: 'ion', name: 'stats-chart-outline' },
  timer: { set: 'ion', name: 'timer-outline' },
  share: { set: 'ion', name: 'share-outline' },
  // The accessory bar's "write the next planned movement" button — a list, not
  // a plus: nothing is being created, a line that already exists is being taken.
  plan: { set: 'ion', name: 'list-outline' },
  // A speech bubble, because the content is the athlete's own words about that
  // entry — a pencil would read as "edit this line", which the card body
  // already does.
  note: { set: 'ion', name: 'chatbubble-outline' },
  'note-on': { set: 'ion', name: 'chatbubble' },

  // You's row glyphs. All outline, all the same optical weight, and each with
  // its own colour (GLYPH_TINT below, owner 28 July) — wayfinding, so a long
  // settings list is scanned by shape AND hue before it is read. Never filled.
  calendar: { set: 'ion', name: 'calendar-outline' },
  target: { set: 'ion', name: 'barbell-outline' },
  language: { set: 'ion', name: 'language-outline' },
  plate: { set: 'ion', name: 'disc-outline' },
  barbell: { set: 'ion', name: 'barbell-outline' },
  sparkle: { set: 'ion', name: 'sparkles-outline' },
  card: { set: 'ion', name: 'card-outline' },
  bell: { set: 'ion', name: 'notifications-outline' },
  refresh: { set: 'ion', name: 'refresh-outline' },
  download: { set: 'ion', name: 'download-outline' },
  table: { set: 'ion', name: 'grid-outline' },
  upload: { set: 'ion', name: 'cloud-upload-outline' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  unlock: { set: 'ion', name: 'lock-open-outline' },
  document: { set: 'ion', name: 'document-text-outline' },
  star: { set: 'ion', name: 'star-outline' },
  'sign-out': { set: 'ion', name: 'log-out-outline' },
  trash: { set: 'ion', name: 'trash-outline' },
  ellipsis: { set: 'ion', name: 'ellipsis-horizontal' },
  pencil: { set: 'ion', name: 'pencil-outline' },
  wrench: { set: 'ion', name: 'construct-outline' },
  close: { set: 'ion', name: 'close-circle' },
};

/**
 * Each settings glyph's own colour (owner, 28 July). The map is keyed by the
 * GLYPH, not by the row, so `sparkle` is the same gold wherever it appears and
 * a colour can never mean two things — the condition the palette in
 * `theme/color.ts` is allowed to exist under.
 *
 * It is opt-in: `Icon` still defaults to quiet grey. Two surfaces ask for a
 * tint — You's settings rows, and (owner, 29 Jul) the lift sheet's three stat
 * LABELS plus its summary card's own label. In both places the glyph sits
 * beside a caption and never beside a value: Today, Next, Progress and every
 * record row stay uncoloured, because those report the record and the record
 * is ink (§5.1).
 *
 * `trash` is absent on purpose — a destructive row already draws in
 * `color.error`, and a second red would be a second meaning for red.
 */
const GLYPH_TINT: Partial<Record<IconName, string>> = {
  bell: glyphColor.indigo,
  calendar: glyphColor.indigo,
  target: glyphColor.orange,
  language: glyphColor.teal,
  plate: glyphColor.gold,
  barbell: glyphColor.slate,
  sparkle: glyphColor.gold,
  card: glyphColor.indigo,
  refresh: glyphColor.teal,
  download: glyphColor.teal,
  table: glyphColor.plum,
  upload: glyphColor.orange,
  lock: glyphColor.slate,
  unlock: glyphColor.slate,
  document: glyphColor.slate,
  star: glyphColor.gold,
  'sign-out': glyphColor.slate,
  wrench: glyphColor.slate,
};

/** A settings glyph's colour, or the quiet default for everything else. */
export function glyphTint(name: IconName): string {
  return GLYPH_TINT[name] ?? color.textSecondary;
}

type IconProps = {
  name: IconName;
  size?: number;
  /** Defaults to muted grey — icons stay quiet until they mean something. */
  tint?: string;
};

export function Icon({ name, size = 20, tint = color.textSecondary }: IconProps) {
  const g = MAP[name];
  if (g.set === 'mci') {
    return <MaterialCommunityIcons name={g.name} size={size} color={tint} />;
  }
  return <Ionicons name={g.name} size={size} color={tint} />;
}
