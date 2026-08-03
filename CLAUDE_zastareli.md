# CLAUDE.md — Recore, as it actually is

**Version 4 · 28 July 2026 · Supersedes `CLAUDE2.md` and `CLAUDE.md` v3.**

This is a description of the code in this repository, not a plan for it. That distinction is
the whole reason this document exists: **v3 described an app that was built once, on 27 July
2026, and rejected by the owner the same evening and rolled back.** Everything below was read
out of the working tree and can be checked against a file path.

**Where this document and the code disagree, the code wins and this document is stale** — the
opposite of the rule v3 used. See §0.3 for what to do about it.

Read §0 and §1 before touching anything. Read the section for whatever you are about to change.

---

## 0. Working rules

**Verify before you assert.** Every claim here names a file. If you are about to say "the app
does X", open the file and check. This project has a history of documents describing intentions
as if they were code; that is what made v3 dangerous.

**The four gates, before any change is called done:**

```bash
npm run typecheck        # tsc --noEmit, strict
npm test                 # node --test 'src/**/*.test.ts' — 180 tests, 18 files today
npm run lint             # expo lint (eslint 9 + eslint-config-expo)
npx expo export --platform ios   # the bundle must build
npm run eval             # the DEPLOYED prompt against 72 cases — needs a key, OWNER-RUN
```

No simulator is available in an agent session. `expo export` is the substitute for running it:
it catches route-tree breakage, bad imports, and anything Metro cannot resolve. It does not
catch layout or motion problems — say so plainly instead of claiming a change was "verified on
device".

The test script is a **glob, not a list of files** (29 Jul). It was a hand-maintained list, and
`src/lib/progression.test.ts` — the fifteen tests behind the whole Progress tab (§16.5) — was
never added to it, so the gate had been passing without ever running them. A gate that can
silently omit a file is not a gate; do not turn it back into a list.

The fifth command is the one an agent cannot run: `npm run eval` reads a key from the local
`.env`. An agent that touches `prompt.ts`, the response schema, or `PARSE_VERSION` must say
plainly that the eval has not been run and that the change is **not done** until the owner runs
it. Never describe a parser change as verified.

**Never widen scope on your own.** The owner rejected an entire day of work on 27 July because
a redesign went further than asked. If a request implies a change to the visual language, ask.

**Language.** Code, comments, and documents are English. The owner writes Slovenian; answer in
Slovenian, commit in Slovenian if the existing log is (it is).

**Secrets.** The owner never pastes API keys into a chat. Ship commands that read from the local
`.env`.

### 0.1 Standing rulings — do not re-propose

These were decided by the owner, not defaulted into. An agent that proposes any of them again is
repeating 27 July. If you believe one is wrong, say so in one sentence and stop; do not build
the alternative.

| Ruling | Date | Where it lives |
|---|---|---|
| Light theme only, warm paper. No dark mode, no both-themes | 27 Jul | `src/lib/theme/color.ts`, `app.json` |
| `signal` `#547C00` on PLANNED values only. ~~No second hue, ever~~ → **28 Jul: `trained` `#007AFF` admitted as the second and last hue *that carries meaning*, day-trained marks only** | 27 Jul → 28 Jul | `color.ts`, §5.1 |
| ~~Data hues are closed at two.~~ → **29 Jul: `trend` `#BF5B23` admitted as the third — ONE lift's progression line and the wash under it, in the lift sheet only. The `glyph` palette is chrome and is still not one of them** — six tints, You's row glyphs + the lift sheet's stat/summary LABELS, never on a value, never green/blue/red | 28 Jul → 29 Jul | `color.ts`, `icon.tsx`, §5.1 |
| Platform mono. No bundled font | 27 Jul | `src/lib/theme/type.ts` |
| Direct `color` / `type` imports. No theme hook, no `makeStyles` | 27 Jul | every component |
| `note-surface.tsx` cards. No `ExerciseCard`, no `composer.tsx` rewrite | 27 Jul | §6 |
| `BottomSheet`. Not a detented `Sheet` | 27 Jul | `src/components/` |
| `split` + `plan-day` stay live. Their deletion was part of the rolled-back day | 27 Jul | §9 |
| Seven-day trial. Not one month, not fourteen days | 27–28 Jul | `src/app/paywall.tsx` |
| ~~Nine onboarding steps. Not sixteen~~ → **superseded 28 Jul by R5: fourteen screens, seven of which ask something** | 27 Jul → 28 Jul | §11.0 |
| A new onboarding screen must name the thing it changes, or it is not added | 28 Jul | §11.0 |
| Dynamic Type clamped to 1.3 | v2 | `src/lib/theme/scale.ts` |
| Free text is the primary input; touch is the repair path | standing | §20 |
| Four tabs on `NativeTabs`, no tint set | 28 Jul | `src/app/(tabs)/_layout.tsx` |
| The review ask is the SYSTEM sheet only. No custom rating dialog, no pre-flight "enjoying Recore?" | 28 Jul | §16.3 |
| Emoji allowed only in the narrow band of §5.7 | 28 Jul | onboarding only |
| The day-5 reminder is **built**, not deleted from the timeline | 28 Jul | §12.1 |
| Import is offered **after sign-in**. Onboarding only says it exists | 28 Jul | §11.1 |
| The streak counts **consecutive training days**; a rest day never breaks it | 28 Jul | §16.2 |
| The social-proof slot stays **empty** until a real App Store score exists. No badge, no count, no substitute | 28 Jul | §12.1 |
| The icon is ink on warm paper, **no green** — an icon is not a planned value | 28 Jul | `scripts/build-icon.py` |
| **No model ever authors a plan.** Every number is computed. A model may rewrite computed text: the ghost's one sentence (§8.3), and — ruled 29 Jul as Next's sanctioned exception — the composed briefing paragraph, number-whitelisted through `brief-guard.ts` with the composed paragraph as the permanent fallback (§8.5) | 28 Jul, amended 29 Jul | §8.5, §1.1 inv. 3, §20 |
| Four tabs: Today · **Next** · Progress · You. Lifts is a push | 28 Jul | §4 |
| Effort marking writes `rpe N` **into the note**, never into an overlay table | 28 Jul | §6, `src/lib/effort.ts` |

The tab bar is the precedent for how a v3 section comes back: the owner asked for it
explicitly, and it was rebuilt on the v2 visual system with nothing else attached. Any other v3
section needs the same explicit ask.

### 0.2 What you may change, and what needs a ruling

**Change without asking**

- A fix that restores an invariant this document already states.
- A new eval case in `scripts/parse-eval-cases.json`.
- A new query or module under `src/lib/db/`, `src/lib/parse/`, `src/lib/predict/` that adds no
  surface.
- Tests.
- Copy that fixes an error without changing what a screen claims.
- Anything listed in §18, when it is what was asked for.

**Ask first**

- Anything under `src/lib/theme/`.
- Any new dependency, without exception. The stack in §3 is the stack.
- Any new route or screen.
- Deleting or renaming any file named in Appendix B.
- A `PARSE_VERSION` bump — it requires the owner's eval run.
- The funnel order in §11.
- Anything that changes what the user sees on Today before they have typed.

When you must ask: name the ruling or section your change would cross, propose the smallest
in-bounds alternative, and stop. One paragraph, not a plan.

### 0.3 When this document and the code disagree

The code wins and this document is stale — **and you fix the document in the same change.** A
stale line here has a longer fuse than a stale comment, because the next agent will act on it
without opening the file. Leaving a known divergence in place is the failure that produced v3.

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

Honest inventory, because a previous document was not.

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
- Hevy/Strong CSV import; CSV **and JSON** export, written as a real file and handed out
  through the system sheet; PNG share of a session receipt and a weekly recap.
- On-device dictation (dev build only).
- The weekly split (`plan_days`), authored by writing, resolved by rotation or weekday.
- **Account deletion** — `src/lib/account/delete.ts` + the `delete-account` edge function.
  Immediate, and it deletes on the server first so a failure never leaves the user with no
  copy and a live account.
- **Terms of Use, the Privacy Policy and "How parsing works"** as real pages
  (`src/app/legal.tsx`, text in `src/lib/legal.ts`, hosted copies generated into `docs/`).
- **The lapsed read-only surface**, reached by the cached entitlement (§12.2).
- **Local funnel counters** (`src/lib/funnel.ts`) — meta KV, no SDK, carried in the export.
- **The App Store review prompt** — the system sheet, requested only after a finished session
  that earned it, gated by a pure tested rule (§16.3). **It will not appear in TestFlight**:
  `hasAction()` is false there, by Apple's design, and the gate correctly declines to spend an
  ask it cannot make. Verify the gate with `devLog`, not by waiting for a sheet.

**Real UI, stubbed behaviour:**
- **Paywall** (`src/app/paywall.tsx`) — real screen, real prices, **no billing**. RevenueCat is
  not installed, so `resolveEntitlement` has no store to ask and resolves to `entitled` (§12.2's
  own rule for an unverifiable entitlement). Nothing is charged.
- **The day-5 trial reminder** — built and tested (`src/lib/billing/trial.ts`,
  `src/components/trial-reminder-sheet.tsx`), and inert until something calls `startTrial`,
  which only billing can honestly do. The paywall's timeline row describes exactly this.

- **The day-5 trial notification** — `expo-notifications` (the second approved dependency),
  one local notification, permission asked only on the trial-start sheet. Like the in-app
  reminder it waits on `startTrial`.

**Not built at all:**
- Any notification other than the day-5 one — no renewal notice (§16.1), no training-day nudge.
- Live Activity / Dynamic Island for the rest timer (the timer itself is in-app only).
- Per-exercise settings.
- Restore purchases — the last "arrives with …" alert on the You screen, and the only one.

**Dev-only:** the paywall's `DEV · SKIP` chip (`__DEV__`-gated, compiled out of release
bundles) jumps the purchase screen and lands on **sign-in** — a dev goes through the same door
as a customer. The earlier no-account bypass (`dev-bypass.ts`, fixed local id, sync off) was
removed on 28 July: `parse-workout` requires a user JWT (§7.3), so under it nothing ever
parsed and Next/Progress stayed honestly empty. It is not a purchase stub and must never
become one.

### 2.1 What this has to earn

The app is nearly built, so scoping decisions are now revenue decisions and need a number to
push against.

| Quantity | Value |
|---|---|
| Annual price | $59.99 → $5.00 / month gross |
| Store commission | 15% under the Apple Small Business Program — enrol before launch, it is not automatic |
| Net per annual subscriber | ≈ $4.25 / month |
| Active subscribers for €3,000 / month | ≈ 780 |
| Active subscribers for €5,000 / month | ≈ 1,300 |
| Installs to reach 780 paid in year one, at ~10% install-to-paid | ≈ 7,500, or ~600 / month |
| Installs to hold 780 paid at 60% renewal | ≈ 3,000 / year, forever |

Pre-launch, every conversion rate above is a hypothesis. The one that is not a hypothesis is the
install count: six hundred a month is the requirement, and ASO plus a small Search Ads budget is
not obviously enough. That question — keyword volume for the terms Recore would rank on, and
what the one- and two-star reviews of the top three competitors complain about — is answerable
today and is cheaper to answer than to build against.

