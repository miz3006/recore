# PLAN.md — what is left to build

**Version 2 · 28 July 2026 · Supersedes the v3 execution plan (derived from the retired
`CLAUDE.md` v3 §22, which described work that was rejected and rolled back).**

Derived from `CLAUDE.md` v4 §18–§19 **and from a read of the working tree on 28 July 2026**.
Where the two disagreed, the tree won and the disagreement is recorded in §2 rather than
silently resolved (`CLAUDE.md` §0.3).

`recore-onboarding-v2-spec.md` (owner, 28 July) is integrated as **block E** in §7. It is a
drop-in replacement for `CLAUDE.md` §11 and it supersedes a standing ruling, so it does not
start until **R5** is recorded in Appendix C — the spec says so itself.

Read `CLAUDE.md` first. That file decides *how*; this one tracks *what is missing and in what
order*.

---

## 0. How to use this file

- Work on **one task at a time**, in order, and stop after it. Reference tasks by id:
  `Read PLAN.md. Do A1 only. Show me the files you'll touch, then stop.`
- **Never skip a tier.** Nothing in a lower tier is worth an hour while the tier above it has an
  open task — that ordering is the whole point of §18 and it is preserved here.
- A task is done when its own acceptance line is true **and** the four gates pass:

```bash
npm run typecheck && npm test && npm run lint && npx expo export --platform ios
```

- `npm run eval` is the fifth gate and only the owner can run it. No task below touches
  `prompt.ts`, the response schema or `PARSE_VERSION`, so no task below needs it. If one starts
  to, it stops being this task.
- Anything marked **RULING** is not an implementation task. It needs an owner sentence first
  (`CLAUDE.md` §0.2). Do not build either branch of it.
- Log each completed task in §9.

---

