# Implementation status

**Audited 29 July 2026 against CLAUDE.md v5.1 and product-direction.md v5.1.
Updated 29 July 2026 with implementation-order steps 1 (billing), 2 (onboarding) and
3 (spotlight, reflections, export/deletion).**

Method: every row below was determined by reading routes, components, state, billing code and
tests in `src/`, `supabase/` and `scripts/` — not by trusting CLAUDE2.md, `CLAUDE_zastareli.md`
(the V4 inventory), PLAN.md or RELEASE.md, all of which predate V5.1 and none of which is a
product authority.

Repository gates after step 3: `npm run typecheck` **pass**, `npm test` **232/232 pass**,
`npm run lint` **pass**, `npx expo export --platform ios` **pass**.

Updated 30 July 2026 with the §9 Next-brief visual/composition pass (dated "YOUR BRIEF" hero
card, week-first paragraph with a composed watch close, last → planned prescription rows,
`FadeSwap` rewrite landing, `markBriefShown` counters). Gates after it: typecheck **pass**,
`npm test` **239/239 pass**, lint **pass**, iOS export **pass**. The composed paragraph the
model rewrites CHANGED SHAPE in this pass — per CLAUDE.md §5 this is an AI-summary change and
the §9.4 owner-run evaluation for the brief still does not exist, so the rewrite path is **not
fully verified** until the owner exercises it (or accepts it) explicitly.

---

## Release blockers

These are places where shipped code actively violates an invariant in CLAUDE.md §2/§3 or a
promise in product-direction §2/§6. None of them is a TODO.

| # | Blocker | Where | Why it blocks |
|---|---|---|---|
| **B4** | **Fabricated 4.9 rating and testimonial components are still in the bundle.** `Rating` defaults to `score = 4.9`, `Testimonial` renders a five-star row for arbitrary quote/attribution. Currently unimported, but present and exportable. | `src/components/primitives.tsx:191–247` | CLAUDE.md §3: "No fabricated reviews, ratings, user counts, testimonials … **anywhere, including placeholders**. A hardcoded fake testimonial is a release blocker, not a TODO." The three call sites were correctly removed on 28 July; the components were not. **Still open: it is not an onboarding surface either.** It is a two-line deletion whenever the owner wants it taken. |

### Cleared by steps 1–3

| # | Was | Now |
|---|---|---|
| **B5** | The onboarding "Building your ledger…" screen ran a 2,600 ms timer over a progress bar and five checkmarks, for work that had already happened. | **Deleted.** §4.3 bans fake loading and §5.2 names exactly this screen as the counter-example to useful personalisation. The reveal it delayed now arrives immediately. |
| *(honesty note)* | `StepReady` echoed `Focus: hybrid · hyrox` for anyone who picked "Both" — a sport the user never mentioned. | The echo states the answer they actually gave (`GOAL_ECHO`), and every row appears only when the person answered it. |
| **B1** | Trial, price, charge date and cancellation copy shipped with no store integration. | `react-native-purchases` 10.5.0 is installed and wired. **Every price on screen is `PurchasesStoreProduct.priceString`** — Apple's own localized string. There is no hardcoded price left anywhere in `src/`: the fallback constants were deleted rather than kept, so an unreachable store shows no amount at all. The charge instant comes from the entitlement's `expirationDateMillis`, not from local arithmetic. |
| **B2** | Restore was an `Alert` that restored nothing. | `Purchases.restorePurchases()` on both surfaces plus the lapsed screen, with three distinct truthful outcomes (restored / nothing attached / could not reach the store). |
| **B3** | Monthly said "no trial". | Both plans read their trial length from the store's own introductory offer, and the CTA states it. A product configured without one drops the trial promise instead of contradicting App Store Connect. |
| **B6** | You said "Beta · billing off / Everything is unlocked". | The row shows the store's own state — Free trial / Active / Not active / Not confirmed — with the real renewal or charge date under it when the store reported one. |

---

## Structural findings

| Finding | Detail |
|---|---|
| **The product direction is not at the path CLAUDE.md declares.** | CLAUDE.md §1 and its reading table point to `docs/product-direction.md`. The file lives at `recore/product-direction.md`. `docs/` currently holds only generated legal HTML. |
| **Three superseded documents still present themselves as authoritative.** | `CLAUDE2.md` ("as it actually is", 28 Jul) and `CLAUDE_zastareli.md` (V4) both open by declaring themselves the current description. `PLAN.md` (50 KB) and `RELEASE.md` are pre-V5.1. Only `CLAUDE_zastareli.md` has a sanctioned role (V4 = inventory and test gates). |
| **Section numbering in code comments refers to the V4 document.** | Most files cite "§12.1", "§15", "§20", "§8.5" etc. Those are V4 numbers, not V5.1 numbers. Any V5.1 work will need to re-anchor them or the comments become misdirection. |

---

