# PLAN.md — Recore v3

Execution plan derived from `CLAUDE.md` v3.0 §22. Read `CLAUDE.md` first; this file
tracks *what* and *when*, that file decides *how*.

---

## How to use this file

- Work on **one task at a time**, in order, and stop after it.
- A task is only ticked when every gate at the end of its phase passes for that task.
- Tasks are numbered `phase.task` — reference them directly:
  `Read PLAN.md. Work on 1.4 only. Show me the files you'll touch, then stop.`
- **Never start a phase whose entry condition is unmet.**
- Disagreements go in **Deviations**, not into the code.
- Append one line to **Log** per completed task.

**Effort assumes 20–30 h/week.** Estimates are per phase, not per task.

---

## Status

| Phase | Scope | Est. | Entry condition | State |
|---|---|---|---|---|
| 0 | Platform | ~1 wk | — | not started |
| 1 | Visual system + composer | ~3 wk | Phase 0 done, **D1 + D3 answered** | blocked |
| 2 | Parser | ~2 wk | Phase 1 done | blocked |
| 3 | Coach | ~1.5 wk | Phase 2 done, **D2 answered** | blocked |
| 4 | Lifts + Progress | ~2 wk | Phase 1 done | blocked |
| 5 | Onboarding + paywall | ~2 wk | Phases 1–4 done, **D4 answered** | blocked |
| 6 | The gym | ~2 wk | Phase 5 done | blocked |
| 7 | Ship | ~1.5 wk | Phases 0–6 done | blocked |

---

## Phase 0 · Platform

No visual change. This is the most-deferred work in the project and it gates six
features. Nothing in Phase 1 can start until this is clean.

- [ ] **0.1** Development build running on device: `npx expo run:ios`. Verify Apple sign-in
      and Keychain work outside Expo Go. Document the command in `README`.
- [ ] **0.2** Enable the New Architecture. Fix every library that breaks. Confirm no
      component depends on the legacy renderer.
- [ ] **0.3** Upgrade Expo SDK to current stable (SDK 54 → latest). Work through the
      changelog's breaking changes one at a time; commit per change, not per SDK.
- [ ] **0.4** Migrate `react-native-reanimated` 3 → 4 and install
      `react-native-worklets`. Do not modify `babel.config.js` —
      `babel-preset-expo` handles the plugin. Delete every `useAnimatedStyle` that
      Reanimated 4's style syntax makes redundant.
- [ ] **0.5** Install and smoke-test: `expo-glass-effect`, `expo-symbols`, `expo-font`,
      `expo-live-activity`, `react-native-purchases`. Each behind a runtime capability
      check, none used yet.
- [ ] **0.6** Route restructure to `src/app/(tabs)/{index,lifts,progress,you}` with
      `NativeTabs` from `expo-router/unstable-native-tabs` (CLAUDE.md §5.2). Four
      placeholder screens. Verify Liquid Glass renders on iOS 26 and that the bar
      degrades correctly on iOS 18 and Android.
- [ ] **0.7** `index.tsx` becomes the dispatcher (§13.1): no session + not onboarded →
      `/onboarding`; no session + onboarded → `/paywall`; session + onboarded → `(tabs)`.
      Move `onboarding` and `paywall` outside the auth guard.
- [ ] **0.8** EAS Build profile for internal distribution. One successful build.

**Gates**

- [ ] `npm run typecheck` · `npm test` · `npm run lint` pass
- [ ] `npx expo export --platform ios` bundles
- [ ] Dev build installs and launches on a physical device
- [ ] All four tabs reachable, no crash on tab switch
- [ ] No new colour / font-size / spacing literal introduced anywhere

---

## Phase 1 · Visual system and the composer

**Blocked on D1 and D3.** This phase *is* the app; everything after it is support.

### 1a — Tokens

- [ ] **1.1** Rewrite `src/lib/theme/color.ts` with both palettes from §6.3. Delete every
      old token value. Add a `useTheme()` hook resolving `system | light | dark`.
- [ ] **1.2** Bundle JetBrains Mono via `expo-font`. Rewrite `theme/type.ts` to the §6.5
      scale, keeping `moderateScale` and the Dynamic Type clamp.
- [ ] **1.3** `theme/space.ts`, `theme/shape.ts` (with a `concentric(outer, pad)` helper),
      `theme/elevation.ts` (two shadows only), `theme/motion.ts` (§7.1 springs + timings).
