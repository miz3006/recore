---
name: recore-design
description: Recore's target visual system — the warm paper canvas, one brand blue, the bare-row record and floating pill chrome, the reserved planned-green, type scale, spacing/radii/elevation, shared components and motion rules. Use when building or restyling any Recore screen, sheet, chart, or control, when picking a colour/size/radius, or when reviewing UI for consistency.
---

# Recore design system — v6 target

**This file describes the system Recore is moving TO, not the one the code draws today.** Every
rule is binding on new and touched code. Where the repository still shows the old system,
`MIGRATION.md` beside this file names the files and the phase that fixes them (tokens → shared
components → screens). A rule is never softened to match the code; the code is behind.

Tokens are the source. A screen needing a value the scale lacks adds it to the token file, never
inline. Import from `@/lib/theme` (`src/lib/theme/index.ts`).

**The read:** warm paper, black ink, one blue. The record is austere — bare rows, no cards — and
the personality lives in the frame around it: the mascot, floating pill chrome, small dots of
colour on accessories.

## Tone

**Warm in onboarding and empty states; dry in the record.** Onboarding sublines and empty states
may be friendly and second-person ("Be honest — this changes what we prescribe"); anything printed
beside a number is dry and factual. Emoji appear only in an onboarding option label or an empty
state, never in the record. Still banned everywhere: flame badges, XP, levels, streak guilt,
congratulation, vague praise. Premium is carried by type, spacing, canvas and restraint — not by
gradients on chrome.

## Canvas (`color.ts`)

One canvas runs the whole app — Today, list screens, sheets' backdrop, settings, every onboarding
step. **The document/grouped split is abolished: there is no `#F2F2F7` grouped world and no white
document world.** White is a *surface* (pills, cards, sheets), never the canvas.

| Token | Value | Role |
|---|---|---|
| `canvas` | `#FCF9F4` | the world; the flat fill wherever a gradient cannot render |
| `canvasTop` | `#FDF6EE` | peach tint, top of the diagonal gradient |
| `canvasBot` | `#F9F5F9` | faint lavender-pink tint, bottom |
| `surface` | `#FFFFFF` | pills, cards, sheets, chips — unchanged |
| `surfaceHigh` | `#E5E5EA` | recessed only: segmented containers, pressed states |

The gradient is diagonal, subtle, static, and never animates. **These three values are measured,
not taste:** across the three tints `textSecondary` ≥4.70, `signal` ≥4.57, `attention` ≥4.65,
`gain` ≥5.00 — every information-carrying ink clears 4.5:1, which the retired `#F2F2F7` did not
(`signal` 4.42, `textSecondary` 4.54). A warmer cream was measured and rejected for this. **Do not
deepen the canvas without re-measuring the whole ink ladder.** `textMuted` at 3.45 stays what the
eye may skip. Emptiness is allowed: a screen that is 70% canvas is finished — the chrome floats.

## Structure: bare record, floating chrome

Three layers and no more: **canvas (world) → ink text (the record) → white pills (controls).**

- **The record has no cards and no dividers.** A Today row is typography on canvas: name left in
  ink, value right in the reading face, unit a step lighter and lighter-weight than the number.
  Number and unit are typographically two things. Row height 64–72.
- **A card is the exception, not the default.** The only sanctioned cards: bottom sheets and their
  inner sections, onboarding option rows and value cards, and the thought-process card. Anywhere
  else, a card must be justified against bare rows first.
- **Everything interactive floats as a white pill** with a soft warm diffuse shadow: date pill,
  summary pill, the NL input bar and its circular accessory buttons. Accessory buttons are
  coloured glyphs in white circles — the colour is on the glyph, never on the circle.

## Colour

**One brand blue does every job Amy gives violet:** primary CTA, selected states and their check
marks, links, active controls, progress fill, chart lines. It lives in exactly one token (`brand` /
`brandPressed` / `brandGlow`) and no file may name a blue literal — `ctaFill` and `trained` collapse
into it.

**The pick is made: Volt `#0B5CD6`** (owner, on device, 20 August 2026). `#007AFF` is retired — it
measures 4.02:1 on white and 3.72–3.82:1 across the canvas tints and fails text-sized use. The three
candidates stay below as the record of what was measured; all were ≥4.5:1 on white and on all three
canvas tints (white-on-fill is the same ratio, so each also cleared AA as a CTA):

