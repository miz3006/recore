---
name: recore-design
description: Recore's live visual system — colour tokens and the reserved planned-green, the type scale, spacing/radii/elevation, the shared components to reuse, and the motion rules. Use when building or restyling any Recore screen, sheet, chart, or control, when picking a colour/size/radius, or when reviewing UI for consistency.
---

# Recore design system

Everything here is read off `src/lib/theme/` and the live screens. Tokens are the
source; a screen that needs a value the scale does not have adds it to the token
file, never inline. Import from `@/lib/theme` (one barrel — `src/lib/theme/index.ts`).

## Tone

Quiet, serious, premium — Linear / Things 3, not a fitness app. Never playful,
never congratulatory. The record is the product; chrome stays out of its way.
Premium is carried by type, spacing, hairlines and restraint — **not** by colour
or gradients. No flame badges, XP, levels, streak guilt, or vague praise.

## Colour (`src/lib/theme/color.ts`)

**Green `#547C00` (`color.signal`) is PLANNED-ONLY.** It marks a future
prescription value — a load not yet lifted — always with its label and reason.
It may never mean "good", "done", "recorded" or "success". Live homes: the
prescribed loads in Next (`next/session.tsx`), the plan strip, planned
checklist, the ghost prediction, and the calendar's "a plan offered" dot. The
**one** sanctioned exception outside a prescription is the paywall's `Nothing
due today` line (`paywall.tsx:626`), which renders only when a real trial exists.
`gain` green may never stand in for `signal`: recorded is not planned.

| Token | Value | Meaning |
|---|---|---|
| `bg` | `#F2F2F7` | grouped canvas — LIST screens (Progression, Lifts, You, paywall) |
| `surface` | `#FFFFFF` | cards, sheets, chips + the full-bleed DOCUMENT screens (Today, onboarding, sign-in) |
| `surfaceHigh` | `#E5E5EA` | recessed only: segmented containers, pressed states |
| `accent` / `accentPressed` | `#1C1C1E` / `#2C2C2E` | ink: emphasized borders, badge fills, selected marks |
| `ctaFill` / `ctaFillPressed` | `#007AFF` / `#0062CC` | the primary button |
| `trained` | `#007AFF` | Recore blue, the product accent — selected choices, active controls, trend charts, day-trained marks. An accent, never a reward. |
| `signal` | `#547C00` | **planned prescription values only** |
| `attention` | `#B45309` | plateau / backoff / paused. Never chrome, never a CTA, never on `surfaceHigh` (4.14:1) |
| `gain` / `loss` | `#1F7A33` / `#C62828` | RECORDED direction. Red only when *truly* regressing; a lift holding load is ink |
| `trend` | `#BF5B23` | ember: one lift's progression line + wash, `exercise-sheet.tsx` only. Never on a number |
| `warning` / `error` | `#8A5613` / `#A33D36` | app state (offline, allowance) / failures + destructive |
| `textPrimary` / `Secondary` / `Muted` | `#1C1C1E` / `#6E6E73` / `#86868B` | 17.0:1 / 5.1:1 / 3.6:1 |
| `border` / `divider` / `tableRule` | `#D5D5D5` / `#E9E9E9` | card+control edges / in-card rows |

Washes pair with exactly one ink and nothing else: `signalWash`↔`signal`,
`attentionWash`↔`attention`, `gainWash`↔`gain`, `lossWash`↔`loss`.

Rules that hold everywhere:
- **`textMuted` is for what the eye may skip.** Anything carrying information is
  `textSecondary` or ink. A value in muted is a bug at the call site.
- **Colour is never the only carrier.** The word says the same thing beside it
  ("up 12%", "down 5%", "no change in 4 sessions").
- A PR is a **shape**, not a hue — an outlined mono label (`prChip`, `Badge`).
- `glyph.*` (indigo/orange/teal/gold/slate/plum) tints settings-row glyphs only.
  It is wayfinding chrome, never data; green, blue and red may never join it.