- [ ] **1.4** Lint rule or CI script that fails on a hex colour, a raw font size, or a raw
      spacing number outside `src/lib/theme/`. **This is the gate that keeps the system
      alive for the next twelve weeks — do it before any component.**
- [ ] **1.5** Contrast test: assert every text/background token pair meets AA in both
      themes. Runs in `npm test`.

### 1b — Primitives

- [ ] **1.6** `Screen`, `Card`, `Tag`, `PrimaryButton`, `Field`, `EmptyState` (§20).
      No `color` prop on any of them.
- [ ] **1.7** `DataValue` — every number in the app renders through this. Mono, tabular,
      unit-aware, never truncates.
- [ ] **1.8** `Glass` (§6.9) with the three-way fallback: `GlassView` → `BlurView` →
      solid. Runtime `isLiquidGlassAvailable()` and `isReduceTransparencyEnabled()`.
- [ ] **1.9** `Sheet` with detents and grabber. Migrate the existing calendar sheet onto it.
- [ ] **1.10** Motion primitives: `card.settle`, `card.repair`, `read.pulse`,
      `summary.rise` (§7.2), each honouring `useReducedMotion()` per the §7.5 mapping.

### 1c — The card

- [ ] **1.11** `ExerciseCard` — the four zones from §8.3. Set collapsing (`8 · 8 · 7` →
      `3 × 8`), dropset arrows, superset split, warm-up dimming, cardio variant.
- [ ] **1.12** Confidence ladder (§6.4): high / medium (dotted underline) / low (dashed,
      70%). Below 0.4 renders nothing.
- [ ] **1.13** `Stepper` and the inline edit path (§8.4). Increment from the exercise's
      `increment_kg`, long-press acceleration, `card.repair` on change.
- [ ] **1.14** Card gestures (§8.5): tap value, tap name, long-press, swipe-to-delete with
      a 6-second undo that strikes the line in `raw_text` rather than deleting it.

### 1d — Today

- [ ] **1.15** Rewrite `note-surface.tsx` against §8.1–§8.2. Keep the parse-and-advance
      behaviour, keep `raw_text` as truth, replace all chrome.
- [ ] **1.16** Header: date, calendar chevron, derived session title, bare mono streak.
- [ ] **1.17** Glass accessory bar: rest timer slot, mic slot, running total, `Finish`.
      Tab bar hides while the keyboard is up.
- [ ] **1.18** Swipe-down-on-header → raw note view. This escape hatch must always exist.
- [ ] **1.19** Session summary (§8.8) on `Finish`, for every session, no heuristics.
      Delete the receipt-mode detection entirely.
- [ ] **1.20** All three Today empty states (§8.9), including the one-time self-writing demo.
- [ ] **1.21** Delete the orphans: `ghost-prediction.tsx`, `session-receipt.tsx`,
      `empty-note-cards.tsx`, `week-recap-card.tsx`, the right-gutter and its measuring
      mirror, `read-only-ledger.tsx`. Keep `predict/*` — Phase 3 needs it.

**Gates**

- [ ] All Phase 0 gates still pass
- [ ] 1.4 CI check is green and cannot be bypassed
- [ ] Today works in both themes, verified for contrast
- [ ] Today works at `accessibilityLarge` with no number truncated
- [ ] Today works with Reduce Motion and Reduce Transparency enabled
- [ ] Every touch target ≥ 44×44
- [ ] A five-exercise session can be typed in under 45 s on device
- [ ] Empty, loading, error, offline and lapsed states all implemented

---

## Phase 2 · Parser

- [ ] **2.1** Expand the eval set to **150 labelled lines**, every group in §9.3
      represented, ≥ 30 Slovenian, ≥ 15 dictation artefacts. Seed from existing
      `corrections` rows.
- [ ] **2.2** `npm run eval` reports per-group scores, not one aggregate. CI fails on
      **any** regression, not on a lower average.
- [ ] **2.3** Add `confidence` per item to the parse schema and clamp it server-side.
      Wire it to the §6.4 ladder built in 1.12.
- [ ] **2.4** Fix the prompt until every group passes ≥ 97%. Bump `PARSE_VERSION` per
      change. Add the failing line to the eval set *before* fixing it, every time.
