import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolView } from 'expo-symbols';
import { type ComponentProps } from 'react';

import { color, glyph as glyphColor } from '@/lib/theme';

/** Semantic icon names used across the app. */
export type IconName =
  | 'chevron-down'
  | 'gear'
  | 'flame'
  | 'mic'
  // Listening. Filled, like `note-on`: a control that is RUNNING says so with
  // its shape, not only with the fill behind it.
  | 'mic-on'
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
  'mic-on': { set: 'ion', name: 'mic' },
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
 * THE PLATFORM'S OWN GLYPHS, WHERE THEY EXIST (owner, 20 Aug 2026).
 *
 * A name listed here draws as an **SF Symbol** on iOS and keeps its
 * Ionicons/MCI outline everywhere else. `SymbolView` renders its `fallback`
 * off-iOS by construction, so there is no platform branch at any call site and
 * no way for the two to drift apart.
 *
 * The argument is the same one that makes SF Pro the app's face rather than a
 * bundled webfont: **Apple's set already carries the optical sizing, stroke
 * weight and alignment that a third-party outline can only approximate**, and
 * it is the set every other control on an iPhone is drawn from. A glyph that is
 * half a point heavier than the keyboard it floats over reads as a foreign
 * control before it reads as anything else.
 *
 * IT IS A LIST, NOT A SWITCH. Only the three accessory-bar glyphs are on it —
 * that bar is now entirely SF, so it is internally consistent, and no screen
 * shows a mixed pair. Moving more of the app over is one line each, and should
 * be done a surface at a time for exactly that reason.
 *
 * `box` widens the square the symbol is fitted into. SF Symbols are laid out by
 * their own metrics, not by a square, so a wide glyph
 * (`keyboard.chevron.compact.down`) fitted into an 18-point box comes out
 * noticeably shorter than a narrow one beside it; the multiplier buys the wide
 * ones back their height. Optical, not arithmetic — it is set by eye on device.
 */
type Symbol = {
  name: ComponentProps<typeof SymbolView>['name'];
  /** Multiplier on the fitting box — see above. Defaults to 1. */
  box?: number;
};

const SF: Partial<Record<IconName, Symbol>> = {
  timer: { name: 'timer' },
  mic: { name: 'mic' },
  'mic-on': { name: 'mic.fill' },
  // Apple's own "put the keyboard away" glyph — the one iOS itself puts in an
  // accessory bar, and the reason this button no longer needs the MCI set.
  'keyboard-hide': { name: 'keyboard.chevron.compact.down', box: 1.2 },
};

/** The weight every SF glyph is drawn at. `regular` is a hair thin against the
 * Ionicons outlines the rest of the app still uses; `medium` matches them and
 * holds up over the system keyboard's own blur. One value, so the set can never
 * disagree with itself. */
const SF_WEIGHT = 'medium' as const;

/**
 * Each glyph's own colour (owner, 28 July; extended to the accessory bar on
 * 20 Aug 2026). The map is keyed by the GLYPH, not by the row, so `sparkle` is
 * the same gold wherever it appears and a colour can never mean two things —
 * the condition the palette in `theme/color.ts` is allowed to exist under.
 *
 * It is opt-in: `Icon` still defaults to quiet grey. Three surfaces ask for a
 * tint — You's settings rows, the lift sheet's three stat LABELS plus its
 * summary card's own label (owner, 29 Jul), and the accessory bar's circular
 * buttons (v6). In every one of them the glyph sits beside a caption or inside
 * a control and never beside a value: **the record itself stays ink** (§5.1).
 *
 * ## The accessory tints (v6, design skill §Structure)
 *
 * "Accessory buttons are coloured glyphs in white circles — the colour is on
 * the glyph, never on the circle." The ones below join the existing families
 * rather than inventing hues, which is the only way "one colour per glyph"
 * survives adding a surface:
 *
 * · `timer` → orange, the family of what you aim at and what is counting.
 * · `mic` / `mic-on` → teal, the words-and-movement family (`language`,
 *   `refresh`). One glyph in two states is one colour.
 * · `keyboard-hide` → slate, the plumbing (`lock`, `document`, `wrench`).
 * · `plan` → indigo, the structure family (`calendar`, `card`) — **kept, but
 *   the bar's plan button was removed on 20 Aug 2026 and nothing draws it
 *   today.** The entry stands because the tint is a property of the glyph, not
 *   of the call site that happened to want it.
 *
 * Measured on the white circle they sit in: indigo 5.85, slate 5.47, orange
 * 4.03, teal 4.03 — every one past the 3:1 a non-text mark owes, and past it
 * again on the canvas (5.42 / 5.07 / 3.73 / 3.74 on the deepest tint).
 *
 * **Brand blue, planned green and red are not in this set and may never be
 * added to it**, and `trash` is absent for the same reason — a destructive row
 * already draws in `color.error`, and a second red would be a second meaning
 * for red.
 */
const GLYPH_TINT: Partial<Record<IconName, string>> = {
  // The accessory bar.
  timer: glyphColor.orange,
  mic: glyphColor.teal,
  'mic-on': glyphColor.teal,
  plan: glyphColor.indigo,
  'keyboard-hide': glyphColor.slate,

  // You's settings rows.
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
  const drawn =
    g.set === 'mci' ? (
      <MaterialCommunityIcons name={g.name} size={size} color={tint} />
    ) : (
      <Ionicons name={g.name} size={size} color={tint} />
    );

  // On iOS a listed glyph draws as the system symbol; `SymbolView` renders the
  // outline above as its own fallback on every other platform, so this is one
  // component with one call signature and no `Platform.OS` at any call site.
  const sf = SF[name];
  if (!sf) return drawn;
  return (
    <SymbolView
      name={sf.name}
      size={size * (sf.box ?? 1)}
      weight={SF_WEIGHT}
      tintColor={tint}
      fallback={drawn}
    />
  );
}
