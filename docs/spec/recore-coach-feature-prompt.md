# GOAL: Coach ↔ Client layer in Recore (MVP)

A coach can link to a client, see the client's logged workouts from the coach's own profile, and leave comments on a whole workout or on a specific exercise. The client sees the comments, gets a push notification, and can reply. The client owns their data and can revoke access at any time.

Real-world trigger: a coach currently runs clients in Excel, where the client has no way to say how a specific exercise felt. In Recore the client already logs free text per exercise ("last set grindy, knee a bit off"), so the coach gets that context for free. This feature closes the loop.

---

## Context (read before touching anything)

- Recore: React Native + Expo, solo-built hybrid fitness app (running + gym, Hyrox-style athletes).
- Core: free-text logging → tiered parser (alias cache → grammar → LLM fallback) → structured data + progressive overload advice.
- Product philosophy: advisor, not dictator. The user owns their program and their data.
- Visual language: cream/ink editorial aesthetic (Wabi / iA Writer feel). Use existing theme tokens and typography only; no new colors, no new component library.
- Logging speed and the ghost line are sacred. Nothing in this feature may add latency to the logging flow.
- Golden parser suite (`golden.json` + `run-golden.ts`) must still pass at the end.

---

## Phase 0: Discovery (do this first, then STOP and report)

> If discovery was already done and a plan was approved earlier in this session, skip Phase 0 and follow that approved plan.

Inspect the repo and answer, with file paths:

1. Where are workouts stored today? (AsyncStorage / SQLite / MMKV / remote?) What is the exact shape of a workout, exercise, and set?
2. Is there any auth or user account system? Any backend or Supabase setup?
3. Does each exercise inside a workout have a stable ID? If not, what could serve as a stable `exercise_ref`?
4. Which component renders a completed workout (detail view)? Can it be rendered read-only for another user's data without forking it?
5. Which component is the RIR feedback bottom sheet? (Comment sheet should reuse its pattern.)
6. Where is the Profile screen and how is navigation structured (expo-router / react-navigation)?
7. Is push notification infra present (expo-notifications, tokens stored anywhere)?

Then propose a short implementation plan. **If workouts are local-only**, the plan must include Phase 0.5 below. Wait for my confirmation before writing code.

### Phase 0.5 (only if data is local-only): Accounts + cloud sync

- Supabase Auth: Sign in with Apple + email magic link. Account is optional for solo users; required only to use coaching.
- Local storage stays the source of truth for logging. Sync is background, never blocking.
- Workouts get client-generated UUIDs; upsert to Supabase with `updated_at` last-write-wins; soft delete via `deleted_at`.
- On first sign-in, upload existing local history once, with progress UI and safe retry.
- Sync must survive offline use and app kills (queue pending writes).

---

## Phase 1: Database (Supabase migrations in `supabase/migrations/`)

Adapt names to the existing `workouts` table if one exists. If creating it, minimum: `id uuid pk`, `user_id uuid`, `performed_at timestamptz`, `raw_text text`, `parsed jsonb`, `created_at`, `updated_at`, `deleted_at`.

```sql
-- Profiles (display name visible to linked coach/client)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Invites: coach generates a short code, client redeems it
create table public.coach_invites (
  code text primary key,
  coach_id uuid not null references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references auth.users,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Coach ↔ client relationship (no global "coach role"; the link defines access)
create type public.coach_link_status as enum ('active', 'revoked');
create table public.coach_clients (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users on delete cascade,
  client_id uuid not null references auth.users on delete cascade,
  status public.coach_link_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (coach_id <> client_id)
);
-- MVP: one active coach per client
create unique index one_active_coach_per_client
  on public.coach_clients(client_id) where status = 'active';
create index on public.coach_clients(coach_id) where status = 'active';

-- Comments on a workout or on one exercise inside it
create table public.workout_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_ref text,               -- null = comment on the whole workout
  author_id uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz              -- set when the other party opens the thread
);
create index on public.workout_comments(workout_id, created_at);

-- Push tokens
create table public.push_tokens (
  user_id uuid not null references auth.users on delete cascade,
  token text not null,
  platform text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
```

### Helper + RPCs (all `security definer`, `set search_path = public`)

```sql
create or replace function public.is_active_coach_of(p_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_clients
    where coach_id = auth.uid() and client_id = p_client and status = 'active');
$$;
```

- `create_coach_invite() returns text` — 6-char code, alphabet without ambiguous chars (no 0/O/1/I/L), uppercase, retry on collision. Max 5 unredeemed, unexpired invites per coach.
- `redeem_coach_invite(p_code text) returns uuid` — lock row `for update`; reject if not found / expired / already redeemed / self-invite / client already has an active coach (distinct error codes: `invalid_or_expired`, `self_invite`, `already_has_coach`). Insert `coach_clients`, mark invite redeemed. Redeeming = the client's consent.
- `revoke_coach_link(p_link_id uuid)` — callable by either coach or client; sets `status='revoked'`, `revoked_at=now()`.
- `mark_comments_read(p_workout_id uuid)` — sets `read_at` on comments in that workout where `author_id <> auth.uid()` and caller is a participant.
- `coach_client_overview()` — for the calling coach: `client_id, display_name, last_workout_at, unread_count` (unread = client-authored comments with `read_at is null`), ordered by `last_workout_at desc`.

### RLS (enable on every table above)

