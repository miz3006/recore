# PLAN.md — what is left to build

**Version 2 · 28 July 2026 · Supersedes the v3 execution plan (derived from the retired
`CLAUDE.md` v3 §22, which described work that was rejected and rolled back).**

> **28 July, second pass.** Tier 0 is closed (A2c included — the owner approved
> `expo-notifications`). Tier 2's code is done. Tier 3 is down to **D3**. **Block E is
> complete** and its spec has been folded into `CLAUDE.md` §11.0 and deleted.
>
> **What is left is one code task and one afternoon of Apple.** The code task is **B2/B3**
> (RevenueCat), which the owner deferred until App Store Connect exists — the right order,
> since a sandbox purchase is impossible before the products do. The rest is **B1** and the
> owner-only parts of tier 2 (App Store Connect, the TestFlight build, screenshots, the two
> release passes), all written out in `RELEASE.md`. **D3** waits behind the first charge by
> §19.
>
> Every completed task is logged in §10 with its gates; §11 records the one deviation.

Derived from `CLAUDE.md` v4 §18–§19 **and from a read of the working tree on 28 July 2026**.
Where the two disagreed, the tree won and the disagreement is recorded in §2 rather than
silently resolved (`CLAUDE.md` §0.3).

`recore-onboarding-v2-spec.md` (owner, 28 July) was integrated as **block E** in §7 and, once
the block was built, **folded into `CLAUDE.md` §11.0 and deleted** (E8) — two documents
describing one funnel is how v3 happened. R5 is recorded in Appendix C.

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

*(The table below is the baseline as it stood **before** the tier-0/2/3 build of 28 July. After
that work: `npm test` is **83/83 across 9 files**, the bundle is 5.56 MB, and typecheck, lint
and export all still pass. §10 logs each task.)*

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
| **X1** ✅ | §11.1: "the Hevy/Strong branch imports CSV **inline, inside onboarding**", and `recachePredictionFromLatest` makes the ghost real on the ready screen — called "the strongest conversion asset in the product" and "load-bearing for the business" | Onboarding step 3 only **records which tracker you use** (`setObTracker`). It never imports. `pickAndImportCsv` and `recachePredictionFromLatest` are called **only from `(tabs)/you.tsx`** | `src/app/onboarding/index.tsx:472–480`, `src/app/(tabs)/you.tsx:182,177` | **Closed 28 Jul by R2**: import is offered after sign-in, onboarding only says it exists. §11.1 rewritten — the code was already right |
| **X2** ✅ | §18 Tier 2: "the You screen's 'arrives with …' alerts on Smallest plate, Default rest, Writing language, the privacy page, exports, Terms, Privacy and Contact" | Smallest plate, Bar weight, Writing language and Focus are **real inline segmented editors**; export and import are **real**; there are no Terms / Privacy / Contact rows at all. Only **Restore purchases** and **Delete account** are alerts, and "How parsing works" is an alert rather than a page | `src/app/(tabs)/you.tsx:319–425` | **Closed 28 Jul.** Delete-account is real (D1), "How parsing works" is a page and Terms / Privacy rows now exist beside it (A3/C3). §18 rewritten: **Restore is the only stub left on that screen** |
| **X3** ✅ | §12.1: the paywall promises "an in-app reminder two days before the charge" | The row says **"We email you before the trial ends."** There is no notification system **and no email system** — the claim is untrue twice over | `src/app/paywall.tsx:57–61` | **Closed 28 Jul by A2a + A2b.** The row now describes the in-app reminder that ships, and the reminder exists and is tested. §12.1 rewritten |
| **X4** ✅ | §13: export is "shared via the system sheet … which is why `expo-sharing` is used" | PNG share does use `expo-sharing`; **CSV export uses `Share.share({ message: csv })`** — the whole CSV as a message body, not a file | `src/app/(tabs)/you.tsx:221` vs `session-receipt.tsx:297` | **Closed 28 Jul by C6.** Both formats write a real file and go out through `Sharing.shareAsync`. §13 rewritten |
| **X5** ✅ | §12.1 and A1 both name **two** fabricated-proof call sites (paywall + onboarding) | There were **three** — `src/app/sign-in.tsx:74` carried the same `<Rating score={4.9} countLabel="loved by early lifters" />`, and no document mentioned it | `src/app/sign-in.tsx:74` | **Found and closed 28 Jul** by running A1's acceptance grep instead of trusting the list. Both documents corrected. The general lesson: **an acceptance line that is a command finds things a sentence does not** |

---

## 3. Tier 0 — the app says things that are not true

**CLOSED 28 July 2026.** Every item below is done except A2c, which is the *upgrade* to a
built floor rather than an outstanding claim, and which needs a dependency ask.

**Blocks App Store submission.** These were the only items in this file that were *wrong*
rather than unfinished (`CLAUDE.md` §18), and A3 was a rejection under App Review 3.1.2, not a
matter of taste.

