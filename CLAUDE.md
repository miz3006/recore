# CLAUDE.md — Recore

Read this fully before writing any code. It defines what Recore is, what is
already built, the quality bars, and where the product is going. Follow it
literally; the human adjusts details later.

**The two flagship systems are §6 (the parser) and §7 (the predictor).** When
prioritizing anything, work that makes parsing more magical or predictions more
trustworthy outranks everything else. Every other feature exists to serve those
two.

---

## 1. What Recore is

Recore is a workout log you **write in** — like Apple Notes, but it understands
training. The user types a messy, free-form note
(`bench 3x8 80kg superset with flyes 12x, last set dropset to 40`) and the app
parses it into clean structure. There are **no forms, no dropdowns, no exercise
pickers, and no chat interface**. The blank page IS the product.

Why this wins (grounded in how people actually quit trackers): ~77% of fitness
app users abandon within days, and the #1 reason is **logging friction** —
people quit the admin, not the gym. Hevy and Strong keep adding UI; a note has
none. Recore's bet: the fastest possible log plus the smartest possible next
session.

1. **Free-form logging** — the wedge. The reason a user picks Recore over
   Hevy/Strong. Type anything, in any language, it becomes structured.
2. **Next-session prediction** — the moat. When the user opens the app on a
   training day, the note is pre-filled with a suggested session (ghost text),
   with one line explaining why — quoting their own words. Parse-only apps are
   already appearing (Gym Journal AI, Arvo, SmartReps); the prediction loop and
   the design purity are what they can't copy quickly.

The user is a **serious lifter or hybrid/Hyrox athlete**, not a beginner.
Tone everywhere: quiet, serious, minimal. No cute copy, **no emoji anywhere in
the UI** (including the streak — it renders as a bare number in mono, no 🔥).

**The product filter.** Before building anything, it must pass one of:
- makes the note faster or more accurate to log,
- makes the prediction smarter or more trusted,
- makes the page more beautiful.
If it does none of these, don't build it — that is how Hevy got "overbuilt".

---

## 2. Current state (do not re-scaffold what exists)

Foundation is **built and wired to real data**: Supabase schema + RLS +
`bump_parse_rate` RPC, local-first expo-sqlite mirror (source of truth on
device), background sync, Apple/Google auth (PKCE, SecureStore), `parse-workout`
edge function (structured outputs, JWT + rate limit + injection hardening),
optimistic per-keystroke writes, debounced background parse, right-gutter
signals (↑ = ↓ PR), calendar sheet, ExerciseSheet (history/chart/e1RM), real
/stats (8-week volume chart), prediction engine V1 (pure, unit-tested double
progression with RIR), ghost prediction with Start / Something else,
`explain-prediction` edge fn (V2 reasons), voice dictation (dev build only),
Hevy/Strong CSV import, parse eval harness (`npm run eval`).

Also built (2026-07-16 flagship pass): **ghost survives rest days** (§7.2
Gap 1 — `getPredictionForOpen`, 14-day window), **parse correction loop v1**
(§6.2 — long-press a gutter value → FixSheet; alias overrides re-point
shorthand even at global exercises; `corrections` rows overlay re-parses and
sync up as training data), **zero-config split matching** (§7.2 Gap 2 —
`predict/split.ts`, Jaccard clustering + rotation successor, unit-tested),
**adherence instrumentation** (§7.2 Gap 3 — `accepted_at` on Start,
`outcome` followed/edited/ignored settled after each parse).