- [ ] **2.5** Personal vocabulary suffix (§9.5): user aliases + recent exercise names sent
      *after* the cached prefix, capped at 60 entries. Verify prompt caching still hits.
- [ ] **2.6** Repair sheet rebuilt on the new `Sheet`: exercise identity, per-set fields,
      set kind, and the scope radio (`only this line` / `always read "x" as Y`).
- [ ] **2.7** Alias overrides consulted before all other resolution, including for global
      exercises. Mis-learned aliases are scrubbed on correction.
- [ ] **2.8** Alias echo on the card (§9.6) — the user's original word survives every
      auto-fix and is visible without interaction.
- [ ] **2.9** Background re-parse on `parse_version` bump: batched, rate-limit aware,
      lowest priority, resumable, never blocks a read.
- [ ] **2.10** Failure path verified end to end: airplane mode → line stays, pulse
      continues, retries at 3/8/20 s, sync-loop retry reaches an open screen.

**Gates**

- [ ] All Phase 1 gates still pass
- [ ] `npm run eval` ≥ 97% on every group, zero regressions
- [ ] `PARSE_VERSION` bumped and deployed
- [ ] No `raw_text` in any log, error report, or analytics payload
- [ ] A full session parses correctly with the phone in airplane mode, then syncs

---

## Phase 3 · Coach

**Blocked on D2.**

- [ ] **3.1** Audit the dormant `predict/engine.ts` against §10.2. Add the effort-creep
      deload rule. Keep it pure and synchronous.
- [ ] **3.2** Unit tests for every §10.2 branch: top-of-range, RIR ≥ 2, RIR 0–1, below
      range, two stalls, effort creep, bodyweight, cardio, seen-once.
- [ ] **3.3** `roundToPlate` verified against the user's smallest plate, in pairs, in both
      kg and lb.
- [ ] **3.4** Verify `predict/split.ts` still holds after the Phase 1 rewrite. No user-facing
      split configuration exists anywhere.
- [ ] **3.5** Zone 4 of `ExerciseCard`: the target appears the moment the exercise is
      named, collapses when real numbers are typed (§10.4). `target.reveal` motion.
- [ ] **3.6** `explain-prediction` produces one line, in the user's language, quoting their
      own words. Template fallback when the model is unavailable. **No reason → no line.**
- [ ] **3.7** Secondary placement: full target list as the Today empty state; tapping one
      writes the exercise name into the composer.
- [ ] **3.8** Adherence settlement (§10.5) + suppression: three consecutive `ignored` for
      an exercise hides its target for two weeks.
- [ ] **3.9** Target ages out at 14 days. Verify silence, not stale advice.

**Gates**

- [ ] All Phase 2 gates still pass
- [ ] Engine tests cover every branch; no engine path is untested
- [ ] No model call can influence a number — verified by reading the call sites
- [ ] With one session of history, the Coach repeats rather than extrapolates
- [ ] Ember appears nowhere except a planned value

---

## Phase 4 · Lifts and Progress

- [ ] **4.1** Lifts list: dense rows, sorted by recency, search, 12-week sparkline per row.
      12 rows visible on a standard screen.
- [ ] **4.2** Lift detail (§11.2): vocabulary line, e1RM number + delta, chart, target,
      history table. Migrate `ExerciseSheet` content into it and delete the sheet.
- [ ] **4.3** `Chart` and `Sparkline` on `react-native-svg`, monochrome, no library. Second
      series is a dashed stroke, never a second hue.
- [ ] **4.4** Per-exercise settings menu: rep range, increment, rest duration. Nothing else.
- [ ] **4.5** Progress zoom 1: four `StatTile`s including `targets met`.
- [ ] **4.6** Progress zoom 2: 12-week volume bars with session dots.
- [ ] **4.7** Insight lines — deterministic rules only, maximum two, zero if none fire.
      Write the rule set as a pure tested function.
- [ ] **4.8** Progress zoom 3: `Calendar · Sessions · Records` segmented control. Dot
      weight scaled by volume. Session push route. Records list with sparklines.
- [ ] **4.9** PR detection on all four axes (§15.5), suppressed until an exercise has three
      recorded sessions. `pr.flag` motion (§7.6) — the one overshoot in the app.
- [ ] **4.10** Weekly review card at the top of Progress from Monday 00:00 until dismissed.
      Rules must be able to produce an unwelcome sentence.

**Gates**