- [x] **A1 · Delete the fabricated social proof.** No real reviews exist, so both the score and
      the testimonial are invented. **Done 28 July — and it was not half done, it was two
      thirds done: the acceptance grep found a THIRD call site this plan never listed.**
      - [x] `src/app/paywall.tsx:189–191` — the `<Rating score={4.9} countLabel="loved by early lifters" />` block and its `ratingWrap` style.
      - [x] `src/app/paywall.tsx:217–221` — `<Testimonial … who="Marko · powerlifting" />` and its `testimonial` style.
      - [x] **`src/app/sign-in.tsx:74` — the same fabricated `<Rating>`, under the subline.**
        Not in this plan, not in `CLAUDE.md` §12.1, and found only because A1's acceptance was
        written as a `grep` rather than a sentence. The lesson is worth more than the fix:
        **write acceptance as a command.** Deleted with its `ratingWrap` style; the space is
        not refilled, exactly as on the other two screens.
      - [x] `src/app/onboarding/index.tsx` — the hardcoded `testimonial` object, the `<Rating>` and
        the `<Testimonial>` on the ready screen, deleted 28 Jul with the visual pass. The space was
        not refilled; the setup echo that was already on that screen took the room.
      - **Keep `Rating` and `Testimonial` in `src/components/primitives.tsx`** — §12.1 rules that
        the star row waits in the codebase for a real App Store Connect score. Only the call
        sites go.
      - **Do not refill either space.** No badge, no install count, no "trusted by early
        lifters". The headline moves up against the subline; that is the finished state.
      - *Acceptance:* `grep -rn "4.9\|Marko\|loved by early lifters" src/` returns nothing
        outside `primitives.tsx`'s default parameter, and no screen has a gap where the proof
        was. **Verified 28 July:** the only remaining hits are `primitives.tsx`'s default
        parameter, a comment in `paywall.tsx` recording the deletion, and the unrelated
        "Marko?" example in `prefs.ts`'s doc comment.

- [ ] **A2 · The day-5 reminder — build it** (R1, ruled 28 July: the row stays and the code grows
      up to it). It splits, because part of it cannot exist before there is a trial to remind
      about. **A2a and A2b done 28 July; A2c waits on the owner's dependency ask.**
      - [x] **A2a · The copy, now.** The row now reads *"Recore reminds you in the app — the
            date, the amount, and how to cancel."* — which is precisely what A2b does.
      - [x] **A2b · The in-app reminder — the floor.** `src/lib/billing/trial.ts` is the clock
            (pure, zero imports, **9 tests**: day 0–4 quiet, day 5 owes it and is exactly two
            days before the charge, day 6 still owes it, the charge lands at 7×24h, a backwards
            clock never owes it early, shown at most once).
            `src/components/trial-reminder-sheet.tsx` is the surface, mounted on Today, carrying
            the real date, the real amount and the manage link. **No permission needed.**
            - It is **inert until `startTrial()` is called**, and only billing can honestly call
              it — a trial no store knows about is a fiction. That single function in
              `src/lib/billing/state.ts` is the whole of what B2 has to wire for this to fire.
            - The plan said this "lands with B2". It did not have to: everything except the one
              call site is independent of the dependency, and building it now means B2 is a
              two-function change instead of a feature.
      - [x] **A2c · The notification — the upgrade.** **Owner approved the dependency 28 July;
            built the same day.** `expo-notifications ~0.32.17`, one local notification
            scheduled at trial start for day 5.
            - Permission is asked on `trial-started-sheet.tsx` — the one surface allowed to ask,
              shown on the first open after a trial starts, **after** it has said what the
              reminder is for. Never in onboarding: a prompt asked before the user knows what
              the app is gets denied, and the good use of it is gone for the life of the install.
            - **Never re-asked.** `canAskAgain` is checked and a local flag records that we have
              asked once, so no future flow can nag.
            - **At most one reminder:** `markTrialReminderShown()` cancels the pending
              notification, so the sheet and the banner never say the same three facts twice.
            - No guilt copy — the date, the amount, and where to cancel. "Not now" costs the
              user nothing and the sheet says so, because the in-app floor is untouched by it.
      - *Acceptance:* a sandbox trial started on a device produces the in-app reminder on day 5
        with notifications **denied**, and the notification as well when granted. **Owner-run,
        and it needs B2 first** — like A2b, the whole path hangs off `startTrial()`.

- [x] **A3 · Terms and Privacy are dead text.** **Done 28 July**, with one deviation recorded
      in §11: they open an in-app page rather than a browser.
      1. [x] Both documents written in `src/lib/legal.ts` — a Terms of Use carrying every
         auto-renewable disclosure Apple requires plus a pointer to Apple's Standard EULA, and
         a privacy policy that matches what §7.3 actually does. Every factual claim in them was
         checked against the code, including the one the old doc never made: **the parse
         function forwards note text to Anthropic**, and a user deciding whether to type into
         this app is entitled to know that.
      2. [x] `scripts/build-legal-html.ts` writes the same text to `docs/` as static pages
         (`npm run build:legal`), ready for GitHub Pages. One source, so the hosted copy and
         the in-app copy cannot drift.
      3. [x] Wired from the paywall **and** from You → Privacy, each a real ≥ 44 pt target
         (they were inline `<Text>` before, roughly 14 pt of tappable height).
      4. [ ] **OWNER:** publish `docs/`, then put the two URLs into App Store Connect
         (`RELEASE.md` §4) and set `HOSTED_BASE_URL` in `src/lib/legal.ts`.
      - *Acceptance:* both links open the document from the paywall and from You. **The
        original line said "in the browser"** — see the deviation in §11.
      - **Three strings in `legal.ts` are the owner's to set before submission**: `SUPPORT_EMAIL`
        (a mailbox that is actually read — App Review checks that support replies),
        `PUBLISHER` and `GOVERNING_LAW`. They are grouped at the top of the file under a loud
        comment and are listed first in `RELEASE.md`.