## 1. Baseline — verified 28 July 2026, not assumed

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` | **64/64** across 7 files |
| `npm run lint` | pass, zero warnings |
| `npx expo export --platform ios` | bundles, 5.5 MB |
| `npm run eval` | not run — owner-only, and nothing here requires it |
| `PARSE_VERSION` / `CLIENT_PARSE_VERSION` | 5 / 5, in lockstep |
| Eval cases | 72 |
| `TAB_BAR_CLEARANCE` | 56, used by all four tab screens |

**Uncommitted work in the tree right now:** the four-tab restructure (`(tabs)/_layout`, `today`,
`lifts`, `db/lifts.ts`, `stats`→`progress`, `settings`→`you`) plus `CLAUDE.md` v4 and
`CLAUDE2.md`. It builds and passes every gate. **Commit it before starting A1** — the tier-0
work below edits two of the same files, and a mixed commit makes the rollback of either
impossible.

Deps confirmed absent: `react-native-purchases`, `expo-notifications`, any font package in use.
Deps present but unused: `expo-symbols`, `expo-font` (consistent with §3 — the tab bar uses
`NativeTabs`' own `sf` prop, not `expo-symbols`).

---

## 2. Where `CLAUDE.md` v4 and the code disagree

§0.3 says the code wins and the document gets fixed in the same change. These were found by
reading the tree; each is a one-line doc edit, not a code task.

| # | The document says | The code does | Where | Fix |
|---|---|---|---|---|
| **X1** | §11.1: "the Hevy/Strong branch imports CSV **inline, inside onboarding**", and `recachePredictionFromLatest` makes the ghost real on the ready screen — called "the strongest conversion asset in the product" and "load-bearing for the business" | Onboarding step 3 only **records which tracker you use** (`setObTracker`). It never imports. `pickAndImportCsv` and `recachePredictionFromLatest` are called **only from `(tabs)/you.tsx`** | `src/app/onboarding/index.tsx:472–480`, `src/app/(tabs)/you.tsx:182,177` | This is not a doc typo — the asset §11.1 describes **does not exist**. See **RULING R2** |
| **X2** | §18 Tier 2: "the You screen's 'arrives with …' alerts on Smallest plate, Default rest, Writing language, the privacy page, exports, Terms, Privacy and Contact" | Smallest plate, Bar weight, Writing language and Focus are **real inline segmented editors**; export and import are **real**; there are no Terms / Privacy / Contact rows at all. Only **Restore purchases** and **Delete account** are alerts, and "How parsing works" is an alert rather than a page | `src/app/(tabs)/you.tsx:319–425` | Rewrite the Tier 2 bullet to name the two real stubs. Most of this bullet is already built |
| **X3** | §12.1: the paywall promises "an in-app reminder two days before the charge" | The row says **"We email you before the trial ends."** There is no notification system **and no email system** — the claim is untrue twice over | `src/app/paywall.tsx:57–61` | Doesn't change the fix (**A2**), but the row is a promise to send mail from a backend that does not exist |
| **X4** | §13: export is "shared via the system sheet … which is why `expo-sharing` is used" | PNG share does use `expo-sharing`; **CSV export uses `Share.share({ message: csv })`** — the whole CSV as a message body, not a file | `src/app/(tabs)/you.tsx:221` vs `session-receipt.tsx:297` | Code task **C6**, then the doc line is true |

---

## 3. Tier 0 — the app says things that are not true

**Blocks App Store submission.** These are the only items in this file that are *wrong* rather
than unfinished (`CLAUDE.md` §18), and A3 is a rejection under App Review 3.1.2, not a matter of
taste. Half a day, all of it deletion except A3.

- [ ] **A1 · Delete the fabricated social proof.** No real reviews exist, so both the score and
      the testimonial are invented. **Half done — onboarding is clean, the paywall is not.**
      - [ ] `src/app/paywall.tsx:189–191` — the `<Rating score={4.9} countLabel="loved by early lifters" />` block and its `ratingWrap` style.
      - [ ] `src/app/paywall.tsx:217–221` — `<Testimonial … who="Marko · powerlifting" />` and its `testimonial` style.
      - [x] `src/app/onboarding/index.tsx` — the hardcoded `testimonial` object, the `<Rating>` and
        the `<Testimonial>` on the ready screen, deleted 28 Jul with the visual pass. The space was
        not refilled; the setup echo that was already on that screen took the room.
      - **Keep `Rating` and `Testimonial` in `src/components/primitives.tsx`** — §12.1 rules that
        the star row waits in the codebase for a real App Store Connect score. Only the call
        sites go.
      - **Do not refill either space.** No badge, no install count, no "trusted by early
        lifters". The headline moves up against the subline; that is the finished state.
      - *Acceptance:* `grep -rn "4.9\|Marko\|loved by early lifters" src/` returns nothing
        outside `primitives.tsx`'s default parameter, and neither screen has a gap where the
        proof was. Today it still returns the two paywall call sites.

- [ ] **A2 · The day-5 reminder row.** `src/app/paywall.tsx:57–61` promises an email nothing
      sends. Recommended minimal fix: **delete the middle timeline row**, leaving Today →
      Day 7. The two remaining rows still carry the honest first-charge date, which is what the
      row was there to establish. Building the reminder instead is **RULING R1** — it needs
      notifications (D3) or an email backend, and both are tiers below this one.
      - *Acceptance:* every sentence rendered by `TIMELINE` is kept by code that exists today.

- [ ] **A3 · Terms and Privacy are dead text.** `src/app/paywall.tsx:275–278` renders `Terms` and
      `Privacy` styled as links **with no `onPress` and no URL** — the only two words on a
      subscription screen that App Review checks by tapping. There are also no hosted pages to
      point at.
      1. Write both documents (a subscription EULA — Apple's standard EULA is acceptable and is
         the smaller job — and a privacy policy that matches what §7.3 actually does: note text
         to the edge function, never logged, no third-party analytics SDK).
      2. Host them at stable URLs.
      3. Wire both with `Linking.openURL`, ≥ 44 pt targets (`HIT`), and put the same two links in
         You → Privacy beside "How parsing works".
      4. The URLs also go into App Store Connect (C4) — the same pages, not different ones.
      - *Acceptance:* both links open in the browser from the paywall and from You, on a device.

- [ ] **A4 · Fix the four doc divergences** from §2 in `CLAUDE.md`, in the same commit as the
      code above where they overlap (§0.3). X1 waits on **R2**.

---

## 4. Tier 1 — nothing can be charged

**Blocks revenue.** The screen exists and is honest after tier 0; nothing behind it moves money.

- [ ] **B1 · App Store Connect groundwork.** Not code, and it gates B2, so it goes first.
      Two auto-renewable products (`$59.99/year` with a 7-day introductory free trial, and
      `$8.99/month` with none), one subscription group, one entitlement, localised metadata, the
      paid-apps agreement and banking, and **enrolment in the Apple Small Business Program** —
      §2.1's whole margin (15% vs 30%, ≈ $4.25/mo net) assumes it, and it is not automatic.
      - *Acceptance:* both products show "Ready to Submit" and the sandbox tester exists.

- [ ] **B2 · Wire RevenueCat.** `react-native-purchases` is the only new dependency this plan
      adds, and it needs the ask §0.2 requires before it is installed.
      - One entitlement, resolved at session start and cached, **never mid-set and never on a
        write** (§12.2).
      - **Verification failure assumes entitled** and re-checks later. A false positive costs one
        session of revenue; a false negative costs a customer.
      - The paywall CTA still hands off to sign-in first — the trial attaches to an account.
      - Prices on the paywall come from the store product, not from the `ANNUAL_PRICE` /
        `MONTHLY_PRICE` constants, or the two drift the first time pricing or storefront changes.
      - Requires a dev build; it will not run in Expo Go.
      - *Acceptance:* a sandbox purchase, a restore and a cancel all verified on a device.

- [ ] **B3 · Make Restore real.** `src/app/paywall.tsx:115–120` and
      `src/app/(tabs)/you.tsx:245–251` are both alerts that explain the stub. Replace with the
      real restore, and keep the message honest when it finds nothing.

- [ ] **B4 · Route the lapsed state.** `src/components/read-only-ledger.tsx` is finished and
      **has zero importers** — verified. Give it the entitlement state that reaches it: expired
      → read-only ledger, **export still complete and still free** (§13, §20 — export is never
      gated, degraded or delayed), one line, one button back to the paywall.
      - *Acceptance:* toggling the entitlement in a sandbox account moves the app in and out of
        the lapsed surface without a reinstall.

---

## 5. Tier 2 — the app is not yet a shippable artefact

Everything here is real work that no amount of feature building removes.

- [ ] **C1 · The app icon is still the Expo template** — a blue chevron on a grid
      (`assets/images/icon.png`, and `ios.icon` points at `assets/expo.icon`, which contains
      `expo-symbol 2.svg`). The Android adaptive background is `#E6F4FE`, a template blue that
      belongs to no palette in this app. Also `app.json:name` is `"recore"` lowercase — that
      string is the home-screen label.
      - Design the icon and wordmark on the §5.1 palette (warm paper, ink; green only if it is a
        planned value, which on an icon it is not — so almost certainly no green at all).
      - Replace `icon.png`, the three Android layers, `favicon.png`, `splash-icon.png`; set the
        adaptive background to `bg` `#F4F5EF`; set `name` to `Recore`.
      - Delete `assets/images/expo-logo.png`, `expo-badge.png`, `expo-badge-white.png`.
      - *Acceptance:* no Expo template asset remains and the home-screen label reads `Recore`.

