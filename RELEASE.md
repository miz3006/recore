# RELEASE.md — everything between this repository and the App Store

**Written 28 July 2026 alongside the tier-0/2/3 build. Companion to `PLAN.md`, not a
replacement for it.**

`PLAN.md` tracks what is missing in the CODE. This file carries the parts that are **not
code** — the App Store Connect groundwork (B1), the build and submit commands (C2), the
privacy declarations (C3), the store listing (C4) and the two release passes (C5). They
were written down rather than left implicit because every one of them is a place a
submission gets rejected, and none of them can be done by an agent: they need the owner's
Apple account, the owner's device and the owner's decisions.

Anything marked **OWNER** needs a human with credentials. Anything marked **DONE** is
already in the repository.

---

## 1. Before anything else — three strings

These are the only values in the shipped code that an agent could not derive. All three
live in `src/lib/legal.ts` at the top of the file, deliberately together.

| Constant | Ships as | What it has to become |
|---|---|---|
| `SUPPORT_EMAIL` | `support@recore.app` | A mailbox you actually read. App Review checks that support replies, and the privacy policy points at it for erasure requests. If you do not own `recore.app`, use an address you do own. |
| `PUBLISHER` | `Recore` | The entity that publishes the app, as it should appear on an invoice. If you trade as a company, that company's registered name. |
| `GOVERNING_LAW` | `Slovenia` | Your jurisdiction. Consumer protections where the user lives still apply on top of it. |

After changing them: `npm run build:legal` regenerates `docs/`.

---

## 2. B1 · App Store Connect groundwork — **OWNER**

Not code, and it gates B2 (RevenueCat), so it goes first.

1. **Paid Apps agreement + banking + tax.** Agreements, Tax, and Banking → the Paid Apps
   agreement must read *Active*. Nothing sells until it does.
2. **Apple Small Business Program — enrol.** §2.1's entire margin assumes 15%, not 30%
   (≈ $4.25/mo net on the annual). **It is not automatic**, and enrolment applies from the
   following month, so doing it late costs real money.
3. **One subscription group**, e.g. `Recore Pro`. Both products in the same group, so a
   user can move between them without double-charging.
4. **Two auto-renewable products:**
   | | Product ID | Price | Trial |
   |---|---|---|---|
   | Annual | `com.recore.app.pro.annual` | $59.99 / year | **7-day free trial**, introductory offer, new subscribers |
   | Monthly | `com.recore.app.pro.monthly` | $8.99 / month | none |
5. **Localised metadata** for each product (display name + description), at minimum in
   English. This is what the system sheet shows at purchase.
6. **A sandbox tester** account under Users and Access → Sandbox.
7. **App-level privacy answers** — see §4 below.

*Acceptance:* both products read **Ready to Submit** and the sandbox tester exists.

> The prices in `src/lib/billing/pricing.ts` must match what you enter here **until B2
> lands**, at which point the paywall reads the real product and the constants become the
> pre-fetch fallback. Two sources of price is how a paywall starts lying.

---

## 3. C2 · The build pipeline — **`eas.json` is DONE, the builds are OWNER**

`eas.json` ships three profiles: `development` (dev client, internal), `preview` (release
build, internal distribution) and `production` (store, `autoIncrement`).

```bash
npm i -g eas-cli          # once
eas login
eas init                  # links the project, writes the EAS project id
```

**Environment variables.** The client reads `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (`src/lib/env.ts`) and nothing else. Locally they come
from `.env`; EAS builds do **not** see that file, so register them once:

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL      --value "…" --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "…" --environment production --visibility plaintext
# repeat for --environment preview and development
```

Both are publishable values (the anon key is protected by RLS, §10.2) — the model key is a
Supabase secret and never touches this.

**Build and ship:**

```bash
eas build --profile development --platform ios   # the dev build §3 requires
eas build --profile production  --platform ios
eas submit --profile production --platform ios   # asks for the Apple ID + ASC app id
```