- [x] **A4 · Fix the doc divergences** from §2 in `CLAUDE.md` (§0.3). Done 28 July with the three
      rulings: §11.1 rewritten (X1), §18's You-screen bullet corrected (X2), §12.1's reminder
      rewritten (X3), §0.1 given three new rows, §16.2 resolved, §18's open-decisions list reduced
      to the step count, §19 reordered, Appendix C given three rows. **X4 stays open** — it is a
      code task (C6), not a doc line.

---

## 4. Tier 1 — nothing can be charged

**Blocks revenue.** The screen exists and is honest after tier 0; nothing behind it moves money.

**This is now the only tier with open code**, and it is two functions plus an owner's afternoon
in App Store Connect. B4 is done; B1 is drafted in `RELEASE.md` and needs credentials; B2 and
B3 need the `react-native-purchases` ask (§0.2) and land in `resolveEntitlement()` and
`startTrial()`, both of which already exist with everything downstream wired.

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

- [x] **B4 · Route the lapsed state.** **Done 28 July.** `read-only-ledger.tsx` had zero
      importers and rendered three invented sessions; it now reads the real ledger
      (`getRecentSessions`) and is reached by `useEntitlement() === 'lapsed'`, which replaces
      the composer on Today and **nothing else** — Lifts, Progress and You stay untouched,
      because locking the record behind a paywall after the fact is the move this app was built
      not to make. Export is a first-class button there, JSON and complete.
      - The entitlement resolves **once per session** in `AuthProvider` and is cached (§12.2).
        With no store to ask it resolves to `entitled`, which is that section's own rule for an
        unverifiable entitlement rather than a stub.
      - It also lost its font-size literals on the way through (§17).
      - *Acceptance:* toggling the entitlement in a sandbox account moves the app in and out of
        the lapsed surface without a reinstall. **Not verifiable until B2** — until then the
        `__DEV__` toggle in You → Dev is the way in, and it compiles out of release bundles.

---

## 5. Tier 2 — the app is not yet a shippable artefact

Everything here is real work that no amount of feature building removes. **All the code is
done as of 28 July**; what is left in this tier is an Apple account, a device and an
afternoon — see `RELEASE.md`.

- [x] **C1 · The app icon is still the Expo template.** **Done 28 July.** The mark is one
      letter in the app's own voice — SF Pro Bold, ink `#171914` on warm paper `#F4F5EF`, over
      the ledger rule it is written on. **No green**, because an icon is not a planned value.
      - It is generated by `scripts/build-icon.py` (`npm run build:icon`) rather than exported
        from a design tool, so the icon has a source of truth in the repo and the next change
        is an edit rather than a guess. python3 + Pillow on a dev machine; **nothing in
        `package.json` changes and nothing is bundled**, so this is not the new dependency
        §0.2 gates.
      - `icon.png`, the three Android layers, `favicon.png` and `splash-icon.png` all
        regenerated; adaptive background `#F4F5EF`; `app.json:name` → `Recore`; `ios.icon`
        (which pointed at the Expo `.icon` bundle) removed so iOS uses the real PNG.
      - Deleted: `assets/expo.icon/`, `expo-logo.png`, `expo-badge.png`, `expo-badge-white.png`
        **and four more the plan did not list** — `react-logo{,@2x,@3x}.png`, `tutorial-web.png`,
        `tabIcons/` and `logo-glow.png` (a blue radial glow belonging to no palette here). All
        were unreferenced, and the acceptance line says *no* template asset remains.
      - *Acceptance:* met — `assets/images/` holds six files, all generated by the script.

- [x] **C2 · There is no build pipeline.** **`eas.json` done 28 July** — `development` (dev
      client, internal), `preview` (release build, internal distribution) and `production`
      (store, `autoIncrement`), plus a `submit` block.
      - [ ] **OWNER:** `eas login && eas init`, register the two `EXPO_PUBLIC_SUPABASE_*`
        values as EAS env vars (an EAS build cannot see `.env`), then build and submit. Exact
        commands in `RELEASE.md` §3.
      - *Acceptance:* the app runs from TestFlight, Apple sign-in works, dictation works — the
        three paths Expo Go cannot test (§3). **Owner-only; needs Apple credentials.**

- [x] **C3 · Privacy nutrition labels + the plain-English page.** **The page is done 28 July**:
      "How parsing works" is a real document on `/legal`, carrying the same sentences the alert
      did plus the Privacy and Terms links, and You → Privacy now lists all three.
      - [ ] **OWNER:** the App Privacy answers themselves are entered in App Store Connect.
        They are written out row by row in `RELEASE.md` §4, derived from what the code does:
        email, name, user id and training content, all **linked to the user, App Functionality,
        never tracking**; no analytics, no diagnostics, no advertising identifier.

