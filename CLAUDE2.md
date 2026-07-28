# CLAUDE2.md — Recore, as it actually is

**Written 28 July 2026 · A description of the code in this repository, not a plan for it.**

This document replaces `CLAUDE.md` v3. The difference matters: **v3 described an app that was
built once and then rejected by the owner on 27 July 2026 and rolled back.** Everything below
was read out of the working tree on 28 July 2026 and can be checked against a file path. Where
this document and the code disagree, **the code wins and this document is stale** — the opposite
of the rule v3 used.

Read §0 and §1 before touching anything. Read the section for whatever you are about to change.

---

## 0. Working rules

**Verify before you assert.** Every claim here names a file. If you are about to say "the app
does X", open the file and check. This project has a history of documents describing intentions
as if they were code; that is what made v3 dangerous.

**The three gates, before any change is called done:**

```bash
npm run typecheck        # tsc --noEmit, strict
npm test                 # node --test, 64 assertions across 7 files
npm run lint             # expo lint (eslint 9 + eslint-config-expo)
npx expo export --platform ios   # the bundle must build
```

No simulator is available in an agent session. `expo export` is the substitute for running it:
it catches route-tree breakage, bad imports, and anything Metro cannot resolve. It does not
catch layout or motion problems — say so plainly instead of claiming a change was "verified on
device".

**Never widen scope on your own.** The owner rejected an entire day of work on 27 July because
a redesign went further than asked. If a request implies a change to the visual language, ask.

**Language.** Code, comments, and documents are English. The owner writes Slovenian; answer in
Slovenian, commit in Slovenian if the existing log is (it is).

**Secrets.** The owner never pastes API keys into a chat. Ship commands that read from the local
`.env`.

---

## 1. What Recore is

A training log you **write in**. You open it, type what you did in your own words, in any
language, and the app turns it into structure:

```
bench 3x8 80kg
počepi 5x5 100
5k easy 26min
dips 2x16 1x15
```

There is no exercise picker, no routine builder, no plus button, no chat. The page and the
keyboard are the product. Three systems carry the whole thing:

| System | Where | What it does |
|---|---|---|
| **The composer** | `src/components/note-surface.tsx` | You type one line, press return, it settles into a card |
| **The parser** | `supabase/functions/parse-workout/` + `src/lib/parse/` | Free text → items and sets, any language |
| **The predictor** | `src/lib/predict/` | Deterministic next-session loads, from the user's own history |

Everything else in the app serves one of those three.

### 1.1 The invariants

These are load-bearing. Breaking one is a bug even if nothing crashes.

1. **`raw_text` is the source of truth.** Structure (`items`/`sets`) is a projection that gets
   rebuilt wholesale on every parse (`src/lib/parse/apply.ts`). The user's words are never
   rewritten, tidied, or discarded.
2. **Nothing blocks on the network.** A keystroke writes to SQLite in the same tick
   (`saveRawText`, synchronous `expo-sqlite`). Parsing and syncing are allowed to be late and
   never allowed to be in the way. The app is fully usable offline.
3. **Code computes the number; the model only phrases the reason.**
   `src/lib/predict/engine.ts` has zero imports and zero I/O. A language model never picks a
   weight (`explain-prediction` may only rewrite an already-computed template sentence).
4. **The AI key never leaves the server.** It exists only as a Supabase secret read inside the
   edge function. Nothing under `src/` references it. Client env is
   `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` and nothing else
   (`src/lib/env.ts`).
5. **Warm-ups, drops and `'skipped'` sets are excluded from every count**, everywhere, without
   exception (`src/lib/parse/summarize.ts`, the `skipped()` predicate; every SQL aggregate
   repeats the same exclusion list).
6. **Silence over noise.** A line the parser cannot read gets no error, no red underline, no
   toast. It stays in the note as prose. When the app has nothing true to say, it says nothing.
7. **No colour literals and no font-size literals outside `src/lib/theme/`.**

---

## 2. Status — what is real and what is not

Honest inventory, because the last document was not.

**Real, end to end:**
- Local-first SQLite mirror of the Postgres schema, with migrations, per-account scoping and
  background sync.
- The parser: edge function, JWT + rate limiting + injection hardening, prompt v5, client
  validation, line re-anchoring, correction overlay, per-user vocabulary in the prompt suffix.
- The correction loop: long-press → fix sheet → correction row → alias override → the fix
  survives every future re-parse.
- The predictor: double progression with RIR, plate rounding, zero-config split matching,
  adherence settlement, cached one-line reasons.
- The composer: card-per-line projection, live read-out, "same as last" prefill, done-toggle,
  inline edit, delete.
- The four-tab shell (§4), Progress, Lifts, You.
- Apple + Google sign-in (PKCE, Keychain-backed sessions).
- Hevy/Strong CSV import; CSV export; PNG share of a session receipt and a weekly recap.
- On-device dictation (dev build only).
- The weekly split (`plan_days`), authored by writing, resolved by rotation or weekday.

**Real UI, stubbed behaviour:**
- **Paywall** (`src/app/paywall.tsx`) — real screen, real prices, **no billing**. RevenueCat is
  not installed. Nothing is charged, no entitlement is checked.
- **Lapsed / read-only state** (`src/components/read-only-ledger.tsx`) — a finished surface with
  no route and no state that reaches it, waiting on entitlements.

**Not built at all:**
- Notifications of any kind.
- Live Activity / Dynamic Island for the rest timer (the timer itself is in-app only).
- Delete-account, JSON export, per-exercise settings.
- Anything the You screen answers with an "arrives with …" alert.

