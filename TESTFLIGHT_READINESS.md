# Recore — TestFlight readiness audit

**Audited 20–21 August 2026** against the working tree at commit `f317fcc` (plus 10 modified
and 2 untracked files, see §6.1). Read-only audit: nothing in this repository was changed
except the addition of this file.

Method: every claim below cites the file, line or config key it was read from. Where a fact
lives outside the repository (App Store Connect, RevenueCat, EAS servers, Supabase dashboard,
DNS), it is marked **unverifiable from repo** and moved to §5 instead of being guessed at.

Gates were run as evidence, not as changes: `npm run typecheck` **pass**, `npm test`
**438/438 pass**, `npm run lint` **pass**. `npx expo export` was **not** run (it would
rewrite `dist/`).

---

## 1. Verdict

**No — a TestFlight build cannot go to external testers today, and the reason is not code
quality.** The app itself is in unusually good shape for a beta: the four tabs, onboarding,
the parser, sync, export, account deletion, the legal pages and the lapsed surface are all
really implemented, dependency versions match Expo SDK 54 exactly, and there is not one
fabricated rating, testimonial or install count anywhere in `src/` (§6.2). What is missing is
the *provisioning* around it. Five blockers stand in the way, and four of them are
configuration rather than engineering: billing is not provisioned, so in a release build
**every tester lands on the read-only ledger and cannot log a single session** (M); the
client environment variables are not declared anywhere EAS can see them (S–M); the repo is
not linked to an EAS project (S); `ITSAppUsesNonExemptEncryption` is absent, so each upload
stalls at *Missing Compliance* (S); and the support address plus the two hosted legal URLs
are still the unset defaults `RELEASE.md` §1 flags as OWNER work (S). Clearing all five is
roughly half a day of account work plus one build. After that, the honest gap for external
testers is observability: there is no crash reporter, no error boundary and no analytics sink
(§3), so the first crash a tester hits will be a silent one.

### Update — 21 August 2026

Six items have been closed since the audit was written; the paragraph above is kept as the
record of what the audit found. Fixed in the repository: **B4** (export compliance answered in
`app.json`), **H2** (a root `ErrorBoundary`), **H1** (Sentry installed and fenced, with a live
DSN), and **H4** (the recap row now states how it is scheduled). Fixed by the owner on the
account side: **B2** (all four `EXPO_PUBLIC_*` variables present in all three EAS environments)
and **B3** (`eas init` run; `extra.eas.projectId` is in `app.json`).

**Two blockers remain, both account work: B1 and B5.** B1 is the one that decides whether a
build is worth handing out at all — `EXPO_PUBLIC_REVENUECAT_IOS_KEY` is currently a
`test_…` Test Store key in `production` and `preview`, and `src/lib/env.ts` blanks a `test_`
key in any non-`__DEV__` bundle on purpose, so a TestFlight build still resolves every account
to `lapsed` and opens on the read-only ledger. Each item below carries its own status line.

---

## 2. Blockers

### B1 · Billing is not provisioned, so a release build gives every tester a read-only app — **M** · ⛔ STILL OPEN

**Status, 21 Aug 2026.** The key is no longer absent — it is a **Test Store** key
(`EXPO_PUBLIC_REVENUECAT_IOS_KEY=test_…` in `production`, `preview` and `development`), and the
outcome in a TestFlight build is identical to having none. `src/lib/env.ts` blanks a `test_` key
whenever `__DEV__` is false, deliberately: a Test Store purchase is simulated, so shipping one
would hand a free entitlement and an unhonoured price to a paying customer (§2 rule 5). A
release bundle therefore reads an empty key and takes the same path described below. **Two
things still have to happen: real products in App Store Connect with a RevenueCat offering
behind them, and an `appl_…` key in `production` and `preview`.** Until then the test key is
useful only in `development`, and leaving it in the other two environments makes
`eas env:list` read as though billing were configured when it is not.

**What.** In a release bundle the entitlement resolves to `lapsed` unless RevenueCat answers
with an active `pro` entitlement, and `lapsed` replaces Today with the read-only ledger. The
paywall in front of it cannot sell anything either, so there is no way out from inside the app.

**Where.** The chain, in order:

- `.env.example:17` — `EXPO_PUBLIC_REVENUECAT_IOS_KEY=` is empty, and `eas.json` declares no
  environment variables at all except `EXPO_PUBLIC_ENV` (`eas.json:16,25,36`), which nothing
  in `src/` reads.
- `src/lib/billing/store.ts:51` — `isStoreConfigured()` is `false` with an empty key, so
  `configureStore()` (`store.ts:70`) never runs and `attachStoreToAccount()` returns `false`.
- `src/lib/billing/state.ts:169` — the development escape hatch that grants `entitled` when
  the store is unconfigured is `if (!__DEV__) return null;`. It is compiled out of release
  builds *on purpose*, which is correct — and it means release behaviour is the opposite of
  what the owner sees in development.
- `src/lib/billing/entitlement.ts` via `state.ts:135` — with no fresh and no cached snapshot,
  `decideEntitlement(null, null)` returns `{ entitlement: 'lapsed', reason: 'unverified' }`.
- `src/app/(tabs)/today.tsx:92` — `if (entitlement === 'lapsed')` renders `<ReadOnlyLedger />`.
  Export and Restore work; writing does not.
- `src/app/paywall.tsx:254,349,482` — with no store, `offerState` is `'unavailable'`,
  `canBuy` is `false` and the CTA reads **"Pricing unavailable"** and is disabled. The
  `DEV · SKIP` chip is `__DEV__`-only (`paywall.tsx:506`), so it does not exist here.

**Why it blocks.** Tester dead-end, not a crash: the funnel ends on a disabled button, and the
only remaining door ("Already use Recore? Sign in", `paywall.tsx:685`) leads to an app whose
one job — writing a session — is switched off.