- [ ] All Phase 3 gates still pass
- [ ] Every screen: five states, both themes, `accessibilityLarge`, reduced motion
- [ ] No empty chart with zero axes anywhere
- [ ] Every number renders through `DataValue`
- [ ] Deuteranopia simulation pass on Progress and Lift detail

---

## Phase 5 · Onboarding, paywall, billing

**Blocked on D4.**

- [ ] **5.1** Onboarding shell: 16 steps, back everywhere, skip on 3–10, progress bar from
      2, resume at `pref_ob_step`, every answer persisted to `meta` on selection.
- [ ] **5.2** Screen 1 with the live specimen (§13.2). Real parse, real card, 4 seconds.
- [ ] **5.3** Screens 2–6: name, goal + payoff, tracker + payoff. Payoff copy branches per
      answer — five variants for the tracker screen.
- [ ] **5.4** Screens 7–8: language, then the hero demo **in the chosen language, against
      the real prompt** (§13.6). If it is unreliable, Phase 2 is not done.
- [ ] **5.5** Screens 9–10: units + increment (writes `plate`), weekly target (writes the
      streak input).
- [ ] **5.6** Screen 11: the commitment beat with the honest payoff (§13.8). No invented
      chart. The answer sets the Progress chart horizon.
- [ ] **5.7** Screen 12: attribution → `attribution_source`.
- [ ] **5.8** Screen 13: the build beat doing real work — seed exercises, apply increment,
      stage the import, warm the prompt cache. Minimum 1.2 s hold.
- [ ] **5.9** Screen 14: personalised reveal, setup chips, first-action choice preselected
      from screen 5. **No social proof until it is real.**
- [ ] **5.10** Paywall (§14.3): annual default anchored to its monthly equivalent, honest
      three-row trial timeline, visible Restore, no colour, dynamic legal line.
- [ ] **5.11** RevenueCat wired: one entitlement `pro`, two products, **one-month trial**.
      Entitlement checked at session start only, cached, never on a write. Verification
      failure assumes entitled.
- [ ] **5.12** Sign-in as the final step. Verify the whole flow cold-installs to
      `trial_started`.
- [ ] **5.13** Lapsed state (§12.5): read-only, full export, one line, one button.
- [ ] **5.14** Local counters from §3.3 all firing.

**Gates**

- [ ] All Phase 4 gates still pass
- [ ] Cold install → paywall shown in under 3 minutes, measured on device
- [ ] Trial start → first parsed line in under 30 s
- [ ] No permission prompt anywhere in onboarding
- [ ] Sandbox purchase, restore, and cancel all verified
- [ ] Every claim on the paywall is true

---

## Phase 6 · The gym

- [ ] **6.1** Rest timer in the accessory bar: auto-start on card settle, per-exercise
      duration, tap to stop, long-press to change.
- [ ] **6.2** Live Activity + Dynamic Island via `expo-live-activity`. Countdown goes ember
      in the last 10 s.
- [ ] **6.3** Timer completion: haptic + local notification, **never a sound**. Notification
      carries the *log the same set again* action, working from a cold app.
- [ ] **6.4** Notification permission requested at first timer start, on a screen that has
      just explained the timer. Never re-asked after denial.
- [ ] **6.5** Voice dictation into the composer. Same parser, no separate path. Verify the
      dictation eval group passes on real speech.
- [ ] **6.6** Plate maths sheet from `lib/plates.ts`, reachable by long-press on a load.
- [ ] **6.7** Share card (§15.2) from the session summary: monochrome PNG, wordmark only
      during capture.
- [ ] **6.8** Weekly review notification, Monday, at the user's usual training hour.
- [ ] **6.9** Training-day nudge: requires four weeks of stable pattern, opt-in, names a
      real Coach number or is not sent. **No guilt copy in any notification, ever.**
- [ ] **6.10** Import surfaced in onboarding's first action and in You. Hevy + Strong + a
      generic CSV mapper.
- [ ] **6.11** Export: CSV and JSON, JSON includes `raw_text`, both work on a lapsed
      subscription.

**Gates**

- [ ] All Phase 5 gates still pass
- [ ] Rest timer survives app backgrounding, lock, and a phone call
- [ ] At most one notification per day, verified over a week of real use
- [ ] Export round-trips: export → import → identical data
- [ ] A full session logged one-handed while walking

---

## Phase 7 · Ship