**Dev-only:** `src/lib/auth/dev-bypass.ts` skips the paywall **screen** on a fixed local user id
with sync off. It is `__DEV__`-gated end to end and compiles out of release bundles. It is not a
purchase stub and must never become one.

---

## 3. Stack, structure, commands

Expo SDK **54** — pinned. `AGENTS.md` says it and means it: read
https://docs.expo.dev/versions/v54.0.0/ before using any Expo API, and do not reach for SDK 55+.

| | |
|---|---|
| Runtime | React Native 0.81.5, React 19.1.0, new architecture |
| Router | `expo-router` 6.0.24, typed routes on, `(tabs)` group |
| Animation | `react-native-reanimated` 4.1.1 + `react-native-worklets` 0.5.1 |
| State | `zustand` 5 — one store, `src/state/session-store.ts` |
| DB | `expo-sqlite` 16 (synchronous API only) |
| Backend | `@supabase/supabase-js` 2 — Postgres, Auth, Edge Functions |
| Charts | `react-native-svg` 15.12.1, hand-drawn — no chart library |
| Icons | `@expo/vector-icons` (Ionicons + one MCI glyph) — **no `expo-symbols` usage** |
| Fonts | System only. **No custom font is loaded** — SF Pro + platform mono |
| Share | `react-native-view-shot` 4 + `expo-sharing` |
| TS | 6.0.3, `strict`, `@/*` → `./src/*` |

`app.json`: scheme `recore`, `userInterfaceStyle: "light"`, bundle id `com.recore.app`,
`usesAppleSignIn`, plugins for router / splash / sqlite / secure-store / apple-auth /
speech-recognition, experiments `typedRoutes` + `reactCompiler`.

`ios/` exists (a `npx expo run:ios` prebuild) and is gitignored. **A dev build is required** for
Apple sign-in, Keychain entitlements and dictation; Expo Go degrades those paths to no-ops
rather than crashing (`src/lib/voice.ts` probes with `requireOptionalNativeModule`).

```
src/app/          _layout · index (dispatcher) · (tabs)/{_layout,today,lifts,progress,you}
                  onboarding/index · paywall · sign-in · split · plan-day
src/components/   28 files — composer, cards, sheets, charts, motion kit, primitives
src/lib/db/       SQLite: schema, queries, per-domain modules
src/lib/parse/    client · types · anchor · apply · overlay · correct · receipt · summarize
src/lib/predict/  engine · split · data · cache · adherence · explain
src/lib/plan/     resolve · prescribe (both pure, both tested)
src/lib/sync/     push/pull
src/lib/theme/    color · type · spacing · scale · elevation (+ index barrel)
src/lib/auth/     provider · sign-in · dev-bypass
src/lib/import/   csv · formats · apply · pick
src/state/        session-store.ts
supabase/         migrations · functions/{parse-workout,explain-prediction} · tests
scripts/          parse-eval.ts + parse-eval-cases.json (72 cases)
```

Scripts: `start`, `ios`, `android`, `web`, `typecheck`, `lint`, `test`, `eval`,
`reset-project`.

---

## 4. Navigation

Two levels, and the split between them is deliberate.

**Root stack** (`src/app/_layout.tsx`) — `headerShown: false` everywhere, canvas painted
`color.bg`:

```
index              the funnel DISPATCHER, signed-out reachable
onboarding/index   ┐ pre-account funnel, outside the auth guard
paywall            ┘
(tabs)             ┐
split              ├ Stack.Protected, guard = session !== null || devBypass
plan-day           ┘
sign-in            Stack.Protected, guard = session === null
```

`ExerciseSheet` is mounted **once**, as a sibling of the `<Stack>`, because both Today and Lifts
open it and it is a full-screen RN `Modal` — two mounted copies stack two scrims.

**The dispatcher** (`src/app/index.tsx`) is a pure redirect:
onboarding not done → `/onboarding`; onboarded but no session → `/paywall`; otherwise →
`/today`. It reads `isOnboardingDone()` fresh on every render (a cheap synchronous KV read);
memoizing it would strand the user on a stale value right after onboarding completes.

**The tab bar** (`src/app/(tabs)/_layout.tsx`) is `NativeTabs` from
`expo-router/unstable-native-tabs` — a real `UITabBarController`, so on iOS 26 it is the system
floating Liquid Glass bar with correct scroll-edge, contrast and Reduce-Transparency behaviour,
and Material 3 on Android. Four triggers, SF Symbols via `sf`, **no tint set** (glass recolours
itself against whatever is behind it and offers no callback, so a fixed hex goes illegible over
some content):

| Route | Symbol | Question it answers |
|---|---|---|
| `today` | `square.and.pencil` | "What am I doing right now?" |
| `lifts` | `list.bullet` | "How is my bench going?" |
| `progress` | `chart.xyaxis.line` | "Am I actually improving?" |
| `you` | `person` / `person.fill` | "Change something." |

Today is `today.tsx`, not `index.tsx`: `app/index.tsx` and `app/(tabs)/index.tsx` would both
resolve to `/` and collide, and `/today` is the deep-link target anyway.

**`TAB_BAR_CLEARANCE = 56`** (`src/lib/theme/spacing.ts`) is not decoration. `SafeAreaProvider`
lives at the app root, so `useSafeAreaInsets()` reports the *window's* insets — the floating bar
UIKit draws over a tab screen is invisible to it. Anything pinned to the bottom (the summary
pill, Finish) or scrolled to the bottom must add this by hand or it lands under the bar and
cannot be pressed. Content still scrolls *behind* the bar; never inset a scroll view to "clear"
it.

