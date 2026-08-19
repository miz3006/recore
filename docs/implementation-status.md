# Implementation status

**Audited 29 July 2026 against CLAUDE.md v5.1 and product-direction.md v5.1.
Updated 29 July 2026 with implementation-order steps 1 (billing), 2 (onboarding) and
3 (spotlight, reflections, export/deletion). Amended 12 August 2026 with the owner's
mascot-led onboarding restyle (one screen template, Recore blue as the funnel's single
accent, unframed illustrations, the notifications switch, the optional founder note, the
side-by-side paywall plan cards, and a full rewrite of the onboarding copy) — sections 4, 5
and 6 below.**

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
model rewrites CHANGED SHAPE in this pass — per CLAUDE.md §5 this is an AI-summary change, so
the rewrite path is **not fully verified** until the owner runs the §9.4 evaluation. That
evaluation exists since 6 Aug 2026 (`npm run eval:brief`, see the change log) but has not been
run by the owner yet.

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
| **§4.2** Recore blue is a visible product accent (selection, focus, active controls, walkthrough emphasis, recorded-progress charts) | **done** | `src/lib/theme/color.ts:8–23,43`; `src/components/onboarding/tokens.ts`; blue live in `you.tsx`, `calendar-sheet.tsx`, `history-sheet.tsx`, `streak-sheet.tsx`, `progress.tsx` + `charts.tsx` (4 Aug), and the whole funnel (12 Aug) | 12 Aug, owner's mascot-led restyle: onboarding **and** paywall selection are blue — selected option border + check, progress fill, focused text field, the primary CTA, the emphasised bodyweight value, the selected plan card. One accent, declared once in `components/onboarding/tokens.ts`. The flow carries no second hue and no emoji. |
| **§4.2** Charts may use a blue primary series with a soft fill | **done** | `src/components/charts.tsx` (`TrendChart`) | 4 Aug: `TrendChart` draws in `color.trained` with a gradient wash, tint overridable per caller. The bar primitives (`WeekBars`, `MicroBars`) stay ink — they are ledger furniture, not a progression series. |
| **§4.2** Planned green only on a future prescription, with label | **done** | `src/lib/theme/color.ts:40`, `src/app/(tabs)/next.tsx:196–199,361–364` | |
| **§4.2** Trend ember as optional secondary comparison | **done** | `src/lib/theme/color.ts:42`, `src/components/exercise-sheet.tsx` | Confined to the one-lift progression card; never on a number. |
| **§4.2** Red only destructive/errors | **done** | `src/lib/theme/color.ts:51` | |
| **§4.3** Press-in/release, sheet spring, chart reveal, single value update | **done** | `src/lib/motion.ts`, `src/components/motion.tsx`, `src/components/bottom-sheet.tsx` | Shared tokens (`DUR`/`EASE`/`SPRING`) are used consistently. |
| **§4.3** Directional onboarding transitions (forward from right, Back from left) | **done** | `src/app/onboarding/[step].tsx` (`Stack.Screen animation="slide_from_right"`), `src/components/onboarding/OnboardingScreen.tsx` (entrance stagger) | The native stack slides horizontally and the iOS back-swipe returns from the left; the zones crossfade in on top of it (250 ms fade + 12 pt rise, 60 ms apart, in reading order). |
| **§4.3** Onboarding idle loop on the illustration | **owner-directed exception** | `src/components/onboarding/IllustrationSlot.tsx` (`Idle`) | 12 Aug, owner's spec: the mascot floats ±3 pt and breathes 2 % on a 3.5 s cycle, forever. §4.3's "no autoplaying decoration" reads against it; the owner asked for it by name as the thing that makes the flow feel alive. Transform-only on the UI thread, and Reduce Motion never starts it. Flag it if §4.3 is ever enforced literally. |
| **§4.3** No fake loading | **contradicts** | `src/app/onboarding/index.tsx:1265–1330` | Blocker **B5**. |
| **§4.3** Reduce Motion honoured everywhere | **partial** | `useReducedMotion` in 16 files; `src/components/motion.tsx`, `src/app/onboarding/index.tsx:1245,1265–1272` | Broad coverage; no automated check, and it is not asserted in any test. Needs the §6-step-7 device QA pass before it can be called done. |
| **§4.3** At most one celebratory moment per session | **done** | `src/lib/motion.ts:38` (`SPRING_OVERSHOOT`, "the only place a bounce is allowed"), `src/components/gutter-value.tsx` (`PrLabel` — neutral outline) | |

---

## Section 5 — Personalised onboarding (14 screens)

