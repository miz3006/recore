# Implementation status

**Audited 29 July 2026 against CLAUDE.md v5.1 and product-direction.md v5.1.
Updated 29 July 2026 with implementation-order steps 1 (billing), 2 (onboarding) and
3 (spotlight, reflections, export/deletion). Amended 12 August 2026 with the owner's
mascot-led onboarding restyle (one screen template, Recore blue as the funnel's single
accent, unframed illustrations, the notifications switch, the optional founder note, the
side-by-side paywall plan cards, and a full rewrite of the onboarding copy) — sections 4, 5
and 6 below.**

**Amended 21 August 2026** with the RevenueCat integration pass: the SDK at 10.7.2 with
`react-native-purchases-ui` and its pods installed, a weekly package below a still-two-card
paywall, a customer-info listener, seven typed purchase outcomes, the hosted paywall on the
win-back path, Customer Center behind every Manage control, and a Test Store key that cannot
survive into a release bundle — Section 2 below.

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
| — | **None open.** B4, the last one, was cleared on 11 Aug 2026; the row below had gone stale and was corrected on 20 Aug during the conversion pass (re-checked in code, not in this document). | | |

### Cleared by steps 1–3

| # | Was | Now |
|---|---|---|
| **B4** | `Rating` defaulted to `score = 4.9` and `Testimonial` rendered a five-star quote card for arbitrary attribution — unimported, but present and exportable. | **Deleted** on 11 Aug 2026 (`src/components/primitives.tsx` keeps the note where they were). Re-verified 20 Aug: nothing in `src/` fabricates a rating, a testimonial or a user count, and `paywall.tsx`'s proof slot is deliberately empty. |
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
| Subscription product from first release | **done** | `package.json` (`react-native-purchases` **10.7.2**, `react-native-purchases-ui` **10.7.2**), `src/lib/billing/store.ts`, `src/lib/billing/paywall-ui.ts` | Two import sites and no more: `store.ts` is the only file importing the SDK, `paywall-ui.ts` the only one importing its UI package. Everything above them speaks in `Plan` / `EntitlementSnapshot` / outcome words. |
| One free trial for eligible subscribers | **done** | `src/lib/billing/store.ts` (`trialDaysOf`), `src/app/paywall.tsx` (`timelineFor`, `ctaLabel`) | The length is read from the product's introductory offer. Apple decides eligibility per subscription group, so a returning subscriber is shown the price with no trial rather than a promise the store will not honour. A non-zero introductory price is treated as a discount, never as a trial. |
| Both plans start the same trial | **done** | `src/app/paywall.tsx` (`PlanCard` sub line, `ctaLabel`), `src/lib/legal.ts` | Owner action required: **both products need the 7-day introductory offer configured in App Store Connect** (SECURITY.md step 8). The app states what the store offers; it cannot create the offer. |
| Annual may be preselected under §6's four conditions | **done** | `src/app/paywall.tsx` (`useState<Plan>('annual')`, `PlanCard`), `src/lib/billing/pricing.ts` (`savePct`, `perMonth`) | Both cards are the same component, size and target; annual shows its real total and true per-month; the saving is computed from the two live prices and the badge **disappears** when the comparison cannot be made honestly; switching is one tap. |
| Trial attaches to an account; account after plan selection | **done** | `src/lib/billing/store.ts` (`configureStore`, `attachStoreToAccount`), `src/app/paywall.tsx` (`pendingPurchase`), `src/lib/auth/provider.tsx` | The SDK configures anonymously so the paywall can show real prices **before** sign-in, then `logIn(userId)` aliases the customer. `purchasePlan` refuses to buy while anonymous. The CTA sends a signed-out user to sign-in and completes the purchase when the session lands. |
| Hard paywall after trial ends | **done** | `src/lib/billing/entitlement.ts`, `src/app/(tabs)/today.tsx:65–74` | Verified-inactive, or nothing cached, resolves to `lapsed` and Today becomes read-only. The V4-era "assume entitled when unverifiable" default is gone. |
| Offline behaviour does not lock out a paying subscriber | **done** | `src/lib/billing/entitlement.ts` (`decideEntitlement`, `GRACE_MS`), `src/lib/billing/entitlement.test.ts` | Owner's ruling, 29 Jul: last known state plus a **seven-day grace** past the verified expiry. Keeps CLAUDE.md §2 invariant 1 true without softening the paywall. 11 unit tests cover every edge. |
| Price, renewal, trial-end date, legal links, Restore, Manage always truthful and reachable | **done** | `src/app/paywall.tsx`, `src/app/(tabs)/you.tsx`, `src/components/read-only-ledger.tsx`, `src/components/trial-reminder-sheet.tsx`, `src/lib/billing/state.ts` (`openSubscriptionManagement`) | 21 Aug: all four Manage controls call ONE entry point, which opens **Customer Center** where the build has it and Apple's subscriptions URL where it does not. An unreachable store still shows **no price and a disabled CTA** with a sentence saying why. |
| **§2.1** Funnel order (onboarding → paywall → account → trial → import fast path → walkthrough → Today) | **done** | `src/app/index.tsx` (dispatcher), `src/app/paywall.tsx`, `src/app/import-start.tsx`, `src/components/spotlight-tour.tsx` | The whole chain is wired. The walkthrough runs on Today, which a tracker user now reaches *after* import — so §7's "the tour can point at real data" holds by ordering, with no code in the tour. |
| **§2.1** Personalised paywall headline from a real answer | **done** | `src/app/paywall.tsx` (`headlineFor`) | Unchanged by step 2. |
| **§2.1** Tracker-import fast path after trial start | **done** | `src/app/import-start.tsx`, `src/lib/onboarding.ts` (`wantsImportFastPath`), `src/app/index.tsx` | Offered once, only to Strong/Hevy users, only when entitled, and only if they did not already say they would rather just write. Skipping is one full-size tap with no confirmation and no second ask — `markImportOffered` fires on arrival, not on success. |
| **§2.2** Lapsed state: record readable, export ungated | **done** | `src/components/read-only-ledger.tsx`, `src/app/(tabs)/today.tsx:65–74` | Only Today's composer is replaced; other tabs untouched. |
| **§2.2** Lapsed state shows the person's own real numbers | **done** | `src/components/read-only-ledger.tsx` (`rangeLabel`, `ledger`), `src/lib/db/ledger-size.ts` | Session count and the date range they span, as the largest element on the screen. One synchronous local read, so it is complete offline — the state it most often appears in. No countdown, no guilt line, no expiring offer. |
| **§2.2** Lapsed state distinguishes its reasons | **done** | `src/lib/billing/entitlement.ts` (`LapseReason`), `src/components/read-only-ledger.tsx` (`explanation`) | Beyond the spec, and it earns its keep: telling a paying customer "your subscription ended" when the truth is "we could not reach the App Store" is how a refund request starts. Three branches: `expired`, `never`, `unverified`. |
| **§2.2** Restore and Manage directly reachable from the lapsed screen | **done** | `src/components/read-only-ledger.tsx` | Restore is listed first — for the `unverified` case it is the single tap that resolves everything. |
| **§2.2** One honest notice before the charge | **done** | `src/lib/billing/trial.ts` (`REMINDER_LEAD_DAYS`, `trialClockAt`), `src/components/trial-reminder-sheet.tsx`, `src/lib/billing/notifications.ts` | Both instants now come from the store. The window is expressed as a **lead time before the charge**, not "day 5", so it stays correct for a trial of any length — including the compressed sandbox trials the owner will test with. At most one notice; the in-app sheet cancels the scheduled notification. |
| **21 Aug** Weekly plan supported below the funnel screen | **done** | `src/lib/billing/pricing.ts` (`Plan`, `ALL_PLANS`, `NATIVE_PAYWALL_PLANS`, `PACKAGE_IDS`), `src/lib/billing/store.ts` (`fetchOffer`), `src/lib/billing/pricing.test.ts` | The dashboard offering carries `$rc_weekly`, `$rc_monthly`, `$rc_annual`. All three price, buy and restore. Owner's ruling: `paywall.tsx` stays the **two-card** screen §6 specifies, so weekly is sold only by the hosted paywall. `NATIVE_PAYWALL_PLANS` records that as a decision; four unit tests stop the plan tables drifting apart. |
| **21 Aug** Entitlement follows the store without being asked | **done** | `src/lib/billing/store.ts` (`subscribeToCustomerInfo`), `src/lib/billing/state.ts` (`watchCustomerInfo`, `applyFreshSnapshot`) | RevenueCat pushes a fresh `CustomerInfo` on every renewal, expiry, cross-device purchase and in-app cancellation. This does **not** weaken the once-per-session rule — Recore still never *asks* the store on a write, it only accepts what the SDK volunteers. Closes the gap where a cancellation read as active until the next cold start. Torn down before `logOut`, so the anonymous customer that `logOut` emits cannot overwrite the cached snapshot. |
| **21 Aug** A purchase failure says which failure it was | **done** | `src/lib/billing/store.ts` (`classifyPurchaseError`, `PurchaseOutcome`), `src/app/paywall.tsx` (`runPurchase`) | Seven outcomes instead of four. The two that matter: `pending` (Ask to Buy / bank approval — not a failure, and the listener applies it when it clears) and `already-owned` (this Apple Account already pays — the answer is Restore, never a second charge). `offline` and `not-allowed` are separated from a generic failure for the same reason §2.2 separates lapse reasons. |
| **21 Aug** RevenueCat hosted paywall on the win-back path | **done** | `src/lib/billing/paywall-ui.ts`, `src/lib/billing/state.ts` (`openHostedPaywall`), `src/components/read-only-ledger.tsx` (`handleResubscribe`) | **Additive, not a replacement** (owner's ruling). `paywall.tsx` remains the funnel §6 designs and §2.1 orders. The hosted paywall takes only "Resubscribe" from the lapsed screen — the one audience whose offer is worth changing without shipping a build — and falls back to `/paywall` when there is no key, no pod, or no paywall configured on the offering. Same funnel counters as the native screen, so the two are comparable. **23 Aug:** availability is now decided by `NativeModules.RNPaywalls` / `RNCustomerCenter`, not by whether the JS import resolves. In Expo Go the package imports fine and silently switches to its preview mode, which routes `presentPaywall` to RevenueCat's browser SDK and fails inside the dependency with "This SDK requires a browser environment". Both hosted surfaces now report themselves absent there, so the fallback is taken immediately and nothing reaches that path. The hosted paywall is testable only in a dev build. |
| **21 Aug** Customer Center for manage, cancel, refund and plan change | **done** | `src/lib/billing/paywall-ui.ts` (`presentCustomerCenter`), `src/lib/billing/state.ts` (`openCustomerCenter`, `openSubscriptionManagement`) | Replaces a link that left the app and reported nothing. §20 still holds: leaving stays exactly as easy as arriving, and the dashboard's survey may not become a retention gauntlet. A cancellation made in there reaches the entitlement immediately, via the listener and an explicit refresh. |
| **21 Aug** A Test Store key cannot reach a paying customer | **done** | `src/lib/env.ts` (`storeMode`, `REVENUECAT_IOS_KEY`), `src/app/paywall.tsx` (`styles.testStore`) | The configured key is `test_…`: real dashboard offerings, **simulated** purchases. `env.ts` blanks it in any non-`__DEV__` bundle, so a release built with it shows no price and sells nothing rather than granting free entitlements — the loud, recoverable failure CLAUDE.md §2 rule 5 asks for. In development the paywall says "Test Store · purchases are simulated" out loud. **A release still needs the `appl_` key**, so B1 in `TESTFLIGHT_READINESS.md` stays open. |

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
| **§4.1** Warm-paper light theme, system type, generous space | **done** | `src/lib/theme/color.ts` (`canvas`/`canvasTop`/`canvasBot`), `src/lib/theme/type.ts`, `src/lib/theme/scale.ts` | |
| **§4.2** Recore blue is a visible product accent (selection, focus, active controls, walkthrough emphasis, recorded-progress charts) | **done** | `src/lib/theme/color.ts` (`brand`); `src/components/onboarding/tokens.ts`; blue live in `you.tsx`, `calendar-sheet.tsx`, `history-sheet.tsx`, `streak-sheet.tsx`, `progress.tsx` + `charts.tsx` (4 Aug), and the whole funnel (12 Aug) | 12 Aug, owner's mascot-led restyle: onboarding **and** paywall selection are blue — selected option border + check, progress fill, focused text field, the primary CTA, the emphasised bodyweight value, the selected plan card. One accent, declared once in `components/onboarding/tokens.ts`. The flow carries no second hue and no emoji. |
| **§4.2** Charts may use a blue primary series with a soft fill | **done** | `src/components/charts.tsx` (`TrendChart`) | 4 Aug: `TrendChart` draws in `color.trained` with a gradient wash, tint overridable per caller. The bar primitives (`WeekBars`, `MicroBars`) stay ink — they are ledger furniture, not a progression series. |
| **§4.2** Planned green only on a future prescription, with label | **done** | `src/lib/theme/color.ts` (`signal`), `src/app/(tabs)/next.tsx:196–199,361–364` | |
| **§4.2** Trend ember as optional secondary comparison | **done** | **retired** — `trend` was deleted 20 Aug 2026; `src/components/exercise-sheet.tsx` draws in `brand` | Confined to the one-lift progression card; never on a number. |
| **§4.2** Red only destructive/errors | **done** | `src/lib/theme/color.ts` (`error`) | |
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
> where you found Recore · weekly recap · your projection.
>
> **23 August 2026 — two of those screens changed shape** (owner; full entry in the change log).
> The parse demo is now the TODAY PAGE (`DemoToday.tsx`), takes two or three exercises and is the
> one step that does not render inside `OnboardingScreen`. The weekly recap screen opens the real
> iOS permission dialog, which reverses §5.1's no-prompt rule on the owner's instruction. Emoji
> are down to two screens — goal and experience. Training days was rebuilt as a week card the same
> day and put straight back to its seven discs on the owner's ruling.
>
> A visual pass over the rest of the flow followed (same entry): the attribution screen is a chip
> grid, the lesson screens lead with a lede, the overload card and the recap preview are redrawn
> in the record's own typography, loads are set in the reading face, the content band fades at its
> bottom edge instead of being cut, the subtext is legible (4.83:1, was 3.79), and the welcome
> finally uses the template's hero register.
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
| No permission prompt in onboarding | **reversed by the owner, 23 Aug 2026** | `src/app/onboarding/[step].tsx` (recap branch), `src/lib/recap.ts` (`requestRecapInOnboarding`) | The recap screen's Continue now opens the real iOS notification dialog when the answer is yes. The owner's ruling: this screen draws the message, says what is in it, and asks in the words of the obstacle the person named — so the context the rule protects is present. It is the ONLY OS prompt in the flow; the microphone is still asked on the mic tap and the trial notice still asks at trial start. A denial advances exactly like a grant. §5.1 has not been amended (CLAUDE.md §2 rule 8). |
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
| **The working state speaks on the line's own row** (owner, 29 Aug 2026) | **built, seen on the simulator** | `src/components/gutter-value.tsx` (`ReadingSweep`, `ReadingDots`, `ReadingWord`, `PendingDot` + `tint`/`size`), `src/components/note-surface.tsx` (`PendingCard`, `previewPending`) | The indicator shown while a line is being read was a 40 pt track with a shuttle sliding along it, placed to the RIGHT of the athlete's words — a position no reading has ever landed in, so the whole block re-laid itself out at the instant the parse landed. It is now two marks on the words' OWN row: a beam of `brand` at 16% crossing the WHOLE row behind everything on it (1300 ms, 400 ms beat, travel measured from the row's own width, unclipped so it has no cut edge, veiled top and bottom so it reads as a beam and not a column), and the ⋯ column waving the SAME three dots that become its menu glyph when the reading arrives. Measured on the render: the name lands 15.83 pt into the card exactly where the words sat, and the dots share the glyph's centre to within 0.2 pt. Reduce Motion drops both marks and prints `reading` at the end of the same row; the composer's live line carries the dots alone. |
| Offline, never blocks a keystroke or finish | **done** | `src/lib/db/*` (SQLite), `src/lib/sync/index.ts`, `src/lib/parse/client.ts` | |
| Sets shown one per row under the exercise (owner, 4 Aug) | **done** | `src/lib/parse/summarize.ts` (`setTableOf`, + tests in `parse/receipt.test.ts`), `src/components/set-table.tsx`, `note-surface.tsx`, `session-receipt.tsx` | The compact reading (`setsLineText`) stayed exact but had to be decoded once a pyramid appeared: "120·100·90 kg × 10·15·8". The ledger card and the receipt now render a **mini table** — position · load · work · note, tabular mono, one hairline under the header. Warm-ups/drops/skipped stay visible and labelled instead of numbered; the counted totals are unchanged. A lone plain set keeps the one-liner. Compact surfaces (check-in, finish summary, live typing preview) still use `setText`. **Note: `session-receipt.tsx` has no importers — that half of the wiring is inert until the file is adopted or deleted.** |
| App-wide accessibility pass (owner, 9 Aug) | **done** | `src/lib/theme/scale.ts` (`MAX_FONT_SCALE` 1.5, `FIXED_FONT_SCALE`, `lineFor`), `theme/type.ts`, `theme/color.ts`, 21 screens/components, `src/state/display.ts`, `app/(tabs)/you.tsx` | Three owner decisions, all measured rather than guessed. **(1) Contrast:** `textMuted` went #9AA093 → #82887B, 2.45:1 → 3.33:1, lifting 180+ uses at once; the ledger's informational text (comparison, alias echo, last-session reading, hints) moved to `textSecondary` (4.7:1, AA). The standing rule is in `color.ts` and product-direction §14.3. **(2) Dynamic Type 1.3 → 1.5:** the old cap was a layout limit, not a policy — every line height was hardcoded and could not grow with its glyph. `lineFor()` now carries them (all type tokens + 58 literals across 21 files) and the renderer grows them with the glyph — it scaled them a second time itself until 23 Aug 2026, see that entry, text-bearing boxes moved from `height` to `minHeight` (15 of them, incl. every `AppButton`), and text locked in geometry (calendar/history day numbers, avatar initials, ring checks) is clamped to `FIXED_FONT_SCALE` 1.2. **(3) In-app choice:** You → Display → "Set readings · Standard/Larger". **Not yet device-QA'd at 1.5 — that is the remaining risk.** |
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
| **The session's reflection printed under its lifts** (owner ask, 20 Aug) | **done** | `src/components/note-surface.tsx` (`reflection` memo, `reflectNote`/`reflectTags`/`reflectBody`), reads `getReflection` + `splitReflection`/`reflectionTagLine` | The check-in was write-only from Today: the words went into `workouts.reflection` and no screen printed them back, so the prompt row simply vanished and the note was only visible by re-opening the sheet. Now the day prints it where the day's lifts end — the armed tags on one small semibold line, the prose under them, both `textSecondary` a step smaller than a card. It sits **above** the writing line, with the settled record, while the invitation to write it stays below (the prompt row is unchanged and still gated on session-ended + no reflection). Tapping it re-opens the same check-in, so there is still exactly one place the words are written. Day-scoped by construction: `workoutId` follows the selected day, so swiping back shows that day's own note. No new column, no new event, no model. |
| **Every text field has a way to close the keyboard** (owner ask, 20 Aug) | **done** | `src/components/keyboard-done.tsx` (new), `app/(tabs)/you.tsx`, `app/plan-day.tsx`, `components/check-in-sheet.tsx`, `entry-note-sheet.tsx`, `fix-sheet.tsx`, `planned-checklist.tsx`, `note-surface.tsx` | Audited against three exits — tap outside, return/done, scroll. iOS number pads (`decimal-pad`, `number-pad`) have **no return key**, so the ten fields using one now carry a `Done` accessory bar (`inputAccessoryViewID`); the bar is mounted inside each sheet that needs it, since a `BottomSheet` is its own RN `Modal` window. Five input-bearing ScrollViews gained `keyboardDismissMode="interactive"`. The four sheets whose field is multiline or numeric make their title block a `Keyboard.dismiss()` target (`accessible={false}`, so VoiceOver still reads it as text). The ⋯ sheet's Note row and both reflection rows dismiss before presenting, as the Fix reading row already did. Today's composer is the deliberate exception: return commits a line and a page tap re-focuses, because the page IS the composer — its labelled hide-keyboard button is the exit. |
| **The accessory bar is three glyphs, drawn by iOS** (owner ask, 20 Aug) | **done** | `src/components/bottom-toolbar.tsx`, `src/components/icon.tsx` (`SF` map, `mic-on`) | Two changes to the bar over the keyboard. **(1) The plan button is removed** — the labelled round that wrote the next prescribed line into the note. It was the "still within reach" clause of the 18 Aug ruling that took the PLANNED strip off Today, and on demand meant a fourth control standing in the row all session for a line most days never have; the bar now holds only what helps someone WRITE (time, voice, a way down) and Today carries no prescription at any depth. `nextPlanLine`/`handlePlan` and the `planRow` style are gone; `checkGhostLine` stays because `ghost-prediction.tsx` still writes through it, and `icon.tsx`'s `plan` glyph + indigo tint stay as vocabulary with no call site. **(2) The three survivors draw as SF Symbols on iOS** — `timer`, `mic` / `mic.fill`, `keyboard.chevron.compact.down` — via one opt-in map inside `Icon`; `SymbolView` renders the existing Ionicons/MCI outline as its own fallback off-iOS, so no call site has a platform branch and the two can't drift. `expo-symbols` was already a dependency and had never been used. The mic gains a FILLED state while listening (`mic-on`, the `note`/`note-on` contract). Only these three are mapped, so no screen shows a mixed pair. |
| **§8.2** Session-start question on an empty Today (owner ask, 6 Aug) | **done** | `src/components/session-start.tsx`, `src/app/(tabs)/today.tsx`, `src/lib/db/plan.ts` (`getPlanDayChoice`/`setPlanDayChoice`, choice read in `resolveTodayPlanDay`), `src/lib/db/strip.ts` (`PlanStrip.dayId`), `src/state/session-store.ts` (`choosePlanDay`), `src/components/empty-note-cards.tsx` | Shows only with a split AND ≥1 logged session, on today, note empty, keyboard down; otherwise the plain `PlanStrip` rendered as before — **both are gone: the card was removed 17 Aug and the strip 18 Aug (see the change log), so nothing from this row is on Today any more; `getPlanDayChoice`/`setPlanDayChoice` and `PlanStrip.dayId` survive because the calendar sheet and Next's brief still read them.** The chip answer is persisted day-keyed in the local meta KV and read inside `resolveTodayPlanDay`, so the strip, calendar sheet and Next brief agree with it by construction (deliberately not synced — a gym-device answer that expires at midnight). Start only calls `focusNote()`; nothing is written into `raw_text`. The empty-day LAST SESSION peek yields to the card's own last-session line in exactly the card's eligibility condition. Entirely deterministic — no model call, so no §9.4 evaluation needed. No §13 event exists for this surface; none was invented. |