Sheets are the modal layer (`BottomSheet`); pushes (`split`, `plan-day`) are for things with
their own identity.

---

## 5. The visual system, as implemented

**Light only.** `userInterfaceStyle: "light"`, `<StatusBar style="dark" />`, one palette. There
is no `useColorScheme`, no theme hook, no `makeStyles` — components import `color` directly and
spread `type` tokens into `StyleSheet.create`.

### 5.1 Colour — `src/lib/theme/color.ts`

Warm paper, monochrome ink, exactly one hue with exactly one meaning.

```
bg           #F4F5EF   warm paper canvas
surface      #FBFCF6   raised paper: cards, sheets, chips, pills, accessory bar
surfaceHigh  #E9EAE2   recessed: segmented tracks, hairline fills, pressed states
accent       #171914   ink: primary CTA fill, emphasised borders (== textPrimary)
accentPressed#2C2F27   ink-fill pressed — never an opacity flash
signal       #547C00   PLANNED green — future prescription VALUES only
textPrimary  #171914   what the user typed; headings
textSecondary#687064   supporting copy, gutter readings, tags
textMuted    #9AA093   dates, evidence lines, placeholders, disabled
border       #D4D7CC   1px card + control hairline
divider      #E9EAE2   row dividers inside cards
tableRule    #E9EAE2   hairline rules between table/receipt rows
warning      #8A5613   amber CHECK chips, offline banners
warningBorder#D8BE86
error        #A33D36   failures + destructive only
```

Note the light elevation model: `surface` is *brighter* than `bg` (raised) and `surfaceHigh` is
*darker* (recessed). That inverts the usual dark-theme intuition.

**The green rule is the whole identity.** `signal` appears on a future prescription value and
nowhere else — not on a PR, not on a positive delta, not on a chart, not on a button, not in
onboarding or the paywall. `plan-strip.tsx` and `ghost-prediction.tsx` are the only files that
should ever read it. A PR is a **neutral outlined mono label**. A delta is a **muted word**
("up 2.5 kg vs last", "same as last") — never a bare `+`/`−` and never a colour, because a
leading minus on a deload day reads as a scold.

`ink` is an opacity ladder in the same file (`echo .55`, `value .7`, `delta .8`, `disabled .4`,
`grabber .18`, `rule .28`, `wash .14`, …) applied through `alpha(hex, n)`.

### 5.2 The record contract

Four states, visually distinct on every surface:

| State | Treatment |
|---|---|
| **WRITTEN** | The user's words. Text face, `textPrimary`, never truncated, never rewritten |
| **INTERPRETED** | The machine's reading. Mono, `textSecondary`, right-aligned. **Never a checkmark** — a checkmark asserts correctness, a reading is a claim |
| **RECORDED** | Settled fact. Mono, full ink for the value, `textMuted` for its comparison |
| **PLANNED** | A number not yet lifted. Mono, `signal` green, always with a reason available |

### 5.3 Type — `src/lib/theme/type.ts`

Two faces: **SF Pro** (system, `fontFamily: undefined`) for words, and the **platform mono**
(`ui-monospace` on iOS) for numbers and the eyebrow label. No font is bundled.

Every size runs through `moderateScale` (`src/lib/theme/scale.ts`): baseline 390pt logical
width, damping factor 0.5, snapped to the pixel grid. **Never hardcode a font size** — add a
token instead.

Tokens: `displayLarge 44 · display 38 · largeTitle 34 · title 27 · title2 22 · headline 17 ·
body 16 · subhead 15 · caption 13 · footnote 11.5 · bigNumber 44 · statNumber 32 ·
heroNumber 48`, plus `monoText` (tabular-nums, 15) and `eyebrow` (mono, 11, tracking 1.6,
callers uppercase the string).

**Dynamic Type is clamped to `MAX_FONT_SCALE = 1.3`** and every scalable `<Text>` must pass
`maxFontSizeMultiplier={MAX_FONT_SCALE}`. Consequence: a container with a fixed `height:` will
crop its own label at large sizes. Use `minHeight`.

### 5.4 Space, shape, elevation

`spacing` 4/8/12/16/20/24/32/48/64 (`xs`…`giant`). `radius` sm10 · md14 · lg18 · xl22 · xxl28 ·
pill999. `hairline` = `StyleSheet.hairlineWidth`. `HIT` = 44 (minimum tap target, always).
`CONTROL_HEIGHT` = scaled 50. `ROUND_BUTTON` = scaled 40.

Two shadows only (`src/lib/theme/elevation.ts`), cast in the ink's own warm near-black
`#20221A`: `shadow.card` (0.05 / 12 / y4) for resting cards, `shadow.raised` (0.08 / 22 / y8)
for hero surfaces and the primary CTA. Android falls back to `elevation`. Everything small keeps
a 1px hairline instead.

### 5.5 Motion — `src/lib/motion.ts` + `src/components/motion.tsx`

One vocabulary, UI thread only, `reduceMotion`-aware everywhere.

```
DUR    fast 160 · base 240 · slow 380 · xslow 560
EASE   standard = out(cubic) · emphasized = bezier(.16,1,.3,1) · inOut
SPRING press {m .5, d 16, s 380} · snappy {.8,18,210} · soft {1,22,150}
SPRING_OVERSHOOT {m .6, d 9, s 220}   ← the ONLY bounce, reserved for the PR flag
stagger(i, step = 55, cap = 8)        ← capped so long lists never drag
```

The shared kit exports `PressableScale` (a spring dip on every tappable), `FadeSlideIn` (the one
reveal), `Stagger`, `ProgressBar`, `AnimatedCount`. Use them; do not hand-roll an alternative.