- [x] **C4 · Store listing.** **Drafted 28 July in `RELEASE.md` §5** — title, subtitle,
      promotional text, the full description, a keyword line, and the review notes that
      pre-empt a 3.1.1/3.1.2 rejection by explaining the hard paywall, the 7-day trial, the
      account-last funnel, in-app deletion and free export.
      - [ ] **OWNER:** screenshots **from real logged sessions, never mockups** — which needs
        the TestFlight build from C2 and a real week logged in it. Title and keywords stay
        drafts until **R4** is answered.

- [x] **C5 · The two release passes** (§17). **The protocol is written down** in `RELEASE.md`
      §6, with a blank line for the date and the result of each.
      - [ ] **OWNER:** run both on the TestFlight build and fill them in. An agent cannot put a
        phone in aeroplane mode.

- [x] **C6 · Export a file, not a message body.** **Done 28 July** — `src/lib/export-share.ts`
      writes to the cache directory with `expo-file-system` and shares via `Sharing.shareAsync`
      with a real mime type and UTI, exactly as `session-receipt.tsx:297` does for the PNG. It
      names the file `recore-export-<date>.<ext>`, so it means something in Files. Both formats
      go through it, so **X4 in §2 is closed** and `CLAUDE.md` §13 is now true.

---

## 6. Tier 3 — a complete first release

Not submission blockers once tier 0 is clean, but each is a refund reason on a paid app.
**D1, D2, D4 and D6 are done as of 28 July. D3 is the only one left, and it waits on a
dependency ask.**

- [x] **D1 · Delete account.** **Done 28 July**, and it is immediate rather than "within 30
      days". `supabase/functions/delete-account/` deletes the caller's `auth.users` row with the
      service-role key — every table in the schema references it `on delete cascade`, so one
      statement takes the whole account. `src/lib/account/delete.ts` then wipes the device and
      signs out.
      - **Order matters and it is the opposite of the intuitive one: the server first.** Wiping
        the phone first would leave a user with no copy AND a live account if the call failed.
      - The identity deleted comes from the verified JWT, never from a body — the same rule the
        parser follows, and the whole reason this cannot delete someone else's account.
      - The confirmation offers the export first and does not try to talk anyone out of it (§20).
      - [ ] **OWNER:** `supabase functions deploy delete-account` (it is not deployed yet).

- [x] **D2 · JSON export.** **Done 28 July.** `src/lib/export-json.ts` carries `raw_text` — the
      user's own words, which the CSV necessarily loses — plus the structure read out of it, the
      corrections, the shorthands, the plan, the predictions, the preferences and the D4
      counters. It is listed **first** on the You screen, because it is the complete one. Free
      on a lapsed subscription like every other export, and offered from the read-only surface
      itself.

- [ ] **D3 · Notifications beyond the trial reminder.** `expo-notifications` arrives with **A2c**,
      not here — R1 pulled the first one forward into tier 0. What stays in this tier is everything
      built on top of it: §16.1's renewal notice and the annual record, and any training-day nudge.
      The rules do not change: permission asked at a moment that has just explained why, never
      re-asked after a denial, **at most one a day**, and no guilt copy ever (§15).

- [x] **D6 · The streak counts training days** (R3). **Done 28 July.** The rule lives in
      `src/lib/streak.ts` — pure, zero I/O, **11 tests**: Mon/Wed/Fri = 3, the streak survives
      today being a rest day, a two-week layoff = 0, a same-day double counted once, future days
      ignored, and both sides of the boundary (exactly seven days still counts, eight does not).
      `computeStreak` is now only the query that feeds it.
      - `daysBetween` was added to `db/dates.ts` and computes **in UTC on purpose** — a
        local-time subtraction across a DST boundary is 23 or 25 hours and would round to the
        wrong day exactly twice a year.
      - `StreakSheet`'s own `longestStreak` counted calendar days too and would have contradicted
        the new number; it now reads the same module. Copy in the sheet and the top bar says
        **training days**, and the footnote says what actually breaks it.
      - The gap tolerance stays a fixed week. Do not add a setting.

- [x] **D4 · Instrument the funnel locally** (§2.1). **Done 28 July** — `src/lib/funnel.ts`, in
      the `meta` KV, no SDK, nothing leaves the device. Every event asked for is wired at the
      place it actually happens: `setObStep` (so no future step can forget it), the paywall's
      mount, `startTrial`, a successful import, `parseWorkout`, `applyCorrection`, and
      `settlePredictionOutcome`.
      - Two counting decisions worth stating, because both are easy to get silently wrong:
        **parsed items are counted only on a fresh model result**, not inside `applyParseResult`
        which also runs on a cache hit and on a correction rebuild; and **adherence is counted
        only the first time a prediction settles**, since it re-settles on every parse of the day.
      - The counters ride out in the JSON export and are described in the privacy policy — a
        user can read exactly what is counted about them, which is the condition on measuring
        anything at all in an app with this §20.
      - `first_open_at` is stamped too, so "sessions in the first seven days" is derivable from
        the export rather than needing its own counter.

