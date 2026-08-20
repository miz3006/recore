# MIGRATION — current code → the v6 target in SKILL.md

Every entry below is a place where the repository contradicts a rule in `SKILL.md`. The rule wins;
this file is the work. Counts come from a sweep of `src/` on 20 Aug 2026 (`grep` per token), so
they are call-site counts, not line-by-line diffs.

Order is fixed: **tokens → shared components → screens.** A phase ends when the repository gates
pass (typecheck, tests, lint, iOS Expo export) and `docs/implementation-status.md` records what is
live. No phase authorises an unrelated redesign.

## Phase 0 — the decision gate (owner, on device) — **DONE, 20 Aug 2026**

- **The brand blue is Volt `#0B5CD6`** (owner's pick over Ink Indigo `#2F3AAE` and Prussian
  `#175086`). Everything below marked *blocked by Phase 0* is unblocked.
- The canvas trio `#FCF9F4` / `#FDF6EE` / `#F9F5F9` ships as measured. Deepening it is allowed only
  with a re-measured ink ladder — a warmer cream already failed AA for `signal` and `attention`.

## Phase 1 — tokens — **DONE, 20 Aug 2026** (typecheck · 415/415 · lint · iOS export; device QA open)

Landed as written below, with two deliberate deviations, both temporary: `radius.xxl` and
`color.bg` were kept as **deprecated aliases** (28 → 24, `bg` → `canvas`) rather than deleted, so
their 6 and 15 call sites move file-by-file in Phase 2 instead of in one untestable sweep. The same
applies to `ctaFill` / `ctaFillPressed` / `trained` and to the funnel's `CARD_RADIUS` / `ROW_RADIUS`
/ `CTA_HEIGHT` / `BLUE` / `BLUE_WASH` / `BLUE_CARD`. **Every one of these aliases is deleted by the
end of Phase 3; none may gain a new call site.**

### `src/lib/theme/color.ts`

| Change | Detail |
|---|---|
| `bg: '#F2F2F7'` → canvas trio | Add `canvas` `#FCF9F4`, `canvasTop` `#FDF6EE`, `canvasBot` `#F9F5F9`. 13 files read `color.bg`; keep `bg` as a deprecated alias of `canvas` only for the duration of Phase 2, then delete it. |
| `ctaFill` + `ctaFillPressed` + `trained` → one token | Collapse into `brand` / `brandPressed` / `brandGlow`. **Blocked by Phase 0.** 14 files read `trained`, 9 read `ctaFill`. |
| Doc header is now false | The "WHITE, NOT PAPER (owner, 17 August 2026)" block and "the warm paper family is history" contradict the canvas rule. The "Primary CTAs are ink-fill — restraint IS the brand" line contradicts SKILL §Decided-1. Rewrite both, dated. |
| Ink-ladder comment | Ratios are quoted against white. Re-state against the canvas: `textSecondary` ≥4.70, `textMuted` 3.45, `signal` ≥4.57, `attention` ≥4.65, `gain` ≥5.00, `loss` ≥5.03. |
| **Unchanged** | `signal` `#547C00` and its planned-only contract, `attention`, `gain`/`loss`, `trend`, `warning`, `error`, all three inks, `border`/`divider`/`tableRule`, all four washes, `glyph.*`, the `ink` opacity ladder, `alpha()`. |

### `src/lib/theme/elevation.ts`

- `SHADOW_INK` `#1C1C1E` → warm `#2E2418`. The comment saying it was un-warmed "left over from the
  paper canvas §4.2 retired" is void — the paper canvas is back.
- `shadow.card` `ios(0.05, 12, 4)` → `ios(0.05, 14, 4)`; `shadow.raised` `ios(0.08, 22, 8)` →
  `ios(0.07, 28, 10)`. Softer, larger blur, lower opacity.
- **Add `shadow.glow`** — `shadowColor: color.brandGlow`, opacity per the chosen candidate,
  radius 20, y 8. Primary CTA only; the one coloured shadow in the app. **Blocked by Phase 0.**