The named moment is **the parse sweep**: when a result lands, gutter values settle top to
bottom, each fading in and sliding 4px from the right, so the analysis visibly walks down the
page (`gutter-value.tsx`, keyed by `order` and `revision`; a new revision replays it).

Under Reduce Motion, everything resolves instantly to its final state. Reduce Motion must remove
movement, never information.

### 5.6 Haptics — `src/lib/haptics.ts`

Three, and only three: `tap()` (Light) on a tap, `tapMedium()` (Medium) on a committed action,
`success()` (notification Success) when the rest timer finishes. Never on scroll, never on
keystroke, never on screen appear.

---

## 6. The composer — `src/components/note-surface.tsx`

The screen that has to be perfect, because it is most of the time spent in the app.

**How writing works.** One exercise at a time. You type a line in the single `TextInput` at the
bottom, press return, and the line settles upward into a **card**; the input clears for the
next. `note` remains the full newline-joined log — the cards are a live projection of the parse
over `raw_text`, never a replacement for it. One line carrying several exercises produces a card
each.

**What sits under the active line while you type**, in priority order:
1. **The live read-out** — the parse of the line you are typing, before you commit it
   ("Bench Press · 80 kg × 8·8·8", then "return to add").
2. **"Same as last"** (`getLastSessionPrefill`) — the moment the line *names* a known exercise
   with no digits yet, last session's real sets appear dimmed. Tap or return accepts them
   verbatim, appended as a re-parseable suffix (`80x8 80x8 80x8`). This is a **record read, never
   a prediction** — it is silent when the shorthand does not resolve or there is no history.
3. **`reading…`** — three breathing dots while a parse is in flight.

**Card gestures:** tap the check circle → done ↔ not done; tap the name → inline edit of that
physical line; long-press → the lift's history sheet. Swipe/`Delete` lives in the inline editor.

**The done toggle** (`src/lib/db/done-state.ts`) stores only the *exceptions* — cards are done by
default. Un-checking one rewrites its sets with kind `'skipped'` on the next projection
(`reapplyDoneState`), so the pill, the receipt, `/progress` and the PR ledger all agree
instantly and the record still keeps the line.

**The alias echo.** When the parser resolves a line to a name the user did not type
(`tricpes` → `Triceps Pushdown`), the original word is echoed beside the card. An invisible
auto-fix is indistinguishable from a wrong guess and destroys trust the first time it is
noticed.

**The empty page is never a void** (`empty-note-cards.tsx`): with history, a one-tap peek at the
last session; on a blank account, a self-typing demo that performs the parse before the user
types anything.

**Around the composer**, on `(tabs)/today.tsx`:
- `TopBar` — wordmark, centred day pill (opens `CalendarSheet`), bare mono streak (opens
  `StreakSheet`), settings avatar.
- `InsightHeader` — one quiet ledger line ("this week · 12,300 kg · 3 sessions"); hidden while
  the keyboard is up, absent with no history.
- `PlanStrip` — today's declared split day as a **read-only** reference: movement name plus the
  engine's progressed load in green. A row dims when the parse recognises it in the note. It
  cannot insert, check off, or count anything. "Planned into actual" is the boundary that never
  bends.