---

## 7. Block E — onboarding v2 · **COMPLETE, 28 July 2026**

Every task below is done. The flow is **fourteen screens, seven of which ask something**, and
it lives in `CLAUDE.md` §11.0 now — this section is the build record, not the spec.

**Fourteen screens, twelve decisions**, account still last — the spec says fifteen and thirteen;
step 11 was deleted by R3 the day the spec arrived (see E5), which is the condition working
rather than a cut. That condition is the whole thing: **every question must change a later
screen, an engine default, or a line on the paywall.** A question that changes nothing is
deleted, not kept for analytics.

**Where this sits.** After **C**, not before it — an onboarding that converts better is worth
nothing while nothing can be charged (**B**) and the app cannot be submitted (**A**, **C**).
**D1** (account deletion) still outranks it, because Apple requires that and this is a bet.
Inside the block, **E0 first, then E1 before E2**: E2's step 5 describes a rep-range default that
E1 has to build first, and shipping the screen ahead of the behaviour repeats §12.1 exactly.

**Read this before writing a line of it.** Verified in the tree on 28 July:

> ~~`goal` is written by onboarding step 2 and **read by nothing**.~~ **Fixed 28 July by E1.**
> `goal` now sets `defaultRepRange` — the range `engine.ts` falls back to when a lift has no
> reps to infer one from (3–5 / 8–12 / 6–8). The engine still has zero imports (§1.1 invariant
> 3); the value arrives on the history object from `data.ts` and `db/strip.ts`. Inference from
> real performance still wins wherever there is performance to read.

So the spec's step 5 ("focus sets the default rep-range width the engine reads") was **an engine
change, not a copy screen** — and the screen could not exist before the change did. **The change
exists now, so E2 may ship step 5's card, describing what E1 actually built and nothing more.**

- [x] **E0 · RULING R5 first.** **Answered 28 July: the spec supersedes the nine-step ruling.**
      Recorded in `CLAUDE.md` Appendix C, §0.1's row struck, and §11 rewritten in the same
      change. The block may start; the flow is **fourteen screens, twelve decisions**.

- [x] **E1 · Make focus real** (spec step 5's precondition, and the fix for today's step 2).
      **Done 28 July.** `FOCUS_REP_RANGE` in `engine.ts`: strength **3–5**, hypertrophy
      **8–12**, hybrid **6–8** — the range the engine falls back to when a lift has no rep
      history to infer one from.
      - `engine.ts` **stayed pure and import-free**: `defaultRepRange` arrives as a field on the
        history object, exactly like `incrementKg`. The `Focus` union is written out rather than
        imported from `prefs.ts`, and the call site is type-checked against `Goal`, so a drift
        is a compile error rather than a silently wrong prescription.
      - **Both** surfaces were fed it, not just one: `predict/data.ts` (the ghost) and
        `db/strip.ts` → `plan/prescribe.ts` (the plan strip). Feeding only the first would have
        had the two disagree about the reps for one exercise, which is worse than neither.
      - Inferred-from-performance still wins. This changed the fallback, not the rule.
      - **5 new tests** (88 total): a range per focus, an unanswered focus, the fallback firing
        only where there are no reps, an athlete with history unaffected, and one proving that
        omitting the field reproduces the old behaviour exactly.
      - Step 2's subtitle said *"This only tunes examples and wording"* — true, and the reason
        it was decorative. It now names what focus does, and each option shows its range.
      - *Acceptance:* met. With no rep history, `strength` prescribes 5 reps and `muscle` 12 at
        the same load; with history, focus changes nothing.

- [x] **E2 · The two honest new copy screens.** **Done 28 July**, and it turned out to be three:
      - **"What this replaces"** (screen 1) — the two-column mono comparison, six taps a set
        against one line a session. The only place in the product where a competitor's shape is
        drawn, and it is drawn **without naming one**.
      - **"What that focus changed"** (screen 4) — the receipt for the focus question, and it
        describes exactly what E1 built. **The spec's own card would have been dishonest**: it
        showed a lift with logged reps, and `repRange` reads the athlete's own reps whenever
        there are any, so the fallback never fires there. The shipped card is a lift with **no
        history yet**, which is the only case focus decides, and the last line says the rest.
      - **"The objection answered"** (screen 6) — tailored to the tracker. The Hevy/Strong
        variant **does not** say "your history comes over in the first minute" (R2); it says
        import is waiting the moment they are in, which is true.

- [x] **E3 · The primary lift.** **Done 28 July.** `pref_primary_lift`, free text with three
      suggestions, stored as **the words the user typed** — onboarding runs before there is an
      account, so the local `exercises` table is empty and there is nothing to resolve against
      yet. It resolves read-only where it is used, and **naming a movement never creates an
      exercise row**.
      - It earns its place in all three ways: the demo reads that lift, the ready screen echoes
        it, and it sorts first in Lifts **on the first open and only then** (a one-shot flag —
        after that recency is the truth and pinning would be the app overruling the record).
      - **It runs BEFORE the live demo, not after.** The spec ordered demo → lift while also
        requiring the demo to use the lift; the code cannot do both.
      - `demoNameFor` returns null under three characters, so a "bp" never reads back as "Bp" —
        the generic demo is the honest fallback (§1.1 invariant 6).
      - *The ready GHOST is not computed for it.* A prescription needs prior sets of that lift,
        and at this point in the funnel there is no account and no history. The app says
        nothing rather than inventing one.