## Section 2 — Commercial model

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Subscription product from first release | **done** | `package.json` (`react-native-purchases` 10.5.0), `src/lib/billing/store.ts` | The only file importing the SDK. Everything above it speaks in `Plan` / `EntitlementSnapshot` / outcome words. |
| One free trial for eligible subscribers | **done** | `src/lib/billing/store.ts` (`trialDaysOf`), `src/app/paywall.tsx` (`timelineFor`, `ctaLabel`) | The length is read from the product's introductory offer. Apple decides eligibility per subscription group, so a returning subscriber is shown the price with no trial rather than a promise the store will not honour. A non-zero introductory price is treated as a discount, never as a trial. |
| Both plans start the same trial | **done** | `src/app/paywall.tsx` (`PlanCard` sub line, `ctaLabel`), `src/lib/legal.ts` | Owner action required: **both products need the 7-day introductory offer configured in App Store Connect** (SECURITY.md step 8). The app states what the store offers; it cannot create the offer. |
| Annual may be preselected under §6's four conditions | **done** | `src/app/paywall.tsx` (`useState<Plan>('annual')`, `PlanCard`), `src/lib/billing/pricing.ts` (`savePct`, `perMonth`) | Both cards are the same component, size and target; annual shows its real total and true per-month; the saving is computed from the two live prices and the badge **disappears** when the comparison cannot be made honestly; switching is one tap. |
| Trial attaches to an account; account after plan selection | **done** | `src/lib/billing/store.ts` (`configureStore`, `attachStoreToAccount`), `src/app/paywall.tsx` (`pendingPurchase`), `src/lib/auth/provider.tsx` | The SDK configures anonymously so the paywall can show real prices **before** sign-in, then `logIn(userId)` aliases the customer. `purchasePlan` refuses to buy while anonymous. The CTA sends a signed-out user to sign-in and completes the purchase when the session lands. |
| Hard paywall after trial ends | **done** | `src/lib/billing/entitlement.ts`, `src/app/(tabs)/today.tsx:65–74` | Verified-inactive, or nothing cached, resolves to `lapsed` and Today becomes read-only. The V4-era "assume entitled when unverifiable" default is gone. |
| Offline behaviour does not lock out a paying subscriber | **done** | `src/lib/billing/entitlement.ts` (`decideEntitlement`, `GRACE_MS`), `src/lib/billing/entitlement.test.ts` | Owner's ruling, 29 Jul: last known state plus a **seven-day grace** past the verified expiry. Keeps CLAUDE.md §2 invariant 1 true without softening the paywall. 11 unit tests cover every edge. |
| Price, renewal, trial-end date, legal links, Restore, Manage always truthful and reachable | **done** | `src/app/paywall.tsx`, `src/app/(tabs)/you.tsx`, `src/components/read-only-ledger.tsx`, `src/lib/billing/store.ts` (`managementUrl`) | Manage is now on the paywall too (§6 "when applicable"), and uses the customer-specific URL when the store supplies one. An unreachable store shows **no price and a disabled CTA** with a sentence saying why. |
| **§2.1** Funnel order (onboarding → paywall → account → trial → import fast path → walkthrough → Today) | **done** | `src/app/index.tsx` (dispatcher), `src/app/paywall.tsx`, `src/app/import-start.tsx`, `src/components/spotlight-tour.tsx` | The whole chain is wired. The walkthrough runs on Today, which a tracker user now reaches *after* import — so §7's "the tour can point at real data" holds by ordering, with no code in the tour. |
| **§2.1** Personalised paywall headline from a real answer | **done** | `src/app/paywall.tsx` (`headlineFor`) | Unchanged by step 2. |
| **§2.1** Tracker-import fast path after trial start | **done** | `src/app/import-start.tsx`, `src/lib/onboarding.ts` (`wantsImportFastPath`), `src/app/index.tsx` | Offered once, only to Strong/Hevy users, only when entitled, and only if they did not already say they would rather just write. Skipping is one full-size tap with no confirmation and no second ask — `markImportOffered` fires on arrival, not on success. |
| **§2.2** Lapsed state: record readable, export ungated | **done** | `src/components/read-only-ledger.tsx`, `src/app/(tabs)/today.tsx:65–74` | Only Today's composer is replaced; other tabs untouched. |
| **§2.2** Lapsed state shows the person's own real numbers | **done** | `src/components/read-only-ledger.tsx` (`rangeLabel`, `ledger`), `src/lib/db/ledger-size.ts` | Session count and the date range they span, as the largest element on the screen. One synchronous local read, so it is complete offline — the state it most often appears in. No countdown, no guilt line, no expiring offer. |
| **§2.2** Lapsed state distinguishes its reasons | **done** | `src/lib/billing/entitlement.ts` (`LapseReason`), `src/components/read-only-ledger.tsx` (`explanation`) | Beyond the spec, and it earns its keep: telling a paying customer "your subscription ended" when the truth is "we could not reach the App Store" is how a refund request starts. Three branches: `expired`, `never`, `unverified`. |
| **§2.2** Restore and Manage directly reachable from the lapsed screen | **done** | `src/components/read-only-ledger.tsx` | Restore is listed first — for the `unverified` case it is the single tap that resolves everything. |
| **§2.2** One honest notice before the charge | **done** | `src/lib/billing/trial.ts` (`REMINDER_LEAD_DAYS`, `trialClockAt`), `src/components/trial-reminder-sheet.tsx`, `src/lib/billing/notifications.ts` | Both instants now come from the store. The window is expressed as a **lead time before the charge**, not "day 5", so it stays correct for a trial of any length — including the compressed sandbox trials the owner will test with. At most one notice; the in-app sheet cancels the scheduled notification. |

---

## Section 3 — Navigation

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Four tabs: Today · Next · Progress · You | **done** | `src/app/(tabs)/_layout.tsx` | Native `UITabBarController` via `expo-router/unstable-native-tabs`. |
| Lifts is a push from Progress and Today | **partial** | `src/app/(tabs)/next.tsx:265–280`, `src/app/lifts.tsx` | `/lifts` is pushed from **Next**, not Today. Progress opens the per-lift sheet instead. |

---

## Section 4 — Visual direction

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| **§4.1** Warm-paper light theme, system type, generous space | **done** | `src/lib/theme/color.ts:34–52`, `src/lib/theme/type.ts`, `src/lib/theme/scale.ts` | |
| **§4.2** Recore blue is a visible product accent (selection, focus, active controls, walkthrough emphasis, recorded-progress charts) | **contradicts** | `src/lib/theme/color.ts:8–16,41` and comment; blue used in exactly 4 files: `you.tsx`, `calendar-sheet.tsx`, `history-sheet.tsx`, `streak-sheet.tsx` | The theme file still encodes the **V4** rule ("blue appears ONLY as the mark of a day trained"), which product-direction §14.1 explicitly overrides. Onboarding selection, paywall selection and focus states all use ink (`color.accent` `#171914`). |
| **§4.2** Charts may use a blue primary series with a soft fill | **contradicts** | `src/components/charts.tsx:57,144,178,278–289` | Every chart draws in `color.accent` (ink). `StepChart` is explicitly ink "until the owner says otherwise" — that ruling is superseded by §14.1. |
| **§4.2** Planned green only on a future prescription, with label | **done** | `src/lib/theme/color.ts:40`, `src/app/(tabs)/next.tsx:196–199,361–364` | |
| **§4.2** Trend ember as optional secondary comparison | **done** | `src/lib/theme/color.ts:42`, `src/components/exercise-sheet.tsx` | Confined to the one-lift progression card; never on a number. |
| **§4.2** Red only destructive/errors | **done** | `src/lib/theme/color.ts:51` | |
| **§4.3** Press-in/release, sheet spring, chart reveal, single value update | **done** | `src/lib/motion.ts`, `src/components/motion.tsx`, `src/components/bottom-sheet.tsx` | Shared tokens (`DUR`/`EASE`/`SPRING`) are used consistently. |
| **§4.3** Directional onboarding transitions (forward from right, Back from left) | **partial** | `src/app/onboarding/index.tsx` (`FadeSlideIn`, `Stagger`) | Vertical fade/rise, not directional. |
| **§4.3** No fake loading | **contradicts** | `src/app/onboarding/index.tsx:1265–1330` | Blocker **B5**. |
| **§4.3** Reduce Motion honoured everywhere | **partial** | `useReducedMotion` in 16 files; `src/components/motion.tsx`, `src/app/onboarding/index.tsx:1245,1265–1272` | Broad coverage; no automated check, and it is not asserted in any test. Needs the §6-step-7 device QA pass before it can be called done. |
| **§4.3** At most one celebratory moment per session | **done** | `src/lib/motion.ts:38` (`SPRING_OVERSHOOT`, "the only place a bounce is allowed"), `src/components/gutter-value.tsx` (`PrLabel` — neutral outline) | |

---

## Section 5 — Personalised onboarding (14 screens)

The flow is now the fourteen screens §5 specifies, nine of which ask a question, with a resumable
high-water mark. **The order is asserted against the specification in `src/lib/onboarding.test.ts`
rather than against itself** — the shape of drift this repository has actually suffered before.