- `BottomToolbar` — the accessory bar above the keyboard: rest-timer chip, mic chip, a mono
  status line ("4 staged · 3,240 kg", tapping through to Progress), and the **Finish session**
  pill (disabled at 40% until something is staged). The teaching tail ("— they count when you
  finish") retires permanently after the first finish.
- `SummaryPill` — at rest, a single mono pill with the day's counted sets and tonnage, reading
  the same settled receipt the ledger draws from. Volume gives way to distance on a pure cardio
  day. Tapping it opens `SessionSummarySheet`.

**Receipt mode.** When a whole session is typed at once — ≥ 4 distinct exercises parsed from a
note that was empty less than 60 s earlier — the per-line gutter is replaced by one
`SessionReceipt` summary under the note. It is sticky per workout in the meta KV. Accepting a
plan or checking off a plan row explicitly does *not* trip it: that is live logging.

**The rest timer** lives in the toolbar chip: tap to start (chip becomes a live mono
`rest 2:41`), tap to stop, long-press to cycle 1:00 / 1:30 / 2:00 / 3:00 (`REST_OPTIONS_S`,
default 120 s). The last ten seconds firm up; the end is a success haptic. In-app only — there
is no notification and no Live Activity.

---

## 7. The parser

### 7.1 The pipeline

1. Keystroke → `saveRawText` → SQLite, same tick, `dirty = 1`, `needs_parse = 1`.
2. `PARSE_DEBOUNCE_MS = 900` after typing stops → `parseWorkout`.
3. `parse_cache` hit on identical text **and** `parse_version >= CLIENT_PARSE_VERSION` → served
   locally, no network. (Keying on text alone would make a freshly deployed prompt invisible to
   text the user already typed.)
4. Otherwise `supabase.functions.invoke('parse-workout')` with the note capped at 4000 chars.
5. `validateParseResult` re-validates and clamps the response client-side — the server already
   validated, and the client does not trust it anyway.
6. `reanchorLines` pins each item to a line whose text actually mentions it. The model's line
   index is a hint, never a fact.
7. `applyParseResult`: overlay stored corrections → resolve `exercise_id` → rebuild
   `items`/`sets` wholesale in one transaction → compute gutter signals → write `parse_cache`.
8. `settlePredictionOutcome` (adherence) then `recachePrediction` (next session), both
   best-effort and both unable to break the parse.

**Failure is silent and retried:** `3 s / 8 s / 20 s` in the foreground while the reading dots
stay on, then `needs_parse = 1` hands it to the sync loop. A parse that lands via sync reaches
the open screen through `setParseListener` — without that, SQLite would update while the gutter
stayed stale until a restart.

### 7.2 The prompt

`supabase/functions/parse-workout/prompt.ts` is the single source of truth, shared by the edge
function (Deno) and the eval harness (Node) — so it must stay free of runtime imports.

**`PARSE_VERSION = 5`, and `CLIENT_PARSE_VERSION` in `src/lib/parse/types.ts` must be bumped in
lockstep.**

It is a long static system prompt (under one `cache_control` breakpoint) plus 39 worked
examples, covering: unit-decides-the-weight in any position, decimal commas, plate-number
pound detection, bodyweight and `bw+20`, the empty bar, per-side loads, the `NxM` / `WxRxS` /
chained-`NxM` / repeated-`WxR`-pair rules (including pyramids where weight *and* reps both
change), rep lists, spelled-out numbers for dictation, RPE→RIR, warm-up/drop/myo/AMRAP/failure
kinds, supersets and `A1/A2` pairing, rounds circuits, intervals, cardio/carry/hold with
distance and `M:SS` times, what is *not* a set (prose, dates, headers, rest, tempo), and a
canonical English name map with Slovenian/German/Spanish anchors.

Two rules in there exist because of real bugs and must not be softened: **chained `NxM` blocks**
(`dips 2x16 1x15` → 16, 16, 15) and **per-set `WxR` pairs keeping their own weight *and* reps**
(`bench 100x8 90x10 80x12`). Before blaming the prompt for a "wrong parse" of multi-set lines,
check `setsLineText` in `src/lib/parse/summarize.ts` — a display collapse there produced exactly
that symptom once already.

### 7.3 Security posture of the edge function

Do not weaken any of this.

- JWT verified twice: `verify_jwt` in `config.toml` **and** an explicit `auth.getUser()`. The
  identity comes from the token; a `user_id` in the body is never read.
- Per-user sliding-window rate limit (**30 calls / 10 min**) via the `bump_parse_rate` RPC called
  with the service-role key. `parse_rate_limits` has RLS on and **zero policies** — unreachable
  from any client.
- Input: non-empty string, ≤ 4000 chars, ≤ 100 lines.
- The note is wrapped in `<workout_log>` and the prompt states that its content is data, never
  instruction. Structured output constrains the response shape, so embedded instructions cannot
  change what the function returns.
- Model output is clamped server-side before it is returned.
- **`raw_text` is never logged**, never included in an error, never sent to analytics.
- Model: `claude-haiku-4-5` by default, `PARSE_MODEL` secret overrides. `effort` is only sent to
  non-Haiku models — Haiku 400s on it.

### 7.4 Personal vocabulary

After the cached prefix, the function appends a `<user_vocabulary>` block built server-side from
the user's own data: up to 40 alias overrides (`bp = Bench Press`) and up to 30 canonical names
from their last 15 sessions. It is data, and it may only bias which canonical name a shorthand
resolves to. Best-effort — any failure parses without it.

### 7.5 The correction loop

The flywheel, and the reason the parser feels personal by week two.

Long-press a card → `FixSheet` → `applyCorrection` (`src/lib/parse/correct.ts`) makes the fix
real three times over:
1. **Now** — the workout's structure is rebuilt with the corrected item.
2. **Forever on this note** — a `corrections` row re-applies on every future re-parse of the
   same line text (`overlayCorrections`, pure and tested: patches match on trimmed line text +
   the exercise the parser produced, follow the line if it moves, chain in creation order, and
   step aside once the parser starts agreeing).
3. **Forever everywhere** — if the exercise name changed, the typed shorthand becomes an
   `alias_overrides` row consulted *before* any other resolution, so it works for read-only
   global exercises too, and the mis-learned alias is scrubbed from the user's own rows.

`corrections` rows are append-only training data, pushed up and never pulled back.

### 7.6 The eval harness

```bash
npm run eval                                        # claude-haiku-4-5, reads .env
EVAL_MODEL=claude-opus-4-8 npm run eval             # compare Claude tiers
OPENAI_API_KEY=… EVAL_MODEL=gpt-4o npm run eval     # cross-provider A/B
```

`scripts/parse-eval.ts` runs the **deployed** prompt and schema against
`scripts/parse-eval-cases.json` (**72 cases** today) and reports pass rate, p50/p95 latency,
token usage and estimated cost per 1000 notes. Node's native TS type-stripping, no build step.

**The rule:** any prompt or schema change bumps `PARSE_VERSION`, adds the failing line as a new
case, and passes the eval before deploying. A change that fixes ten cases and breaks one is a
failure until the one is fixed. The eval needs a key, so it is run by the owner locally, not by
an agent.

---

## 8. The predictor

### 8.1 The engine — `src/lib/predict/engine.ts`

Pure, zero imports, unit-tested under plain `node --test`. Double progression with RIR, in
priority order:

1. Two sessions stuck at the same top weight with no rep progress → **deload −10%**.
2. Every working set filled the top of the range → **add `increment_kg`**, reps back to the
   bottom.
3. RIR ≥ 2 extracted from the user's own words → **add weight now**.
4. Below the bottom of the range → **hold the weight**.
5. In range → **same weight, chase one more rep**.

The rep range is inferred from what the athlete actually did (`top = max reps today`,
`bottom = top − 2`), falling back to 6–8. Bodyweight work progresses reps first
(`progressBodyweight`). Cardio, carries and holds repeat the last prescription — we do not
invent running programmes. Every load passes `roundToPlate(kg, smallestPlate)`, which steps by
`2 × smallest plate` because plates load in pairs, so 83.75 is never suggested.

### 8.2 Which session — `src/lib/predict/split.ts`

Zero-config, pure, tested. Cluster the last ≤ 10 sessions by Jaccard similarity of their
exercise sets (≥ 0.5 against the cluster's *most recent* member, so a programme can drift
without breaking its label), read the labels as a rotation, and progress the most recent session
of the cluster that historically **follows** the one just finished — unique successor, or a
dominant one with ≥ 2 observations. Anything thin or ambiguous returns `null` and the caller
progresses the latest session. **We never ask the user to define their split.**

### 8.3 Phrasing and trust

`src/lib/predict/data.ts` assembles history, runs the engine, and produces **one** template
sentence over the engine's own facts — and only when there is a real reason (`deload` >
`rir_surplus` > `top_of_range` > `add_rep`; `hold` and `repeat` are worth no sentence). No
reason → no line. Never "keep it up".