- [x] **E4 · Attribution.** **Done 28 July.** `pref_ob_source`, five options, at screen 11 so it
      does not interrupt the value sequence. **Labelled as telemetry on the screen itself** —
      "this one is for us, not for you" — because dressing it as personalisation is the exact
      failure the rest of the block exists to avoid. Reads out through `funnel.ts`.

- [x] ~~**E5 · Sessions in a normal week** (spec step 11).~~ **Deleted 28 July by R3.** The streak
      now counts training days with a fixed week of gap tolerance, and nothing else in the app
      reads a weekly target — so this question would change nothing, which is precisely the
      decorative question the spec's own research says to delete rather than keep for analytics.
      The spec's step 11 does not get built, and the flow is fourteen screens.
      - The one way it comes back: if the gap tolerance is ever derived from the user's own
        frequency instead of fixed at a week. §8.2's zero-config rule argues against that, and
        D6 is written to read the frequency from the log rather than ask for it.

- [x] **E6 · The paywall headline mirrors an answer.** **Done 28 July** — `headlineFor()` in
      `paywall.tsx` over `db/ledger-size.ts`. Priority: a real record on the device → its own
      numbers ("412 sessions. 61 exercises. 14 months."); a named lift → that lift; neither →
      the app's own words. **Never a claim about Recore.**
      - Computed once on mount, so it cannot change under someone mid-read.
      - It is **not** a refill of the slot A1 emptied (§12.1 forbids that) — it is the headline.
        The proof slot stays empty.
      - The plan's first branch says "imported"; the code asks the broader and truer question,
        **"is there a record on this device"** — an importer and a returning subscriber both
        deserve their own numbers, and `hasImported()` would have missed the second.

- [x] **E7 · Instrument every step.** **Done 28 July.** `setObStep` records the high-water mark
      (no call site can forget it), `setObStepCount` records **how long the flow was at the
      time** — a bare "reached step 9" means nothing next quarter without it — and
      `markOnboardingCompleted` stamps the denominator. All three ride out in the JSON export.
      - The rule this exists to serve, restated so it is not softened later: **a step that loses
        more than ~10% of the people who reach it is CUT, not redesigned.** Two of the five new
        screens are expected to die this way, and that is the flow working.
      - The counterweight, recorded honestly: at least one published case removed a loading beat
        and saw trial conversion *rise*. Screen 12 is not exempt from the rule.

- [x] **E8 · Fold the spec into `CLAUDE.md` §11** and delete `recore-onboarding-v2-spec.md`.
      **Done 28 July** — §11.0 now carries the whole flow as a table, §11.0.1 what each new
      answer does, and §11.0.2 the two places the spec was deliberately not followed. The spec
      file is deleted.

---

## 8. Tier 4 — after the first charge

Named so they are not rediscovered as bugs, and explicitly **not** to be started before tier 3 is
empty (`CLAUDE.md` §19).

- Live Activity / Dynamic Island for the rest timer.
- **The annual record and the renewal notice** (§16.1) — year two is the business, and nothing in
  the repo addresses month eleven. Both depend on D3. First renewal is ≥ 12 months after the
  first charge, which is the only reason this sits here rather than in tier 3.
- Per-exercise settings (rep range, increment, rest).
- ~~`TopBar`'s settings avatar, which now duplicates the You tab.~~ **Removed 28 July** at the
  owner's request — it was a second door to a room that already has one.
- Comparison sublines that name a date instead of "vs last".
- Android: tab-bar icons (`(tabs)/_layout.tsx` ships iOS SF Symbols only, deliberately), plus a
  full pass. iOS is the design target and Android follows.

---

## 9. Rulings the owner owes — do not build either branch

- **R1 · The day-5 row.** → **ANSWERED 28 Jul: build the reminder.** The row stays. A2 is
  rewritten accordingly and splits three ways; the in-app reminder is the floor because it is the
  only version that stays true when a user denies notifications, and `expo-notifications` becomes
  the second new dependency the plan asks for. Recorded in Appendix C.

- **R2 · Import timing.** → **ANSWERED 28 Jul: import is offered after sign-in; onboarding says
  it exists and never performs one.** The code already did exactly this — step 3 names Strong and
  Hevy and states nothing is imported yet, and the ready screen offers import as the first action
  through checkout. §11.1 was rewritten and the false claim deleted (X1). Recorded in Appendix C.
  - **The consequence, stated once and not re-litigated:** §11.1's argument that the import branch
    "is what makes seven days sufficient" is gone with it. The trial stays at seven days (ruled
    twice), but a lifter starting empty rarely gets to see the predictor proved right inside the
    window. If trial-to-paid comes in low, **the first hypothesis to test is the window, not the
    paywall.**
  - **What this changes in block E:** spec step 7's Hevy/Strong variant may not promise "your
    history comes over in the first minute" during onboarding. It says import is waiting the
    moment they are in — which is true, and is the ruling.