**Smallest fix (config, no code).** In App Store Connect create the subscription group and the
two auto-renewable products `com.recore.app.pro.annual` / `com.recore.app.pro.monthly`
(`src/lib/billing/pricing.ts:29`); in RevenueCat create an offering whose **annual** and
**monthly** packages point at them (`store.ts:171-175` reads `offerings.current.annual` and
`.monthly`) and an entitlement with the identifier **`pro`** (`pricing.ts:26`); then register
the public iOS key as an EAS environment variable for the build profile. Sandbox purchases
work in TestFlight, so this is the path that also tests the real thing.

**If that is not ready in time**, the alternative is a code change, not a config one: relax
`devOverride()` (`state.ts:167-177`) to grant `entitled` when the build is not production and
the store is unconfigured, and label the paywall CTA "Continue — beta". Smaller in effort, but
it ships a bypass you must remember to remove, and it leaves the purchase path untested.

---

### B2 · The Supabase URL and anon key are not declared anywhere an EAS build can see them — **S** · ✅ RESOLVED 21 Aug 2026

**Fixed by the owner.** `eas env:list` now shows all four client variables —
`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`,
`EXPO_PUBLIC_SENTRY_DSN` — in `production`, `preview` and `development`, all plaintext, which is
correct: every one of them is compiled into the bundle by Metro anyway, so EAS visibility only
governs who reads them in the dashboard.

**One trap on the way, worth keeping written down.** `EXPO_PUBLIC_SUPABASE_URL` was first set to
the project's `sb_publishable_…` key rather than its URL. That is not a silent misconfiguration:
`@supabase/supabase-js` rejects a non-HTTP(S) URL by throwing (`dist/index.cjs:1017`), and
`src/lib/supabase.ts:16` calls `createClient` at **module scope**, so the throw happens while the
bundle is evaluating — before React renders, and before `_layout.tsx` finishes evaluating, which
means the root `ErrorBoundary` exported from that same module does not exist yet to catch it.
Every build would have died at launch with no screen. It is now the `https://…supabase.co`
project URL. The original finding follows.


**What.** `.env` is git-ignored (`.gitignore:31-33`) and therefore not uploaded by
`eas build`; `eas.json` registers no `EXPO_PUBLIC_SUPABASE_*` values. If the matching EAS
environment variables have not already been created, the build ships with empty strings.

**Where.** `src/lib/env.ts:15-16,27-29`; `src/lib/supabase.ts:17-18` falls back to
`https://placeholder.supabase.co`; `RELEASE.md:70-80` documents the `eas env:create` commands
but lists only the two Supabase values — it predates `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
(`env.ts:24`), so following that section verbatim reproduces B1.

**Why it blocks.** Everything account-shaped dies at once: Apple/Google sign-in, the parser
(`src/lib/parse/client.ts:88` returns early when unconfigured), sync (`src/lib/sync/index.ts:70`)
and deletion. Worse, the sign-in screen then prints developer instructions **to the tester**:
"Supabase is not configured. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL…"
(`src/app/sign-in.tsx:115-119`).

**Smallest fix.** `eas env:create --name EXPO_PUBLIC_SUPABASE_URL … --environment production`
and the same for `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, for
both `production` and `preview`; then confirm with `eas env:list`. Whether these already exist
is **unverifiable from repo** — verify before the first build, because the failure mode is
silent.

---

### B3 · The repository is not linked to an EAS project — **S** · ✅ RESOLVED 21 Aug 2026

**Fixed by the owner.** `app.json` now carries `extra.eas.projectId`
(`cf4674e8-a097-4d6c-8464-22070ba683ed`), so `eas build` runs non-interactively and the remote
build-number counter that `eas.json`'s `appVersionSource: "remote"` depends on has a project to
count against. The original finding follows.


**What.** `app.json` has no `extra.eas.projectId` and no `owner`, while `eas.json:4` sets
`"appVersionSource": "remote"`, which delegates `CFBundleVersion` to EAS's server-side
counter (`"autoIncrement": true`, `eas.json:31`).

**Where.** `app.json` (no `extra` block anywhere in the file); `eas.json:2-5`.

**Why it blocks.** `eas build` cannot run without a linked project; it prompts to create one,
which fails outright in any non-interactive context. It also means the version story is
currently *only* `"version": "1.0.0"` (`app.json:4`) with no `ios.buildNumber` — correct under
remote versioning, broken without it.

**Smallest fix.** `eas login && eas init` once, then commit the `extra.eas.projectId` it writes.

---

### B4 · `ITSAppUsesNonExemptEncryption` is absent — **S** · ✅ RESOLVED 21 Aug 2026

**Fixed:** `app.json` → `ios.infoPlist.ITSAppUsesNonExemptEncryption: false`. Verified with
`npx expo config --type introspect`, which shows the key in the Info.plist prebuild would
write — alongside `CFBundleDisplayName: Recore` and `UIUserInterfaceStyle: Light`, confirming
the stale local `ios/` folder is not what ships. The original finding follows.


**What.** No `ios.infoPlist` block exists in `app.json` at all (grep for `infoPlist` in
`app.json` → no match), so the key is not set, and the generated `ios/recore/Info.plist`
confirms its absence.

**Why it blocks.** Every upload lands in App Store Connect as *Missing Compliance* and cannot
be distributed to testers until somebody answers the export-compliance question by hand — for
each build. It is not an upload failure; it is a recurring manual gate on every beta you ship.

**Smallest fix.** In `app.json`, add `"infoPlist": { "ITSAppUsesNonExemptEncryption": false }`
inside the existing `"ios"` block. Recore uses only HTTPS and standard system crypto, so
`false` is the truthful answer.

---

### B5 · The support address and the two hosted legal URLs are still the unset defaults — **S + manual**

**What.** `src/lib/legal.ts:31` ships `SUPPORT_EMAIL = 'support@recore.app'`, and
`legal.ts:40` ships `HOSTED_BASE_URL = ''`. `RELEASE.md:18-31` marks these as the three
strings "an agent could not derive" and as OWNER work; they have not been changed.