*Acceptance:* the app runs from TestFlight and **Apple sign-in, dictation and the Keychain
session all work** — the three paths Expo Go cannot test.

---

## 4. C3 · Privacy — **the page is DONE, the declarations are OWNER**

`You → Privacy` now opens three real pages instead of an alert: *How parsing works*, the
*Privacy Policy* and the *Terms of Use* (`src/app/legal.tsx`, text in `src/lib/legal.ts`).

**Host the two public copies.** `docs/` contains generated static pages. GitHub →
Settings → Pages → source `main` / `/docs`. The two URLs are then:

```
https://<owner>.github.io/<repo>/privacy.html
https://<owner>.github.io/<repo>/terms.html
```

Put the privacy URL in App Store Connect → App Privacy, and the terms URL on the
subscription. Then set `HOSTED_BASE_URL` in `src/lib/legal.ts` so the value is recorded
next to the text it points at.

**App Privacy answers**, matching what the code actually does (§7.3, §10, `src/lib/funnel.ts`):

| Question | Answer |
|---|---|
| Data collected? | **Yes** |
| **Contact Info → Email Address** | Collected · Linked to the user · **App Functionality** · not used for tracking |
| **Contact Info → Name** | Collected · Linked to the user · App Functionality · not used for tracking *(only when the provider supplies it; Sign in with Apple may hide it)* |
| **Identifiers → User ID** | Collected · Linked to the user · App Functionality · not used for tracking |
| **User Content → Other User Content** *(the workout notes and the record read out of them)* | Collected · Linked to the user · App Functionality · not used for tracking |
| Usage Data / Analytics | **No.** There is no analytics SDK. The counters in `funnel.ts` never leave the device and are handed back in the user's own export. |
| Diagnostics / Crash data | **No** |
| Location, Contacts, Photos, Health, Purchases, Search, Browsing, Advertising ID | **No** |
| Push notifications | The app uses **local** notifications only (one day-5 trial reminder). There is no push server and no device token is ever registered, so nothing is collected here. |
| Used for tracking across apps or websites? | **No** |
| Third-party partners with access | Supabase (hosting) and Anthropic (parses note text). Both are processors under the policy; neither is an advertising or analytics partner. |
| Account deletion available in-app? | **Yes** — You → Delete account (`src/lib/account/delete.ts`) |

---

## 5. C4 · The store listing — **OWNER, drafted here**

Screenshots are **built from real logged sessions, never mockups** (§17). Log a real week
in the TestFlight build first, then capture.

**Capture the onboarding's three shots in the same sitting.** The funnel shows real captures
inside a device frame on screens 9, 4 and 13 (CLAUDE.md §11.0.1c), and they come from the same
real week as the store shots:

| Save as | The app in this state |
|---|---|
| `assets/onboarding/compose.png` | Today mid-session — settled cards, readings on the right, keyboard up so the accessory bar is in frame |
| `assets/onboarding/plan.png` | Next, with a real briefing: the planned values in green |
| `assets/onboarding/ready.png` | A finished session — the receipt and its counted totals |

Then uncomment the three `require`s in `src/lib/onboarding-shots.ts`. Until that is done the
frames render the live demo the screens already had, so nothing is broken and nothing is fake —
but the pictures are one of the cheapest things left that make the funnel feel like a product.
Check the status bar for anything personal before committing them.

**Title (30 chars max)** — pick after the keyword research R4 asks for:

```
Recore — Write Your Training
```

**Subtitle (30 chars max):**

```
A training log you write in
```

**Promotional text (170, changeable any time):**

```
Type what you lifted in your own words. Recore reads it into a record and prepares your
next exact session from your own numbers.
```

**Description** — the honest pitch, no "AI", no claimed credit for the training (§15):