| Candidate | Brand | Pressed | Glow | on white | on canvas |
|---|---|---|---|---|---|
| **Volt — CHOSEN**, electric, closest to Amy's charge | `#0B5CD6` | `#0A4CB0` | `#0B5CD6` @ .28 | 5.97 | 5.53 |
| **Ink Indigo** — inkier, slight violet lean | `#2F3AAE` | `#262E8C` | `#3A44D6` @ .30 | 8.98 | 8.35 |
| **Prussian** — quiet, archival, deepest warmth fit | `#175086` | `#12406B` | `#1E6BB0` @ .26 | 8.31 | 7.72 |

Glow = `shadowColor` at that opacity, radius 20, y 8 — live as `shadow.glow`. Volt's three values
are in `color.ts` as `brand` / `brandPressed` / `brandGlow`, and no file names a blue literal.

**Green `#547C00` (`signal`) is PLANNED-ONLY and unchanged.** It marks a future prescription — a
load not yet lifted — always with its label and reason, and may never mean good, done, recorded or
success. Homes: prescribed loads in Next, the plan strip, planned checklist, the ghost prediction,
the calendar's "a plan offered" dot, and the paywall's `Nothing due today` line. `gain` green may
never stand in for it: recorded is not planned. Green is load semantics, not brand — it never
becomes a CTA, a link or a selected state.

Recorded semantics carry over untouched: `attention` `#B45309` (plateau / backoff / paused), `gain`
`#1F7A33` / `loss` `#C62828` (recorded direction, red only when truly regressing — a lift holding
load is ink), `warning` `#8A5613` / `error` `#A33D36`, inks `#1C1C1E` / `#6E6E73` / `#86868B`,
borders `#D5D5D5` / `#E9E9E9`.

**`trend` ember `#BF5B23` is retired** (owner, 20 August 2026). Its one home was the lift sheet's
progression line, and that chart draws in `brand` now so the same lift reads the same way on both
surfaces. The token has no call sites; nothing new may adopt it.

Rules that hold everywhere:
- **Colour marks, ink speaks.** A coloured letter or glyph may sit beside a value; the value itself
  stays ink. Washes pair with exactly one ink (`signalWash`↔`signal`, `attentionWash`↔`attention`,
  `gainWash`↔`gain`, `lossWash`↔`loss`) and nothing else.
- **`textMuted` is for what the eye may skip.** Anything carrying information is `textSecondary` or
  ink. A value in muted is a bug at the call site.