**Why it blocks.** `SUPPORT_EMAIL` is the *only* feedback route the app has — You → Contact
support composes a mail to it (`src/lib/support.ts:31`) and both legal documents point at it
for erasure requests (`legal.ts:162,234`). External TestFlight goes through Beta App Review,
and App Store Connect requires a privacy-policy URL and a working feedback address; a mailbox
nobody owns fails both the tester and the reviewer. The in-app legal pages themselves are real
and complete (`src/app/legal.tsx`, generated copies in `docs/privacy.html`, `docs/terms.html`,
in sync with `legal.ts` as of commit `d8ec7ee`) — only the **hosting** and the **address** are
missing.

**Smallest fix.** Set `SUPPORT_EMAIL` to a mailbox you read, run `npm run build:legal`, publish
`docs/` (GitHub Pages, per `RELEASE.md:105-115`), and set `HOSTED_BASE_URL` to the resulting
base. Whether `recore.app` exists is **unverifiable from repo**.

---

## 3. High priority (before external testers)

### H1 · No crash reporting at all — **M** · ✅ RESOLVED 21 Aug 2026 (needs a DSN)
*Was:* `package.json` contained no Sentry, Bugsnag, Crashlytics or equivalent. A tester's crash
produced nothing readable: no stack, no breadcrumb, no device.
**Fixed:** `@sentry/react-native` 7.2.0 with its Expo config plugin (auto-added to `app.json`),
initialised from `src/lib/crash.ts`, which is also the fence: no `setUser` anywhere in `src/`,
`sendDefaultPii: false`, console breadcrumbs dropped, `user` / `request` / `extra` stripped in
`beforeSend`, `enableAutoSessionTracking: false` and `tracesSampleRate: 0` — so something broke,
or nothing is sent. The root is wrapped (`_layout.tsx`) and the error boundary reports what
React swallowed. **`EXPO_PUBLIC_SENTRY_DSN` is empty by default and that is a working state**:
with no DSN nothing initialises and no socket opens. To turn it on, add the DSN as an EAS
variable (§5), and `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` if you want readable
(source-mapped) stacks — the plugin warns at config time that it will read them from the build
environment. The privacy policy gained an "If Recore crashes" section in the same change
(`src/lib/legal.ts`, `docs/privacy.html` regenerated), and the App Privacy answer for
Diagnostics moves to **Yes** (§6.7).

### H2 · No error boundary anywhere — **S** · ✅ RESOLVED 21 Aug 2026
*Was:* no `ErrorBoundary` export, no `componentDidCatch`, no `ErrorUtils.setGlobalHandler` in
`src/`; an uncaught render error in a release build terminated the app with no recovery screen.
**Fixed:** `src/components/error-screen.tsx`, exported as `ErrorBoundary` from
`src/app/_layout.tsx`. It says the record is intact (true by construction — every line is
written to SQLite as it is typed), offers `retry`, prints the error's own message selectable so
a screenshot is a complete bug report, and hands the error to `reportCrash`. It mounts below the
root layout, so it uses no provider — plain views, padding instead of insets — and dismisses the
splash itself, since a crash before the session resolves would otherwise leave the native image
on top of it.

### H3 · The analytics event layer has no sink, and the events cannot be read off a device — **M**
`src/lib/analytics.ts:175-177` — `flush()` is a deliberate no-op with a `TODO: wire provider`.
The queue lives in the local `meta` KV, and the JSON export carries only the *funnel counters*
(`src/lib/export-json.ts:180` → `getFunnelSnapshot()`), **not** `queuedEvents()`. So the
`paywall_view` / `paywall_cta_tap` / per-screen onboarding events (`analytics.ts:43-58`) that
exist precisely to measure the beta funnel are unreadable unless you have the tester's phone.
*Fix (smallest, keeps the no-SDK rule):* add `queuedEvents()` and `userProperties()` to the
export payload, and ask testers to send an export. *Fix (real):* wire a provider — an owner
decision plus a privacy-policy change, per `CLAUDE.md` §2 rule 8.

