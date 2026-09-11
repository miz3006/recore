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
  // --- Profile's "About you" rows. `target` already resolves to the barbell
  // --- outline, so the goal row needed a glyph that is actually a target, and
  // --- a duration and a grouping needed one each. All Ionicons outline, same
  // --- stroke, so the group reads as one family down its left edge.
  | 'crosshair'
  | 'person'
  | 'hourglass'
  | 'layers'
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
  // The undo pill under a deleted entry — the one mark in the app that means
  // "put that back", so it is Apple's own turn-back arrow and nothing else.
  | 'undo'
  // Clear a field's text — filled, because it is a control on top of an input
  // rather than a label beside one.
  | 'close'
  // --- The first-open tour's five cards (9 September 2026). The last three
  // --- are the SF Symbols `(tabs)/_layout.tsx` puts in the bar, spelled the
  // --- same way, so the card shows the exact mark it is about to spotlight.
  | 'tour-write'
  | 'tour-checkin'
  | 'tour-next'
  | 'tour-progress'
  | 'tour-you';

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
  crosshair: { set: 'ion', name: 'locate-outline' },
  // The other end of a coaching link. Outline like every other You row glyph;
  // the same mark `tour-you` draws, because it names the same idea — a person.
  person: { set: 'ion', name: 'person-outline' },
  hourglass: { set: 'ion', name: 'hourglass-outline' },
  layers: { set: 'ion', name: 'layers-outline' },
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
  undo: { set: 'ion', name: 'arrow-undo-outline' },
  'tour-write': { set: 'ion', name: 'create-outline' },
  'tour-checkin': { set: 'ion', name: 'checkmark-circle-outline' },
  'tour-next': { set: 'ion', name: 'arrow-forward' },
  'tour-progress': { set: 'ion', name: 'analytics-outline' },
  'tour-you': { set: 'ion', name: 'person-outline' },
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
  /**
   * Stroke weight, when this glyph wants one other than `SF_WEIGHT`.
   *
   * **`expo-symbols` builds every configuration at `UIFont.systemFontSize`
   * (17 pt) and then aspect-fits the result into the box `size` asks for**
   * (`SymbolView.swift`, `getSymbolConfig`). So a glyph drawn into a 20 pt box
   * is a 17 pt symbol scaled up 18 % — strokes and all — and it lands about a
   * half-step heavier than a symbol UIKit would draw at 20 pt natively.
   *
   * That is the whole reason a per-glyph override exists. UIKit puts `regular`
   * in a bar button; on this path `regular` arrives looking like Apple's
   * `medium`, which is exactly what a bar button should look like, while
   * `medium` arrives a step too heavy for one.
   */
  weight?: ComponentProps<typeof SymbolView>['weight'];
  /**
   * The symbol's OPTICAL scale — Apple's `.small` / `.medium` / `.large`, which
   * is a different axis from point size: it sets how much of its own box the
   * glyph fills relative to text beside it. UIKit's bar buttons use `.large`,
   * and it is the difference between a symbol that reads as a control and one
   * that reads as a character in a sentence.
   */
  scale?: ComponentProps<typeof SymbolView>['scale'];
};