- [ ] **C2 · There is no build pipeline.** No `eas.json` exists, so there is no internal build
      and no TestFlight path — `ios/` is a local prebuild only.
      - `eas.json` with `development`, `preview` (internal distribution) and `production`.
      - One successful `production` build, uploaded to TestFlight, installed on a real device.
      - *Acceptance:* the app runs from TestFlight, Apple sign-in works, dictation works — the
        three paths Expo Go cannot test (§3).

- [ ] **C3 · Privacy nutrition labels + the plain-English page.** Declare exactly what §7.3 and
      §10 do: account identifier and training content, linked to the user, not used for
      tracking, no third-party analytics SDK. Turn "How parsing works"
      (`src/app/(tabs)/you.tsx:253–259`) from an `Alert` into a real page carrying the same
      sentences plus the two A3 links.

- [ ] **C4 · Store listing.** Screenshots **built from real logged sessions, never mockups**;
      title, subtitle and keywords from the keyword research §2.1 asks for (that research is the
      cheapest open question in the project and is worth doing before the copy); the description;
      the two A3 URLs; review notes explaining the hard paywall, the 7-day trial and the account-
      last funnel, to pre-empt a 3.1.1/3.1.2 rejection.

- [ ] **C5 · The two release passes** (§17). An **airplane-mode session start to finish** on a
      real device, then sync. A **cold install timed to "trial started"**. Both on the TestFlight
      build from C2, both written down.