### H4 · The weekly recap under-delivers what the settings row promises — **S** · ✅ RESOLVED 21 Aug 2026 (copy)
*Was:* `src/lib/recap.ts:52-68` schedules **one** `DATE`-triggered local notification and re-arms
it only when Today mounts (`src/app/(tabs)/today.tsx:33`) or a session is finished, while the You
row displayed "Sundays 18:00", which reads as a standing weekly promise.
**Fixed (owner's choice: smallest intervention):** the row's value stays — it is the hour it
fires — and the accordion body now states the mechanism where someone deciding reads it: "The
next one is scheduled each time you open Recore, so it follows the weeks you use it."
(`src/app/(tabs)/you.tsx`, `recapHint`.) A repeating `CALENDAR` trigger was rejected on purpose:
the body carries this week's own session count, and a repeating trigger would deliver a stale
number. Phrased neutrally — §2 rule 6 rules out making a missed week feel like a lapse.

### H5 · Parse failures and rate limiting are invisible to the user — **S**
`src/lib/parse/client.ts:96-99,120` swallow every failure into `devLog` and return `null`; the
line simply stays "pending" (`src/components/note-surface.tsx:380-383`). The server returns
`429` after **30 calls per 10 minutes per user**, and that budget is shared across
`parse-workout`, `explain-brief` and `explain-prediction` — all three call the same
`bump_parse_rate` RPC (`supabase/functions/parse-workout/index.ts`, `explain-brief/index.ts:74`,
`explain-prediction/index.ts:109`). A tester importing history and then logging enthusiastically
can hit it and see only cards that never resolve.
*Fix:* for beta, no code change — list it as known behaviour in the What-to-Test note (§7).
Longer term, a quiet "reading catches up shortly" state distinct from "pending".

### H6 · One Supabase project for development and beta — **S, accept or split**
`.env`, `.env.example:10` and `supabase/.temp/project-ref` all name the same project
(`nkjrukxrocplesonotqo`). Testers' accounts, workouts and deletion tests land in the same
database as your development data, and draw on the same `ANTHROPIC_API_KEY` budget.
*Fix:* acceptable for a small closed beta if you know it; otherwise a second project plus a
second set of EAS env vars.

### H7 · `eas.json` names an update `channel` in every profile, but `expo-updates` is not installed — **S**
`eas.json:12,24,30` set `"channel"` for development/preview/production; `expo-updates` is not in
`package.json` (only the transitive `expo-updates-interface` appears in the lockfile). The field
has nothing to bind to, and — more importantly — **there is no OTA path for a beta hotfix**:
every fix is a new build and a new Beta App Review.
*Fix:* either install `expo-updates` and configure EAS Update, or drop `channel` so the config
does not imply a capability that is not there.

---

## 4. Nice-to-have (can wait past beta)

- **Splash background does not match the app canvas.** `app.json` sets the splash background to
  `#FFFFFF`; the app canvas is the warm paper `#F4F5EF` (the Android adaptive icon background
  uses that same paper colour). Launch flashes white, then settles to paper.
- **"Rate Recore" cannot appear.** `src/lib/review/index.ts:164` builds the review URL from
  `Constants.expoConfig?.ios?.appStoreUrl`, which `app.json` does not set; the row is hidden
  when there is no door (`you.tsx:1254`). Correct behaviour, and moot in TestFlight where
  `SKStoreReviewController` does nothing anyway. Add `ios.appStoreUrl` at launch.
- **The generated privacy manifest declares no collected data types.** `ios/recore/PrivacyInfo.xcprivacy`
  (auto-generated by prebuild) lists the four required-reason API categories correctly but has
  an empty `NSPrivacyCollectedDataTypes`. Apple binds you to the App Store Connect
  questionnaire, so this is not a rejection risk, but `ios.privacyManifests` in `app.json` can
  be made to agree with §6.7's table.
- **`EXPO_PUBLIC_ENV` is dead config.** Set in all three `eas.json` profiles, read nowhere in
  `src/` — a natural switch for a beta bypass if B1 goes that route.
- **`RELEASE.md` §7 is stale.** It still lists RevenueCat (its B2/B3) as "deferred… everything
  downstream is built and waiting"; `react-native-purchases` 10.5.0 is now fully wired
  (`src/lib/billing/store.ts`; `ios/Podfile.lock`: RevenueCat 5.81.3). A future reader will
  mis-plan from it.
- **`CLAUDE.md` §1 points at `docs/product-direction.md`; the file is at the repo root.**
  Already recorded in `docs/implementation-status.md` under "Structural findings".
- **Dead weight:** `src/components/device-frame.tsx` is referenced only from comments, and
  `src/lib/onboarding-shots.ts:64-70` has all three shots `null` (commented-out `require`s).
  Unreferenced assets (`assets/onboarding/welcome.mp4`, `assets/new_onboarding/*`,
  `assets/onboarding-originals/*`, ~60 MB) are not bundled by Metro, but they are in the repo.

---

## 5. Manual checklist — outside the repo

Nothing below can be verified from the code; each item is a place a first build or a first
Beta App Review dies.

**Apple Developer / App Store Connect**
- [ ] Apple Developer Program membership active; the bundle id `com.recore.app` (`app.json`)
      registered.
- [ ] App record created in App Store Connect for `com.recore.app`, name and primary language set.
- [ ] Paid Apps agreement **Active**, banking and tax complete (`RELEASE.md:36-38`).
- [ ] Apple Small Business Program enrolment (15% vs 30% — `RELEASE.md:39-41`).
- [ ] Subscription group + the two products `com.recore.app.pro.annual` and
      `com.recore.app.pro.monthly`, both **Ready to Submit**, with the 7-day introductory offer
      on at least the annual (the paywall reads the store's own trial length —
      `src/lib/billing/store.ts:150-166`).
- [ ] Sandbox tester account created.
- [ ] Export-compliance answered (or made permanent via B4).
- [ ] Privacy policy URL set (App Information) — from the hosted `docs/privacy.html`.
- [ ] App Privacy questionnaire answered per §6.7's table.
- [ ] Beta App Review submission: beta app description, "What to Test" (§7), feedback email,
      and a **demo account** — everything past the paywall is behind `session !== null`
      (`src/app/_layout.tsx:92`), so the reviewer needs credentials or a working Sign in with
      Apple flow.

**RevenueCat**
- [ ] Project + iOS app created; App Store shared secret / in-app purchase key uploaded.
- [ ] Entitlement identifier exactly **`pro`** (`src/lib/billing/pricing.ts:26`).
- [ ] Current offering with **annual** and **monthly** packages bound to the two product ids.
- [ ] Public iOS SDK key (`appl_…`) registered as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` in EAS.

**Sentry** (added 21 Aug 2026 — the code is in; these four values are not)
- [ ] Project created; DSN registered as `EXPO_PUBLIC_SENTRY_DSN` in EAS. Without it crash
      reporting stays off and the app behaves exactly as before.
- [ ] `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` as EAS build variables, so source maps
      upload and stacks are readable rather than minified (the plugin warns about the first two
      at config time).
- [ ] Confirm the first report arrives from a `preview` build — the `environment` tag carries
      `EXPO_PUBLIC_ENV`, so TestFlight and development are separable.
- [ ] App Privacy: **Diagnostics → Crash Data = Yes**, not linked to the user, App Functionality
      (§6.7). The privacy policy already says this in "If Recore crashes".

**EAS**
- [ ] `eas init` run and `extra.eas.projectId` committed (B3).
- [ ] `eas env:list` shows `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
      `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_SENTRY_DSN` for `production` **and**
      `preview` (B2).
- [ ] Distribution certificate + provisioning profile generated (EAS-managed signing is the
      default; `eas.json` sets no `credentialsSource`).
- [ ] **Commit first.** `eas build` archives committed git state; the working tree currently
      has 10 modified files and 2 untracked components (§6.1) that would silently not ship.

**Supabase**
- [ ] The four edge functions deployed: `parse-workout`, `explain-brief`, `explain-prediction`,
      `delete-account` (all four are called from the client — §6.4).
- [ ] `verify_jwt = true` applied for all four (`supabase/config.toml:5-19`).
- [ ] Secrets set: `ANTHROPIC_API_KEY`, and the service-role key available to the functions.
- [ ] All five migrations applied to the linked project, including `bump_parse_rate`
      (`supabase/migrations/20260716000000_init.sql:152-182`).
- [ ] Google OAuth provider configured with redirect `recore://` (the scheme is registered in
      `app.json`); Apple provider configured for `signInWithIdToken`.
- [ ] `supabase/tests/rls-verification.sql` run against the live project.

**Owner strings** (`RELEASE.md:18-31`)
- [ ] `SUPPORT_EMAIL` → a mailbox you read · [ ] `PUBLISHER` → the publishing entity ·
      [ ] `GOVERNING_LAW` → your jurisdiction · then `npm run build:legal` and host `docs/`.

---

## 6. Per-area findings

### 6.1 Build & release configuration

| Item | State |
|---|---|
| Expo SDK | `expo ^54.0.35`, installed 54.0.35; RN 0.81.5, React 19.1.0 — all match Expo's `bundledNativeModules.json` exactly. The only drift is `@expo/vector-icons ^15.0.2` vs expected `^15.0.3` (installed 15.1.1 satisfies both). No dependency problem to fix. |
| Third-party natives outside the SDK list | `@supabase/supabase-js`, `react-native-purchases` 10.5.0, `expo-speech-recognition` 3.1.3, `zustand`. All require a dev/EAS build; none works in Expo Go. |
| Bundle id | `com.recore.app` — production-ready, not `com.example.*`. |
| Display name | `"name": "Recore"` → `CFBundleDisplayName` at prebuild. The checked-out `ios/recore/Info.plist` says `recore` and `UIUserInterfaceStyle=Automatic`, but `ios/` is git-ignored (`.gitignore:38`) and untracked (`git ls-files ios` → 0 files), so EAS regenerates it from `app.json`; a fresh prebuild writes `UIUserInterfaceStyle=Light` from `"userInterfaceStyle": "light"` (confirmed in `@expo/prebuild-config/build/plugins/unversioned/expo-system-ui/withIosUserInterfaceStyle.js:22`). The stale local folder is not what ships. |
| Version / build number | `version 1.0.0`; no `ios.buildNumber` — correct **only** because `eas.json:4` uses `appVersionSource: "remote"` with `autoIncrement` on production. See B3. |
| Scheme / orientation | `scheme: "recore"`, plus `com.recore.app` and `exp+recore` URL types after prebuild. `orientation: "portrait"`. |
| EAS profiles | `development` (dev client, internal), `preview` (release build, internal distribution), `production` (`distribution: "store"`, autoIncrement) — a `preview` build is exactly what a first TestFlight upload wants. `submit.production` is `{}`, so `eas submit` prompts for Apple ID and ASC app id. Blockers B2, B3 and H7 apply. |
| Icon | `assets/images/icon.png` 1024×1024, **fully opaque** (alpha channel present but every pixel 255; corner `#F4F5EF`) — no transparency rejection risk, and prebuild would flatten it anyway (`withIosIcons.js:196` `removeTransparency`). Not the placeholder Expo icon. |
| Splash | `expo-splash-screen` configured with `splash-icon.png` (512×512, correctly transparent) at `imageWidth: 76` on `#FFFFFF`. Held until auth restore resolves (`src/app/_layout.tsx:15,61`). See §4 on the colour. |
| New architecture / Hermes | Hermes, `newArchEnabled: true` (`ios/Podfile.properties.json`) — the SDK 54 default, not an experiment. iOS deployment target 15.1 (`ios/Podfile:19`). |
| Experimental flags actually in use | `experiments.reactCompiler: true` in `app.json` and `expo-router/unstable-native-tabs` for the whole tab bar (`src/app/(tabs)/_layout.tsx:1`). Both work today; both are the things most likely to shift under a patch upgrade mid-beta. `expo-glass-effect` is guarded by `isLiquidGlassAvailable()` with a paper fallback (`src/components/glass.tsx:4,17-33`), so older iOS degrades rather than breaks. |
| Working tree | 10 modified files (incl. `src/app/(tabs)/you.tsx`, `note-surface.tsx`, `fix-sheet.tsx`) and 2 untracked new components (`entry-sheet-header.tsx`, `keyboard-done.tsx`). Uncommitted work does not reach an `eas build`. |

### 6.2 Apple compliance

- **Permission strings — present and specific.** In `app.json`, via the
  `expo-speech-recognition` plugin: `microphonePermission` = "Recore uses the microphone so you
  can dictate your workout."; `speechRecognitionPermission` = "Recore transcribes your dictation
  on-device to log your workout." Both land in `Info.plist` (confirmed in the generated
  `ios/recore/Info.plist`: `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`).
  Dictation is reachable from the onboarding demo before any account exists
  (`src/components/onboarding/ParseDemo.tsx:126,273`) and from Today's toolbar
  (`src/components/bottom-toolbar.tsx:170-179`); both go through `requestPermissionsAsync()`
  with a graceful `null` return when denied (`src/lib/voice.ts:33-37`).