- **R3 · The streak's unit.** → **ANSWERED 28 Jul: consecutive training days. A rest day never
  breaks it; a gap longer than a week does.** Mon/Wed/Fri reads 3, not 1. The unit is a session,
  so the streak stops being a daily goal and **§20 keeps its "no daily goals" clause** — the
  contradiction resolved in §20's favour rather than against it. §16.2 rewritten. Recorded in
  Appendix C.
  - **New task D6** below carries the code change. **E5 is deleted** — see block E.

- **R4 · Keyword research before the store copy** (§2.1). Not a build decision — a decision about
  whether to spend an afternoon on it. Six hundred installs a month is the requirement, and C4's
  title and subtitle are written once and then rarely change. → *unanswered*

- **R5 · The step count.** → **ANSWERED 28 Jul: the spec supersedes the nine-step ruling.**
  Fourteen screens carrying twelve decisions (the spec says fifteen and thirteen; step 11 was
  deleted by R3 the day the spec arrived). Recorded in Appendix C, §0.1's row struck, §11
  rewritten. **E0 and E1 are done**; E2 may now start, because E1 built the behaviour its step 5
  describes.
  - The condition does not soften with the ruling: **every question must change a later screen,
    an engine default, or a line on the paywall.** E1 is the proof that the condition has teeth —
    focus was in the flow for weeks reading nothing, and E5 was deleted rather than kept.

---

## 10. Log

One line per completed task: `<date> · <id> · <what changed> · <gates>`