`explain-prediction` (V2, fire-and-forget) may rewrite that sentence in the user's language,
quoting their words. It is validated as one plain string ≤ 200 chars with no newline, or
discarded. If it never answers, the template stays.

`GHOST_MAX_AGE_DAYS = 14`: a prediction is for the *next session*, whenever it happens — train
Monday, rest Tuesday, open Wednesday and the ghost is still there — but older than two weeks it
is silence, because a progression of a pre-layoff session prescribes weights the lifter may no
longer have.

**Adherence** (`src/lib/predict/adherence.ts`) settles after every parse of the day:
`followed` (the note matches the prescription, however they got there) / `edited` (accepted then
changed) / `ignored` (trained without touching it). `getAdherenceRecord` surfaces it as
"followed X of the last Y" — shown only with ≥ 3 settled outcomes and a majority followed. An
app that publishes its own hit rate makes a claim no competitor makes.

### 8.4 Where it appears

`ghost-prediction.tsx` — a bordered mono `PLANNED` tag, the standing disclaimer ("not training
until you lift it"), then rows of neutral exercise names with prescription values in green.
Each row keeps a check circle: tapping it writes that prescribed line into the note as real
text (`checkGhostLine`, idempotent) — `raw_text` stays the source of truth. Rows also check
themselves off when the parse recognises the exercise (`matchPlanIndex`: exact key wins, a
single unambiguous containment match otherwise, and **ambiguity checks nothing**). "Accept plan"
commits everything; "Skip this plan" dismisses without judgement.

---

## 9. The weekly split

Pre-plan, owner-designed 22 July. A `plan_days` row is one day-template ("Upper", "Push"),
**authored as free text and read by the same parser as a note** — so authoring reuses the
composer's resolver and `raw_text` stays the source of truth.

- `/split` — the ordered cycle, with a segmented control between **rotation** (the default: "do
  the next one when you train") and **weekday** (each day pinned via `weekday_mask`, bit 0 = Mon).
- `/plan-day` — author one day by writing movements, one per line. `findExerciseByName` is
  read-only here: naming a movement never creates an exercise row. Targets are optional; the
  engine supplies the loads.
- `resolveTodayPlanDay` **derives** the rotation cursor instead of storing one: the plan day
  whose movements best overlap the last logged session (Jaccard ≥ 0.3) is "where you are", so
  today is the next position. Nothing to drift, no Finish hook to miss, and a missed day slides
  the cycle rather than skipping a workout.
- `computePlanStrip` turns that into the read-only strip on Today, each row carrying
  `buildPlanRow`'s progressed value — the same numbers the predictor would say, from the same
  pure engine.

Deletes need tombstones (`plan_days_deleted` in the meta KV), because a hard-deleted row leaves
nothing to push and the next pull would resurrect it.

---

## 10. Data

### 10.1 Local — `src/lib/db/schema.ts`, `SCHEMA_VERSION = 3`

`meta` (KV) · `workouts` · `items` · `sets` · `exercises` · `predictions` · `plan_days` ·
`corrections` · `alias_overrides` · `parse_cache`.

Local-only columns that are never pushed: `dirty`, `structure_dirty`, `needs_parse`, plus the
`meta` and `parse_cache` tables entirely.

Invariants:
- **A superset is a shared `group_key`.** Two is a superset, ten is a circuit — no schema change.
- **A dropset/myo is a `parent_set_id` chain** onto the working set, arbitrary depth, never a
  new item.
- **A day is a local calendar day.** `performed_at` stores the UTC instant of *local noon*, and
  every day-scoped query uses `[local midnight, next local midnight)` (`src/lib/db/dates.ts`).
  Gyms do not train in UTC.
- `ensureLocalUser(userId)` wipes every cached row when a different account signs in on the
  device — the on-device mirror of the server-side RLS boundary.
- Migrations are stepped: explicit `ALTER`s for tables that already exist (`CREATE IF NOT
  EXISTS` never adds a column), then the full script.

### 10.2 Remote — `supabase/migrations/`

`profiles` · `workouts` · `items` · `sets` · `exercises` · `predictions` · `parse_rate_limits`
(init) + `corrections` · `alias_overrides` (correction loop) + `plan_days`.

**RLS is enabled on every table**, per-verb, `user_id = auth.uid()`. `items` and `sets` inherit
ownership through their parent workout via `EXISTS` subqueries, so a forged `workout_id` cannot
attach data to someone else's session. Global exercises (`user_id IS NULL`) are read-only to
clients. `supabase/tests/rls-verification.sql` simulates two users, asserts B sees zero of A's
rows in every table, and rolls back.

Migrations are additive only. Never rewrite a deployed table.

### 10.3 Sync — `src/lib/sync/index.ts`

Fire-and-forget, debounced 4 s after local writes, plus a pass whenever the app foregrounds.
Order matters: pending parses → workouts (and their structure) → exercises → alias overrides →
corrections → predictions → plan days → pull. Overrides and corrections go after exercises and
workouts because their foreign keys must exist first; sets are ordered parents-before-children
because of the self-FK.

Conflict rule: **locally dirty rows win**; a pull skips them. Items and sets are a projection, so
a structure push deletes and replaces them wholesale for that workout. Failures are swallowed —
the dirty flags keep the work queued — and the whole engine is a no-op offline.

---

## 11. Auth and the funnel

`AuthProvider` restores the persisted session from the Keychain on launch (the splash is held
until it resolves), then on sign-in scopes the local DB to the account, hydrates the store from
SQLite, and starts sync.

Sessions live in the Keychain through a **chunked SecureStore adapter** (`secure-storage.ts`),
never AsyncStorage. PKCE flow, so an OAuth redirect carries a one-time code instead of tokens in
the URL. Apple and Google are the two providers; there is no email/password. Apple returns
name and email **only on the first authorization**, so they are written to `profiles`
immediately.

The funnel is deliberately account-last:

```
onboarding (9 steps) → paywall → sign-in → the app
```

`src/app/onboarding/index.tsx`, steps 0–8: welcome (a settling specimen) · optional name ·
training focus · current tracker · writing language · units + smallest bar increment ·
"how it works" (a live parse into a ledger) · an "analyzing" beat that reflects the answers ·
a personalised ready screen. Every answer persists to the meta KV immediately and a relaunch
resumes at `pref_ob_step`. The Hevy/Strong branch imports CSV inline and
`recachePredictionFromLatest` makes the ghost on the next screen **real** — their own next
session, before they have logged anything here.

---

## 12. Paywall and pricing — as built

`src/app/paywall.tsx`: **$59.99/year with a 7-day free trial** (annual, "BEST VALUE", with its
true per-month math) or **$8.99/month with no trial**. A transparent three-row trial timeline
(Today → Day 5 reminder → Day 7 charge) with the real first-charge date computed live. Close ×
and Restore are both visible without scrolling. **No colour on this screen** — the CTA is an ink
fill; green belongs to training numbers, not to selling.

The CTA hands off to sign-in, because the trial attaches to an account.

**The social proof on this screen is fabricated and must be removed or replaced before the App
Store.** `<Rating score={4.9} countLabel="loved by early lifters" />` and a named testimonial
("Marko · powerlifting") are hardcoded in both `paywall.tsx` and onboarding step 8, with nothing
marking them as placeholders. There are no real reviews yet. Invented proof on a live paywall is
dishonest, it is a review-rejection risk, and it contradicts §1's own voice rules. Until real
reviews exist, the proof is the demo the user already watched.

**Billing is not wired.** RevenueCat is not a dependency. Restore is a stub that says so. When
it is wired: one entitlement, checked at session start and cached, **never mid-set and never on
a write**; if entitlement cannot be verified, assume entitled and re-check later.

---

## 13. Import, export, share, voice

- **Import** — Hevy and Strong CSV, detected by header signature (`src/lib/import/formats.ts`),
  every field parsed defensively, lb→kg normalised, RPE→RIR. Structure lands directly (no parse
  call), `raw_text` is reconstructed in the app's own voice so the note reads naturally, and a
  day that already has a local note is **never overwritten**.
- **Export** — CSV over the local mirror (`date,exercise,kind,reps,weight_kg,rir`) shared via the
  system sheet. Free forever, including on a lapsed subscription. JSON export is not built.
- **Share** — `captureRef` on the receipt card or the weekly recap card → PNG → `expo-sharing`.
  A wordmark row is mounted only for the capture. Note that `Share.share({url})` is iOS-only,
  which is why `expo-sharing` is used.
- **Voice** — `expo-speech-recognition`, on-device, never a cloud transcription API. Interim
  results stream straight into the note, so dictated text goes through the same parser as typed
  text. The module only exists in a dev build; `requireOptionalNativeModule` probes for it so
  Expo Go degrades quietly instead of throwing.

---

## 14. Accessibility

- **44×44 minimum tap target**, always (`HIT`), including chips that look smaller.
- **`maxFontSizeMultiplier={MAX_FONT_SCALE}` on every scalable `<Text>`**, and `minHeight`
  rather than `height` on anything containing text.
- **Reduce Motion** is honoured by every component in the motion kit and by `BottomSheet`.
- The palette is already colourblind-safe: one hue, and it always co-occurs with a planned
  value's context. PR is a shape. Deltas are words.
- Rows that act are `accessibilityRole="button"` with a label that reads as a sentence.

---

## 15. Definition of done

**Every change:** typecheck, tests, lint, and `expo export --platform ios` all pass. No colour
literal, no font-size literal, no spacing literal outside `src/lib/theme/`. No `console.log` of
user text, ever (use `devLog`, which is `__DEV__`-gated).

**Every screen:** empty, loading, error and offline states designed. Under 400 ms shows nothing
— no spinner, no skeleton flash; most reads here are synchronous SQLite. Works at the clamped
Dynamic Type ceiling without cropping a number. Works with Reduce Motion.

**Every parser change:** `PARSE_VERSION` and `CLIENT_PARSE_VERSION` bumped together, new eval
cases added, `npm run eval` passing with zero regressions.

**Every release:** an airplane-mode session start to finish on a real device; a cold install
timed to "trial started".

---

## 16. Known gaps

Written down so nobody rediscovers them as bugs:

- **Fabricated social proof ships today** — a hardcoded 4.9 rating and invented named
  testimonials in `paywall.tsx` and onboarding step 8 (§12). This is the one item on this list
  that is not merely unfinished but actively wrong, and it blocks an App Store submission.
- Billing, entitlements, and any lapsed/read-only routing.
- Notifications; Live Activity for the rest timer.
- The You screen's Smallest plate / Default rest / Writing language / privacy page / exports /
  Terms / Privacy / Contact rows raise an honest "arrives with …" alert instead of pretending.
- Delete-account and JSON export.
- `TopBar` still carries a settings avatar that now duplicates the You tab.
- §5.2 of the old document wanted the tab bar hidden while the keyboard is up on Today; the
  installed `expo-router` exposes no API for it, and the keyboard covers the bar anyway.
- Comparison sublines say "vs last", not "vs 14 Jul" — the gutter signal carries no date.
- Android is undressed: the tab bar has no Android icons, and no Android pass has been done.

---

## 17. What Recore will never be

Each of these has been considered and rejected, and each rejection is what makes room for the
rest.

A social network (no feed, friends, leaderboards, challenges). A programme generator — we never
tell someone what to train, only what to beat. An exercise library — your vocabulary is the
library. A chat interface. A nutrition tracker. A gamified app (no XP, levels, badges, rings,
daily goals). A free app. And never a form as the primary input: free text is the fast path,
touch is the repair path. If the owner ever wants a picker-and-stepper flow as the main way in,
that is a legitimate call — but it is a different product, and this document should be rewritten
before it is built, not patched.

---

## Appendix A — what `CLAUDE.md` v3 contained, and why it is being retired

Recorded here so deleting it is a decision, not a loss.

**v3 (Version 3.0, 26 July 2026, ~2000 lines) described a redesign that was implemented on 27
July across five sessions and then rejected wholesale by the owner the same evening.** The repo
was restored to its 26 July state (commit `0903ba9`); the full v3 implementation is preserved at
commit `41120fa`. v3 documented, section by section:

§0 how to use the doc + a "one text field" ratification · §1 product thesis and the three
engines · §2 a competitive study of Setgraph and Lyfta · §3 success metrics (activation = 3
sessions in 7 days, ≥ 45% of trial starts) · §4 ten experience principles · §5 the four surfaces
and the native tab bar · §6 a **dark-first graphite-and-ember** visual system with both themes,
a confidence ladder, JetBrains Mono, and Liquid Glass rules · §7 a motion system with named
transitions and one exuberant PR moment · §8 the composer and a four-zone exercise card · §9 the
parser and its quality flywheel · §10 the Coach with targets living inside the card · §11
Progress / Lifts / You in detail · §12 the five states · §13 a sixteen-screen onboarding funnel ·
§14 a one-month trial with monthly-equivalent anchoring · §15 retention (weekly streaks, share
card, weekly review) · §16 three notifications · §17 accessibility · §18 data · §19 platform ·
§20 a component catalogue · §21 copy rules · §22 a fourteen-week build order · §23 definition of
done · §24 what Recore will never be.

**What survived the rollback and lives on in this document:** the thesis and the three engines
(§1 here), the record contract, the parser's rules and its flywheel, the predictor's iron law
and its trust rules, the data invariants, the security posture, the definition of done, the
copy discipline, and the "never" list.

**What v3 asked for that this codebase deliberately does not have:**

| v3 wanted | The code has | Why |
|---|---|---|
| Dark-first, both themes | Light only, warm paper | Owner ruling, 27 July |
| Ember `#FF6B3D` on PLANNED | Green `#547C00` on PLANNED | Same ruling |
| JetBrains Mono bundled | Platform mono, no bundled font | Same ruling |
| `useTheme()` / `makeStyles` | Direct `color` + `type` imports | Same ruling |
| A four-zone `ExerciseCard`, `composer.tsx` | `note-surface.tsx` cards | Same ruling |
| `Sheet` with detents | `BottomSheet` | Same ruling |
| The plan/split feature deleted | `split` + `plan-day` are live | The deletion was part of the rolled-back day |
| A one-month trial | 7-day trial | Owner ruled against one month |
| Streak counted in weeks | Streak counts consecutive days | Not rebuilt |
| 16 onboarding screens | 9 | Not rebuilt |
| Dynamic Type to `accessibilityLarge` (1.94) | Clamped to 1.3 | v2's `scale.ts` is what is live |
| Notifications, Live Activity, RevenueCat | None of them | Never built |

**The one part of v3 the owner has since re-asked for, and which is now live:** §5.1–§5.2, the
four surfaces on a system `NativeTabs` bar. It was rebuilt on 28 July **on the v2 visual
system** — no ember, no dark theme, no bundled font. Only the navigation shell came across. If
anyone proposes implementing another v3 section, treat that as needing an explicit owner
decision, exactly as the tab bar did.

---

## Appendix B — files worth reading first

If you are new to this codebase, read these six in this order and you will understand 80% of it:

1. `src/state/session-store.ts` — the whole client data flow
2. `src/lib/parse/client.ts` + `src/lib/parse/apply.ts` — how text becomes structure
3. `src/lib/predict/engine.ts` — the only place a training decision is made
4. `src/components/note-surface.tsx` — the screen the product lives or dies on
5. `src/lib/theme/color.ts` — the design law in 30 lines
6. `supabase/functions/parse-workout/prompt.ts` — the moat