- **Notifications.** `expo-notifications` plugin present; iOS needs no usage string. Permission
  is asked at two truthful moments — when a trial actually starts
  (`src/components/trial-started-sheet.tsx:65`) and when the user switches the weekly recap on
  (`src/lib/recap.ts:19-30`) — never during onboarding (`src/app/onboarding/[step].tsx:123-124`).
  Local notifications only; no push token is registered anywhere.
- **Privacy manifest.** `ios/recore/PrivacyInfo.xcprivacy` is generated by prebuild with
  FileTimestamp / UserDefaults / SystemBootTime / DiskSpace reasons and `NSPrivacyTracking=false`.
  The only third-party SDK with native code, RevenueCat, ships its own
  (`ios/Pods/RevenueCat/Sources/PrivacyInfo.xcprivacy`). There is no custom native code in the
  repo. Nothing missing for upload; see §4 on the empty `NSPrivacyCollectedDataTypes`.
- **`ITSAppUsesNonExemptEncryption`** — absent. **B4.**
- **Account deletion — implemented, in-app, immediate.** You → Account → Delete account
  (`src/app/(tabs)/you.tsx:1289-1296`) → confirm alert (`you.tsx:726-734`) →
  `deleteAccount()` (`src/lib/account/delete.ts`) → the `delete-account` edge function deletes
  the `auth.users` row with the service-role key using the id from the verified JWT
  (`supabase/functions/delete-account/index.ts:46-65`), then the local tables are wiped and the
  session signed out (`delete.ts:22-40`). Meets Guideline 5.1.1(v).