---

## Section 9 — Next: the personal training brief

> **28–29 Aug 2026 — the tab was restructured on Symmetry's Workout Detail and every row
> now explains its own target** (owner; full entry in the change log). The card grammar
> below describes the shape that was REPLACED: `LiftCard`, its lever chip, its 28 pt load
> and its WHY/WATCH accordion are gone, and so are `BriefLede` at the top, the `Planned ·`
> eyebrow, `UnknownLifts` as a separate block and the closing "Nothing counts until you
> lift it" line. The `Signals` block ("your other lifts") left the tab entirely on 29 Aug —
> it is folded into Progression's rows now (§10). Read the change-log entry first; treat the
> rows below as the record of how the screen got here.

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
| Profile makes onboarding context editable | **done** | `src/app/(tabs)/you.tsx` (About you), `src/components/profile/answer-sheet.tsx`, `lifts-sheet.tsx`, `pref-sheet.tsx`, `recap-sheet.tsx` | **Rewritten against the v2 flow, 28 Aug 2026.** All five v2 answers are editable (goal, experience, sessions a week, split, key lifts + loads), each in the flow's own picker, plus a "Run setup again" row. The settings the flow does *not* ask — units, rest, bar, writing language, set readings, recap — open the same kind of sheet. "Usual days" was deleted: `pref_usual_days` is a v1 question and no code reads it. |
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
| **§12.1** Weekly recap notification: one per week, factual, editable time, off in one tap | **built (device-unverified)** | `src/lib/recap.ts`, `src/components/week-recap-card.tsx` (mounted in the composer's empty state, 6 Aug), `src/app/(tabs)/you.tsx` (Notifications section), `src/app/onboarding/[step].tsx` (`setRecapIntent`, and since 23 Aug the OS prompt itself) | The card greets the first empty open of a new week again. The notification: off by default; **since 23 Aug 2026 permission is asked on the onboarding recap screen** for anyone who answers yes, and it turns the recap on only when the OS grants it (nothing is scheduled there — the first Today open computes the pending notice with a real user id). The recap card is now the second door, for anyone who said yes and never got the dialog, and it hides itself once the OS has been asked; never re-asked after a denial; You → Weekly recap turns it on/off in one tap and edits the Sunday hour in place. Content is factual (sessions of the ending week; an empty week states a neutral fact) and is re-computed + re-scheduled on every Today open and every Finish, so the fired text is as current as the record's last change. Nothing here has run on a device. |
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

## Onboarding v2 sandbox (27 Aug 2026) — what shipped, and what is not verified

> **SUPERSEDED IN PART, 28 August 2026.** v2 is the primary onboarding since that date — see
> *"v2 becomes the onboarding (28 Aug 2026)"* at the end of this file. Everything below is still
> an accurate description of the flow itself and of what a **development** run does; the two
> paragraphs that say none of it is in the product, and that the store has no `persist`
> middleware, are the parts that no longer hold.

Built to `docs/onboarding-v2-spec.md`, which is the authority for it. **It is a
development-only experiment and none of it is in the product.** It is listed here so a
future agent does not mistake it for live behaviour, and so the two onboarding flows in
the repository are not confused for one.

**What exists.** A second, complete eighteen-screen onboarding at `src/app/onboarding-v2/`
with its own components (`src/components/onboarding-v2/`), its own motion system
(`src/lib/motion/`, imported as `@/lib/motion/index` because `src/lib/motion.ts` owns the
bare specifier) and its own in-memory store (`src/state/onboarding-v2.ts`). Reached only
from a `DEVELOPMENT` section in the You tab, behind `__DEV__`.

**What it cannot do, by construction.** It has no `persist` middleware and writes no
`pref_*` key, so it cannot create an account, set the onboarding-complete flag, overwrite
name / split / key lifts, or reach the paywall or RevenueCat. Every run starts clean
because there is nothing to clean. The route subtree contains no call to `markOnboardingDone`,
`setName`, `setGoal` or any billing function. The **existing** flow's dev row is sandboxed
more weakly — it snapshots every `pref_%` row and restores it on reset — because §0 of the
spec forbids editing anything under `src/app/onboarding/`.

**Isolation.** v2 reads `src/lib/theme`, `src/lib/analytics`, `src/lib/demo-parse`,
`src/lib/haptics`, `src/components/icon` and the shared drawings in `assets/new_onboarding/`.
It imports nothing from `src/app/onboarding/` or `src/components/onboarding/`, and nothing
outside v2 imports v2 except the three You-tab rows. Deleting either directory leaves the
other standing.

**Tokens diverge from the live palette, on the owner's instruction (27 Aug 2026).** v2 draws
`#F4F5EF` / `#FBFCF6` / `#007AFF` / radii 14-18-24 / CTA 50, which is the spec's frozen set,
not `color.ts`. `#007AFF` measures 3.73:1 on that canvas and is therefore below AA at text
size in three places; this is recorded in `FINDINGS.md` §1 with a two-line fix if it is ever
wanted. Green `#547C00` keeps its PLANNED-only contract — its one home in v2 is the
prescribed loads on screen 17, each printed with its reason.

**Analytics.** Every screen fires `onboarding_screen_view` and `onboarding_screen_complete`
from the route (not from the screens, so none can be forgotten), plus `onboarding_answer`,
`onboarding_demo_parsed` / `_failed`, `onboarding_commit_held`, `onboarding_attribution` and
`onboarding_notifications_choice`. All carry `flow: 'v2'` so v1 and v2 can be told apart in
the same local queue. No event carries the person's name or their written line.

**Not built, deliberately:** the trial timeline, the paywall and sign-in that §2 describes
after screen 18. The screen list is fixed at eighteen and §0 forbids touching the paywall,
RevenueCat and account creation, so the flow ends on a sandbox done screen that says so.

**Gates:** `npm run typecheck` pass, `npm test` 469/469 pass, `npm run lint` pass. No prompt,
schema or model guard was touched, so no §9.4 evaluation is owed. Disagreements with the spec
that were resolved rather than followed literally are in `FINDINGS.md`.

---

## Change log

- **28–29 Aug 2026 — Next is rebuilt on Symmetry's Workout Detail, and every row states the
  reason for its own target.** The owner studied two screens with us — Symmetry's Workout
  Detail (`6474446718/oth_paxdh`) for structure, Setgraph's My Workouts (`1209781676/oth_7b9av`)
  for colour discipline — and set the brief: *"Next is derived from the user's own history, not
  picked from a catalogue. If a pattern you're borrowing implies the user chooses their workout,
  it doesn't belong here."* Delivered in ordered commits so a regression in one cannot be
  confused with another.

  **(1) The row** (new `components/next/lift-row.tsx`; `reasonLine` in `lib/next/sections.ts`,
  11 new cases). Title left, target right, reason under the target:

      Bench press                            82.5 kg × 5·5·5
                                              up 2.5 from Sat 8 Aug

  The reason line is secondary type, always present, never a tooltip and never behind a tap —
  *"a derived plan the user can't audit is a plan they won't trust."* It replaced `LiftCard`,
  whose WHY/WATCH accordion was itself the claim that the reason was optional; with the reason
  permanent there is no accordion, and the accordion was the card's only justification against
  bare rows (skill §Structure). The lever chip went with it: "ADD 2.5 KG" beside "up 2.5 from
  Sat 8 Aug" is one decision stated twice.

  Templates, all over the engine's own `Move` and `Reason`, never generated: weight → `up 2.5
  from Sat 8 Aug`; rep → `one more rep than …`; hold → `same weight as …`; backoff → `down 5
  from …`; plateau → `3 sessions at this weight`, which OUTRANKS the lever because it is the
  fact that changes what the athlete does (the retired `metaLine` ranked it the same way); no
  lever but a record → `from 3×8 80 on …`; and `· heaviest yet` appended when the target beats
  the lift's best. **No prescription, no line** — the slot holds evidence for a number, and a
  row with no number has none to give (owner, 28 Aug, correcting a draft that put an
  instruction there). The instruction is said ONCE, under the title block.

  Colour: `signal` is dominant here rather than an accent — the target, and the planned
  magnitude inside the reason. A backoff's magnitude is amber, not green: a backoff is not
  progress, and `moveLabel` already gave it that tone. **One measured shortfall is open and
  flagged:** `signal` #547C00 on the canvas's worst stop is 4.4962:1, so the reason line's
  11.5 pt figure is four thousandths under AA. It clears at the target's 20 pt (large text,
  owes 3:1). `color.ts` names the fix (`#4F7500` clears every stop); the owner has not ruled.

  **(2) Two data holes, closed.** `LastSetHint` now carries `day` — the query already selected
  the workout and threw `performed_at` away — which is what makes "from Sat 8 Aug" checkable.
  And the GHOST path now carries per-lift reasons: `computeNextSession` always computed a full
  `Reason` per lift, kept ONE for the session headline and discarded the rest on the way to the
  database. New **schema v6** local-only column `predictions.lines_json` keeps them, matched
  back by the record's spelling rather than by index (a cardio line contributes text with no
  reason, so the lists are not parallel). Local-only because the ghost is a cache any device
  rebuilds on the next parse; the one cost is that `upsertPredictionFromRemote` CLEARS the
  column when a remote row overwrites `ghost_text`, since reasons belong to the text they were
  computed from. `Move`'s backoff variant gained `fromKg` so "down 5" is arithmetic, not a
  parse. `SessionRow.move` now holds the engine's raw `Move` instead of a pre-phrased
  `MoveLabel`; `moveLabel()` still makes the words, for VoiceOver.

  **(3) The screen** (`app/(tabs)/next.tsx`, new `components/next/start-bar.tsx`,
  `lib/next/overrides.ts`; `StubScreen` gained a `trailing` header slot). Title block (what the
  session is, and when it was last done) → counted summary of what it targets → split chips →
  ONE list of rows → pinned Start. Removed: `BriefLede` from the top (a paragraph competing
  with the numbers it summarises), the `Planned ·` eyebrow (with green dominant, a label
  announcing green is furniture), `UnknownLifts` as a separate counted block (a lift with no
  history is now a row with an em dash, in the same list), the closing "Nothing counts until
  you lift it" (the pinned Start says it by doing it), and the header's dateline.

  The summary is COUNTED FACTS — `6 lifts · push, pull`, patterns from the tested lexicon in
  `lib/split/pattern.ts`, a lift the lexicon does not know simply does not vote. Symmetry's
  Muscle distribution percentages are a claim about a body that a text log cannot support.

  **Start writes nothing.** It hands the targets to Today as a `PlannedSession` and routes
  there; `planned-checklist.tsx` is remounted in `today.tsx` for the first time since 18 Aug,
  which is the "way back is one wire" that note anticipated. A plan filled into `raw_text`
  would count as performed the instant it landed. Ticking a circle writes the line, through the
  path a typed line has always taken. The ghost that earned the Start is recorded
  (`markPredictionAccepted`, adherence §7.2 Gap 3). **The CTA is planned green on the owner's
  ruling for this screen, and it contradicts skill §Colour ("green never becomes a CTA") and
  §Decided-1 (primary CTA is brand blue). Flagged in `start-bar.tsx`, not normalised** — it is
  the first green control in the app. It wears no glow: `shadow.glow` is brand blue.

  **Editing** is Setgraph's placement of Symmetry's Edit Workout bar, lighter: one `Edit` pill
  in the title block turns every target into a field, and at rest there is no field anywhere.
  An overridden row loses its reason line AND its green and reads as the athlete's own number
  — not as decoration but because §4.2 spends green only on a prescription that arrives *"with
  its label and reason"*, and a typed number has none. It keeps the engine's figure beside it
  (`your number, was 82.5`) so the argument can be checked in both directions; clearing the
  field reverts. Overrides live in the local `meta` KV, never in `raw_text`, never synced, and
  each one remembers the load it displaced — an override whose `was` no longer matches the
  engine is void on read, so it expires exactly when the argument it made expires.

  **Three states.** No history → `Nothing due yet`, the athlete's onboarding key lifts as rows
  with em-dash targets (their NAMES only — the working weights they typed about themselves are
  not prescriptions and would be a fabrication in that column), and `Write today's session`.
  Today already written → the page shows the NEXT session under `Today is written · 6 lifts`,
  and the CTA becomes the quiet `Open today's session`; no tick, no congratulation. Flat mode
  (`split` = `flat`) → title `Due now`, no day name invented, **rows unchanged** — the reason
  line already answers both of a flat lifter's questions at once, because the date in it IS the
  staleness.

  **(4) `Signals` moved to Progression, folded rather than transplanted** (29 Aug; new
  `lib/plateau.ts`, `lib/progression-overview.ts`, `app/(tabs)/progress.tsx`;
  `components/next/signals.tsx` deleted; `NextSections.standing`/`.moving` and the
  `StandingRow`/`MovingRow`/`MovingReading` types with them). "Your other lifts" are lifts
  ACROSS lifts, which is Progression's question, not Next's.

  It did not arrive as a block, because Progression already lists every lift with its delta,
  its sessions, its last day and a sparkline — a block would have printed a second copy of rows
  already on the page. Two facts were folded into those rows instead:

  - **The plateau**, which is genuinely new: the list read "12 sessions · last Tue" for a lift
    that had not moved in three, and now leads with `3 sessions at 100 kg` and wears
    `attention`. The rule moved into a shared pure module, `lib/plateau.ts`, read by BOTH
    `findStalls` and `buildOverview` — a plateau that Next calls a plateau and Progression does
    not would be the two tabs disagreeing about one lift. 9 cases.
  - **The trust guard.** Next refused to print a delta larger than a quarter of the lift's
    current e1RM ("+64 kg" over eight weeks is arithmetic, not a claim). Progression's row
    prints the same class of number, so the guard followed it: `LiftRow.deltaSuspect`, and the
    row says "climbing"/"falling" with no figure. 6 cases moved to
    `progression-overview.test.ts`.

  The MOVERS half did not move — three lifts with a delta and a sparkline, where Progression
  already gives every lift a delta and a sparkline over a named window. Two answers to one
  question is what the one-exercise-one-home rule exists to prevent; that rule now reads across
  two TABS instead of across three blocks on one screen, and is unchanged otherwise.

  **A finding this uncovered, NOT fixed.** `lib/brief-prose.ts` prints the mover delta
  unguarded — *"X is moving — up 56 kg of estimated 1RM in 8 weeks"* — so the absurd figure the
  retired guard existed to refuse can still reach the brief paragraph on Next. The root cause is
  in `db/brief.ts#findMovers`: `getE1rmSeries`'s `limit` counts SESSIONS not weeks, so "8 wk"
  labels an unbounded window, and `first` is a single session, so one rep-out day against a
  later heavy single manufactures a +56 kg "gain". The TODO now sits on `findMovers` itself.
  Left alone deliberately: the composed brief is model-rewritten and guard-validated, so
  changing its numbers is §9.4 territory and the owner's call.

  **(5) The engine schedules by lift for flat mode** (29 Aug; new `lib/predict/flat.ts` with 15
  cases, `lib/predict/data.ts`). Onboarding screen 14's banner promises *"If you don't follow
  one, it schedules by lift instead"*, and the app did not do it: `pickNextSession` returns null
  for a single cluster and `pickBaseWorkout` fell back to the most recent workout, so a lifter
  who told us they follow no split was handed *repeat your last session* — a split of one day.

  The unit of scheduling is now the LIFT, and the question asked of each is how overdue it is
  **by its own cadence**: `days since ÷ median gap between its own sessions`. A press trained
  weekly and last done 10 days ago (1.43) outranks a deadlift trained three-weekly and last done
  a fortnight ago (0.67) — the judgement a plain sort-by-date gets wrong, and the reason it is a
  ratio. The median rather than the mean, so one holiday does not redefine how often somebody
  squats; a lift with under two sessions falls back to a week rather than being dropped. Session
  length is the median number of movements in the athlete's own recent sessions, clamped 1–8.
  Ties break on raw days, then on key, so the same record always produces the same session — a
  ghost that reshuffles between two identical reads is one nobody can trust.

  **Two refusals, both deliberate.** It does not gate on "due": every lift is ranked and the top
  N taken, because a cutoff would be a training opinion about how often somebody ought to train a
  movement, and §20 says the app never tells anyone what to train. And a lift with nothing inside
  the 120-day window is not scheduled at all — after a layoff that long a progression would
  prescribe weights the lifter may no longer have (§7.4, the rule behind `GHOST_MAX_AGE_DAYS`).

  The ANSWER drives the branch, not the record: `flow.ts` marks that option `drivesBranch`, and
  §2 rule 2 is to personalise from chosen information — somebody whose sessions happen to cluster
  is still somebody who told us they follow no split. The per-item prescription was extracted
  into `prescribeItem` and BOTH paths run through it, so the arithmetic, the plate rounding, the
  focus fallback and the phrasing are identical and only the roster differs. The flat path also
  skips `pickBaseWorkout`, which is eleven queries it has no use for.

  **Not covered by a test:** `flatItems` itself — the SQL, the grouping and the day arithmetic —
  because this repository's suite is pure `node --test` with no SQLite harness. The ranking, the
  cadence, the gaps and the session length are pure and tested; the read that feeds them is
  verified only by the gates and needs device QA.

  **(6) The 29 Aug design pass, after the owner saw it on a device** (new `lib/next/groups.ts`
  with 11 cases, `components/next/groups.tsx`; `next/lift-row.tsx`, `app/(tabs)/next.tsx`,
  `app/(tabs)/today.tsx`). *"Definitivno mi ni všeč dizajn."* Studied **Tiimo** (`1480220328`,
  iPhone App of the Year 2025, Apple Design Award finalist 2024, 4.59★) — not fitness, but an AI
  co-planner, which is this screen's function in another category. Four changes:

  - **Cards, and the reason moved LEFT.** A right-aligned SENTENCE has no left edge to return
    to; numbers right-align because their shape is stable, prose does not. The card is two
    columns now — name and reason left, load and scheme right — each internally consistent
    instead of both ragged against the same edge. And a bare row made a computed plan look like
    a list the athlete typed: Today is the record and stays bare, Next is a set of objects the
    app placed off a history it read, and the surface is what says so. That is the
    justification skill §Structure asks for before a card may exist.
  - **The decision strip.** `GOING UP · 3` · `HOLDING · 1` · `NEW · 1`, counted off the engine's
    own `Move`. The athlete already knows which lifts are in their push day; what they do not
    know is which of them moved. **It counts across the session and never reorders it** — the
    order somebody trains in is a training opinion the app does not hold (§20).
  - **Every pill opens the rule behind it** (owner's ask). The row says *what* changed, the pill
    says *what rule changed it*, in a sheet with the engine's rule in plain language and the
    lifts it applies to, each carrying the reason it already shows. The copy is fixed text about
    the ENGINE — what the code does, never a claim about a person — so no model touches it and
    there is nothing for a guard to validate.
  - **The split switcher is back, under the title.** The owner asked to see push and pull
    separately; these chips have always done it and the redesign draft had dropped them.

  **The pinned Start is gone, and the Today checklist with it.** CLAUDE.md §3: *"Training input
  is free text first. Touch controls repair, inspect, or enrich it; they never replace writing
  as the primary path."* A full-width green button on Next that filled Today with a checklist
  was that rule quietly inverted. Next is a briefing you read; Today is where you write, and the
  18 Aug ruling that Today carries no prescription at any depth is restored intact.
  `start-bar.tsx`, `session-store#startFromNext` and the `PlannedChecklist` mount stay on disk,
  unmounted — the wire is one line. **This retires the green-CTA question**: there is no longer a
  green control anywhere, so the conflict with skill §Colour and §Decided-1 lapses rather than
  being resolved.

  **No serif.** The owner ruled one type family across the whole app; the warmth comes from the
  cards, the washes and the air instead.

  Nothing on this screen calls a model, so no §9.4 evaluation is owed, and no §13 event was
  invented for a control that no longer exists.

- **23 Aug 2026 — text was being cut off at the top: the reader's text scale was applied to
  every line height TWICE** (`lib/theme/scale.ts`, `lib/theme/index.ts`, `components/note-metrics.ts`,
  `components/gutter-value.tsx`, `components/sign-in-demo.tsx`, `components/charts.tsx`,
  `app/paywall.tsx`, `components/fix-sheet.tsx`, `components/onboarding/OnboardingScreen.tsx`,
  `lib/theme/line-box.test.ts`). Reported by the owner as "some texts are cut off at the top,
  in onboarding and elsewhere", with a screenshot of the welcome step where the dot of the "i"
  is shaved flat and the "g" of the line above touches the "i" of the line below.
  - **The cause.** `lineFor()` multiplied every line height by `osFontScale`, on the premise —
    written into its own docstring — that "RN scales a Text's fontSize by the OS font scale but
    leaves an explicit lineHeight exactly where it was written". The renderer we ship says
    otherwise: `react-native/Libraries/Text/RCTTextAttributes.mm:138` multiplies `_lineHeight`
    by `effectiveFontSizeMultiplier`, the same multiplier the font size gets, clamped by the
    Text's own `maxFontSizeMultiplier` (`:236`). So the line box moved with the SQUARE of the
    reader's setting while the glyph moved linearly.
  - **What that costs at each setting.** At the default (1.0) the two agree and nothing shows,
    which is why it shipped and why a year of review missed it. At iOS's xSmall (0.823) every
    line box in the app is 18 % tighter than its glyphs: `question` 30/34 renders at 0.93 em
    where a tittle needs 0.95, so the dot of an "i" is cut off by the top of its own line and
    consecutive lines collide. At the 1.5x ceiling it fails the other way — a body paragraph is
    set with half a line of extra leading, and every screen's arithmetic for "does this fit" is
    wrong.
  - **Read off the owner's screenshot, not inferred.** Pixel-measured: baseline-to-baseline
    72.5 px against a 76.7 px em on the headline (0.946 em rendered, 1.133 designed) and 54 px
    against 44.0 px on the subtext (1.227 rendered, 1.471 designed) — one multiplier of 0.834 on
    both blocks, which is iOS xSmall (0.823) inside measurement error. The absolute sizes agree
    too: `body` renders at 14.67 pt where `moderateScale(17) x 0.823` = 14.70.
  - **The fix is one multiplier, applied once, by whoever owns the thing being measured.**
    `lineFor` returns the unscaled line height and the renderer grows it; a `View` that reserves
    room for a line of text wraps it in the new `textRoom()`, because nothing grows a view. Six
    call sites were geometry rather than text and moved to `textRoom` (the paywall's price slot,
    the fix sheet's words box, the funnel's reserved eyebrow row, the chart's value band, and
    the note's gutter rows via a new `NOTE_LINE_BOX`). At the default text size the output is
    identical to before, to the pixel. `MAX_FONT_SCALE` is now enforced where it belongs — the
    `maxFontSizeMultiplier` on each Text — so a `FIXED_FONT_SCALE` surface finally clamps its
    line height to 1.2 instead of to the app-wide 1.5.
  - **The onboarding emoji had a second, unrelated line-box fault** (`OptionRow.tsx`). Pinned to
    `lineHeight: moderateScale(24)` under a 19 pt glyph: measured with CoreText, SF Pro wants a
    22.4 pt line at that size and Apple Color Emoji wants 28.2, because an emoji's ink fills the
    em — 17.9 pt of it above the baseline against 13.5 for a capital. Two device pixels off the
    top of every emoji at the default size, a third of the glyph at 1.5x. Fixed by setting no
    line height at all: the face's own box is the one value that cannot be wrong at any text
    size. The row already centres its children, so only the emoji re-centres.
  - Both faults are guarded by source tests (`line-box.test.ts`, `emoji-box.test.ts`), because
    both read as correct in review — `lineHeight: 24` beside `fontSize: 19` looks generous, and
    a line height that scales with the reader looks like the accessible thing to do.
  - **The rest of the type scale was measured and is NOT clipping:** the tightest tokens
    (`displayLarge` 1.07x, `heroNumber` 1.08x, `question` 1.13x) sit under SF Pro's own 1.178x
    line, but the ink they carry clears the baseline the descent leaves — caps at 0.705 em,
    tittles at 0.739 — by 4 pt or more at the default setting. Nothing was changed there.
  - Gates: typecheck 0 · **451/451** · lint 0 · iOS export pass. **Unverified:** arithmetic
    against measured font metrics and one screenshot, not a device capture — the funnel at
    Dynamic Type 0.823x and 1.5x still has no QA record (see the 9 Aug accessibility row).

- **21 Aug 2026 — TestFlight readiness audit, and the first two fixes off it.** The audit is
  `TESTFLIGHT_READINESS.md` at the repository root: a read-only pass over build config, Apple
  compliance, billing state, backend, failure modes, screen completeness, legal metadata and
  the tester experience, with every finding tied to a file, line or config key. Its verdict is
  that the **code** is beta-ready and the **provisioning** is not — five blockers, four of them
  account work no agent can do (App Store Connect products + a RevenueCat offering, the EAS
  environment variables, `eas init`, the owner's three strings). It is the authority on release
  readiness; this section stays the authority on what is implemented.
  - **Export compliance is answered in the config, once** (`app.json`, `ios.infoPlist`).
    `ITSAppUsesNonExemptEncryption: false` was absent, so every upload would have parked in App
    Store Connect as *Missing Compliance* until a human answered the question by hand — per
    build, forever. Recore uses HTTPS and system crypto only, so `false` is the true answer.
    Verified with `npx expo config --type introspect`, which also confirms the two dictation
    strings, `CFBundleDisplayName: Recore` and `UIUserInterfaceStyle: Light` land as intended
    (the checked-out `ios/` folder is git-ignored and stale; EAS regenerates it from this file).
  - **There is a last screen** (`components/error-screen.tsx`, exported as `ErrorBoundary` from
    `app/_layout.tsx`). An uncaught render error in a release bundle used to close the app: no
    screen, and with no crash reporter installed, no report either — a beta tester cannot send
    a stack trace they never saw. It now says the one thing that is true and matters (the record
    is on the device and nothing was lost, because every line is written in the instant it is
    typed), offers `retry`, and prints the error's own message, selectable, because a screenshot
    is currently the whole bug report. It mounts BELOW the root layout, so it may not touch
    `SafeAreaProvider`, `GestureHandlerRootView` or auth — plain views, padding instead of
    insets — and it dismisses the splash itself, since a crash before the session resolves would
    otherwise leave the native image on top of it.
  - **Crash reporting exists, and the fence around it is the feature** (`lib/crash.ts`,
    `@sentry/react-native` 7.2.0, owner's call on 21 Aug). One SDK, one purpose: the error and
    where in the code it happened. `sendDefaultPii` off and `setUser` called nowhere, so a
    report is not attached to an account and two reports cannot be joined into a person;
    console breadcrumbs dropped at the source, because a breadcrumb trail that echoes console
    output is exactly how a stray log of note text would escape; `user` / `request` / `extra`
    stripped in `beforeSend`, after every integration has had its turn; session tracking and
    tracing off, so nothing is sent about a person who has not crashed. `EXPO_PUBLIC_SENTRY_DSN`
    empty is the default and a working state — nothing initialises and no socket opens. **§12
    changed in the same commit**: the privacy policy gained "If Recore crashes" and names Sentry
    as the fifth processor, `LAST_UPDATED` moved to 21 August 2026, and `npm run build:legal`
    regenerated `docs/`. The App Privacy answer for Diagnostics is now **Yes, not linked to the
    user** (`RELEASE.md` §4). There is no in-app switch yet and the policy says so; a toggle in
    You is the obvious follow-up and is the owner's call.
  - **The weekly recap row stops implying a standing appointment** (`(tabs)/you.tsx`). `Sundays
    18:00` is the hour it fires, but `lib/recap.ts` schedules ONE dated notification and re-arms
    it when Today mounts or a session is finished — so the accordion now states the mechanism
    where someone deciding reads it. The repeating `CALENDAR` trigger was considered and
    rejected: the body carries this week's own session count and would go stale. Neutral
    phrasing on purpose (§2 rule 6 — a missed week is not a lapse).
  - **Still open from the audit, and none of it is code:** billing provisioning (without it a
    release build resolves to `lapsed` and Today becomes the read-only ledger for every tester),
    `EXPO_PUBLIC_*` as EAS environment variables — now four of them — `eas init`, and
    `SUPPORT_EMAIL` + `HOSTED_BASE_URL`. The analytics sink stays open by design: `flush()` is
    still a no-op, and wiring a provider remains an owner decision with a privacy consequence
    (§2 rule 8).

- **20 Aug 2026 — the onboarding conversion pass** (owner ask, nine tasks). Fifteen files, six
  new: `lib/demo-parse.ts` (+ test), `lib/demo-parse-remote.ts`, `lib/onboarding-copy.ts`
  (+ test), `lib/onboarding-seed.ts`, `lib/analytics.ts`,
  `components/onboarding/ProjectionStrip.tsx`.
  - **The demo screen reads the person's OWN line.** It played a canned animation of
    `bench 100kg 5,5,4`; now the field is live, the keyboard opens 350 ms after the push, a
    "Try this one" chip types the example for anyone who would rather tap, and the mic on the
    field's trailing edge is the same on-device dictation Today uses (hidden entirely where the
    speech module is not linked — never a dead control). The record settles in underneath, the
    success haptic fires on the frame it lands, and the CTA does not exist until then.
  - **The parser is LOCAL, because there is no account yet.** `parse-workout` needs a user JWT
    (§7.3), so `lib/demo-parse.ts` reads one line in the same tick:
    `(exercise) (number)(kg|lb)? (reps , or x)`. The real parser is asked only when a session
    happens to exist (a replay from You) with a hard 2.5 s ceiling. Neither path writes
    anything. Gibberish, an empty line or a timeout produce the CANNED example under a caption
    that says so — the demo has no error state and cannot dead-end.
  - **The number travels.** The demo line pre-selects the key-lift chip and loads its stepper
    (once, only on an untouched screen); the overload card is built from the person's own lift,
    load and session shape (`5,5,4` reads back as "3 × 5"); the projection falls back to the
    demo load when no key-lift load was typed; and after signup the RAW TEXT is written as the
    first session (`lib/onboarding-seed.ts`), so the app opens on their own writing. Never the
    grammar's reading — `raw_text` is the record and the real parser re-reads it.
  - **Two questions that changed nothing now change something** (§5's own removal criterion).
    The tracker answer rewrites the first paragraph of "What gets written gets stronger"; the
    obstacles answer rewrites the recap screen's subtitle; the goal adds one word class to the
    projection headline. All of it in `lib/onboarding-copy.ts` — pure, and its test holds the
    §12 tone (no exclamation marks, no hype, sentence case) over every variant at once.
  - **A projection with no load is RELATIVE, not invented.** Naming a lift and skipping every
    weight used to produce a paragraph of apology; the design asked for a fake 65 kg. The
    screen now draws the rate itself (`+20% in 12 weeks`, the experience ladder) as an index
    with no axis, captioned "Your first written session sets the baseline." A kilogram delta
    would require inventing the load it is a share of (§2 rule 3, §5.1).
  - **One new screen: attribution**, immediately before the recap — after the commitment and
    the projection, where the question reads as a company keeping its books rather than as
    marketing. Six options, one emoji each, skippable, and an unanswered screen writes nothing
    rather than "other". It fills `pref_ob_source`, which `getFunnelSnapshot` has been reading
    and finding empty since July. The answers store moved to **v7** for the position shift.
  - **The paywall reprises the projection** above the plan cards — the same arithmetic over the
    same answers, with the "an estimate from your answers, not a promise" line travelling with
    it, and nothing at all when there is no projection to show. Its bars grow once, left to
    right, 600 ms, from their own base. The paywall still has no progress rail and no back
    chevron; the progress rail is full on the projection, which is the flow's last screen.
  - **Emoji on every screen that ASKS** (owner, 20 Aug): tracker, obstacles, experience, gender
    and plan style join goal, recap and attribution. Still none where the app reports — lessons,
    day circles, steppers, commitment, projection, paywall.
  - **`lib/analytics.ts`**: `track(event, props)` over a union of event names, buffered in the
    meta KV and written through on every call (the interesting events are the ones just before
    someone closes the app). **`flush()` is a deliberate no-op and no SDK is installed** — §13
    says measure locally, and wiring a provider is an owner decision plus a §12 privacy change,
    not a follow-up commit. Nothing a person WROTE is ever a property: a name is
    `written`/`empty`, the demo line is `parsed`/`none`, a failure reason is a category, and
    days are counted rather than listed. Screen views are emitted from the one component every
    screen of the flow is, so there is no per-screen boilerplate to forget.
  - **Copy**: the commitment's first line is now "After four written sessions, Recore starts
    telling you what to lift" (a floor, not a gate — `recachePrediction` runs on the first
    parse); the demo subtitle asks for a line instead of a tap.
  - **Verified by the gates**: typecheck **pass**, `npm test` **438/438 pass**, lint **pass**,
    `npx expo export -p ios` **pass**.
  - **Not verified**: nothing in this pass has run on a device. The autofocus timing, the
    keyboard band under the live field, the chip's typing animation, the mic path, the demo's
    haptic and the paywall strip's growth are all unwatched on hardware. No prompt, schema or
    guard was touched, so no §9.4 evaluation is owed.
  - **Found, not fixed (pre-existing):** `ensureLocalUser` wipes the whole `meta` table on the
    FIRST sign-in (`current === null` is treated as an account switch), which takes
    `onboarding_done` and every `pref_*` answer with it — so a fresh user meets the projection
    screen once more after purchase, re-runs `completeFlow`, and only then lands on Today. It
    costs nothing here (the demo seed reads the in-memory answers store, and the second
    `completeFlow` re-writes the prefs), but it is a real defect and the fix — skip the wipe when
    no account has ever claimed the device — is the owner's call, since it moves a data-isolation
    boundary.

- **20 Aug 2026 — the keyboard always has a way out** (owner ask: audit every text field). Seven
  files, one new: `components/keyboard-done.tsx`.
  - **What the audit found.** Every `TextInput` in the app, checked against three exits — a tap
    outside the field, the keyboard's own return/done, and a scroll. The genuinely broken shape
    was **the number pad**: iOS's `decimal-pad` and `number-pad` have *no return key at all*, so
    a field using one can only be left by a gesture the user has to already know about. Six of
    them are on `fix-sheet.tsx`'s steppers, two on You's body context, two more on the unmounted
    `planned-checklist.tsx` — and that last sheet had no scroll view either, so it had **no exit
    but the buttons**. The second finding was that five ScrollViews carrying inputs had no
    `keyboardDismissMode`, so scrolling never put the keyboard away. The third was three places
    on Today that opened a sheet **on top of a live keyboard** (the ⋯ sheet's Note row and both
    reflection rows) — the FixSheet path had been dismissing first since 6 Aug; the others
    hadn't.
  - **`KeyboardDoneBar`** (new) — the standard iOS accessory bar with one `Done`, wired by
    `inputAccessoryViewID={DONE_ACCESSORY}`. Mounted on You and **inside** the two sheets that
    need it, because a `BottomSheet` is an RN `Modal` with its own window and a bar on the
    screen behind it will not attach to a field in front of it. iOS only (Android's back button
    already does this job); not for multiline fields, which UIKit does not attach an accessory
    to.
  - **`keyboardDismissMode="interactive"`** added to the five ScrollViews that were missing it:
    `you.tsx`, `plan-day.tsx`, `check-in-sheet.tsx`, `entry-note-sheet.tsx`, `fix-sheet.tsx`.
    (`note-surface.tsx`, `OnboardingScreen.tsx` already had it; `lifts.tsx` uses `on-drag`.)
  - **The sheet heads dismiss on tap.** The four sheets whose field is MULTILINE or numeric —
    check-in, entry note, fix reading, planned checklist — wrap their title block in a
    `Pressable onPress={Keyboard.dismiss}`, `accessible={false}` so VoiceOver still reads the
    lines instead of announcing a button. A multiline field's return key writes a newline; there
    has to be something else to tap.
  - **Three sheets no longer open over a live keyboard**: the ⋯ sheet's Note row and both
    reflection rows on Today now `Keyboard.dismiss()` first, the way the Fix reading row already
    did.
  - **Left as they are, deliberately:** Today's composer keeps the keyboard on return (it is a
    list being written, and the accessory bar carries a labelled hide-keyboard button) and
    re-focuses on a page tap (the page IS the composer); `lifts.tsx` keeps RN's default
    `keyboardShouldPersistTaps`, under which the first tap on a row dismisses the keyboard and
    is consumed — that is the requested behaviour, at the cost of a second tap to open the row.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified:** device QA — the `Done` bar has
    never been seen on a device, and `InputAccessoryView` inside an RN `Modal` is the one piece
    of this that can only be confirmed there.

- **20 Aug 2026 — Today reads the check-in back, and the accessory bar loses the plan.** Three
  files: `note-surface.tsx`, `bottom-toolbar.tsx`, `icon.tsx` (+ the comment in
  `app/(tabs)/today.tsx` the plan button had made false).
  - **The session's reflection is printed under its lifts.** The check-in was write-only from
    this page — the words went into `workouts.reflection`, the prompt row vanished, and no
    screen printed them back, so the only way to re-read your own note was to re-open the sheet.
    The day now prints it where the day's lifts end: the armed tags on one small semibold line
    (`reflectionTagLine`), the prose under them, both `textSecondary` a step smaller than a
    card, indented past the check column like the row that asked. It sits **above** the writing
    line, with the settled record — the air under the last block is the page's one real
    boundary and a written note belongs on the recorded side of it — while the invitation stays
    below, unchanged and still gated on session-ended + no reflection. Tapping re-opens the same
    check-in. Day-scoped by construction (`workoutId` follows the selected day), so swiping back
    shows that day's own note. No new column, no new §13 event, no model.
  - **The plan button is removed from the accessory bar** (owner). See the Section 8 row; the
    short version is that the 18 Aug "the plan is not on this page" ruling had left one clause
    open — the plan on demand, over the keyboard — and the clause was a fourth control standing
    in the row all session. Today now carries no prescription at any depth. Next's brief is
    where the plan lives.
  - **The bar's three surviving glyphs draw as SF Symbols on iOS.** One opt-in map in
    `icon.tsx`; `SymbolView`'s own `fallback` keeps the Ionicons/MCI outline everywhere else, so
    there is no `Platform.OS` at a call site. The reason is the one that makes SF Pro the app's
    face — Apple's set already carries the optical sizing, stroke weight and alignment a
    third-party outline approximates — and these three float at 18 pt over the system keyboard,
    where a foreign stroke reads as a foreign control. The mic fills while it listens. Weight is
    one constant (`medium`), and `keyboard.chevron.compact.down` gets a 1.2× fitting box because
    SF glyphs are laid out by their own metrics, not by a square. **That multiplier and the
    weight are the two values in this change that can only be judged on device.**
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified:** device QA — the SF glyphs'
    optical size against the Ionicons the rest of the app still draws, the mic's filled state,
    and the reflection block at Dynamic Type 1.5 / under VoiceOver.

- **20 Aug 2026 — the last two record dividers, and the migration is closed.** Two files, plus
  `MIGRATION.md` marked done for Phases 2 and 3.
  - **`next/signals.tsx`** — the "your other lifts" rows carried a `tableRule` hairline. It is
    the same object as every other list of lifts in the app and it was missed in Next's own turn;
    it is bare now.
  - **The lift sheet's HISTORY rows** — the last list in the app still drawing rules between
    records. The rule is gone and the row breathes instead (12 → 14 pt of vertical padding),
    which is the treatment `set-table`, the Lifts list, Today's ledger, Next's and Progression's
    building rows all carry.
  - What is deliberately LEFT drawing a `tableRule`: the vertical divider between the lift
    sheet's three stat tiles (it separates COLUMNS, not records, and without it three numbers run
    together), the rule inside an open card on Next and Progression, and the session summary
    sheet's own rules. All of them are card chrome rather than separators between records — and
    all of them measure **1.16:1 on white**, which is the open question already on the list.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**.
- **20 Aug 2026 — v6 Phase 3, the last eight files, and the migration's deprecated tokens are
  DELETED.** `app/_layout.tsx`, `split.tsx`, `plan-day.tsx`, `legal.tsx`, `health.tsx`,
  `import-start.tsx`, `aliases.tsx`, `sign-in.tsx`, plus the two theme files that lose their
  aliases.
  - **Every screen in the app now stands on `color.canvas`.** The root background and the
    navigator card style in `_layout.tsx` moved off `color.bg`, and so did the six pushed
    screens. **`sign-in.tsx` was the last full-screen white page in the app** — its root was
    `color.surface`, which is a seam beside a cream one, and it is the canvas now.
  - **The deprecated tokens are gone, not deprecated.** With their last call sites moved,
    `color.bg`, `color.ctaFill`, `color.ctaFillPressed`, `color.trained` and `radius.xxl` are
    **deleted from the theme**. There is one blue, one canvas and four radii, and none of them
    has a second name. `MIGRATION.md` promised this for the end of Phase 3; this is the end of
    Phase 3.
  - **The `readingStyle()` sweep is finished app-wide.** The last seven inline
    `fontFamily: fonts.reading` (three in `split`, three in `plan-day`, one in `aliases`) are
    gone, and **`fonts.reading` now has zero call sites anywhere in `src/`.** Skill §Decided-5 is
    true in the code.
  - **Four radii and one height were wrong against the scale, and one of them mattered.**
    `split`'s empty-state button is a **filled brand pill** — the primary action on that screen —
    and it was `CONTROL_HEIGHT` 50 with no glow. It is `CTA_HEIGHT` 56 with `shadow.glow` now
    (skill §Decided-1 and §Decided-3); the dashed "Add a day" beside it is a secondary control
    and correctly keeps 50. The rest: `split`'s card `lg` → `xl`, its segmented container
    `md` → `sm` (it is recessed, not a button — the same shape You's segmented editor takes),
    `legal`'s row `md` → `lg`, `import-start`'s steps card `lg` → `xl`. The genuine buttons —
    `split`'s Add a day, `plan-day`'s Delete — were checked and **kept at `md` 14**, which is the
    point of auditing rather than sweeping.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA.**
- **20 Aug 2026 — v6 Phase 3: the sheets, in one pass.** Eight files. Most of MIGRATION's sheet
  row was already spent in Phase 2b — the `readingStyle()` sweep (37 call sites across the
  sheets), `color.trained` → `color.brand` for every selected and active state, and the
  `radius.xxl` remap all landed there. What was left is below.
  - **Five radii were a button's on something that is not a button.** `radius.md` 14 is the
    button token; `lg` 20 is rows, fields and option rows (skill §Spacing). The check-in note
    field, the entry-note sheet's option cell and its note field, and the fix sheet's edit row
    and set row all moved to 20. The fix sheet's three actual buttons — Add set, Save, Cancel —
    **stay at 14**, which is the point of checking rather than sweeping.
  - **Nine muted readings became `textSecondary`.** Each one was a number or the label a number
    depends on, and the skill is explicit that a value in muted is a bug at the call site:
    the lift sheet's stat units ("kg" beside 163.5), its chart axis (122.5 / 67.5), its
    "step +2.5 kg", and its history sublines ("same load · Aug 18"); the history sheet's
    per-month session count; the session sheet's WARM-UP / DROP tag — the only thing that tells
    a warm-up from counted work; the share card's "+3 more"; and the streak sheet's weekday
    letters and its "Best · 42". Dates, placeholders and hints stay muted, which is what muted
    is for.
  - **The sheets stay WHITE, and that is a deliberate reading of MIGRATION rather than an
    oversight.** The sheets row says "canvas backdrop", and read as *the sheet's own surface*
    that would make a cream card float over a cream page separated by nothing but a shadow and a
    1.4:1 hairline — destroying the detached-card reading the 18 Aug ruling was built on
    (`bottom-sheet.tsx`: eight points of air down each side, and now eight points of visible
    PAGE). Read as *the backdrop behind the sheet*, it is the scrim, which `bottom-sheet.tsx`
    already handles. The second reading is the one that survives contact with the canvas, so
    sheets are white surfaces on the cream page and their inner cards keep their borders.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA.**
- **20 Aug 2026 — v6 Phase 3, screen 7: the onboarding funnel.** Five files under
  `app/onboarding/` and `components/onboarding/`.
  - **The funnel stands on the canvas.** `OnboardingScreen`'s root was `color.surface` — white —
    and every one of the fourteen steps drew on it. It is `color.canvas` now, which is what the
    skill has been asking for since Phase 1 (*"one canvas runs the whole app … every onboarding
    step"*) and what makes the hand-off to the paywall continuous: the two screens were always
    meant to be one surface and are now literally the same one.
  - **The funnel's private design system is deleted, not deprecated.** `BLUE`, `CARD_RADIUS`,
    `ROW_RADIUS` and the re-exported `CTA_HEIGHT` are **gone from `onboarding/tokens.ts`** — the
    last call site (`[step].tsx`'s one link colour) moved to `color.brand` in this pass, and the
    paywall's ten moved in the last one. What is left in that file is only what is genuinely the
    FLOW's: its washes, its stagger, its rail timing, its geometry. Skill §Decided-2 and
    §Decided-3 are now true in the code, not just in the document.
  - **One real defect the canvas exposed, found and fixed.** `ParseDemo`'s wipe — the cover that
    hides the parsed reading and slides away — was painted `color.surface`. It sits on top of a
    row filled with `INK_CARD` (ink at 5 %), so it was always about 1.1:1 off the thing it was
    covering; on a white page that was a lightness mismatch nobody could see, and on cream it
    becomes a mismatch of HUE, which the eye does see. It is now built the way the row is built —
    the page colour with the same ink wash over it — so it is exact by construction and cannot
    drift if either token moves.
  - **The mascot rule was already satisfied and nothing was changed for it.** Checked rather than
    assumed: `illustrations.ts` carries **a different drawing for every step** (`welcome`,
    `tracker`, `obstacles`, `why-written`, `goal`, `experience`, `about-you`, `days`,
    `key-lifts`, `overload`, `commitment`, `recap`, `projection`, plus `paywall`), and the one
    step with none — the parse demo — is deliberately blank rather than waiting on art. The
    mascot never appears on a data screen at all, so the skill's "≤32 pt or absent" half is met
    by absence. An earlier note in this log claiming only `welcome` had an asset was wrong.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — the whole funnel on
    cream, and the parse demo's wipe in motion.
  - **THE ONE OPEN DECISION IN THE FUNNEL, for the owner on device:** the option rows, value
    cards and the notification preview still fill with `INK_CARD`, which RECESSES about **1.1:1
    from the page**. v6 says everything interactive floats as a white pill with `shadow.card`,
    and names onboarding option rows among the sanctioned cards — so the v6 answer is white plus
    a shadow. It was not taken blind, for two reasons: the ratio is unchanged by the canvas (ink
    at 5 % was 1.1:1 from white too, so this is a look that has always been this quiet, not a
    regression), and switching it moves what `OptionRow`'s selection animation interpolates
    FROM across thirteen screens. The note now lives on the token itself.
- **20 Aug 2026 — v6 Phase 3, screen 6: the paywall.** One file, `app/paywall.tsx`. **No billing
  copy changed** — not a price, not a date, not a sentence about what a subscription does.
  - **It stands on the canvas** (`color.bg` → `color.canvas`), which is the same page the funnel
    it continues stands on. The two screens were always meant to be one continuous surface and
    now they literally are.
  - **The last two funnel-token call sites are gone.** `BLUE` → `color.brand` (7 refs: the plan
    cards' travelling selection edge, the SAVE pill, the radio fill, the CTA glow) and
    `CARD_RADIUS` → `radius.xl` (3). `app/onboarding/[step].tsx` is the only file left reading
    either, so the aliases die with the funnel's own turn.
  - The arrival glow keeps its heavier values on purpose — 0.55 at radius 30 against
    `shadow.glow`'s 0.28 at 20 — because it is the ARRIVAL and it crossfades down to the
    button's own resting glow. It now casts `color.brandGlow` rather than naming a blue itself.
  - **`Nothing due today` is untouched** — it is the sanctioned `signal` exception, the one green
    line on this screen, and it stays exactly as it was (4.93:1 on white, AA at any size).
  - The last inline reading font became `readingStyle()`. The legal links moved off `textMuted`:
    they are underlined tap targets, so they carry information and cannot be what the eye skips.
    **They stay ink-grey rather than going brand** — these are the legal doors, and the one blue
    on this screen belongs to the thing being bought.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA.**
  - **Noticed and not fixed:** the plan cards still fill with `INK_CARD` (ink at 5 %), which on
    the warm canvas resolves to `#F1EEE9` — a warm grey a step down from the page. The token's
    own note has been asking since Phase 1 whether the funnel's soft cards should become
    `surface` + `shadow.card` like every other floating thing in v6. That is one decision for the
    funnel and the paywall together, and it belongs to the funnel's turn.
- **20 Aug 2026 — v6 Phase 3, screen 5: You.** One file, `app/(tabs)/you.tsx`.
  - **The screen stands on the canvas** — `color.bg` → `color.canvas` on the root — and its
    seven white surfaces (the settings cards, the avatar, the selected segment) become surfaces
    for the first time rather than white-on-white. `shadow.card` was already warm from Phase 1
    and is what gives the cards an edge now: `color.divider` measures **1.16:1** on white, so
    the border never was one.
  - **The one screen where a card is the DEFAULT, and the justification is now written into the
    style.** Skill §Structure requires a card to be justified against bare rows first; this one
    is justified by the platform. A grouped settings list is what iOS Settings *is*, every
    reader already knows what the grouping means, and the `glyph.*` tints exist specifically so
    a long one is scanned by shape and hue before it is read. **The rule it is an exception to
    is about the RECORD** — a lift, a set, a session — and none of that is on this screen. The
    card moved to `radius.xl` 24 with every other card in the app.
  - **The activity grid's trained mark is `color.brand`.** The grid's own contract is untouched:
    two marks and no more, no intensity ramp, a day that has not happened is nothing at all.
  - **Two things in muted were carrying information.** The career numbers' labels under the
    record card, and the unit beside the bodyweight the person typed. Both are `textSecondary`
    now. The month labels on the activity grid, the hints, the footnotes and the version string
    stay muted — dates and asides are exactly what muted is for.
  - Six inline reading fonts became `readingStyle()`, which finishes the sweep for this screen.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA.**
  - **Noticed and deliberately not fixed:** the separator between two settings rows inside a card
    is `color.divider` at **1.16:1** on white. Every long horizontal separator on iOS is that
    subtle by design — they read as lines because of their LENGTH, not their ratio — so whether
    this one needs strengthening is a call to make with the screen in front of you rather than
    from arithmetic. It is the same open question as the two hairlines inside Next's open card.
- **20 Aug 2026 — v6 Phase 3, screen 4: Lifts.** One file, `app/lifts.tsx`, and it got shorter:
  **92 lines out, 37 in.**
  - **The list IS the `Row` primitive** — its second home after the lapsed ledger. The lift's
    name in ink on the left, "Jul 21 · 14 sessions" under it, the top set of that session on the
    right in the reading face. Six styles (`row`, `rowSep`, `rowText`, `name`, `meta`, `value`)
    and the `PRESS_BLEED` constant are **deleted rather than restyled**, along with the
    `Fragment` wrapper the separator needed.
  - **No rule between two lifts.** The hairline sibling measured **1.16:1** on the warm canvas,
    so it was not separating anything; what separates one lift from the next is the air a 68 pt
    row leaves around it (up from 56). §11.2's density ask is answered by the row being one
    object rather than by squeezing it.
  - **Three things came out of muted.** The meta line ("Jul 21 · 14 sessions") is `Row`'s
    `detail`, which is `textSecondary`; the empty state's invitation and the "Nothing matches X"
    line moved there too. All three are read, not skipped.
  - The two inline reading fonts became `readingStyle()`, and the reading itself gained the
    weight `Row` gives a value — it was `textSecondary` at 400, and the thing the row exists to
    report now looks like it.
  - **The press-bleed highlight was vestigial and went with the rest**: the row carried a
    negative margin, a radius and a comment about a pressed fill, but no `pressedStyle` — there
    was no highlight to bleed. `Row`'s press-scale is the whole feedback now.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — chiefly whether a long
    list still reads as a list with no rules in it at sixty rows.
- **20 Aug 2026 — the lift sheet: one blue, one summary card** (owner, on device, pointing at
  `ExerciseSheet` opened from Progression: *"popravi da je tudi modra kot v Progression … in tudi
  summary redizajniraj tako, da bo enak kot v Nextu"*).
  - **The progression chart is `brand`, and `trend` ember is retired.** The line, the wash under
    it and the terminal dot were `color.trend` `#BF5B23` (owner, 29 Jul) — ember was this
    chart's own hue and the lift sheet was its only sanctioned home. The reason it goes is the
    reason it existed: this chart and Progression's `TrendChart` plot the same lift the same way,
    and drawing them in two hues made one lift look like two facts. It now takes the same values
    `TrendChart` defaults to — 0.22 fading to 0.01 under the line — so the two are one chart in
    two places. The all-time-best hairline moved off `color.border` (**1.47:1 on this card**)
    onto `textMuted` at 3.62, the same fix `charts.tsx` took.
    - **`color.trend` now has zero call sites.** It is marked `@deprecated` in `theme/color.ts`
      and recorded as retired in the design skill's §Colour, **but not deleted** — removing a
      palette entry is the owner's call, and the note says so.
  - **The closing summary is `ThoughtProcessCard`** — the same object Next closes with. It was a
    bespoke card with its own ember wash, its own sparkle-and-eyebrow head and its own foot line,
    saying the same kind of thing in a different voice one tab across. What it carries is
    unchanged: the paragraph is still COMPOSED from this lift's own loads, still rendered
    instantly, still swapped for a validated rewrite if one lands (§8.5), and the provenance line
    still says truthfully which one is on screen. What it gains is the **evidence ring** — how
    many sessions of this lift the sentences stand on, a number the sheet was already computing
    for the stat row and never showed beside the words — and a `FadeSwap`, so the rewrite is
    visible when it lands exactly as Next's is.
    - The card gained two props for this: **`weeks={null}`**, because this count is every session
      of one lift rather than a window and printing "· 8 weeks" beside it would be a claim nobody
      computed; and `basisNote`, so the line under the count says what the count actually is.
    - **It moved to `components/thought-process.tsx`.** Two surfaces wear it now, and a file
      under `next/` imported by the lift sheet is the exact drift these docs keep diagnosing.
  - **Every card in the sheet is `radius.xl` 24.** The five sections were 20 (one was 14), and
    the new summary card arrives at the app's card radius — which would have left one section in
    a sheet rounded differently from its neighbours. The skill settles it: `xl` is *"cards,
    sheets, hero surfaces"*, `lg` 20 is *"rows, fields, option rows"*, and these are cards.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA.**
- **20 Aug 2026 — v6 Phase 3, screen 3: Progression.** One file,
  `app/(tabs)/progress.tsx`. Nothing outside it.
  - **The progression line is brand blue.** It was one neutral ink, and the reasoning behind
    that — the eight weeks of history must not judge — is **untouched**: only the terminal dot
    takes a direction hue, and `lastTint` still carries it. What changed is that the SHAPE of a
    recorded progression is the one place in the app where a hue earns a line (skill §Reuse:
    *"`TrendChart` brand — never green"*), so the `tint={color.accent}` and `wash={0.1}`
    overrides came off and the chart draws its own defaults. It also passes
    **`ground={color.surface}`** — the white card it sits in — so the terminal dot is knocked
    out of the line in the surface it actually stands on rather than in a hardcoded white.
  - **The share chip is `Badge tone="wash"`** — the same object Next's lever became, so the two
    tabs now draw one chip from one file. `shareChip` / `shareText` / `chip_up` / `chip_down`
    are deleted from this screen.
    - **The `chip_flat` finding from Next's entry was wrong and is withdrawn.** It fills with
      `surfaceHigh` and inks `textSecondary` at 4.04:1, but it is **never drawn**: `percentText`
      returns null on a zero delta, so a flat window has no chip at all. It was dead code, not a
      live contrast failure, and it is deleted rather than fixed. The three `ink_*` entries stay
      — they still colour the hero delta under the reading.
  - **The record inside a card lost its rules.** The set list an open card reveals — the sets
    behind the latest point — had a `tableRule` hairline under every row; it is gone and the
    rows breathe instead, which is the treatment `set-table.tsx` already carries on Today. The
    "still building a record" rows lost theirs too and grew 40 → 52, matching Next.
  - **Three things in muted were carrying information**, which the skill calls a bug at the call
    site: the set position ("Set 1"), the building rows' reading ("3 · 82.5 kg") and the "one
    more session and there is something here to beat" line. All three are `textSecondary` now —
    4.70:1 on the canvas, 5.07 on a card.
  - **10 inline reading fonts became `readingStyle()`**, finishing the sweep for this screen.
    `color.trained` → `color.brand` on the leading card's outline and its "Biggest gain" tag
    (5.97:1 on the card, and the words carry the meaning anyway). The lift card moved to
    `radius.xl` 24 like Next's, and the empty state's dashed card off `radius.md` 14 — a
    button's radius — onto the same 24.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — chiefly whether a
    blue line under a green or red terminal dot still reads as "the history does not judge, the
    dot does", and whether the default 22 % wash under the line is too heavy inside a card at
    the 64 pt closed height.
- **20 Aug 2026 — v6 Phase 3, screen 2: Next gets its reasoning back as an object.** Four files:
  `app/(tabs)/next.tsx`, `components/next/session.tsx`, `components/next/thought-process.tsx`,
  and one shared file called out below. **Planned green is untouched** — every `signal` value,
  the PLANNED marker and its contract are exactly as they were.
  - **`ThoughtProcessCard` is mounted, and it replaces `BriefFooter`.** The full composed (or
    model-rewritten) paragraph used to sit behind a *"Read the full brief"* disclosure with the
    provenance line as 11 pt grey under it — the page's own explanation of itself, filed as a
    footnote. It is now the card: evidence ring, the paragraph, where the words came from, and
    an **"Adjust the plan"** link to `/split`, which is the real screen where what is prescribed
    is changed. Mounting the card *and* keeping the footer would print the same paragraph twice
    on one page, which is the thing this codebase keeps ruling against.
    - **The 13 Aug ruling is intact**: the paragraph competed with the loads when it sat at the
      TOP of the page, and it is not going back there. The card sits where the footer sat, at the
      bottom, after every lift. What changed is that a reader who scrolls to the end no longer
      has to ask for it.
    - **§9.1's promise that the rewrite is visible is kept**: the card is wrapped in `FadeSwap`
      on the same `'model' | 'composed'` key the disclosure used, so the upgrade still lands as
      one dip, once. `markBriefShown` is untouched, so §9.3's counters still count.
    - No paragraph, no card — the same null test `BriefFooter` applied. `BriefFooter` stays in
      `next/brief.tsx`, unmounted, so the disclosure is one line back.
  - **Next's lever is `Badge tone="wash"`.** Three files were drawing the same object — Next's
    lever, Progression's share chip and this badge — and there is one now. The tokens under it
    are unchanged and still Next's (`signal` on `signalWash` 4.59:1, `attention` on
    `attentionWash` 4.64:1); what used to be a comment promising that recorded green never
    stands in for planned green is now enforced by `Badge`'s type. The chip keeps its entrance
    spring; only the slot it animates in is left in `session.tsx`.
  - **THE ONE EDIT OUTSIDE THIS SCREEN, and it is why:** `Badge` was 9.5 pt with 1.0 tracking —
    a **third** size for an object two real screens already drew at 11 pt/700 with 6/2 padding
    at `radius.sm`, and `color.ts`'s wash ratios were measured against an 11 pt label. Rather
    than shrink both screens to the badge, the badge took their metrics. Nothing else in the app
    draws a `Badge`, so this changes exactly the two chips it was made to unify.
  - **Next's cards keep their surface, and the justification is now written down** rather than
    assumed. Skill §Structure says a card must be justified against bare rows first: a `LiftCard`
    is not a row of the record, it is an **accordion** — one tap opens the engine's WHY and WATCH
    under it plus a "Full history" door — and a bare row that grows a paragraph has no edge to
    grow inside of. Its radius moved `lg` 20 → `xl` 24, because a card and a sheet are the same
    kind of object.
  - **The lifts with no history are bare rows now.** `UnknownLifts`' hairline under every row is
    gone and the row grew 40 → 52 so the air separates them (skill §Structure). The empty
    state's dashed card moved off `radius.md` 14 — a button's radius — onto `xl`, and the
    "One more session and there is something here to beat" line moved from `textMuted` to
    `textSecondary`: it carries information, and muted is for what the eye may skip.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — whether the reasoning
    card reads as the page's conclusion or as a second brief, and whether the ring's twelve-
    session scale looks right on a real record.
  - **Noticed on this screen and deliberately not fixed:**
    - **Progression's `chip_flat` is below AA.** `progress.tsx:683` fills a share chip with
      `surfaceHigh` and inks it `textSecondary` — **4.04:1** against an 11 pt label, under the
      4.5 the other three pairings clear. It is a fifth pairing that is not in the sanctioned
      wash set at all, so `Badge tone="wash"` cannot express it. Progression's own turn.
    - **Two hairlines inside the open card do nothing on white.** `cardRule` and the note quote's
      left rail are `tableRule` / `divider`, which measure **1.16:1** on `surface`. They were
      invisible before the canvas changed and they are invisible now; whether they become air or
      become visible is a call worth making with the card open on a device.
- **20 Aug 2026 — v6 Phase 3, screen 1: Today stands on the canvas and the record loses its
  last line.** Three files: `app/(tabs)/today.tsx`, `components/note-surface.tsx`,
  `components/read-only-ledger.tsx`. Nothing outside Today was touched.
  - **The screen's own background was `color.surface` — white — and is now `color.canvas`.**
    That one line is most of what the eye will notice: for the three days the app had no canvas,
    the page and the white pills on it were the same object, so the day pill, the accessory
    circles and the Finish button had nothing to float above. They do now, and the warm
    `shadow.card` they already carry is suddenly doing the job it was written for. `PaperField`
    draws the static diagonal gradient over the fill; the flat value under it is the gradient's
    own middle stop, so the two can never disagree by more than **1.007:1**.
  - **The record has no dividers any more** (`note-surface.tsx`, skill §Structure). Two hairlines
    went. The first sat between every pair of settled exercises; it was doing two jobs, and the
    first — telling the eye that each line is a separate RECORD — is already done by the column
    of check marks and by the 24 points of air between blocks. The second job stopped being
    possible: `tableRule` measures **1.16:1** on the warm canvas, so the line was not a line, it
    was a rumour of one. The second hairline closed the record and opened the line being
    written, and that boundary genuinely means something, so it is **not dropped but re-drawn in
    air**: the active line now takes a 24 pt top gap — larger than any record-to-record gap — so
    the biggest space on the page is still the one that says "everything above this is written
    down". A settled entry block measures 64–72 pt, which is the row height the skill asks for,
    and it got there without changing a single font or padding.
  - **The lapsed record is the first surface on the `Row` primitive.** `read-only-ledger.tsx`'s
    session list was a hand-rolled row with its own title/meta/volume styles and a
    `borderBottomColor` rule under every session; it is now `<Row name detail value unit />` —
    the day in ink on the left, "3 exercises · 12 sets" under it, the tonnage on the right in the
    reading face with **`kg` as its own smaller, lighter word**, and nothing drawn between two
    sessions. Five styles were deleted rather than restyled. The screen's background moved to the
    canvas with Today's, and its **one card** — the entitlement banner, which is a statement with
    two buttons in it rather than a row of the record — gained `shadow.card`, because on cream
    its `#D5D5D5` hairline measures 1.40:1 and was no longer an edge.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — cream behind a live
    composer, whether the record still reads as a ledger with no rules in it, and whether the
    24 pt settled/live boundary is legible without its line.
  - **Noticed on this screen and deliberately not fixed:**
    - **`summary-pill.tsx` stays unmounted.** MIGRATION's Today row expects "the date pill,
      summary pill and NL input bar float as white pills", but the pill was removed by the owner
      on 18 Aug and with it the only door to `session-summary-sheet` and to **"Save as a split
      day"** (`save-split.tsx`). Remounting it is a feature decision, not a restyle, so it waits
      for the owner. Both files are styled for v6 and ready if it comes back.
    - **Three components are orphaned** — nothing in the app imports `empty-note-cards.tsx`,
      `ghost-prediction.tsx` or `session-receipt.tsx`. They carry v6 tokens now but no screen
      draws them, so their bare-row restyle would be work against a surface nobody sees.
    - **Today's six sheets are untouched** (`fix`, `check-in`, `entry-note`, `entry-actions`,
      `trial-reminder`, `trial-started`). MIGRATION groups every sheet in one row of its own and
      they share one chrome, so they are one pass rather than six screens' worth of fragments.
    - **`PaperField` is still mounted only by Today.** Every other screen draws the flat
      `color.canvas`. Whether the gradient becomes app-wide is a `_layout.tsx` decision and it
      changes what `scroll-edge`'s fade has to match.
- **20 Aug 2026 — v6 Phase 2b: every shared component inherits the tokens, and the reasoning
  card exists.** 50 files touched, all under `src/components/`. **No screen was touched** —
  `src/app/` is untouched by this pass, so the funnel's and the paywall's own call sites still
  read the deprecated aliases.
  - **The deprecated tokens are gone from the component layer.** `color.trained` (24 refs),
    `color.ctaFill`/`ctaFillPressed`, `radius.xxl` and `color.bg` no longer appear anywhere in
    `src/components/`; what remains of each lives in `src/app/` and dies with Phase 3.
  - **The `readingStyle()` sweep is done for components — 86 call sites across 23 files**
    (heaviest `exercise-sheet` 11, `session-summary-sheet` 7, `set-table`/`ghost-prediction` 6).
    Each inline `fontFamily: fonts.reading` became `...readingStyle(w)` carrying the weight the
    style already declared, and the now-redundant `fontWeight` / `fontVariant` lines went with
    it. **It is not quite a no-op and the entry should say so:** a handful of these styles had
    the reading family without `tabular-nums`, and they have it now, which is the point of the
    token — digits that do not change width as a number changes. The screens' own inline fonts
    (`progress` 10, `you` 6, `split` 3, `plan-day` 3, `lifts` 2, `paywall` 1, `aliases` 1) move
    with their screens.
  - **The funnel stopped declaring its own design system.** All thirteen onboarding components
    now read `color.brand`, `radius.lg`/`radius.xl` and `CTA_HEIGHT` from `@/lib/theme`;
    `BLUE_WASH`/`BLUE_CARD` were renamed `BRAND_WASH`/`BRAND_CARD` (they stay tokens rather than
    inline `alpha()` calls because they are read inside `interpolateColor` worklets, and a
    function call in a worklet crashes at runtime with no gate to catch it). `BLUE` and
    `CARD_RADIUS` survive as deprecated aliases for `paywall.tsx` and `onboarding/[step].tsx`
    only.
  - **Both funnel CTAs moved onto `shadow.glow` and dropped to weight 600.** `PrimaryCta` and
    `HoldToCommit` each carried a hand-rolled `Platform.select` glow; they now spread the
    theme's token, so every primary button in the app casts the same light. The label was 700
    **because of a contrast constraint that no longer exists**: white on `#007AFF` measured
    3.4:1, under the 4.5:1 a body-weight label owes, so the weight had to push it into WCAG's
    large-text class to be legal. White on Volt measures **5.97:1** and clears the body rule
    outright, so the label is set at the app's own headline weight instead of at a weight
    contrast was forcing on it.
  - **The accessory bar has colour on its glyphs** (skill §Structure: *"coloured glyphs in white
    circles — the colour is on the glyph, never on the circle"*). Four entries joined
    `icon.tsx`'s one glyph→colour map rather than becoming a second palette, each in the family
    it belongs to: timer → orange, mic → teal, plan → indigo, hide-keyboard → slate. Measured on
    the white circle: 4.03 / 4.03 / 5.85 / 5.47, and 3.73–5.42 on the deepest canvas tint — all
    past the 3:1 a non-text mark owes. **This reverses "the mic is not blue, the timer is not
    purple" (28 July) and only that**: the circles stay white, no fill is tinted, and brand blue,
    planned green and red are still barred from the set. `Finish` moved from `shadow.raised` to
    `shadow.glow` — it is the primary action on Today — and stays 44 tall rather than 56 because
    it sits IN the accessory row beside four 44 pt circles.
  - **`set-table` lost its last line.** The rule under the column header is replaced by 12 points
    of space — three times a row's own gap, so it is the largest gap in the table. It had been
    strengthened from `tableRule` to `border` on 9 Aug so a low-vision reader could find the
    boundary; on the warm canvas `border` measures **1.40:1**, so it had stopped finding
    anything, and space has no contrast ratio to fail. The table never had rules between sets.
  - **`ThoughtProcessCard` is built** (`components/next/thought-process.tsx`) and is **not
    mounted yet** — `next.tsx` mounts it in Phase 3. Evidence ring, one paragraph, a brand
    "adjust" link. **It deviates from the skill's wording on purpose and the owner should rule
    on it:** the skill asks for a "circular confidence marker", and a confidence percentage is a
    number nobody computes — the engine has no posterior, and printing one would be exactly the
    fabricated personalisation CLAUDE.md §3 calls a release blocker. What is real is how much
    record a prescription stands on, which the brief already computes as `sessions8w` and already
    prints in words, so the ring fills against a stated scale of sessions and the figure inside
    it is that count. Every string and number the component draws is a prop: it does no
    arithmetic on training data and reads nothing, which is what makes it safe to put a model's
    phrasing through (CLAUDE.md §4). It does not animate.
  - Smaller, all inherited rather than designed: `next/section.tsx`'s card radius `lg` → `xl` 24
    (a section card and a sheet are the same kind of object); `bottom-sheet` and `glass` doc
    blocks rewritten off "WHITE, NOT PAPER"; `scroll-edge` and `stub-screen` re-keyed to
    `color.canvas`; `exercise-sheet` gained a `chartDateSpacer` because a `TextStyle` on a
    spacer `View` became a type error once the style went through `readingStyle`.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — the coloured accessory
    glyphs, the 600-weight CTA label, the set table without its rule, and the funnel at the new
    radii.
  - **Deliberately deferred to the screens, NOT done:** the bare-row restyle of
    `read-only-ledger`, `session-receipt`, `gutter-value`, `note-surface`, `ghost-prediction`,
    `planned-checklist`, `plan-strip`, `empty-note-cards` and `summary-pill`. MIGRATION Phase 2
    words it as *"drop card chrome where these are the record"*, and which chrome is doing work
    is a question about the page they land on rather than about the file — four of the nine
    (`plan-strip`, `planned-checklist`, `summary-pill`, and the split-day path behind it) are
    unmounted right now and have been since 17–18 Aug. They are Today's and Next's own turns.
- **20 Aug 2026 — v6 Phase 2a: the four shared components the owner named, and the bare row.**
  `MIGRATION.md` Phase 2, scoped to the owner's own list — `primitives.tsx`, `motion.tsx`,
  `chip-row.tsx`, `charts.tsx`, plus the record's missing list primitive. **The rest of Phase 2
  is untouched and listed at the end of this entry**; none of it is done and no screen changed.
  - **`Row` — the bare-row list primitive** (`primitives.tsx`, new). The record drawn the way
    skill §Structure describes it: name left in ink, reading right in the reading face, unit a
    step smaller and a step lighter, `minHeight` 68 so it grows at the Dynamic Type ceiling, and
    **no card, no fill, no border and no rule between rows** — the air is the separator. Its
    `tone` reaches only the four semantic inks (`signal` planned-only, `gain`/`loss` recorded,
    `attention` plateau), each of which clears AA on the canvas, and the doc restates that colour
    is never the only carrier. VoiceOver reads a row as one utterance rather than four stops.
    **Nothing mounts it yet** — the surfaces it replaces (`read-only-ledger`, `session-receipt`,
    `set-table`, `plan-strip`, `note-surface`, `ghost-prediction`) move onto it in Phase 3.
  - **`AppButton`** — primary is now a filled `brand` pill at **`CTA_HEIGHT` 56** wearing
    `shadow.glow`, pressed goes to `brandPressed` (a darker blue, never an opacity flash, which
    would take the glow down with the fill). Secondary is `brand` at 12 % with a brand label:
    measured **4.98:1 on the wash over white, 4.75:1 over the canvas** — past AA for a 17 pt/600
    label, which `#007AFF` could not have carried. Secondary and ghost stay at 50; `compact`
    stays 44 and now beats the variant in the style array rather than losing to it, which was a
    latent bug the height change would have surfaced. The ink-fill doc is rewritten.
  - **`Badge` gains `tone="wash"`** — the app's one sanctioned filled chip (skill §Decided-4).
    The wash/ink pairing is a **discriminated union**, so an unpaired combination is a type
    error rather than a review comment: `signal`↔`signalWash` (4.59:1), `attention` (4.64),
    `gain` (4.69), `loss` (4.69). `Card`'s doc now says it is the exception rather than the
    default and names its four remaining sanctioned homes; its radius moved 20 → `radius.xl` 24
    and `cardRaised` off the deprecated `radius.xxl`. The badge label moved off an inline
    `fonts.reading` onto `readingStyle('700')`.
  - **`chip-row.tsx`** — selected wash and border are `brand`, the due-dot is `brand`, and the
    stale `#007AFF` arithmetic is replaced by Volt's: the selected border went from `trained` at
    50 % (**2.27:1**, a state the eye had to hunt for) to brand at 70 % (**3.34:1 on white,
    3.18:1 on the canvas**), past the 3:1 a non-text mark owes. **The label stays ink by choice
    now rather than by force** — Volt on the 10 % wash measures 5.16:1 where `#007AFF` measured
    3.5, so tinting it is available and deliberately not taken: the wash, the border and the
    weight already say "this one" three times. **Every chip gained `shadow.card`**, because on
    cream a white pill is 1.05:1 by tone and its `#D5D5D5` hairline is 1.40:1 — without the
    shadow the row reads as loose text rather than as four controls.
  - **`charts.tsx`** — `TrendChart`'s default tint is `brand`; `WeekBars`/`MicroBars` stay
    monochrome ink. Two fixes for drawing on cream: the `best` reference line moved off
    `color.border` (**1.40:1 on the canvas — not a line**) onto `textMuted` at **3.45:1**, and
    the terminal dot's knockout stroke and the hollow previous-session dot moved off a hardcoded
    `color.surface` onto a new **`ground` prop, defaulting to `color.canvas`**; a chart inside
    one of the sanctioned white cards passes `color.surface`. Both inline reading fonts became
    `readingStyle()`. The header now states plainly why green never appears in a chart at all:
    every point a chart plots has already been lifted, so `signal` would be a lie about the data.
  - **`motion.tsx` needed no change and none was made.** It carries no colour, radius or
    elevation token — only `MAX_FONT_SCALE` — so it had nothing to inherit. Checked against the
    skill's §Motion rather than assumed: durations 120/160/240/380/560, `PRESS_SCALE` 0.97 with
    0.98 on big surfaces, `stagger(i, 55, cap 8)`, `SPRING_OVERSHOOT` as the only bounce,
    `selection()` on press-in and `tap()` on press-out, and every animation gated on
    `useReducedMotion()`. All already correct.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**. **Unverified: device QA** — the glow under the
    primary CTA, the chip shadows on cream, and whether the 70 % selected border reads as
    selection rather than as a second button.
  - **Still open in Phase 2, and NOT started:** `next/thought-process.tsx` (does not exist),
    `top-bar`, `bottom-toolbar`, `summary-pill` (still unmounted), `bottom-sheet` (backdrop is
    still the old grouped grey and its radius is still `radius.xxl`), `set-table`,
    `read-only-ledger`, `session-receipt`, `gutter-value`, `note-surface`, `ghost-prediction`,
    `planned-checklist`, `plan-strip`, `empty-note-cards`, `glass`, `scroll-edge`, `stub-screen`,
    `icon`, `spotlight-tour`, `device-frame`, `settings-rows`, `next/*`, `week-recap-card`,
    `insight-header`, `sign-in-demo` and all thirteen onboarding components. Concretely, what is
    left to move: **24 `color.trained` refs in 12 files**, **`color.ctaFill` in 7 files**,
    **`radius.xxl` in 3**, **`color.bg` in 12**, and the `readingStyle()` sweep across
    **30 files** (heaviest: `exercise-sheet` 11, `progress` 10, `session-summary-sheet` 7).
- **20 Aug 2026 — v6 Phase 1: the warm canvas comes back, and one blue replaces three.**
  Design skill `recore-design` + its `MIGRATION.md`; the owner picked **Volt `#0B5CD6`** on
  device, which unblocks everything the migration marked *blocked by Phase 0*. **Tokens only —
  no component and no screen was restyled in this pass**, so what the app draws today is the
  old composition wearing the new values. Phase 2 (shared components) and Phase 3 (screens,
  one per commit) are the rest, and the bare-row record, the floating pill chrome and the
  `ThoughtProcessCard` do not exist yet.
  - **One canvas, and it is paper again.** `color.canvas` `#FCF9F4` with `canvasTop` `#FDF6EE`
    and `canvasBot` `#F9F5F9` as the two ends of the static diagonal gradient. The
    document/grouped split is abolished: no `#F2F2F7` grouped world, no white document world —
    one canvas for Today, the tabs, sheets' backdrop, settings and every onboarding step, and
    **white is a SURFACE** (pills, cards, sheets, chips). `color.bg` survives as a deprecated
    alias of `canvas` so Phase 2 can move its 15 call sites in 12 files one file at a time;
    because `app/_layout.tsx` reads it, the root and navigator background are already cream.
    This reverses "the canvas is white" (17 Aug) and the grouped grey that followed it
    (18 Aug), and the reason is measured, not taste: on `#F2F2F7` `signal` was **4.42:1** and
    `textSecondary` **4.54:1**, so a prescribed load and every supporting reading in the app
    sat at or under AA. Re-measured on the worst of the three tints: `textPrimary` 15.76,
    `textSecondary` **4.70**, `textMuted` 3.36, `brand` 5.53, `signal` **4.57**, `attention`
    4.65, `gain` 5.00, `loss` 5.21, `warning` 5.69, `error` 5.94 — every information-carrying
    ink clears 4.5:1. `trend` at 4.11 is the palette's one exception and draws a line and its
    wash, never a number. A warmer cream was measured and rejected for exactly this, so
    **deepening the canvas means re-measuring the whole ladder.**
  - **One blue does every job.** `brand` `#0B5CD6` / `brandPressed` `#0A4CB0` / `brandGlow`:
    primary CTA, selected states and their checks, links, active controls, progress fill,
    chart lines. `ctaFill`, `ctaFillPressed` and `trained` are now deprecated aliases of it —
    30 refs in 14 files and 15 refs in 8 files respectively — and are deleted with Phase 3;
    no file may name a blue literal. `#007AFF` is retired: it measures 4.02:1 on white and
    3.72–3.82:1 across the canvas tints and fails text-sized use. Volt measures **5.97:1 on
    white and 5.53–5.69:1 on the tints**, and white-on-fill is the same 5.97, so it clears AA
    as a filled button too. This retires "primary CTAs are ink-fill — restraint IS the brand"
    (17 Aug): the primary CTA is a filled brand pill with a glow (skill §Decided-1). `accent`
    keeps its other jobs and the onboarding progress rail stays ink, never brand.
  - **Elevation is load-bearing again.** `SHADOW_INK` `#1C1C1E` → warm `#2E2418` (a neutral
    near-black on cream reads as a grey smudge rather than as light). `shadow.card` .05/14/4
    and `shadow.raised` .07/28/10 — softer, wider blur, lower opacity. **`shadow.glow` added:**
    brand at 28 %, radius 20, y 8 — the only coloured shadow in the app, and the primary CTA's
    alone. A white pill on the canvas is **1.05:1 by tone**, so the shadow is the whole reason
    it is visible; the 18 Aug note that the shadow "carries less weight" now that list screens
    sit on grouped grey is void with the grey.
  - **Radii and the CTA height.** `radius.lg` 18 → **20**, `radius.xl` 22 → **24**; `xxl` 28 is
    a deprecated alias of `xl` holding its 6 call sites through Phase 2. **`CTA_HEIGHT` 56 is
    app-wide** and lives in `theme/spacing.ts` (skill §Decided-3); `CONTROL_HEIGHT` 50 keeps
    secondary, ghost and compact controls.
  - **The funnel loses its private scale** (skill §Decided-2). `components/onboarding/tokens.ts`
    no longer declares `CARD_RADIUS` 24, `ROW_RADIUS` 20 or its own `CTA_HEIGHT`, and `BLUE` /
    `BLUE_WASH` / `BLUE_CARD` derive from `color.brand`. All of them are deprecated aliases
    until their call sites move in Phase 2 (20 files: the funnel plus `paywall.tsx`). `BLUE_WASH`
    was set at 8 % against `#007AFF`; Volt is a deeper blue, so it is a fraction stronger at the
    same number — it carries no text, so there is no ratio to clear, only a weight to judge on
    device.
  - **The canvas field is the whole app, and it stopped moving.** `lib/paper-field.ts`'s three
    tones are `canvasTop`/`canvas`/`canvasBot` rather than a Today-only surface, and the
    forty-two-second drift is deleted along with `paperFieldMotion`, the overscanned sheet, the
    two shared values and the Reduce Motion branch — the skill's §Canvas says "diagonal, subtle,
    static, and never animates", and a page breathing under someone writing down a workout is
    motion that does not make cause and effect clearer. `MAX_STOP_DELTA` became
    `MAX_STOP_CONTRAST` 1.03; the stops measure **1.007:1** apart, so the page reads as "not
    flat" and never as "a gradient". The tests changed with it: `#FFFFFF` is now asserted **not**
    to be a canvas tone (white is a surface), every stop must sit within 1.03:1 of the value the
    ink ladder was measured on, `textSecondary` and `signal` are asserted over 4.5:1 on the
    deepest stop, and all three tints are checked against `theme/color.ts`'s own source so a
    recolour cannot land by halves.
  - Gates: typecheck **pass** · `npm test` **415/415 pass** · lint **pass** ·
    `npx expo export --platform ios` **pass**.
  - **Unverified: device QA**, which is what this phase stops for — the cream in daylight, the
    glow, and Volt at text size on a real display. Two things were noticed and deliberately not
    fixed, because neither is Phase 1: the **splash background is still `#FFFFFF`** in
    `app.json` and `ios/recore/Images.xcassets/SplashScreenBackground.colorset`, so launch now
    flashes white before a cream app; and the Section 4 table above still cites pre-v6 evidence
    (`trained`, the white canvas), which is refreshed when Phase 3 lands the screens.
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

---

## 28 August 2026 — the two palettes became one

**Owner's ruling: the v2 onboarding palette wins and becomes the app's palette.**

For a month the repository ran two colour systems. `src/lib/theme/color.ts` held the warm-paper
set of 20 Aug (`#FCF9F4` canvas, white surface, `#1C1C1E` ink, `#0B5CD6` Volt blue) and
`src/components/onboarding-v2/tokens.ts` held the set `docs/onboarding-v2-spec.md` §0 froze
(`#F4F5EF`, `#FBFCF6`, `#171914`, `#007AFF`). The second one is now the only one.

**`color.ts` is the single source.** Token NAMES were kept wherever one already existed, so no
call site was renamed: v2's `ink` → `textPrimary`/`accent`, `inkSecondary` → `textSecondary`,
`blue` → `brand`, `planned` → `signal`. Four tokens were added (`brandWash`, `disabled`,
`track`, `shadowCast`) and four that v2 lacked were **re-derived warm rather than dropped** —
`surfaceHigh`, `accentPressed`, `border`, `divider` were all OKLCH hue 286°, a blue grey.

**Every neutral is derived, and the derivation is asserted.** The canvas is OKLCH
L 96.77 % · C 0.008 · H 114°. `surfaceHigh` is that at L × 0.96 (`#E7E8E2`), `divider` L × 0.945,
`border` L × 0.88 (`#CECFC9`, holding the 20 Aug ruling that a hairline must be findable —
v2's own 14 % border would have weakened it to 1.34:1). The greys are the ink composited on the
canvas and frozen opaque: `textSecondary` 64 %, `inkData` 55 %, `textMuted` 50 %, `disabled`
22 %, `track` 10 %. `color.test.ts` re-runs all of that arithmetic, so a hand-picked
"nearly the same" grey fails the build.

**Three things the merge cost, all owner-accepted:**

1. **The blue.** `#007AFF` measures **3.66:1 on the canvas**; white on it measures **4.02:1**,
   where Volt measured 5.53 and 5.97. A filled primary CTA with a white 17 pt label is now
   below the 4.5:1 AA floor **app-wide**, not only in onboarding. Accepted on the grounds that
   onboarding already shipped it and the app should not wear two blues.
2. **`textMuted`.** v2's `inkMuted` at 42 % measured 2.63:1 and failed the 3:1 floor a non-text
   mark owes. Raised to **50 %** by the owner: 3.30:1 on the canvas, 3.51 on `surface`. It is
   2.94 on `surfaceHigh` and **must not be drawn on the recessed tone** — the same restriction
   `attention` already carries.
3. **`signal` is four thousandths under AA.** `#547C00` on `#F4F5EF` is **4.4962:1**; it was
   4.57 on the canvas it left. Neither value may move without the owner, so
   `paper-field.test.ts` carries a TRIPWIRE asserting the ratio sits in [4.49, 4.50) — it fires
   if the green is fixed *or* if it falls further. `#4F7500` is the value that would clear it.

**The canvas got DARKER, not lighter** (`#F4F5EF` is below `#FCF9F4` on all three channels), so
every ink gained contrast against the page. `textSecondary` went 4.83 → 5.12. Nothing regressed
because of the canvas; the two regressions above are the ink and the blue.

**The gradient was re-derived, and the canvas guard was rewritten.** `paper-field.ts` kept the
old field's own hue endpoints (peach 71°, lavender 326°) and re-solved them at the new paper's
lightness, then matched each stop on **WCAG luminance** rather than OKLCH lightness — so every
ink now measures the same on all three stops, which is what `color.ts`'s ladder assumes when it
says "on canvas". `largestStopContrast` is 1.005:1. The guard's rule 3 was
`r >= g && r >= b` ("warm-led"), which **rejected the app's own new canvas**: `#F4F5EF` is
`rgb(244, 245, 239)` and green leads red by one unit — this file's test used to assert
`isCanvasTone('#F4F5EF') === false` in as many words as "the green-cast paper". Rule 3 is now
**"blue never leads": `b ≤ max(r, g)`**, which bars the one thing it was ever really barring and
still rejects `#F2F2F7`, `#F8F9FB`, `#F0F0F0`, white and the brand.

**`onboarding-v2/tokens.ts` holds no colour.** `v2color` is now an alias object over `color.*`,
marked `@deprecated`. It was kept rather than deleted because twelve of its keys are live across
22 files and renaming them inside the same change as an app-wide palette shift would put two
unrelated risks in one unreviewable diff; the values are single-sourced now and the call-site
rename is a separate mechanical pass. **The isolation rule in its header is retired for COLOUR
only** — the header says so explicitly. v2's components, flow logic, store and routes stay
separate, nothing in v2 may read `src/components/onboarding/`, and deleting either onboarding
directory must still leave the other standing.

**No colour may be named outside `color.ts`.** `color.test.ts` walks `src/`, strips comments,
and fails with file, line and value on any hex literal. Verified to fail on a planted one.
Two exemptions, both deliberate: test files (a guard that cannot write down the value it rejects
asserts nothing) and comments (this repository records the measured ratio beside almost every
token, and that history is why a future change can be made safely).

Gates: typecheck 0 · **532/532** · lint 0. **Unverified:** device QA — the whole app now renders
on a different paper, and neither the new gradient nor white-on-`#007AFF` has been seen on
hardware. No prompt, schema or guard was touched, so no §9.4 evaluation is owed.

---

## 28 August 2026 — Progression rebuilt: one lift, one card per metric

Rebuilt from Lyfta's *Exercise Progress* screens (`6443740936/oth_v4hq9`, `oth_pj6we`; notes and
measurements in `research/lyfta/screens.md`).

**The axis flipped.** The tab was *one card per lift carrying one metric* — eight weeks of
estimated 1RM for every qualifying exercise, re-orderable four ways. It is now *one lift, one
card per metric*: an exercise is selected at the top and the stack below answers several
questions about that one lift.

| removed | why it is not missed |
|---|---|
| Four orderings (Biggest gain / Recent / Stalled / A–Z) | They ranked lifts against each other. With one lift on screen there is nothing to rank. |
| The card accordion onto the last session's set table | The chevron drills in instead, so a card is a destination, not a container, and the stack keeps its height. |
| The gain/loss wash chip and the coloured terminal dot | The chart is monochrome. Green is the PLANNED continuation only; blue is a control colour and belongs to the selector. |
| The `belowFloor` list of under-charted lifts | A thin lift is now selectable like any other and its cards draw the placeholder chart with "No data yet" — a better answer than a footnote, and the same one a new account gets. |

### Live

- `src/lib/progression-metrics.ts` (+ 15 tests) — the pure half: the metric set, the series
  builder, the selector's list, and `describeSeries` for the one-line sub-label.
- `src/lib/motion/path.ts` (+ 7 tests) — monotone smoothing.
- `src/lib/motion/chart.tsx` — `MonotoneSeries`, added beside `DrawnLine`/`GrowingBar`.
- `src/components/progression/bare-chart.tsx`, `metric-card.tsx`.
- `src/app/(tabs)/progress.tsx` — rewritten.

**Two metrics of six.** Estimated 1RM and Heaviest set, both straight out of `getLiftSessions`
with no new SQL. Session volume (bar) and days-between-sessions (bar) are next and need none
either. Reps-per-session and sets-per-session need one line each in `db/progression.ts`
(`SUM(s.reps)`, `COUNT(*)`) and are not offered until that lands.

**There is deliberately no "Reps" card.** `topReps` is `MAX(reps)` across a session's counted
sets — usually the *lightest* set's rep count. A card drawing it would show a number whose
meaning changes session to session. Asserted in `progression-metrics.test.ts`.

### Four decisions worth not re-litigating

1. **The curve is a Fritsch–Carlson monotone cubic, not a Catmull-Rom.** Catmull-Rom overshoots:
   a lift that went 100 → 105 draws a curve touching 107. On a decorative chart that is a
   rounding artefact; here it is a load nobody lifted, inside the app whose first rule is that
   the record is the source of truth. `path.test.ts` samples every curve it builds and asserts
   the value between two sessions never leaves the band between them.
2. **The gridlines are texture, not a scale.** Six evenly spaced hairlines, and the series is
   laid out in a *taller* band than they occupy, so a peak sits above the top line and a trough
   below the bottom one. They are drawn with `alpha(textPrimary, 0.09)`, deliberately not with
   `color.border` — `border` is the app's hairline that has to be FOUND, and this is the
   opposite object.
3. **The card is `surfaceHigh` `#E7E8E2`.** Lyfta's `#EEF2FA` is a cool blue-grey on white; the
   equivalent was re-derived from our own canvas in the 28 Aug palette merge and lands at
   1.12:1 against the page — the same separation the reference draws, arrived at independently.
4. **The big number is `textSecondary`, not `textMuted`.** The reference's grey is lighter, but
   on `surfaceHigh` `textMuted` measures 2.94:1 and `color.ts` bars it there. The sub-label is
   the same colour for the same reason plus the ladder's standing rule that text carrying
   information is `textSecondary` or ink. Size alone carries the hierarchy — 48 pt against 15.

### Two things that are honest limitations, not bugs

- **The chevron opens the lift's full history, not a per-metric detail view.** That view does not
  exist yet. The nearest true destination beats a dead control.
- **`planned` is always null, so no green tail is drawn yet.** `predict/data.ts` computes a
  `Prescription` per exercise and discards it into the ghost's *text*, and the cached row stores
  only that text, so there is no structured planned value to read. `MetricSeries.planned` and
  `MonotoneSeries`'s dashed green tail both exist, so wiring it is a one-line change rather than
  a chart rewrite. **Nothing green renders until it is real.**

### The selector — SUPERSEDED the same day

This build put a `ChipRow` of exercises at the top of the tab, capped at the eight most recently
trained because `ChipRow` wraps and never scrolls. It was flagged here as the weakest part of the
rebuild, and the owner replaced it the same day with the two-level structure recorded in the next
entry. **Nothing below this line about a selector is still true.**

Gates: typecheck 0 · **557/557** · lint 0 · iOS export pass. **Unverified: the screen has not
been seen rendered.** The simulator's app is gated behind the onboarding sign-in and getting
past it means either authenticating on the owner's account or faking onboarding state, neither
of which an agent should do. The palette was confirmed rendering on device; this tab was not.
Device QA still owes: Dynamic Type at the ceiling (a 48 pt number and a wrapping chip row are
both at risk), VoiceOver over the card's grouped label and the `CountUp` TextInput inside it,
and Reduce Motion across the draw, the count and the stagger.

---

## 28 August 2026 — Progression becomes two levels

Owner's call, after the one-screen rebuild above shipped with a capped chip-row selector.

**Level one, the tab root (`src/app/(tabs)/progress.tsx`) — "what is moving?"** Every lift in the
window as a bare `Row`: name, how far it moved in words, session count, last day, its latest
estimated 1RM, and a sparkline in the trailing slot. Searchable above seven lifts (the same floor
the Lifts screen uses). Group chips above the list.

**Level two (`src/app/lift/[key].tsx`) — "what is this lift doing?"** The metric-card stack,
pushed. No selector: the title is the lift's name and the previous screen was the picker.

**This is how the reference actually works.** Lyfta's Exercise Progress screens have no exercise
selector because they are reached *from* an exercise. The chip row existed only because the cards
had been put on a tab root that had to choose one somehow, and it cost three things at once — a
cap at eight visible lifts, a three-row wrap at the Dynamic Type ceiling, and the loss of the
cross-lift view, so "am I progressing?" could only be asked one exercise at a time. Splitting the
tab deleted the control and all three problems with it.

### The groups are the athlete's own split, not an anatomy chart

`src/lib/progression-overview.ts` (+ 10 tests). There is **no muscle or body-part column anywhere
in this schema** — `exercises` carries `canonical`, `aliases`, `modality`, `increment_kg` and
nothing else — and this screen does not add one. A catalogue of exercise → muscle is a thing our
own parser immediately outgrows: it takes free text, so a lift someone named themselves would land
in "Other" on the one screen meant to hold their record.

`predict/split.ts` already knows something truer. It clusters sessions by which exercises appear
together (Jaccard ≥ 0.5) in order to predict the next session, and that clustering *is* the
grouping. A group is named after the lift performed most often inside it, in the person's own
words; two groups that would take the same name are told apart by their second lift, never by a
number. The strip carries the line "Grouped by what you train together", because a label a person
cannot account for reads as a category we imposed (CLAUDE.md §2.2: personalise only from chosen
information — nothing here is asked and nothing is invented).

**One cluster means no groups.** A full-body routine repeated every session yields a single
cluster, and a strip with one chip is furniture — `groups` comes back empty and it does not render.
Asserted.

### Two smaller decisions

- **Direction is a word here, not a colour.** The 17 Aug ruling tinted a lift's *delta chip*
  gain-green or loss-red; that chip is gone with the card it lived on, and the bare `Row` this list
  is built from tints the **value**, not the delta. Colouring an absolute load by direction would
  say "116.5 kg is a gain", which is not a thing. So the word carries it — which §14 required
  beside the colour anyway. Restoring the tinted delta needs a purpose-built row: a deliberate
  omission, not an oversight.
- **`exercisesInWindow` and `ExerciseOption` were deleted** from `progression-metrics.ts` with the
  selector they fed, along with the two tests that only covered them. The properties those tests
  asserted are covered by `progression-overview.test.ts`.

### Also fixed in the same pass — the card was wrong, and so was its motion

Re-measured against the reference at 3× (`research/lyfta/screens.md`), the card had been built far
too tight. Every gap is now taken off the still: **32 pt above the name, 17 to the number, 23 to
the sub-label, 45 to the first gridline, 26 under the chart**, with the number at 44 pt rather than
48 (the reference's digits measure ~31 pt of cap height). Dots went 3.5 → 4, the stroke 2 → 2.5.
The air is the design; without it a 44 pt number reads as shouted rather than calm.

**The placeholder was drawn at 13 % ink and looked like a rendering failure.** Every Lyfta screen
in the research folder is an empty state, so the shape being studied *is* the placeholder — and it
is drawn at full data weight, about 2.2:1. It is now 38 %: one step under `inkData` rather than
equal to it, because unlike Lyfta our cards mix (a lift can have an estimated 1RM and no heaviest
set) and two charts of identical weight would leave the sub-label doing all the work.

**And the charts only animated once.** `MonotoneSeries`'s draw effect did not list the path in its
dependencies, so the line drew on mount and every later change snapped into place — tapping a
different lift silently swapped one static curve for another. `d` is in the deps now, so
**switching lifts re-draws the chart**, and `GrowingBar` carries its value in its key for the same
reason. There is no motion reference to copy: all six screens of Lyfta's Exercise Detail flow are
images, not video.

Gates: typecheck 0 · **565/565** · lint 0 · iOS export pass. **Unverified: neither screen has been
seen rendered.** `src/app/index.tsx` currently carries an uncommitted `return <Redirect
href="/you" />; // TEMP-INSPECT` and the simulator's app sits behind the onboarding sign-in, so
getting to the tab means either authenticating on the owner's account or editing their work in
progress. Device QA still owes Dynamic Type at the ceiling, VoiceOver over the card's grouped
label and the `CountUp` inside it, and Reduce Motion across the draw, the count and the stagger.


---

## 28 August 2026 — v2 becomes the onboarding

The owner's ruling: **the v2 flow is the primary onboarding.** Until today it was a
development-only sandbox (see *"Onboarding v2 sandbox (27 Aug 2026)"* above), reachable from
three rows in the You tab and incapable of writing anything. It is now the flow a new person
meets, and the illustrated v1 funnel at `src/app/onboarding/` — **still present, still working,
still reachable from the development rows** — is no longer dispatched to.

Nothing was deleted. `docs/onboarding-v2-spec.md` §0 is amended in place with the same ruling.

### What the promotion actually required

A flow that collects for four minutes and discards everything is a demo. Four things had to
become true before it could be the real one:

| | Before | Now |
|---|---|---|
| **Who gets sent there** | Nobody. `app/index.tsx` sent an un-onboarded launch to `/onboarding/<step>` | `/onboarding-v2/<step>`, resumed where a killed app left off |
| **Does a run survive a kill** | No — the store was in-memory by design ("every run starts clean") | Yes, for a real run: `state/onboarding-v2.ts` persists answers **and position** through the SQLite meta KV under `pref_ob_v2` |
| **Does anything reach the app** | Nothing. No `pref_*`, no `markOnboardingDone` | One commit, once: `lib/onboarding-v2-commit.ts` |
| **How it ends** | A done screen that says nothing was saved, then back to You | **On the paywall.** Screen 20's Continue commits and hands the root to the dispatcher; the done screen is development-only now and a real run never sees it |
| **Getting in with an existing account** | Nowhere — the link on screen 1 opened an alert | Screen 1's "I already have an account" opens the real `/sign-in`; when the session lands the funnel stands aside |

### The commit point

`lib/onboarding-v2-commit.ts` is the only place in the subtree that writes to the app, and it
runs once, on the way to the done screen. It writes the name; goal, experience, frequency and
split through `lib/profile-answers.ts` (which also keeps the v1 mirrors `pref_goal` and
`pref_experience` that the prediction engine, the paywall copy and Profile read); the key lifts
and their loads; the smallest plate; the tracker; the attribution; and the recap answer. Then
`markOnboardingDone`, `setObStepCount`, `markOnboardingCompleted`.

Every write is guarded: **an unanswered screen writes nothing rather than a default**, so the
funnel can still tell "did not say" from "said the first option", and a replay that skips a
question does not silently replace last month's answer with a guess.

### Two answers needed a translation, and it is pure and tested

`lib/onboarding-v2-map.ts` (+ `onboarding-v2-map.test.ts`):

- **"Hevy or Strong" is one option in v2**, where v1 asked about the two products separately.
  It is stored as its own value, `ObTracker: 'app'` — mapping it onto either product would put a
  name on screen that nobody chose. `wantsImportFastPath` offers the §2.1 CSV fast path for it
  exactly as it does for the two narrow answers, and `import-start.tsx` says "Hevy or Strong"
  when that is all it was told. Notes / spreadsheet / paper collapse to `notes` (none of them
  hands the importer a file); "I don't log anywhere" is `none`.
- **The recap answer has a DAY in it.** Screen 20 asks "Sunday evening or Monday morning", and
  `lib/recap.ts` scheduled on Sunday for everybody — so the flow asked a question the app then
  ignored. There is now a `pref_recap_day` (Sunday by default, so no existing install moves) and
  `lib/recap-schedule.ts` (+ tests) owns the arithmetic: the next fire date for either day, and
  **which week the notice is about** — a Sunday notice closes the week it lands in, a Monday
  notice reports the week that ended the night before, and neither counts into a week that has
  not happened yet. The recap is still switched ON only when iOS actually granted permission on
  screen 20; an "On" that can never fire would be a lie (§2 rule 5).

### The sandbox promise survives, scoped to a development run

The You rows open `/onboarding-v2/1?dev=1` and every push carries the parameter forward, so the
mode is a property of the navigation rather than a latch somebody can leave on — an abandoned dev
run cannot make the next real onboarding write nothing. While it is set: the store's storage
adapter refuses every write, the commit returns immediately, the funnel's step high-water mark is
not touched, and the done screen still says plainly that nothing was saved. Leaving a dev run
rehydrates the real answers, so a replay cannot overwrite them — and the row that launches one
clears memory only, never the stored row, so showing yourself the funnel cannot delete your own
onboarding. "Reset sandbox state" still does clear it, says so on the row, and is the only thing
that does.

### Two surfaces outside the flow had to follow it

- **The paywall's projection strip** (`components/onboarding/ProjectionStrip.tsx`) read the v1
  answers store, which is empty for everyone who walks v2 — the paywall would have gone back to
  selling nothing, which is the exact regression that component was built to fix on 20 August. It
  now falls back to `projectionFor(v2 answers)` and draws **v2's own stepped series**, not a
  straight ramp: the promise is to reprise the picture the person just saw.
- **The first session is still the line they wrote.** `lib/onboarding-seed.ts` reads v2's
  `demoText` first and the v1 answers behind it, so an install that finished the old flow before
  this build and signs in after it still gets its line.
- **"Restart onboarding" in You** now replays v2 rather than v1. It keeps the previous answers
  ticked and commits again through the same single commit point.

### The two ends of the funnel

**The way out** is one call from screen 20: commit, `dismissAll`, `replace('/')`. Both halves are
needed because the flow is a nested stack — `replace` alone would have left twenty screens sitting
under the paywall, reachable with a back swipe from the one screen that must not be escapable
backwards. A `/onboarding-v2/done` reached by a stale or hand-typed URL redirects to the
dispatcher rather than telling somebody they are set up.

**The way in for people who are not new** is screen 1's footer link. It used to open an alert
saying sign-in was off (true, in a sandbox); it opens the real `/sign-in` now. Signing in there
raises a question the funnel could not answer before: the dispatcher's rule was "not onboarded →
onboarding", and a returning person on a fresh install has no local onboarding flag, so they would
have been marched back to screen 2 to be asked where they log their training. The rule is now
"not onboarded **and signed out**", and the flow watches for a session appearing and steps aside
(guarded on `isOnboardingDone()`, so an entitled subscriber replaying setup from You is not thrown
out on the first frame). It also fixes a case nobody had reached yet: `ensureLocalUser` wipes this
device's meta when the account changes, and signed-in-with-no-local-flag is a returning user, not
a new one.

**After the paywall is unchanged** and was already right: plan → `/sign-in` → the store's purchase
sheet, with the paywall staying mounted underneath so it finishes the purchase when the session
lands (§6). The account is created as part of the paywall's forward step, not after the charge.

### What this does NOT do

No account creation, no trial start, no RevenueCat call and no paywall push anywhere in the v2
subtree. The dispatcher owns what happens after `onboarding_done` is set, exactly as it did for
v1: no session → `/paywall`; entitled tracker user who was never offered import → `/import-start`;
otherwise `/today`.

An install part-way through the v1 flow starts v2 from screen 1 rather than resuming a position
that names a different screen. Its old answers are left untouched.

### The character is out of its box (owner, same day)

The drawings in `assets/new_onboarding/` are 1024×1024 exports with **no alpha channel**: what
looks like transparency in them is a checkerboard that was flattened into the picture. On the warm
paper canvas the character therefore arrived inside a grey tiled square, and `contentFit: contain`
was fitting a canvas that is ~78 % empty, so the figure was also smaller than the box implied.
`components/profile/identity.tsx` measured and documented this on 28 August and left the asset
pass for the owner to call; this is that call.

`scripts/cutout-character-art.py` keys the pattern out of all nineteen poses into
`assets/new_onboarding/cutout/`, trims each to the drawing and caps it at 900 px tall. The
identification is not a threshold — a region is background if it touches the edge **or carries
both checker tones**, which is what also removes the enclosed gaps between the legs and under the
bag strap that a flood from the edge never reaches, while leaving the character's own flat whites
alone. The originals are untouched.

`character-art.ts` now carries each drawing's aspect ratio and `Character.tsx` sizes by HEIGHT, so
the number in the code is the character's height on the glass rather than the side of a mostly
empty square: hero 248 (capped at 32 % of the window on small screens), ring 150, aside/below 104.

### Three small things the walkthrough turned up

- **Screen 1 opened on an empty white disc.** The frame's back-button SPACER reused the button's
  own style, surface fill and all, so the one screen with nothing to go back to drew a blank
  circle in the corner. It holds the rail's start position and paints nothing now.
- **Two VoiceOver labels were still Slovenian** — the progress rail read "Napredek" and the name
  field "Ime". §0: everything user-facing is English, and a screen reader is user-facing.
- **The Metro toast during the walkthrough was not this work.** `src/app/paywall-v2/plan.tsx` was
  mid-edit and failing to transform; it compiles again and the iOS export passes.

### Unverified

**Seen rendered, in the simulator (iPhone 17 Pro Max, iOS 26.5), by deep link:** the welcome,
name, goal, greeting and building screens, and the cut-out character on all of them — transparent
on the paper canvas, at the new sizes, including inside the rotating ring. That is a rendering
check and nothing more.

**Not exercised by a real run:** every transition that needs a tap. Resume after a kill, the
commit itself, the hand-off from screen 20 to the paywall, the paywall's own plan → sign-in →
purchase chain, screen 1's sign-in link, and the dev rows still being harmless are all unverified
outside the type checker and the unit tests. The recap day cannot be verified at all without
waiting for a real notification to fire. Driving the taps would have meant taking over the
owner's simulator with UI automation while they were working in it.

Gates: typecheck 0 · **590/590** · lint 0 · iOS export pass.

---

## 28 August 2026 — the three-screen paywall, screen 3 of 3 (plan selection)

**What was asked.** Rebuild the paywall as three screens on the pattern the
top-grossing catalogue has converged on — trial offer → trial reminder → plan
selection — and build the plan screen first, "since it decides the other two",
for review before the other two are started.

**What shipped.** The plan screen only, at a new route that nothing links to.

### Files

| File | What it is |
|---|---|
| `src/app/paywall-v2/_layout.tsx` | The three-screen stack. `slide_from_right`, gesture enabled, canvas painted on the navigator. |
| `src/app/paywall-v2/plan.tsx` | Screen 3. The money screen. |
| `src/components/paywall-v2/copy.ts` | The headline (from onboarding screen 3's obstacle) and the concrete number (the reveal's first prescribed load). Pure. |
| `src/components/paywall-v2/timeline.ts` | The trial timeline as data. Pure, `nowMs` injected. |
| `src/components/paywall-v2/TrialTimeline.tsx` | The vertical timeline: 36 pt brand-blue nodes on a neutral rail. |
| `src/components/paywall-v2/PlanCard.tsx` | One stacked full-width pricing card. |
| `src/components/paywall-v2/Check.tsx` | The check glyph, local to this directory. |
| `src/components/paywall-v2/copy.test.ts` | 14 tests over both pure modules. |

### The research it was built from

`6480417616/pay_8ixcs` (Cal AI, `Trial Plan Selection`) and its five nearest
library neighbours — Daily Hanzi 0.91, Essembl 0.88, Quran Widgets 0.88,
Antique Identifier 0.86, Coursology 0.86, in five unrelated categories. Five
products with nothing in common draw the same anatomy, so it is an industry
pattern and not one company's taste: back chevron → bold headline → vertical
trial timeline → two plan cards with annual preselected → a checked "no payment
due now" → full-width pill CTA → legal fine print. Gravl `6450921637/pay_k0cx3`
supplied the stacked (rather than side-by-side) card arrangement. Neither
palette was taken — Cal AI is white, Gravl is navy and neon lime.

### What is Recore's rather than the reference's

- **One accent, spent twice.** Brand blue on the three timeline nodes and on the
  selected card's border and check. Nothing else on the screen is coloured: the
  "N DAYS FREE" tab is ink, the saving is grey text, the rail is `color.track`.
  PLANNED green does not appear — nothing here is a prescribed load.
- **The copy is the person's own answers.** The headline names the obstacle they
  picked on onboarding screen 3; the timeline's "Today" row repeats the first
  prescribed load the reveal printed, computed by the same `firstSessionTargets`
  call so the two screens cannot disagree about a number.
- **Nothing is fabricated.** No reviews, no ratings, no user counts, no
  testimonials, no countdown. The reference's proof band was studied and left
  out; the "56% OFF" flash became a sentence.
- **Every price and every day number is the store's.** `fetchOffer` supplies
  Apple's localized `priceString`; `trialDays` decides whether there is a
  three-row timeline at all. Against the Test Store today — which serves no
  introductory offer — the screen renders the honest two-row version, a
  "Subscribe" CTA and "Cancel any time in the App Store", and promises no trial
  anywhere.

### Two defects the work found, both fixed at the source

1. **`firstSessionTargets` prescribes a load for a lift nobody weighed.** It
   treats a missing entry as 0 kg and returns `0 + increment`, so a lift picked
   on screen 15 and never given a weight came back as a finite 2.5 kg. On the
   reveal that sits beside a stepper and is obviously editable; on a paywall it
   is the sentence "your squat at 2.5 kg" said to someone who typed nothing.
   `copy.ts` now guards on `currentKg`, and a test holds it there.
2. **The legal fine print was `textMuted`** — 3.45:1, a token reserved for what
   the eye may skip. A subscription's renewal terms are not that. Now
   `textSecondary`.

### Verified

Typecheck 0 · lint 0 · **14/14** new tests, and the full suite unchanged.
Rendered on an iPhone 17 Pro Max (iOS 26.5) in five states: store-live (no
trial), forced seven-day trial, with and without onboarding answers, and at
Dynamic Type `accessibility-large` — where a fixed-height badge row clipped its
label and was changed to size to its content.

### Not verified, and why

393 pt phones, and the full-motion pass. Both need a tap sent to a simulator,
and both are blocked on a macOS Accessibility permission this machine has not
granted. The layout was tightened by line-height arithmetic to clear the fold at
852 pt rather than measured there. Written up in `FINDINGS.md` §27 rather than
left implicit.

### Deliberately not built

- **Screens 1 and 2** (trial offer, trial reminder). The brief asked for screen
  3 first and for review before continuing.
- **Nothing links to the route.** `src/app/paywall.tsx` is still the funnel's
  paywall and still the only one the dispatcher, You and the lapsed state know
  about. `markPaywallShown()` and `markPlanSelected()` are therefore NOT called
  from the new screen — those counters are the denominator of every conversion
  number in §13, and polluting them before the swap would make the before/after
  comparison the swap exists to produce unreadable. `track('paywall_view')` and
  `track('paywall_cta_tap')` do fire, tagged `variant: 'v2'`.
- **Gravl's exit downsell.** On instruction. `FINDINGS.md` §26 records what it
  is and the condition for building it.

### Open question for the owner

§2's "Then:" line says the paywall repeats "the number from screen 17". Screen
17 was the reveal when that was written and is the commitment now. Built to the
reveal, for the three reasons in `FINDINGS.md` §25; one function changes it.

---

## 28 August 2026 — Profile, rewritten against the v2 flow

The owner's ask: go through the whole You/Profile page, keep what the new
onboarding actually feeds, delete what it does not, and make everything editable
open a **sheet like the other rows** rather than an inline control.

### The audit, row by row

Every editable value on the page was checked against two questions: does the v2
flow produce it, and does any code read it.

| Value | Asked by v2? | Read by? | Ruling |
|---|---|---|---|
| goal, experience, sessions/week, split, key lifts + loads | yes | `predict/data.ts`, `db/strip.ts`, paywall, empty-note cards | keep — already sheets |
| smallest plate | yes (screen 15) | `plates.ts` via `predict`, `db/brief.ts`, `db/strip.ts` | keep — in the lifts sheet |
| weekly recap (day + hour) | yes (screen 20) | `lib/recap.ts` | keep, **and fix** — see below |
| units | no (v2 writes kg; locale default if unset) | `fix-sheet.tsx`, `empty-note-cards.tsx` | keep as a setting |
| rest timer | no | `bottom-toolbar.tsx` | keep as a setting |
| bar weight | no (`flow.ts` assumes 20 kg) | `ghost-prediction.tsx` | keep as a setting |
| writing language | no (v2 takes the locale) | `brief-explain.ts`, `empty-note-cards.tsx` | keep as a setting |
| set readings | no | `state/display.ts` → the ledger | keep as a setting |
| **usual training days** | **no** — v2 asks how MANY sessions, not which days | **nothing** | **deleted** |

### What was deleted

1. **The "Training days" row.** `pref_usual_days` is a v1 onboarding question.
   The v2 flow asks "How many sessions a week?", which is already the "Sessions
   a week" row, and grep found no reader of `getUsualDays` anywhere outside the
   row itself. A control that writes a value no code consumes is a setting that
   does nothing. The days a person actually trains on are named in the split
   (the "Session types" row → `/split`). `prefs.ts` keeps the accessor and the
   v1 flow keeps its write — that flow is dev-only legacy and was not touched.
2. **One of the two development sections.** There were two (`Dev` and
   `Development`), and each carried a row that ran the v1 illustrated flow. They
   were not equivalent: one snapshotted every `pref_%` row first, the other
   reset the answers and pushed straight in — and the v1 flow *writes as it
   goes*, so the second one overwrote the developer's real settings with nothing
   to restore from. Two near-identically-labelled rows, one of them destructive,
   is a trap. Now one section, one row per thing, and the destructive copy is
   gone.
3. **Every inline accordion editor**, replaced by sheets (below).

### The bug the audit found

**Profile could not show the recap answer.** The v2 flow's screen 20 asks
Sunday evening / Monday morning, `commitV2Onboarding` writes `pref_recap_day`,
and `lib/recap.ts` has scheduled on it since v2 became primary — but the You row
was hard-coded to `Sundays HH:00`. Somebody who chose Monday morning, and who
was receiving a Monday-morning notification, opened Profile and was told it
arrives on Sunday. A settings screen that misreports a live setting is CLAUDE.md
§2 rule 5 in its smallest form. `recapRowValue()` now prints the stored day, and
the picker is the flow's own two options read from `flow.ts` and mapped through
`recapChoiceFor` — the same function the commit uses, so onboarding and Profile
cannot disagree about what "Sunday evening" means.

### One way to change a value, not two

Before this pass Profile had two vocabularies on one list of rows: the five
onboarding answers opened `AnswerSheet` (the flow's own full-width picker), and
everything else expanded inline into a segmented control — different control,
different gesture, different tap-target size. The inline one was also the weaker:
a segmented control sets its width by its longest label, so "Slovenščina"
squeezed the other two languages into two thirds of a row.

- **`src/components/profile/pref-sheet.tsx`** (new) — one sheet driven by an id
  for the five single-choice settings (units, rest, bar, writing language, set
  readings). One table owns each setting's copy, options and accessors, and
  `prefLabel()` is what the Profile row prints, so a row and the sheet it opens
  cannot show different words for the same stored value. Writes through on the
  tap and closes a beat later — `AnswerSheet`'s exact contract.
- **`src/components/profile/recap-sheet.tsx`** (new) — the day (the flow's own
  rows, with its marks), the hour under it, and the permission request. It
  closes on **Done**, not on the tap, because it carries a second control and
  can raise a system dialog — `LiftsSheet`'s contract. "On" is still only
  claimed when iOS actually granted it.
- **`settings-rows.tsx`** — `Row` gained the `reading` prop `AccordionRow`
  already had, so a rest length or a bar weight keeps the reading face now that
  it is a plain row. `AccordionRow` and `Segmented` are untouched and still used
  (`Segmented` by the lifts and recap sheets, `AccordionRow` by `/aliases`).

### Regrouped

- **Training** = units, rest timer, bar weight, weekly recap. None is an
  onboarding answer; all four change how a session works.
- **Preferences** (new, replacing the one-row "Display" card) = writing language
  and set readings — how Recore reads what you write and how it prints it back.
  The language row's own comment had asked for this group since 12 Aug.
- **"Run setup again"** moved out of Support — it sat between the privacy policy
  and the build number, a filing cabinet for things that change nothing, while
  the row rewrites every answer above it. It is now the last row of "About you",
  under the answers it replays.

### Verified by the repository gates

Typecheck 0 · lint 0 · **609/609** tests pass, unchanged.

### Not verified

Not run on a device or simulator: the two new sheets' presentation, the recap's
permission path, and VoiceOver over the regrouped sections. Both sheets are
built from components already shipping on this surface (`BottomSheet`,
`OptionRow`, `GhostRow`, `Segmented`, `AppButton`), and the recap's enable path
is `enableRecap` unchanged — but the dialog itself has not been raised here.

---

## 28 August 2026 — the v2 paywall becomes the funnel's paywall, and its spare space is spread over the page

The owner's ask, in two parts: go over the whole paywall design and fix its
vertical rhythm — "the lower part is offset" — and make the flow walkable during
a Test Store run, so a simulated purchase carries you to sign-in and into the
app instead of dead-ending on the buy screen.

### The layout: the surplus, in three placements, measured

`plan.tsx` collected all of a tall phone's spare vertical space in a single
elastic spacer between the timeline and the cards, capped at `GROUP + 40`. Every
number below is from an iPhone 17 Pro Max at default type, read off the
screenshots rather than judged by eye.

1. **All of it in one gap** (what was there): **69 pt against the other three at
   24–31**. Two halves that had drifted apart, and everything under the hole
   read as displaced. The cap existed because an *un*capped spacer turned the
   no-trial timeline's missing row into ~250 pt of canyon — the same mistake at
   a different size.
2. **All of it split above and below the block** (`justifyContent: 'center'`):
   every gap equal at 26, and the whole screen sat as one tight object in the
   middle with bare canvas at both ends. Correct, and rejected by the owner —
   "not centred; spread over the whole screen".
3. **All of it divided between the groups** (`justifyContent: 'space-between'`,
   shipped): the headline starts under the chevron, the legal row finishes above
   the home indicator, and the three gaps between the four groups are equal —
   each `GROUP` plus an identical share of what is left. Measured: **47.7 / 50.0
   / 51.7** with no introductory offer, **27.0 / 27.0 / 27.4** with one, where
   the spread inside each set is line-height leading rather than layout.

`GROUP` is still the floor and still the only vertical value written down. A
screen with nothing spare — a small phone, accessibility type — gets exactly it,
`space-between` has nothing to distribute, and the screen scrolls as before.

### Three layout-check overrides reverted

`trialDays = 7`, `annualBadge = '7 DAYS FREE'` and an unconditional
`<Redirect href="/paywall-v2/plan" />` at the top of the dispatcher were in the
working tree so the screen could be looked at with a trial the Test Store does
not serve. All three are gone: the trial length and the badge come from the
store's own introductory offer again (`selected.trialDays`, `annual.trialDays`),
and the dispatcher routes by session and entitlement as it always did. The
badge is **null when the store offers no trial**, and then neither card draws or
reserves one.

### The swap (owner's ruling, 28 August 2026)

`/paywall-v2/plan` is the funnel's paywall. The dispatcher, the You tab's
"Recore Pro" row and the lapsed ledger's resubscribe path all land there;
`src/app/paywall.tsx` is not deleted and not broken, and is reachable from the
You tab's development rows the way the illustrated onboarding beside it is.
Everything commercial is shared code — one `fetchOffer`, one `purchase`, one
entitlement — so what changed is the picture, not a promise. `markPaywallShown`
and `markPlanSelected` now fire from the new screen: it is the funnel's paywall,
so it owns the denominator of every conversion number in §13.

### The purchase that could not complete, and why

A **race**, not a store problem. `resolveEntitlement` attaches the RevenueCat
customer to the Supabase account from `AuthProvider` the moment a session
appears; the paywall runs its deferred purchase off the same event. When the
purchase won that race, `purchasePlan` found no attached customer and refused to
buy — correctly, §2 forbids an anonymous receipt — and the screen said "that
plan is not available on your App Store account right now". That is the first
tap after sign-in, i.e. every new account on the device.

`state.ts` now has one `ensureStoreAccount(userId)` — attach, count, start the
customer-info watch, idempotent — and `purchase(plan, userId)` and
`restore(userId)` await it before they act. Both paywalls pass
`session?.user.id`. Signed out, the CTA still opens sign-in first and finishes
the purchase when the session lands; that order is §2's, and it is unchanged.

### Two development doors, both `__DEV__`-only

- **DEV · SKIP** in the header, the twin of the one on `paywall.tsx`: signed
  out it lands on sign-in — the app needs a Supabase user in development too —
  and signed in it enters the app. It skips the purchase and nothing else.
- **The Test Store marker** under the CTA: "purchases are simulated, nothing is
  charged". Without it a simulated buy is indistinguishable from a real one on
  screen, which is the confusion §2 rule 5 is written against. `env.ts` blanks a
  `test_` key outside `__DEV__`, so neither the key nor the label can ship.

### Verified

Typecheck 0 · lint 0 · **609/609** tests pass. Rendered on an iPhone 17 Pro Max
simulator (iOS 26.5) against the live Test Store in both states — no
introductory offer, and with one forced on temporarily to see the three-row
timeline — and every gap in the section above measured from those screenshots.

### Not verified

The purchase itself was not tapped through on this machine: the Test Store's
simulated sheet, the sign-in hand-off and the landing on Today are the owner's
to walk. The race fix is reasoned from the two call sites and is `await`ed on a
path that already existed; nothing about it is observable from the screenshots
above.

---

## 28 August 2026 — Progression takes the blue, and the charts draw themselves

**Owner's ask:** *"popravi to pri progression, dodaj neke barve — npr. to modro
ki je v onboardingu — in naredi lepše animacije grafov."*

Half a day earlier, `bare-chart.tsx` had shipped monochrome on the grounds that
the Lyfta screens it was measured from are. That was a reading of the reference,
not of Recore: the skill's colour section has said since 20 August that **one
brand blue does every job, chart lines included** — and that the lift sheet's
progression line draws in `brand` precisely so the same lift reads the same way
on every surface. The Progression tab was the one place still opting out. It no
longer does.

### What is blue now

| Surface | Was | Is |
|---|---|---|
| Progression list, the row sparkline (`(tabs)/progress.tsx`) | `inkData` grey | `brand`, with a wash under it |
| One lift, the line charts (`progression/bare-chart.tsx`) | `inkData` grey | `brand`, wash at 16 % fading to nothing at the floor |
| One lift, the bar charts | one grey for every bar | `brand` on the newest session, `brand` at 34 % behind it |

**`#007AFF` measures 3.26:1 on `surfaceHigh`** — the tinted card these charts sit
on — past the 3:1 a non-text mark that carries information owes. On the canvas,
where the list's sparklines are, it is the 3.66:1 already recorded in
`color.ts`.

Four things deliberately stayed where they were, and the prose in each file now
says why: **the placeholder shape is ink** (an empty card must not be able to
read as a record, and hue is the cheapest way to keep them apart), **the
gridlines are ink** (they are texture, and tinting them would make the card's
background argue with its data), **the planned tail is `signal` green**
(CLAUDE.md §3 — a load not yet lifted is never the recorded hue), and **every
piece of text is untouched**: the metric card's 44 pt number, its unit and its
sub-label are still grey, because colour marks and ink speaks, and a value never
wears the hue of its own chart.

### The animations

`MonotoneSeries` (`lib/motion/chart.tsx`) already drew left to right in 800 ms
with each dot landing as the pen reached it. Two things were added on top, and
one thing that did not exist before:

1. **The wash is revealed by the pen, not by a fade.** A clip rectangle follows
   the stroke's own x, so the fill arrives under the line exactly where the line
   already is. Its width is *not* `width × progress`: progress is measured along
   the path's ARC, and a steep segment is longer than a flat one, so a linear
   mapping runs the fill ahead of the pen on every climb. `interpolate()` maps
   the point fractions onto the points' own x and undoes that — plain number
   arrays closed over by the worklet, no `alpha()` anywhere near it.
2. **The newest reading lands.** The terminal dot is 1.4× the others, arrives on
   the `arrive` spring after the pen stops, and is knocked out of its own line
   with the card's colour so it reads as the head of the series. One ring leaves
   it and fades over 620 ms. It fires **once** and never repeats — the skill
   bans looping celebration, and this is a full stop, not a party.
3. **`Sparkline` can draw itself** (`components/charts.tsx`). Given a `delay` it
   runs on in 520 ms — a glance, not a journey — with the dot landing in the last
   12 % and an optional wash resolving underneath. The Progression list hands
   each row's line the row's own stagger plus 150 ms, so the list writes itself
   down the screen instead of arriving with eight finished decorations on it.
   Without `delay` it is the static line it has always been, which is what the
   Next tab's tiles still get.

Reduce Motion: every one of these is fully present on mount, and the ring never
draws at all.

### One hedge, recorded rather than hidden

The wash's own `fillOpacity` ramps over the first fifth of the draw. With the
clip working that is a soft entry and nothing more. It is also the honest
fallback: `<ClipPath>` with an animated child is a first use in this repository,
and if a platform ever stops propagating an animated prop from inside one, the
record still gains its body instead of losing it entirely. The clip rect also
declares a static `width` for the same reason — a rect whose width arrived only
from the animation renders empty on frame one.

### Verified

Typecheck 0 · lint 0 · **609/609** tests pass.

### Not verified

**Not seen on a device.** The simulator on this machine sits behind the paywall
with no onboarding completed and no logged history, so neither the Progression
list nor a metric card can be reached from it without tapping through by hand.
The colours are measured arithmetic and the motion is reasoned from the two
primitives it extends; the *look* of the blue on the tinted card, the wash's
weight and the reveal edge tracking the pen are the owner's to confirm on the
first run.

---

## 28 August 2026 — the sign-in buttons become Apple's and Google's

**Owner's ask:** *"dej pri sign up naredi tko, da je ta prijava tam kjer j apple
črna in tm pri continue with google isto nekaj v tej smeri, in premisli a je
obvezno tudi da se doda poseb sign up — sepravi da obstaja možnost da se prijavi
nekdo brez da ima apple al google acc."*

### What was on the screen

`sign-in.tsx` rendered `AppButton` twice: `variant="primary"` for Apple and
`variant="secondary"` for Google. In this palette that is **a blue brand pill
wearing the app's blue glow, and a pale-blue tinted pill under it** — two shades
of `#007AFF` where the two most recognised buttons in consumer software should
be. The file's own header comment had claimed "Apple (primary ink-fill) and
Google (bordered secondary)" since 23 July; the code had never done that.

The mistake underneath it is worth naming, because it is the one a design system
makes: a sign-in button is not a Recore CTA that happens to say *Apple*. It is a
piece of somebody else's identity, and it is the one control on any screen a
person recognises **before** they read it. Painting it in the host app's accent
spends exactly the recognition it exists for.

### What is there now

A new `components/provider-button.tsx`, used by `sign-in.tsx` and nothing else.

| | Fill | Border | Label + mark |
|---|---|---|---|
| **Sign in with Apple** | `#000000` | — | white label, white Apple mark |
| **Continue with Google** | `#FFFFFF` | 1 px `#747775` | `#1F1F1F` label, the four-colour "G" |

Both are their owners' published specs, not choices: Apple's HIG allows the
Sign in with Apple button in **black, white, or white-with-outline and nothing
else**, at a 44 pt minimum height, with a corner radius free anywhere from
square to half the height. Google's light button is a white surface with a
`#747775` stroke and `#1F1F1F` text, and its mark is the four-colour G, which
**may not be recoloured** — which is why the button draws its own SVG instead of
reaching for `Icon`'s monochrome `logo-google`, and why `GoogleMark` takes no
tint prop: a prop that could break the spec is a prop somebody eventually uses.

Apple's fill is **pure black, not the app's warm `#171914` ink**. Three
appearances are allowed and a near-black of our own is not one of them.

Everything else is still Recore's, so the pair reads as one family: `CTA_HEIGHT`
56, `radius.md` 14, the headline label at 600, the 0.98 press scale with a
darker pressed **fill** rather than an opacity flash, the same spinner, the same
0.4 disabled dip. The blue `shadow.glow` is gone from both — it belongs to a
brand CTA and neither of these is one.

The eleven foreign hex values live in `theme/color.ts` as a **separate
`provider` export**, not in `color`. `color.test.ts` fails the build on a hex
typed anywhere outside that file, so they had to come here; they are quarantined
from the palette so that `color.googleBlue` never appears in autocomplete beside
`color.brand` and invites a screen to reach for `#4285F4`.

This is the same exception `onboarding-v2/BrandIcon.tsx` already makes and one
step further. There, six attribution marks draw in a single ink *because* a row
of full-colour logos would read as an endorsement. Here there are two buttons,
**each is the endorsement**, and each wears its owner's colours.

### The second question: is a separate email sign-up obligatory?

**No — and the app is right as it stands.** Recorded here because it will be
asked again at review time.

- **App Store guideline 4.8** is the rule that could have forced something. It
  says an app offering a third-party login (Google) must *also* offer a login
  that limits data collection to name and email, lets the person hide their
  email, and does not track. **Sign in with Apple is that option**, and it is
  already the primary button. 4.8 asks for the privacy-equivalent alternative,
  never for an email/password path on top of it.
- **"Someone with neither account" is close to unreachable on iOS.** Installing
  this app requires an Apple ID, and Sign in with Apple works with any of them.
- **The one real hole** is an Apple ID with two-factor turned off, which Sign in
  with Apple refuses outright. Those people still have Google, and the screen
  already degrades correctly: `AppleAuthentication.isAvailableAsync()` gates the
  Apple button, so when it is unavailable Google stands alone rather than the
  screen offering something that cannot work.
- **If that hole ever needs closing, close it with an email magic link** —
  Supabase already speaks OTP, so it is a link and a code field, not an auth
  rewrite. Never a password: the caption under these buttons promises "No
  passwords", and adding one would make a shipped line untrue. That reasoning is
  now in `sign-in.tsx`'s header so the next person does not re-derive it.

Nothing about guideline **5.1.1(v)** changed here and it is still open: the
funnel requires an account before Today, and this pass did not touch that.

### Verified

Typecheck 0 · lint 0 · **609/609** tests pass. `color.test.ts` was the gate that
shaped the change — it caught all eleven literals on the first run and is the
reason the `provider` export exists.

### Not verified

**Not seen on a device.** Both buttons are static geometry the app already
ships at these numbers, and the colours are transcribed from the two published
specs rather than measured against this canvas — deliberately, since neither
button is a surface Recore writes on. What the owner should confirm on the first
run is the *weight of the pair on cream*: pure black at 56 pt is the heaviest
object anywhere in this app, and whether the white Google button below it holds
its own against that, or wants Google's neutral `#F2F2F2` surface instead, is a
judgement only the rendered screen can settle.

---

## 29 August 2026 — every onboarding answer reaches Profile, and Profile reaches back

The v2 flow asks seven questions about the person and the commit carried five of
them out. The other two — **where do you log now** and **what gets in the way** —
were asked, used inside the run, and then lost: nothing outside
`state/onboarding-v2.ts` could read either of them, so Profile could not show
what was said and nobody could change their mind about it later. This pass
closes that, and closes the return leg, which turned out to be the more
expensive half.

### The two answers that evaporated

- **`pref_current_tracker`** (new) — screen 2's own option id, written by
  `commitV2Onboarding` through `setAnswer('tracker', …)`. It had always been
  asked and had always decided something real, but the only thing that survived
  it was the DERIVED `pref_ob_tracker` enum, where four flow options collapse
  onto three values (`notes` / `excel` / `paper` → `notes`). That mapping has no
  inverse, so "Paper notebook" could not be printed back and could not be
  changed. `setAnswer` writes the derived enum beside the answer, exactly as it
  already did for goal and experience, so `wantsImportFastPath` and
  `import-start.tsx` follow an edit made in Profile rather than going on naming
  a tracker the person has left.
- **`pref_obstacles`** (new) — screen 3's list, capped by the screen's own `max`,
  validated against its own options. It decides which value proposition leads on
  the reveal and on the paywall, and it was the one product-shaping answer the
  commit never wrote anywhere.

Both keys are `pref_*`, so they inherit §12's export and deletion guarantees the
moment they are written: `export-json.ts` carries every `pref_%` row and
`account/delete.ts` drops the whole `meta` table. No further work anywhere.

### The bug this pass found: Profile edits could be silently undone

**"Run setup again" replayed the store, not the record.** The row promises "your
answers already ticked", and what it ticked was whatever the v2 store had
persisted at the end of the *last run*. Change your goal in Profile in
September, replay the flow in October, and screen 9 opens on the answer you
replaced — and finishing that replay committed the stale answer straight back
over the edit. A settings screen whose edits can be undone by a button on the
same screen is not a settings screen.

**The paywall quoted the old answers for the same reason.**
`paywall-v2/plan.tsx` builds its copy from `useV2` — the store, not the record —
and that paywall is reachable from Profile's own subscription row. The page
could open naming a goal the person had changed two rows above.

- **`src/lib/onboarding-v2-seed.ts`** (new) — `seedV2FromRecord()`, the return
  leg of `onboarding-v2-commit.ts`. It projects the answers of record back into
  the flow's store and is called from exactly two places: every landed Profile
  edit (`noteAnswerChanged`) and the replay row. Both bugs above read the same
  store, so one projection fixes both, and the store is never further behind the
  record than one write.
- It writes **only what the record actually holds**. An install that onboarded
  before today has its tracker and obstacles in the store and nowhere else;
  overwriting those with "unanswered" would destroy the only copy in existence.
  Same rule as the commit keeps in the other direction — a skipped question never
  replaces a real answer with a guess.
- It is a **no-op during a dev run**. §0's sandbox promise cuts both ways: a
  clean run must not open half-filled with the person's real answers.
- **`recapAnswerFor()`** (`onboarding-v2-map.ts`) — `recapChoiceFor` read
  backwards, so the replay opens screen 18 on the choice actually in force.
  Round-tripped in `onboarding-v2-map.test.ts` over every option the screen
  offers, plus the case that matters: Sunday is the default day for everybody
  (`getRecapDay`), so the day alone must never be mistaken for a yes.

### Two new rows in "About you"

- **Where you log now** — `AnswerSheet`, the flow's own screen 2, ghost row and
  all.
- **What gets in the way** — `src/components/profile/obstacles-sheet.tsx` (new).
  The second answer on this surface that is not a single choice, so it follows
  `LiftsSheet` rather than `AnswerSheet`: `OptionRow` in multi mode, oldest out
  at the cap (a tap that lands nowhere reads as a broken control), write-through,
  closes on **Done**. The row's value is a count — "One thing" / "2 things" —
  because the value column is one line wide and these options are sentences; the
  frustrations themselves are named on the row's second line.

They sit under the training answers rather than in the flow's order, so the
thing a person opens this section for — their goal — stays at the top of it.

### Verified by the repository gates

Typecheck 0 · lint 0 · **622/622** tests pass (two added: the recap round trip
and the never-answered case) · `npx expo export --platform ios` **pass**.

### Not verified

Not run on a device or simulator: the obstacles sheet's presentation, and the
replay itself — that a seeded run really does open with every previous answer
ticked, screen by screen, and commits back what was confirmed. The projection is
covered only by the map's round-trip test; the seed function itself reads SQLite
and the zustand store and has no node-runnable test, which is the same position
`onboarding-v2-commit.ts` is in.

---

## The parse-pending state (owner ask, 29 Aug 2026) — what shipped, and what is still unverified

The ask was for the "AI thinking" moment on Today — the seconds between writing
a set and the reading coming back — to be properly animated and properly
placed. The placement turned out to be the whole of it.

### What was wrong

`ParseIndicator` drew a 40 pt track with a shuttle easing along it, and the two
surfaces that mount it put it in a place no answer arrives at:

- **The settled card** draws its reading UNDER the exercise name (`exValue` /
  `SetTable`), and the pending card put the shuttle to the RIGHT of the words in
  a two-column row of its own. On the card the whole block re-laid itself out at
  the instant the parse landed: the words moved, the reading appeared a line
  lower, and the ⋯ column pushed in from the right.
- A sliding shuttle on a track is the shape of a **progress bar**, and there is
  no progress to report: the parse is one round trip and there is nothing to be
  40 % of.

### The first attempt, and why it was rejected

The first fix moved the word `reading` into the slot the reading itself would
occupy — a line BELOW the words, in the reading's own face and size, so the swap
cost no layout. The geometry was right and the owner rejected the look the same
day: *"sploh ni tko v isti vrsti"* — the line the athlete wrote is the line the
app is working on, and that is where the app should say so. Four variants were
built and shown side by side, animated, before the second attempt was written.

### What it is now

Two marks, both on the words' own row, with a division of labour:

- **`ReadingSweep`** passes a beam of `brand` at 16 % across the WHOLE row —
  rail to ⋯ column, behind every other child, absolutely placed so the row
  measures as if it were not there. 1300 ms, `Easing.inOut(Easing.cubic)`, then
  a 400 ms beat of stillness, so it reads as a line being read and then read
  again rather than a strobe. The travel is measured from the row's own
  `onLayout` width, so it crosses exactly the entry it is reading at any Dynamic
  Type setting and on any device. Widened from the words to the whole row on the
  owner's call: what is being read is the entry, not the word.
- **`ReadingMark`** puts the machine's own working mark in the ⋯ column's slot,
  on the words' own row and centred on their line. It is the SAME THREE DOTS the
  settled card carries as its ⋯ menu. They wave while the line is read;
  when the reading lands they stop and that identical glyph is the button.
  Nothing new appears on the row, and nothing moves at the handover — which is
  the whole reason the mark is dots rather than a spinner. It reuses the
  `PendingDot` already in the file, which gained a `tint` and a `size` so it can
  speak in the menu glyph's ink and at the menu glyph's metrics.

The pending card is otherwise the settled card minus the answer: same rail, same
body, and the ⋯ column already at full width, so the glyph appears in a place
that was being held rather than shoving the words leftward.

**The composer's live line carries the dots alone.** There are no committed
words there for a light to pass under — the line is still in the field above —
and moving anything under a cursor mid-sentence is the one thing §14 rules out
outright.

**Reduce Motion** drops both marks and prints `reading` at the end of the same
row — decided by one hook inside `ReadingMark`, so the row cannot fall silent.
Three still dots are not a fallback: they would read as the ⋯ button, and a
control that does nothing is worse than no control.

### Five things the simulator found that the code review had not

Each was invisible in the source and obvious in a screenshot.

1. **The dots were twice the width of the glyph they become.** The gutter's own
   4.5 pt dot on a 4.5 pt pitch measured 26 pt across; `Icon`'s ellipsis at 17 pt
   measures 14. The mark was moving two dots' worth at the handover. It now
   carries the glyph's metrics — 3 pt dots on a 3 pt pitch.
2. **The beam met the clip as a chip.** While any part of the band was outside
   the row, `overflow: hidden` cut it down the middle and printed a hard vertical
   edge against the canvas. The track is no longer clipped at all: the band
   starts a band's width off the row and ends a band's width past it, so its own
   soft ends are the only edges the eye ever meets.
3. **It read as a column, not a beam.** A `LinearGradient` fades in one direction
   only, so the band's top and bottom arrived as straight lines — and two pending
   lines stacked in a ledger merged into one tall bar crossing both. A second
   gradient lays `canvas` back over the band's top and bottom, fading to nothing
   across its middle, giving the light its second axis.
4. **The dots sat under the line, not on it** (owner, 29 August). They were
   centred in the ⋯ column's 36 pt button box, which is top-aligned to a card
   three lines tall — so on a one-line pending card they landed 31.5 pt from the
   card's top, below the descenders, reading as a footnote to the line rather
   than as its status. The ⋯ column now lives INSIDE the words' row rather than
   beside it, at the same width and behind the same gap, so the mark keeps the
   glyph's x and gains the line's own centre: measured on the render, the dots'
   centre is 113.17 pt against a baseline of 117.67 pt and a figure height of
   12.00 — the x-height centre to a third of a point.
5. **Reduce Motion could leave the row silent.** The marks read
   `useReducedMotion()` themselves while the card chose the word from a
   `reduceMotion` prop. In production those agree; with the OS setting on and the
   prop still false, the simulator showed the dots gone, the word never rendered,
   and a working row saying nothing at all. `ReadingMark` now makes the decision
   once, and is the only thing a caller mounts.

### The alignment, measured rather than eyeballed

Off the rendered frame, comparing a pending row against the settled row it turns
into (points; the render is 3× device pixels):

| | ring centre x | words / name left | text top into card | mark centre x |
|---|---|---|---|---|
| Pending | 41.2 | 68.00 | 15.83 | 359.67 |
| Settled | 41.2 | 68.00 | 15.83 | 359.67 |

The name lands exactly where the words sat, and the mark keeps the glyph's
column to within 0.2 pt — a third of a device pixel. (Rows beginning `o` or `i`
measure 15.50–15.67 pt rather than 15.83: those are ascender differences in the
glyphs, not the layout.)

**Vertically the two marks no longer agree, deliberately.** The pending dots
centre on the words' line (113.17 pt, against a baseline of 117.67); the settled
⋯ centres in its 36 pt button, 7.5 pt below the ring. So the glyph arrives about
4 pt below where the dots were waving. That is the owner's call of 29 August and
it is the right one: the mark is read for the whole time the line is pending and
glanced at once when it lands. Aligning the settled card's ⋯ to its name row
would buy back a pixel-still handover and is the obvious follow-up, but it
changes a shipped surface nobody asked about.

### One decision recorded so it is not silently re-litigated

**The pending card animates IN but not OUT.** A `FadeOut` exit is the obvious way
to cross-fade into the read card, and it is wrong here: a view animating out
still holds its place in the layout, so for the length of the fade the ledger
would stand one card taller and then collapse — the exact reflow this change
exists to remove. The exchange is carried by the read card's own `FadeInDown`
arrival instead.

**No progress theatre, and the research says why.** In the Appllama catalogue
every captured "analysing" state in a top-grossing app is a full screen with a
progress ring, a percentage and testimonials beside it (MadMuscles, Solid Starts,
Carb Manager, MyNetDiary's scan spinner). Recore cannot use that shape: a
percentage would be a number nobody computed, which §3 calls fabrication. The
nearest honest analogue in the library is Foodvisor's *Quick Add*, where the
typed sentence stays the user's own object and the machine answers in a separate
block under a quiet status line — the shape all four variants took.

### Verified by the repository gates

Typecheck 0 · lint 0 · **661/661** tests pass · `npx expo export --platform ios`
**pass**. (`expo lint` also reports one warning in `src/app/index.tsx` — a
`// TEMP: simulator verification pass` redirect belonging to another session's
work in progress, untouched here.)

### Seen on the simulator, and what was not

iPhone 17 Pro, Release build, through six rebuilds. Rendered and measured: the
pending card, the row it becomes, two pending lines stacked as a session shows
them, the composer's value column, and the row under a real OS-level Reduce
Motion. Every number above comes off those frames. Frames were sampled across the
1700 ms cycle and ranked by the blue they put into the row, because the beam is
invisible for the 400 ms beat and a hand-picked screenshot lands there more often
than not.

**`ReadingMark` itself has not been on a screen.** It was written after the last
frame was captured, to close the silent-row defect that frame exposed, and the
build that would show it never ran: a concurrent session held Xcode's build
database for the rest of the sitting, and with 1.7 GB free there was no room for
a second `derivedDataPath`. Its motion path renders exactly what those frames
show — the same dots, in the same slot, in the same row — so what is unverified
is narrow: that with Reduce Motion on, the word now appears where the dots were.
It is one branch of one component and it is gate-clean, but nobody has looked
at it.

### Still not verified

Nothing here has been seen on a physical device, and no one has watched it during
a real parse. What a device would settle: whether 16 % on the warm canvas holds
up in daylight rather than on a desk display, whether the 400 ms beat is right at
real parse latencies (a slow network holds this state for seconds, not
milliseconds), and whether the dots→⋯ handover reads as still to a person who is
looking at the line rather than measuring it.

## 6 September 2026 — the check-in stops imitating a sheet and becomes one

The end-of-session check-in (§8.1) moved from the app's own `<BottomSheet>` chrome to a real UIKit
form sheet on a route. Nothing inside it was redesigned: the same title, the same "How each lift
felt" rows, the same reflection field, tags and footer, the same tokens. What changed is who
presents it.

### Files

- **`src/app/check-in.tsx`** — new. The `/check-in` route. It renders the sheet body and owns
  `checkInOpen`.
- **`src/app/_layout.tsx`** — registers the screen inside the signed-in guard with
  `presentation: 'formSheet'`, `sheetAllowedDetents: [0.6, 1]`, `sheetInitialDetentIndex: 0`,
  `sheetGrabberVisible: true`, `sheetCornerRadius: radius.xl`, and
  `contentStyle: { backgroundColor: color.surface }`.
- **`src/components/check-in-sheet.tsx`** — the `<BottomSheet>` wrapper is gone; the root is a flex
  box, the scroll takes `flex: 1`, and the footer now pays the bottom safe-area inset itself.
- **`src/app/(tabs)/today.tsx`** — the permanent `<CheckInSheet />` mount is gone.
- **`src/state/session-store.ts`** — `openCheckIn` is now `router.push('/check-in')` and nothing
  else; `closeCheckIn` is replaced by `setCheckInOnScreen`, which only the route calls.
- **`src/app/(tabs)/you.tsx`** — Sign out asks first (below).

### Four decisions, recorded so they are not silently re-litigated

1. **`[0.6, 1]`, not `[0.6, 0.92]`** (owner, 6 September 2026). The old sheet carried
   `maxHeight: '92%'` because it drew its own card and had to leave the status bar alone. The
   system's large detent already insets from the top, so re-applying 92% here would stack our inset
   on UIKit's and render a visible gap. `1` is the correct equivalent of the old 92%.
2. **`fitToContents` was rejected.** The content is a fixed head, a scroll that grows by one row per
   unrated lift, and a fixed footer. `fitToContents` forbids the `flex: 1` that layout needs, and the
   height is genuinely unbounded.
3. **`color.surface`, not `color.canvas`** (owner, 6 September 2026). The sheet has always been the
   warm near-white that floats above the paper canvas, and this is a presentation change, not a
   restyle. The colour is set in `contentStyle` **and** on the root view, so no frame of UIKit's
   system grey or translucent material can show while the screen mounts.
4. **One writer for `checkInOpen`** (owner, 6 September 2026). The route sets it on mount and clears
   it on unmount; `openCheckIn` only navigates. Two writers would leave the flag stuck true after a
   swipe-dismiss — which the opener never hears about — and `bottom-toolbar.tsx` would silently stop
   raising the App Store review prompt forever, with nothing on screen to explain why.

### The modal-nesting audit, and what it found

A form sheet is presented by the ROOT navigator, so a caller that fires while an RN `Modal` (any
`bottom-sheet.tsx` sheet) is still mounted would render it BEHIND that modal — invisible, in the same
way UIKit refuses a second modal. All five call sites were checked:

| call site | in a modal? | outcome |
|---|---|---|
| `bottom-toolbar.tsx:247` (Finish) | no — the keyboard accessory bar, on the page; `revealReceipt` is a `scrollToEnd`, not a presentation | direct push |
| `note-surface.tsx:495` and `:651` | no — both in `NoteSurface`'s own return; its only sheet is a sibling below them | direct push |
| `session-receipt.tsx:409` | **dead code** — `SessionReceipt` is exported and imported by nobody | none |
| `session-summary-sheet.tsx:114` | **dead code** — unreachable since 18 August 2026; its only opener, `SummaryPill`, is imported by nobody | left as-is; its `onClosed` sequencing is already the correct pattern |

No live caller needs the close-then-push dance. The rule is written into `openCheckIn`'s comment for
whoever adds the next caller.

### Persistence across a swipe-dismiss

The old sheet routed its drag-dismiss through `onClose`, so the × , Skip, the backdrop and the swipe
all ran the same commit. A form sheet pops the route from UIKit and tells JS nothing beyond the
unmount, so `commit` was split out of `commitAndClose` and also runs from an unmount cleanup. It is
idempotent — the write is guarded on the composed value differing from `stored.current` — so the
button path and the unmount path together write once and count the §13 event once. The ref it reads
is deliberately declared **before** the load effect, so a mount-unmount-mount cycle cannot commit an
empty draft over a stored reflection.

### Sign out asks first

`you.tsx` had Sign out sitting between "Clear local cache" and "Delete account" — both of which have
always confirmed — as the one row in the destructive zone that fired on the first tap. It is now a
system alert like every other confirmation in the app, `destructive` on the verb and `cancel` on the
way out. The message is honest: the record stays on the device and on the server; this is not
deletion.

**Every other destructive confirmation was audited and left alone.** `aliases.tsx:58`,
`you.tsx:438` and `:504`, `fix-sheet.tsx:392` and `note-surface.tsx:177` are already real
`UIAlertController`s with `style: 'destructive'` and `style: 'cancel'`. `@expo/ui` was considered and
rejected: it is present in `node_modules` only as a transitive dependency of `expo-router`, adding it
directly would cost a native rebuild, and it buys nothing over what is already native. The export
chooser at `you.tsx:325` is the one place an action sheet from the bottom would read better; the
owner put it out of scope for this pass.

### Verified by the repository gates

`tsc --noEmit`, `node --test` (690 pass, 0 fail), `expo lint` (0 errors; the one warning on
`check-in-sheet.tsx` is the pre-existing `setState`-in-effect on the reflection load, unchanged by
this pass) and `expo export --platform ios` all pass.

### What remains unverified — none of it can be closed from this machine

No simulator or device was available. Three things need a screen: `color.surface` reading edge to
edge at both detents with no system grey or translucent material bleeding through; a reflection typed
and then swipe-dismissed surviving; and whether `sheetCornerRadius: 24` is honoured (the prop
documents itself as "will try to render with"). No AI prompt, response schema, guard or summary
changed, so CLAUDE.md §5's owner-run §9.4 evaluation is not owed by this pass.

**Two risks were closed in code rather than left for the device** (owner, 6 September 2026):

- **The bottom inset is no longer trusted.** `RNSScreen.mm` carries an open
  `// TODO: register for UIKeyboard notifications` on its safe-area provider, and a form sheet is a
  presentation the inset can be reported into late or as zero. The footer pads
  `spacing.lg + Math.max(insets.bottom, spacing.xxl)`, so a footer under the home indicator is
  impossible in either case; 24 over-pays on a device that genuinely has no indicator, which is the
  harmless direction to be wrong in.
- **The multiline field needs nothing, and deliberately gets nothing.** `react-native-screens`
  documents the behaviour in `src/types.tsx:482`: "On iOS, the native implementation might resize the
  sheet w/o explicitly changing the detent level, e.g. in case of keyboard appearance." That is
  `UISheetPresentationController` lifting the sheet for a first responder, which is precisely the
  case UIKit owns. The old `<BottomSheet>` needed a `KeyboardAvoidingView` because an RN `Modal` is a
  plain window UIKit gives no such help to; keeping one here would stack our lift on UIKit's and push
  the content too far. Nothing was added.