- The prose "on a grouped screen this is a small extra lift" now applies everywhere: white pills on
  cream are 1.05:1 by tone, so the shadow is what makes them visible. Say so.

### `src/lib/theme/spacing.ts`

- `radius`: `lg` 18 → **20**, `xl` 22 → **24**, **delete `xxl` 28** (map existing `xxl` call sites
  to `xl`). 20 files use `lg`/`xl`/`xxl`.
- **Add `CTA_HEIGHT = moderateScale(56)`** as the app-wide primary-button height. `CONTROL_HEIGHT`
  50 stays for secondary/ghost/compact (8 files).
- `spacing`, `hairline`, `HIT`, `ROUND_BUTTON`, `TAB_BAR_CLEARANCE`, the `borderCurve: 'continuous'`
  rule: unchanged.

### `src/components/onboarding/tokens.ts`

- **Delete `CARD_RADIUS` 24 and `ROW_RADIUS` 20** → `radius.xl` / `radius.lg`. Deletes the funnel's
  private radius scale (SKILL §Decided-2).
- **Delete `CTA_HEIGHT` 56** → import from `@/lib/theme` (SKILL §Decided-3).
- `BLUE = color.trained` → `color.brand`; `BLUE_WASH` / `BLUE_CARD` → `alpha(color.brand, …)`.
  **Blocked by Phase 0.** 14 onboarding files plus `paywall.tsx` (10 refs) read these.