| V5.1 screen | Status | Evidence | Notes |
|---|---|---|---|
| 1 Welcome | **done** | `StepWelcome` | |
| 2 Your name | **done** | `StepName`, `prefs.ts` | Used in paywall, Today, brief salutations. |
| 3 What are you training for? | **done** | `StepFocus`, `lib/onboarding.ts` (`Goal`, `focusForGoal`) | All five §5 answers. Owner's ruling 29 Jul: five answers are stored, three reach the engine — `fitness` and `sport` resolve to the classic middle, so **no prescription changes**. The subtitles read their rep range from the engine through the same bridge, so a screen cannot promise a range the engine does not apply. |
| 4 Your training experience | **done** | `StepExperience`, `prefs.ts` (`setExperience`), `wantsExplanation` | Changes how much a surface explains itself. Never a number: two people lifting the same weight for the same reps get the same answer. |
| 5 How do you train? | **done** | `StepStyle`, `gymLeads` | The branch key §5.1 needed and the app did not have. |
| 6 Context tailored to that choice | **done** | `StepContext` | Branches on **style first**, then goal: a sport athlete gets workload-and-gaps language, a hybrid athlete gets both, a gym lifter gets the progression story. Adds a line for someone who said they are new. |
| 7 Your current body context | **done** | `StepBody`, `parseBodyWeight`, `parseBodyHeight` | Optional weight and height plus the display unit. Stored metric whatever is typed. Empty input **clears** the value, so skipping genuinely leaves nothing behind. |
| 8 Which days do you usually train? | **done** | `StepDays`, `toggleDay`, `setUsualDays` | A Monday-first 7-bit mask. An expectation, never a target — nothing counts a miss against it. |
| 9 Favourite or priority movement | **done** | `StepLift`, `prefs.ts` | Feeds the parser demo, the paywall headline and Lifts ordering. |
| 10 How do you want training to feel? | **done** | `StepFeel` | Also carries the writing language, which §5 assigns to this screen's remit ("composer examples, vocabulary"). Keeping them together holds the flow at fourteen while keeping a question that genuinely changes the parser prompt and the brief's language. |
| 11 Current tracking method | **done** | `StepTracker` | The answer now unlocks the §2.1 fast path instead of being stored and ignored. |
| 12 What Recore will notice | **done** | `StepNotice` | Three observations built from *this person's* answers — their lift, their goal or sport, their stated week. Shows the parser reading a line, never a progression chart (§5.1 forbids a fake trend before a session exists). |
| 13 Your first week | **done** | `StepFirstWeek` | Three steps, branching on tracker and style. Describes what they will do; promises no outcome. |
| 14 Ready for your record | **done** | `StepReady` | Echoes only the answers actually given. |
| *(removed)* replaces, objection, source, building | **done** | — | `source` deleted per the owner's ruling — its own comment admitted it changed nothing the user sees, which is §5's removal criterion. `building` was blocker **B5**. `replaces` and `objection` were marketing beats with no §5 row. |

| §5.1 / §5.2 rule | Status | Evidence | Notes |
|---|---|---|---|
| Branch on fitness vs sport vs hybrid | **done** | `StepContext`, `StepFeel`, `StepNotice`, `StepFirstWeek` | Four screens read `TrainingStyle`. |
| Named lift appears in the parsing example and later in Progress | **done** | `demoNameFor`, `prefs.ts` | |
| Never show a fake progression chart before a session is logged | **done** | `StepNotice`, `progress.tsx`, `next.tsx` | |
| Weight/height optional and explained | **done** | `StepBody` | Purpose stated above the fields, and again below them: never a calorie target, body score or health judgement. |
| Not a medical intake | **done** | `lib/onboarding.ts`, `prefs.ts` | No injuries, diagnoses or calorie fields anywhere. |
| No permission prompt in onboarding | **done** | `onboarding/index.tsx`, `billing/notifications.ts`, `lib/voice.ts` | Unchanged: notifications ask at trial start, microphone on mic tap. |
| Blue progress rail + position marker | **contradicts** | `onboarding/index.tsx` (`ProgressBar`, ink selection styles) | Rail and marker exist; both are ink. Blue is **step 5's** job (§4.2) and was deliberately not touched here — recolouring selection states is the colour pass, not the funnel pass. |
| Personalised pages connect a previous answer to what comes next | **done** | `StepContext`, `StepNotice`, `StepFirstWeek`, `StepReady` | |
| Back available everywhere; all answers editable in You | **done** | `onboarding/index.tsx` (Chrome), `src/app/(tabs)/you.tsx` (Training section) | You now edits focus, experience, how you train, session style, usual days, writing language, units, smallest plate, bar weight and split, and displays body context when it exists. |
| Screen-removal criterion instrumented | **done** | `src/lib/funnel.ts`, `prefs.ts` (`setObStep`) | High-water mark plus flow length, so §5's 8 % rule is computable once real data exists. |

---


## Section 6 — Paywall, account, trial start

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Shown after screen 14, two plans, trial explained | **done** | `src/app/paywall.tsx` | Both plans state their trial from the store. |
| Plan first, then account, then store purchase, then trial | **done** | `src/app/paywall.tsx` (`handleCta`, `pendingPurchase`, `runPurchase`) | The paywall stays mounted beneath the sign-in screen, so it finishes the purchase when the session arrives — which is exactly the order §6 specifies. |
| Plan choice recorded | **done** | `src/lib/funnel.ts` (`markPlanSelected`), `src/app/paywall.tsx` | Previously discarded on navigation. |
| Do not mark a trial started until the store confirms | **done** | `src/lib/billing/state.ts` (`recordTrialFrom`) | The trial is recorded from a snapshot whose `periodType` is `TRIAL`, i.e. only when the store says so. Writing it there rather than at a call site means it also works after a reinstall, a restore, or a purchase made on another device. |
| Personalised factual headline | **done** | `src/app/paywall.tsx` (`headlineFor`) | |
| Three concrete outcomes | **done** | `src/app/paywall.tsx` (`OUTCOMES`) | Easier logging, visible progression, personal context — as capabilities, never adjectives. |
| Monthly and annual with real price and renewal text | **done** | `src/lib/billing/store.ts` (`fetchOffer`, `StorePlan`) | Apple's `priceString` and `pricePerMonthString`, in the user's storefront currency. |
| Trial promise, first charge date, cancellation explanation | **done** | `src/app/paywall.tsx` (`timelineFor`, legal line) | |
| Terms, Privacy, Restore, Manage | **done** | `src/app/paywall.tsx` | All four are real controls with real targets. |
| Honest annual preselection (four conditions) | **done** | see §2 row above | |
| No review stars, testimonials, pseudo-science, "AI magic", seven-day transformation claim | **partial** | `src/app/paywall.tsx` (screen is clean); `src/components/primitives.tsx:191–247` (components remain) | The screen complies; the codebase does not (**B4**). No user-visible string in `src/` uses "AI" as marketing — verified by grep; the only hits are code comments and guard tests. |

---

## Section 7 — First-open walkthrough

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| One-time spotlight on the first signed-in Today, skippable, never returns | **done** | `src/components/spotlight-tour.tsx`, `src/lib/tour.ts`, `src/lib/prefs.ts:271–279` (`pref_tour_done`) | Built on `react-native-svg` evenodd scrim; no new dependency. |
| Step is dropped if its target is off screen | **done** | `src/lib/tour.ts:13–19`, `src/components/spotlight-tour.tsx` | |
| Copy is one sentence, house voice | **partial** | `src/lib/tour.ts`, asserted by `src/lib/tour.test.ts` | Voice is tested (no "!", no "AI", no emoji, no instruction). Several bodies are still two sentences. |
| Step 1 — writing surface | **done** | `TOUR_STEPS[0]` | |
| Step 2 — **Finish and check-in** | **done** | `TOUR_STEPS[1]` (`id: 'finish'`), asserted by `tour.test.ts` | Teaches Finish *and* the check-in it now opens. Owner's ruling 29 Jul: it shares the `page` target with step 1 rather than pointing at the Finish button, because that button lives on the composer's accessory bar and is not on screen during the tour — §7 allows a spotlight only on a measurable target. The day-pill beat, which §7 never listed, is gone. |
| Step 3 — Next | **done** | `TOUR_STEPS[2]` | |
| Step 4 — Progress | **done** | `TOUR_STEPS[3]` | |
| Step 5 — You / calendar | **done** | `TOUR_STEPS[4]` | |
| Runs after the import fast path for tracker users | **done** | `src/app/index.tsx` (dispatcher), `src/app/import-start.tsx` | Guaranteed by ordering rather than by tour code: a tracker user is redirected to `/import-start` before ever reaching Today, and the tour lives on Today. |