- [ ] **C6 · Export a file, not a message body.** `src/app/(tabs)/you.tsx:221` passes the whole
      CSV as `Share.share({ message })`, which reaches Mail and Notes and cannot be saved to
      Files. Write it with `expo-file-system` and share via `Sharing.shareAsync` with
      `text/csv`, exactly as `session-receipt.tsx:297` already does for PNG. Small task, and it
      is the one promise §20 says may never be degraded.

---

## 6. Tier 3 — a complete first release

Not submission blockers once tier 0 is clean, but each is a refund reason on a paid app.

- [ ] **D1 · Delete account.** `src/app/(tabs)/you.tsx:261–267` is an alert that promises
      deletion "within 30 days" and does nothing. Needs a real path: wipe local rows, delete the
      remote rows under RLS, sign out. Apple requires in-app account deletion where accounts can
      be created in-app — this is closer to tier 0 than its position suggests, so if review
      flags it, it moves up.

- [ ] **D2 · JSON export**, including `raw_text` — the CSV loses the user's own words, and their
      words are the record (§1.1). Free on a lapsed subscription like every other export.

- [ ] **D3 · Notifications, at all.** `expo-notifications` is not installed. This gates the A2
      reminder if **R1** goes that way, and gates all of §16.1. When it happens: permission asked
      at a moment that has just explained why, never re-asked after denial, **at most one a day**,
      and no guilt copy ever (§15).

- [ ] **D4 · Instrument the funnel locally** (§2.1) — in `meta`, never a third-party SDK:
      onboarding step reached, paywall shown, trial started, sessions in the first seven days,
      repair rate, adherence shown vs followed, and **whether the user imported**. That last flag
      splits every trial-window number and is the most informative split in the first six months.
      Cheap to add now, impossible to backfill later.

---

## 7. Block E — onboarding v2 (`recore-onboarding-v2-spec.md`)

Fifteen screens, thirteen decisions, account still last. The spec's own condition is the whole
thing: **every question must change a later screen, an engine default, or a line on the
paywall.** A question that changes nothing is deleted, not kept for analytics.

**Where this sits.** After **C**, not before it — an onboarding that converts better is worth
nothing while nothing can be charged (**B**) and the app cannot be submitted (**A**, **C**).
**D1** (account deletion) still outranks it, because Apple requires that and this is a bet.
Inside the block, do E0 → E4 → E1 before anything else: two of the new screens make claims the
code does not currently keep, and shipping them in the wrong order repeats §12.1 exactly.

**Read this before writing a line of it.** Verified in the tree on 28 July:

> `goal` is written by onboarding step 2 and **read by nothing**. `src/lib/predict/engine.ts`
> has zero imports (§1.1 invariant 3) and infers the rep range from what the athlete actually
> did — `top = max reps today`, `bottom = top − 2`, falling back to 6–8 (`engine.ts:67–72`).
> Focus is, today, precisely the decorative question the spec's research warns about; its own
> subtitle admits it ("This only tunes examples and wording").