**Also built (2026-07-17 design overhaul, research-driven):** the TWO-INK
system (signal volt `#C8FF00` = the machine's ink — see §8), universal session
LEDGER (SessionReceipt for every parsed session, staged reading header),
labeled NEXT SESSION ghost card with adherence trust line, InsightHeader
landmark, empty-state cards (last-session peek / self-typing demo), Progress
hub (/stats: StatTiles, WeekBars + session dots, record book, training log,
predictor record), real /settings (goal + plate editable, CSV export), /paywall
UI (Hevy-lane pricing, Bill of Rights), react-native-svg charts, primitives
(Card/CaptionLabel/StatTile), e1RM Sparkline in ExerciseSheet, `db/insights.ts`
(adherence record, all-time PRs, recent sessions, e1RM series).

**In-gym pack SHIPPED 2026-07-17 (review-mining-driven):** LAST-TIME gutter
hint (name an exercise, no numbers → last session's top set instantly, pure
local `db/last-set.ts`, textMuted so it can't read as a result, tap → sheet);
REST TIMER in the toolbar (tap start/stop, long-press cycles 1:00–3:00 via
prefs, last 10 s + finish "go" in volt, success haptic — never an alarm);
WEEKLY RECAP card (`week-recap-card.tsx` — first empty open of a new week:
last week's tonnage/sessions/WoW/PRs, share + done, meta-keyed once per week);
SHARE CARDS (react-native-view-shot: receipt + recap capture as dark PNG with
a Recore mark rendered only during capture); PLATE MATH (`lib/plates.ts` pure
+ tested — checklist long-press shows "25 + 5 + 1.25 a side"; bar weight pref
in /settings); CARDIO/RUNNING as first-class (parsedDistance/formatDistanceTotal
in summarize, receipt + toolbar total in km when no kg, InsightHeader speaks
sessions for run/bodyweight weeks); micro-motion pass (FadeInDown card
entrances, ZoomIn check, all reduceMotion-gated, one vocabulary).

**Still stubs:** RevenueCat billing (the /paywall UI is real; purchases need
the dev build), recap push notification (in-app card shipped).

Constraints: user runs Expo Go (SDK 54) — Apple sign-in, Keychain entitlements
and voice need a dev build (`npx expo run:ios`). Install with
`npm install --legacy-peer-deps`. No simulator in-session: verify with
`npm run typecheck`, `npm test`, `npm run lint`, and
`npx expo export --platform ios` (Metro bundle) instead of a live run.

---

## 3. North-star metrics (what "people actually use it" means)

Design and code against these, in this order:

| Moment | Metric | Bar |
|---|---|---|
| First open | Time to first parsed line ("aha") | < 60 s from install |
| Every session | Interaction time to log a full workout | < 30 s of typing, zero taps required |
| Parse | Perceived gutter latency | < 2.5 s p50 after pause in typing |
| Day 7 | First ghost prediction shown → accepted (Start) | accept rate is THE health metric |
| Day 30 | Prediction adherence (prescribed vs performed) | measured, trending up |
| Always | Data loss | zero. raw text survives everything |

Retention logic: D1 is won by the first parse feeling like magic; D7 by the
first ghost that was exactly right; D30+ by trust — predictions that keep being
right and never talk nonsense. Instrument these moments (lightweight local
counters first; no analytics SDK without the human's sign-off).

---

## 4. Tech stack (do not substitute)

- **Expo SDK 54** (managed), **React Native 0.81**, **React 19**, **TypeScript
  strict**, **Expo Router**.
- **Supabase** — Postgres + Auth + Edge Functions. `@supabase/supabase-js`.
- **Local-first**: writes go to on-device SQLite FIRST (optimistic, 0 ms), sync
  to Supabase in the background. Gyms have no signal; the app must fully work
  offline. **Never block the UI on a network call.**
- **State**: Zustand. **Animations**: reanimated + moti, UI-thread only.
  **Haptics**: `expo-haptics` on every tap.
- **Payments (later)**: RevenueCat; `/paywall` stays a stub until the human
  says otherwise.
- **Voice**: on-device `expo-speech-recognition` (lazy-required, Alert in Expo
  Go). Never a cloud transcription API.

Env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never
hardcode keys. The AI provider key exists ONLY as a Supabase secret inside edge
functions — never in the client, never passed from the client.

---

## 5. Data model (deployed — additive migrations only)

Authoritative DDL: `supabase/migrations/` and the mirrored local schema in
`src/lib/db/schema.ts` (plus local-only `parse_cache` and `meta`). Deployed
tables: `profiles`, `workouts`, `items`, `sets`, `exercises`, `predictions`
(incl. `accepted_at`/`outcome`), `parse_rate_limits`, `corrections`,
`alias_overrides`.

The design principle that must never break: **`raw_text` is the source of
truth; structure is a derivable projection.** Never overwrite or "clean up"
what the user typed. When the parser improves, bump `parse_version` and
re-parse from `raw_text` — every user's history improves overnight.

Invariants that must hold:
- Superset = shared `group_key` across items (two = superset, three = triset,
  ten = circuit — no schema change).
- Dropset/myo = `parent_set_id` chain onto the working set, arbitrary depth,
  never a new item.
- `kind='warmup'` is EXCLUDED from all volume math.
- Aliasing: `bench`, `BP`, `potisk s prsi` resolve to one `exercises` row via
  `aliases[]`. Resolve on parse; create a new exercise only when nothing
  matches.
- RLS on every table; a user touches only their own rows. Schema changes are
  **additive migrations only** — never rewrite deployed tables.

The §6/§7 additive tables are DEPLOYED (migration
`20260716130000_correction_loop.sql`): `corrections` (line_text, before_json,
after_json — every user fix is training data AND an overlay that re-applies on
re-parse), `alias_overrides` (user shorthand → exercise, consulted before any
other resolution — works for global exercises too), and the `predictions`
adherence columns. Local mirror is schema v2 with stepped migration.

---

## 6. THE PARSER (flagship #1 — the wedge)

The parser is why someone switches to Recore. It must feel like the app *read
their mind*, in their own shorthand, in their own language. Everything below
is in service of one bar: **the user never has to change how they write.**

### 6.1 Architecture (implemented — keep these properties)

1. Keystroke → **raw_text saved to SQLite immediately** (optimistic, 0 ms).
2. Debounced background call to the `parse-workout` edge function. The AI key
   lives only there. Structured outputs constrain the model to the JSON schema
   (`supabase/functions/parse-workout/prompt.ts` — ONE source of truth, shared
   with the eval harness).
3. Response is validated and clamped server-side, re-anchored to physical
   lines client-side (`parse/anchor.ts` — the model's line index is a hint,
   not a fact), stale-guarded against text typed while in flight, then applied
   to `items`/`sets` and rendered in the right gutter.
4. Offline/failure: the raw line stays; the UI retries with backoff (3s/8s/20s,
   dots stay on) and the sync loop retries after that — a landed sync-retry
   reaches the open screen via `setParseListener` (a silent success that only
   updates SQLite reads as "the AI didn't understand me"). The user never
   waits and never loses data.
5. After apply, the predictor (§7) recomputes and caches the next session.

Security posture (keep): JWT-verified identity, per-user sliding-window rate
limit via service-role RPC, `<workout_log>` data-delimiting against prompt
injection, server-side clamping of every number, raw_text never logged.

Cost/latency posture (keep): Haiku-class model by default (`PARSE_MODEL`
secret overrides), prompt caching on the static system prompt, `effort: low`
only on models that support it, debounce so a note parses once per pause —
not per keystroke, `parse_cache` so unchanged text is never re-sent.

### 6.2 Quality program (this is how the parser gets magical)

- **The eval harness is the gate.** `npm run eval` runs the real prompt against
  a labeled set. Any prompt/schema change bumps `PARSE_VERSION` and must pass
  eval BEFORE deploy. No exceptions — a parser regression breaks the core
  promise silently.
- **Every real-world miss becomes an eval case.** When a note parses wrong,
  first add the failing line to the eval set, then fix the prompt. The eval set
  only grows. This is the flywheel that compounds.
- **Correction loop (BUILT — `parse/correct.ts`, `components/fix-sheet.tsx`).**
  Long-press a gutter value → FixSheet (exercise + per-set fields) → writes
  back to `sets`; a changed exercise becomes an **alias override** (the typed
  shorthand resolves to the corrected exercise forever, even when the target
  is a global row) and the mis-learned alias is scrubbed. Every fix logs a
  `corrections` row, is re-applied by the overlay (`parse/overlay.ts`,
  unit-tested) whenever the same line re-parses, and syncs up as training
  data for the eval set. Tap (short) keeps opening ExerciseSheet history.
- **Silence over noise.** A line that parses to nothing gets NOTHING — no red
  squiggle, no "couldn't parse". People write "felt tired today" between
  exercises; that's a note, not an error. Unparsed lines are still saved
  forever in raw_text and re-tried on the next parse_version.
- **Any language in, canonical English out.** Exercises map to canonical
  English names; `aliases_seen` preserves exactly what the user wrote
  (lowercased). "Write in your own words, in your own language" is an explicit
  adoption lever — it must keep working for Slovenian, German, Spanish notes.
- **Voice = same parser.** Dictation produces text into the note; parsing is
  identical. No separate voice pipeline.

### 6.3 Parser roadmap (ranked; 1 done)

1. ~~Correction loop v1~~ BUILT (see §6.2).
2. Eval set expansion to 50+ real lines incl. multilingual + voice-dictation
   artifacts ("eighty kay gee"), gated in CI. Seed it from synced
   `corrections` rows.
3. Auto re-parse of old notes when `parse_version` bumps (background, batched,
   rate-limit aware).
4. Personal context in the prompt: the user's own alias table and recent
   exercise names sent as a compact system suffix — the parser should prefer
   *their* vocabulary. (Keep the cached prefix static; per-user data goes after
   the cache breakpoint.)

---

## 7. THE PREDICTOR (flagship #2 — the moat)

The predictor is why someone *stays*. The research is unambiguous: precise,
stable, explainable per-set targets earn 4.9★ trust (Alpha Progression);
"AI-generated workouts" that feel random get abandoned (Fitbod's core
complaint). Therefore the iron law:

**CODE computes the numbers. The AI only phrases the explanation.** Never let
a model pick a weight. Never compute on open — compute after a workout, cache
to `predictions`, read the cache instantly.

### 7.1 Engine (implemented — `src/lib/predict/engine.ts`, pure + unit-tested)

Double progression with RIR: fill the top of the rep range on all working sets
→ add weight (per-exercise `increment_kg`), drop to the bottom of the range;
RIR ≥ 2 extracted from the user's own words → add weight now; RIR 0–1 in range
→ chase one rep; below range → hold weight; two sessions stuck → deload −10%.
All loads round to what a barbell can hold (`roundToPlate`, pairs of the
smallest plate). Bodyweight progresses reps first. Cardio/carries/holds repeat
last prescription. The one-line reason is a template over engine facts,
quietly upgraded by the `explain-prediction` edge fn into the user's own
language, quoting their own note. If there is no real reason, there is NO
line — silence beats generic encouragement.

### 7.2 The three gaps — ALL CLOSED (2026-07-16), invariants to preserve

**Gap 1 — ghost survives rest days (FIXED).** `getPredictionForOpen` returns
the latest prediction with `for_date ≤ today` inside a 14-day window
(`GHOST_MAX_AGE_DAYS` — older than that is silence, not a suggestion). Never
regress to exact-date lookup; newer sessions supersede naturally because they
write later `for_date` rows.

**Gap 2 — split matching (FIXED, zero-config).** `predict/split.ts` (pure,
unit-tested): cluster the last ≤10 sessions by exercise-set Jaccard (≥ 0.5
against the cluster's most recent member), read the label sequence as a
rotation, progress the most recent session of the cluster that FOLLOWS the
just-finished one (unique successor, or dominant with ≥2 observations). No
confident rotation → progress the latest session. The rotation always ends at
the LATEST session, so re-parsing an old note still predicts from the true end
of history. Never ask the user to define their split.

**Gap 3 — adherence (INSTRUMENTED).** Start sets `accepted_at`
(`markPredictionAccepted`); after each parse of today's note the outcome is
re-settled (`predict/adherence.ts`): note ≡ ghost → `followed`; accepted then
changed → `edited`; never accepted → `ignored`. Ghost-accept-rate and
followed-rate are the §3 health metrics — surface them in /stats later, and
treat rising `ignored` as a signal to back off.

### 7.3 Evidence-based refinements (after the gaps)

- **Effort-creep deload**: same load with extracted RIR trending down across
  sessions (reps flat, "grindy" appearing) → proactively suggest a deload
  *before* the 2-stall rule fires. Deload = −10% load AND reduced volume, one
  session, ghost says why in one line.
- **Rep-range per exercise**: today's range is inferred (top − 2); allow an
  explicit range on the exercise row later; isolation defaults higher (8–15).
- Prediction for an exercise seen only once: repeat it verbatim, no reason
  line. Never extrapolate from one data point.

### 7.4 Trust rules (never violate)

- The ghost is text, not a lock: typing anywhere over it overrides it, Start
  accepts it whole, "Something else" dismisses without judgment.
- The reason line quotes the user's own words when possible
  (`"Last time at 82.5 you wrote you could've had two more. So +2.5."`).
- One reason line max per ghost. No reason → no line. The AI never speaks
  first unless it has a number.
- Wrong predictions erode the moat faster than no predictions — when history
  is thin or ambiguous, predict conservatively (repeat) rather than cleverly.

---

## 8. Design system (premium is the brand)

### Typography
No custom font — SF Pro (system). **Never hardcode a font size anywhere**:
every size comes from the tokens in `src/lib/theme/type.ts`, which run through
`moderateScale` and clamp Dynamic Type (established rule — see
`theme/scale.ts`). Parsed numbers use **monospace** (`ui-monospace`/SF Mono)
ONLY in the right gutter, aligned via measured line heights — never for
headings or buttons.

### Color — TWO INKS (2026-07-17 design overhaul)
The user writes in white; **the machine answers in SIGNAL volt `#C8FF00`**.
Monochrome base, near-black canvas, and exactly ONE semantic accent at ~10%
coverage (research: Whoop/Oura/Peloton — zero-accent monochrome reads
unfinished; one meaningful accent reads premium):

```ts
bg '#0A0A0A' · surface '#161616' · surfaceHigh '#202020' · accent '#FFFFFF'
signal '#C8FF00' (THE MACHINE'S INK) · textPrimary '#FFFFFF'
textSecondary '#9A9A9E' · textMuted '#5A5A5E'
border '#222222' (hairline 0.5px) · error '#FF453A' (deload/warnings ONLY)
```

**The signal rule (never violate):** volt appears ONLY where the AI asserts or
the user got stronger — parse status, ↑ deltas, PR pills, ghost prescriptions,
current-week chart bars, predictor record. NEVER decoration, NEVER chrome,
NEVER marketing (the paywall is white). Primary CTAs stay white-fill
black-text — the restraint is the brand. The opacity ladder is centralized in
`theme/color.ts` as `ink` tokens (echo 0.55 · delta 0.8 · full 1.0 · grabber
0.18 · rule 0.28 · wash 0.14) — never inline new opacities.

**Premium details everywhere:** hairline borders, 16–20 px card radii, pill
controls, generous whitespace, no gradients/shadows/glow, primary buttons
white-fill black-text, press states via `surfaceHigh` not opacity flashes.
Shared primitives live in `components/primitives.tsx` (Card, CaptionLabel,
StatTile) and `components/charts.tsx` (WeekBars, MicroBars, Sparkline —
react-native-svg, bundled in Expo Go). **No emoji in the UI, ever** — the
streak is a bare mono number in the top bar, no flame.

---

## 9. Surfaces

**Home (90% of time — a note that proves it was read).** Top bar: Recore mark ·
date pill (tap → calendar sheet) · bare mono streak + settings. Below it the
**InsightHeader** landmark (`components/insight-header.tsx`): THIS WEEK tonnage
in statNumber + the 8-week MicroBars strip + session count; taps to /stats;
hides while the keyboard is up and renders nothing with zero history. Body: the
blank page; tap anywhere focuses; white cursor. Each typed line's parsed result
appears in the RIGHT GUTTER in mono — ↑ deltas and PR pills in signal volt,
echoes quiet white. **THE LEDGER**: every parsed session (≥2 exercises) settles
a SessionReceipt card under the note — resolved exercise names, top sets,
deltas, total tonnage in statNumber, staged "READING YOUR LOG…" header while a
parse is in flight (labor illusion). An EMPTY day is never a void
(`components/empty-note-cards.tsx`): LAST SESSION peek card (tap → that day),
or the self-typing demo card on a blank account. Ghost prediction on a new
training day: a labeled **NEXT SESSION CHECKLIST** (Strong-style, 2026-07-17) —
grey rows with prescribed loads in volt, a circle on the right per row. Tap the
circle when done → `checkGhostLine` commits that ONE prescribed line into the
note (raw_text stays the source of truth) and the row turns into a volt ✓; rows
also check themselves off the moment the parse (or fresh typing) carries that
exercise (`typedNameOf`/`namesMatch` in `parse/receipt.ts`, pure + tested). The
card SURVIVES typing (header counts "2/5 done"), hides in receipt mode, and
keeps the reason line + "Followed X of last Y" trust line (≥3 settled outcomes,
majority followed). **Start** (note empty only) commits the whole plan;
**Something else** dismisses. **Correction marks:** when the parser fixes a
typo ("tricpes" → Triceps Pushdown), the ledger row shows a quiet volt ✓ with
the user's original word — the auto-fix is visible and reviewable (long-press
still opens FixSheet). Bottom toolbar: tonnage pill with unit (routes to
/stats) · mic · + · keyboard toggle (camera removed until it works).

**Receipt mode (BUILT — `parse/receipt.ts` pure + tested,
`components/session-receipt.tsx`).** When the whole workout is typed in at
once — the end-of-training dump — the per-line gutter disappears: the note
runs full width, ONE quiet thinking row sits under the last line during the
parse, and a **session receipt** settles below the text instead: exercise ·
top set (mono, 45%) · comparison signal (70%, PR pill at 100%), a TOTAL row
(volume · sets), and at most one AI line with the thin white left border (the
freshly cached next-session reason; today only). Detection is automatic and
sticky per workout (meta KV): ≥ 4 distinct exercises parsed from a note that
was empty < 60 s earlier. Accepting a ghost never counts as a dump —
that's live-logging. Tap a receipt row → ExerciseSheet; long-press → FixSheet.
First-time exercises get SILENCE in the signal column, prose lines never
reach the receipt, and the receipt dims to 50% while the note has unparsed
edits. The receipt is also the natural seed for the §11 share card.

**ExerciseSheet** (tap a gutter value): last 5 sessions, volume/weight chart,
e1RM. Long-press = parse correction (§6.2).

**/stats — the Progress hub** (rebuilt 2026-07-17): Tier 1 — four StatTiles
(week tonnage + WoW%, sessions, heaviest lift, predictor record `X/Y
followed`). Tier 2 — the 8-week WeekBars chart with per-week session dots and
two quiet insight lines. Tier 3 — Next session card, Record book (all-time PRs
via `db/insights.ts getAllTimePRs`, "Full record book · Recore Pro" affordance
past 8 rows), Training log (recent sessions via `getRecentSessions`). Empty
state offers the CSV import. **/settings**: goal + smallest plate (editable,
feeds `roundToPlate`), CSV import AND export (`lib/export-csv.ts` — export is
free forever, never hostage), Recore Pro row, sign out. **/paywall** (UI built
2026-07-17; billing still stubbed): Hevy-lane pricing — $3.99/mo · $29.99/yr
default with BEST VALUE pill · $79.99 lifetime — a "What Pro is" list, a "Free
forever" Bill of Rights, honest beta CTA. No volt on this screen: the accent
belongs to the AI, not marketing.

---

## 10. First run & onboarding (BUILT — `app/onboarding/index.tsx`)

Sign-in is the front door (promise line + the self-typing SignInDemo — value
before the auth ask). After first sign-in, Home redirects once to a 5-step
flow (flag in local meta via `lib/prefs.ts`; re-runs per account). Each step
has ONE psychological job on the way to a paying user:

0. **WHY** — convince them logging matters at all: "Progress is doing a
   little more than last time. / But nobody remembers last time." + the
   two-paths bar visual (guessing flat vs knowing climbing) + one evidence
   line (self-monitoring is the best-proven training habit — 19k-participant
   meta-analysis backs it; never cite studies in-app).
1. **GOAL** (strength/muscle/both) — Duolingo's goal-first micro-commitment;
   each answer returns a payoff line carrying the why.
2. **HOW DO YOU LOG TODAY** — the segmentation move: memory / paper-Notes /
   Hevy-Strong each get the differentiator that beats THEIR alternative, and
   the Hevy/Strong branch offers **CSV import right here**
   (`lib/import/pick.ts`, shared with /settings) — the endowment moment; on
   success `recachePredictionFromLatest` makes the step-4 ghost REAL.
3. **SMALLEST PLATE** — stored via prefs and actually wired into
   `roundToPlate` (predict/data.ts), proving the questions weren't theater.
4. **THE GHOST** — the moat demo: their real next session when history
   exists (labeled YOUR NEXT SESSION) or a clearly-labeled EXAMPLE; one quiet
   seed line "The predictor is part of Recore Pro." → Start logging → Home.

Rules that hold: every question skippable (Continue always works), aha < 60 s,
no permission prompts (mic asks when mic is tapped), no prices/timers/tricks —
the real paywall arrives with billing (§11), contextually, after the ghost has
been right a few times (adherence data feeds the "zadela 3/3" prompt).

---

## 11. Growth surfaces (quiet, on-brand, later unless noted)

- **Share card (build after §7 gaps):** after a PR session, offer ONE tap to
  export a monochrome image — the note in SF Pro, parsed table in mono, PR
  line, small Recore mark. No confetti, no gradients. Serious lifters share
  numbers, not badges. This is the organic-growth artifact.
- **Streak**: bare number in the top bar (built). Never guilt copy.
- **Import** (built) is a growth feature, not a settings feature — surface it
  in onboarding (§10).
- Widgets / Apple Watch / live activities: valuable, dev-build territory,
  after the paywall. Do not start without the human.
- Paywall shape (when the human says go): logging + parsing stay generous/free
  (rate-limited as today) — the free tier is the growth engine (Hevy proved
  it). Pro = the predictor's depth: split-aware ghosts, insights, share cards,
  unlimited history. Never paywall the user's own raw data or export.

---

## 12. Project structure

```
src/app/            _layout (auth guard) · index (HOME) · sign-in · stats ·
                    settings · onboarding/ (stub) · paywall (stub)
src/components/     note-surface · gutter-value · ghost-prediction ·
                    exercise-sheet · calendar-sheet · top-bar · bottom-toolbar
src/lib/db/         SQLite source of truth (schema mirrors Postgres)
src/lib/parse/      edge-fn client · anchor · apply · estimate · types
src/lib/predict/    engine (pure, tested) · data (SQLite plumbing) · explain
src/lib/sync/       background push/pull
src/lib/import/     Hevy/Strong CSV
src/lib/theme/      color · type (moderateScale tokens) · spacing · scale
supabase/functions/ parse-workout (prompt.ts = shared source of truth) ·
                    explain-prediction
supabase/migrations/  schema + RLS   supabase/tests/  RLS verification + seed
```

---

## 13. Build next (in this order; 1–3 + 5 shipped 2026-07-16)

1. ~~Predictor Gap 1 — ghost survives rest days~~ DONE.
2. ~~Parser correction loop v1~~ DONE.
3. ~~Predictor Gap 2 — zero-config split matching~~ DONE.
4. ~~Onboarding v1~~ DONE (§10; receipt mode §9 also shipped).
5. ~~Adherence instrumentation~~ DONE (surfacing the counters in /stats still
   open).
6. **Share card** (§11) — the session receipt is the ready-made visual seed.
7. Effort-creep deload + eval set expansion (§6.3, §7.3).
8. Adherence counters in /stats + the contextual "zadela 3/3" Pro prompt
   (§10) — pre-paywall groundwork.
9. Paywall — only when the human says go (RevenueCat; 30-day trial per the
   research: 17–32-day trials convert ~46% vs ~27% for short ones).

Backend note: the new tables/columns need `supabase db push` (migration
`20260716130000_correction_loop.sql`) — until then the app works fully local;
sync of corrections/overrides simply retries.

---

## 14. Interaction rules

- Transitions: native push, 250–300 ms, `Easing.out(Easing.cubic)`. Nothing
  bouncy except the single PR-flag overshoot.
- Haptic (`impactAsync(Light)`) on every tap.
- The AI never speaks first unless it has a number. No chat bubbles, ever. If
  it has nothing useful to say, it says NOTHING.
- Rich animation lives in onboarding only; the main app is silent and fast.
- Respect `reduceMotion`: skip the parse sweep, show structure instantly.
- Every feature passes the §1 product filter before it's built.