- Opacity comes from the `ink` ladder (`echo .55`, `value .7`, `delta .8`,
  `disabled .4`, `grabber .18`, `wash .14`) via `alpha(hex, n)`.

## Typography (`type.ts`, `typography.ts`, `scale.ts`)

Two voices: **`sans`** (SF Pro) for everything the app *says*; **reading** for
every numeric reading the record *reports*. Use `readingStyle(weight)` /
`readingText` — they carry `tabular-nums`, which is what holds columns in line.
`READING_FACE` in `typography.ts` is the one switch for the numeric face; no
other file may name a font.

Every size runs through `moderateScale`, every line height through `lineFor`.
Never hardcode a size on a screen — add a token.

`displayLarge` 44 (paywall/welcome hero) · `display` 38 (onboarding hero) ·
`largeTitle` 34 · `title` 27 · `title2` 22 (section heads) · `question` 30
(onboarding headline) · `lede` 19 (brief's opening sentence) · `headline` 17/600
(card titles, button labels, option labels) · `body` 17 (prose — matches iOS
Body) · `subhead` 15 (secondary/grey, option detail lines) · `caption` 13 ·
`footnote` 11.5 · `heroNumber` 48 · `bigNumber` 44 · `statNumber` 32.
`eyebrow` is 11/600 uppercase, tracking 1.6, in the reading voice.

Tracking is set against Apple's ramp — do not tighten further. Pass
`maxFontSizeMultiplier={MAX_FONT_SCALE}` (1.5) on scalable text, and
`FIXED_FONT_SCALE` (1.2) only for text locked inside geometry (calendar cells,
avatars). Use `minHeight`, never `height`, around a label.

## Spacing, radii, elevation

`spacing` 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 (`xs`…`giant`). The body
gutter is `spacing.xxl` on the tab screens and onboarding (the paywall uses
`xl`); content gaps `spacing.lg`; in-card gaps `spacing.sm`–`md`.
Bottom padding on a tab scroll adds `TAB_BAR_CLEARANCE` (56) — content scrolls
*behind* the floating bar; anything pinned must clear it by hand.

`radius` sm 10 · md 14 (buttons) · lg 18 (cards/sheets) · xl 22 · xxl 28 (hero
surfaces) · pill 999. **Set `borderCurve: 'continuous'` on the same style as any
non-pill radius** — iOS squircles, and a circular corner reads as cheap.

`hairline`/1 px borders, `HIT` 44, `CONTROL_HEIGHT` 50, `ROUND_BUTTON` 40.

Elevation is two shadows only: `shadow.card` (resting cards, the primary CTA)
and `shadow.raised` (hero surfaces). On white document screens a surface with
neither a border nor a shadow is invisible — give it one. On the grouped grey
canvas the tone already draws the card, so the shadow is a small extra lift.
No gradients (the Today `PaperField` is the one three-near-white exception).

## Reuse these — do not rebuild them

- `primitives.tsx` — `Card` (`flat` | `card` | `raised`), `Eyebrow`, `Divider`,
  `AppButton` (`primary` | `secondary` | `ghost`, `compact`, `loading`),
  `StatTile`, `Badge`. One button, one card, one label in the app.
- `motion.tsx` — `PressableScale` (every tappable), `FadeSlideIn`, `FadeScaleIn`,
  `FadeSwap` (content replaced in place), `Stagger`, `AnimatedCount`.
- `chip-row.tsx` — **the** pill row under a large title (Progression + Next). It
  wraps, never scrolls; selected = wash + stronger border + heavier ink label.
- `stub-screen.tsx` — the large-title scaffold with optional counted subtitle.
- `bottom-sheet.tsx` — the one sheet chrome (detached card, drag-to-dismiss).
- `charts.tsx` — `WeekBars` (monochrome), `TrendChart` (blue). Never green.
- `icon.tsx` — semantic names + the glyph tint map. `top-bar.tsx`, `set-table.tsx`.
- Onboarding: `OnboardingScreen` is the template for **every** step — fixed
  zones (chrome → illustration band → eyebrow → headline → subtext → content →
  pinned CTA), all sized from the window so nothing moves between steps. Use
  `OptionRow` (round mark = single answer, square = multi), `PrimaryCta`,
  `ProgressRail`, `Enter` + `contentDelay(i)`, `IllustrationSlot`, and the
  tokens in `onboarding/tokens.ts` (`BLUE`, `INK_CARD`, `BLUE_WASH`, `INK_RING`).

## Motion (`src/lib/motion.ts`)

Durations `press` 120 · `fast` 160 · `base` 240 · `slow` 380 · `xslow` 560.
`EASE.emphasized` (expo-out) is the app's ease for entrances, exits and presses;
`EASE.standard` for a value settling in place. There is no ease-in.
`PRESS_SCALE` 0.97 (0.98 on big surfaces). Springs: `snappy`, `soft` — for
anything a finger was on. `SPRING_OVERSHOOT` is the **only** bounce, for the PR
flag. `stagger(i, 55, cap 8)` app-wide; onboarding runs its own 40 ms cadence.
Haptics: `selection()` on press-**in** for a choice, `tap()`/`tapMedium()` on
press-out for a commit.

**Not allowed:** autoplaying decoration, looping celebration, confetti, bounce
cascades, fake loading (no typewriter, no shimmer), surprise movement while
someone is typing, motion that withholds a reading, more than one celebratory
moment per session — and **animating layout properties**. Animate `transform`
and `opacity`; interpolate colour. Two documented exceptions, both driven by the
keyboard's own shared value rather than a duration we invented: the onboarding
illustration band's height and the CTA's translate (`band.ts`). Selection states
animate colour at constant border width — never grow a border.

**Allowed:** press feedback, a selected choice settling (160–240 ms), the
progress rail advancing (220 ms, ease-out, no spring — a rail must never
overshoot a truth), sheets arriving/dismissing interruptibly, a chart revealing
after its data, a value updating once, the first-open spotlight.

Every animation is gated on `useReducedMotion()` — content appears in its final
position instantly, and no information disappears with the movement. The
onboarding `Enter` keeps the fade and drops the travel; `PaperField` mounts
still. The onboarding mascot does not move.

## Open questions

Screens/files disagree here. Do not silently pick a side — ask the owner.

1. **Primary CTA fill.** Prose in `color.ts:25-27` and the `AppButton` doc at
   `primitives.tsx:87` both say ink-fill ("restraint IS the brand"); the live
   `btnPrimary` style (`primitives.tsx:261`) and `color.ctaFill` (`color.ts:57`)
   are Apple-tinted blue as of 18 Aug. The code is blue; two doc blocks are not.
2. **Onboarding radii sit outside the app scale.** `radius` is 10/14/18/22/28
   (`spacing.ts:45`), but `onboarding/tokens.ts:64-65` declares `CARD_RADIUS` 24
   and `ROW_RADIUS` 20 — "three values and no others" — from the design import.
   Either the funnel is a deliberate sub-system or the scale is short two steps.
3. **Control height.** `CONTROL_HEIGHT` 50 app-wide (`spacing.ts:61`) vs
   `CTA_HEIGHT` 56 in the funnel (`onboarding/tokens.ts:72`).
4. **Filled colour chips.** `Badge`'s doc (`primitives.tsx:199`) says never a
   filled colour chip, "that would break the monochrome contract" — while
   `progress.tsx:675-681` fills share chips with `gainWash`/`lossWash` and
   `next/session.tsx:590` fills with `signalWash`.
5. **How a reading is written.** `typography.ts` asks callers to prefer
   `readingStyle()` / `readingText`; `progress.tsx` (e.g. `:688`, `:703`, `:711`)
   instead spells `fontFamily: fonts.reading` + `fontVariant: ['tabular-nums']`
   inline. Same output today, two idioms to keep in sync if the face changes.