```
28 Jul · — · EFFORT MARKING after Finish (owner). One sheet, every parsed exercise, a
              four-step scale (Easy/Moderate/Hard/Max) captioned in reps-left, a real Skip,
              and a second door on the receipt for anyone who answers later. It APPENDS
              "rpe 8" to the user's own line (src/lib/effort.ts, 9 tests) rather than storing
              an overlay: the words are the record (§1.1 inv. 1), so it exports, syncs and
              survives a re-parse for free — and the engine's rule 2, which almost never fired
              because nobody types RPE, finally gets its input. The review prompt now stands
              down while the sheet is open · 123 tests, 4 gates
28 Jul · — · NEXT TAB (owner). The prediction gets its own surface, which §16 says is the
              strongest retention mechanism in the app and which had no door. Lifts left the
              tab bar and became a push at /lifts, reachable from Next and Progress — four
              tabs, four questions, nothing lost. src/lib/db/brief.ts assembles four blocks
              (what's next · standing still · moving · adherence), all from SQL and the pure
              engine; whyFor() in plan/prescribe.ts phrases each reason as a fragment (4 new
              tests). The owner asked for an "AI summary used as a plan"; that crosses §1.1
              inv. 3, §20 and the Terms, so the numbers are computed and a model may only
              rewrite the one headline sentence it was already allowed to rewrite (§8.3) ·
              110 tests, 4 gates
28 Jul · — · Onboarding visual + motion pass on the 14 screens, researched against Mobbin
              (Equinox+, Tonal, Peloton Strength+, pliability, Vibecode, Tiimo, Photoroom,
              Aaptiv, Strava, Superpower, Moonly, Paired). Step count moved from the eyebrow
              into the chrome as mono 03/07, eyebrow now names the section; selection marker
              moved to the trailing edge and the selected row lifts; every tappable dips
              (PressableScale); "what this replaces" made asymmetric (recessed vs raised, no
              colour); FadeSlideX added to the motion kit so the step transition has a
              DIRECTION; screen 1 staggers, screen 4's load counts up; emoji on exactly two
              screens (language flags + attribution), none on focus/tracker where no honest
              one-glyph mapping exists · 4 gates
28 Jul · E2/E3/E4/E6/E7/E8 · Block E complete. Onboarding is 14 screens (7 ask something,
              bounded counter "STEP 03 OF 07"): three new explanation screens (what this
              replaces · what that focus changed · the objection answered) and two new
              questions (pref_primary_lift · pref_ob_source). The demo reads the user's own
              lift; Lifts pins it on the first open only; the paywall headline is computed from
              what the user already has (db/ledger-size.ts); every step instrumented with the
              flow's length beside it. recore-onboarding-v2-spec.md folded into CLAUDE.md §11.0
              and DELETED · 88 tests, 4 gates
28 Jul · — · Owner requests, same day: (1) swipe left/right on Today to change days
              (components/day-swipe.tsx — right = back, left = forward, stops at today,
              disabled while the keyboard is up); (2) the settings avatar removed from TopBar
              (it duplicated the You tab — §18 tier 3 closed); (3) the accessory bar rebuilt as
              FLOATING GLASS (expo-glass-effect, 3rd new dependency, behind components/glass.tsx
              with a warm-paper fallback; no tint, no colour, no emoji), with the reference's
              "+" becoming the PLAN button that writes the next prescribed line into the note
              and renders only when there is one left · 4 gates
28 Jul · E1 · Focus is a real engine default: FOCUS_REP_RANGE (3–5 / 8–12 / 6–8) arrives as
              defaultRepRange on the history object; engine.ts still has zero imports. Fed to
              BOTH the ghost (predict/data.ts) and the plan strip (db/strip.ts →
              plan/prescribe.ts). Step 2's subtitle now names what it does · 88 tests, 4 gates
28 Jul · E0 · R5 recorded: the onboarding spec supersedes "nine steps" → fourteen screens,
              twelve decisions. CLAUDE.md §0.1 row struck, §11 rewritten, Appendix C row
              added · docs only
28 Jul · A2c · expo-notifications (owner-approved, 2nd new dependency): one local day-5
              notification, permission asked only on the trial-start sheet and never re-asked,
              cancelled the moment the in-app reminder has said it · 4 gates
28 Jul · D4 · Local funnel counters (src/lib/funnel.ts) in the meta KV, no SDK: ob step,
              paywall shown, trial started, imported, parsed items, corrections, adherence
              shown/followed, first open. Wired at 7 call sites; carried in the JSON export
              and disclosed in the privacy policy · 4 gates
28 Jul · D2 · JSON export incl. raw_text (export-json.ts), listed first on You and offered
              from the read-only surface · 4 gates
28 Jul · D1 · Real account deletion: delete-account edge function (service role, id from the
              verified JWT) + lib/account/delete.ts. Server first, then the device, then sign
              out. NOT deployed yet — owner runs `supabase functions deploy` · 4 gates
28 Jul · D6 · Streak counts training days (lib/streak.ts, pure, 11 tests). daysBetween added
              to db/dates.ts in UTC. StreakSheet's own longestStreak folded into the same
              module; copy in the sheet + top bar now says "training days" · 4 gates
28 Jul · C1 · Icon, wordmark and every launcher asset generated by scripts/build-icon.py on
              the §5.1 palette (ink on paper, no green). app.json name → Recore, adaptive bg
              → #F4F5EF, ios.icon removed. 11 Expo template assets deleted · 4 gates
28 Jul · C2/C4/C5 · eas.json (development/preview/production) + RELEASE.md carrying the ASC
              groundwork, the build/submit commands, the privacy-label answers, the listing
              draft and the two release-pass protocols · 4 gates
28 Jul · C3/A3 · Terms, Privacy and "How parsing works" written in src/lib/legal.ts and
              shipped as the /legal route; scripts/build-legal-html.ts writes the same text to
              docs/ for hosting; linked from the paywall and You at 44 pt targets · 4 gates
28 Jul · C6 · Export writes a real file (expo-file-system) and shares via Sharing.shareAsync
              with a real UTI, instead of Share.share({ message }) · 4 gates
28 Jul · B4 · Lapsed state routed: entitlement resolved once per session in AuthProvider and
              cached; read-only-ledger.tsx reads the real ledger and replaces the composer on
              Today only; __DEV__ toggle in You → Dev to reach it before B2 · 4 gates
28 Jul · A2 · Day-5 trial reminder: lib/billing/{pricing,trial,state}.ts + the reminder sheet.
              trial.ts is pure with 9 tests. Copy on the paywall corrected. Inert until
              startTrial() is called, which only billing can honestly do · 4 gates
28 Jul · A1 · Fabricated proof deleted from paywall.tsx AND sign-in.tsx (a third call site no
              document listed, found by the acceptance grep). Spaces not refilled;
              Rating/Testimonial kept in primitives.tsx · 4 gates
28 Jul · A4 · R1/R2/R3 ruled and recorded: CLAUDE.md §0.1 (+3 rows), §11.1 rewritten, §12.1
              reminder rewritten, §16.2 resolved, §18 tiers + open decisions corrected, §19
              reordered, Appendix C (+3 rows). PLAN: A2 split three ways, D6 added, E5 deleted,
              E2 unblocked, D3 rescoped · docs only, no code
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

### 28 July · PLAN A3 / `CLAUDE.md` §0.2 · A3

**What the document says:** A3 step 2 says "host them at stable URLs" and step 3 says wire them
with `Linking.openURL`; the acceptance line says both links "open in the browser". §0.2 also
lists "any new route or screen" as needing an ask first.

**What I think is wrong:** nothing about the intent — but the browser is not reachable from an
agent session. Hosting needs the owner's GitHub or domain, so building it that way would have
left the paywall's two link words dead on the exact screen App Review taps them, which is the
tier-0 item A3 exists to close. A URL constant pointing at a page nobody has published yet
would also be a second untrue claim, on the same screen, in the same week.

**What I did instead:** one new route, `/legal`, rendering three documents from
`src/lib/legal.ts`, plus `scripts/build-legal-html.ts` writing the same text to `docs/` for
GitHub Pages. In-app pages work offline, on a plane and before anything is hosted; the
generated pages fill App Store Connect's two required URL fields. One source, so they cannot
disagree. **This does not skip the hosting step** — it makes the hosting step a `RELEASE.md`
task instead of a blocker, and A3's step 4 is still open and marked OWNER.

**Status:** proposed — reverse it by pointing the two links at hosted URLs once `docs/` is
published, which is a one-line change in `openLegal`. Recorded in `CLAUDE.md` Appendix C.