Instrument locally, in `meta`, never through a third-party SDK: onboarding step reached, paywall
shown, trial started, sessions logged in the first seven days, repair rate, adherence shown and
followed, and **whether the user imported**. Split every trial-window number by that last flag;
it is the most informative split in the first six months.

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
| Icons | `@expo/vector-icons` (Ionicons outline + two MCI keyboard glyphs) — **no `expo-symbols` usage** |
| Fonts | System only. **No custom font is loaded** — SF Pro + platform mono |
| Share | `react-native-view-shot` 4 + `expo-sharing` + `expo-file-system` |
| Glass | `expo-glass-effect` — the system Liquid Glass, behind `components/glass.tsx` |
| Notifications | `expo-notifications` — **local only**, one day-5 trial reminder. No push, no token |
| Review prompt | `expo-store-review` — the system sheet only, at most once per finished session that earned it (§16.3) |
| TS | 6.0.3, `strict`, `@/*` → `./src/*` |

`app.json`: scheme `recore`, `userInterfaceStyle: "light"`, bundle id `com.recore.app`,
`usesAppleSignIn`, plugins for router / splash / sqlite / secure-store / apple-auth /
speech-recognition, experiments `typedRoutes` + `reactCompiler`.

`ios/` exists (a `npx expo run:ios` prebuild) and is gitignored. **A dev build is required** for
Apple sign-in, Keychain entitlements and dictation; Expo Go degrades those paths to no-ops
rather than crashing (`src/lib/voice.ts` probes with `requireOptionalNativeModule`).

```
src/app/          _layout · index (dispatcher) · (tabs)/{_layout,today,next,progress,you}
                  onboarding/index · paywall · sign-in · split · plan-day · lifts · legal
src/components/   29 files — composer, cards, sheets, charts, motion kit, primitives
src/lib/db/       SQLite: schema, queries, per-domain modules
src/lib/parse/    client · types · anchor · apply · overlay · correct · receipt · summarize
src/lib/predict/  engine · split · data · cache · adherence · explain
src/lib/plan/     resolve · prescribe (both pure, both tested)
src/lib/billing/  pricing · trial (pure, tested) · state (the trial clock + entitlement) ·
                  notifications (the day-5 local notification)
src/lib/review/   gate (pure, tested — WHEN to ask) · index (the system sheet)
src/lib/          activity (pure, tested — the You screen's training-year grid) ·
                  progression (pure, tested — the Progress tab's per-lift series)
src/lib/account/  delete
src/lib/sync/     push/pull
src/lib/theme/    color · type · spacing · scale · elevation (+ index barrel)
src/lib/auth/     provider · sign-in
src/lib/import/   csv · formats · apply · pick
src/lib/          streak (pure, tested) · funnel · legal · export-csv · export-json ·
                  export-share · plates (pure, tested) · prefs · motion · haptics · voice
src/state/        session-store.ts
supabase/         migrations · functions/{parse-workout,explain-prediction,explain-brief,
                  delete-account} · tests
scripts/          parse-eval.ts + parse-eval-cases.json (72 cases) · build-legal-html.ts ·
                  build-icon.py
docs/             the generated public Terms / Privacy / parsing pages (GitHub Pages)
```

Scripts: `start`, `ios`, `android`, `web`, `typecheck`, `lint`, `test`, `eval`,
`build:legal`, `build:icon`, `reset-project`.

`build-icon.py` needs python3 + Pillow **on a dev machine only** — nothing in
`package.json` changes and nothing is bundled. It is the icon's source of truth
(PLAN C1); the PNGs in `assets/images/` are its output.

---

## 4. Navigation

Two levels, and the split between them is deliberate.

**Root stack** (`src/app/_layout.tsx`) — `headerShown: false` everywhere, canvas painted
`color.bg`:

```
index              the funnel DISPATCHER, signed-out reachable
onboarding/index   ┐ pre-account funnel, outside the auth guard
paywall            │
legal              ┘ Terms / Privacy / How parsing works, ?doc= picks which
(tabs)             ┐
split              │
plan-day           ├ Stack.Protected, guard = session !== null
lifts              ┘ a push since 28 Jul — see the tab table below
sign-in            Stack.Protected, guard = session === null
```

`legal` is outside the guard on purpose: the paywall links to it and App Review taps those
two words there, before any account exists. One route, three documents, so the in-app text
and the hosted copies in `docs/` come from one source (`src/lib/legal.ts`).

`ExerciseSheet` **and `SessionSheet`** are each mounted **once**, as siblings of the `<Stack>`,
because more than one surface opens each of them and both are full-screen RN `Modal`s — two
mounted copies stack two scrims. The Lift sheet is opened from Today, from Lifts and from a
Progress card's "Full history"; the session sheet from an open Progress card's evidence header
(§16.5) and from You's history calendar (§16.4).

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
| `next` | `arrow.forward` | "What am I doing next?" |
| `progress` | `chart.xyaxis.line` | "Am I actually improving?" |
| `you` | `person` / `person.fill` | "Change something." |

**`next` took the `lifts` slot on 28 July** (owner). §16 calls the prediction the single
strongest retention mechanism in the product and it had no door of its own — a thin strip on
Today and a card under the composer. "How is my bench going" is a question asked occasionally;
"what am I doing next" is asked every training day. **Lifts is not gone**: it kept its whole
screen, search and all, and became a push at `/lifts`, reachable from Next and from Progress.
Four tabs, four questions, nothing lost.

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

Warm paper, monochrome ink, exactly three hues with exactly one meaning each.

```
bg           #F4F5EF   warm paper canvas
surface      #FBFCF6   raised paper: cards, sheets, chips, pills, accessory bar
surfaceHigh  #E9EAE2   recessed: segmented tracks, hairline fills, pressed states
accent       #171914   ink: primary CTA fill, emphasised borders (== textPrimary)
accentPressed#2C2F27   ink-fill pressed — never an opacity flash
signal       #547C00   PLANNED green — future prescription VALUES only
trained      #007AFF   TRAINED blue — day-trained marks in calendars/activity grids only
trend        #BF5B23   TREND ember — one lift's progression line + its wash, lift sheet only
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

**The blue rule (owner, 28 Jul).** `trained` is iOS systemBlue `#007AFF` — the hue the
untinted tab bar already wears — and it means exactly one thing: **a day you trained**, as a
mark in a date grid. Where it lives, and the complete list: the You record card's activity
grid (`you.tsx`), the history sheet's day fills (`history-sheet.tsx`), the calendar sheet's
day dots (`calendar-sheet.tsx`), and the StreakSheet's week strip (`streak-sheet.tsx`).
Nowhere else — never on a number, a chart, a delta, a button, text, or chrome. Green is the
future (a value not yet lifted); blue is the past's attendance mark; ink stays everything
else. The two never mean each other's thing, and a surface that wants blue for anything but
a day-trained mark needs a new ruling, not this one.

**The ember rule (owner, 29 Jul).** `trend` `#BF5B23` is the third and — as of today — last
hue that carries meaning, and it means: **the recorded trend of ONE lift**. It exists in
exactly one place, `exercise-sheet.tsx`'s PROGRESSION card: the step line, the gradient wash
fading out under it, and the latest point's dot. Nothing else. In particular it never touches
a NUMBER — the axis readings, the current value, the stat tiles and the PR label beside it all
stay ink or muted grey, so the hue draws the *shape* of the record and never a value.

Why a third hue instead of reusing one: green is the future and blue is attendance, so neither
can describe what already happened to a load. The owner asked for colour on this screen after
being told it was monochrome; that ask is the ruling, and it is deliberately the narrowest one
that answers it. **The Progress tab's `StepChart` stays ink** — one surface asked, not the
archive — and any other surface that wants ember needs a new ruling, exactly as blue does.

**The settings-glyph palette (owner, 28 Jul).** A separate export — `glyph` in the same file,
six warm-darkened hues — and the only place in Recore where **a hue means nothing at all**.
That is the point, and it is what keeps it from touching the three rules above: `signal`,
`trained` and `trend` are *data*, this is *wayfinding*. It tints the leading glyph of a settings row on You
(§16.4) so a long list is scanned by shape and colour before it is read, and — since 29 Jul,
owner — the lift sheet's three stat LABELS and its summary card's label. **In both places the
glyph sits beside a caption, never beside a value**, which is the condition it keeps existing
under. Nowhere else: not on Today, Next, Progress, or on any record row.

```
indigo #5B57C2  calendar, card        orange #C2661C  target, upload
teal   #2E8B8F  language, refresh,    gold   #A9791B  plate, sparkle, star
                download             slate  #5C6B7A  barbell, lock, document,
plum   #7A4E8C  table                               sign-out, wrench
```

Four constraints, and the set is only allowed to exist because of them:

- **Chrome, never data.** A tinted glyph never sits beside a value, marks a state, or carries a
  claim. The record itself is still two inks.
- **One colour per glyph, everywhere** — the map is keyed by the glyph in `components/icon.tsx`,
  not by the row, so `sparkle` is the same gold wherever it appears. `Icon` still defaults to
  quiet grey; the tint is opt-in and only You asks for it.
- **No green, no blue, no red in this set, ever.** Those three are spoken for (planned value,
  day trained, destructive), and a settings row borrowing one would spend a meaning the app
  cannot get back. `trash` is deliberately absent from the map — a destructive row draws in
  `error`.
- **Warm and darkened for paper.** The iOS system hues are tuned for pure white and go garish on
  `#F4F5EF`; every value here clears 3:1 against both `surface` and `bg` (§14).

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

**A pressed fill is always a rounded, bleeding shape — never a bare rectangle** (28 July). A
`surfaceHigh` press highlight drawn on a row's own box is a hard-cornered grey slab floating
inside the card's padding: it reads as a mis-drawn box rather than as the row lighting up. Every
row that takes a press fill therefore carries `borderRadius: radius.sm` and a local
`PRESS_BLEED = spacing.sm` (`marginHorizontal: -PRESS_BLEED` paid straight back as
`paddingHorizontal`, so no content moves). Two consequences: a card whose first/last row can
light up needs a little `paddingVertical` of its own, or the highlight pokes a square nub past
the card's own corner; and **a row that needs a rule uses a sibling hairline, never a border**,
since a bordered row cannot take a radius without the hairline curving with it. That is the same
sibling-separator pattern §16.4 adopted for the inset, and it is now the rule everywhere
(`you.tsx`, `lifts.tsx`, `progress.tsx`, `ghost-prediction.tsx`, `session-receipt.tsx`).

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

### 5.5b Glass — `src/components/glass.tsx` (owner, 28 July)