- **Colour is never the only carrier** — the word says the same thing beside it ("up 12%", "no
  change in 4 sessions"). A PR is a shape, not a hue.
- `glyph.*` tints settings-row glyphs only — wayfinding chrome, never data. Brand blue, green and
  red may never join that set.
- Opacity comes from the `ink` ladder via `alpha(hex, n)`. **Never call `alpha()` inside a
  worklet** — precompute outside `useAnimatedStyle`.

## Typography (`type.ts`, `typography.ts`, `scale.ts`)

Two voices: **`sans`** (SF Pro) for everything the app *says*; **reading** for every numeric reading
the record *reports*. **`readingStyle(weight)` / `readingText` are required — spelling
`fontFamily: fonts.reading` inline is banned.** `READING_FACE` is the one switch for the numeric
face; no other file may name a font.

Every size runs through `moderateScale`, every line height through `lineFor`. `displayLarge` 44 ·
`display` 38 · `largeTitle` 34 · `title` 27 · `title2` 22 · `question` 30 · `lede` 19 · `headline`
17/600 · `body` 17 · `subhead` 15 · `caption` 13 · `footnote` 11.5 · `heroNumber` 48 · `bigNumber`
44 · `statNumber` 32. `eyebrow` 11/600 uppercase, tracking 1.6, reading voice. Numbers get scale
when they are the point. Tracking is set against Apple's ramp — do not tighten. Pass
`maxFontSizeMultiplier={MAX_FONT_SCALE}` (1.5), and `FIXED_FONT_SCALE` (1.2) only for text locked
inside geometry. Use `minHeight`, never `height`, around a label.

## Spacing, radii, elevation

`spacing` 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64. Body gutter `spacing.xxl`; content gaps
`spacing.lg`; in-card gaps `spacing.sm`–`md`. A tab scroll adds `TAB_BAR_CLEARANCE` (56); anything
pinned must clear it by hand.

**`radius` is four values and a pill, and the funnel has no scale of its own:** sm 10 · md 14
(buttons) · **lg 20** (rows, fields, option rows) · **xl 24** (cards, sheets, hero surfaces) · pill
999. Set `borderCurve: 'continuous'` on the same style as any non-pill radius.

`hairline`, `HIT` 44, `ROUND_BUTTON` 40. **`CTA_HEIGHT` 56 is the height of every primary button
app-wide** and lives in `spacing.ts`; `CONTROL_HEIGHT` 50 is for secondary, ghost and compact
controls. Neither is redeclared elsewhere.

Elevation is two neutral levels plus one glow, all cast in warm ink `#2E2418`: `shadow.card` (.05,
radius 14, y 4 — resting cards and floating pills) and `shadow.raised` (.07, radius 28, y 10 —
sheets and hero surfaces). Large blur, low opacity, never a hard drop shadow. **`shadow.glow` is
the only coloured shadow in the app and belongs to the primary CTA alone.** On the canvas a surface
with neither border nor shadow is invisible — give it one. No gradients except the canvas itself.

## The mascot

One character, one drawing medium, everywhere it appears. It is the hero of every onboarding step
and **acts out that step's question** — never a generic repeated pose. On data screens it is a
corner mark of at most 32 pt, or it is absent. It never competes with a number and it never moves.

## Reuse these — do not rebuild them

- `primitives.tsx` — `Card` (`flat` | `card` | `raised`), `Eyebrow`, `Divider`, `AppButton`
  (`primary` | `secondary` | `ghost`, `compact`, `loading`), `StatTile`, `Badge`. **`Badge` gains
  one filled variant** (`tone: 'wash'`), the only sanctioned filled chip; it pairs with its one ink.
- **`ThoughtProcessCard` — to build (Phase 2).** Next's reasoning as a designed object: a circular
  confidence marker, one paragraph of plain-language reasoning, and a brand-blue "adjust" link. It
  states why a load is prescribed; it never invents the load.
- `motion.tsx` — `PressableScale` (every tappable), `FadeSlideIn`, `FadeScaleIn`, `FadeSwap`,
  `Stagger`, `AnimatedCount`.
- `chip-row.tsx` (the pill row under a large title; wraps, never scrolls) · `stub-screen.tsx` ·
  `bottom-sheet.tsx` (the one sheet chrome) · `charts.tsx` (`WeekBars` monochrome, `TrendChart`
  brand — never green) · `icon.tsx` · `top-bar.tsx` · `set-table.tsx`.
- Onboarding: `OnboardingScreen` is the template for **every** step — back circle → ink-black
  progress rail → illustration band → eyebrow → headline → subline → content → pinned glowing CTA,
  all sized from the window. Use `OptionRow`, `PrimaryCta`, `ProgressRail`, `Enter` +
  `contentDelay(i)`, `IllustrationSlot`. The progress fill is ink, not brand.

## Motion (`src/lib/motion.ts`)

Durations `press` 120 · `fast` 160 · `base` 240 · `slow` 380 · `xslow` 560. `EASE.emphasized` for
entrances, exits and presses; `EASE.standard` for a value settling. There is no ease-in.
`PRESS_SCALE` 0.97 (0.98 on big surfaces). Springs `snappy` / `soft` for anything a finger was on;
`SPRING_OVERSHOOT` is the only bounce, for the PR flag. `stagger(i, 55, cap 8)` app-wide;
onboarding runs 40 ms. Haptics: `selection()` on press-in for a choice, `tap()` on press-out for a
commit.

**Not allowed:** autoplaying decoration, looping celebration, confetti, fake loading, surprise
movement while someone is typing, motion that withholds a reading, more than one celebratory moment
per session, and **animating layout properties** — animate `transform` and `opacity`, interpolate
colour. The two exceptions are keyboard-driven (`band.ts`). Selection animates colour at constant
border width; a border never grows. Personality is static illustration, not animation.

**Allowed:** press feedback, a choice settling (160–240 ms), the progress rail advancing (220 ms,
ease-out, no spring — a rail must never overshoot a truth), sheets arriving interruptibly, a chart
revealing after its data, a value updating once, the first-open spotlight.

Every animation is gated on `useReducedMotion()`: content appears in its final position instantly
and no information disappears with the movement.

## Decided — do not reopen

1. **Primary CTA is a filled brand-blue pill with a brand glow.** The ink-fill prose is retired.
2. **The funnel's radii are the app's radii** (20 / 24); `onboarding/tokens.ts` declares neither.
3. **`CTA_HEIGHT` 56 is app-wide** for primary buttons; 50 is for the rest.
4. **One filled chip exists** — `Badge` `tone: 'wash'`. Ad-hoc filled chips stay banned.
5. **`readingStyle()` is required**; inline `fontFamily` for numbers is banned.

6. **The blue is Volt `#0B5CD6`** (owner, 20 August 2026). It is `brand` / `brandPressed` /
   `brandGlow` in `color.ts` and is named nowhere else.