---

## Section 8 — Today: the log and reflection

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Free-text writing is the primary path; parser structures what it understands | **done** | `src/components/note-surface.tsx`, `src/lib/parse/*`, `supabase/functions/parse-workout/` | |
| Unclear text stays as prose without punishment | **done** | `src/lib/parse/overlay.ts`, `src/components/gutter-value.tsx` | |
| Offline, never blocks a keystroke or finish | **done** | `src/lib/db/*` (SQLite), `src/lib/sync/index.ts`, `src/lib/parse/client.ts` | |
| **§8.1** End-of-session free-text reflection | **done** | `src/components/check-in-sheet.tsx`, `src/lib/reflection.ts` (+ test), `src/lib/db/workouts.ts` (`setReflection`) | A free-text field leading one sheet opened by Finish and re-openable from the receipt. Owner's ruling 29 Jul: **one sheet**, not two — the reflection leads and the existing per-line effort scale follows, so a finish never queues two sheets. |
| **§8.1** Optional prompts ("How did that feel?" etc.) | **done** | `src/lib/reflection.ts` (`REFLECTION_PROMPTS`), `check-in-sheet.tsx` | All four, verbatim, asserted by test. They are **placeholders, never inserted text**: tapping one changes what the empty field suggests and nothing else, so every stored character is one the athlete typed. |
| **§8.1** Reflections included in export and deletion | **done** | `src/lib/export-json.ts`, `src/lib/account/delete.ts`, `supabase/migrations/20260729000000_reflections.sql` | By construction rather than by remembering: the reflection is a **column on `workouts`**, so it inherits that row's RLS, its cascade delete, the local wipe and the JSON export. CSV stays a sets table — the JSON is the complete export and the privacy policy says so. |
| **§8.1** Next may quote a reflection without inferring causation | **missing** | `src/lib/db/brief.ts` | **Step 4.** Deliberately untouched: reflections are now captured and stored, and wiring them into the guarded brief is the next step's whole subject. |

---