- `workouts` SELECT: `user_id = auth.uid() or is_active_coach_of(user_id)`. INSERT/UPDATE/DELETE: owner only (keep existing).
- `workout_comments` SELECT: caller owns the workout OR is active coach of its owner. INSERT: same check AND `author_id = auth.uid()`. DELETE: own comments only. No direct UPDATE (read state via RPC).
- `coach_clients` SELECT: `coach_id = auth.uid() or client_id = auth.uid()`. No direct INSERT/UPDATE (RPCs only).
- `coach_invites` SELECT: `coach_id = auth.uid()`. No direct INSERT (RPC only).
- `profiles` SELECT: own row, or any user linked to caller by an active link (either direction). UPDATE: own row.
- `push_tokens`: owner only, full CRUD.

Consequence to verify: revoking a link immediately cuts the coach's read access at DB level. Existing coach comments stay visible to the client.

Regenerate TypeScript types after migrations.

---

## Phase 2: Linking flow (UI)

Entry point: **Profile → new "Coaching" section.**

Coach side:
- "Invite a client" → calls `create_coach_invite` → shows the code large + share sheet with a deep link (`recore://coach/join?code=XXXXXX`) and expiry text.
- "Clients (n)" row → client list (Phase 3). Row hidden if no active clients.

Client side:
- "Join a coach" → code input (auto-uppercase, 6 chars) OR opened via deep link with code prefilled.
- Confirmation screen before redeeming: "[Coach name] will be able to see your workouts and comment on them. You can remove access anytime." → Confirm.
- Once linked: "Your coach: [Name]" + "Remove access" (confirm dialog → `revoke_coach_link`).
- Map RPC error codes to human copy.

Coaching requires an account: if signed out, route through sign-in first and return to the same step.

---

## Phase 3: Coach views client workouts

1. **Client list** (from `coach_client_overview`): name, relative "last workout" time, unread dot/count. Pull to refresh. Empty state points to "Invite a client".
2. **Client feed**: paginated (20 per page) list of that client's workouts, newest first, each with date, workout summary, and comment count.
3. **Workout detail (read-only)**: reuse the existing workout detail component with a `readOnly` / `viewer="coach"` mode. Hide every edit / Fix Reading / log action. Show the client's raw free text per exercise; it is the most valuable context for the coach.
4. On each exercise row and at workout level: a subtle comment affordance with count. Tap → **comment sheet**.
5. Opening a thread calls `mark_comments_read`.

Do not show the client's AI overload recommendations or paywall-gated data in the coach view in this MVP; just the logged workout.

---

## Phase 4: Comments (both sides)

- Comment sheet = same interaction pattern and styling as the RIR feedback sheet. Thread of messages (author name, relative time), input at bottom, send button.
- Scope label at the top: "Whole workout" or the exercise name.
- Client sees an indicator on workouts that have comments (unread = emphasized) in their normal history and workout detail; same sheet, can reply.
- Optimistic send with rollback + retry on failure. Comments need network; show a clear offline state, never lose typed text.
- Optional if cheap: Supabase Realtime subscription on `workout_comments` filtered by `workout_id` while a sheet is open.

---

## Phase 5: Push notifications

- Register Expo push token after sign-in (with permission prompt at a sensible moment, e.g. right after linking, not on app launch). Upsert into `push_tokens`.
- Database webhook on `workout_comments` INSERT → Edge Function `notify-comment`:
  - author is coach → notify workout owner; author is client → notify their active coach.
  - Title: author name. Body: first ~80 chars of comment. Data: `{ workoutId, exerciseRef }`.
  - Remove tokens that Expo reports as `DeviceNotRegistered`.
- Tapping a notification deep-links to the workout detail with the comment sheet open on the right scope.

---

## Non-goals (do NOT build now)

- Coach-authored plans/programs that the client sees for the day (next phase; keep schema open to it).
- Coach editing client workouts.
- General chat outside of workouts.
- Multiple coaches per client, teams, web dashboard.
- Coach pricing / paywall logic. Put the whole feature behind a `coachMode` feature flag.

---

## Edge cases to handle

- User is both a coach and has their own coach: both parts of the Coaching section work independently.
- Client deletes a workout → comments cascade away; coach feed updates.
- Link revoked while coach has the feed open → next fetch fails gracefully → return to client list with a neutral message.
- Invite redeemed twice simultaneously → only one succeeds (row lock).
- Account deletion cascades through everything above.

---

## Testing

- **RLS tests** (SQL script or pgTAP) with three users (coach, client, stranger): stranger sees nothing; coach sees only active clients; access disappears after revoke; nobody can insert a link or invite directly; comment author spoofing is rejected.
- RPC tests for every error code in `redeem_coach_invite`.
- Manual scenario script I can run on two devices/simulators: invite → join → log workout as client → comment as coach → push arrives → reply → revoke → coach loses access.
- `run-golden.ts` passes unchanged. Logging flow has no new network calls on the hot path.

---

## Acceptance criteria

- [ ] Coach can invite, client can join with code or link, both can revoke.
- [ ] Coach sees each client's workouts (read-only) from Profile → Coaching → Clients.
- [ ] Coach can comment on a whole workout or a single exercise; client sees and replies.
- [ ] Unread indicators work on both sides.
- [ ] Push notification deep-links to the right workout + thread.
- [ ] All access enforced by RLS, verified by tests.
- [ ] Visuals match the existing cream/ink system; no new tokens.
- [ ] Feature fully hidden when `coachMode` is off.

## Deliverables

Migrations, generated types, Edge Function, UI changes, tests, and a short summary listing: files changed, any deviations from this spec and why, and open questions.
