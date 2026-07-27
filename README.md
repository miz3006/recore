# Recore

A workout log you **write in** — like Apple Notes, but it understands training.
Type a messy free-form note (`bench 3x8 80kg superset with flyes 12x`) and the
app parses it into clean structure, compares each line against your previous
session in the right gutter, and pre-fills your next session as ghost text.

Local-first: every keystroke is saved to on-device SQLite instantly and synced
to Supabase in the background. The app works fully offline.

See `CLAUDE.md` for the product spec, `PLAN.md` for the build order, and
`SECURITY.md` for the security model and the one-time backend setup (Supabase
project, OAuth providers, model key).

## Run it

Recore does **not** run in Expo Go. Six things it depends on are native and Expo
Go cannot carry any of them: Sign in with Apple, the Keychain, the Liquid Glass
tab bar, Live Activities, on-device speech recognition, and RevenueCat
(CLAUDE.md §19.1). Development happens in a **development build** — this repo
compiled with `expo-dev-client` in it.

### Prerequisites

- **Xcode 16.1+**, and **26+** to build against iOS 26 (Liquid Glass).
- **CocoaPods** — `brew install cocoapods`.
- **Node 22+**.
- **~15 GB free disk.** Pods and DerivedData for a React Native debug build are
  large, and `pod install` reports exhaustion as `No space left on device` from
  inside an rsync rather than as anything legible.
- A **paid Apple Developer Program** membership — only for the device path, see
  [On a physical device](#on-a-physical-device).

### 1 · Backend (once)

```bash
supabase link --project-ref <ref>
supabase db push                                  # applies migrations + RLS
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... # server-side only, never in the app
supabase functions deploy parse-workout
```

...then enable Apple + Google under Authentication → Providers. `SECURITY.md`
has the exact fields.

### 2 · Client env

```bash
cp .env.example .env      # Supabase URL + anon key. Nothing else is ever public.
```

### 3 · The development build

```bash
npm install
npm run ios               # → npx expo run:ios
```

That one command generates `ios/`, runs `pod install`, compiles, installs the
app on the booted simulator, and starts Metro. The first run takes 10–20
minutes; subsequent runs are incremental.

To choose a target, or to build onto a plugged-in phone:

```bash
npx expo run:ios --device                    # pick from a list
npx expo run:ios --device "iPhone 17 Pro"    # by name or UDID
```

Once the build is installed, changing JavaScript does not need a rebuild — run
`npm start` and open the app.

### `ios/` and `android/` are generated

This project uses continuous native generation: both folders are produced from
`app.json` and are **gitignored**. Never edit them by hand and never commit
them — the next prebuild overwrites the change and it is gone without a trace.

Re-run prebuild after anything that changes native configuration: a dependency
with native code, a config-plugin change, an `app.json` edit.

```bash
npx expo prebuild --platform ios --clean
```

### On a physical device

`npx expo run:ios --device` works with a free personal Apple team, but **Sign in
with Apple does not**. That capability requires a paid Apple Developer Program
membership with the capability enabled on the `com.recore.app` App ID. On a free
personal team the app installs and runs, the Apple button is unavailable, and
the provisioning profile expires seven days after it is issued.

### Verifying the build

Every development launch prints one line to the Metro console:

```
[recore] native · dev build · fabric ok · apple sign-in ok · keychain ok · speech ok
         · glass ok · symbols ok · blur ok · live-activity ok · purchases ok
```

Every field must read as above. The last five are the libraries installed in 0.5;
nothing uses them yet, and each is gated at runtime through `src/lib/capabilities.ts`
so a missing one degrades rather than crashes.

| Reads | Means |
|---|---|
| `Expo Go` instead of `dev build` | You are running the wrong binary — Expo Go cannot carry the entitlements below. |
| `fabric FAIL` | The New Architecture is off. Reanimated 4 and the whole motion system require it (CLAUDE.md §19.2). Check `newArchEnabled` in `app.json`, then re-run prebuild. |
| `apple sign-in FAIL` | The `com.apple.developer.applesignin` entitlement is missing. Check `usesAppleSignIn` in `app.json`, then re-run prebuild. |
| `keychain FAIL` | SecureStore cannot reach the Keychain. The Supabase session will not survive a relaunch. |
| `speech FAIL` | `expo-speech-recognition` did not autolink. Dictation is silently off. |
| `glass FAIL` | Liquid Glass is unavailable — expected below iOS 26, and the `Glass` primitive falls back to blur, then solid (§6.9). |
| `symbols` / `blur` / `live-activity` / `purchases` `FAIL` | That library did not autolink. Re-run `npx expo prebuild --platform ios --clean`. |

The source is `src/lib/native-check.ts`. It runs under `__DEV__` only, reads
nothing the user wrote, and is compiled out of release bundles.

## Scripts

```bash
npm start            # Metro, against an already-installed development build
npm run ios          # build and run on iOS
npm run typecheck    # tsc --noEmit
npm test             # node --test, pure modules
npm run lint         # expo lint
npm run eval         # parser eval harness against the real prompt
```

## Layout

```
src/app/                 expo-router routes: dispatcher, onboarding, paywall,
                         sign-in, stats, settings, split, plan-day
src/components/          note surface, cards, sheets, right gutter, ghost
                         prediction, bars, motion primitives
src/lib/db/              SQLite source of truth (schema mirrors Postgres)
src/lib/parse/           edge-fn client, response validation, apply → items/sets
src/lib/predict/         prediction engine, split matching, adherence
src/lib/plan/            user-declared weekly split → plan rows
src/lib/import/          Hevy / Strong / generic CSV
src/lib/theme/           colour, type, spacing, elevation, scale
src/lib/sync/            background push/pull to Supabase
src/lib/auth/            Apple / Google sign-in + session provider
src/state/               zustand stores
supabase/migrations/     Postgres schema + Row Level Security
supabase/functions/      parse-workout + explain-prediction (server-side model call)
supabase/tests/          RLS cross-user isolation test
```
