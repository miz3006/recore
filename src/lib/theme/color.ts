/**
 * The Recore colour system (CLAUDE.md §6.3). Both themes ship; the default is
 * `system`. Dark is the design target — gyms are dark, phones are on auto — and
 * light is a full peer, not an afterthought.
 *
 * §6.1 is the whole idea: **everything recorded is cold, and the one thing that
 * is hot is what you are about to do.** The interface is graphite and chalk, and
 * exactly one hue exists — an ember orange spent on a single semantic: a number
 * you have not lifted yet. Not buttons, not the logo, not charts, not success
 * states. Because colour carries meaning here, it never has to carry decoration.
 *
 * Two invariants that must never break (§6.2):
 *   · Ember appears only on PLANNED. A PR is not ember. A positive delta is not
 *     ember. A chart line is not ember. A button is not ember.
 *   · READ never wears a checkmark — a checkmark asserts correctness, and a
 *     reading is a claim.
 *
 * **Elevation inverts between themes.** In dark, `surface` is *lighter* than
 * `canvas`; in light, `surface` is *whiter* and `surfaceHigh` is *darker*. The
 * token names and roles are identical across both, so no consumer ever branches
 * on the theme — it asks for `surface` and gets the right answer.
 *
 * This module is deliberately free of React and React Native imports: the
 * contrast test (1.5) runs under `node --test` and imports these palettes
 * directly. The hook that resolves them lives in `./use-theme`.
 */

/** Dark — the design target. */
export const dark = {
  canvas: '#0E1113', // cold graphite — the floor at 6am
  surface: '#161A1D', // raised: cards, sheets, rows
  surfaceHigh: '#1F2427', // recessed: segmented tracks, pressed, inputs
  ink: '#EDF0EF', // chalk — primary text and recorded values
  inkMuted: '#98A2A4', // secondary text, comparisons, READ values
  inkFaint: '#838C88', // captions, placeholders, disabled labels — lifted for AA (see Deviations)
  rule: '#252B2F', // hairlines, table rules, card borders
  ember: '#FF6B3D', // PLANNED ONLY
  emberSoft: '#FF6B3D1F', // ember at 12% — target row wash, nothing else
  warn: '#E0B14A',
  danger: '#E45F53', // lifted for AA on surfaceHigh (see Deviations)
  scrim: '#00000099',
} as const;

/** Light — a full peer. Ember is darkened here to clear 4.5:1 on paper (§17). */
export const light = {
  canvas: '#F6F5F2', // warm paper
  surface: '#FFFFFF',
  surfaceHigh: '#EDEBE6',
  ink: '#14181A',
  inkMuted: '#5F6A6C',
  inkFaint: '#656C6B', // darkened for AA — §6.3's #8E9896 failed at 2.49:1 (see Deviations)
  rule: '#DFDCD5',
  ember: '#BD3F0C', // §6.3's #C2410C, darkened the last step to clear AA on surfaceHigh
  emberSoft: '#BD3F0C14',
  warn: '#8A5613',
  danger: '#A33D36',
  scrim: '#0E111366',
} as const;

/** Both palettes carry identical keys — enforced at compile time. */
export type Palette = { readonly [K in keyof typeof dark]: string };

const _lightIsComplete: Palette = light;
void _lightIsComplete;

export type ColorToken = keyof typeof dark;

/** What the user asked for. `system` follows the device and is the default. */
export type ColorScheme = 'system' | 'light' | 'dark';

/** What the device reports. Null while unknown, which resolves to dark. */
export type SystemScheme = 'light' | 'dark' | null | undefined;

export const PALETTES: Record<'light' | 'dark', Palette> = { light, dark };

/**
 * Resolve a preference against the device. Pure and synchronous so the contrast
 * test and the hook share one definition of "which palette am I on".
 *
 * An unknown system scheme resolves to dark rather than light: dark is the
 * design target, and a wrong guess that flashes light in a dark gym is the more
 * expensive mistake.
 */
export function resolveScheme(preference: ColorScheme, system: SystemScheme): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return system === 'light' ? 'light' : 'dark';
}

/** Resolve straight to the palette. */
export function paletteFor(preference: ColorScheme, system: SystemScheme): Palette {
  return PALETTES[resolveScheme(preference, system)];
}

/**
 * Apply an alpha to a hex colour. Accepts `#RGB`, `#RRGGBB` and `#RRGGBBAA`;
 * an existing alpha is replaced rather than appended, because `#RRGGBBAAAA` is
 * silently invalid on iOS and produces a colour nobody asked for.
 */
export function alpha(hex: string, opacity: number): string {
  const clamped = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  const rgb =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body.slice(0, 6);
  return `#${rgb}${clamped}`;
}