```
Recore is a training log you write in.

Open it, type what you did — "bench 3x8 80kg", "počepi 5x5 100", "5k easy 26min" — and
Recore reads it into a structured record. Any language, any shorthand, your words.

No exercise picker. No routine builder. No plus button. The page and the keyboard are the
whole product.

WHAT IT DOES
· Reads your sentence into exercises, sets, reps, weights and RIR.
· Remembers the shorthand you use, so it gets more personal every week. Fix a reading once
  and the fix sticks forever.
· Prepares your next session from your own history: double progression with RIR, rounded to
  the plates your gym actually has.
· Keeps the record: sessions, volume, personal records, a weekly split you author by
  writing it.
· Works offline. Every line is saved on your phone the instant you type it.

WHAT IT WILL NEVER BE
No feed, no friends, no leaderboards. No XP, no badges, no streak guilt. No programme
generator — Recore never tells you what to train, only what to beat.

YOUR RECORD IS YOURS
Export everything, free forever, including after a subscription ends — your original notes
and the full structured record. Import your history from Strong or Hevy in one file.

Recore Pro is $59.99/year with a 7-day free trial, or $8.99/month.
```

**Keywords (100 chars, comma-separated, no spaces)** — R4 first:

```
workout,log,lifting,gym,strength,barbell,progressive,overload,tracker,journal,notes,split
```

**Review notes** — this is what pre-empts a 3.1.1 / 3.1.2 rejection, so do not skip it:

```
Recore is a subscription training log with a 7-day free trial on the annual plan.

FUNNEL: onboarding → paywall → sign in. The account is created LAST, on purpose: the trial
attaches to the account, and we do not ask people to sign up before they have seen what the
app does. The paywall can be dismissed with the × in the top left and is reachable again
from You → Recore Pro.

SUBSCRIPTIONS: two auto-renewable products in one group. Price, duration, renewal terms and
the cancel path are stated on the paywall and again in Terms of Use, which is linked from
the paywall itself and from You → Privacy.

ACCOUNT DELETION: You → Delete account. It is immediate and it deletes the account and all
its data, on the device and on the server.

EXPORT: You → Your data. Free, complete, and never gated — including on a lapsed
subscription.

TEST ACCOUNT: sign in with Apple works on a sandbox account; no credentials needed.
```

---

## 6. C5 · The two release passes — **OWNER, on the TestFlight build**

Both are written down here after they are run, with the date and what happened.

**Pass 1 — an airplane-mode session, start to finish.** Aeroplane mode ON before opening
the app. Write a full session, check cards off, use the rest timer, finish. Everything must
land. Then turn the network on and confirm the parse catches up and the record agrees with
what you typed.

```
Date:                 Result:
```

**Pass 2 — a cold install, timed to "trial started".** Delete the app. Install from
TestFlight. Stopwatch from the first tap to the moment the trial begins. Write down every
place you hesitated.

```
Date:                 Time to trial:                 Where it dragged:
```

---

## 7. Still open, and deliberately so

| Item | Why it is not here |
|---|---|
| **B2 · RevenueCat** | **Deferred by the owner on 28 July until this document's §2 is done** — which is the right order, since a sandbox purchase is impossible before the products exist. Everything downstream is built and waiting: `startTrial()` and `resolveEntitlement()` in `src/lib/billing/state.ts` are the two call sites it needs, and the day-5 reminder, the day-5 notification and the lapsed surface all hang off them already. |
| **B3 · Restore** | Comes free with B2 — it is one RevenueCat call in the two places that currently explain the stub. |
| **D3 · Notifications beyond the trial** | `expo-notifications` is installed now (A2c), so this is no longer a dependency question. §16.1's renewal notice and the annual record still come after the first charge (§19). |
| **Block E · onboarding v2** | **R5 answered 28 July**; E0 and E1 are done. E2–E4 and E6–E8 are open, and §19 still puts the whole block behind billing and this document. |
| **R4 · Keyword research** | A decision about spending an afternoon, not a build. §5's title/subtitle/keywords are drafts until it is answered. |