const SF: Partial<Record<IconName, Symbol>> = {
  // --- THE ACCESSORY BAR ----------------------------------------------------
  //
  // The three glyphs that float over the system keyboard, and the three with
  // the least room for error: they sit one row above Apple's own keys, so the
  // comparison is not a memory of what iOS looks like, it is on screen at the
  // same moment. All three take UIKit's bar-button metrics — `regular` weight
  // (which arrives at `medium`'s apparent weight on this render path, see
  // `Symbol.weight`) at `.large` optical scale.
  timer: { name: 'timer', weight: 'regular', scale: 'large' },
  mic: { name: 'mic', weight: 'regular', scale: 'large' },
  'mic-on': { name: 'mic.fill', weight: 'regular', scale: 'large' },
  // Apple's own "put the keyboard away" glyph — the one iOS itself puts in an
  // accessory bar, and the reason this button no longer needs the MCI set.
  'keyboard-hide': {
    name: 'keyboard.chevron.compact.down',
    box: 1.24,
    weight: 'regular',
    scale: 'large',
  },

  // --- THE SETTINGS SURFACE (9 September 2026) -----------------------------
  //
  // The second surface to move over, exactly as the note above asks: one
  // surface at a time, so no screen is ever caught showing a mixed pair. A
  // settings list is the surface with the most to gain from it — every one of
  // these glyphs has a system counterpart that iOS itself uses for the same
  // job, and a list of near-misses beside the system tab bar and the system
  // keyboard is the clearest possible tell that a list is hand-drawn.
  //
  // Each name below is the symbol Apple uses for that meaning, not the one
  // that merely looks closest to the Ionicon it replaces:
  crosshair: { name: 'target' }, // Goal
  hourglass: { name: 'hourglass' }, // Training experience
  calendar: { name: 'calendar' }, // Sessions a week, Session types
  layers: { name: 'square.stack.3d.up' }, // Split
  barbell: { name: 'dumbbell' }, // Key lifts, Bar weight
  target: { name: 'dumbbell' }, // (the alias `target` has always drawn a barbell)
  document: { name: 'doc.text' }, // Where you log now, Contact support, Terms
  wrench: { name: 'wrench.and.screwdriver' }, // What gets in the way, corrections
  refresh: { name: 'arrow.clockwise' }, // Run setup again, Restore, Clear cache
  sparkle: { name: 'sparkles' }, // Recore Pro, How parsing works
  card: { name: 'creditcard' }, // Manage subscription
  plate: { name: 'scalemass' }, // Units
  bell: { name: 'bell' }, // Weekly recap
  // Import and export take Apple's OWN pair, which is the share arrow in and
  // out — not a cloud. The glyph names here are historical ("upload" is the
  // import row); the SYMBOLS follow the direction the row actually moves data.
  upload: { name: 'square.and.arrow.down' }, // Import from Strong or Hevy
  download: { name: 'square.and.arrow.up' }, // Export my record
  language: { name: 'globe' }, // Writing language
  table: { name: 'tablecells' }, // Set readings
  lock: { name: 'lock' }, // Privacy Policy
  unlock: { name: 'lock.open' },
  star: { name: 'star' }, // Rate Recore
  trash: { name: 'trash' }, // Delete account
  'sign-out': { name: 'rectangle.portrait.and.arrow.right' }, // Sign out

  // The disclosure chevron is chrome rather than a surface's glyph, and it is
  // the one mark on the screen a person has seen ten thousand times in Settings
  // itself. It draws at `SF_WEIGHT` semibold-adjacent weight, which is what
  // UIKit uses for a disclosure indicator.
  'chevron-forward': { name: 'chevron.right' },
  'chevron-back': { name: 'chevron.left' },

  // The close button on a sheet and the clear button in a field are the same
  // mark, and iOS draws both with this one symbol: a filled circle with the ×
  // KNOCKED OUT of it, so the surface behind shows through the glyph. That is
  // why it takes a quiet grey rather than ink — the tint is the circle, and a
  // near-black disc is a much louder button than the one iOS puts on a sheet.
  close: { name: 'xmark.circle.fill' },

  // Undo. `arrow.uturn.backward` is what iOS itself draws on the undo button in
  // the Notes markup bar and in the keyboard's edit menu — the one place this
  // app's reference and Apple's are literally the same control.
  undo: { name: 'arrow.uturn.backward' },

  // --- THE FIRST-OPEN TOUR (9 September 2026) ------------------------------
  //
  // The third surface to move over. It is the one place in the app where the
  // glyph is the POINT rather than a label's companion: the card says "Next",
  // shows this mark, and a second later the spotlight lands on the same mark in
  // the bar. Drawn from a different set, that hand-off simply does not happen —
  // the eye is looking for an arrow it has not been shown.
  //
  // These three are copied from `(tabs)/_layout.tsx` and must not drift from
  // it; the two write glyphs are Apple's own compose and confirm marks.
  'tour-write': { name: 'square.and.pencil' },
  'tour-checkin': { name: 'checkmark.circle' },
  'tour-next': { name: 'arrow.forward' },
  'tour-progress': { name: 'chart.xyaxis.line', box: 1.1 },
  'tour-you': { name: 'person' },
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
      weight={sf.weight ?? SF_WEIGHT}
      scale={sf.scale}
      tintColor={tint}
      fallback={drawn}
    />
  );
}
