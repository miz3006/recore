# Recore

A workout log you **write in** — like Apple Notes, but it understands training.
Type a messy free-form note (`bench 3x8 80kg superset with flyes 12x`) and the
app parses it into clean structure, compares each line against your previous
session in the right gutter, and pre-fills your next session as ghost text.

Local-first: every keystroke is saved to on-device SQLite instantly and synced
to Supabase in the background. The app works fully offline.

See `CLAUDE.md` for the product spec and `SECURITY.md` for the security model
and the one-time backend setup (Supabase project, OAuth providers, AI key).

## Run it

```bash
npm install

# 1. Backend (once): create a Supabase project, then
supabase link --project-ref <ref>
supabase db push                                  # applies migrations + RLS
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... # server-side only, never in the app
supabase functions deploy parse-workout
# ...and enable Apple + Google in Authentication → Providers (see SECURITY.md)

# 2. Client env
cp .env.example .env                              # fill in URL + anon key

# 3. Native dev build (Apple sign-in + Keychain need real entitlements)
npx expo run:ios
```

Useful scripts: `npm run typecheck`, `npm run lint`.

## Layout

```
src/app/                 expo-router routes (home, sign-in, stubs)
src/components/          note surface, right gutter, ghost prediction, bars
src/lib/db/              SQLite source of truth (schema mirrors Postgres)
src/lib/parse/           edge-fn client, response validation, apply → items/sets
src/lib/predict/         prediction engine (placeholder math, final plumbing)
src/lib/sync/            background push/pull to Supabase
src/lib/auth/            Apple / Google sign-in + session provider
supabase/migrations/     Postgres schema + Row Level Security
supabase/functions/      parse-workout edge function (server-side AI call)
supabase/tests/          RLS cross-user isolation test
```