The second place Recore uses the system's Liquid Glass, and it follows the first
(§4's tab bar) exactly.

`GlassSurface` renders `expo-glass-effect`'s `GlassView` where iOS 26 provides it, and the
app's own warm paper — `surface`, a hairline, `shadow.card` — everywhere else. It draws as an
absolutely-positioned layer behind its parent's children, so a caller keeps ordinary flex
layout and just adds it as the first child.

Two rules, and the second is the one that gets broken by accident:

- **No tint. Ever.** Glass recolours itself against whatever is behind it and offers no
  callback, so a fixed hex goes illegible over some content — the same reason §4 sets no tint
  on the tab bar.
- **Glass needs something behind it to refract.** A glass shape on top of a solid strip of
  `surface` is a grey rectangle. Wherever it is used, the bar/background it replaced must be
  removed, not kept underneath it.

Where it is used: the accessory bar above the keyboard (§6). Where it must not be: any card,
receipt or gutter reading. The record is drawn on paper.

**A GLASS SCREEN HEADER WAS BUILT AND ROLLED BACK ON 29 JULY** — the owner asked for it off a
survey of where the refraction rule could actually be satisfied, saw it, and did not like it.
Recording it so it is not proposed again as a fresh idea: `glass-header.tsx` made every tab
root's header an absolutely-positioned glass layer with the content scrolling under it, which
forced Today's insight line and plan strip inside the note's scroll view, took
`SafeAreaView edges={['top']}` off four screens, and gave `StubScreen` a second body shape. It
worked, and it is gone; the headers are flex siblings above their scroll views again, and the
Lifts search field is `surfaceHigh` again. **The two glass surfaces are the tab bar and the
accessory bar, and that is the whole list.**

### 5.6 Haptics — `src/lib/haptics.ts`

Three, and only three: `tap()` (Light) on a tap, `tapMedium()` (Medium) on a committed action,
`success()` (notification Success) when the rest timer finishes. Never on scroll, never on
keystroke, never on screen appear.

### 5.7 Emoji — ruled 28 July 2026

Emoji are allowed, in a narrow band, and the band is the whole rule.

**Allowed**
- **Onboarding** (`src/app/onboarding/index.tsx`) — at most one per option, and only where it
  labels a choice the user is making: training focus, current tracker, writing language, units.
  It is a bullet, not a decoration. The ready screen may carry one.
- **Star glyphs** as the display treatment for a review, once the review is real (§12).

**Forbidden — unchanged**
- Today, Lifts, Progress, You. The entire logged surface. A record does not wink.
- Any card, gutter reading, prescription, receipt, summary, PR label, chart or table.
- Anywhere next to a number. A load never sits beside a picture.
- Copy that would be motivational with or without it. An emoji does not rescue "Great job!" —
  §15 still forbids the sentence.
- Notifications, when they exist. The wordmark, the app icon, the share card.

The rule of thumb, and the thing to apply when a case is not listed: **emoji are allowed where
the user is still choosing, and never where the app is reporting.** Onboarding is a
conversation. Everything after it is a record.

---

## 6. The composer — `src/components/note-surface.tsx`

The screen that has to be perfect, because it is most of the time spent in the app.

**How writing works.** One exercise at a time. You type a line in the single `TextInput` at the
bottom, press return, and the line settles upward into a **card**; the input clears for the
next. `note` remains the full newline-joined log — the cards are a live projection of the parse
over `raw_text`, never a replacement for it. One line carrying several exercises produces a card
each.

**One rule per record** (28 July). Blocks are separated by a hairline `tableRule`, inset past
the check column so the marks stay one vertical run. It is a SEPARATOR, never a border: no rule
above the first block, nothing boxed, and the same rule closes the settled record and opens the
line being written. Without it the page read as floating paragraphs; with it, it reads as a
ledger, which is what says each line is now its own record.

**The scan** (`ParseIndicator` in `gutter-value.tsx`) is the working state of a line that has
settled but not been read back. It sits at the RIGHT of the row, **in the exact slot the reading
will occupy** (§5.2 — an interpreted reading is right-aligned mono), so the indicator is replaced
in place by the answer instead of handing off somewhere else. A quiet mono word plus a shuttle
that sweeps a 3 px track — it eases rather than travelling linearly, breathes 12→20 pt at
mid-travel and fades toward each end, so it reads as something passing over the line rather than
a slider being dragged. **No percentage** (the parse is one round trip; there is nothing to be
40% of), no colour, no spinner. Reduce Motion holds it still, centred and full width: the
movement goes, the "still working" information stays. The user's words never dim while it runs.
The three-dot `GutterPending` survives only in `sign-in-demo.tsx`, which mimics the narrow
gutter column a 40 pt track would not fit.

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
last session; on a blank account, the **FIRST SESSION ledger** (28 July, owner-asked, Mobbin:
Todoist's welcome-project / Slopes' step checklist / Jour's tap-to-write starters) — three steps
drawn in the composer's own check-ring vocabulary, **each earned by the real action, never by a
"got it"**:
1. *Write a lift* — two tappable sample lines in mono (the onboarding primary lift leads, in the
   user's unit; a Slovenian writer gets `počepi 5x5 100` as the second). A tap writes the line
   into the note as REAL text (the plan button's precedent) and the real parse runs on it.
2. *Read it back* — earned in the ledger: one muted hint line under the settled cards ("the ring
   marks a lift done…") until the first ring toggle or long-press sets `pref_coach_ring_done`,
   which retires the hint forever AND fills this step's ring, so the two surfaces cannot
   disagree. The hint never shows once `pref_finished_once` is set.
3. *Finish* — taught by the toolbar tail that already exists; the first finish creates history,
   which replaces this card with the LAST SESSION peek. The card retires itself.

The self-typing `SignInDemo` was replaced by this ledger, so **`sign-in-demo.tsx` (and the
`GutterPending` dots, whose only consumer it was) is now orphaned** — either something adopts it
or it goes, same rule as §16.5's charts.

**The first-open spotlight tour** (`spotlight-tour.tsx` + `src/lib/tour.ts` + `tour-targets.tsx`,
owner 29 Jul — an explicit ask, over the earned-hints alternative): once per account, on the
first Today after sign-in, an ink scrim (`alpha(accent, .5)`) with a spotlight hole walks
Next → Next → Done across five steps — the page, the day pill, then Next / Progress / You over
the tab bar. The scrim is one evenodd path in `react-native-svg` (already in the stack — **no
new dependency**); the day pill is measured through the `TourTarget` registry, the page and the
tab bar are computed regions (`TAB_BAR_CLEARANCE` arithmetic, since no ref can reach a native
bar). Finishing OR skipping sets `pref_tour_done` and it never returns; a step whose target
cannot be measured is dropped, never shown pointing at nothing (§1.1 inv. 6); Reduce Motion
jumps the hole instead of easing it; the copy passes §15 and its test file lints exactly that
(no `!`, no "AI", no emoji). The division of labour with the ledger above is deliberate: **the
tour says what exists; the FIRST SESSION ledger makes the user do it** — the tour completes
nothing on the user's behalf, so the ruling about earned steps stands untouched.

**Around the composer**, on `(tabs)/today.tsx`:
- `TopBar` — wordmark, centred day pill (opens `CalendarSheet`), bare mono streak (opens
  `StreakSheet`). **No settings avatar**: it was removed 28 July because it pushed `/you`,
  which has been a tab since the four-tab restructure — a second door to a room with its own
  door. Nothing replaced it.
- `DaySwipe` — a horizontal drag anywhere on the page moves between days: right goes back,
  left goes forward and **stops at today** (you log what happened). `activeOffsetX` ±24 and
  `failOffsetY` ±12 keep the note's vertical scroll in charge of an ambiguous drag, and the
  gesture is **disabled while the keyboard is up** — mid-sentence a horizontal drag is the
  user placing a cursor, and swapping the day under a half-typed line would be the worst bug
  in the app. The neighbouring day is not pre-rendered, so it is a short parallax-and-fade
  rather than a page slide; Reduce Motion swaps instantly.
- `InsightHeader` — one quiet ledger line ("this week · 12,300 kg · 3 sessions"); hidden while
  the keyboard is up, absent with no history.
- `PlanStrip` — today's declared split day as a **read-only** reference: movement name plus the
  engine's progressed load in green. A row dims when the parse recognises it in the note. It
  cannot insert, check off, or count anything. "Planned into actual" is the boundary that never
  bends.
- `BottomToolbar` — the accessory bar above the keyboard. **Rebuilt 28 July as FLOATING GLASS
  shapes** (§5.5b) rather than a bordered strip attached to the keyboard: a glass status pill
  carrying the live count and tonnage ("4 staged · 3 240 kg", tapping through to Progress),
  then a row of 44 pt glass rounds — **rest timer**, **mic**, **hide keyboard**, and the
  **plan** button — with the **Finish session** ink pill on the right (disabled at 40% until
  something is staged).
  - **Hide keyboard** (28 July) puts the keyboard away without settling anything. The note
    already dismisses on an interactive scroll drag, but that is a gesture you have to know
    about, and the only *labelled* way down was Finish — which ends the session. Reading back
    what you just wrote is not the same as being done training. It sits after the mic and
    **before** the plan button, the only round that comes and goes, so the permanent controls
    never move under the thumb. It can never be a dead control: the bar only exists while the
    keyboard is up.
  - The **plan button writes the next prescribed line into the note as real text**, and is
    rendered **only when there is one left to take**: no ghost, or every line already written,
    and the button is not there at all (§1.1 invariant 6 — silence beats a dead control). It
    reads the ghost's own text, which is already the parseable form; the plan strip's values
    are display strings and would not survive a re-parse.
  - No colour and no emoji here, whatever the reference showed: this is the app reporting.
  - The teaching tail ("— they count when you finish") retires permanently after the first
    finish.
- `SummaryPill` — at rest, a single mono pill with the day's counted sets and tonnage, reading
  the same settled receipt the ledger draws from. Volume gives way to distance on a pure cardio
  day. Tapping it opens `SessionSummarySheet`.

**Effort marking** (`src/lib/effort.ts` + `effort-sheet.tsx`, owner 28 July). Finish opens one
sheet: every parsed exercise with a four-step scale — Easy · Moderate · Hard · Max, captioned
with what each means in reps left. It is reachable again from the receipt, because the honest
moment to answer is sometimes twenty minutes later.

**It writes into the note, not into a table.** A tap appends `rpe 8` to the line the user wrote,
the parser reads it like any other word, and the RIR arrives through the one path that already
exists. Three reasons, and the first is the one that decides it:

- **§1.1 invariant 1** — the words are the record. An overlay table (the `done-state.ts` shape)
  would make effort a second source of truth for `sets.rir`, and it would not survive into the
  export, the sync, or a re-parse. "rpe 8" is not app metadata; it is training notation.
- **The engine already needs it.** Rule 2 adds weight the moment the athlete had ≥ 2 in reserve
  (§8.1) — and today that only fires if the user types the marker themselves, which almost
  nobody does. Four taps make the app's best progression rule usable.
- `checkGhostLine` is the precedent: the app already writes into the note on an explicit tap.

Tapping the selected level again clears it. The app only ever touches the RPE token — a `@8`
the user typed is read, and replaced only when they change that line's rating themselves.
**Skip is a real button**, not a corner: a scale that nags is one people learn to dismiss, and
§20 has no room for another thing to complete.

**`@` IS ALSO HOW A LIFTER WRITES A LOAD, and `RPE_RE` must never forget it** (fixed 29 Jul —
a rule in the §7.2 class: do not soften it). "bench 3x8 @100kg" is standard notation, so the
marker is only an effort when the value looks like an RPE and like nothing else: 1–10, at most
one decimal, and **not** followed by another digit, another decimal, or a unit. `@8kg` is a
load. Before those exclusions the pattern was `\d{1,2}`, which matched the `10` inside `@100kg`
— so rating a line as Moderate rewrote `bench 5x5 @100kg` into `bench 5x5 0kg rpe 8`. The app
was destroying the user's own words in the one function permitted to touch them (§1.1
invariant 1), and the tests missed it because every case wrote the RPE as one or two digits
with no load on the `@`. There are now eight `@`-load cases in `effort.test.ts`.

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
an agent (§0).

### 7.7 When a parse looks wrong — where to look first

The parser is the moat, so a misparse is the most expensive support question in the product.
Check the code before the prompt; four of these six symptoms are not prompt bugs.

| Symptom | Look here first |
|---|---|
| A multi-set line shows the wrong set count | `setsLineText` in `src/lib/parse/summarize.ts` — a display collapse produced exactly this once |
| A card attached to the wrong line | `reanchorLines` in `src/lib/parse/anchor.ts` — the model's line index is a hint |
| A saved fix stopped sticking | `overlayCorrections` — patches match on trimmed line text **and** the exercise the parser produced; if either drifted, the patch steps aside by design |
| A freshly deployed prompt seems to have no effect | `parse_cache` — keyed on text **and** `parse_version`. `CLIENT_PARSE_VERSION` was probably not bumped |
| A warm-up counted toward a total | the `skipped()` predicate — every SQL aggregate must repeat the exclusion list itself |
| The summary pill and Progress disagree | `reapplyDoneState` — done state stores exceptions only, so a stale projection shows up as two different totals |
| An un-check goes off but the set still counts | **`doneKeyFor` in `summarize.ts` is the ONE definition of a done key** — never write a second one. The composer keys off the rendered row, while the projection, the totals and the PR signals key off the parsed item; if those two expressions ever differ, the ring toggles and nothing else happens. `note-surface.tsx` carried a local duplicate that separated name from sets with a NUL byte instead of a space, so every un-check was cosmetic — silently, with all four gates green (fixed 29 Jul; locked by a test in `receipt.test.ts` that derives the key from the row) |

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
`bottom = top − 2`). **When there is nothing to infer from, it falls back to the athlete's
TRAINING FOCUS** — `strength` 3–5, `muscle` 8–12, `both` 6–8 (`FOCUS_REP_RANGE`, PLAN E1).

Two things about that, and both are load-bearing:

- **It is a fallback, not an override.** Where there is performance to read, performance wins.
  What someone did last Tuesday outranks what they said about themselves in onboarding.
- **The engine still reads nothing.** The range arrives as `defaultRepRange` on the history
  object, exactly like `incrementKg` — `data.ts` and `db/strip.ts` both resolve it from `goal`
  and pass it in, so the ghost and the plan strip can never prescribe different reps for one
  exercise. Reading `prefs` from inside the engine would break §1.1 invariant 3 and is not an
  option.

Before 28 July `goal` was written by onboarding step 2 and **read by nothing** — it was the
decorative question §11 warns about, and its own subtitle admitted it. E1 is what made it real.

Bodyweight work progresses reps first
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

Since 29 Jul the same rewrite permission covers one more text, under a stricter gate: the Next
tab's composed briefing paragraph, through `explain-brief` + `brief-guard.ts` (§8.5). Those two
texts are the complete list of what a model may touch.

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

### 8.5 The Next briefing — `src/lib/db/brief.ts` + `(tabs)/next.tsx`

The prediction's own tab, added 28 July because §16 calls it the strongest retention mechanism
in the product and it had nowhere to live.

**THE BRIEFING leads the screen** (owner, 28 July, second ask: "make it read like a generated
summary, professionally"). A labelled card — mono eyebrow inside, a two-to-four-sentence
paragraph, a provenance foot. The paragraph is **COMPOSED first**: `src/lib/brief-prose.ts`
(pure, tested) templates over the same computed `Brief` in a fixed order — what's next →
what's at stake → what's moving → what's stuck → the record. Since 29 Jul a model-written
rewrite may replace it under the rule below — the composed paragraph renders instantly and
stays the permanent fallback. The reference pattern is Strava's Athlete Intelligence / Tempo's
readiness card (Mobbin); the part those references get wrong is the voice, so the prose states
numbers and never praises (§15), and never says "AI". The adherence record is the paragraph's
closing sentence — the standalone fourth block was folded into it.

Below the briefing, three blocks, each **absent rather than empty** when it has nothing true
to say (§1.1 invariant 6):

1. **What's next** — the declared split day for today when there is one (it is what the athlete
   said they would do), otherwise the ghost. Values in `signal` green, because they are exactly
   what green means: a number not yet lifted. Each row carries the engine's own reason as a
   fragment (`whyFor` in `plan/prescribe.ts`, pure and tested), and — 29 Jul, owner — **the
   record behind it**: a muted mono `last 3×8 80 · best 85` subline (§20's own framing, only
   what to beat; read through `getLastSetHint` + a MAX over counted sets, silence when the name
   doesn't resolve). When one prescribed load exceeds that lift's all-time best, the briefing
   paragraph gains one sentence — "82.5 kg on Bench Press would be your heaviest ever" — stated
   as arithmetic, at most once per brief (§15: two such lines are a hype reel). The comparison
   reads the engine's own number (`PlanRow.weightKg`, or the ghost line's kg suffix), never a
   re-parse of the display string (§7.7's display-collapse lesson).
2. **Standing still** — the engine's deload condition read ONE SESSION EARLY: same top weight
   for three sessions with reps not improving. This is not a new opinion about training; it is
   the app showing its work before it acts. A rising rep count at the same weight **is
   progress** and is deliberately not called a stall.
3. **Moving** — e1RM that genuinely climbed inside eight weeks. A delta is a word plus a
   number, never a bare `+` and never a colour (§5.1).
4. ~~**The record**~~ — folded into the briefing paragraph's closing sentence (28 Jul); the
   hit rate is still published, as prose.

**THE RULE THIS SCREEN EXISTS UNDER — rewritten 29 Jul, by the owner's ruling.** The original
line was "the briefing is composed; a model may only rewrite one sentence". The owner has now
sanctioned a model-written summary FOR THIS TAB, and the boundary moved one notch without
breaking what it protects:

- **Every figure is still a SQL read or the pure engine's arithmetic.** A model still never
  picks a weight, an exercise, or a plan (§1.1 inv. 3, §20, Terms — Recore is a record and a
  calculation, not coaching). The adherence number stays measurable, because the prescription
  is still deterministic.
- **What the model may now do is rewrite the whole composed paragraph** — `explain-brief`
  (edge function, same JWT + rate-limit + injection posture as the parser) takes
  `brief-prose.ts`'s output and rephrases it, in the user's language. Rewrite, connect, drop,
  reorder — never add.
- **The guard is the ruling made executable:** `src/lib/brief-guard.ts` (pure, 6 tests) rejects
  any rewrite carrying a number that is not in the composed paragraph, plus newlines,
  exclamation marks, emoji, and the word "AI" (§15). A rejected or absent rewrite silently
  resolves to the composed paragraph — the screen NEVER waits for the network (§1.1 inv. 2)
  and never shows an error for this.
- Cached in the meta KV keyed by a signature of the paragraph (`brief-explain.ts`), so one
  brief costs one call; a changed record changes the signature. The card's foot states which
  voice is on screen, truthfully in both states.

**The lift sheet's summary reuses this machinery whole** (owner, 29 Jul — "a summary of the
loads from previous sessions"). `src/lib/lift-prose.ts` (pure, 10 tests) composes a paragraph
over ONE lift's own record — how many sessions, how the top set moved across the charted
window, whether it is standing still, the heaviest set and its estimate — and
`exercise-sheet.tsx` sends it through the same `explain-brief` + `brief-guard` path under its
own cache scope (`lift_<canonical>`, so opening a second lift never evicts the first) and only
once a lift has ≥ 3 sessions. Same rule, same guard, no new edge function and no new
permission: **the model still authors nothing.** Two extra constraints because it sits on the
archive — it never prescribes (the next weight lives on Today and Next, §16.5) and it never
praises (§15).

Anything past this — a model choosing content, numbers, or the plan itself — is still a
different product, and this paragraph gets rewritten again before that is built (§20).

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
onboarding (14 screens) → paywall → sign-in → the app
```

### 11.0 The fourteen screens — block E, built 28 July 2026

`src/app/onboarding/index.tsx`. Every answer persists to the meta KV immediately and a relaunch
resumes at `pref_ob_step`. **Back on every screen**, every answer editable in place, and a
progress spine across the whole flow.

| # | Screen | Asks | What the answer changes |
|---|---|---|---|
| 0 | Welcome — the settling specimen | — | it *is* the claim |
| 1 | **What this replaces** | — | the explanation; payoff for nothing, setup for everything |
| 2 | Name | ✓ | how every later screen addresses them |
| 3 | Training focus | ✓ | **the engine's fallback rep range** (§8.1) |
| 4 | **What that focus changed** | — | the receipt for 3 |
| 5 | Current tracker | ✓ | which objection screen 6 shows, and the ready screen's first action |
| 6 | **The objection answered** | — | the receipt for 5 |
| 7 | Writing language | ✓ | parser vocabulary + the demo |
| 8 | **The lift you care about most** | ✓ | screen 9's demo, the ready echo, **Lifts' first row** |
| 9 | How it works — a live parse | — | the receipt for 7 and 8 |
| 10 | Units + smallest increment | ✓ | `roundToPlate` |
| 11 | **How did you find Recore** | ✓ | telemetry, and it is labelled as telemetry |
| 12 | Building — the working beat | — | reflects every answer back |
| 13 | Ready | — | echoes the setup; hands off to the paywall |

**Seven screens ask something**, and those seven carry a bounded counter ("STEP 03 OF 07").
R5 was recorded as "fourteen screens, twelve decisions"; the screen count is right and the
decision count came from the spec's looser arithmetic (§0.3 — the code wins).

**THE CONDITION IS THE WHOLE POINT, and it outranks the length.** Every question changes a
later screen, an engine default, or a line on the paywall. A question that changes nothing is
deleted, not kept for analytics. That has already cost this flow two screens: "sessions in a
normal week" was deleted before it was built (R3 made the streak read training days, so the
answer would have changed nothing), and training focus sat here for weeks reading nothing until
E1 made it real. **When you add a screen here, name the thing it changes or do not add it.**

**No permission prompt anywhere in this flow.** The microphone asks when the microphone is
tapped; notifications ask at trial start (§12.1). Emoji are permitted here and only here, one
per option (§5.7).

**Everything is instrumented** (`src/lib/funnel.ts`): the high-water step per install, the
flow's length beside it, and the completion stamp. The block is built EXPECTING to lose
screens — one that loses more than ~10% of the people who reach it gets **cut, not
redesigned**, and two of the five new ones are expected to die that way. Counterweight,
recorded honestly: at least one published case removed a loading beat and saw trial conversion
*rise*.

### 11.0.1 What the three new answers actually do

- **Focus → the engine.** §8.1. Strength 3–5, hypertrophy 8–12, hybrid 6–8, as the fallback
  only. Screen 4 shows a lift with **no history yet**, because that is the only case focus
  decides — a card with logged reps would be describing inference, not focus.
- **Primary lift → three visible places.** `pref_primary_lift` stores the words they typed,
  never an id: onboarding runs before there is an account, so there is nothing to resolve
  against yet. It is resolved read-only through `findExerciseByName` where it is used, and
  **naming a movement never creates an exercise row**. It leads screen 9's demo, it appears in
  the ready echo, and it sorts first in Lifts **on the first open and only then** — after that
  recency is the truth and pinning would be the app overruling the record.
- **Source → telemetry, said out loud.** `pref_ob_source`, five options, read out through
  `funnel.ts`. It is the one question that changes nothing the user will see, so the screen
  says so rather than dressing it as personalisation. It sits at 11 so it does not interrupt
  the value sequence; if it bleeds users, it moves after the paywall rather than being deleted
  — with ASO-first distribution it is the only attribution signal that survives SKAdNetwork.

**The paywall headline mirrors an answer** (§12), computed in priority order: a real record on
the device → its own numbers; a named lift → that lift; neither → the app's own words. Never a
claim about Recore, always a statement about what the user already has. It is **not** a refill
of the proof slot §12.1 empties.

### 11.0.1b The visual pass — Mobbin, 28 July 2026

The flow was restyled against a reference sweep of Equinox+, Tonal, Peloton Strength+,
pliability, Vibecode, Tiimo, Photoroom, Aaptiv, Strava, Superpower, Moonly and Paired. Four
things changed, and each is a decision rather than a restyle:

1. **The step count left the eyebrow and went into the chrome.** Equinox+, Tonal and Strava
   all keep the count beside the progress rail. "STEP 03 OF 05" was spending the most valuable
   line on the screen — the one directly above the question — restating what the progress bar
   already showed. The chrome now carries a mono `03/07` and the eyebrow names **what is being
   asked about** ("Your focus", "Your gym"). The fraction appears only on a screen that asks
   something, so the six explanation screens read as payoff rather than as more queue.
2. **The selection marker moved to the trailing edge**, and the selected row lifts (a 1.5 px
   ink border + `shadow.card`) instead of relying on the radio. Every reference that reads as
   calm — Tonal, pliability, Photoroom — puts the marker after the content or drops it. A radio
   in the leading position is the most form-like arrangement there is, and this app's whole
   thesis is that a form is the wrong shape.
3. **Every tappable in the flow now dips** (`PressableScale`). Option rows, the ready screen's
   choice cards, the unit segments and the increment stepper were all plain `Pressable`s in an
   app where everything else is physical.
4. **"What this replaces" became asymmetric.** Moonly and Paired both make the "after" column
   taller and raised while the "before" recedes; the asymmetry *is* the argument. Recore says
   it in its own elevation model rather than with colour — the left column sits on
   `surfaceHigh` (recessed) and the right on `surface` with the card shadow (raised).

**Motion**, all inside §5.5's vocabulary and all `reduceMotion`-gated:
- `FadeSlideX` (new, in the shared kit) gives the step transition a **direction** — forward
  arrives from the right, Back from the left. A wizard that always slides in from the same side
  tells the user nothing, and motion that reports nothing is decoration.
- Screen 1's tap list staggers in so the column performs its own tedium; the single line on the
  right lands after it.
- Screen 4's prescribed load **counts up** (`AnimatedCount`) — the one number on that screen
  whose change is the entire message, so it is the one number that moves.

**Emoji: exactly two screens.** §5.7 permits one per option where it labels a choice, and that
is the test applied. Writing language gets flags (🇬🇧 / 🇸🇮 / 🌍 — unambiguous, and these are the
only two languages the parser is measured on) and "how did you find Recore" gets five
conventional glyphs. **Training focus and current tracker get none**, because no honest
one-glyph mapping exists for "hypertrophy" or "Hevy" and inventing one is decoration wearing a
bullet's clothes. Every glyph is `accessibilityElementsHidden` (§14).

### 11.0.1c The three screenshots — owner, 28 July 2026

**Three screens show a real capture of the app inside a device frame**: 9 (the composer),
4 (the plan, and the app's only hue), 13 (a finished session). The alternative — rendering a
live miniature of the real components — was proposed and **the owner chose real captures**;
this section is what that decision costs and how the cost is paid.

- `src/components/device-frame.tsx` is the only frame: an ink bezel (a paper bezel around a
  paper screenshot has no edge), no notch and no side buttons, and a **9:16 window onto a 9:19.5
  capture**, anchored top or bottom, because a whole device shrunk into a step is a grey smudge.
- `src/lib/onboarding-shots.ts` is the only place a picture is named. It carries what to
  capture, at what size, and the two rules for the capture itself: **a real session, never a
  staged fiction** (these sit next to the paywall §12.1 emptied), and nothing personal in frame.
- **`shot: null` is a working state.** With no capture the frame renders the screen's existing
  live composition — screen 9's self-typing `LedgerDemo`, screen 4's counting payoff card — so
  the funnel is complete, the bundle builds with no assets committed, and there is never a
  placeholder pretending to be the app. Dropping three PNGs in and uncommenting three `require`s
  turns the pictures on; nothing else changes.

**The standing cost, recorded so it is nobody's surprise:** a screenshot goes stale the moment
the screen in it is redesigned, and this repo redesigned You, Progress and Today inside one
week. **Redesigning a screen means recapturing its shot in the same change** — the §0.3 rule,
applied to pixels. If that upkeep is ever skipped twice, the live-miniature approach is still
sitting in `DeviceFrame`'s fallback path, one prop away.

**`npm run shots` is what makes that upkeep cheap** (29 Jul). `scripts/capture-shots.ts` boots
an iOS 26 iPhone — the runtime whose tab bar is the Liquid Glass one the app ships, so an iOS 18
capture is a picture of a bar the product does not have — waits out a `--delay` while you
navigate, writes the PNG, checks its ratio against `DeviceFrame`'s own `SHOT_ASPECT`, and flips
the `require` in `onboarding-shots.ts`. With no argument it prints which of the three exist.

It automates the mechanical half and **deliberately not the other half**: it cannot know what is
on the screen, so §11.0.1c's two rules — a real session, nothing personal in frame — stay the
owner's. Nor can an agent run it end to end: the three states are all behind sign-in, which is
Apple/Google only (the no-account bypass was deleted 28 July, §2), so the capture needs the
owner's own signed-in device. The fast way to a state worth capturing is the repo's own
`seed-strong.csv` through You → Import — structure lands with no parse call (§13), which is
enough history for a real briefing on the `plan` shot.

**All three shots are still `null` as of 29 July.** That is a working state, not a bug (the
frame renders each step's live composition), but screens 9, 4 and 13 are not yet showing the
product.

### 11.0.2 Two places the spec was not followed, and why

`recore-onboarding-v2-spec.md` was folded into this section and deleted (E8) — two documents
describing one funnel is how v3 happened. Two of its instructions were not implemented as
written:

- **The lift question runs BEFORE the live demo, not after.** The spec ordered demo (9) then
  lift (10) while also requiring the demo to use the lift. The code cannot do both, and showing
  someone their own bench is worth more than the spec's numbering.
- **The Hevy/Strong objection screen does not say "your history comes over in the first
  minute."** R2 ruled that import happens after sign-in; that sentence would have been a
  promise the funnel does not keep. It says import is waiting the moment they are in, which is
  true.

### 11.1 Where import happens — ruled 28 July 2026

**Import is offered after sign-in, not inside onboarding.** Onboarding *says* import exists —
step 3 names Strong and Hevy and states that nothing has been imported yet, its footer says
import stays available whatever you pick, and the ready screen offers "Import your Strong
history" as the first action, remembered through checkout. It never performs one.

This section previously claimed the opposite — that the tracker branch imported CSV inline and
that the ready screen's ghost was computed from it — and called that the strongest conversion
asset in the product. **No such code has ever existed**; `pickAndImportCsv` and
`recachePredictionFromLatest` are called from `(tabs)/you.tsx` and nowhere else. The claim was
written as a description and read as a requirement, which is the exact failure mode §0 exists to
prevent.

The consequence the old text drew is still true and now has nothing holding it up, so state it
plainly rather than lose it: a prescription needs prior sets of the same exercise, and a lifter
training four times a week hits a given lift twice in seven days. From a standing start the
predictor shows one target, late, and rarely gets to be proved right inside the trial window. An
importer would see a real target on their first session. **The seven-day trial is therefore
carrying more weight than it did when this document argued for it** — the trial length is ruled
and stays (§0.1), but if trial-to-paid comes in low, the first hypothesis to test is that the
window is too short for the predictor to prove itself, not that the paywall is wrong.

The honest first move is cheaper than either: make the ready screen's import choice do its job
the moment the user is in, and measure how many importers there are (§2.1 — split every
trial-window number by that flag).

---

## 12. Paywall and pricing — as built

`src/app/paywall.tsx`: **$59.99/year with a 7-day free trial** (annual, "BEST VALUE", with its
true per-month math) or **$8.99/month with no trial**. A transparent three-row trial timeline
(Today → Day 5 reminder → Day 7 charge) with the real first-charge date computed live. Close ×
and Restore are both visible without scrolling — with one honest exception: the × renders only
when a screen is actually behind it (pushed from onboarding's ready screen or from You). On a
signed-out relaunch the dispatcher *redirects* here, the paywall is the root, and a close with
nowhere to go is a dead control (§6) — it also threw GO_BACK warnings in development. A spacer
keeps the row's geometry. **No colour on this screen** — the CTA is an ink
fill; green belongs to training numbers, not to selling. No emoji on this screen either (§5.7):
the paywall is the app reporting a price, not asking a question.

The CTA hands off to sign-in, because the trial attaches to an account. Prices come from
`src/lib/billing/pricing.ts` — one table, read by the paywall and by the day-5 reminder, so a
price can never be stated two ways.

### 12.1 What this screen claims, and why each claim is now true

Both of the untrue claims that used to live here were closed on 28 July.

**The fabricated social proof — DELETED.** `<Rating score={4.9} countLabel="loved by early
lifters" />` and a named testimonial ("Marko · powerlifting") were hardcoded with nothing
marking them as placeholders. There are no real reviews, so all three call sites are gone:
onboarding's ready screen, `paywall.tsx`, and **`sign-in.tsx`, which no plan had listed** — it
was found by A1's own acceptance grep, which is the argument for writing acceptance as a
command rather than a sentence.

**The space is not refilled and must not be** — no substitute badge, no download count, no
"trusted by early lifters". The headline sits against the subline; that is the finished state.

`Rating` and `Testimonial` stay in `primitives.tsx` as components, ready for the moment there
is something true to put in them: a score and count taken from App Store Connect, or a review
quoted with the reviewer's handle and storefront. Stars are a display treatment, not a claim
generator. Until then the slot renders nothing, and the proof on this screen is the one the
user is already looking at — the ledger they just watched being built.

**The day-5 reminder — BUILT (ruled 28 July).** The row used to say *"We email you before the
trial ends."* There is no mail server and there will not be one. What ships:

- **`src/lib/billing/trial.ts`** — the clock, pure and unit-tested. Day 0 is the start, the
  charge is 7×24h later, and the reminder is owed from day 5, which is exactly the two days
  before the charge this section always asked for.
- **`src/components/trial-reminder-sheet.tsx`** — the IN-APP reminder, the floor. Shown on the
  first open inside the window, at most once, carrying the date, the amount and how to cancel.
  **It needs no permission**, so it stays true for a user who denied notifications, has them
  off system-wide, or is in Focus.
- The row now says what that does.

It is inert until something calls `startTrial` in `src/lib/billing/state.ts`, and only billing
can honestly do that — a trial no store knows about is a fiction. **That is the one hook B2
needs to wire, and the rest is already built.**

- **`src/lib/billing/notifications.ts` + `trial-started-sheet.tsx`** — the UPGRADE, approved
  and built 28 July. One local notification on day 5. **Permission is asked on the trial-start
  sheet and nowhere else**, after that sheet has said what the reminder is for; never in
  onboarding, and never again after a denial (`canAskAgain` plus a local flag). Showing the
  in-app reminder cancels the pending notification, so a user is told once.

If `notifications.ts` were deleted the app would still keep its word — that is the test the
floor/upgrade split is designed to pass, and any change here has to keep passing it.

### 12.2 Billing

**Not wired.** RevenueCat is not a dependency and nothing is charged. Restore is the one
remaining stub that says so.

What IS wired, so B2 has somewhere to land: `resolveEntitlement()` runs **once per session**
from `AuthProvider` and caches the result — **never mid-set and never on a write**, because an
entitlement check standing in front of a keystroke breaks §1.1 invariant 2. With no store to
ask it resolves to `entitled`, which is not a stub but this section's own rule: an entitlement
that cannot be verified assumes entitled and re-checks later, since a false positive costs one
session of revenue and a false negative costs a customer.

`lapsed` reaches the read-only surface (§13, PLAN B4). Before a sandbox subscription can
expire, the only way in is the `__DEV__` toggle in You → Dev, which compiles out of release
bundles.

---

## 13. Import, export, share, voice

- **Import** — Hevy and Strong CSV, detected by header signature (`src/lib/import/formats.ts`),
  every field parsed defensively, lb→kg normalised, RPE→RIR. Structure lands directly (no parse
  call), `raw_text` is reconstructed in the app's own voice so the note reads naturally, and a
  day that already has a local note is **never overwritten**.
- **Export** — two formats, both written to a real file with `expo-file-system` and handed out
  through `Sharing.shareAsync` with a real UTI (`src/lib/export-share.ts`), so they reach Files,
  AirDrop and a spreadsheet. **JSON** (`export-json.ts`) is the complete one and is listed
  first: it carries `raw_text`, and the user's own words are the record (§1.1). **CSV**
  (`export-csv.ts`, `date,exercise,kind,reps,weight_kg,rir`) is the interchange format and
  necessarily loses them. Free forever, never gated, degraded or delayed — including on a
  lapsed subscription, where the read-only surface offers it as a first-class action.
  *(Until 28 July the CSV went out as `Share.share({ message: csv })` — the whole export as a
  message body, which reaches Mail and Notes and cannot be saved anywhere.)*
- **Share** — `captureRef` on the receipt card or the weekly recap card → PNG → `expo-sharing`.
  A wordmark row is mounted only for the capture. Note that `Share.share({url})` is iOS-only,
  which is why `expo-sharing` is used. The share card is the only organic acquisition surface
  in the product; count exports as an acquisition number, not a vanity one.
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
- The palette is colourblind-safe: three hues with disjoint meanings — green only beside a
  planned value's context, blue only as a day-trained mark in a date grid, ember only as one
  lift's progression line — and none of them is ever the sole carrier of information (a
  trained day is also a filled/tappable cell; a planned value carries its PLANNED tag; the
  progression is carried by the line's shape and its axis readings, which stay ink). PR is a
  shape. Deltas are words.
- Rows that act are `accessibilityRole="button"` with a label that reads as a sentence.
- An emoji used as an option bullet (§5.7) is `accessibilityElementsHidden` or absorbed into the
  row's label. VoiceOver must never read a decorative glyph aloud as content.

---

## 15. Words

Copy is design material and gets the same care as a corner radius. This section survived the v3
rollback in spirit but had never been written down, which is why the paywall drifted.

- Sentence case everywhere. Never Title Case, never caps except the mono eyebrow.
- Name things by what the user controls: "smallest plate", not "increment configuration".
- A button says exactly what happens, and the same word appears afterwards: `Finish` produces
  *recorded*, not *saved*.
- Active voice, present tense, no filler.
- Numbers are specific. "up 2.5 kg vs last" beats "you're improving".
- Errors say what happened and what to do. They never apologise and they are never vague.
- Empty screens invite an action; they never report a lack.
- **Never say "AI."** The app reads, computes, prescribes. The mechanism is not the promise.
- **Never claim credit for the training.** They lifted it; the app wrote it down.

| Never | Instead |
|---|---|
| "Great job! You crushed it!" | "5 exercises · 19 sets · 12,480 kg" |
| "Oops! Something went wrong." | "Not synced yet — everything is saved on this phone." |
| "AI-powered workout suggestions" | "your next set, from your own numbers" |
| "You haven't trained in 5 days!" | *nothing* |
| "No data available" | "Two more sessions and there's something to show here." |
| "Log your workout" | "Write your training" |
| "Don't lose your streak!" | *nothing* |

An emoji does not rescue any sentence in the left column. §5.7 permits the glyph; it does not
permit the voice.

---

## 16. Retention and renewal

Retention here is evidence of progress, not gamification (§20). In descending order of power:

1. **The prediction.** A reason to open the app on a training day that exists before the user
   has done anything. If only one retention mechanism worked, this is the one.
2. **The receipt and the share card.** Finishing feels like completing something rather than
   abandoning a text field.
3. **The adherence record.** Publishing the app's own hit rate is a claim no competitor makes.

### 16.3 The review prompt — built 28 July 2026

The App Store score is the one asset §12.1 emptied a slot for and refuses to fake. This is how
it gets filled honestly: by asking real users at a moment the app has earned.

**There is no Recore UI in this feature, and that is the design.** Guideline 1.1.7 disallows a
custom rating prompt, so the only legal ask is `SKStoreReviewController` via
`expo-store-review` — and a pre-flight "enjoying Recore?" dialog that routes happy people to
the store and unhappy people to a feedback form is both a rejection risk and the app talking
about itself, which §15 has no room for. The app picks the moment; the system asks the
question.

**The moment is Finish session**, 1.4 s after the tap, so the receipt has settled first — the
sheet must never cover the ledger that earned it. It is the only call site
(`bottom-toolbar.tsx` → `maybeAskForReview`).

**The gate is `src/lib/review/gate.ts`** — pure, zero imports, ten tests. iOS draws the sheet at
most three times per 365 days and no-ops silently after that, with no callback, so an ask spent
at a mediocre moment is a chance gone for the year. Every clause below is a reason to stay
quiet:

| Refuses when | Because |
|---|---|
| 3 asks already made, or one inside 120 days | Never spend more than the platform would honour |
| A trial sheet is owed on this open | Two modals never stack |
| **The parser was corrected on this session** | They just did repair work. The worst moment in the product |
| Under 3 training days on record | There is no opinion to give yet |
| Nothing visibly went right | Finishing proves the user trained, not that Recore earned anything |

That last row is the one to keep: what earns the ask is a **PR spotted**, a **prescription
followed** (§8.3's own proven-record rule, now shared from `db/insights.ts` so the ghost card
and this gate cannot drift), or a **streak of 3+** — any one of them.

Failure is silence everywhere. No module, no store URL, a TestFlight build, an over-quota
device: none of them is an error the user sees, and none of them spends an ask. The attempt is
what gets recorded, because iOS never says whether it drew the sheet.

**Still owner-side:** the score and count only become quotable on the paywall once App Store
Connect has real numbers — §12.1's slot stays empty until then, and `Rating` / `Testimonial`
stay unused in `primitives.tsx`.

### 16.4 The You screen — rebuilt 28 July 2026

Mobbin-researched (Tonal, Open, komoot, Peloton Strength+, Granola, timespent). The brief was
"cuter and more usable", and the two halves resolved differently.

**Cute, as this category builds it, is ruled out and stays ruled out.** Mimo's XP tiles and
wooden leagues, Quizlet's flame badge, Uxcel's streak-savers, pliability's "🔥 Great start, keep
it going!" — every one of those crosses §5.7 (no emoji on You), §20 (no XP, levels, badges,
rings) or §15 (never claim credit for the training). None of them was taken.

**What warmth is made of here instead** — the same thing Tonal and Open use: a big mono
numeral over a small caption, generous space, and a record drawn rather than summed — since
the 28 Jul blue ruling, drawn in the `trained` mark (§5.1).

- **The record card** — training days · sets · kg lifted, split by hairlines, over the training
  year as a dot grid. The whole card is one control and it opens Progress; Mobbin's komoot and
  AllTrails both make the stat block a door rather than decoration, and that is the entire
  usability difference between a profile and a trophy case. Absent on an empty account — three
  zeros over an empty grid is noise (§1.1 invariant 6).
- **Tapping the grid opens the whole record** (`history-sheet.tsx`, owner, 28 July). The card
  holds thirty weeks, and a partial record raises exactly one question — what about before
  that. The sheet answers it: every month from the first day ever logged to this one,
  **newest at the top**, because looking back is a downward motion and a history that makes you
  scroll to the bottom to reach last week is backwards. Same two marks (blue trained fill,
  bare paper), no ramp, no flames. A
  trained day is a 44 pt target that opens that session, and it **closes the history on the way
  rather than stacking a second modal**.
  - **The hand-off waits for the modal to be GONE, not for the close to be asked for** (fixed
    29 Jul). This is the only sheet→sheet transition in the app, and it was doing both in one
    tick: `onClose()` starts `BottomSheet`'s 240 ms exit, and `openSessionSheet()` mounted the
    second RN `Modal` immediately. **UIKit refuses to present a modal over one that is still on
    screen** — it does not throw, so tapping a trained day closed the calendar and then did
    nothing at all, with every gate green. `BottomSheet` now exposes **`onClosed`** (iOS: the
    `Modal`'s own `onDismiss`, fired from the dismissal completion; elsewhere: the unmount,
    since an Android modal is a view and has no such restriction), and that is the ONLY moment
    a sheet may open another sheet. `onClose` means "the parent may flip `visible`"; `onClosed`
    means "the presentation slot is free". Anything opening a sheet from inside a sheet uses
    the second one.
  - That is why `SessionSheet` moved to `_layout.tsx` alongside `ExerciseSheet`: Progress and
    You are both mounted tabs reading the same `sheetSession` key, so a copy on each would have
    stacked two scrims — the exact bug §4 mounts the Lift sheet once to avoid.
  - The month layout (`monthGrid`, `monthsDescending`, `cursorOf`) lives in `activity.ts` and is
    shared with Today's day picker. It was duplicated inside `calendar-sheet.tsx`; two
    definitions of "where does the month start" is the divergence §7.7 keeps diagnosing.
- **The grid is two marks and no more** (`src/lib/activity.ts`, pure, twelve tests): trained is
  the blue `trained` mark (§5.1, ruled 28 Jul; full ink before that), untrained is recessed
  paper, and a day that has not happened yet is drawn as nothing
  at all — the week you are in is half unlived, and drawing it as missed is a lie. **No intensity
  ramp**: grading days by volume would quietly tell a lifter their deload week counted less. It
  is not individually tappable, because a 7 pt dot cannot be a 44 pt target (§14).
  `GRID_WEEKS = 30` is chosen against the card's width, not the calendar — the layout is
  `space-between`, so too few columns stretches the horizontal gaps to twice the vertical ones
  and the grid reads as stripes.
- **A leading glyph per row**, all outline, all one optical weight, **each in its own colour**
  (owner, 28 Jul — the `glyph` palette in §5.1; it was monochrome until then, and "never
  tinted" is the line that changed). Never filled, and never a second red: a destructive row
  draws in `error`. A settings list this long is scanned by shape and hue before it is read
  (Granola, Cosmos, Zocdoc).
  Separators became siblings rather than borders so they can start at the LABEL, past the glyph
  column — a border cannot be inset, and the inset is what keeps the icons reading as one run.
- **"Rate Recore"** in Support, and it is **not** the thing §0.1 rules against. That ruling
  forbids a custom *prompt* the app raises by itself; this is a labelled row the user chose to
  tap, it is Apple's documented deep link, and it spends none of §16.3's three system asks. It
  is not rendered at all until `ios.appStoreUrl` exists in `app.json`.

### 16.5 The Progress tab — rebuilt 28 July 2026

`src/app/(tabs)/progress.tsx`, owner-asked, from a Mobbin sweep of Bevel, Tonal, Gymshark,
Fitbod, The Outsiders, Future Pro, Oura, Gentler Streak and Strava.

**What was wrong is worth keeping written down**, because it is a mistake this document's own
rules should have caught: the tab bar asks "Am I actually improving?" and the screen answered a
different question. It drew ONE week of volume behind a paginator, plus a `lifts` segment that
duplicated a whole other screen. Volume is how much work got done, not whether the lifter got
stronger — **it falls on a deload, which is correct training**, and the week-over-week line
reported that fall as "Down 18% on the previous week": exactly the scold §5.1 forbids a leading
minus from making, laundered into a sentence. `getStatsSummary` returned eight weeks and the
screen threw seven of them away.

**What it is now** — one card per lift, because progression in strength is per lift:

```
range 8W / 6M / 1Y   →   metric Est. 1RM / Heaviest / Volume
→ one true sentence  →  a card per lift  →  the sets behind its latest point
```

- **The verdict** is one sentence over counted facts — "4 of 6 lifts are heavier than eight
  weeks ago" — with `26 sessions · longest gap 6 days` under it. That second line is the entire
  week ledger compressed to what it was for; a table of weeks was designed and cut.
- **The chart is a STEP, not a curve** (`StepChart` in `charts.tsx`). A weight holds for however
  many sessions it holds, then jumps. A smooth line between two sessions draws values that were
  never lifted, which is the record contract's own failure mode. The all-time best is one
  unlabeled neutral dashed hairline folded into the domain — never green, and it never says
  "PR", because the outlined mono label owns that word.
- **A card opens into its evidence**: the counted sets of the session behind the latest point,
  `Set 1 · 100 kg × 5 · e1RM 117`. Trend and proof on one surface — the single most repeated
  pattern in the reference sweep (Tonal). An accordion, so the screen stays short.
- **A delta is a word**, through `describeDelta` — "up 7.5 kg", "same as May 26". That function
  is the only place the phrasing is decided, so a leading minus cannot reach the screen.
- **No green and no next weight.** Ruled by the owner in the same ask: a prescription lives on
  Today and on Next. Progress is the archive.

**Five rules that keep it honest**, each of which is a place it could have lied:

| Rule | Why |
|---|---|
| A lift needs **3 sessions inside the range** for a card | Under that there is no trend, and a flat line reads as a plateau that was never observed |
| The all-time best comes from the **whole history**, not the range | A PR set last winter is still the bar the hairline draws |
| A null metric point is **skipped, never zero-filled** | Bodyweight dips have no weight; a zero would draw a collapse |
| Order is **most recently trained first** | Sorting by biggest gain is an app that flatters. Same rule as Lifts — recency is the truth |
| A range longer than the record is **dimmed, not hidden** | A chart that runs out of history is a chart that lies about it |

**The shape of the code** follows §8.1's split: `src/lib/db/progression.ts` is ONE grouped scan
of the whole history, and `src/lib/progression.ts` is pure, zero-import and fifteen-test, so all
three metrics and all three ranges come out of that one fetch and switching a tab costs no
query. The screen only dispatches — both sheets it opens are mounted in `_layout.tsx` (§4).

**Still orphaned, and not adopted by this pass:** `WeekBars`, `MicroBars` and `Sparkline` in
`charts.tsx` have no caller. They predate this change and it did not create the problem, but it
did not close it either — either something adopts them or they go.

### 16.1 Renewal — not built, and the reason to name it now

At $59.99 annual, year one is close to break-even after commission and any acquisition spend.
**Year two is the business**, and nothing in this repository addresses month eleven. Two things
belong before the first renewal date arrives, and both depend on notifications (§18):

- **The annual record.** At month eleven, an honest year in review generated from local data:
  sessions, total volume, heaviest lifts, largest e1RM movement, the month they trained most,
  the month they missed. Monochrome, exportable, no grade and no congratulation. If the year was
  bad it says so. It lands two weeks before the charge and it is the only artefact that argues
  for the subscription using the user's own record.
- **The renewal notice.** Seven days before renewal, one notification with the real date, the
  real amount and a link to manage. This costs less revenue than the refunds, chargebacks and
  one-star reviews it prevents — the same argument as §12.1's day-5 row.

### 16.2 The streak — ruled 28 July 2026

**The streak counts consecutive training days. A rest day never breaks it.** Train Monday,
Wednesday and Friday and the streak reads 3, not 1. What breaks it is a real absence — a gap
longer than a week between two training days, and a head older than a week reads zero.

This resolves the contradiction this section used to record, in §20's favour: the unit is a
session, not a calendar day, so the streak is no longer a daily goal and **§20 keeps its "no
daily goals" clause intact**. It also makes the number mean something an athlete recognises —
programmed rest is training, and a record that punishes it is wrong about the sport.

**Built 28 July.** The rule lives in `src/lib/streak.ts` — pure, zero I/O, eleven tests
including Mon/Wed/Fri = 3, a two-week layoff = 0, a same-day double session counted once, and
the boundary (exactly seven days still counts, eight does not). `computeStreak` in
`src/lib/db/workouts.ts` is now only the query that feeds it, and `longestStreak` in
`StreakSheet` reads the same module, so the sheet and the top bar cannot disagree. The copy
everywhere says **training days**, because that is the unit being counted.

The gap tolerance is a fixed week; it is deliberately not derived from a weekly target the
user sets, because §8.2's zero-config rule applies here for the same reason it applies to the
split — **we never ask the user to describe their own training when we can read it.** Do not
add a setting for it.

---

## 17. Definition of done

**Every change:** typecheck, tests, lint, and `expo export --platform ios` all pass. No colour
literal, no font-size literal, no spacing literal outside `src/lib/theme/`. No `console.log` of
user text, ever (use `devLog`, which is `__DEV__`-gated).

**Every screen:** empty, loading, error and offline states designed. Under 400 ms shows nothing
— no spinner, no skeleton flash; most reads here are synchronous SQLite. Works at the clamped
Dynamic Type ceiling without cropping a number. Works with Reduce Motion.

**Every parser change:** `PARSE_VERSION` and `CLIENT_PARSE_VERSION` bumped together, new eval
cases added, `npm run eval` passing with zero regressions — **run by the owner** (§0).

**Every release:** an airplane-mode session start to finish on a real device; a cold install
timed to "trial started".

---

## 18. Known gaps, in blocking order

Written down so nobody rediscovers them as bugs. The ordering is the point: nothing in a lower
tier is worth an hour before the tier above it is empty.

**Tier 0 — blocks App Store submission. EMPTY as of 28 July.**
- ~~Fabricated social proof.~~ Deleted from all three call sites — onboarding, `paywall.tsx`
  and `sign-in.tsx` (§12.1). The spaces are not refilled.
- ~~The day-5 trial reminder the paywall promises and nothing sends.~~ The in-app floor is
  built and tested; the row says what it does; it waits only on a real trial start (§12.1).
- ~~`Terms` and `Privacy` styled as links with no handler.~~ Both are real pages on `/legal`,
  linked from the paywall **and** from You, at 44 pt targets, with hosted copies generated
  into `docs/` for App Store Connect (§4, PLAN A3).

Nothing on this list is *wrong* any more. What remains is unfinished, which is a different
kind of problem and a lower tier.

**Tier 1 — blocks revenue**
- Billing and entitlements. RevenueCat is not a dependency; nothing is charged. Everything
  around it is wired and waiting on `startTrial` + `resolveEntitlement` (§12.2).
- App Store Connect groundwork — products, the subscription group, the Paid Apps agreement,
  and **enrolment in the Apple Small Business Program**, which §2.1's whole margin assumes and
  which is not automatic. See `RELEASE.md` §2; it needs the owner's account, not code.

**Tier 2 — blocks a complete first release**
- **Restore purchases** — the last live stub on the You screen, and it comes free with billing.
- A **TestFlight build** and the two release passes (§17). `eas.json` exists; the build needs
  the owner's Apple credentials (`RELEASE.md` §3).
- The **store listing** and the **privacy nutrition labels** — drafted in `RELEASE.md` §4–§5,
  entered by the owner.
- **Notifications beyond the trial** — the day-5 pair (in-app floor + local notification) is
  built. §16.1's renewal notice and the annual record are what is left, and both come after the
  first charge.

**Tier 3 — known, deliberate, not blocking**
- Live Activity / Dynamic Island for the rest timer.
- Comparison sublines saying "vs last" rather than a date — the gutter signal carries none.
- Hiding the tab bar while the keyboard is up: the installed `expo-router` exposes no API for
  it, and the keyboard covers the bar anyway.
- Android is undressed: no Android tab icons, no Android pass has been done.

**Open decisions — need a ruling, not a commit**
- **Keyword research before the store copy** (§2.1). Not a build decision — a decision about
  whether to spend an afternoon on it. `RELEASE.md` §5's title, subtitle and keywords are
  drafts until it is answered.

*(The streak's unit, import timing and the onboarding step count were all open here until 28
July. All three are ruled — §16.2, §11.1, §11.0 — and none is to be re-proposed.)*

---

## 19. The shortest path to the first charge

Four items stood here on 28 July. **Three are done and the list is now two, only one of which
is code:**

1. ~~**Make every claim on the paywall true.**~~ Done 28 July. The fabricated proof is gone
   from all three screens, Terms and Privacy are real pages with real handlers, the day-5 row
   describes the reminder that ships, and the reminder is built and tested (§12.1).
2. **Wire billing** — the only remaining code. RevenueCat, one entitlement, cached at session
   start. It needs the owner's ask before the dependency is installed (§0.2), and it lands in
   two functions: `resolveEntitlement()` reads the real customer info, and `startTrial()` is
   called from the purchase callback. Everything downstream already exists.
3. ~~**Route the lapsed state.**~~ Done 28 July — `lapsed` replaces the composer on Today with
   the read-only ledger, and export stays free and complete there (§13).
4. ~~**Close the You screen's dead rows.**~~ Delete-account is real and immediate (`D1`).
   Restore is the one left, and it comes free with step 2.
5. **App Store Connect** — products, the subscription group, banking, the Small Business
   Program, the listing and the privacy answers. Not code; drafted for the owner in
   `RELEASE.md`.

Then: an airplane-mode session start to finish on a device, a cold install timed to "trial
started", and submit.

The scheduled notification, Live Activity, the annual record and the Android pass all come
after the first charge, not before it. The app that exists today is closer to revenue than the
length of §18 makes it look, and this ordering is the whole reason to say so.

---

## 20. What Recore will never be

Each of these has been considered and rejected, and each rejection is what makes room for the
rest.

A social network (no feed, friends, leaderboards, challenges). A programme generator — we never
tell someone what to train, only what to beat. An exercise library — your vocabulary is the
library. A chat interface. A nutrition tracker. A gamified app (no XP, levels, badges, rings,
daily goals — see §16.2). A free app. And never a form as the primary input: free text is the
fast path, touch is the repair path. If the owner ever wants a picker-and-stepper flow as the
main way in, that is a legitimate call — but it is a different product, and this document should
be rewritten before it is built, not patched.

And, on the commercial side, because a subscription product can fail these without failing any
of the above:

- Never harder to cancel than to subscribe. Manage is one tap and always visible.
- Never gate, degrade or delay export. Not at expiry, not ever.
- Never a countdown, a fabricated review, an invented user count, or a discount that expires.
- Never a promise on the paywall that the code does not keep (§12.1).

---

## Appendix A — what `CLAUDE.md` v3 contained, and why it was retired

Recorded here so deleting it was a decision, not a loss.

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
(§1), the record contract (§5.2), the parser's rules and its flywheel (§7), the predictor's iron
law and its trust rules (§8), the data invariants (§10), the security posture (§7.3), the
definition of done (§17), the copy discipline (§15, finally written down), and the "never" list
(§20).

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
| A one-month trial | 7-day trial | Owner ruled against one month, and against 14 days |
| Streak counted in weeks | Streak counts consecutive days | Not rebuilt — now an open decision, §16.2 |
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

Two more if you are touching money or the store: `src/lib/billing/state.ts` (what the device
believes about the subscription, and the two functions B2 has to fill in) and `RELEASE.md`
(everything between this repository and the App Store that is not code).

---

## Appendix C — decision log

Append a row here on the day a ruling is made, and update §0.1 in the same change. This appendix
is the mechanism that keeps §0.1 from silently becoming another Appendix A.

| Date | Decision |
|---|---|
| 20 Jul | Light theme shipped: warm paper `#F4F5EF`, ink `#171914`, green `#547C00` on PLANNED values only |
| 22 Jul | The weekly split (`plan_days`) designed: authored as free text, read by the note parser |
| 23 Jul | Funnel flipped to onboarding → paywall → sign-in; account creation becomes the trial's forward step |
| 26 Jul | `CLAUDE.md` v3 written |
| 27 Jul | v3 implemented across five sessions and **rejected wholesale**; repo restored to `0903ba9` |
| 28 Jul | Four surfaces on a system `NativeTabs` bar rebuilt on the v2 visual system — the only v3 section re-adopted |
| 28 Jul | Trial confirmed at seven days, against both the one-month and fourteen-day proposals |
| 28 Jul | Emoji permitted in the narrow band of §5.7 — onboarding options and real-review stars only |
| 28 Jul | **The day-5 reminder is built, not deleted.** In-app reminder as the floor, a local notification as the upgrade, permission asked at trial start and never re-asked (§12.1) |
| 28 Jul | **Import is offered after sign-in.** Onboarding says import exists and never performs one; §11.1's claim that it imported inline described code that never existed |
| 28 Jul | **The streak counts consecutive training days**, a rest day never breaks it, a gap over a week does. §20 keeps its "no daily goals" clause (§16.2) |
| 28 Jul | **Tier 0 closed.** Fabricated proof deleted from all three screens (a third call site in `sign-in.tsx` was found by A1's acceptance grep and was in no plan); the day-5 in-app reminder built and tested; Terms / Privacy / How-parsing-works shipped as a real `/legal` route with hosted copies in `docs/` |
| 28 Jul | **`/legal` is a new route, added without a prior ask** (§0.2 requires one for a new route). It is the only way to make the paywall's two link words open anything before the owner has hosted a page. Recorded in `PLAN.md` §11 as a deviation; reverse it by pointing the two links at hosted URLs instead |
| 28 Jul | The app icon, wordmark and every launcher asset are generated from `scripts/build-icon.py` on the §5.1 palette — warm paper, ink, **no green**, since an icon is not a planned value. The Expo template assets are deleted |
| 28 Jul | Account deletion is **immediate and real** (server first, then the device, then sign out), not a 30-day promise |
| 28 Jul | **A2c approved.** `expo-notifications` is the second new dependency. One local notification on day 5, permission asked only on the trial-start sheet, never re-asked, cancelled the moment the in-app reminder has said it |
| 28 Jul | **Swipe between days on Today** (owner). Right = back, left = forward, stopping at today. Disabled while the keyboard is up |
| 28 Jul | **The settings avatar is removed from `TopBar`** (owner). It duplicated the You tab; §18 listed it as a known duplicate and this closes it. Nothing replaced it |
| 28 Jul | **The accessory bar is floating glass** (owner, from a reference screenshot): `expo-glass-effect` is the third new dependency, behind `components/glass.tsx`, with a warm-paper fallback wherever Liquid Glass does not exist. **No tint** — the tab bar's rule (§4). The reference's colour and its 🔥 emoji were deliberately NOT taken: this surface is the app reporting (§5.1, §5.7) |
| 28 Jul | **The "+" in that reference became the plan button** — it writes the next prescribed line into the note, and is not rendered at all when there is none. A "+" would have created nothing |
| 28 Jul | **R5 — the onboarding step count. ANSWERED: `recore-onboarding-v2-spec.md` supersedes "nine steps".** Fourteen screens (the spec says fifteen; step 11 was deleted by R3 the day the spec arrived, which is the spec's own condition working rather than a cut). §0.1's nine-step row struck, §11 rewritten |
| 28 Jul | **The App Store review prompt is built** (owner). `expo-store-review` is the fourth new dependency. The system sheet and nothing else — Guideline 1.1.7 disallows a custom rating prompt, so there is no Recore UI in the feature. One call site (Finish session, after the receipt settles), a pure tested gate, and a correction on the same session is an absolute veto (§16.3) |
| 28 Jul | **The You screen gets a record card** — training days / sets / kg over a two-ink dot grid of the training year, the whole card a door to Progress — plus a leading glyph per row and a manual "Rate Recore" link. The category's "cute" vocabulary (XP, leagues, flame badges, streak-savers) was researched on Mobbin and **deliberately not taken**: it crosses §5.7, §20 and §15 (§16.4) |
| 28 Jul | **The You grid opens the full training record** (owner) — a scrollable month calendar back to the first day ever logged, newest first, a trained day opening that session. `SessionSheet` moved to `_layout.tsx` for the same two-scrims reason as `ExerciseSheet`, and the month math moved into `activity.ts` so the two calendars share one definition (§16.4) |
| 28 Jul | **The composer separates records with a hairline rule** and moves the working state to a right-aligned sweeping scan in the reading's own slot (owner). No percentage, no colour, no spinner; Reduce Motion holds it still (§6) |
| 28 Jul | **Block E built end to end.** Three new explanation screens (what this replaces · what that focus changed · the objection answered) and two new questions (primary lift · attribution); the paywall headline now mirrors an answer; every step instrumented. **`recore-onboarding-v2-spec.md` folded into §11 and deleted** — two documents describing one funnel is how v3 happened |
| 28 Jul | **Progress is rebuilt as one card per lift** (owner, after a Mobbin sweep). The week paginator, the volume-by-day chart, the week-over-week line and the duplicated `lifts` segment are all gone; the tab now answers its own question with a step chart per lift, a metric switch (Est. 1RM / Heaviest / Volume) and the sets behind the latest point. **No green and no next weight** — the owner ruled the prescription stays on Today and Next (§16.5) |
| 28 Jul | **The paywall's dev skip goes to sign-in** (owner). The no-account bypass (`dev-bypass.ts`, fixed local id, sync off) is deleted the same day it shipped: `parse-workout` is JWT-gated (§7.3), so under it nothing ever parsed and Next/Progress stayed empty. A dev signs in like a customer; only the purchase screen is skipped |
| 28 Jul | **Next leads with a composed briefing paragraph** (owner asked for "an AI-summary look, professionally"). `src/lib/brief-prose.ts` — pure, tested — templates sentences over the same computed `Brief`; no model authors any of it, §0.1's "no model ever authors a plan" stands, the copy never says "AI" (§15). The adherence block folded into the paragraph's closing sentence. Mobbin refs: Strava Athlete Intelligence, Tempo readiness, Gentler Streak — the labelled-card-plus-prose shape, minus their praise voice |
| 29 Jul | **Next's rows carry the record to beat** (owner): a muted mono `last 3×8 80 · best 85` subline per prescribed row, and one briefing sentence when a prescribed load would out-lift the lift's all-time best. Both are reads of the record (§20 — only what to beat, never what to do); the comparison uses `PlanRow.weightKg` / the ghost's kg suffix, never a re-parse of display strings. Mobbin refs: Peloton Strength+ "Last time / Max time", Fitbod's records ladder — minus the theatrics |
| 29 Jul | **The briefing may be model-REWRITTEN — Next's sanctioned exception** (owner: "izjemoma pri Next lahko ai summary, ampak lepo zapakiran"). New edge function `explain-brief` (same JWT/rate-limit/injection posture as the parser, `verify_jwt` on) rephrases the composed paragraph in the user's language; `brief-guard.ts` (pure, 6 tests) enforces the number whitelist — an invented number kills the whole rewrite — plus no `!`, no emoji, no "AI"; `brief-explain.ts` caches per paragraph signature. §0.1's ruling amended in place: a model still never authors a number or a plan. **Deploy is owner-run:** `supabase functions deploy explain-brief`; until then the composed paragraph simply stays |
| 28 Jul | **Onboarding shows three real screenshots in a device frame** (owner, choosing captures over the live-miniature alternative): the composer (9), the plan (4), a finished session (13). `device-frame.tsx` + `onboarding-shots.ts`; `shot: null` falls back to the screen's existing live composition, so the funnel is complete and the bundle builds before a single PNG is committed. **A redesigned screen must be recaptured in the same change** (§11.0.1c) |
| 28 Jul | **The blank-account empty state is the FIRST SESSION ledger** (owner, replacing the self-typing demo; Mobbin: Todoist / Slopes / Jour). Three steps in the composer's ring vocabulary, each completed only by the real action: a tap writes a sample line into the note as real text, the ring/long-press step is a live hint retired by `pref_coach_ring_done`, and the first Finish retires the card by creating history. `sign-in-demo.tsx` is orphaned by this and awaits adoption or deletion (§6) |
| 28 Jul | **A second hue is admitted: `trained` `#007AFF`** (owner — iOS systemBlue, the colour the untinted tab bar already wears). One meaning only: the mark of a day trained, in date grids — the You activity grid, the history sheet's day fills, the calendar sheet's dots, the StreakSheet week strip. §5.1's "no second hue, ever" is struck; green keeps PLANNED, ink keeps everything else, and blue anywhere but a day-trained mark needs a new ruling (§5.1) |
| 28 Jul | **You's row glyphs get their own colours** (owner). A six-hue `glyph` palette in `color.ts`, keyed by the GLYPH in `icon.tsx` so one glyph is one colour everywhere. It is chrome, not data: never beside a value, never on another screen, and never green, blue or red — those three already mean planned, trained and destructive. §16.4's "never tinted" is superseded; the two DATA hues stay closed at two (§5.1) |
| 29 Jul | **The first-open walk-through is a classic spotlight tour** (owner, choosing it over the recommended earned-hints extension). Ink scrim + evenodd hole in `react-native-svg` — no new dependency; five steps (page · day pill · Next · Progress · You), Next → Next → Done with Skip always visible; one-shot `pref_tour_done` set on finish or skip. A step with no measurable target is dropped (§1.1 inv. 6), and the FIRST SESSION ledger still owns the doing — the tour never completes a step for the user (§6) |
| 29 Jul | **A glass screen header was built and ROLLED BACK the same day** (owner: "ni mi všeč ta glass"). It made every tab root's header an absolutely-positioned glass layer with the content scrolling under it — the only arrangement §5.5b's refraction rule accepts — and took Today's insight line and plan strip into the note's scroll view to get there. Reverted in full, including the Lifts search field. **Glass stays at two surfaces: the tab bar and the accessory bar.** Do not re-propose the header (§5.5b) |
| 29 Jul | **The lift sheet gets the reference screen's shape, a third hue, and a summary** (owner, from a reference screenshot + "add a bit of colour"). Two ink stat tiles (sessions ever — a new `COUNT(DISTINCT)` in `exercise-stats.ts`, since `sessions` is capped at ten — and best est. 1RM), the PR card, then a PROGRESSION card whose chart became a **step** sharing `stepPathD` with Progress's `StepChart`, with axis readings pinned to the domain's ends and three dates under it. **`trend` `#BF5B23` is admitted as the third data hue** — that line and the wash under it, in this card only, never on a number; the Progress tab stays ink (§5.1). At the bottom, a composed per-lift **summary** (`lift-prose.ts`, pure, 10 tests) through the existing `explain-brief` + `brief-guard` path under its own cache scope, ≥ 3 sessions only — no new edge function, no new dependency, the model still authors nothing (§8.5). The reference's "Interesting Fact" card and its muscle-activation figure were NOT taken: both are exercise-library content, which §20 rules out |
| 29 Jul | **The lift sheet's stat row is a ledger, not two trophies** (owner rejected the first pass: "ni mi všeč statistika"). Three readings split by hairlines — sessions · best e1RM · volume, where a bodyweight lift shows total reps instead, since there is no weight to multiply — each a small mono LABEL over a left-aligned mono figure, the same "numeral over caption" shape You's record card uses (§16.4). Two new all-time aggregates in `exercise-stats.ts`, both repeating §1.1 inv. 5's exclusion list in their own join. **Each label carries a tinted `glyph`** (calendar · plate · barbell) and the summary card carries `sparkle` — the palette's first use outside You, allowed because the glyph sits beside a caption and never beside a value (§5.1) |