- **Sign in with Apple — present, and required.** Apple (`src/lib/auth/sign-in.ts:16-49`) and
  Google (`sign-in.ts:51-79`) are the two methods, both wired to Supabase; Apple is primary and
  is hidden when unavailable (`src/app/sign-in.tsx:35,41,86`). `usesAppleSignIn: true` plus the
  `expo-apple-authentication` plugin in `app.json`. Because Google exists, SIWA is mandatory —
  it is there.
- **Fabricated content — none found.** Grepping `src/` for ratings, star counts, testimonials,
  reviewer names and install counts returns only *comments recording their deletion*:
  `src/components/primitives.tsx:344-347` ("Stars / Rating / Testimonial were DELETED on 11 Aug
  2026"), `src/app/paywall.tsx:87-91` ("THE PROOF SLOT IS DELIBERATELY EMPTY"),
  `src/app/sign-in.tsx:27-28`. The paywall sells on outcomes (`paywall.tsx:101-105`) and a
  saving badge computed from two live store prices (`pricing.ts:36-48`), never an asserted one.
  The onboarding step list (`src/components/onboarding/config.ts`) has **no** social-proof
  screen; the old artwork survives only as the illustration for the neutral attribution
  question (`src/components/onboarding/illustrations.ts:96`). This area is clean.

### 6.3 Payments & paywall state

- **SDK.** `react-native-purchases` 10.5.0 is installed and genuinely wired: `configure`
  (`store.ts:70-79`), `logIn`/`logOut` account attachment (`store.ts:96-119`), `getOfferings`
  (`store.ts:168-186`), `getCustomerInfo` (`store.ts:145`), purchase and `restorePurchases`.
  Pods resolve to RevenueCat 5.81.3. The paywall is **not** UI-only.
- **What happens today when a tester taps the CTA.** With no key in the build, nothing: the
  button is disabled and labelled "Pricing unavailable" (`paywall.tsx:349,482,651`). With a key
  but no offering, the same, plus an honest notice ("Recore cannot reach the App Store right
  now…", `paywall.tsx:620-624`). With both present and signed out, the CTA pushes sign-in,
  remembers why, and completes the purchase when the session lands (`paywall.tsx:379-400`) —
  the correct order. No fake unlock, no crash, no dead navigation.
- **Recommendation for the first build.** Option (a), real products + sandbox, is *less* work
  than it looks and is the only one that leaves the purchase path tested: everything on the
  client side is already built, so it is App Store Connect and RevenueCat data entry. Option
  (b), a labelled beta bypass, is a code change to `state.ts:167-177` plus a CTA label, and it
  leaves both the purchase and the entitlement cache untested. Take (a) unless the Paid Apps
  agreement is genuinely blocked.
- **Restore.** Present on all three surfaces — paywall header (`paywall.tsx:518-528`), You
  (`you.tsx:912-918`), and the lapsed ledger (`src/components/read-only-ledger.tsx:6,75`) —
  with three distinct truthful outcomes (restored / nothing attached / could not reach the
  store, `paywall.tsx:415-424`).
- **Trial honesty.** Trial length, price and charge date all come from the store
  (`store.ts:150-166`, `paywall.tsx:480-486,662-665`); the "Nothing due today" line renders only
  when the selected plan really carries a trial (`paywall.tsx:638-642`). No hardcoded price
  survives anywhere in `src/` (`pricing.ts` holds only ids and arithmetic).

### 6.4 Backend & environment readiness

- **Keys.** No secret is committed. `.env` is git-ignored and holds only publishable values;
  `.env.example` (tracked) carries the same project URL and anon JWT by design, with the rule
  written above it (`.env.example:1-8`). `grep` for `sk-ant` / `service_role` over `src/`,
  `scripts/` and `docs/` finds only documentation lines (`README.md:22`, `scripts/parse-eval.ts:7`).
  The Anthropic key exists only in the edge-function environment
  (`supabase/functions/parse-workout/index.ts` reads `Deno.env.get('ANTHROPIC_API_KEY')`).
- **Env injection.** `process.env.EXPO_PUBLIC_*` at build time (`src/lib/env.ts:15-24`); locally
  from `.env` (visible in the lint run: `env: load .env`); for EAS, **nothing is declared** — B2.
- **Dev vs prod separation.** None. One project, `nkjrukxrocplesonotqo` — H6.
- **Edge functions: four in the repo, four called by the client, none orphaned.**
  `parse-workout` ← `src/lib/parse/client.ts:95` and `src/lib/demo-parse-remote.ts:46`;
  `explain-brief` ← `src/lib/brief-explain.ts:87`; `explain-prediction` ←
  `src/lib/predict/explain.ts:24`; `delete-account` ← `src/lib/account/delete.ts:36`. No client
  call has a missing counterpart, and no function is dead. Whether they are *deployed* is
  unverifiable from repo (§5).
- **Parser abuse surface — genuinely defended.** `parse-workout` requires an `Authorization`
  header, calls `auth.getUser()` and rejects with 401, caps input at 4000 chars / 100 lines,
  then charges a per-user counter of **30 calls / 10 minutes** through the `security definer`
  RPC `bump_parse_rate`, whose EXECUTE grant is revoked from `public`, `anon` and
  `authenticated` (`supabase/migrations/20260716000000_init.sql:152-182`). `verify_jwt = true`
  is declared for all four functions (`supabase/config.toml:5-19`). An unauthenticated client
  cannot burn the key. The one caveat is that the three AI functions share one counter (H5).
- **RLS — spot-checked and sound.** RLS is enabled on every table (`init.sql:188-194`),
  `parse_rate_limits` deliberately has *no* policy (service role only, `init.sql:195`), and the
  entries path is scoped per user at every level: `workouts` by `user_id = auth.uid()` for all
  four verbs (`init.sql:206-213`), `items` and `sets` by a join back to the owning workout
  (`init.sql:216-270`). `plan_days`, `corrections` and `alias_overrides` have their own owner
  policies. Reflections and per-exercise notes are columns on `workouts`
  (`20260729000000_reflections.sql`, `20260804000000_entry_notes.sql`), so they inherit its
  policies.
- **Offline first launch.** Onboarding is entirely local: the interactive demo parses with the
  on-device grammar and only *upgrades* to the server when a session already exists
  (`src/lib/demo-parse-remote.ts:11-13` returns `null` with no session), so a tester in airplane
  mode still sees their line read. Answers persist synchronously into SQLite through a zustand
  `persist` adapter (`src/state/onboarding.ts:56-60`), so a kill mid-flow resumes on the same
  step (`src/app/index.tsx:53`). Writing is local-first: text hits SQLite immediately and the
  parse is queued as `needs_parse`, retried by the sync pass (`src/lib/sync/index.ts:69-95`),
  which fails quietly when offline. The honest exception: the **paywall** needs the network to
  show a price, so an offline first-run ends on a disabled CTA — worth saying in §7.

### 6.5 Stability & failure modes

- **Error boundary:** none at audit time — **fixed 21 Aug 2026** (H2, `components/error-screen.tsx`).
  **Crash reporting:** none at audit time — **fixed 21 Aug 2026** (H1, `lib/crash.ts`, dark until
  a DSN is compiled in).
- **Console noise:** clean. Exactly two `console.*` calls in `src/`, both inside `__DEV__`
  guards in `src/lib/log.ts:9,15`.
- **`__DEV__`-only behaviour, all correctly compiled out:** the paywall `DEV · SKIP` chip
  (`paywall.tsx:506`), the You → Dev section with "Simulate lapsed subscription" and "Run
  illustrated onboarding" (`you.tsx:1312-1337`), the analytics echo (`analytics.ts:129`),
  RevenueCat log level (`store.ts:73`), and the entitlement override (`state.ts:169,354,360`).
  The last one is exactly right for safety and exactly why B1 bites only in release.
- **Debug or test routes in production navigation:** none. The route tree is `index`,
  `onboarding/[step]`, `paywall`, `legal`, `sign-in`, `(tabs)/{today,next,progress,you}`,
  `import-start`, `split`, `plan-day`, `lifts`, `aliases`, `health` — every one a real product
  surface (`src/app/_layout.tsx:82-114`).
- **Swallowed rejections.** Deliberate and documented, but they are the reason a beta feels
  opaque: parse failure → `devLog` + `null` (`parse/client.ts:96,99,120`); sync pass failure →
  `devLog` (`sync/index.ts:88`); store configure / attach / offerings / entitlement failures →
  `devLog` + `false`/`null` (`store.ts:76,105,183`); profile upsert failure → `devLog`
  ("non-fatal", `auth/sign-in.ts:48`); support mail failure → `false` and a "no mail app" line
  (`support.ts:35-40`). Sign-in errors *are* surfaced (`sign-in.tsx:110-113`), as are purchase,
  restore, export, import and deletion outcomes. The gap is the parser (H5).

### 6.6 Product completeness for testers

| Surface | State |
|---|---|
| `onboarding/[step]` (15 screens) | **Implemented.** welcome · tracker · obstacles · demo · why-written · goal · experience · about-you · days · key-lifts · overload · commitment · attribution · recap · projection (`src/components/onboarding/config.ts:184-460`). Every screen has real artwork except the demo, which is typographic by design (`illustrations.ts:74-101`) — no placeholder boxes (asserted by `illustration-layout.test.ts:102`, passing). |
| Onboarding persistence | **Yes.** Step and answers are written synchronously to SQLite (`state/onboarding.ts:56-60`); completion is a `meta` flag (`src/lib/prefs.ts:83-89`) set in `completeFlow()` (`src/app/onboarding/[step].tsx:187`). Kill mid-flow → resume on the same step; kill after → the dispatcher sends you on (`src/app/index.tsx:53-66`). |
| `paywall` | **Implemented**, but inert without provisioning — B1. |
| `sign-in` | **Implemented** (Apple + Google). Prints developer text if env is missing — B2. |
| `(tabs)/today` | **Implemented**: free-text note surface, per-line cards, fix sheet, rest timer, dictation, Finish → check-in sheet, day swipe, calendar. An empty day is the header plus a blank page, deliberately (`today.tsx:82-95`). Becomes the read-only ledger when lapsed (`today.tsx:92`). |
| `(tabs)/next` | **Implemented** with three real states: a skeleton while the account resolves, a designed empty state ("Write two sessions and this fills itself", `next.tsx:204-232`), and the brief. |
| `(tabs)/progress` | **Implemented**, with a designed empty state that offers the Hevy/Strong import (`progress.tsx:281-311`). |
| `(tabs)/you` | **Implemented and complete for beta**: profile, subscription (state + manage + restore), training settings, weekly recap, body context, split, alias corrections, import, export (CSV/JSON), Apple Health, display, support, privacy/terms/parsing, restart onboarding, version, clear cache, **delete account**, **sign out**. |
| `import-start`, `split`, `plan-day`, `lifts`, `aliases`, `legal` | **Implemented.** |
| `health` | **Implemented as an honest explainer**, not a stub: "Recore does not read or write Apple Health" (`src/app/health.tsx:44`). The only `TODO(owner)` in `src/` sits in its header comment (`health.tsx:14`) and describes exactly this. |
| Lorem ipsum / `{placeholder}` / unfinished copy | **None.** Every `placeholder` hit in `src/` is a `placeholderTextColor` prop or a comment. |
| Sunday recap | Real local notification, but single-shot and re-armed on app open — H4. |
| Settings minimum for beta | Sign out ✓, delete account ✓, privacy policy ✓ (in-app, plus generated HTML), support contact ✓ (mailto — B5 on the address). |

### 6.7 Legal & metadata (manual, outside the repo)

What must exist in App Store Connect is listed in §5. What the code says about it:

- **Privacy policy / Terms** exist as first-class in-app screens (`src/app/legal.tsx`, content in
  `src/lib/legal.ts`), are linked from the paywall *before* any account exists
  (`paywall.tsx:673-677`) and from You (`you.tsx:1258-1259`), and are generated to
  `docs/privacy.html` / `docs/terms.html` by `npm run build:legal` — currently in sync with
  `legal.ts` (same commit `d8ec7ee`, same mtime). They still need hosting (B5).
- **EULA:** Apple's standard EULA is referenced by URL rather than rewritten
  (`legal.ts:44-45`), which is the correct, cheaper choice for an auto-renewable subscription.
- **App Privacy questionnaire — what this codebase actually collects.** Verified against code,
  not against the marketing:

  | Data | Collected? | Where it is written |
  |---|---|---|
  | Email address | Yes, linked, App Functionality | `auth/sign-in.ts:44-47` upserts `profiles.email` |
  | Name | Yes when the provider supplies it (Apple may hide it) | `auth/sign-in.ts:37-43` |
  | User ID | Yes, linked | Supabase `auth.uid()`; also sent to RevenueCat via `Purchases.logIn` (`store.ts:100`) |
  | User content (workout text, sets, reflections, per-exercise notes) | Yes, linked, App Functionality | `workouts.raw_text`, `reflection`, `entry_notes` |
  | Onboarding answers incl. attribution, optional bodyweight/height | Yes, linked | `src/lib/prefs.ts`, synced with the account's `meta` |
  | Usage data / analytics | **No third party.** Counters stay on device (`src/lib/funnel.ts:3-12`) and ride along in the user's own export (`export-json.ts:180`); `analytics.flush()` is a no-op (`analytics.ts:175`) | |
  | Diagnostics / crash data | **Yes since 21 Aug 2026**, **not** linked to the user, App Functionality — but only in a build carrying `EXPO_PUBLIC_SENTRY_DSN` | `src/lib/crash.ts`; policy section "If Recore crashes" in `src/lib/legal.ts` |
  | Location, contacts, photos, health, advertising id | No — no such API is called | |
  | Tracking across apps | No — `NSPrivacyTracking=false`, no ATT prompt, no IDFA | |

  Processors, as the policy states and the code confirms: Supabase (hosting, auth, functions),
  Anthropic (note text, via the edge function only), Apple (payments), RevenueCat (account id +
  purchase state) and, since 21 Aug 2026, **Sentry** (crash reports only, with no identifier
  attached). `RELEASE.md:118-133` carries the same table.
- **Beta App Review** needs a demo account, because everything past the paywall is behind
  `session !== null` (`_layout.tsx:92`).

### 6.8 Tester experience

- **Feedback channel:** exists — You → Contact support opens a pre-filled mail carrying only app
  version and OS (`src/lib/support.ts:20-40`), and returns `false` (with a visible fallback line)
  when the device has no mail account. It is only as good as `SUPPORT_EMAIL` (B5). TestFlight's
  own feedback (screenshot + notes) covers the rest and needs no code.
- **Analytics:** the event layer is wired at the call sites that matter —
  `onboarding_screen_view` / `_complete` / `_answer`, `onboarding_demo_parsed` / `_failed`,
  `paywall_view`, `paywall_cta_tap` (`analytics.ts:43-58`, e.g. `paywall.tsx:273,394`) — plus a
  38-field local funnel snapshot (`funnel.ts:286-378`). **Nothing leaves the device**: the sink
  is a no-op and the events are not even in the export (H3). Practical consequence for the first
  beta: you will learn *whether* a tester subscribed only by asking them or by reading
  RevenueCat; you will not see where the other testers dropped out.
- **Known-broken list for testers:** see §7 — the honest set is the disabled paywall (if B1
  ships unresolved), the single-shot recap (H4), silent pending cards after ~30 AI calls in 10
  minutes (H5), and Apple Health being deliberately absent.
@
---

## 7. Proposed "What to Test" note

Paste into TestFlight once B1–B5 are cleared; drop the bracketed step if billing is bypassed.

```
Recore is a training log you write in ordinary words. It reads what you typed into a
structured record, and it works fully offline — your writing never waits for anything.

Please try these, in this order:

1. ONBOARDING, ALL THE WAY THROUGH. Take it at normal speed. On the demo screen, type a
   real line of your own ("bench 3x8 80kg", or dictate it with the mic) and check that
   what comes back matches what you meant. Tell us any screen where you hesitated or
   thought about quitting.
[2. THE TRIAL. Start the 7-day trial. Check that the price, the trial length and the date
   on the screen match what Apple's purchase sheet says.]
3. LOG A REAL SESSION BY TYPING. One lift per line, your own shorthand. Supersets,
   dropsets, RIR, "felt heavy" — write it however you write it. Long-press a card that
   was read wrong and fix it; the fix should stick for that line forever.
4. LOG ONE BY VOICE. Tap the mic in the bottom bar mid-session, speak a set, stop.
5. FINISH, THEN THE CHECK-IN. Press Finish, then write a few words about how it went (or
   skip it — it is optional).
6. THE NEXT TAB. After two sessions of the same lift, Next should show your next session
   with a load and the reason beside it. Tell us if a number looks wrong — the numbers
   are computed from your own sets, so a wrong one is a real bug.
7. THE WEEK. Progress → per-lift lines; You → training days, weekly split, and Export my
   record (CSV or JSON). Import from Strong or Hevy if you have a file.
8. AIRPLANE MODE. Turn it on, write a full session, finish it. Nothing should be lost.
   Turn the network back on and check that the reading catches up.

ALREADY KNOWN — please do not report these:
· A line can sit as plain text for a while before it is read into cards. That is the
  reading catching up; it retries by itself. After roughly 30 readings in 10 minutes it
  pauses quietly for a few minutes.
· The weekly recap notification only re-arms when you open the app, so it can be late or
  missing if you have not opened Recore that week.
· Apple Health is not connected — the screen in You says so on purpose.
· The paywall shows no price when the App Store cannot be reached (e.g. offline).
· If a screen fails, Recore shows a page saying so and prints what the error said. Please
  screenshot that line — it is the fastest bug report there is.

Feedback: screenshot / shake in TestFlight, or You → Contact support.
```