> **18 August 2026 — the v3 design import.** The owner's fourteen-screen board replaced the
> twenty-one-screen build. The table below still describes the flow §5 SPECIFIES; what SHIPS is
> the board, and the two now differ. §5 itself has not been amended — that is the owner's call
> under CLAUDE.md §2 rule 8, and until they take it this note is the record of the gap.
>
> **The shipped flow** (`src/components/onboarding/config.ts`, one entry per screen):
> welcome · current tracker · what stops you tracking (multi) · the parse demo · what gets
> written gets stronger · main goal · how long lifting · name + gender · training days + how you
> follow them · key lifts and their loads · gradual overload · 12-week commitment (hold) ·
> weekly recap · your projection.
>
> **What changed, and why each one is defensible:**
>
> · **Nothing auto-advances.** Every question carries Continue; the tracker, goal and experience
>   screens hold it inert until answered, because those three change what the app DOES. The rest
>   are skippable, per §5's "skipping changes nothing essential".
> · **Five screens left the flow** — the building checklist, the answers summary, the
>   product-truth list, the founder note and the trial timeline. Their components stay in the
>   tree, unmounted, the way every other rolled-back surface here does.
> · **Two screens stopped being asked** — rest length and bodyweight. Their answer keys, their
>   writers in `completeFlow` and their prefs setters are untouched, so the app keeps its
>   defaults and either screen returns as one entry in `STEPS`.
> · **Three new answers** — `obstacles`, `keyLifts`, `liftLoads` (store version 6; an older
>   snapshot restarts the flow rather than mis-resuming).
> · **Emoji appear on two screens** (goal, weekly recap), which is §12's own allowance:
>   "sparingly as an onboarding choice label when they improve scanning". `tokens.ts` said "no
>   emoji" and was the outdated document.
> · **Two lines of the board's copy were NOT shipped as drawn.** The commitment screen's "Most
>   people who log the first four sessions are still logging in month three" is a retention
>   statistic about other people (§2 rule 2, §3) and was replaced with a claim about the
>   person's own record. The recap preview's "Bench up 2.5 kg. Squat stalled twice." is a
>   fabricated record shown to somebody who has logged nothing (§3 forbids it "anywhere,
>   including placeholders"); the preview now describes what the message contains.
> · **The projection screen is new and needs the owner's eye.** §5.1 says "Never show a fake
>   progression chart before a session is logged." What ships is arithmetic on the loads the
>   person typed two screens earlier (`projectedTarget`, `projectionSeries` — unit-tested, and
>   they reproduce the board's 60 → 72.5 and 90 → 107.5 exactly), labelled YOUR PROJECTION with
>   "An estimate from your answers, not a promise", never stored, and read by nothing else. With
>   no load typed it shows no chart at all. That is a projection rather than fake history — but
>   it sits close enough to the line that the owner should rule on it.

The table below describes the §5 SPECIFICATION, not the shipped board. The order is asserted
against the specification in `src/lib/onboarding.test.ts` rather than against itself — the shape
of drift this repository has actually suffered before.

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
| No unsupported claim in onboarding copy | **done** | `src/components/onboarding/config.ts` | 12 Aug copy rewrite removed three: the commitment affirm asserted **"Three months is where most lifters see their first real PRs"** (an invented statistic about other people, §2 rule 2); the why-tracking screen asserted **"Lifters who keep a record progress faster"** (a behavioural claim with nothing behind it); and the product-truths headline read **"Why lifters switch to Recore"**, which implied a migration that has not been measured (§3). The replacements state things a reader can check. |
| Onboarding copy states what the app actually does | **done** | `src/components/onboarding/config.ts` | The parser demo now shows `bench 100kg 5,5,4`, the exact shape covered by `scripts/parse-eval-cases.json` ("rep list commas after weight"), so the screen cannot demo a syntax the parser rejects. The summary's import line says the history *can* come across after sign-in rather than promising an automatic one, and the trial timeline describes the in-app reminder sheet rather than an email. |
| No permission prompt in onboarding | **done** | `onboarding/index.tsx`, `billing/notifications.ts`, `lib/voice.ts` | Unchanged: notifications ask at trial start, microphone on mic tap. |
| Blue progress rail + position marker | **done** | `src/components/onboarding/ProgressRail.tsx` | 12 Aug: one continuous 4 pt bar, blue fill on ink at 10 %, springing from where it stood on the previous screen (`lastFraction`) so it reads as ground covered rather than a twenty-step countdown. It was a row of dashed ink segments. |
| One screen template, fixed zones | **done** | `src/components/onboarding/OnboardingScreen.tsx` | 12 Aug restyle: chrome row → illustration on bare paper → eyebrow/headline/subtext → content → the blue CTA pinned to the bottom. Every zone height derives from the WINDOW, never from the step, so the mascot, headline baseline and button do not move between screens; the content band scrolls when it must. Not yet checked on a device. |
| Mascot illustration renders unframed | **done** | `src/components/onboarding/IllustrationSlot.tsx`, `src/components/onboarding/illustrations.ts` | No card, border, tint, shadow or rounded clip — `contain` on the paper canvas. Only `welcome` has an asset (the looping clip + poster); every other slug still draws the faint placeholder box, which is the one remaining frame in the flow and disappears per-slug as art lands. |
| Notifications answer is a switch | **done** | `src/app/onboarding/[step].tsx` (`isNotifications`), `src/components/onboarding/Toggle.tsx` | 12 Aug, owner's spec. Both labels are still the step's own config copy and the stored answer is still `'yes'`/`'no'`; the screen carries a Continue instead of auto-advancing, because a switch must be reversible. Unanswered reads as on and the row says so in words before Continue writes it. Still no OS prompt here (§5.1). |
| Founder note screen | **built, copy is placeholder** | `src/components/onboarding/config.ts` (`FOUNDER_NOTE_ENABLED`, `FOUNDER_NOTE`), `src/components/onboarding/FounderNote.tsx` | Owner's optional screen, on by default, spliced in after the product truths. **The three paragraphs are placeholder copy signed with a real name and must be replaced before release** — see the TODO on `FOUNDER_NOTE`. The portrait is an ink disc with an initial; it claims no rating, review or user count. |
| Personalised pages connect a previous answer to what comes next | **done** | `StepContext`, `StepNotice`, `StepFirstWeek`, `StepReady` | |
| Back available everywhere; all answers editable in You | **done** | `onboarding/index.tsx` (Chrome), `src/app/(tabs)/you.tsx` (Training section) | You now edits focus, experience, how you train, session style, usual days, writing language, units, smallest plate, bar weight, split, and (6 Aug) body context in place — weight in the display unit, height in cm, an emptied field clears the value. |
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
| Monthly and annual with real price and renewal text | **done** | `src/lib/billing/store.ts` (`fetchOffer`, `StorePlan`), `src/app/paywall.tsx` (`PlanCard`) | Apple's `priceString` and `pricePerMonthString`, in the user's storefront currency. 12 Aug: the two cards sit side by side instead of stacked — same component, same size, same target — with the annual's `SAVE n%` as a blue pill computed by `savePct` and absent whenever the comparison cannot be made honestly. |
| "Nothing due today" billing line | **done** | `src/app/paywall.tsx` (`styles.dueToday`) | Owner's 12 Aug exception: the ONE green line in the app that is not a planned prescription. It renders only while the selected plan carries a store-confirmed trial — with no trial, money *is* due today, so the line is absent rather than reworded. |
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
| Sets shown one per row under the exercise (owner, 4 Aug) | **done** | `src/lib/parse/summarize.ts` (`setTableOf`, + tests in `parse/receipt.test.ts`), `src/components/set-table.tsx`, `note-surface.tsx`, `session-receipt.tsx` | The compact reading (`setsLineText`) stayed exact but had to be decoded once a pyramid appeared: "120·100·90 kg × 10·15·8". The ledger card and the receipt now render a **mini table** — position · load · work · note, tabular mono, one hairline under the header. Warm-ups/drops/skipped stay visible and labelled instead of numbered; the counted totals are unchanged. A lone plain set keeps the one-liner. Compact surfaces (check-in, finish summary, live typing preview) still use `setText`. **Note: `session-receipt.tsx` has no importers — that half of the wiring is inert until the file is adopted or deleted.** |
| App-wide accessibility pass (owner, 9 Aug) | **done** | `src/lib/theme/scale.ts` (`MAX_FONT_SCALE` 1.5, `FIXED_FONT_SCALE`, `lineFor`), `theme/type.ts`, `theme/color.ts`, 21 screens/components, `src/state/display.ts`, `app/(tabs)/you.tsx` | Three owner decisions, all measured rather than guessed. **(1) Contrast:** `textMuted` went #9AA093 → #82887B, 2.45:1 → 3.33:1, lifting 180+ uses at once; the ledger's informational text (comparison, alias echo, last-session reading, hints) moved to `textSecondary` (4.7:1, AA). The standing rule is in `color.ts` and product-direction §14.3. **(2) Dynamic Type 1.3 → 1.5:** the old cap was a layout limit, not a policy — every line height was hardcoded and could not grow with its glyph. `lineFor()` now scales them by the reader's own setting (all type tokens + 58 literals across 21 files), text-bearing boxes moved from `height` to `minHeight` (15 of them, incl. every `AppButton`), and text locked in geometry (calendar/history day numbers, avatar initials, ring checks) is clamped to `FIXED_FONT_SCALE` 1.2. **(3) In-app choice:** You → Display → "Set readings · Standard/Larger". **Not yet device-QA'd at 1.5 — that is the remaining risk.** |
| Set table readable at low vision (owner, 9 Aug) | **done** | `src/components/set-table.tsx`, `src/state/display.ts` | Measured, not guessed: `textMuted` is **2.45:1** on the paper canvas — below AA (4.5) and below the 3:1 large-text floor — and it was carrying the set numbers and notes. Nothing in the table is muted now (counted work 16:1, everything else `textSecondary` 4.7:1); warm-ups/drops are told apart by their **word**, never by tone alone. Type up ~2 pt per cell; load and work grouped into one short scan instead of opposite edges; header rule moved from `tableRule` (1.11:1, invisible) to `border`. Past `fontScale` 1.2 (1.1 when a note column competes) the columns give way to one spelled-out line per set ("Set 1 · 100 kg · 10 reps"), which wraps instead of cropping and is allowed to grow to 1.6× — the app-wide 1.3 clamp exists to protect layouts that can break, and this one cannot. Live via `useWindowDimensions().fontScale`, so changing the OS text size needs no relaunch. |
| **§8.1** End-of-session free-text reflection | **done** | `src/components/check-in-sheet.tsx`, `src/lib/reflection.ts` (+ test), `src/lib/db/workouts.ts` (`setReflection`) | A free-text field on one sheet opened by Finish and re-openable from the receipt. Owner's ruling 29 Jul: **one sheet**, not two — so a finish never queues two sheets. **17 Aug: the reflection no longer LEADS it** — see the check-in redesign row below. |
| **§8.1** Optional prompts ("How did that feel?" etc.) | **superseded** | `src/lib/reflection.ts` (`REFLECTION_PROMPTS`, still exported + asserted verbatim by test) | All four are still the spec'd vocabulary and still tested, but **the check-in no longer renders them**: the owner's 17 Aug ruling replaced the placeholder chips with three preset ANSWERS that write (`REFLECTION_TAGS`). The field's own placeholder is now "Anything about today…". Any future surface that suggests rather than answers should use the four prompts. |
| **Check-in redesigned to read the session back** (owner ask + mockup, 17 Aug) | **done** | `src/components/check-in-sheet.tsx`, `src/lib/effort.ts` (`EFFORT_CHOICES`, `EFFORT_CHOICE_LABEL`, `effortChoiceOf` + tests), `src/lib/reflection.ts` (`REFLECTION_TAGS`, `composeReflection`, `splitReflection`, `reflectionRoomFor` + tests), `src/lib/parse/receipt.ts` (`lastSetTextOf` + tests) | "How did it go?" over the session's own line ("2 lifts · 9,840 kg · 48 min" — lifts and volume from the receipt, minutes from the workout row's timestamps under the receipt's own 10–360 min sanity rule; a run-only day totals in distance and an implausible span simply drops). Then **the lifts first, the words second**: one row per lift the sheet reads out of the record, its LAST counted set beside the name, and three answers — Could do more (rir 3) · Just right (rir 1) · Nothing left (rir 0), written into the line as an RPE token exactly as before. **Only unrated lifts are asked about**, and the question set is frozen when the sheet opens (or when a late parse lands) so answering a row cannot make it vanish mid-tap. Reversal of a July ruling, on the owner's say-so: the note chips (Slept badly · Felt strong · Short on time) are now **multi-select answers that are stored**, as the reflection's own first line — no new column, no migration, and `splitReflection` reads them back so the sheet re-opens armed. Nothing is preselected and the app still never infers one. Skip / × / swipe / Save session all commit exactly what is on the sheet. |
| **§8.1** Reflections included in export and deletion | **done** | `src/lib/export-json.ts`, `src/lib/account/delete.ts`, `supabase/migrations/20260729000000_reflections.sql` | By construction rather than by remembering: the reflection is a **column on `workouts`**, so it inherits that row's RLS, its cascade delete, the local wipe and the JSON export. CSV stays a sets table — the JSON is the complete export and the privacy policy says so. |
| **§8.1** Next may quote a reflection without inferring causation | **partial** | `src/lib/db/brief.ts` (`BriefNote`, `recentEntryNotes`), `src/app/(tabs)/next.tsx` | 4 Aug: the PER-ENTRY note is captured and quoted (see the section below). The session-level reflection from the check-in sheet is still not read by the brief — that half of step 4 stands. |
| **Per-entry note on a ledger card** (owner ask, 4 Aug) | **done** | `src/lib/entry-note.ts` (+ test), `src/lib/db/entry-notes.ts`, `src/components/entry-note-sheet.tsx`, `src/components/note-surface.tsx` | One sheet carrying that entry's effort scale and a free-text note. Stored in `workouts.entry_notes` (schema v5), never in `raw_text`. **12 Aug: the speech bubble that opened it from every card is gone** — the standing per-card invitation became one end-of-session row (below), and this became a named row inside the ⋯ sheet. The written note still renders on its card; only the prompt moved. |
| **Visible ⋯ actions on a settled card** (owner ask, 6 Aug) | **done** | `src/components/entry-actions-sheet.tsx`, `src/components/note-surface.tsx` (sideCol, `runEntryAction`), `src/components/icon.tsx` (`ellipsis`, `pencil`) | The card's hidden gestures are now one visible ⋯ (Mobbin-verified logger pattern: Hevy/Gymshark/Bevel per-exercise menu): a BottomSheet with Edit line · Show my words · Note & effort · History · Fix reading · Delete entry (`color.error`, last, own rule). The body's long-press → history was REMOVED — the menu owns it; tap-to-edit stays. Sequencing honours UIKit's one-modal rule: the chosen action fires from `onClosed`, so History/Fix can present their own sheet. Delete routes to the same `deleteNoteLine` the inline editor uses. **12 Aug: two rows added** (words, note) and the ⋯ became the card's only glyph. |
| **The written line visible on its card** (owner ask, 12 Aug) | **done** | `src/components/note-surface.tsx` (`WordsFlip`, `wordsKey`), `entry-actions-sheet.tsx` (`words` action) | Long-press a settled card — or pick "Show my words" in its ⋯ — and the interpreted SET/KG/REPS table crossfades to the raw line, quoted in mono, exactly as typed. Tap or long-press again to flip back. Read-only display of `raw_text` (§3): no new data, no new column, nothing writable. Both faces are laid out and the words layer reports its height as the wrapper's floor, so flipping never moves the page. `DUR.fast`, instant under Reduce Motion; the hidden face is hidden from VoiceOver rather than merely transparent. |
| **One reflection prompt per session, not per card** (owner ask, 12 Aug) | **done** | `src/lib/session-activity.ts` (+ test), `src/components/use-session-active.ts`, `note-surface.tsx` (`showReflectionRow`), `session-store.ts` (`finishSession`, `lastActivityAt`, `sessionFinished`), `bottom-toolbar.tsx` | §8.1 asks once, about the session; the note bubble asked once per exercise, five times a session. One quiet row now sits under the ledger — "Add a note about this session" — opening the check-in that already existed. It appears when the session has ENDED: Finish pressed, or 90 quiet minutes with work on the record (so the athlete who never presses Finish is still asked), and disappears once a reflection exists. Finish is remembered per workout in the meta KV (`session_done:<id>`), like receipt mode; writing another line re-opens the session. |
| **§8.2** Session-start question on an empty Today (owner ask, 6 Aug) | **done** | `src/components/session-start.tsx`, `src/app/(tabs)/today.tsx`, `src/lib/db/plan.ts` (`getPlanDayChoice`/`setPlanDayChoice`, choice read in `resolveTodayPlanDay`), `src/lib/db/strip.ts` (`PlanStrip.dayId`), `src/state/session-store.ts` (`choosePlanDay`), `src/components/empty-note-cards.tsx` | Shows only with a split AND ≥1 logged session, on today, note empty, keyboard down; otherwise the plain `PlanStrip` rendered as before — **both are gone: the card was removed 17 Aug and the strip 18 Aug (see the change log), so nothing from this row is on Today any more; `getPlanDayChoice`/`setPlanDayChoice` and `PlanStrip.dayId` survive because the calendar sheet and Next's brief still read them.** The chip answer is persisted day-keyed in the local meta KV and read inside `resolveTodayPlanDay`, so the strip, calendar sheet and Next brief agree with it by construction (deliberately not synced — a gym-device answer that expires at midnight). Start only calls `focusNote()`; nothing is written into `raw_text`. The empty-day LAST SESSION peek yields to the card's own last-session line in exactly the card's eligibility condition. Entirely deterministic — no model call, so no §9.4 evaluation needed. No §13 event exists for this surface; none was invented. |

---

## Section 9 — Next: the personal training brief

> **12 Aug 2026 — presentation refactor (owner).** The tab's *content* is
> unchanged; where it sits is not. `src/lib/next/sections.ts` is a new PURE,
> tested view model (30 cases, `sections.test.ts`) holding three rules the
> screen used to hold implicitly:
>
> 1. **One exercise, one home** — `Next session > Standing still > Moving`.
>    A lift that was prescribed *and* plateaued *and* climbing used to appear
>    three times with three different numbers. A plateau on a prescribed lift
>    is now that row's WATCH line instead of a separate section.
> 2. **The brief collapsed** to one stat + one highlight (2 lines, hard). The
>    composed paragraph and its model rewrite are unchanged and still guarded —
>    they moved behind a "More" disclosure. Adherence below 50 % now has **no
>    code path to the screen** (`adherenceChip` returns null), so "0 of N
>    prescriptions followed" cannot render.
> 3. **A trust guard on e1RM deltas** — see the row added below.
> 4. **The session row leads with the DECISION, not the arithmetic.** It printed
>    `last 3×5 120 → 3×12 120 kg` and left the reader to diff two strings for an
>    answer the engine already had. `Reason.code` is now projected to a `Move`
>    (`plan/prescribe.ts` — a projection; **no branch of `progressStrength` was
>    touched**) and phrased by `moveLabel` (`next/sections.ts`): "ADD 2.5 KG",
>    "ADD A REP", "HOLD THE WEIGHT", "BACK OFF". `signal` green moved off the
>    load and onto that label, where it is a word at eyebrow scale rather than a
>    tinted digit; the load is now ink and the largest reading on the card.
>    Green-as-text on its own wash measured **4.33:1**, under §14.3's AA floor —
>    that is what ruled out the tinted-chip alternative. The ghost path carries
>    no reason code, so those rows show no label rather than a guessed one.
>
> Section components live in `src/components/next/` and are deliberately
> self-contained, so the planned session-type chips can land above them without
> touching any of this. New `attention` colour token (`theme/color.ts`,
> #B45309, measured 4.58:1 on the canvas) for plateau/backoff/paused only.
> **Product-direction §4.2 does not yet record this token — it needs a dated
> §14.3 amendment, which CLAUDE.md rule 8 says the owner writes.**

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Moving deltas are believable | **partial — guarded at the display layer** | `src/lib/next/sections.ts` (`movingReading`, `DELTA_SUSPECT_RATIO`), `sections.test.ts` | The section was printing figures like "+64 kg over 8 weeks". Any delta above **25 % of the lift's current e1RM** is now refused and the row shows a direction ("climbing · 8 wk") with no number; the refusal is `devWarn`-logged. **The arithmetic underneath is still wrong** and carries `TODO(est-1rm-window)`: `findMovers` (`db/brief.ts`) takes `last.e1rm − first.e1rm` over `getE1rmSeries`, whose `limit` counts SESSIONS rather than weeks — so "8 wk" labels an unbounded window — and `first` is a single session, so one rep-out day against a later heavy day manufactures a large "gain". Fixing the baseline and the window is what lets this guard go quiet. |
| Leads with one composed briefing paragraph, not status cards | **done** | `src/app/(tabs)/next.tsx`, `src/lib/brief-prose.ts` (+ `brief-prose.test.ts`), `src/components/next/brief.tsx` | Deterministic, pure, tested. 30 Jul: composed in §9's own order — the paragraph OPENS with the week's sessions (`Brief.sessions7`) before the coming session. 13 Aug: the brief is no longer a card. `BriefLede` puts its one-or-two-line standfirst on bare paper under the title (that IS §9's "short briefing paragraph"); `BriefFooter` keeps the full paragraph and its provenance behind one disclosure at the foot of the page. Nothing was removed — the prose is still composed, guarded and model-upgraded. |
| Page has a focal point | **done** | `src/components/next/session.tsx`, `src/components/next/signals.tsx` | 13 Aug rebuild. The page was four raised cards of equal weight with the load — the number the tab exists for — at 19 pt and third from the top. Now: exactly ONE raised surface (the first lift of the session), its load at 30 pt in the reading face, and the engine's lever above it as a filled pill. The rest of the session is plain rows on paper; "standing still" and "moving" (one table split in two, identical row shape) became a single horizontally-scrolling tile strip. |
| Split preview: any day of the athlete's own split, not just the one due | **done** | `src/lib/db/strip.ts` (`planStripFor`), `src/lib/db/brief.ts` (`planDayLines`, `enrichLines`), `src/lib/next/sections.ts` (`sessionRowsOf`), `src/components/next/split-chips.tsx` | 13 Aug. `computePlanStrip` was split so ONE function progresses a named day-template; the preview therefore cannot state a load the real strip would not. Chips appear only with ≥2 plan days. **Selecting one writes nothing and does not move which day is due** — `setPlanDayChoice` stays the session-start card's job (§8.2) — and the due day carries a blue dot wherever it sits, so a preview can never be mistaken for the real thing. The ghost sentence is deliberately not passed to a preview (it belongs to the session actually due). A previewed day with no logged history says so instead of rendering an empty card. |
| Save a session as a split day from Today | **done** | `src/components/save-split.tsx`, mounted in `src/components/session-summary-sheet.tsx`; `src/lib/funnel.ts` (`markSplitDaySaved`, `split_days_saved`) | 13 Aug. A split day could only be authored in a blank editor under You, which is the wrong end of the app — the session was already written and read back. The summary sheet (resting pill → tap **— the pill was removed 18 Aug, so this is currently unreachable; see the change log**) offers "Save as a split day": `suggestSplitLabel` proposes the name, the field is editable, and **nothing is written until Save**. It stores the MOVEMENT NAMES only, one per line, in performed order — no loads, no reps, because `computePlanStrip` works those out from real history and a baked-in number would be a second, staler source. Below 2 movements it renders nothing; a session with ≥50 % exercise overlap with an existing plan day says "This is your Push day" and offers nothing, so the rotation cannot be corrupted by a duplicate. Keyed on the selected day so a saved-confirmation cannot follow a day-swipe. |
| Movement-pattern classifier (push / pull / legs) | **done, consumed by the capture block** | `src/lib/split/pattern.ts`, `src/lib/split/pattern.test.ts` (13 cases) | 13 Aug, step 1 of the owner's auto-split feature. Pure lexicon, zero I/O, `node --test`. Classifies by WORKING SET rather than by exercise (4 sets of bench vs 1 of curls is a push day, not an even split), and `unknown` sets stay in the denominator so a half-recognised session comes out LESS confident. **Contested movements — deadlift, RDL, upright row, pullover, olympic lifts, good morning — return `null` on purpose**; the ambiguity is real and gets resolved by the athlete at the confirm step, not by a cleverer lexicon. `suggestSplitLabel` returns `null` rather than a guess when the record does not support a name, and the capture field then opens empty. Consumed by `save-split.tsx`. **Still not offered automatically after Finish** — that ask, and its "two declines and never again" rule, is not built. |
| Lever contrast on the filled pill | **measured** | `src/components/next/session.tsx` (`leverSignal`, `leverAttention`) | White on `signal` #547C00 = **4.93:1**; white on `attention` #B45309 = **5.02:1**. Both clear AA for normal text at the label's 10.5 pt bold. The August rejection of a filled chip was of green text on a green *wash* (4.33:1) — a different measurement. The load itself stays ink. |
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
| **§9.4** Owner-run evaluation for prompt/schema/guard changes | **done (owner run pending)** | `scripts/parse-eval.ts` + `scripts/parse-eval-cases.json` (79 cases, `npm run eval`); `scripts/brief-eval.ts` + `scripts/brief-eval-cases.json` (v1: 10 model + 10 guard cases, `npm run eval:brief`) — 6 Aug | Both AI surfaces now have the §9.4 shape: versioned in-repo cases, one documented command, pass/fail per case, and the regression rule stated in the case file. The brief eval runs the deployed prompt VERBATIM (extracted to `supabase/functions/explain-brief/prompt.ts`, same arrangement as the parser) and holds raw rewrites to the house style, the number whitelist and `brief-guard` itself; the guard half runs keyless and deterministic. **Neither eval has been run by the owner against the live model since the latest prompt changes.** |

---

## Section 10 — Progress

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Factual overview of frequency, consistency, lift movement | **done** | `progress.tsx` (`SummaryCard`, `verdictLine`, `splitLine`) | 4 Aug: the one sentence grew into a summary card — up/same/down split bar, sessions and rate, longest gap, new bests, and the biggest move named with its number. Every figure is counted from stored rows. |
| Time ranges 8 weeks / 6 months / 1 year | **done** | `progress.tsx` (`RANGES`) | Longer ranges dim until the record reaches back. |
| Card per lift with underlying sessions one tap away | **done** | `progress.tsx` (`LiftCard`), `src/components/exercise-sheet.tsx`, `src/components/session-sheet.tsx` | |
| Metrics: e1RM, heaviest, volume | **done** | `progress.tsx` (`METRICS`), `src/lib/db/progression.ts` | |
| Metrics: reps at a load, sport/hybrid workload | **missing** | — | No sport/hybrid data model exists (see §5 screen 5). |
| Continuous line, every vertex a real session, no overshoot (§10 as amended 6 Aug 2026) | **done** | `src/components/charts.tsx` (`seriesPathD`, `SeriesShape`), `TrendChart` + `ProgressionChart` both call it with the `linear` default | Owner replaced the step-only rule ("ne stopnice, ampak lepo linearno … ker želim smooth"); §10 and §14.3 now carry the amended wording. Straight segments between consecutive sessions, dotted vertices, no spline anywhere, `shape="step"` still available. |
| **Blue primary line with a soft contextual fill** | **done** | `charts.tsx` (`TrendChart`, `tint`/`fill` props) | 4 Aug: blue (`color.trained`) line with a gradient wash, per-session dots, and a surface-ringed latest point. Range segment and metric underline moved to the same blue, so control and chart read as one system. |
| Neutral prior-best / reference marks, readable axes | **done** | `charts.tsx` (`TrendChart` `axis` prop, `styles.gutterValue`) | Unlabeled dashed hairline for the all-time best; min/max readings in a right gutter pinned to their own y, muted mono (never the line's hue). Volume ≥ 10k shortens to `k` rather than clipping (`axisValue`). |
| Empty state says what evidence is needed | **done** | `progress.tsx` (`view.counted === 0` branch, `BuildingRow`) | "Two more sessions of the same lift…" plus a *Not enough sessions yet* list: a lift with one or two sessions is named and openable instead of vanishing (`buildProgression.belowFloor`). |
| Ranked by measured movement, no deload-as-failure, no red/green judgement (§10 as amended 4 Aug 2026) | **done** | `progress.tsx` (`percentText`, `styles.barDown`), `src/lib/progression.ts` (`sortLifts`) | The list is ranked by movement (`sortLifts('gain')`, on the percentage so kilos can't rank a deadlift above a curl forever), with Recent and A–Z one tap away. Not flattery: a lift that fell ranks where its number puts it, draws in the same blue, chips a grey *down 2%* word with no leading minus, and the "BIGGEST GAIN" tag appears only when the leader actually gained. |
| Per-lift blue/ember comparison | **partial** | `progress.tsx`, `src/components/exercise-sheet.tsx` | Blue is live on the Progress cards; ember stays the lift sheet's single-series hue. |
| Meaning carried without colour | **done** | `progress.tsx` (`splitLine`, `percentText`, bar `accessibilityLabel`) | Deltas are words plus numbers; the split bar repeats itself in text underneath and carries the same string as its accessibility label. |

---

## Section 11 — Profile, calendar, context

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Calendar shows trained days in blue and opens the real session | **done** | `src/components/calendar-sheet.tsx:185,204,332`, `src/components/history-sheet.tsx` | |
| Profile makes onboarding context editable | **partial** | `src/app/(tabs)/you.tsx` (Training section) | Editable: focus, experience, how you train, session style, usual days, writing language, units, smallest plate, bar weight, split, and (6 Aug) body context in place. Still missing: priority movement. |
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
| **§12.1** Weekly recap notification: one per week, factual, editable time, off in one tap | **built (device-unverified)** | `src/lib/recap.ts`, `src/components/week-recap-card.tsx` (mounted in the composer's empty state, 6 Aug), `src/app/(tabs)/you.tsx` (Notifications section), `src/app/onboarding/[step].tsx` (`setRecapIntent`) | The card greets the first empty open of a new week again. The notification: off by default; offered on the first recap card ONLY to someone whose onboarding answer was yes (exactly the copy promised — "once your first recap is ready"); permission asked in that context, never re-asked after a denial; You → Weekly recap turns it on/off in one tap and edits the Sunday hour in place. Content is factual (sessions of the ending week; an empty week states a neutral fact) and is re-computed + re-scheduled on every Today open and every Finish, so the fired text is as current as the record's last change. Nothing here has run on a device. |
| **§12.1** No other recurring notifications | **done** | `src/lib/billing/notifications.ts`, `src/lib/recap.ts` | The one-shot trial reminder and the single weekly recap; the recap cancels its pending notice the moment it is turned off. |

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
| Weekly recap enabled / delivered / opened / disabled | **partial** | `funnel.ts` (`markRecapToggled`, 6 Aug) counts enabled and disabled, both in the snapshot. Delivered/opened need notification-response listeners and are still missing. |
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
| §4 Prompt/guard changes require the owner-run evaluation | **done (owner run pending)** | parser `npm run eval` + brief `npm run eval:brief` (6 Aug); see §9.4 |

---

## Where the repository is genuinely strong

Worth knowing before planning, so none of it gets rewritten by accident:

- The **pure, node-testable core** — `predict/engine.ts`, `plan/prescribe.ts`, `streak.ts`,
  `effort.ts`, `billing/trial.ts`, `brief-guard.ts`, `tour.ts`, `plates.ts` — 180 passing tests
  with zero imports so they run under plain `node --test`.
- The **parser pipeline and its 79-case evaluation** (`npm run eval`), which is exactly the shape
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

## Per-entry notes (owner ask, 4 Aug 2026) — what shipped, and what is still unverified

The owner's ask: *a glyph beside every logged entry that opens somewhere to write how the set
felt, and have that count for Next.*

### Files

New: `src/lib/entry-note.ts` (the pure model) + `src/lib/entry-note.test.ts`,
`src/lib/db/entry-notes.ts`, `src/components/entry-note-sheet.tsx`,
`supabase/migrations/20260804000000_entry_notes.sql`.
Changed: `src/lib/db/schema.ts` + `src/lib/db/index.ts` (schema v5 and its ALTER),
`src/components/note-surface.tsx` (the bubble and the quote on a card), `src/components/icon.tsx`
(`note` / `note-on`), `src/state/session-store.ts` (`entryNotes`, `noteTarget`, `saveEntryNote`),
`src/app/(tabs)/today.tsx` (mounts the sheet), `src/lib/db/brief.ts` (`BriefNote`,
`BriefLine.note`, `Brief.notes`), `src/lib/brief-prose.ts` (`whenLabel`) + its test,
`src/app/(tabs)/next.tsx`, `src/lib/sync/index.ts` (push and pull), `src/lib/export-json.ts`,
`src/lib/funnel.ts`.

### The three decisions, recorded so they are not silently re-litigated

1. **A sentence never moves a weight.** The sheet carries BOTH the entry's effort scale and its
   note, because the ask — "and have it count for Next" — has exactly one honest mechanism:
   effort appends `rpe 8` into the line (`lib/effort.ts` → rir → the engine), which genuinely
   changes the next prescription; the note is quoted back beside that lift and changes nothing.
   Letting free text move a load would need a model to interpret it, which CLAUDE.md §2 rule 3
   forbids in as many words. The sheet says both things out loud rather than implying either.
2. **A quote never enters the model's paragraph.** `briefProse` is untouched, so no note text is
   sent to `explain-brief` and no rewrite can reword the athlete's own words. Asserted by a test.
   This is also why the change needs **no §9.4 evaluation**: no prompt, response schema or guard
   was touched.
3. **Keyed by exercise, stored as one JSON column on `workouts`** (schema v5). Line indexes shift
   when a line is deleted and set text changes the moment a number is corrected — both would
   orphan a note. A column inherits the row's RLS, cascade delete, local wipe and JSON export the
   way the reflection does; `sets.note` could not hold it, because that table is a projection
   rebuilt on every re-parse.

### Verified by the repository gates

`typecheck` · `lint` · `npx expo export --platform ios` · **269 unit tests**, of which 18 are new:
16 for the note model (prompts that ask and never instruct; stored verbatim in any language;
every empty form meaning no note; over-long refused rather than truncated; the key matching one
lift's spellings and nothing else; an immutable set/clear; the per-workout cap refusing a new
entry instead of evicting a written one; stable serialization; and a malformed or hostile stored
value resolving to no notes rather than a throw) and 2 for the brief (the relative dateline on a
quote, and the assertion that no note text reaches the composed paragraph).

### What remains unverified

- **No screen has been rendered.** The bubble's 44 pt target beside the check and the card body,
  the sheet's keyboard behaviour, the quote at large Dynamic Type sizes and Reduce Motion on the
  sheet all follow existing tokens but were not checked on a device. Step 7's QA pass.
- **Nothing has been written to the new column on a device.** `setEntryNote`, the v4 → v5 ALTER
  for an upgrading install, and the sync push/pull of the column are verified by typecheck only.
- **The Supabase migration has not been applied.** `supabase db push` is an owner action. Until
  it runs, sync push will reject the new column — the local record is unaffected, but the server
  copy will not carry entry notes.
- **The counter is not a §13 event.** `entry_notes_added` / `first_entry_note_at` are local
  counters beside the reflection pair; naming them in product-direction §13 is the owner's call
  (CLAUDE.md §2 rule 8).
- **Only the composer's ledger shows the bubble.** The read-only lapsed ledger, the session sheet
  and the lift history sheet do not display entry notes yet.

---

## UX dead-end pass + §12.1 recap + §9.4 brief eval (6 Aug 2026) — what shipped, and what is still unverified

A full-feature audit (four read-only agents over every screen, component and lib module) found
six broken or promise-breaking paths and three finished-but-unwired features. This pass closed
them; nothing else was redesigned.

### The six dead ends, closed

1. **"Fix reading" was unreachable.** `openFixSheet` had zero callers — its only entry died
   when `session-receipt.tsx` was orphaned, taking the whole correction flywheel
   (`parse/correct.ts`, alias learning, the repair-rate counter, the review gate's
   "just-repaired" veto) out of the shipped UI. Two entries now exist: the **alias echo** on a
   settled card ("· “tricpes”") is a button straight into the sheet, and the inline editor
   carries a quiet **fix reading** action while the line has a reading (`note-surface.tsx`).
   Both dismiss the keyboard first; stale comments in `session-store.ts`/`today.tsx` were
   re-anchored.
2. **Restart onboarding stranded subscribers on the paywall.** The Ready step now hands back to
   the dispatcher (`router.replace('/')`): a fresh user still meets the paywall gate there; an
   entitled replay returns to Today (`onboarding/[step].tsx`).
3. **Progress's empty-state "Import from Hevy or Strong" button only pushed /you.** It now runs
   the real import in place (`pickAndImportCsv` → funnel marks → `recachePredictionFromLatest`
   → `hydrate` → re-read), with busy label and honest invalid/failed lines (`progress.tsx`).
4. **Body context was read-only in You** (the only editor was a full onboarding replay — §11
   violation). Now an accordion editor: weight in the display unit, height in cm, both
   validated by the existing pure parsers, an emptied field clears the value, a unit switch
   re-derives the field text from the stored metric value (`you.tsx`).
5. **The check-in's way back did not exist** ("Reachable again from the receipt" promised a
   surface with zero importers). The session summary sheet (resting today pill) now carries
   **Add a reflection / Edit your reflection**, handed off on `onClosed` per the one-modal
   rule; the check-in's foot copy tells the truth again (`session-summary-sheet.tsx`,
   `check-in-sheet.tsx`).
6. **The calendar's green PLANNED dot was declared and never drawn.** Today wears it when a
   split day is genuinely due and the day isn't logged yet (trained beats planned, §4.2), and
   the legend lists green only while the dot can actually appear (`calendar-sheet.tsx`).

### The three unwired features, activated

- **§12.1 weekly recap** — see the §12 table row for the full mechanism (`src/lib/recap.ts`;
  card mounted in the composer's empty state; intent persisted from onboarding by
  `completeFlow`; offer on the first recap card; You → Notifications row; §13
  enabled/disabled counters).
- **Session share** — the summary sheet gained a share icon: a fixed-width archival PNG
  (wordmark, date, totals, up to ten rows with PR labels) captured off-screen and handed to
  the system share sheet; failure is silence (`session-summary-sheet.tsx`). The record now has
  exactly one way out of the app that isn't a data export.
- **§9.4 brief evaluation** — `npm run eval:brief` (see the §9 table row). The explain-brief
  prompt was extracted verbatim to `supabase/functions/explain-brief/prompt.ts` so the eval and
  the deploy cannot drift; `index.ts` behaviour is unchanged.

### Decisions recorded so they are not silently re-litigated

- **The recap notification's content is computed at schedule time** and re-scheduled on every
  Today open and Finish. A session can only be logged inside the app, so the fired text is as
  current as the record's last change — this is how a static local notification stays §12.1-
  factual without a server.
- **Enabling the recap can never lie:** if the OS permission is denied, the row stays Off and
  says why — an "On" that can never fire would violate §2. A denial is permanent (canAskAgain
  + a local asked-flag) and the card offer hides itself for good.
- **The recap day is fixed (Sunday), the hour is editable** (08/12/18/20). §12.1 mandates an
  editable time; a day picker was judged surface without evidence. Revisit only with usage.
- **Share renders its own off-screen card** rather than capturing the live sheet — a capture
  of a scroll view lies about anything below the fold.

### Verified by the repository gates

typecheck **0** · `npm test` **269/269** · lint **0** · `npx expo export --platform ios`
**pass** · `npm run eval:brief` guard half **10/10** (model half not run from this machine —
owner's key, owner's run).

### What remains unverified

- No screen of this pass has been rendered on a device; the recap notification (permission
  ask, Sunday firing, cancel-on-disable) is untestable in a simulator-less session.
- The §9.4 brief eval's model cases have not been run — the 30 Jul brief rewrite stays "not
  fully verified" until the owner runs `npm run eval:brief` with a key.
- The share PNG's system share sheet is presented from inside an RN Modal — believed fine
  (standard UIKit), unproven on device.
- Recap delivered/opened §13 events still missing (need notification-response listeners).

---

## Onboarding polish + the Today session flow (13 Aug 2026) — what shipped, and what is not verified

Against `docs/spec/onboarding-today-v2.md`, sections A–F.

### Files

| §  | What | Files |
|----|------|-------|
| A | Static, manifest-placed illustrations | `components/onboarding/illustration-layout.ts` (new), `illustrations.ts`, `IllustrationSlot.tsx`, `tokens.ts`, `config.ts`, `band.ts` (new), `app/paywall.tsx` |
| B | Keyboard-driven band transition | `components/onboarding/band.ts` (new), `OnboardingScreen.tsx` |
| C | The Today paper field | `lib/paper-field.ts` (new), `components/paper-field.tsx` (new), `app/(tabs)/today.tsx` |
| D | Labelled start affordance + picker | `lib/session-options.ts` (new), `lib/db/planned.ts` (new), `components/session-picker-sheet.tsx` (new), `session-start.tsx`, `bottom-toolbar.tsx`, `app/(tabs)/today.tsx` |
| E | Planned sets and progression | `lib/planned-session.ts` (new), `components/planned-checklist.tsx` (new), `state/session-store.ts`, `lib/db/planned.ts` |
| F | Constraints | nothing under `lib/parse/`, `lib/plan/prescribe.ts`, `lib/predict/`, `app/(tabs)/next.tsx` or `components/next/` was touched |

### Decisions recorded so they are not silently re-litigated

- **The mascot does not move at all.** The float-and-breathe loop is deleted, its tokens with
  it, and a `video` registry entry now renders its POSTER — an animated illustration is a loop
  by another name. `no-loop.test.ts` fails the build if any looping primitive returns to the
  onboarding directories.
- **Every manifest value is neutral, and that is a finding** (corrected on the owner's screen
  recording, 14 Aug 2026). Offsets are zero because the drawings are exported trimmed to their
  own alpha bounding box, so the file's centre IS the artwork's centre. Scales are 1 because the
  first pass scaled the two drawings wider than the band (`experience` 1.25, `key-lift` 1.33) up
  to band height — and on a 430 pt device `key-lift`'s plates were **cut off flat by both screen
  edges**: the cap had been derived on a 393 pt phone, and screen ÷ text column shrinks as
  phones get wider (1.147 → 1.139 → 1.126). `MAX_SAFE_SCALE` now names that wall and the test
  enforces it. The premise was also thin — those two frames hold three figures and a loaded bar,
  so scaling the frame does not make the FIGURE match its neighbour.
- **A screen that will never have artwork reserves nothing.** `building` and `founder-note`
  shipped in the recording with the slot's "asset missing" placeholder — a large empty box with
  their own slug printed in it — and a third of the window held above their content. The slot
  now distinguishes "no illustration, ever" (`hasArtwork`) from "it has not landed yet", and the
  band collapses to zero on the three typographic screens.
- **The keyboard transition animates a layout property on purpose.** §4.3 bans it in general;
  here the ban's own failure mode — a step change in layout — was the defect, and the band's
  height now follows `useAnimatedKeyboard()` through one worklet, so it borrows the system's
  duration and curve instead of guessing them.
- **A worklet may call NOTHING this repository declares** (learned the hard way, 14 Aug 2026).
  The first device run of the new onboarding screen threw `TypeError: clamp01 is not a
  function`: `keyboardProgress` shared a `clamp01` helper, and a workletized declaration is not
  initialised in the closure the UI runtime evaluates. `band.ts`'s three worklets are now
  self-contained — the clamp is written out three times and the band's two heights are computed
  on the render thread and passed in. Neither `tsc` nor Reanimated can catch this, so
  `band.test.ts` reads the file and fails on any worklet that calls a module-scope function.
- **Planned sets are excluded from every total structurally, not by filtering.** A planned row
  has never been written into `raw_text`. Ticking a circle writes the line through `setNote`,
  the path a typed line has always taken, so a tapped set and a written set are the same kind
  of fact and no second ledger exists to disagree with the first.
- **"Repeat last session" is not progressed.** The split days go through the engine; a repeat
  repeats. A repeat that quietly adds 2.5 kg would be the app choosing a plan (§2 rule 3).
- **The checklist writes kg**, the app's storage unit and the unit the plan strip already
  displays. A lb-first note is a separate change to make everywhere at once.

### Verified by the repository gates

`npx tsc --noEmit` **pass** · `npm test` **387/387** (331 before; 56 new across six files) ·
`npm run lint` **pass** · `/usr/bin/grep -rn withRepeat src/components/onboarding
src/app/onboarding` → no matches.

### What remains unverified

- Nothing here has been rendered on a device. §A.4's "iPhone SE / 15 / Pro Max" is verified as
  ARITHMETIC (`band.test.ts` runs all three window heights) — not as pixels, and not for
  clipping or overlap at Dynamic Type 1.5×.
- The paper field's "no visible banding" is a display property; the stops are asserted to be
  warm paper a few units apart, but the ramp has not been looked at on hardware.
- The keyboard transition's 60 fps claim is untested; the spec's fade fallback has not been
  needed or built. The screen itself now RENDERS on device — the 14 Aug worklet crash above was
  found and fixed there — but the transition has not been watched under a finger.
- The picker and the checklist have not been exercised against a real split or a real
  parse — only their pure decision layers have.
- No prompt, schema or guard was touched, so no §9.4 evaluation is owed.

---

## Change log

- **18 Aug 2026** — **the resting pill is gone from Today** (owner, same pass as the plan
  removal above). `SummaryPill` is unmounted from `app/(tabs)/today.tsx`: neither the live
  "last set · Bench Press · 82.5 kg × 5 · 1:30" nor the settled "today · N sets · X kg" is
  drawn any more, and the bottom of the screen belongs to the keyboard alone. **This is a
  feature loss the owner accepted when choosing it, not an oversight:** the pill was the only
  opener of `session-summary-sheet.tsx`, so the session summary, its share-card export, and
  **"Save as a split day"** (`save-split.tsx`) are now unreachable from the app — the split-day
  data path is untouched, it simply has no door. `summary-pill.tsx`, `session-summary-sheet.tsx`
  and `save-split.tsx` stay in the tree with unmounted headers; restoring the pill restores all
  three. Recorded as an amendment in product-direction §14.3. Gates: typecheck 0 · 404/404 ·
  lint 0 on the touched files. **Unverified:** iOS export, device QA.
- **18 Aug 2026 (second pass)** — **planned green comes back to Next** (owner:
  *"add that planned somewhere near the top, and use green the way Progression does"*).
  product-direction §4.2 has always said planned green is for *"a concrete future
  prescription only, always with its label and reason"*, and Next — the screen that is
  nothing but future prescriptions — was drawing all of them in ink. The fourth data
  state (Planned) had been visible in the plan strip's green values on Today, and left
  with it earlier the same day. Three changes, all inside §4.2 rather than amending it:
  **(1)** a `Planned · Today · Push day` eyebrow in `signal` green above the card list,
  replacing a muted eyebrow that only appeared when the split chips did NOT — so the
  commonest case, a lifter with a split, had no statement anywhere that these loads are
  unlifted; **(2)** the load itself in `signal` at 28 pt (4.93:1 — large text owes 3:1,
  so it clears its floor and the normal-text 4.5:1 too), unit included, with the rep
  scheme staying ink because it is how the load is arranged, not a second load;
  **(3)** the lever drops its solid fill for **Progression's `shareChip`** — same
  `radius.sm`, same 6/2 padding, same 11 pt reading face at 700. The TREATMENT travelled
  from Progression, the HUE did not: `gain` may never stand in for `signal` (recorded is
  not planned), so two new tokens carry it — `signalWash #F5F8EE` (**4.59:1**) and
  `attentionWash #FBF5F0` (**4.64:1**). They are paler than the `gainWash`/`lossWash`
  pair they echo because they have to be: `signal` and `attention` are lighter hues than
  `gain`/`loss`, and at `gainWash` strength they measure **4.24:1** and fail §14.3.
  Every figure above was computed, not estimated. Gates: typecheck **pass**, `npm test`
  **404/404 pass**, lint **pass**. **Unverified:** device QA and the iOS export.
- **18 Aug 2026** — **Next wears Progression's clothes** (owner: *"Next should be the same as
  Progression, only performing its own function — I want the same consistency"*). The two tabs
  had drifted into two design systems, and none of the six differences carried a meaning:
  header (`title2` + right-hand dateline → `StubScreen` large title + ONE counted line), gutter
  (`spacing.lg` → `spacing.xxl`), control (a horizontal ink-filled scroller → the wrapping
  blue-wash pills), list (one 30 pt hero card + plain hairline rows → **one card per lift, all
  equal**, staggered, single-open accordion, closing on a `Full history` opener), secondary
  block (a horizontally-scrolling tile strip → eyebrow-with-count + hairline rows + one closing
  line), and tail (a bordered card-shaped row → the quiet row + chevron). New shared control
  `src/components/chip-row.tsx`, used by BOTH screens; `next/split-chips.tsx` and Progression's
  inline sort row now only decide what goes in it. **A contrast fix rode along:** the selected
  chip's label was `trained` blue on the 10% blue wash — **3.5:1**, under AA for a 13 pt caption
  — and is now ink (15.6:1) with the wash and border carrying the blue, which as non-text marks
  owe only 3:1. That changes Progression's chip too, deliberately: one control, one measurement.
  The lever pill keeps its solid fill (white on `signal` 4.93:1, on `attention` 5.02:1) rather
  than adopting Progression's washed chip, which at that wash strength would measure 4.24:1 and fail.
  **Plumbing:** `PlanRow.scheme` (`plan/prescribe.ts`) and `BriefLine.loadKg`/`.scheme`
  (`db/brief.ts`) carry the load and the rep scheme out as VALUES, so the card can set the
  figure at 28 pt and the scheme under it without splitting `value` apart on screen (§7.7);
  `SessionRow` gains `canonical`, `loadKg`, `scheme`, `beatsBest`. A line with no figure — a
  ghost, cardio or bodyweight row — prints the whole prescription one size down rather than
  guessing, and a line with no history at all drops to a counted "Also in this session" block.
  Nothing a model touches changed, so no §9.4 evaluation is due. Gates: typecheck **pass**,
  `npm test` **404/404 pass**, lint **pass**. **Unverified:** device QA (Dynamic Type ceiling,
  VoiceOver order, Reduce Motion) and the iOS export.
- **18 Aug 2026** — **the plan left Today** (owner). The read-only `PlanStrip` between the
  header and the composer is unmounted: Next's brief already opens with the identical rows off
  the identical `computePlanStrip` read (`Today · <day>`, `lib/db/brief.ts` → `lib/next/
  sections.ts`), so Today was printing the same prescription its author lives one tab away —
  and putting a list of what to DO on the page whose job is to record what happened. Today now
  holds nothing between the header and the note. `components/session-start.tsx`, whose only job
  was that slot (its other branch, the planned checklist, has been unreachable since the picker
  went on 17 Aug), is **deleted**; `plan-strip.tsx` and `planned-checklist.tsx` stay in the tree
  with unmounted headers so a way back is one line in `app/(tabs)/today.tsx`. The accessory
  bar's plan button is untouched — the plan is still one tap into the note while writing.
  Recorded as an amendment in product-direction §14.3. Gates: typecheck 0. **Unverified:**
  device QA, and the full test/lint/export run.
- **17 Aug 2026** — **the canvas is white** (owner). `color.bg` and `color.surface` are both
  `#FFFFFF`, the hairline/divider/recessed greys lost their warm cast (`#D5D5D5`, `#E9E9E9`),
  the Today canvas field is three neutral near-whites within four units of white
  (`lib/paper-field.ts`: `PAPER` → `CANVAS`, `isPaperTone` → `isCanvasTone`), and the splash
  background follows in `app.json` + the generated iOS colorset. The elevation model changed
  with it and the comments say so: nothing is lighter than white, so a card is white on white
  and its border and shadow are its whole edge — 55 of the 58 surface styles already carry a
  border, and the three that do not (`aliases.tsx` alias rows, one `fix-sheet` pressed state,
  the `WeightInput` selected segment) all still read on their separator or their recessed
  container. Every ink was re-measured on the new canvas and every one GAINED contrast (ink
  17.7:1, `textSecondary` 5.1:1, `textMuted` 3.6:1, `attention` 5.0:1, `gain` 5.4:1, `loss`
  5.6:1, glyphs 3.9–6.4:1) — the ink-ladder contract holds unchanged. **Not touched:** the
  Android adaptive-icon background and `scripts/build-icon.py` (brand art, not an app
  background) and `scripts/build-legal-html.ts` (the hosted legal pages still render on paper).
  Onboarding illustrations were checked rather than assumed — the bundled ones are transparent
  PNGs, so nothing carries a baked paper rectangle onto the white flow. Gates: typecheck 0 ·
  **404/404** · lint 0 · iOS export pass. **Unverified:** device QA — white on a real display,
  and whether any surface the audit cleared still needs a stronger edge in daylight.
- **17 Aug 2026** — **the "Start a session" pill is gone from Today** (owner), and with it the
  one exception to "the furniture arrives with the record". An empty today is the blank page and
  its placeholder, nothing else. `SessionStart` keeps only its two remaining states (planned
  checklist / read-only plan strip); `session-picker-sheet.tsx` is now orphaned and
  `plannedSession` is unreachable, both left in the tree rather than deleted so the owner can
  decide. Recorded as an amendment in product-direction §14.3, which retires the 6 Aug §8.2
  session-start question.
- **14 Aug 2026** — the owner reports the onboarding animations not running on device. Rather
  than chase it blind, the LAYOUT was made independent of them: the illustration band drops from
  ~a third of the window to ~a quarter (0.36/0.33/0.28 → 0.26/0.24/0.20) and the keyboard band
  gives up a third instead of well over half (0.42 → 0.68 of full), so every typed screen fits
  with the keyboard up even if the transition never plays. The name field and the bodyweight
  card were reworked in the same pass (focus wash, clear button, hint only while empty, kg/lb as
  one segmented control). **Still unknown why the animations do not run** — the first thing to
  rule out is Reduce Motion, which by design disables every entrance in the flow.
- **14 Aug 2026** — device pass on the owner's screen recording of the funnel: `key-lift`
  un-clipped and every manifest scale returned to 1 behind a `MAX_SAFE_SCALE` test, the
  placeholder box removed from the three typographic screens (band collapsed with it), the
  `clamp01` worklet crash fixed, and three subtexts rewritten (`gender`, `tracker`,
  `bodyweight`) that read as fragments or wrong idiom on screen.
- **13 Aug 2026** — `docs/spec/onboarding-today-v2.md` A–F: static manifest-placed onboarding
  illustrations, the keyboard-driven band, the Today paper field, the labelled "Start a
  session" pill with its picker sheet, and the planned-set checklist that writes into the note.
  See the section above.
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
- **4 Aug 2026** — per-entry notes (owner ask): a speech bubble on every settled ledger card
  opens one sheet carrying that entry's effort scale and a free-text note; the note is stored in
  `workouts.entry_notes` (schema v5 + its Supabase migration), quoted verbatim under the matching
  prescription row on Next and in an "In your own words" block, and deliberately kept out of the
  paragraph the model may rewrite. The effort is the only half that changes a prescribed load.
- **6 Aug 2026** — inline comments and negative RIR (owner ask), `PARSE_VERSION` 5 → 6 in
  lockstep with `CLIENT_PARSE_VERSION`. Three parser changes: each element of a rep list now
  keeps its **own** effort marker (`8 (rir 2)/ 9 (rir 0)/ 8 (rir -1)` is three sets with three
  different RIRs, not one marker copied three times); **negative RIR survives** end to end —
  the server clamp moved from `[0,10]` to `[-5,10]`, and `FixSheet`'s `toNum` gained a `min`
  so a manual correction cannot silently round "one forced rep" back to "at failure"; and a
  remark written on a logged line is lifted into the new nullable `sets.note`, attached to the
  set its ordinal names ("zadnjo serijo forma padla") or to the first set when it describes the
  exercise as a whole. **No migration was needed** — `sets.note` already existed locally and in
  Postgres and rode `SELECT s.*` through sync; `applyParseResult` was writing a hardcoded
  `NULL` into it. The comments read back verbatim under each History row in `ExerciseSheet`
  (`ExerciseSession.notes`).
  **This does not weaken the `entry_notes` invariant.** `sets.note` is a PROJECTION — rebuilt
  from `raw_text` on every parse, which is safe precisely because the words live in `raw_text`,
  the record itself. The hand-authored per-entry note stays on `workouts.entry_notes`, authored
  outside the workout text so a re-parse can never touch it, and no parser writes it.
  Prompt cost: 39,715 → 48,077 chars (~11.3k → ~13.7k tokens) for five new worked examples,
  which works against the parse latency noted below — the schema now also emits a `note` field
  on every set, nulls included.
  **Unverified from this machine:** the §9.4 owner-run evaluation. `npm run eval` reads keys
  from the local `.env`; it now carries 79 cases, including the owner's exact failing line and
  a regression case proving a pure-prose line still produces no item. Typecheck, the 269-test
  suite and lint all pass, but **nothing here is confirmed against the live model until the
  owner runs the eval**, and it must pass before deploy.
- **6 Aug 2026** — UX dead-end pass + §12.1 recap + §9.4 brief eval (own section above): six
  broken paths closed (Fix reading reachable again via alias echo + inline editor; Restart
  onboarding routes by entitlement; Progress empty-state import actually imports; body context
  editable in You; check-in reachable again from the session summary; calendar's green planned
  dot drawn with its legend), three unwired features activated (weekly recap card + the one
  §12.1 notification with intent persisted from onboarding, session share PNG, and
  `npm run eval:brief` — the §9.4 evaluation for the brief, with the explain-brief prompt
  extracted to `prompt.ts` so eval and deploy cannot drift). New: `src/lib/recap.ts`,
  `scripts/brief-eval.ts`, `scripts/brief-eval-cases.json`, recap prefs + §13
  `markRecapToggled`, `bell` icon. Gates: typecheck 0 · 269/269 · lint 0 · iOS export pass;
  brief-eval guard half 10/10, model half owner-run.
- **11 Aug 2026** — **21-screen onboarding rebuild (owner's spec).** The illustrated full-bleed
  layout is gone; every screen now uses one vertical template — segmented progress bar (ink /
  ink 15%, count DERIVED from the flow config, welcome and paywall excluded), back chevron,
  question at the TOP with one muted subtext line, a 1:1 **illustration slot** centered in the
  middle band, controls pinned at the bottom (single-select auto-advances after ~200 ms;
  text/number/multi-select show Continue; optional inputs keep empty-means-skip). The whole
  flow is ONE ordered array in `src/components/onboarding/config.ts` (slug, kind, headline,
  subtext, options, storeKey); illustrations resolve by slug through the NEW
  `src/components/onboarding/illustrations.ts` registry — currently empty, so every
  `IllustrationSlot` renders its labelled placeholder square until assets land there (one line
  per asset, no screen files). Twenty config screens + the paywall as screen 21:
  welcome · demo (NEW aha-moment) · name · gender · goal · experience · tracker · why-tracking
  (NEW explainer) · style · days · key-lift · rest-timer · bodyweight · overload (headline
  personalised by goal) · commitment (NEW, with a post-answer affirming line; answer stored
  under the returned `commitment` key, store persist v5) · notifications (intent only, §5.1
  unchanged) · building (NEW processing checklist — every line generated from a real answer,
  advances itself via `replace`, Reduce Motion shows the list at once; NOT the B5 fake-loading
  pattern: it narrates answers actually given, never invented work) · summary (bullets VERBATIM
  from stored answers, name in the headline) · social-proof (product truths only, `// TODO:
  replace with real App Store reviews post-launch`) · trial-timeline (Today / Day 5 / Day 7).
  Paywall: headline now mirrors the key lift ("Built to grow your bench press") or the stated
  goal ("Built for your strength goal"), CTA reads "Start my N-day free trial" with N still the
  STORE's own trial (never a hardcoded 7), price stays in the muted line below the CTA, annual
  stays preselected with the badge still COMPUTED from live prices (a hardcoded "SAVE 44%"
  would break §6's honesty conditions). Deleted: the fabricated `Stars`/`Rating`/`Testimonial`
  components from `primitives.tsx` — **blocker B4 is closed**. New files: `illustrations.ts`,
  `IllustrationSlot.tsx`, `BuildingChecklist.tsx`. Onboarding controls now sit on raised paper
  (`surface`) instead of the old translucent-over-art fill; emoji support removed from
  `OptionRow` (no emoji anywhere in the flow). Funnel events unchanged (`markObStepReached`
  per screen, `setObStepCount` now 20, `markOnboardingCompleted` at the trial-timeline).
  Gates: typecheck 0 · 269/269 · lint 0 · iOS export pass. **Unverified:** device QA (keyboard,
  Dynamic Type, VoiceOver, Reduce Motion on real hardware) and the §5 spec tables above, which
  still describe the previous 14/15-screen flows — `lib/onboarding.ts`'s `OB_SCREENS` remains
  the OLD §5 list and is now historical; superseding it in product-direction §5 is the owner's
  call (CLAUDE.md §2 rule 8).
  **Same-day Mobbin design pass (owner ask):** references Brilliant / Vibecode / Evernote /
  Calm Sleep / Rocket Money / Quicken / MyFitnessPal / Me+ / Centr / Hers / Tolan. Applied:
  back chevron and progress rail merged into ONE chrome row (a full row of vertical space
  back); the just-earned rail segment fades in on arrival (~400 ms, Reduce Motion instant); a
  quiet mono section eyebrow above each headline ("ABOUT YOU", "YOUR TRIAL" — structure
  without a countdown counter); option rows gained a trailing radio circle whose paper-disc
  check springs in on selection, so the 200 ms auto-advance flash reads as "chosen"; the
  building checklist now shows the WHOLE list up front — pending lines muted behind hollow
  circles — and ticks lines one per beat (Calm Sleep / Rocket Money's shape; calmer and more
  truthful than lines materialising); the summary bullets became a raised-paper record card
  with hairline rules and leading checks; the trial timeline got icon nodes (solid ink check
  disc for Today, hairline bell / card discs for Day 5 / Day 7); proof lines lead with quiet
  checks. All motion routes through the existing kit and honours Reduce Motion; everything
  stays ink-on-paper — no green, no blue added. Gates re-run: typecheck 0 · 269/269 · lint 0 ·
  iOS export pass.
- **12 Aug 2026** — **onboarding premium-motion pass (owner ask).** Pure Reanimated 4 — no new
  dependency, no native rebuild; every effect routes through the §14 motion vocabulary (DUR /
  EASE / SPRING, no bounce) and resolves instantly under Reduce Motion. New in the kit
  (`components/motion.tsx`): `FadeScaleIn` (fade + settle-scale — a surface LANDING, used by
  the illustration slot and the summary card) and a `layout` passthrough on `FadeSlideIn` for
  list reflow. New hook `components/onboarding/use-select-fill.ts`: one shared 160 ms
  selection-progress value; option rows, day circles, the kg/lb toggle and the suggestion
  chips now SWEEP to solid ink via `interpolateColor` instead of snapping, labels crossfade to
  paper. The progress rail's earned segment GROWS from its left edge (scaleX, transform-origin
  left) instead of fading. The trial timeline's connecting rails DRAW downward (scaleY from
  top) after their upper node lands. The commitment affirm line's push now glides
  (`LinearTransition` on the option rows, Reduce Motion keeps the instant reflow). The
  building checklist stamps each check with a light haptic tick (`tap()` — felt as well as
  seen; the Reduce Motion path never ticks, so no haptic burst). Gates: typecheck 0 · 269/269
  · lint 0 · iOS export pass. Still owner's call: Lottie support in the illustration slot
  (`lottie-react-native` needs a dev-client rebuild) once the per-screen animated
  illustrations exist.
- **12 Aug 2026** — **Today + "Fix reading" repair pass (owner's eight-point list).** Scope was
  held to those two surfaces; Next, Progress, You, onboarding and the paywall were not touched.

  **The correction sheet (`components/fix-sheet.tsx`, rewritten).** (1) *One canonical column
  order.* The sheet read reps × weight while the athlete writes "100x12" and the card prints KG
  before REPS — repairing a load meant re-mapping the row against the line quoted two inches
  above it. Every set now reads SET → weight → × → reps → RIR. (2) *One control, three times.*
  Weight had steppers, reps was a bare field, RIR was a lone "−" with nothing to subtract from;
  all three are now a tappable mono value flanked by − / +, stepping 2.5 · 1 · 1. An empty field
  is not zero — the first press establishes the value, which is what makes "+" a working answer
  to an unread RIR; the placeholder "RIR —" is itself tappable (→ 0) and a small × clears it
  back to unread. (3) *The set list is editable*: "+ Add set" carries the previous set's numbers
  forward (as a WORKING set, never inheriting its note), a per-row × drops a set, and **"Remove
  this reading"** (destructive, last, confirmed) deletes the parsed item — see below. (4) *The
  alias offer is conditional*: "Always read X as Y" appears only once the Exercise field has
  actually changed, with the real target interpolated; correcting a weight gets one plain
  sentence instead of a radio group with one possible answer. The Exercise row gained a
  trailing chevron and full-row tap (it was a text field disguised as a label), and **Save
  correction is disabled until something has changed** — computed through the same `setOf` the
  save uses, so it can never disagree with `applyCorrection`'s own `setsChanged` test.

  *Removing a reading is the ordinary correction with an empty set list* (`removeReading` →
  `submitFix(exercise, [])`), deliberately: `raw_text` is untouched (§3), the correction row
  re-applies on every future re-parse so the ghost reading cannot return,
  `validateParseResult` drops a set-less item on read-back, and the card gives way to the
  quiet "kept as a note · not counted" block. **The correction payload is unchanged** — same
  `insertCorrection(before, after)`, same overlay, same alias learning, same training data.

  *Units (`lib/units.ts`, + test).* Storage is kilograms always (the parser converts at read
  time), and this is the first surface to show a pound-user their own pounds — which is also
  the first place a conversion could forge a correction nobody made. Drafts keep the original
  kilograms beside the shown text and convert back **only for a field whose text changed**, so
  an untouched sheet round-trips byte-identical. Steps are 2.5 in whichever unit is on screen.

  **Today.** (5) *The corner "42" is labelled and is no longer a streak*: `countSessions` →
  "42 sessions" in muted mono (`db/workouts.ts`, `top-bar.tsx`). A figure that FALLS when you
  rest is a daily goal wearing a serious face, which §20 forbids; a total only grows. The
  streak rule survives untouched in `lib/streak.ts` for the consistency sheet, which still
  opens from that tap and explains its tolerance in words. (6) *The two summaries stopped
  echoing* (`summary-pill.tsx`): the header line stays weekly, and the pill now answers the
  moment — mid-session it shows the LIVE context ("last set · Bench Press 120 kg × 5" plus the
  rest countdown), otherwise the day's totals. On the commonest day of all, where this week IS
  today's session, the same tonnage was printed twice one glance apart; in that settled case
  the pill now drops the load entirely and keeps the set count, so the number appears exactly
  once on the screen whatever state Today is in (the header owns it). `lastSetOf`
  (`parse/receipt.ts`, + tests) reads the last COUNTED set, so a warm-up written after the
  working set is not reported as "what you just did". The rest clock moved into
  `lib/rest-timer.ts` so the pill and the chip can never show two different numbers — only the
  clock moved; the chip still owns its tick, haptic and flash. The pill's scope word now
  follows the day pill instead of always saying "today". (7) *The written line is visible on
  its card* — long-press or the ⋯ row, crossfade, reserved height, read-only. (8) *"same as
  last" names the session it means* — `GutterSignal` gained an optional `at` day
  (`db/history.ts` records the workout it compared against; `db/dates.ts` `shortDayLabel`
  renders "Fri 8 Aug"), and signals cached before this simply say less rather than guessing.
  The per-card note bubble was retired for one end-of-session prompt.

  New files: `lib/units.ts` (+ test), `lib/session-activity.ts` (+ test), `lib/rest-timer.ts`,
  `components/use-session-active.ts`. Gates: typecheck 0 · **283/283** · lint 0 · iOS export
  pass. **Unverified:** device QA on real hardware — specifically the set row at large Dynamic
  Type (it wraps rather than crops, but that is untested on a device), the long-press flip
  against VoiceOver, and the 90-minute settle boundary, which no test can observe in real time.
  Nothing here touches a prompt, a response schema or a guard, so no §9.4 evaluation is owed.
- **12 Aug 2026 (later) — typography token + Settings rebuild (owner's two-part ask).**

  **Part A — one reading voice, one switch.** New `src/lib/theme/typography.ts` owns the two
  families the app is allowed to speak in: `sans` (SF Pro — prose, labels, headers) and
  **`reading`** (every numeric reading: set tables, prescriptions, kg totals, deltas, dated
  comparisons, and the eyebrow labels that title a block of them). `theme/type.ts` keeps the
  SIZE scale and re-exports the families, so `@/lib/theme` stays the single import site;
  `monoText` survives as an alias of `readingText` so the rename did not have to touch every
  caller at once. **115 hardcoded `fonts.mono` sites were migrated to `fonts.reading`** across
  37 files and 38 of them gained the `tabular-nums` they were missing — after this, changing
  the face of every number in the app is `READING_FACE` in typography.ts, one line, and nothing
  else in the codebase names a font. Sizes, spacing and the green #547C00 prescription styling
  were not touched.

  **Same-day follow-up (owner: "tudi za številke daj isti font"): `READING_FACE` is now
  `'sans'`.** Every reading is set in the system face, the same one the prose uses, so the
  screen speaks with one voice instead of two. The columns are unaffected — what holds a set
  table in line is `tabular-nums` (every digit advancing the same width), which `readingStyle`
  applies whatever the family; SF Pro has tabular figures, it simply does not use them by
  default. The switch gained a third option rather than losing one: `'sans'` · `'mono'` (the
  pre-12-Aug ledger look, still one line away) · `'rounded'`.

  **SF Pro Rounded is NOT wired, because the fonts are not in the repository.** The task
  described four OTFs in `assets/fonts/`; that directory does not exist and there is no
  `.otf`/`.ttf` file checked in anywhere. iOS ships the rounded face only as a
  `systemFont(design:.rounded)` descriptor, which React Native's `fontFamily` (PostScript-name
  resolution) cannot reach — so it must be bundled. `READING_FACE` therefore stays `'mono'`,
  which renders exactly as before, and typography.ts carries the three-step instructions plus a
  commented `require` block ready to uncomment. The block is deliberately NOT written against
  missing files: a `require` of an absent asset fails the Metro bundle and the app would not
  start. `loadReadingFont()` is already called from the root layout (before the splash lifts,
  so no number renders in a fallback face and then reflows) and is a no-op until the assets
  land.

  **Part B — Settings/You, rebuilt as grouped cards.** Order: Profile · (the record card) ·
  Subscription · Training · About you · Your record · Integrations · Display · Support ·
  Account · Dev. The grouped-card vocabulary (`Section` / `Row` / `AccordionRow` / `Segmented`
  / `Chevron`) was **extracted from you.tsx into `src/components/settings-rows.tsx`** — it was
  private to that file, and the moment a second settings surface existed the choice was to
  duplicate a hundred lines of chrome or share it. `Row` gained a `warn` tone (amber, for
  reversible-but-heavy) and a `reading` variant so a number on a settings row is set in the
  Part A face.

  New rows and what each one really does: **Rest timer default** (was reachable only by
  long-pressing the Today chip — an unlabelled gesture; same pref, so the two cannot
  disagree) · **Session types** → `/split` → `/plan-day`, the real rename surface ·
  **Reading corrections** → NEW `/aliases`, every shorthand the parser has been taught, with
  swipe-to-delete (new `listAliasOverrides` / `deleteAliasOverride` in `db/alias-overrides.ts`)
  · **Export my record** → one row, an action sheet, JSON leading because it is the only format
  that carries `raw_text` · **Apple Health** → NEW `/health` · **Contact support** → NEW
  `lib/support.ts`, a mailto carrying only version + OS, never a byte of training data ·
  **Rate Recore** → new ungated `canRateApp()` / `rateApp()` in `lib/review` (the gate exists to
  stop the app interrupting someone, not to refuse a person who walked into Settings; the
  attempt is still recorded so a settings tap cannot quietly burn the yearly quota) ·
  **About** — version + the credo "Your words are the record." · **Clear local cache** → NEW
  `db/cache.ts`, which deletes `parse_cache` and re-queues the notes and touches NOTHING else,
  which is why its confirmation can promise nothing is lost and mean it.

  **Icons went monochrome on this surface**: `settings-rows.tsx` tints every row glyph ink at
  60% rather than using `icon.tsx`'s per-glyph hues (`glyphTint`, owner 28 July), which still
  apply everywhere else. Eleven hues down the left edge of a list that is scanned by label read
  as eleven categories that do not exist, and they drown the two colours that carry meaning
  here — red for destructive, amber for heavy-but-reversible.

  **Three places the spec was not followed, each for a stated reason.**
  1. **No Apple Health toggle.** There is no HealthKit anywhere in this repo — no dependency,
     no entitlement, no Info.plist usage strings — so a switch would store a flag while no data
     moved. That is a fabricated feature (§2 invariant 7, "anywhere, including placeholders")
     and health is the worst category to fake one in: a person who believes their training is
     going to Health stops checking. The row opens an honest "not connected" screen carrying a
     TODO with the four things implementing it needs.
  2. **No "rename/merge sheet used on the Next tab" was reused, because none exists.** Next is
     read-only about plan days; renaming lives at `/split` → `/plan-day`, which is where the row
     goes. **Merging two session types does not exist anywhere in the codebase** and nothing was
     invented to suggest it does.
  3. **The subscription card shows no hardcoded renewal date.** "Active · Renews 30 Aug" is
     built from RevenueCat's own clock (`getTrialClock`, `formatChargeDate`) and is simply
     absent when the store has not answered — a written-in date would be exactly the billing
     claim §2 rule 5 forbids before the store integration keeps the promise. Note the store is
     unreachable in this checkout anyway: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is empty in `.env`.

  Gates: typecheck 0 · **283/283** · lint 0 · iOS export pass. **Unverified:** device QA — the
  swipe-to-delete gesture on `/aliases`, the mail composer on a device with no mail account, and
  every one of the 115 migrated reading sites at large Dynamic Type. Nothing here touches a
  prompt, schema or guard, so no §9.4 evaluation is owed.
- **12 Aug 2026 (third pass) — entry sheet consolidated to four actions + the empty Today
  canvas (owner ask).** Scope held to the Today tab.

  **A · The ⋯ sheet is four rows.** It had grown to six, and two were doors to places already
  reachable. **"Edit line" is gone**: repairing an entry is ONE idea — "this is not what I did" —
  and it now has one door. Fix reading carries both halves inside itself via a quiet **"Edit my
  words instead"** link beside the quoted line, which swaps the sheet into a multiline editor
  prefilled from the note as it stands (not the parse snapshot — the athlete edits the line on
  their screen). Saving goes through the new `replaceNoteLine` → `setNote`, so SQLite is written
  in the same tick and the ordinary debounced parse re-reads the line: **no second re-parse
  path**, and the edited text becomes the new written source (§3). The reading-repair UI is put
  away in words mode — steppers editing a reading that is about to be recomputed would be
  theatre — as is "Remove this reading". **"Show my words" is gone** too: the card already
  carries it (long-press to flip, tap the quote to flip back), and a menu row for something you
  do by looking at the card is a detour. What survives is the four things the card cannot do:
  Fix this entry · Add note · History · Delete entry.

  **"& effort" left the note sheet.** RIR is per-SET and Fix this entry now edits it per set; a
  single sheet-wide "how hard was it?" could only ever write one marker for a whole line, so
  keeping both meant two controls writing the same fact at different resolutions. The scale is
  untouched on the end-of-session check-in, where one answer for the session is the question.

  **B · Empty Today is a blank page.** A day with no reading shows the header row and one muted
  line — "Write your training…" — sitting in the upper third (two flex spacers, so it holds on
  every screen and collapses to nothing the moment a card exists). Gone from that state: the
  weekly summary line, the session-start card, the floating pill, the checklist ring, the
  first-session ledger and the weekly recap card. The whole canvas is the tap target (it already
  was — `styles.fill`), the accessory bar keeps the mic, and all the furniture fades back in
  together (`DUR.slow`) the moment the first line is read, so the canvas visibly becomes the
  ledger. Today, the composer and the pill all ask ONE question — `useHasEntries` in the session
  store — so they can never disagree about whether the page is blank. A note with words but no
  parsed exercise deliberately does not count: there is no reading to total.

  **First-run hint**: one extra muted line, `like "bench 3x8 60, felt easy"`, while the athlete
  has fewer than three sessions. Retired by ARRIVING at the third session, not by being
  dismissed, and the retirement is persisted (`pref_composer_hint_done`) so "never again" does
  not depend on a count being re-derived the same way later.

  **⚠ Two components are now orphaned by this change** — `components/empty-note-cards.tsx` (the
  FIRST SESSION interactive tutorial and the returning-lifter LAST SESSION peek) and
  `components/week-recap-card.tsx` (the in-app Monday recap card). Both lost their only importer
  when the empty state was cleared, which the brief required ("no empty cards"). Neither is
  deleted, pending the owner's call. Note what did NOT break: the §12.1 weekly recap
  NOTIFICATION is independent of the card (`lib/recap.ts`, toggled in You → Training → Weekly
  recap), and new users still get the spotlight tour plus the new hint line.

  Gates: typecheck 0 · **313/313** · lint 0 · iOS export pass. **Unverified:** device QA — the
  upper-third placement across screen sizes, the words-mode keyboard on a short device, and the
  canvas→ledger fade. Correction payloads, alias learning and the end-of-session note row are
  untouched; no §9.4 evaluation is owed.
- **12 Aug 2026 (fourth pass) — the welcome screen's illustration is now a looping video
  (owner-supplied asset).** The `welcome` slug is the FIRST entry in the previously empty
  `components/onboarding/illustrations.ts` registry, so onboarding screen 1 shows the animation
  instead of its labelled placeholder square; no screen file changed, exactly as the registry
  was designed for. Assets: `assets/onboarding/welcome.mp4` (2.2 MB, 1:1, the character walking
  into the rack — warm paper ground, Recore blue the only accent, so it needs no treatment to
  sit on `bg`) and `assets/onboarding/welcome-poster.png`, a square still from the clip.

  **The poster is not decoration.** `IllustrationSlot` renders it under the player so the square
  is never empty while the first frame decodes, and it REPLACES the video entirely under Reduce
  Motion — that branch never mounts the player, so nothing loops behind the setting (§3). The
  `Illustration` union's `video` variant therefore requires `poster`; a future video asset
  cannot be registered without one.

  Playback: `loop`, `muted`, `audioMixingMode = 'mixWithOthers'` (a clip on the welcome screen
  must never duck someone's music), `nativeControls={false}`, and hidden from VoiceOver — it is
  illustration, not content. `useFocusEffect` pauses it when the step loses focus, so advancing
  through the flow does not leave a video looping behind the stack.

  **New dependency: `expo-video` 3.0.16** (config plugin auto-added to `app.json`) — a native
  module, so **this needs a fresh dev-client build**; Expo Go and any existing dev client
  without it will crash on the welcome screen. `ios/Podfile.lock` was stale in an unrelated way
  (`PurchasesHybridCommon` 18.22.2 pinned against `react-native-purchases` 10.5.0's 18.26.0,
  which made `pod install` fail before this change and would have failed after it) — resolved
  with `pod update PurchasesHybridCommon`; `ExpoVideo` is integrated in the workspace. Note
  `/ios` is gitignored (CNG), so `npx expo prebuild --clean` is equally valid.

  Gates: typecheck 0 · **318/318** · lint 0 · iOS export pass (both assets verified present in
  the exported bundle). **Unverified:** device QA — playback smoothness and first-frame timing
  on real hardware, Reduce Motion showing the still, and VoiceOver skipping the slot. No prompt,
  schema or guard was touched, so no §9.4 evaluation is owed.
- **12 Aug 2026 (fifth pass) — the blank page opens top-left, like a new note in Apple Notes
  (owner ask).** This **supersedes the third pass's upper-third placement** on the same day: the
  `canvasTop` flex spacer and `CANVAS_TOP_FLEX` are deleted, so "Write your training…" sits at
  the TOP of the page, and on the canvas the composer's rail column is not rendered at all
  (`activeRowCanvas`: no rail, `gap: 0`, no top padding), so the line starts hard against the
  body's own left margin instead of indented past a 34 pt check column that has nothing in it.
  The first-session example line lost its matching `marginLeft` for the same reason — it only
  ever shows on the canvas, where there is no check column to clear. `canvasBottom` is now the
  single `flex: 1` spacer below the line, so the whole sheet stays the composer's tap target.

  The rail arrives WITH the first card, and the ~42 pt shift that would snap is glided by
  `LinearTransition` on the active row and its body (Reduce Motion keeps the instant reflow) —
  the same beat in which the canvas becomes the ledger, so the movement reads as the record
  arriving rather than the cursor jumping.

  **Not changed, worth knowing:** the note body keeps `BODY_PADDING_H` (24) while `TopBar` uses
  20, so the placeholder sits 4 pt right of the "Recore" wordmark. Left alone deliberately —
  `BODY_PADDING_H` also anchors the gutter and every card on the tab, and the other tabs are
  split between the two values, so unifying them is a metrics decision for the owner, not a
  side effect of this ask.

  Gates: typecheck 0 · 318/318 · lint 0 · iOS export pass. **Unverified:** device QA — the
  top-left placement with the keyboard up, and the canvas→ledger glide on hardware.
- **13 Aug 2026 — the Claude Design onboarding canvas, imported (owner ask: "use this design,
  and you can add some animations between pages"; the nineteen illustrations arrived with it).**
  Source: `claude.ai/design/p/77a1cd08…/Recore Onboarding.dc.html`, read through the design MCP —
  21 frames, a component-states sheet, a motion specification, a style tile and an illustration
  appendix.

  **The illustrations are the substance of this pass.** All nineteen (`assets/new_onboarding/`,
  one per screen the design draws a character on) arrived as opaque 1024² frames with the
  generator's transparency CHECKERBOARD flattened into the pixels — dropping them in as supplied
  would have put a grey grid behind the mascot on every screen. The alpha was reconstructed from
  that pattern, each drawing trimmed to its own bounding box so `contain` fills the band instead
  of fitting empty margin, then written to `assets/onboarding/<slug>.png` at 880 px on the long
  edge and 64 colours — 2.6 MB for the set, verified present in the iOS export. Every slug in
  `STEPS` now has art except `building` and `trial-timeline`, which the design marks typographic
  and which stay so; `paywall` is registered under the same registry and the paywall route reads
  it. The previous single `welcome.png` (a different pose, from the 13 Aug trial pass) is
  replaced. **The recovery script is not in the repository** — it was a one-off, and the assets
  it produced are the artefact.

  Adopted from the canvas: 20 pt row/field radius, the 56 pt CTA, the 30/34 headline, day and
  suggestion chips that FILL blue with a white label when chosen, the summary as a plain list of
  blue-disc bullets rather than a card, the product truths as ruled lines rather than a checked
  list, an all-outlined trial timeline (the first node was a filled blue disc, which read as a
  step already completed), and the weekly-recap question as the design's filled/outlined pair of
  full-height choices — which replaces `ToggleRow`. **`components/onboarding/Toggle.tsx` is now
  orphaned** (`WeightInput` has its own unit toggle); left in place for the owner to decide on.

  Motion, per the design's own specification sheet: the entrance stagger now slides
  HORIZONTALLY and in the direction the flow moved (`components/onboarding/direction.ts` +
  `FadeSlideX`, which gained a `delay`) so the mascot and the question trail the page and Back
  no longer looks like Forward; the native slide is kept underneath it because it is what
  carries the interactive edge-swipe. New: `ParseDemo` on screen 02 — the typed line, then the
  parsed record wiping in left→right behind a paper-coloured cover (transforms only). New: the
  paywall CTA's glow swells ONCE on arrival, never loops (a pulsing buy button is a countdown by
  another name, §2 rule 6). The paywall also gained the mascot at half band height.

  **Copy was NOT taken from the canvas.** Several of its lines are claims this repository
  deliberately removed — "Lifters who keep a record progress faster", "Three months is where
  most lifters see their first real PRs", "Why lifters switch to Recore" — each an invented
  statistic or implied social proof that CLAUDE.md §2 rule 2 and §3 forbid. The design is the
  visual authority here; `config.ts` remains the copy authority.

  Not adopted: the canvas's fixed y-geometry (the band is derived from the WINDOW so Dynamic
  Type and short devices work — the existing rule, and the reason nothing here sets a fixed
  height around text), its script face for the typed line (`fonts.mono` is already this app's
  voice for raw text; a third family is not warranted), and the extra spring on the paywall plan
  cards, which already arrive on the screen's own stagger.

  Gates: typecheck 0 · **331/331** · lint 0 · iOS export pass. **Unverified:** device QA — the
  directional entrance and the screen-02 wipe on hardware, Reduce Motion across the flow, the
  cut-out mascots against `color.bg` on a real display, and VoiceOver on the new
  primary/outline recap rows. No prompt, schema or guard was touched, so no §9.4 evaluation is
  owed.