So the spec's step 5 ("focus sets the default rep-range width the engine reads") is **an engine
change, not a copy screen** — and the screen must not exist before the change does.

- [ ] **E0 · RULING R5 first.** §0.1's "Nine onboarding steps. Not sixteen" is superseded by
      this spec. Record the date and reason in Appendix C and update §0.1 and §11 in the same
      change, or do not start the block (`CLAUDE.md` §0.1, and the spec's own opening line).

- [ ] **E1 · Make focus real** (spec step 5's precondition, and the fix for today's step 2).
      Focus chooses the **default rep-range width** the engine falls back to when history cannot
      infer one — strength narrow and low, hypertrophy wider and higher, hybrid unchanged.
      - `engine.ts` **stays pure and import-free**: the width arrives as a field on the history
        object that `src/lib/predict/data.ts` assembles, exactly like `incrementKg` does. Reading
        `prefs` from inside the engine breaks §1.1 invariant 3 and is not an option.
      - Inferred-from-performance still wins where there is performance to infer from. This
        changes the **fallback**, not the rule.
      - A test per width, plus one that proves an athlete with history is unaffected.
      - *Acceptance:* changing focus changes a prescription for a lift with no rep history, and
        `npm test` covers each branch.

- [ ] **E2 · The two honest new copy screens** — spec step 2 ("what this replaces", the two-column
      mono comparison) and spec step 7 ("the objection answered"), which are true today and need
      no new state. **Except the Hevy/Strong variant of step 7**, which promises "your history
      comes over in the first minute" — untrue while import lives in You (X1). That variant waits
      on **R2**; the other three tracker variants can ship now.
      - Step 5's card ships here too, but only after E1, and it must describe what E1 actually
        built.

- [ ] **E3 · The primary lift** (spec step 10). New pref `pref_primary_lift`, free text with four
      suggestions, resolved through the real `findExerciseByName` — **read-only, never creates an
      exercise row** (§9's rule for `plan-day` applies here for the same reason). It must earn its
      place in all three ways the spec names: the step-9 demo uses it, the ready ghost is computed
      for it where history allows, and it sorts first in Lifts on the first open
      (`src/lib/db/lifts.ts`). If the name does not resolve, the app says nothing and moves on
      (§1.1 invariant 6).

- [ ] **E4 · Attribution** (spec step 13). New pref, five options, labelled as telemetry rather
      than dressed as personalisation. Reads out through **D4**. It is the only attribution signal
      that survives SKAdNetwork under ASO-first distribution.

- [ ] **E5 · Sessions in a normal week** (spec step 11). **Blocked on R3** and the spec says so:
      if the streak keeps counting consecutive days, this question changes nothing and becomes the
      decorative question the research warns about. Do not build it before the streak's unit is
      ruled.

- [ ] **E6 · The paywall headline mirrors an answer.** The highest-value item in the spec and it
      costs a string interpolation. Computed in priority order: imported → their real counts;
      primary lift named → that lift; neither → the exercises their own demo line produced. Never
      a claim about Recore.
      - This is **not** a refill of the slot A1 empties (§12.1 forbids that) — it is the headline,
        computed from the user's own data. Keep the proof slot empty.

- [ ] **E7 · Instrument every step** (needs **D4**). `onboarding_step_reached` becomes
      load-bearing: last step reached per install, read weekly. **A step that loses more than ~10%
      of the people who reach it is cut, not redesigned.** The spec expects two of the five new
      screens to die this way and calls that the flow working — so ship the block expecting to
      delete part of it, and record the counterweight it records honestly: at least one published
      case removed a loading beat and saw trial conversion *rise*.

- [ ] **E8 · Fold the spec into `CLAUDE.md` §11** and delete `recore-onboarding-v2-spec.md`. Two
      documents describing one funnel is how v3 happened.

---

## 8. Tier 4 — after the first charge

Named so they are not rediscovered as bugs, and explicitly **not** to be started before tier 3 is
empty (`CLAUDE.md` §19).

- Live Activity / Dynamic Island for the rest timer.
- **The annual record and the renewal notice** (§16.1) — year two is the business, and nothing in
  the repo addresses month eleven. Both depend on D3. First renewal is ≥ 12 months after the
  first charge, which is the only reason this sits here rather than in tier 3.
- Per-exercise settings (rep range, increment, rest).
- `TopBar`'s settings avatar, which now duplicates the You tab.
- Comparison sublines that name a date instead of "vs last".
- Android: tab-bar icons (`(tabs)/_layout.tsx` ships iOS SF Symbols only, deliberately), plus a
  full pass. iOS is the design target and Android follows.

---

## 9. Rulings the owner owes — do not build either branch

- **R1 · The day-5 row.** A2 recommends deleting it. The alternative is building the reminder,
  which means D3 first and moves a tier-3 dependency in front of submission. → *unanswered*

- **R2 · Import timing** (`CLAUDE.md` §18 open decisions, X1 above, **and now E2**). The
  onboarding spec's step 7 promises a Hevy/Strong user that "your history comes over in the first
  minute" and preselects import at step 14 — which is option 1 below, chosen implicitly. Answer
  this before that screen is written, or it ships as a claim the code does not keep. §11.1 argues that an
  importer reaching the paywall with their own history and a computed prescription is the
  strongest conversion asset in the product, and that **it is what makes a 7-day trial
  sufficient** — a lifter starting empty hits a given lift twice in seven days, so the predictor
  gets one late shot at being right. The code does not do this and the 28 July ruling put import
  after the paywall. Three ways out, and they are not equal:
  1. Build the inline import branch in onboarding (a real screen; conversion upside; contradicts
     the 28 July ruling).
  2. Keep the code and **delete the §11.1 claim** — then accept that the 7-day trial argument
     loses its support and may itself need revisiting.
  3. Import stays in You, but the ready screen links to it before the paywall.
  → *unanswered*

- **R3 · The streak's unit** (§16.2, **and now E5**). It currently counts **consecutive days**
  (`src/lib/db/workouts.ts:76–104`), which §20 forbids as a daily goal that punishes a programmed
  rest day. Either it counts weeks against a target the user set, or §20 loses that clause. This
  is a contradiction inside `CLAUDE.md`, not a missing feature, and it must not be resolved in
  code. The onboarding spec's step 11 has no reason to exist until this is answered.
  → *unanswered*

- **R4 · Keyword research before the store copy** (§2.1). Not a build decision — a decision about
  whether to spend an afternoon on it. Six hundred installs a month is the requirement, and C4's
  title and subtitle are written once and then rarely change. → *unanswered*

- **R5 · The step count.** `recore-onboarding-v2-spec.md` replaces "nine onboarding steps" with
  fifteen screens carrying thirteen decisions. §0.1 lists the nine-step ruling as owner-decided,
  and the spec's own first line says to record the change in Appendix C **or not to merge it**.
  Nothing in block E starts until this line exists. → *unanswered*

---

## 10. Log

One line per completed task: `<date> · <id> · <what changed> · <gates>`

```
28 Jul · — · Onboarding visual pass on the existing nine steps: fabricated proof deleted from
              the ready screen (§12.1), setup echo rebuilt as a labelled ledger card, bounded
              step counter, selection state without layout shift, unified card radii, fixed
              heights → minHeight (§14) · typecheck + 64 tests + lint + expo export all pass
```

---

## 11. Deviations

Disagreement with `CLAUDE.md` goes here, not into the code (§0.2 — one paragraph, then stop).

```
### <date> · §<section> · <task id>
What the document says:
What I think is wrong:
What I recommend instead:
Status: proposed | accepted | rejected
```

*(none yet — the four in §2 are divergences found in the tree, not disagreements with the rules)*