- [ ] **7.1** Full §17 accessibility audit, screen by screen, written up.
- [ ] **7.2** VoiceOver pass: every card reads as one sentence, not seven fragments.
- [ ] **7.3** Dynamic Type pass at `accessibilityLarge` on all four tabs plus onboarding.
- [ ] **7.4** Deuteranopia pass on every screen.
- [ ] **7.5** Reduce Motion and Reduce Transparency pass on every screen.
- [ ] **7.6** Airplane-mode pass: full session, start to finish, then sync.
- [ ] **7.7** Cold-start deep links: all four routes from §5.3.
- [ ] **7.8** Performance: card settles under 1.2 s p50 on the oldest supported device.
- [ ] **7.9** Privacy nutrition labels, and the plain-English *what we send* page in You.
- [ ] **7.10** App Store assets: screenshots built from real logged sessions, never mockups.
- [ ] **7.11** ASO: title, subtitle, keywords from the keyword research, description.
- [ ] **7.12** Review notes explaining the hard paywall and the trial, to pre-empt rejection.

**Gates**

- [ ] Every gate from every prior phase passes
- [ ] Zero known crashes, zero known data-loss paths
- [ ] Every §24 non-goal absent from the build

---

## Decisions

**Blocking. Owner answers; do not decide these unilaterally.** Each changes several
sections of `CLAUDE.md` at once, so answering late is expensive.

- **D1 — Input model.** `CLAUDE.md` §0.1 keeps free text as the primary input and makes
  taps the repair path. The alternative is a conventional form as the primary path, which
  is a different product. → *unanswered*

- **D2 — The Coach in the UI.** §10.4 brings the predictor back, inside the exercise card
  rather than as a plan card. The alternative is leaving it dormant. → *unanswered*

- **D3 — The streak.** §15.3 counts weeks in which the user met their own weekly target,
  not consecutive days. → *unanswered*

- **D4 — Trial length.** §14.2 moves the trial from 7 days to one month. → *unanswered*

---

## Deviations

Every disagreement with `CLAUDE.md` is recorded here rather than acted on silently.

```
### <date> · §<section> · <task id>
What the document says:
What I think is wrong:
What I recommend instead:
Status: proposed | accepted | rejected
```

*(none yet)*

---

## Inventory

From the v2 codebase. Confirm each line against the actual repo during 0.1 and correct
this table if it is wrong.

**Reuse as-is**
`supabase/migrations/*` · RLS + `supabase/tests/` · `bump_parse_rate` RPC ·
`lib/db/schema.ts` and the SQLite mirror · `lib/sync/*` · Apple/Google auth (PKCE,
SecureStore) · `parse-workout` edge function and `prompt.ts` · `parse/anchor.ts` ·
`parse/apply.ts` · `parse/overlay.ts` · `parse/correct.ts` · the eval harness ·
`predict/engine.ts` · `predict/split.ts` · `predict/adherence.ts` ·
`getPredictionForOpen` · `lib/plates.ts` · `lib/import/*` · `db/insights.ts` ·
`db/last-set.ts` · `theme/scale.ts` (`moderateScale`)

**Rewrite**
`note-surface.tsx` → §8 · `theme/color.ts` → §6.3 · `theme/type.ts` → §6.5 ·
`theme/elevation.ts` → §6.8 · `components/primitives.tsx` → §20 ·
`components/charts.tsx` → 4.3 · `exercise-sheet.tsx` → Lift detail (4.2) ·
`fix-sheet.tsx` → 2.6 · `/stats` → Progress (4.5–4.10) · `/settings` → You (§11.3) ·
`/paywall` → §14.3 · `onboarding/*` → §13 · `top-bar.tsx` + `bottom-toolbar.tsx` →
1.16 / 1.17

**Delete (1.21)**
`ghost-prediction.tsx` · `session-receipt.tsx` · `empty-note-cards.tsx` ·
`week-recap-card.tsx` · `read-only-ledger.tsx` · `insight-header.tsx` · the right-gutter
and its measuring mirror · receipt-mode detection and its `meta` keys · every
`hasFinishedOnce` / `hasSeenGhostHint` teaching-tail flag

**Still a stub**
RevenueCat billing (5.11) · recap push notification (6.8)

---

## Log

One line per completed task: `<date> · <task id> · <what changed> · <gate result>`

```
```