- `INK_CARD`'s comment ("Five per cent of ink on white lands on the same grey as the system's
  grouped canvas (#F2F2F7)") is void on cream — recompute the wash against `canvas` or switch the
  soft card to `surface` + `shadow.card`.

### `src/lib/theme/index.ts`, `src/lib/paper-field.ts`

- Barrel: export `canvas`/`canvasTop`/`canvasBot`, `CTA_HEIGHT`, `shadow.glow`.
- `paper-field.ts` — the three near-white tones and `isCanvasTone()` become the app canvas rather
  than a Today-only surface. Its doc explicitly contrasts itself with "the `#F2F2F7` that LIST
  screens sit on"; that distinction is gone. `paper-field.test.ts` asserts on the old tones.

## Phase 2 — shared components — **DONE, 20 Aug 2026**

Landed in two passes (2a: the owner's four named files plus the new `Row` primitive; 2b: every
remaining component). What is NOT done and why is recorded in `docs/implementation-status.md`
under those dates — chiefly the bare-row restyle of nine record components, three of which are
**orphaned** (`empty-note-cards`, `ghost-prediction`, `session-receipt` — nothing imports them)
and four of which are **unmounted by owner decision** (`summary-pill`, `session-summary-sheet`,
`save-split`, `plan-strip`, `planned-checklist`).



| File | Change |
|---|---|
| `primitives.tsx` | `AppButton` primary → `brand` fill + `shadow.glow` + `CTA_HEIGHT`; secondary → `alpha(brand, .12)`. `Badge` gains `tone: 'wash'` (the one sanctioned filled chip) — the doc at `:199` saying "never a filled color chip" is retired per SKILL §Decided-4. The `AppButton` doc at `:87` still claims ink-fill; rewrite. `Card` doc must state it is the exception, not the default. 3 shadow refs, 2 radius refs, 5 `ctaFill` refs. |
| **`next/thought-process.tsx`** | **New.** `ThoughtProcessCard`: circular confidence marker, one plain-language reasoning paragraph, brand "adjust" link. Facts come from the deterministic bundle; the card explains, it never invents a load (CLAUDE.md §4). |
| `top-bar.tsx` | Date pill → white pill on canvas with the warm `shadow.card`. 1 shadow, 1 inline reading font. |
| `bottom-toolbar.tsx` | The NL input bar: rounded white pill + a row of circular accessory buttons, coloured glyph in a white circle. 2 `ctaFill`, 1 `shadow.raised`, 2 inline reading fonts, `GlassSurface` at `radius.pill`. |
| `summary-pill.tsx` | Unmounted since 18 Aug. Remount as the floating bottom summary pill (Phase 3, Today) with the warm shadow; 2 inline reading fonts. Its dependants `session-summary-sheet.tsx` (7 fonts) and `save-split.tsx` come back with it. |
| `bottom-sheet.tsx` | Backdrop is now canvas, not grouped grey; sheet radius → `radius.xl` (24). 1 shadow, 2 radius. |
| `charts.tsx` | `TrendChart` default `tint = color.trained` → `color.brand`; `WeekBars` stays monochrome ink. Gridlines and the surface-coloured node stroke are drawn against cream now. Never green. |
| `chip-row.tsx` | Selected wash + border from `brand` (4 refs). The comment reasoning about `#007AFF` on a 10% wash is stale — re-measure against the chosen blue. |
| `set-table.tsx` | `borderBottomColor: color.border` row rules (`:250-253`) are removed where the table is the record — bare rows, no dividers. 6 inline reading fonts. |
| `read-only-ledger.tsx`, `session-receipt.tsx`, `gutter-value.tsx`, `note-surface.tsx`, `ghost-prediction.tsx`, `planned-checklist.tsx`, `plan-strip.tsx`, `empty-note-cards.tsx` | Bare-row treatment: name in ink left, reading face right, unit lighter and lighter-weight. Drop card chrome where these are the record. 3–6 inline reading fonts each; `plan-strip` 2 shadows, `planned-checklist` 3 `CONTROL_HEIGHT`. |
| `glass.tsx`, `scroll-edge.tsx` | Edge fades and glass tint are keyed to the old `bg`; re-key to the canvas gradient so a fade never shows a grey seam (2 `color.bg` refs). |
| `stub-screen.tsx` | Large-title scaffold background → canvas (1 `color.bg`). |
| `icon.tsx` | `glyph.*` map unchanged. Add the accessory-dot colours for the input bar (glyph-only tint, never the circle). |
| `spotlight-tour.tsx`, `device-frame.tsx`, `settings-rows.tsx`, `next/section.tsx`, `next/skeleton.tsx`, `next/session.tsx`, `week-recap-card.tsx`, `insight-header.tsx`, `sign-in-demo.tsx` | Radius remap (18/22/28 → 20/24), warm shadows, `readingStyle()` for inline fonts. |
| `onboarding/` — `OptionRow`, `PrimaryCta`, `ProgressRail`, `OnboardingScreen`, `IllustrationSlot`, `panels`, `TextField`, `ParseDemo`, `SuggestionChips`, `LiftLoadRow`, `DayPicker`, `HoldToCommit`, `ProjectionCard` | All read the deleted funnel tokens. `PrimaryCta` gains the glow; `ProgressRail` fill stays ink-black (not brand); `OptionRow` selected = brand outline at constant width + filled brand check. `PrimaryCta`/`HoldToCommit` comments justify a 700 weight from `#007AFF`'s 3.4:1 — re-measure against the chosen blue; a deeper blue may allow 600. |

**`readingStyle()` sweep (SKILL §Decided-5):** `fontFamily: fonts.reading` is spelled inline across
**32 files** — heaviest in `exercise-sheet.tsx` (11), `progress.tsx` (10), `session-summary-sheet.tsx`
(7), `set-table.tsx` / `ghost-prediction.tsx` / `you.tsx` (6 each). All become `readingStyle(weight)`
or `readingText`. Mechanical, no visual change, and it can run in parallel with the rest of Phase 2.

## Phase 3 — screens — **DONE, 20 Aug 2026** (typecheck · 415/415 · lint · iOS export)

Seven screens, one commit each, plus a sheets pass and a final pass over the eight small pushed
screens. **Every deprecated token the migration created is deleted**: `color.bg`, `color.ctaFill`,
`color.ctaFillPressed`, `color.trained`, `radius.xxl`, and the funnel's `BLUE` / `CARD_RADIUS` /
`ROW_RADIUS` / re-exported `CTA_HEIGHT`. `fonts.reading` has zero call sites app-wide, so
§Decided-5 holds in the code.

**Three decisions are open and belong to the owner on device**, all recorded where they live:
the funnel's option-row wash (`onboarding/tokens.ts`) versus v6's white-plus-shadow; whether the
hairlines *inside* cards and sheets — 1.16:1 on white — should be strengthened or become air; and
whether `summary-pill` and the session summary behind it come back.



| Screen | Change |
|---|---|
| `app/(tabs)/today.tsx` | The largest change. `PaperField`'s three near-white tones become the app canvas; the record becomes bare rows on it; the date pill, summary pill and NL input bar float as white pills. `styles` at `:221` sets `backgroundColor: color.surface` for the whole screen — that is now the canvas. |
| `app/(tabs)/progress.tsx` | 10 inline reading fonts, 2 `trained`, 1 radius, 1 shadow. The share chips filled with `gainWash`/`lossWash` at `:675-681` become `Badge tone="wash"`. Charts re-tint to brand. |
| `app/(tabs)/next.tsx` + `next/session.tsx` | Mount `ThoughtProcessCard`. `session.tsx:590` fills with `signalWash` → `Badge tone="wash"`; 5 inline fonts, 3 radius, 1 shadow. Planned green stays exactly as it is. |
| `app/(tabs)/you.tsx` | 7 `color.surface` blocks, 6 inline fonts, 1 `color.bg`, 1 `trained`, 1 radius, 1 shadow. Settings rows keep their `glyph.*` tints. |
| `app/paywall.tsx` | 10 onboarding-token refs, `color.bg`, 1 inline font. The `Nothing due today` green line at `:626` is the sanctioned `signal` exception and stays. No billing copy changes here. |
| `app/onboarding/[step].tsx` | Canvas + the funnel token deletions; the mascot acts out each step and shrinks to ≤32 pt or vanishes on data screens. |
| `app/_layout.tsx` | 3 `color.bg` refs — root background and navigator card style → canvas. |
| `app/split.tsx`, `plan-day.tsx`, `legal.tsx`, `health.tsx`, `import-start.tsx`, `aliases.tsx`, `lifts.tsx`, `sign-in.tsx` | `color.bg` → canvas; radius remap; `split.tsx` also has 3 `CONTROL_HEIGHT`, 2 `ctaFill`, 3 inline fonts. |
| Sheets — `exercise-sheet` (11 fonts, 5 radius), `session-summary-sheet` (7), `fix-sheet` (5), `session-sheet` (4), `streak-sheet` (3), `history-sheet` (2), `check-in-sheet` (7 `trained`), `calendar-sheet`, `entry-actions-sheet`, `entry-note-sheet`, `session-picker-sheet`, `trial-reminder-sheet`, `trial-started-sheet` | Canvas backdrop, `radius.xl`, brand for selected/active, `readingStyle()`. Sheets keep their cards — they are the sanctioned exception. |

## What does not change

Planned green and its contract · recorded semantics (`gain`/`loss`/`attention`/`trend`) · the ink
ladder tokens · `glyph.*` · the `ink` opacity ladder · the type scale and `READING_FACE` · spacing ·
every motion rule and Reduce-Motion gate · the AI boundary (CLAUDE.md §4) · the record being raw
text · export staying ungated.

## Per-phase verification

1. Repository gates: typecheck, tests, lint, iOS Expo export.
2. Re-measure any colour pair the phase touched; a value a person must read clears 4.5:1.
3. Dynamic Type at `MAX_FONT_SCALE`, VoiceOver, Reduce Motion, offline, empty history, long text.
4. Update `docs/implementation-status.md` in the same change.