## Section 9 — Next: the personal training brief

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Leads with one composed briefing paragraph, not status cards | **done** | `src/app/(tabs)/next.tsx`, `src/lib/brief-prose.ts` (+ `brief-prose.test.ts`) | Deterministic, pure, tested. 30 Jul: composed in §9's own order — the paragraph now OPENS with the week's sessions (`Brief.sessions7`, counted in `db/brief.ts`) before the coming session. |
| Answers: what happened, what is improving/repeating, what is relevant next | **done** | `src/lib/db/brief.ts`, `src/app/(tabs)/next.tsx` | Blocks disappear when they have nothing true to say. "What happened" is now answered first, in the lede. |
| Answers: a recovery/energy/reflection pattern the person reported | **missing** | — | Depends on §8.1. |
| One useful thing to watch or write down next time | **partial** | `src/lib/brief-prose.ts` (watch close), `src/app/(tabs)/next.tsx` (block-1 foot) | 30 Jul: the paragraph closes with a composed watch item — the first stall's rep-watch, carrying the engine's own deload consequence. Chosen by a priority rule in code; the §9.1 "model selects one prompt from an approved set" path (reflection check-ins) still depends on §8.1. |
| Editorial card, "YOUR BRIEF" label, provenance line | **done** | `src/app/(tabs)/next.tsx` (briefCard/briefHead/briefLede styles), `briefDateline`/`splitLede` in `src/lib/brief-prose.ts` | 30 Jul: dated editorial hero card — "YOUR BRIEF" label in Recore blue (§4.2), dateline, lede one notch over body (`type.lede`), body, and a provenance foot carrying the REAL session count (`Brief.sessions8w`). The model rewrite lands with a `FadeSwap` dip (§4.3 "a value updating once"); prescription rows read last → planned with the engine's reason visible. |
| **§9.1** Model rewrites a deterministic fact bundle only | **done** | `src/lib/brief-explain.ts`, `supabase/functions/explain-brief/index.ts` | Composed paragraph renders first, always; rewrite is a late upgrade. |
| **§9.1** Guard validates numbers, names, dates, claims | **partial** | `src/lib/brief-guard.ts`, `src/lib/brief-guard.test.ts` | Strong on **numbers** (whitelist against the source paragraph), length, single paragraph, no "!", no "AI", no emoji. Does **not** validate names, dates as dates, or banned-claim categories (diagnosis, causation, prescription, praise). |
| **§9.1** Missing/late/rejected → deterministic brief instantly | **done** | `src/lib/brief-explain.ts:73–101`, `src/app/(tabs)/next.tsx:96–102` | Fire-and-forget, never throws, cached by paragraph signature. |
| **§9.1** Key stays server-side | **done** | `supabase/functions/explain-brief/index.ts`, `src/lib/env.ts` | |
| **§9.2** Voice | **done** | `src/lib/brief-prose.ts`, `src/lib/lift-prose.ts` (+ tests) | No praise, no causation, no instruction. |
| **§9.3** Guard monitoring: counts of requests, responses shown, fallbacks, rejections by category | **partial** | `src/lib/funnel.ts` (`markBriefShown`), `src/app/(tabs)/next.tsx` | 30 Jul: model-shown and composed-shown are now counted (the fallback rate's two columns) and exported in the funnel snapshot. Still missing: request counts, rejection **categories**, thresholds, alarms — rejections still silently return `null` in `brief-explain.ts`. |
| **§9.4** Owner-run evaluation for prompt/schema/guard changes | **partial** | `scripts/parse-eval.ts` + `scripts/parse-eval-cases.json` (65 cases, `npm run eval`) | The **parser** has exactly the evaluation §9.4 describes. The **brief** prompt and guard have none — no case set, no command, no pass criteria. |

---

## Section 10 — Progress

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Factual overview of frequency, consistency, lift movement | **done** | `src/app/(tabs)/progress.tsx:110–128` | `verdictLine` + `spreadLine`; counts, never judges. |
| Time ranges 8 weeks / 6 months / 1 year | **done** | `progress.tsx:65–69` | Longer ranges dim until the record reaches back. |
| Card per lift with underlying sessions one tap away | **done** | `progress.tsx:144–`, `src/components/exercise-sheet.tsx`, `src/components/session-sheet.tsx` | |
| Metrics: e1RM, heaviest, volume | **done** | `progress.tsx:71–75`, `src/lib/db/progression.ts` | |
| Metrics: reps at a load, sport/hybrid workload | **missing** | — | No sport/hybrid data model exists (see §5 screen 5). |
| Step shape, no smoothing between values never lifted | **done** | `src/components/charts.tsx:197–228` (`stepPathD`), tested indirectly via chart geometry | Explicitly documented and correct. |
| **Blue primary line with a soft contextual fill** | **contradicts** | `src/components/charts.tsx:229–289` | Ink line, no fill. See §4.2. |
| Neutral prior-best / reference marks, readable axes | **partial** | `charts.tsx:273–289` | Reference line present; axis labelling is minimal (endpoint dates only). |
| Empty state says what evidence is needed | **done** | `progress.tsx:297` | "Two more sessions of the same lift and there's a trend to show here." |
| No flattery ranking, no deload-as-failure, no red/green judgement | **done** | `progress.tsx:36–60,110–120` | Documented as a deliberate rejection of the old week-over-week "Down 18%". |
| Per-lift blue/ember comparison | **partial** | `src/components/exercise-sheet.tsx`, `src/lib/theme/color.ts:42` | Ember is live; blue is not (§4.2). |
| Meaning carried without colour | **done** | `progress.tsx`, `next.tsx:249–253` | Deltas are words plus numbers. |

---

## Section 11 — Profile, calendar, context

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Calendar shows trained days in blue and opens the real session | **done** | `src/components/calendar-sheet.tsx:185,204,332`, `src/components/history-sheet.tsx` | |
| Profile makes onboarding context editable | **partial** | `src/app/(tabs)/you.tsx` (Training section) | Editable: focus, writing language, smallest plate, bar weight, split. Missing: units, body context, usual days, experience, training style, priority movement (four of those are not collected at all). Step 2. |
| Preferred days never become a broken streak or guilt | **done** | `src/lib/streak.ts:7–27`, `src/app/(tabs)/you.tsx` | Streak counts *training days* with a seven-day tolerance and states "Rest days never break it." Deliberate and consistent with CLAUDE.md §2 rule 6. |
| Import always available in You | **done** | `src/app/(tabs)/you.tsx`, `src/lib/import/pick.ts`, `src/lib/import/formats.ts` | Strong and Hevy CSV. |
| Subscription management, restore, export, privacy, deletion direct and clear | **done** | `src/app/(tabs)/you.tsx` (Subscription / Your data / Privacy / Account sections), `src/lib/account/delete.ts`, `supabase/functions/delete-account/` | The subscription row now shows the store's own state with the real renewal or charge date; Manage opens the customer-specific URL; Restore is real and reports what it found in the section footnote. |

---

## Section 12 — Copy, privacy, safety

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Sentence case, plain language, precise observation over compliment | **done** | `src/lib/brief-prose.ts`, `src/lib/tour.ts`, `src/lib/effort.ts:41–51` | |
| "AI" not used as product marketing | **done** | grep over `src/`: hits are comments and guard tests only; `src/lib/brief-guard.ts:39` rejects it in model output | |
| Emoji only as sparing onboarding choice labels | **done** | `src/app/onboarding/index.tsx:953–957`; `brief-guard.ts:40` and `tour.test.ts` block them elsewhere | |
| Weight, height, reflections stored with account scoping, export, deletion | **done** | `src/lib/prefs.ts` (`pref_*`), `src/lib/db/workouts.ts`, `supabase/migrations/20260729000000_reflections.sql`, `src/lib/export-json.ts`, `src/lib/account/delete.ts`, `src/lib/legal.ts` | All three exist and all three are covered by construction: body context rides `pref_%` (already exported and wiped), the reflection rides the workout row (already RLS-scoped, cascade-deleted and exported). The privacy policy names both and states what Recore will never do with them. |
| No model training on user data without consent | **done** | `docs/privacy.html`, `supabase/functions/parse-workout/index.ts` | |
| **§12.1** Weekly recap notification: one per week, factual, editable time, off in one tap | **missing** | `src/components/week-recap-card.tsx` (**orphaned — zero importers**), `src/lib/billing/notifications.ts` | The only notification machinery is the trial reminder. The recap exists as an in-app card that no screen mounts. |
| **§12.1** No other recurring notifications | **done** | `src/lib/billing/notifications.ts` | Only the one-shot trial reminder is ever scheduled. |

---

## Section 13 — Measurement

Local-only, no third-party SDK: **done** (`src/lib/funnel.ts:6–19`, carried in the JSON export).
Event coverage:

| Event | Status | Evidence |
|---|---|---|
| Onboarding screen reached | **done** | `funnel.ts:75–78` (+ flow length, `:86–88`) |
| Onboarding completion | **done** | `funnel.ts` (`markOnboardingCompleted`) |
| Paywall viewed | **done** | `funnel.ts` (`markPaywallShown`), `paywall.tsx` |
| Plan selected | **done** | `funnel.ts` (`markPlanSelected`), `paywall.tsx` (`handleCta`) |
| Account created | **done** | `funnel.ts` (`markAccountAttached`), `billing/state.ts` — stamped where the store attachment succeeds, so it means "ready to buy", not "signed in" |
| Trial started | **done** | `funnel.ts` (`markTrialStarted`), `billing/state.ts` (`recordTrialFrom`) — fires only on a store-confirmed trial period |
| Purchase / restore state | **done** | `funnel.ts` (`markPurchaseOutcome`, `markRestoreOutcome`) — counted by category; no price, receipt or identifier is recorded |
| Import offered / started / completed / row-count bucket | **done** | `funnel.ts` (`markImportOfferShown`, `markImportStarted`, `markImportCompleted`), `lib/onboarding.ts` (`rowCountBucket`) — three counters, because offered-but-never-started and started-but-never-completed are different problems and the old single boolean showed neither. The bucket is a range; no lift names, no exact count. |
| First workout written / finished | **partial** | `funnel.ts` (`markFirstWorkoutFinished`), `bottom-toolbar.tsx` — **finished** is stamped on the first real Finish. **Written** is still missing: it belongs to the note save path, which this step did not touch. |
| First reflection added | **done** | `funnel.ts` (`markReflectionAdded`), `check-in-sheet.tsx` — stamped once, plus a running count. Counted only when a note appears where there was none: an edit is not a new reflection and a deletion is certainly not one. No text, no length, no language. |
| First Next brief viewed / first Progress chart viewed | **partial** | `funnel.ts` (`markBriefShown` stamps `first_brief_viewed_at`), `next.tsx` — 30 Jul. First Progress chart viewed is still missing. |
| Model brief shown / fallback shown / guard rejection categories | **partial** | `funnel.ts` (`markBriefShown('model' \| 'composed')`), `next.tsx` — 30 Jul, both counters in the funnel snapshot. Guard rejection **categories** are still missing (see §9.3). |
| Sessions during trial, week-two return, split by imported vs empty | **partial** | The `imported` split exists; the windowed session counts do not |
| Weekly recap enabled / delivered / opened / disabled | **missing** | — |
| Extra events not in §13 | — | `parsed_items`, `corrections`, `repair_rate`, `adherence_shown/followed` (`funnel.ts:116–131`) — useful, keep |
| **§13.1** Targets and thresholds recorded anywhere in code or docs | **missing** | — | No place computes or displays any of the five metrics. |

---

## CLAUDE.md invariants

| Invariant | Status | Evidence |
|---|---|---|
| §2.1 Raw text is truth; offline; nothing blocks a keystroke | **done** | `src/lib/db/workouts.ts`, `src/lib/sync/index.ts`, `src/lib/parse/client.ts` |
| §2.2 Personalise only from chosen information; never fake history or testimonials | **partial** | Every §5 answer now drives a screen, a default or an echo, and the invented `hyrox` echo is gone. **B4** is the one remaining exception. |
| §2.3 A model writes language, never facts | **done** | `src/lib/brief-guard.ts`, `src/lib/brief-explain.ts`, `src/lib/db/brief.ts` |
| §2.4 Motion clarifies cause and effect; Reduce Motion honoured | **partial** | Good tokens and broad `useReducedMotion`; the fake-loading screen that violated it is deleted (**B5**). Still no automated check and no device QA — step 7. |
| §2.5 The subscription is real before release | **done (pending device QA)** | `src/lib/billing/*`, `src/app/paywall.tsx`. Real StoreKit purchases via RevenueCat; every price and date comes from the store; Restore and Manage are real. **Not yet exercised against the App Store sandbox** — see "What remains unverified". |
| §2.6 No generic praise, streak guilt, countdown pressure | **done** | `src/lib/streak.ts`, `src/lib/effort.ts:41–51`, `src/lib/review/gate.ts` |
| §2.7 Code and docs English, owner replies Slovenian | **done** | whole tree |
| §3 AI key server-side, client gets neither key nor reasoning | **done** | `supabase/functions/*`, `src/lib/env.ts`, `src/lib/supabase.ts` |
| §3 Export complete and ungated after lapse | **done** | `src/components/read-only-ledger.tsx:56–66`, `src/lib/export-json.ts` |
| §3 44 pt targets, Dynamic Type, VoiceOver, contrast, Reduce Motion | **partial** | `HIT`, `MAX_FONT_SCALE`, `moderateScale` and `accessibilityLabel` are used consistently; no automated a11y check and no device QA record |
| §3 No fabricated reviews/ratings/testimonials anywhere, including placeholders | **contradicts** | **B4** |
| §4 Guard rejections counted and alarmed | **missing** | see §9.3 |
| §4 Prompt/guard changes require the owner-run evaluation | **partial** | parser only; see §9.4 |

---

## Where the repository is genuinely strong

Worth knowing before planning, so none of it gets rewritten by accident:

- The **pure, node-testable core** — `predict/engine.ts`, `plan/prescribe.ts`, `streak.ts`,
  `effort.ts`, `billing/trial.ts`, `brief-guard.ts`, `tour.ts`, `plates.ts` — 180 passing tests
  with zero imports so they run under plain `node --test`.
- The **parser pipeline and its 65-case evaluation** (`npm run eval`), which is exactly the shape
  §9.4 asks for and can be copied for the brief.
- The **honesty posture already taken in billing**: `startTrial` deliberately uncalled and
  documented, `resolveEntitlement` documented as the single swap point for the store SDK. Step 1
  of §6 is a smaller job than it looks.
- **Account deletion**, **export (JSON + CSV)** and the **legal pages** are real and server-backed.
- The **funnel counters** are local-only and correctly refuse a third-party SDK.

---

## Step 1 (billing) — what shipped, and what is still unverified

### Files

New: `src/lib/billing/entitlement.ts` (pure policy) + its test, `src/lib/billing/store.ts`
(the sole RevenueCat import site), `src/lib/billing/pricing.test.ts`.
Rewritten: `src/lib/billing/state.ts`, `src/lib/billing/pricing.ts`, `src/lib/billing/trial.ts`.
Changed: `src/app/paywall.tsx`, `src/app/(tabs)/you.tsx`, `src/components/read-only-ledger.tsx`,
`src/components/trial-reminder-sheet.tsx`, `src/components/trial-started-sheet.tsx`,
`src/lib/billing/notifications.ts`, `src/lib/auth/provider.tsx`, `src/lib/funnel.ts`,
`src/lib/env.ts`, `src/lib/db/ledger-size.ts`, `src/lib/legal.ts`, `.env.example`, `SECURITY.md`,
`docs/*.html` (regenerated from `legal.ts`).

### Two decisions the owner made, recorded so they are not silently re-litigated

1. **Offline policy.** Last known state plus a seven-day grace, rather than a strict check (which
   would break CLAUDE.md §2 invariant 1) or the old always-entitled default (which would mean the
   paywall is not hard). `GRACE_MS` in `src/lib/billing/entitlement.ts`.
2. **Enforcement is client-side for this pass.** `parse-workout` and `explain-brief` remain
   JWT-gated but not entitlement-gated. Recorded as a known limit in SECURITY.md; moving it
   server-side needs a subscriptions table, RLS and a webhook.

### Verified by the repository gates

`typecheck` · `lint` · `npx expo export --platform ios` · **198 unit tests**, of which 18 are new:
11 for the entitlement policy (fresh beats cache, grace edges, lifetime, `never` vs `expired` vs
`unverified`) and 7 for the pricing arithmetic (`savePct` refuses a comparison it cannot make
honestly; `perMonth`). The trial-clock tests were extended for store-supplied instants.

### What remains unverified — none of it can be closed from this machine

- **No purchase has ever been made.** The App Store sandbox has not been exercised: buy, cancel,
  expire, restore, restore on a second device, and a storefront in a non-USD currency. Until the
  owner runs that on a dev client, "billing works" is a claim about code, not about behaviour.
- **App Store Connect and RevenueCat are not configured** (SECURITY.md step 8). Product ids,
  the `pro` entitlement, the offering's `annual`/`monthly` packages, and the seven-day
  introductory offer **on both products** are all owner actions. `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
  is empty in `.env.example`; with no key the paywall shows no price and disables its CTA.
- **The RevenueCat SDK never ran.** It degrades safely in Expo Go and on web by design, but no
  code path in `store.ts` has executed against a real native module in this change.
- **Reduce Motion, VoiceOver and Dynamic Type on the new surfaces** (outcomes list, plan cards,
  lapsed record block) follow the existing tokens and carry labels, but were not checked on a
  device. That is step 7's QA pass.

---

## Step 2 (onboarding) — what shipped, and what is still unverified

### Files

New: `src/lib/onboarding.ts` (the pure answer model) + `src/lib/onboarding.test.ts`,
`src/app/import-start.tsx` (the §2.1 fast path).
Changed: `src/app/onboarding/index.tsx` (six screens added, four deleted, the flow's order moved
out to the tested model), `src/app/index.tsx` (the import leg), `src/app/_layout.tsx`,
`src/app/(tabs)/you.tsx` (every new answer editable), `src/lib/prefs.ts`, `src/lib/funnel.ts`,
`src/lib/predict/data.ts` and `src/lib/db/strip.ts` (both now bridge `Goal` → `Focus`),
`src/lib/legal.ts`, `docs/*.html` (regenerated).

### Three decisions the owner made, recorded so they are not silently re-litigated

1. **Five goals, three engine ranges.** `Goal` gained `fitness` and `sport`; both map to the
   classic middle through `focusForGoal`, so **no prescribed number changed**. Inventing a rep
   range for "general fitness" would be a number nobody has evidence for, which CLAUDE.md §2
   rule 3 forbids. A test asserts the mapping is total, so a future goal added without a focus
   fails rather than silently prescribing.
2. **`source` deleted.** Its own comment admitted it changed nothing the user sees — §5's exact
   removal criterion. `replaces` and `objection` went with it as marketing beats with no §5 row;
   `language` stayed, folded into screen 10, because the parser prompt and the brief both read it.
3. **Body context stored as `pref_*` keys.** No schema change was needed: `export-json.ts` already
   carries every `pref_%` row and `account/delete.ts` drops the whole `meta` table, so §12's
   export and deletion guarantees cover it by construction. The privacy policy now names it.

### Verified by the repository gates

`typecheck` · `lint` · `npx expo export --platform ios` · **221 unit tests**, of which 23 are new
and cover: the flow matching §5's fourteen rows in order, unique screen ids, the bounded counter
over the nine question screens, the goal→focus mapping being total and leaving prescriptions
unchanged, experience/style/feel validators, the Monday-first day mask (including that an
out-of-range day cannot corrupt it), body-context parsing in both unit systems with human bounds
and decimal commas, and the import fast path's three conditions plus the row-count buckets.

### What remains unverified

- **No screen has been run.** The whole funnel is verified by typecheck, lint, the export and the
  model's unit tests; not one of the fourteen screens has been rendered on a device or simulator.
  Layout, keyboard behaviour on the two text fields in `StepBody`, and the day-chip row at large
  Dynamic Type sizes are all unchecked.
- **The import fast path has never imported anything.** `pickAndImportCsv` is unchanged and was
  already working from You, but the new screen's own paths — the file picker, the `invalid`
  message for a non-Strong CSV, and the redirect afterwards — have not been exercised.
- **Reduce Motion, VoiceOver and Dynamic Type on the six new screens** follow the existing tokens
  and carry accessibility labels and roles, but were not checked on a device. Step 7's QA pass.
- **The blue progress rail (§5.2) is still ink.** Deliberately left for step 5, which is the
  colour pass; recolouring selection states here would have been an unrelated redesign.

---

## Step 3 (spotlight, reflections, export/deletion) — what shipped, and what is still unverified

### Files

New: `src/lib/reflection.ts` (the pure model) + `src/lib/reflection.test.ts`,
`src/components/check-in-sheet.tsx`, `supabase/migrations/20260729000000_reflections.sql`.
Deleted: `src/components/effort-sheet.tsx` (became the check-in sheet).
Changed: `src/lib/db/schema.ts` + `src/lib/db/index.ts` (schema v4 and its ALTER),
`src/lib/db/workouts.ts`, `src/lib/sync/index.ts` (push and pull), `src/lib/export-json.ts`,
`src/lib/funnel.ts`, `src/lib/tour.ts` + `tour.test.ts`, `src/components/spotlight-tour.tsx`,
`src/components/session-receipt.tsx`, `src/components/bottom-toolbar.tsx`,
`src/state/session-store.ts`, `src/app/(tabs)/today.tsx`, `src/lib/legal.ts`, `SECURITY.md`,
`docs/*.html` (regenerated).

### Two decisions the owner made, recorded so they are not silently re-litigated

1. **One post-finish sheet, not two.** The reflection leads and the per-line effort scale (the
   owner's own 28 July feature) follows on the same surface. Queueing two sheets behind one
   Finish would have contradicted the restraint both §8.1 and this codebase enforce.
2. **The tour's step 2 shares the `page` target with step 1.** §7 asks for a spotlight on
   "Finish and check-in", but Finish lives on the composer's accessory bar, which only exists
   while the keyboard is up — during the tour the note is empty and the button is not on screen.
   §7 permits a spotlight only on a measurable target, so the sentence changed and the target did
   not. The day-pill beat, which §7 never listed, is gone.

### Why a column and not a table

A reflection is one per finished session, so it is the workout's own field. That shape makes
§12's promise — "the same account scoping, export, and deletion guarantees as workout records" —
true by construction rather than by a policy someone has to remember: the existing `workouts` RLS
is row-level, `user_id … on delete cascade` takes it with the account, `buildExportJson` reads
the row, and `delete.ts` already drops the table. It sits **beside** `raw_text`, never inside it:
`raw_text` is what the parser reads, and a reflection is prose no parser should ever see.

### Verified by the repository gates

`typecheck` · `lint` · `npx expo export --platform ios` · **232 unit tests**, of which 11 are new:
8 for the reflection model (the four §8.1 prompts verbatim and each one a question that neither
cheers nor instructs; stored exactly as typed in any language; every empty form resolving to no
reflection; over-long refused rather than truncated; the counter staying silent until the limit is
near) and 3 for the tour (the five §7 steps in order, the check-in step actually teaching the
check-in and not instructing the athlete, every target measurable).

### What remains unverified

- **The check-in sheet has never been rendered.** No screen was run: the field's keyboard
  behaviour inside a bottom sheet, the sheet's height with many exercises, and the prompt chips
  wrapping at large Dynamic Type sizes are all unchecked.
- **Nothing has been written to the new column on a device.** `setReflection`, the schema v4
  ALTER for an upgrading install, and the sync push/pull of the column are verified by typecheck
  only. The v3 → v4 migration path in particular has not been exercised against an existing
  database.
- **The Supabase migration has not been applied.** `supabase db push` is an owner action
  (SECURITY.md step 1). Until it runs, sync push will reject the new column — the local record is
  unaffected, but the server copy will not carry reflections.
- **Reduce Motion, VoiceOver and Dynamic Type on the check-in sheet** follow the existing tokens
  and carry labels and roles, but were not checked on a device. Step 7's QA pass.
- **First workout *written*** (§13) is still missing — it belongs to the note save path, which
  this step deliberately did not touch.

---

## Illustrated onboarding layout (owner's 29 Jul spec) — what shipped, and what is still unverified

A second, illustration-driven onboarding renderer built to the owner's 13-step spec, wired in
as the funnel entry, and — 30 Jul, owner's blanket yes to the evidence-based review — **aligned
with §5 and made the ONLY flow**: the fourteen-screen `onboarding/index.tsx` was DELETED (2,742
lines; You's "Replay setup" now opens `/onboarding/1`), and product-direction §5 was revised in
the same change (15-screen table, ink rail). The §5 alignment pass: company and commitment
questions deleted (no consumer — §5's own removal criterion), routine → the screen-10
session-feel question (`setSessionFeel`), rest yes/no → a length choice feeding
`setRestSeconds`, name (screen 2) and priority movement (screen 9) added as optional text steps
(`setName`, `setPrimaryLift` — the movement pin, FIRST SESSION sample line and Lifts sort were
already live consumers), language + display unit derived from the device locale
(`lib/locale.ts`, never asked), the OS notification prompt REMOVED from onboarding (§5.1
compliance — intent is recorded, the prompt waits for the first §12.1 recap), and the flow now
ends with the §5 screen-14 **Ready echo** — meaningful answers read back instantly (never an
"analyzing" timer; §4.3 / blocker B5 precedent) — before the paywall.

### Files

- `src/app/onboarding/[step].tsx` — the one renderer for all 13 steps: full-bleed expo-image
  cover, 62%-height gradient to paper (`expo-linear-gradient`, newly installed), question +
  radio-option pills over the gradient, 13-segment progress rail, back affordance from step 2 on,
  180 ms answer-then-advance, next-image prefetch (both step-3 variants warmed on step 1), 60 ms
  staggered fade-and-rise via the existing `FadeSlideIn` (Reduce Motion resolves instantly).
- `src/components/onboarding/config.ts` — the typed 13-step array, Slovenian copy with TODO(en)
  keys, the owner's exact asset mapping (both "walking" files kept distinct; the capital-N
  `11-Notifications.png` casing preserved) and the literal step-3 variant rule (male →
  `03-experience_v2.png`, everything else → `03-experience.png`). **Deviation from the spec's
  `app/onboarding/_config.ts` path, recorded here:** expo-router in SDK 54 registers every file
  under `app/` as a route (verified in `getRoutesCore.js` — only `_layout` is special), so the
  config would have become a phantom `/onboarding/_config` route warning on every reload.
- `src/components/onboarding/OptionRow.tsx`, `ProgressRail.tsx` — the pill row (paper 60% fill,
  0.5 px ink hairline at `ink.grabber`, selected = solid ink with paper label, never green) and
  the segmented rail (ink / 15%).
- `src/state/onboarding.ts` — `useOnboardingAnswers` (zustand), persisted synchronously through
  the SQLite meta KV under `pref_ob_illustrated`, so the answers inherit §12's export and
  deletion guarantees exactly like `lib/prefs.ts`; `reset()` for development.
- `src/lib/theme/type.ts` — one new token, `question` (28 pt / 500), per the sizes-live-in-theme
  rule.
- **Redesign (third pass, same day, Mobbin-referenced — Tonal/Strava/WHOOP/Breathwrk/Alma/
  GO Club/Opal):** the `question` token went bold (28/700 — every reference carries the question
  at full weight), the copy block lifted off the bottom edge (bottom padding
  `max(inset, 16) + 32`, gradient raised to 70% so it still sits on near-solid paper), wider
  gutters (24), steps slide in natively (`slide_from_right` + the existing content stagger), and
  a **welcome intro** opens the flow (hero = the gym-bag figure, "Welcome to Recore" +
  thanks-and-pitch sentence + Get started; no rail, no back). All copy is now ENGLISH (the app's
  language) — the Slovenian pass moved to the i18n backlog. The flow is 14 entries (intro + the
  13 spec steps); the rail still shows 13 segments. Store persist bumped to v2 with a migrate
  that restarts a v1 snapshot instead of mis-resuming on shifted numbering.
- **Wiring (second pass, same day):** `app/index.tsx` redirects un-onboarded users to
  `/onboarding/<currentStep>` (synchronously hydrated, so resume is exact);
  `app/_layout.tsx` registers `onboarding/[step]` beside the old flow; step 13 runs
  `completeFlow()` — goal / experience / tracker written through the validated prefs setters
  (so the engine fallback, explanation level and §2.1 import fast path all see them),
  `setObStepCount(13)`, `markOnboardingDone()`, `markOnboardingCompleted()` — then replaces to
  `/paywall`; each mount records the §13 high-water mark via `markObStepReached` (1-based in
  this flow, where the old one was 0-based — the funnel snapshot reads a max, so the mix is
  monotone but the scale note belongs here). Back now falls back to
  `replace(/onboarding/<n-1>)` when there is no history (cold-start resume). A `__DEV__`-only
  You row "Run illustrated onboarding" resets the store and opens step 1.

### Verified by the repository gates

`typecheck` · `lint` · `npm test` **232/232** (no tests added — the flow has no pure logic yet)
· `npx expo export --platform ios` (proves Metro resolves the new route, the fourteen asset
requires, and the new dependency).

### What remains unverified

- **No screen has been rendered.** Cover crops (`focus` values were set from reading the
  illustrations), gradient legibility over the near-white art, pill contrast at 60% paper, and
  the rail at Dynamic Type sizes are all unchecked on a device.
- **Eleven of twelve answers act now** (name, goal, experience, tracker, session feel, day
  mask, priority movement, rest seconds, weight, unit, plus locale-derived language — all
  through the validated prefs setters at completion). The two without a pref: gender changes
  the illustrations only (its stated consequence), and the notifications intent waits for
  §12.1 — when the weekly recap ships, the intent gates the offer and the OS prompt happens
  there, in context.
- **`OB_SCREENS` in `lib/onboarding.ts` still models the DELETED fourteen-screen flow** and
  its test asserts that shape; harmless but stale — retire or repoint it at the illustrated
  flow in a later cleanup. `onboarding-shots.ts`, `device-frame.tsx` and `sign-in-demo.tsx`
  lost their last route with the deletion and are now fully orphaned.
- **`Image.prefetch` warms the cache in development** (Metro serves assets over HTTP); in a
  release build bundled assets resolve to local URIs where prefetch is a harmless no-op.

---

## Change log

- **29 Jul 2026** — first audit of the working tree against V5.1. Created this file.
- **29 Jul 2026** — implementation-order step 1: real store billing, entitlement policy with
  offline grace, account attachment, purchase, restore, manage, store-sourced trial lifecycle,
  and the §2.2 lapsed screen. Cleared blockers B1, B2, B3 and B6.
- **29 Jul 2026** — implementation-order step 2: the §5 onboarding data model and fourteen-screen
  funnel (six screens added, four deleted), the §2.1 tracker-import fast path, every answer
  editable in You, and the §13 import events. Cleared blocker B5 and the `hyrox` echo.
- **29 Jul 2026** — implementation-order step 3: the §8.1 end-of-session check-in (reflection plus
  the existing effort scale on one sheet), stored as a column on `workouts` so §12's export,
  deletion and account-scoping guarantees hold by construction; schema v4 and its Supabase
  migration; §7's step 2 corrected from the day pill to Finish-and-check-in; and the §13
  first-reflection and first-finish events.
- **29 Jul 2026** — illustrated onboarding layout to the owner's 13-step spec: config-driven
  renderer at `/onboarding/[step]`, persisted `useOnboardingAnswers` store, OptionRow /
  ProgressRail, the `question` type token, and `expo-linear-gradient`. Analyzing / Ready
  screens out of scope by the same spec.
- **29 Jul 2026** — wired the illustrated flow in as the funnel entry (owner's follow-up):
  dispatcher resumes at the persisted step, step 13 completes (prefs mapping for
  goal/experience/tracker, done + completed marks) and forwards to /paywall, funnel high-water
  per step, history-safe Back, and a dev-only You row to re-run the flow. The fourteen-screen
  flow is no longer reachable from the dispatcher.
- **29 Jul 2026** — illustrated-flow redesign after a Mobbin pass (owner ask): bold question
  token, copy block lifted off the bottom, native slide-from-right transitions, a welcome intro
  ("Welcome to Recore" + Get started), and all copy switched to English. Store persist v2.
- **29 Jul 2026** — three steps became real controls (owner ask): bodyweight is a typed mono
  field with a kg/lb toggle (raw text in the store, converted to metric once at completion),
  training days are seven multi-select circles on the shared day-mask vocabulary, and the
  notifications yes opens the actual iOS permission prompt before advancing. New
  `DayPicker`/`WeightInput` components; store persist v3.
- **30 Jul 2026** — the §5 alignment pass (owner's yes to the evidence-based review): deleted
  the fourteen-screen flow and the company/commitment questions, added name + priority
  movement, routine → session feel, rest → timer length, locale-derived language/unit, moved
  the OS notification prompt OUT of onboarding (§5.1), added the Ready echo before the
  paywall, and revised product-direction §5 (15-screen table, ink rail) in the same change.
  Store persist v4; new `TextField` component and `lib/locale.ts`.
- **30 Jul 2026** — priority-movement step gained quick-pick chips (Squat / Bench press /
  Deadlift / Overhead press / Pull-ups / Row — parser-resolvable names; a chip
  answers-and-advances, the field stays for anything else; new `SuggestionChips`), and all 14
  illustrations were multiplied onto the paper colour (#FEFEFE backgrounds → #F4F5EF, so the
  art no longer reads cooler than the canvas). Untouched originals in
  `assets/onboarding-originals/` (not bundled — Metro only packs required assets).
