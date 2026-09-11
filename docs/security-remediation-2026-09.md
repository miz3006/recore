# Security remediation — September 2026

**Opened 10 September 2026 · adversarial review of `src/` (362 files, 79 232 lines), 4 edge
functions, 5 migrations, `scripts/`, configuration, git history and the dependency tree.**

This document is the work list for that review, and it is written so an item can only be
recorded as fixed after a check has observed it fixed.

**Every `file.ts:12-34` reference below points at the code AS IT WAS at `841619f`**, before any
remediation. The line numbers moved when the fixes landed on 10 September; the file paths and the
reasoning did not. Read them as "this is where the finding was", not as a current address. Every finding below has a matching
check in `scripts/security-verify.sh`. That script is the arbiter — not the person who wrote
the patch, and not this file's prose.

---

## The rule for closing an item

An item moves to **FIXED** only when all four of these have happened, in this order:

1. **Fix** — apply the change described in the item's *Fix* block.
2. **Verify** — run `./scripts/security-verify.sh <ID>`. Every line for that ID must print
   `PASS`. A `SKIP` is not a `PASS`: it means the check could not run (usually offline), and
   the item stays open until it has been re-run somewhere it can.
3. **Gate** — run `./scripts/security-verify.sh GATES`. Typecheck, tests and lint must pass,
   because a security fix that breaks the build is not a fix (CLAUDE.md §5.5).
4. **Record** — three edits, in the same commit as the fix:
   - flip the item's row in the **Status ledger** below to `✅ FIXED`, with the date and the
     short commit hash;
   - paste the verifier's actual output into the item's **Evidence** block — the real lines,
     not a summary of them;
   - add a dated line to the **Change log** at the foot of this file, and a matching entry in
     `docs/implementation-status.md` (CLAUDE.md §5.7).

If a check passes for the wrong reason, fix the check, not the record. Two checks in the first
draft of the verifier passed against unfixed code — `delete-account` matched the word "rate" in
a comment, and the `alias_overrides` RLS check matched a test that mentioned the table without
testing it. Both were tightened to exact markers before this document was written. Expect more
of that, and treat a surprising `PASS` as a bug in the check.

**Three more were wrong, and were fixed during the 10 September remediation.** The rule turned
out to cut both ways — a check can also FAIL for the wrong reason, which is worse, because a
false failure looks like diligence:

- **S8 could never pass.** It used `grep -rzq` on the assumption that `-z` makes grep treat a file
  as one buffer so a multi-line policy matches. That is true of GNU grep. On this machine `grep`
  is **ugrep**, where `-z` means *decompress* — so the pattern could not match whatever the
  migration said. Replaced with `scripts/check-alias-policy.py`, which has no such ambiguity, and
  tightened while there: **both** the insert and the update policy must now constrain
  `exercise_id`, because insert alone could be satisfied on creation and then walked to another
  user's row by an update.
- **S6's check moved with its subject.** `RISKY_LEAD` now lives in `src/lib/csv-field.ts` — a
  pure module, because `export-csv.ts` reaches expo-sqlite through `db/index` and therefore cannot
  be imported under `node --test`, which would have left the rule untestable. The check grew from
  two lines to four: the rule must exist, `export-csv.ts` must still name it, the free-text column
  must actually route through `csvField`, and the test must exercise the rule rather than merely
  exist.
- **S2's entitlement check would have passed on a gate that lets everyone through.** It matched
  the word "entitle" anywhere in the three functions. It now requires the call *and*, on a
  separate line, that enforcement is on by default — which it is not yet, deliberately, so S2
  stays visibly open instead of being closed by a grep. See S2's own section.

The count in the baseline above and the count at the foot of this document therefore differ by
three added lines, not by three fixes.

Do not batch. One item, one commit, one verified close.

### Baseline

Captured 10 September 2026 against `native-feel/check-in-form-sheet` at `841619f`, before any
remediation:

```
4 passed · 30 failed · 0 skipped     (exit code 30)
```

The 4 passes are S15 and the three repository gates. Everything else fails. That number is the
starting line: it should only ever go down.

**Correction, 10 September 2026 (same day, during remediation).** Re-running that command before
touching anything gave **3 passed · 31 failed**, not 4 · 30. The missing pass was `lint`, and it
was not a real regression: `npm run lint` is `expo lint`, which uses ESLint's cache by default,
and the cache held a stale entry claiming `src/components/lifts-screen.tsx` contained a merge
conflict marker. There is no such marker anywhere in the repository — the file parses cleanly
under both `hermes-parser` and `@babel/parser`, `npx eslint .` reports nothing, and
`npx expo lint --no-cache` reports **0 errors**. The entry survived the rename of
`src/app/lifts.tsx` → `src/components/lifts-screen.tsx`. Running once with `--no-cache` refreshed
it and the gate has been green since.

Worth recording for its own sake: **a cached gate is not a gate.** For most of a day this
repository would have refused to close any item, for a defect that did not exist. If a gate here
ever fails for a reason you cannot reproduce in a fresh run, suspect the cache before the code.

The two counts are not directly comparable to the ones below in any case: three checks have been
added since (see the change log), so the run at the foot of this document totals 37 lines rather
than 34.

---

## Status ledger

| ID | Severity | Finding | Status | Closed | Commit |
|---|---|---|---|---|---|
| **S1** | 🔴 Critical | `app.zip` containing `.env` is pushed to a public GitHub repo | 🟡 PARTIAL | 10 Sep 2026 | working tree |
| **S2** | 🔴 Critical | Open signup + no entitlement check = unmetered access to the Anthropic key | 🟡 PARTIAL | 10 Sep 2026 | working tree |
| **S3** | 🔴 Critical | Hardcoded dev credential in a public repo, pointed at production | 🟡 PARTIAL | 10 Sep 2026 | working tree |
| **S4** | 🟠 High | `explain-prediction` has no output guard — the model can write a number | ✅ FIXED | 10 Sep 2026 | working tree |
| **S5** | 🟠 High | Guard rejections are neither counted nor alarmed | ✅ FIXED | 10 Sep 2026 | working tree |
| **S6** | 🟡 Medium | CSV formula injection on export | ✅ FIXED | 10 Sep 2026 | working tree |
| **S7** | 🟡 Medium | Session keychain item syncs to iCloud / restores to another device | ✅ FIXED | 10 Sep 2026 | working tree |
| **S8** | 🟡 Medium | `alias_overrides.exercise_id` accepts another user's row | ✅ FIXED (unapplied) | 10 Sep 2026 | working tree |
| **S9** | 🟡 Medium | `.env.example` (tracked) holds live project values | ✅ FIXED | 10 Sep 2026 | working tree |
| **S10** | 🟢 Low | CSV import is unbounded in size and row count | ✅ FIXED | 10 Sep 2026 | working tree |
| **S11** | 🟢 Low | Wildcard CORS on all four edge functions | ✅ FIXED (undeployed) | 10 Sep 2026 | working tree |
| **S12** | 🟢 Low | `delete-account` has no rate limit | ✅ FIXED (undeployed) | 10 Sep 2026 | working tree |
| **S13** | 🟢 Low | `corrections` has RLS with no delete policy | ✅ FIXED (unapplied) | 10 Sep 2026 | working tree |
| **S14** | 🟢 Low | `expo-modules-core` is a phantom dependency | ✅ FIXED | 10 Sep 2026 | working tree |
| **S15** | 🟢 Low | npm advisories in the dependency tree | ✅ PASSING | 10 Sep 2026 | baseline |
| **S16** | 🟢 Low | A user alias can escape its prompt tag | ✅ FIXED (undeployed) | 10 Sep 2026 | working tree |
| **S17** | 🟠 High | `redeem_coach_invite` can be brute-forced — no limit of any kind | ✅ FIXED (unapplied) | 10 Sep 2026 | working tree |
| **S18** | 🟠 High | A coaching link exposes the other person's **email address** | ✅ FIXED (unapplied) | 10 Sep 2026 | working tree |
| **S19** | 🟡 Medium | A coach may read every set of a session and not one exercise NAME | ✅ FIXED (unapplied) | 10 Sep 2026 | working tree |
| **S20** | 🟠 High | The privacy policy contradicts coaching and omits a processor | ✅ FIXED | 10 Sep 2026 | working tree |
| **S21** | 🟠 High | A note that will not read asks the model again on every app open | ✅ FIXED | 10 Sep 2026 | working tree |
| **S22** | 🟡 Medium | A full sync batch stops instead of continuing — history stays unsynced | ✅ FIXED | 10 Sep 2026 | working tree |
| **S23** | 🔴 Critical | Every signed-out install logs into RevenueCat as the **same customer** | ✅ FIXED | 10 Sep 2026 | working tree |
| **S24** | 🟠 High | Sign-out promises the local copy survives, then deletes unsynced sessions | ✅ FIXED | 10 Sep 2026 | working tree |
| **S25** | 🟡 Medium | The local wipe is a literal in two files — the deletion promise can drift | ✅ FIXED | 10 Sep 2026 | working tree |
| **S26** | 🟠 High | A guard-rejected brief rewrite is re-requested on every screen open | ✅ FIXED | 10 Sep 2026 | working tree |

**Read the qualifiers; they are the whole point of this table.**

- **`working tree`** in the Commit column means exactly that: the change is applied and verified
  in the working tree and **is not committed**. Nothing here has a hash yet. The rule at the top
  of this file asks for one item, one commit, one verified close — that was not followed, because
  the tree carries roughly a hundred files of unrelated in-progress work and splitting a security
  commit out of it is the owner's call, not an agent's. **Replace this column with real short
  hashes as each item is committed.** Until then the ledger records verified work, not shipped
  work.
- **`(unapplied)`** — the migration is written and its check passes against the file. No database
  has run it. `supabase db push` is the owner's.
- **`(undeployed)`** — the function source is fixed. The deployed function still answers with the
  old code until `supabase functions deploy` runs. A repo grep is not a deploy; this repository
  has shipped code that lagged its functions before.
- **🟡 PARTIAL** — some of the item is done and some of it needs access an agent does not have.
  Each of the three says which is which in its own section.

**Order of work.** S1 → S2 → S3 same day; they are live and one of them (S2) is a standing bill.
S4 → S5 this week — by CLAUDE.md §5.4 an unguarded model fact is an open release blocker.
S6 → S9 before TestFlight. S10 → S16 after.

### The four things only the owner can do

Everything reachable from this repository is done. These four are not, and none of them is a
code change — three are dashboard or shell actions and one is a product step. They are the whole
of what stands between this document and a clean run.

| # | Action | Closes | Where |
|---|---|---|---|
| 1 | **Disable the Email provider.** One toggle. The highest-value action in this document: it breaks S2's chain at step two and removes S3's path with it. | S2, S3 | Supabase → Authentication → Providers |
| 2 | **`git filter-repo` the `app.zip` blob, force-push, then rotate** the Supabase anon key and `SENTRY_AUTH_TOKEN`. Destructive and public-facing, which is why it was left. | S1 | shell + Supabase/Sentry |
| 3 | **Delete the `dev@recore.invalid` user**, and stand up a separate development project so `.env` and a release build stop naming the same database. | S3, S9's root cause | Supabase → Authentication → Users |
| 4 | **Wire the RevenueCat webhook** to write `profiles.entitled_until`, then flip the default in `_shared/gate.ts` and `supabase secrets set REQUIRE_ENTITLEMENT=true`. | S2 | RevenueCat + Supabase |

And before any of the server-side work counts as live:

```bash
supabase db push                                     # S2, S8, S13 migrations
supabase functions deploy                            # S2, S11, S12, S16
psql "$DATABASE_URL" -f supabase/tests/rls-verification.sql   # rolled back; proves S8 and S13
supabase functions list                              # UPDATED_AT vs the repo
```

---

## S1 · `app.zip` containing `.env` is pushed to a public repo

🔴 **Critical** · `app.zip` (64 MB), commit `2cca491`, present on `origin/main` and
`origin/native-feel/check-in-form-sheet`

`.gitignore:34` excludes `.env`. That exclusion was defeated by zipping the working tree and
committing the archive. The archive contains `.env`, `.env.example`, `.gitignore`, `.DS_Store`
and a 9.3 MB compiled Hermes bundle. `api.github.com/repos/miz3006/recore` reports
`"visibility": "public"`, so the file is a single `curl` away.

What leaks is publishable material — the Supabase URL, the anon key, a commented-out RevenueCat
`test_` key. The reason this is critical is not the contents but the mechanism: `.gitignore` is
no longer load-bearing, and the next `.env` to carry a real secret will travel the same road.

### Fix

```bash
printf 'app.zip\n*.zip\n*.tar.gz\ndist/\n' >> .gitignore
git rm --cached app.zip
git commit -m "Stop tracking the build archive"

# The blob is already public and indexed — tracking is not enough.
git filter-repo --path app.zip --invert-paths
git push --force origin main native-feel/check-in-form-sheet
```

Then rotate, because the values were publicly readable regardless of how publishable they are:
Supabase → Settings → API → roll the anon key; Sentry → roll `SENTRY_AUTH_TOKEN`. Update `.env`
and `.env.local`. Rotating is cheap; deciding after the fact that it was fine is not.

### Verify

```bash
./scripts/security-verify.sh S1
```

Five checks: not tracked, gitignored, absent from every commit on every ref, no archive of any
extension tracked, and a 404 from the public raw URL. The last one needs network.

### Evidence

```
S1 · build archive with .env out of git
  PASS  app.zip is not tracked
  PASS  app.zip is gitignored
  FAIL  app.zip still appears in 1 commit(s) — history not rewritten
  PASS  no build archive of any kind is tracked
  FAIL  NET app.zip still downloadable from the public repo (HTTP 200)
```
_Captured 10 September 2026, working tree, uncommitted._

**What is done:** `app.zip` is untracked, and `.gitignore` now excludes it plus `*.zip`, `*.tar`,
`*.tar.gz`, `*.tgz`, `*.ipa`, `*.apk`, `*.aab` and `dist/` — the mechanism, not just the filename.
The 64 MB file is still on disk, untouched.

**What is left, and why it was not done here.** The two failing lines are one action: the blob is
already public, so untracking it changes nothing about what a stranger can download. Closing them
needs `git filter-repo` and a **force-push that rewrites published history on a public
repository**, plus rotating the Supabase anon key and `SENTRY_AUTH_TOKEN`. That is destructive and
outward-facing, it invalidates every clone, and it is the owner's call — not something to do on
an agent's initiative. The commands are in the Fix block above and are unchanged.

Until the force-push happens **treat the leaked values as public**, which is the reason to rotate
whether or not they are "only publishable" keys.
---

## S2 · Open signup + no entitlement check = unmetered access to the Anthropic key

🔴 **Critical** · `supabase/functions/parse-workout/index.ts:29-30,177-181`,
`explain-brief/index.ts:50-54`, `explain-prediction/index.ts:72-76`,
`src/lib/parse/client.ts:103-115`

Verified live against project `nkjrukxrocplesonotqo`:

```json
{ "external": { "email": true }, "disable_signup": false, "mailer_autoconfirm": true }
```

The chain: the anon key is public (S1, S9) → `POST /auth/v1/signup` with any address returns a
valid JWT immediately, unverified → all three AI functions check only that the JWT is valid →
the rate limit is per user (30 calls / 10 min) → more accounts, more quota. There is no global
ceiling and no entitlement check on either side of the wire. `src/lib/parse/client.ts:113` calls
`invoke` without consulting `entitlement` at all.

The app signs in with Apple and Google only (`src/lib/auth/sign-in.ts:84,131`). Email/password
exists solely to serve `dev-sign-in.ts` (S3).

### Fix

Four changes, in order of how much they matter:

1. **Supabase → Authentication → Providers → disable Email.** One toggle; it breaks the chain at
   step two and closes most of S3 with it.
2. **Check entitlement server-side** in all three functions, after the `getUser()` block and
   before the model call. RevenueCat webhook → an `entitlements` table, or the simpler
   `profiles.entitled_until timestamptz`:
   ```ts
   const { data: prof } = await supabaseService
     .from('profiles').select('entitled_until').eq('id', user.id).maybeSingle();
   const entitled = prof?.entitled_until != null && new Date(prof.entitled_until) > new Date();
   if (!entitled) return json({ error: 'not_entitled' }, 402);
   ```
3. **Add a global ceiling** beside the per-user one — a `bump_global_rate` RPC over a single
   counter row, so one attacker cannot drain the month's budget regardless of account count.
4. **Lower `max_tokens`** at `parse-workout/index.ts:280`. 16 000 for a 4 000-character input
   sets the worst-case cost far above the real one.

### Verify

```bash
./scripts/security-verify.sh S2
```

Then confirm the functions actually **deployed**, because a repo grep is not a deploy and
deployed functions have lagged this repository silently before:

```bash
supabase functions list                              # read UPDATED_AT
git log -1 --format=%cI -- supabase/functions        # compare
```

Record both in the evidence block. An item that passes the grep but ships the old function is
not closed.

### Evidence

```
S2 · open signup + unmetered AI access
  FAIL  NET live auth config: email provider enabled; disable_signup=false; mailer_autoconfirm=true
  PASS  all three AI functions call the entitlement gate
  FAIL  entitlement gate is present but NOT enforcing — no webhook writes profiles.entitled_until yet. Flip the default in _shared/gate.ts and 'supabase secrets set REQUIRE_ENTITLEMENT=true' once it does.
  PASS  a global (not just per-user) rate ceiling exists
  PASS  parse-workout max_tokens lowered
  NOTE  a repo grep is not a deploy. Confirm with:  supabase functions list
        and compare UPDATED_AT against: git log -1 --format=%cI -- supabase/functions
```
_Captured 10 September 2026, working tree, uncommitted._

**What is done:** the global ceiling and the lower `max_tokens` are live in the source, and the
entitlement gate is written and called by all three AI functions.

- `supabase/migrations/20260910130000_entitlement_and_global_rate.sql` adds
  `profiles.entitled_until` (with `update` on that column **revoked** from `authenticated` and
  `anon`, so `profiles_update` cannot be used to grant oneself a subscription), the
  `global_rate_limits` table (RLS on, no policies) and the `bump_global_rate` RPC (execute revoked
  from every client role, granted to `service_role` only) — the same posture `bump_parse_rate`
  already had.
- `supabase/functions/_shared/gate.ts` holds both gates. The global one is **on**: 2000 calls/hour
  across the whole project by default, tunable with `GLOBAL_RATE_MAX` without a deploy. It is the
  gate that actually bounds the damage while signup is open, because it does not care how many
  accounts an attacker holds.
- `max_tokens` in `parse-workout` went 16000 → 8000. Derived rather than guessed: across the 105
  cases in `scripts/parse-eval-cases.json` the structured output is at most **1.9×** the input in
  characters, and 8000 tokens is roughly 28,000 output characters — about **7×** the 4000-char
  input ceiling. Truncation would not lose data (`raw_text` is the source of truth and the workout
  keeps `needs_parse = 1`), but confirm the number with the owner-run §9.4 eval before treating it
  as settled.

**What is left, and why. Two things, both needing access an agent does not have:**

1. **Disable the Email provider** in Supabase → Authentication → Providers. This is step 1 of the
   Fix above and the single highest-value action in this document: it breaks the chain at step
   two and closes most of S3 with it. One toggle.
2. **Enforce entitlement.** The gate is deliberately **off by default** and the check reports it
   as failing rather than letting the grep pass on a gate that lets everyone through.
   `profiles.entitled_until` is written by the RevenueCat webhook, that webhook does not exist yet
   (real store billing is step 1 of CLAUDE.md §6's build order and is not done), so every row's
   value is null today and a strict gate would answer **402 to every caller including the
   owner** — a silent outage on the workout-logging path, which CLAUDE.md §2 invariant 1 forbids
   blocking on an entitlement check. Turning it on is the last step of wiring the webhook:
   flip the default in `_shared/gate.ts` and
   `supabase secrets set REQUIRE_ENTITLEMENT=true`.

**And then deploy.** All three functions changed. Until `supabase functions deploy` runs, the
deployed functions answer with the old code and none of this is live.
---

## S3 · Hardcoded dev credential in a public repo, pointed at production

🔴 **Critical** · `src/lib/auth/dev-sign-in.ts:59-62,87`

```ts
const DEV_EMAIL = 'dev@recore.invalid';
const DEV_PASSWORD = 'recore-development-only';
```

The comment at line 55 says *"Do not point it at production."* `.env` and `.env.example` both
name project `nkjrukxrocplesonotqo`; there is one project, and it is this one. The `__DEV__`
guard at line 71 protects the app bundle and nothing else — the credential itself works against
the public `/auth/v1/token` endpoint from any shell, and line 87 will create the account for
whoever asks first if it does not exist.

I did not execute this sign-in during the review (the action was blocked), so it is recorded as
confirmed by configuration, not by a successful login. Treat it as live regardless: nothing in
the configuration prevents it.

### Fix

1. Disable the Email provider (S2 step 1). This alone removes the path.
2. Delete the `dev@recore.invalid` user in Supabase → Authentication → Users.
3. Remove the literal from `src/lib/auth/dev-sign-in.ts`. If a development door is still wanted,
   read the address and password from `process.env.EXPO_PUBLIC_DEV_*` — absent by default,
   present only in a local `.env` — and drop the `signUp` fallback entirely, so the door can
   open an account that exists but can never create one.
4. Stand up a separate Supabase project for development so `.env` and a release build stop
   pointing at the same database.

### Verify

```bash
./scripts/security-verify.sh S3
```

Two automated checks (no literal password, no `signUp()` in `src/lib/auth/`) plus one manual
step the script cannot see: the deleted user. Record the Supabase Auth → Users listing, or CLI
output showing the address is gone, in the evidence block alongside the script output.

### Evidence

```
S3 · hardcoded dev credential
  PASS  no literal password in the dev sign-in path
  PASS  no client-side account creation in src/lib/auth/
  NOTE  deleting the dev@recore.invalid row is a dashboard action; record
        the Supabase Auth → Users screenshot or the CLI output as evidence.
```
_Captured 10 September 2026, working tree, uncommitted._

**What is done:** both literals are gone from `src/lib/auth/dev-sign-in.ts`. The address and
password now come from `EXPO_PUBLIC_DEV_EMAIL` / `EXPO_PUBLIC_DEV_PASSWORD`, absent by default,
and with neither set the function throws a sentence saying what to add. **The `signUp` fallback is
deleted**, which is the more important half: it created the account for whoever asked first, so
the credential did not merely open a door, it built one. The door can now open an account that
exists and can never create one. Both variables are documented in `.env.example` as empty, with
the warning that `EXPO_PUBLIC_` means the value ships in any build made with it set.

**What is left:**

1. **Delete the `dev@recore.invalid` user** in Supabase → Authentication → Users. The script
   cannot see this; record the listing or the CLI output here.
2. **Disable the Email provider** (S2 step 1), which removes the path regardless.
3. **Stand up a separate development project** so `.env` and a release build stop pointing at the
   same database. Still open, and still the root cause behind both S3 and S9.
---

## S4 · `explain-prediction` has no output guard — the model can write a number

🟠 **High** · `src/lib/predict/explain.ts:30-35`,
`supabase/functions/explain-prediction/index.ts:146-151`

CLAUDE.md §4: *"Every response passes a guard that validates numbers, names, dates, and claims
against source facts."* `explain-brief` honours this — `src/lib/brief-guard.ts:42-45` holds a
number whitelist built from the source paragraph. `explain-prediction` has nothing:

```ts
if (typeof reason !== 'string') return;
const trimmed = reason.trim().slice(0, 200);
if (!trimmed || trimmed.includes('\n')) return;
upsertPrediction(userId, forDate, draft.ghostText, trimmed);
```

Type, length, no newline. No number is checked against anything. Given
`{"weight_kg":97.5,"next_weight_kg":100}` the model may answer *"Last time at 140 kg…"* and that
sentence is written to the database and rendered under a figure the code computed, where a
person will read it as fact. This is the one invariant the product is built on, and it is open.

### Fix

Extend the existing guard rather than writing a second one — `numbersOf` is already there and
already normalises `82,5` to `82.5`.

```ts
// src/lib/brief-guard.ts
export function sanitizePredictionReason(
  candidate: unknown,
  facts: Record<string, unknown>,
  quotes: string[],
): string | null {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim();
  if (!text || text.length > 200) return null;
  if (text.includes('\n') || text.includes('!')) return null;
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(text)) return null;

  const allowed = numbersOf([...Object.values(facts), ...quotes].join(' '));
  for (const n of numbersOf(text)) if (!allowed.has(n)) return null;
  return text;
}
```

Call it at `src/lib/predict/explain.ts:30` in place of the three-line check, passing
`draft.explain.facts` and `draft.explain.quotes`. Add cases to `src/lib/brief-guard.test.ts`:
a reason quoting a fact number passes; a reason inventing `140` returns `null`; a reason with a
number that appears only in the user's own quote passes.

### Verify

```bash
./scripts/security-verify.sh S4 GATES
```

Three checks: the function exists, `predict/explain.ts` routes through it, and the test file
names it. `GATES` runs the new tests.

### Evidence

```
S4 · explain-prediction output guard
  PASS  sanitizePredictionReason exists in brief-guard.ts
  PASS  predict/explain.ts routes the model reason through the guard
  PASS  the guard has test coverage
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S5 · Guard rejections are neither counted nor alarmed

🟠 **High** · `src/lib/brief-explain.ts:91`, `src/lib/predict/explain.ts:30`

CLAUDE.md §4 requires guard rejections to be counted and alarmed. `sanitizeBriefSummary`
returns `null` and the caller moves on. `src/lib/funnel.ts` has no guard event. A model that
began inventing numbers at scale would be caught by the guard and be completely invisible —
which means nobody would know the prompt had drifted until a user reported a wrong figure.

### Fix

Add `bumpGuardRejection(surface: 'brief' | 'prediction')` to `src/lib/funnel.ts`, writing to
the same local `meta` counters the rest of the funnel uses, and call it on every `null` from
both guards. Surface the total on the You tab's development rows so it is readable without a
debugger.

### Verify

```bash
./scripts/security-verify.sh S5 GATES
```

### Evidence

```
S5 · guard rejections counted
  PASS  funnel.ts records guard rejections
  PASS  both guard call sites report a rejection
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S6 · CSV formula injection on export

🟡 **Medium** · `src/lib/export-csv.ts:12-14`

```ts
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
```

Quotes only on `"`, `,`, `\n`. An exercise name beginning `=`, `+`, `-`, `@`, tab or CR is
written raw. Those names are not necessarily the user's own: `src/lib/import/pick.ts:21` imports
an arbitrary third-party CSV and `src/lib/import/apply.ts:50-55` stores `exercise.name`
unsanitised. So the path is: someone sends a "Hevy export" containing
`=cmd|'/c calc'!A1` → the user imports it → exports → opens the result in Excel.

### Fix

```ts
/** Leading characters a spreadsheet reads as the start of a formula. */
const RISKY_LEAD = /^[=+\-@\t\r]/;

function csvField(value: string): string {
  const safe = RISKY_LEAD.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
```

Add `src/lib/export-csv.test.ts` pinning the rule: a plain name is untouched; `=cmd|…` gains the
apostrophe; a name with a comma is still quoted; an embedded quote is still doubled. Check
`src/lib/export-json.ts` for any field that reaches a CSV by another route.

### Verify

```bash
./scripts/security-verify.sh S6 GATES
```

The check looks for the exact token `RISKY_LEAD`, so it cannot pass on a comment that merely
discusses escaping.

### Evidence

```
S6 · CSV formula injection on export
  PASS  csv-field.ts defines the formula-lead rule (RISKY_LEAD)
  PASS  export-csv.ts names the rule its output obeys
  PASS  the exercise-name column routes through csvField
  PASS  export-csv.test.ts exists and exercises the rule
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S7 · Session keychain item syncs to iCloud / restores to another device

🟡 **Medium** · `src/lib/secure-storage.ts:17-20`

```ts
keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
```

Without `_THIS_DEVICE_ONLY` the item is carried into encrypted backups and iCloud Keychain, so
the Supabase `refresh_token` — a long-lived bearer credential — can be restored onto a different
device. The comment on line 18 justifies `AFTER_FIRST_UNLOCK` for background refresh, which is
correct and is preserved by the device-only variant.

### Fix

```ts
keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
```

Existing installs keep working: the old item stays readable, and the next `setItem` rewrites it
with the new attribute. No migration needed.

### Verify

```bash
./scripts/security-verify.sh S7 GATES
```

### Evidence

```
S7 · session keychain item must not leave the device
  PASS  secure-storage.ts uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S8 · `alias_overrides.exercise_id` accepts another user's row

🟡 **Medium** · `supabase/migrations/20260716130000_correction_loop.sql:56-59`

```sql
create policy alias_overrides_insert on public.alias_overrides
  for insert with check (user_id = auth.uid());
```

The check constrains `user_id` and says nothing about `exercise_id`. User A can insert a row
pointing at user B's exercise. `parse-workout/index.ts:223-227` then joins `exercises(canonical)`
with the **service-role** key — bypassing RLS — and B's exercise name lands in A's prompt and
answer. Guessing a UUIDv4 makes this impractical to exploit, but the constraint is missing and
the join that would expose it runs with RLS off.

### Fix

New additive migration (never rewrite a deployed one — CLAUDE.md §5):

```sql
drop policy alias_overrides_insert on public.alias_overrides;
create policy alias_overrides_insert on public.alias_overrides
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id = auth.uid() or e.user_id is null)
    )
  );
-- same clause for alias_overrides_update
```

Add a case to `supabase/tests/rls-verification.sql` marked with the literal comment
`-- alias_overrides_cross_user` proving A's insert against B's exercise id is refused.

### Verify

```bash
./scripts/security-verify.sh S8
psql "$DATABASE_URL" -f supabase/tests/rls-verification.sql   # runs in a rolled-back txn
```

The test-coverage check looks for `alias_overrides_cross_user`, not the table name — the
existing test already mentions the table without testing this case, and matching on the name
passed against unfixed code in the verifier's first draft.

### Evidence

```
S8 · alias_overrides.exercise_id ownership
  PASS  the insert AND update policies constrain exercise_id to own/global rows
  PASS  rls-verification.sql proves the cross-user reference is refused
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S9 · `.env.example` (tracked) holds live project values

🟡 **Medium** · `.env.example:10-11`

Not a template: the real URL for `nkjrukxrocplesonotqo` and a real anon JWT valid to 2099, in a
public repository. It is also the clearest statement of a wider problem — `.env` and
`.env.example` name the same project, so there is no separation between what a developer runs
against and what a user's data lives in.

### Fix

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Keep the surrounding prose — it is good and it is the reason the file exists. Then create the
separate development project (S3 step 4) and point local `.env` at it.

### Verify

```bash
./scripts/security-verify.sh S9
```

### Evidence

```
S9 · .env.example holds no live project values
  PASS  .env.example has no real project ref
  PASS  .env.example carries a placeholder anon key
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S10 · CSV import is unbounded in size and row count

🟢 **Low** · `src/lib/import/pick.ts:30`, `src/lib/import/csv.ts:14-43`,
`src/lib/import/apply.ts:30`

`readAsStringAsync` reads whatever was picked, `parseCsv` builds the whole structure in memory
one character at a time, and `applyImport` writes every row in a single transaction. A large
file is an out-of-memory crash. Self-inflicted and user-initiated, which is why it is low — but
the import feature exists precisely to accept files from elsewhere.

### Fix

Check `picked.assets[0].size` against a `MAX_IMPORT_BYTES` of about 10 MB and return
`{ status: 'invalid' }` above it. Cap the mapped days in `formats.ts` with a named
`MAX_IMPORT_ROWS`, and report what was dropped rather than truncating silently.

### Verify

```bash
./scripts/security-verify.sh S10 GATES
```

### Evidence

```
S10 · CSV import bounds
  PASS  pick.ts bounds the file size before reading it
  PASS  the row/day count is bounded
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S11 · Wildcard CORS on all four edge functions

🟢 **Low** · `parse-workout:38-41`, `explain-brief:26-29`, `explain-prediction:19-22`,
`delete-account:26-29`

`'Access-Control-Allow-Origin': '*'`. Without `Allow-Credentials` no browser attaches cookies,
and Supabase authenticates by header, so this is not CSRF. What it does allow is any web page to
call these functions with a token it already holds — which is the delivery mechanism for S2.

### Fix

Answer the app's own origin and `null` (native WebViews send `Origin: null`), and reflect
nothing else. Keep the preflight working for the local dev server.

### Verify

```bash
./scripts/security-verify.sh S11
```

Then confirm deployment as in S2.

### Evidence

```
S11 · CORS not wildcard
  PASS  no edge function answers Allow-Origin: *
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S12 · `delete-account` has no rate limit

🟢 **Low** · `supabase/functions/delete-account/index.ts:38`

It deletes only the caller's own account, so the blast radius is one row, but it is a free
authenticated endpoint that does real work.

### Fix

Call `bump_parse_rate` after the `getUser()` block, as the other three functions do.

### Verify

```bash
./scripts/security-verify.sh S12
```

The check requires the literal `rpc('bump_parse_rate'`. It previously matched the phrase
"the rate-limit row" in the file's header comment and passed while nothing was enforced.

### Evidence

```
S12 · delete-account rate limited
  PASS  delete-account calls the rate-limit RPC
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S13 · `corrections` has RLS with no delete policy

🟢 **Low** · `supabase/migrations/20260716130000_correction_loop.sql:48-51`

Select and insert only. Account deletion takes these rows by cascade, so the erasure promise is
kept — but a user cannot remove their own corrections without deleting the account, and the
table is described as append-only training data rather than as something a person owns.

### Fix

Add `corrections_delete` (`for delete using (user_id = auth.uid())`) in an additive migration.

### Verify

```bash
./scripts/security-verify.sh S13
```

### Evidence

```
S13 · corrections delete policy
  PASS  a corrections delete policy exists
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S14 · `expo-modules-core` is a phantom dependency

🟢 **Low** · imported from `src/`, absent from `package.json`

Resolves today only because `expo` hoists it. A change in hoisting or a clean install with a
different resolver breaks the build for reasons that will not look like a dependency problem.

### Fix

```bash
npm install expo-modules-core
```

### Verify

```bash
./scripts/security-verify.sh S14 GATES
```

### Evidence

```
S14 · no undeclared (phantom) dependency
  PASS  expo-modules-core is a declared dependency
Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S15 · npm advisories in the dependency tree

🟢 **Low** — ✅ **currently passing**

`npm audit --omit=dev` reports 16 moderate advisories, all reached through
`@expo/config-plugins`: `decode-uri-component` (GHSA-vcc3-ghjq-m6fr, DoS) and `uuid`
(GHSA-w5hq-g745-h8pq, missing bounds check). Both are build-time tooling, neither is in the
shipped runtime, and there are no high or critical advisories — which is what the check gates
on.

Nothing to do now. This item exists so the check keeps running: it turns red the day a
high-or-critical advisory reaches a runtime dependency. Clear the moderates with the next Expo
SDK bump.

### Verify

```bash
./scripts/security-verify.sh S15
```

### Evidence

```
S15 · npm advisories (runtime deps)
  PASS  NET no high/critical advisories in runtime deps
```
_Captured 10 September 2026 at `841619f`._

---

## S16 · A user alias can escape its prompt tag

🟢 **Low** · `supabase/functions/parse-workout/index.ts:263-265`

The personal-vocabulary block interpolates the user's own alias text and labels it
*"Their alias fixes (always obey)"*. An alias containing `</user_vocabulary>` closes the tag
early. It is low because it is self-injection — the only output affected is the injector's own —
and because `validateResult` (lines 98-150) constrains the response to the schema regardless of
what the model was told. It is still a break in the data/instruction boundary the file's own
header claims to hold.

### Fix

Strip `<` and `>` from `alias` and from the canonical name before templating, at
`parse-workout/index.ts:236-242`. Cap the assembled `vocabulary` block at a fixed length while
there.

### Verify

```bash
./scripts/security-verify.sh S16
```

Then confirm deployment as in S2.

### Evidence

```
S16 · alias text cannot escape the prompt tag
  PASS  alias text is stripped of angle brackets before templating
```
_Captured 10 September 2026, working tree, uncommitted._

---

## What was checked and found sound

Recorded so a later reviewer knows the shape of the ground already covered, and does not read
silence as absence of review.

- **SQL injection** — 61 `expo-sqlite` call sites, all parameterised. The only two interpolations
  are `${table}` from the `OWNED_TABLES` constant (`db/index.ts:86-93,126`) and `${SCHEMA_VERSION}`
  (`db/index.ts:44`). Server-side, `bump_parse_rate` is `security definer set search_path = public`
  with execute revoked from `public`, `anon` and `authenticated` (`init.sql:159,181-182`).
- **RLS** — enabled on all 11 tables. `items` and `sets` inherit ownership through an `exists`
  join to `workouts`. `parse_rate_limits` deliberately has no policies. `exercises_update` cannot
  be used to claim a global row. The one gap is S8.
- **XSS / RCE** — no `eval`, `new Function`, `dangerouslySetInnerHTML`, `innerHTML` or WebView
  anywhere in `src/`. `scripts/capture-shots.ts:69,132,194` uses `execFileSync` with array
  arguments, so no shell. No `shell=True` in the Python scripts.
- **Dependencies** — all 51 declared packages exist and are installed. Registry-checked the less
  common ones: `expo-glass-effect` (`ide, brentvatne, expoadmin`), `expo-speech-recognition`
  (`jamesplay` — the genuine jamsch package), `react-native-worklets` (`tjzel, swm-bot`, Software
  Mansion), `react-native-view-shot` (`gre`). No typosquats, nothing hallucinated.
- **Sessions and deep links** — `detectSessionInUrl: false`, PKCE, SecureStore
  (`supabase.ts:20-27`). `createSessionFromUrl` is private and reachable only from the
  `openAuthSessionAsync` result (`sign-in.ts:174,191`), so no `recore://` link can inject a
  session.
- **Secrets in logs** — two `console.*` calls in all of `src/`, both `__DEV__`-only
  (`log.ts:8,54`). Sentry runs with `sendDefaultPii: false`, `beforeSend` deleting `user`,
  `request` and `extra`, console breadcrumbs dropped, `tracesSampleRate: 0` (`crash.ts:61-71`).
  No raw `fetch()` in `src/`; the funnel is local-only.
- **The AI provider key** — present only in the edge-function environment. Absent from `src/`,
  `.env`, `.env.example` and the whole of git history; the `sk-ant-...` strings in the docs are
  placeholders.
- **`parse-workout` input and output handling** — input bounded at 4 000 chars / 100 lines,
  identity taken from the JWT and never from the body, model output clamped into ranges
  (`validateResult:98-150`). This function is built correctly. Its problem is S2: it never asks
  whether the caller is paying.

---

## S17 · `redeem_coach_invite` can be brute-forced

🟠 **High** · `supabase/migrations/20260910140000_coaching.sql` (the RPC), no limiter anywhere

An invite code is six characters from a 31-glyph alphabet — 31^6 ≈ 887 million, which sounds
sufficient until you count the codes that are **open at one time** rather than the codes that
could exist. Every open code is a hit, so the expected number of guesses is 31^6 divided by that
population: a thousand coaches holding five live codes each puts it at roughly **180 000**.
PostgREST answers far more than that in an afternoon, and nothing counted the attempts.

**What a hit actually buys, because it is not what it first looks like.** The redeemer becomes the
CLIENT and the code's issuer becomes the coach — so a guesser does not read a stranger's training,
they hand their own empty account to a stranger. The damage lands on the coach: the code is
consumed and the athlete it was meant for is told it has already been used. With five open codes
capped per coach, a guesser can keep a coach permanently unable to onboard anybody. Griefing
rather than disclosure, and still a thing that has to cost something.

### Fix

`20260910200000_redeem_rate_limit.sql`. Ten attempts per user per fifteen minutes, plus a
project-wide ceiling of 500 an hour through the existing `bump_global_rate` — because signup is
open (S2), so a per-user limit alone is a suggestion.

**The function stopped raising, and that is the whole shape of the migration.** PostgREST runs a
request in ONE transaction: `raise exception` aborts it and takes the counter's own increment down
with it. A limiter that forgets every attempt it rejected is not a limiter. So every refusal is
now RETURNED as `jsonb` — `{"error": "invalid_or_expired"}` — every write commits, and
`lib/coaching/index.ts` reads the name out of the payload instead of off an error. A successful
join clears the window, so somebody who fat-fingered a code four times and then got it right is
not left one mistake from a lockout on a feature they have finished using.

### Evidence

```
S17 · invite redemption is rate limited
  PASS  a per-user attempt counter exists
  PASS  the newest redeem_coach_invite returns its refusals instead of raising
  PASS  a global ceiling bounds redemption across all accounts
  PASS  the client understands the new refusal
```
_Captured 10 September 2026, working tree, uncommitted. **Unapplied** — `supabase db push` is the
owner's._

---

## S18 · a coaching link exposes the other person's email address

🟠 **High** · `supabase/migrations/20260910140000_coaching.sql`, the `profiles_select` policy

The coaching migration widened `profiles_select` to `id = auth.uid() or public.is_linked_with(id)`,
and the comment above it says the display name is *"the ONLY thing the link exposes about a person
besides their training"*. **That is not what the policy does.** RLS is ROW-level: widening a select
hands over the whole row, and `public.profiles` also holds `email` — and, once
`20260910130000` is applied, `entitled_until`. Either end of a link could run

```sql
select email from profiles where id = '<the other person>';
```

and read it. Somebody who signed in with Apple and chose Hide My Email had decided, deliberately,
not to give their address to anyone; the relay address leaks all the same, and it is a working
inbox.

### Fix

`20260910210000_coach_read_scope.sql` puts the policy back to `id = auth.uid()`.

**Nothing needed the widened read.** `grep "from('profiles')"` over `src/` finds an upsert of your
own row, an update of your own display name, and nothing else. The linked display name already
arrives through `coach_client_overview()` and `my_coach()` — both `security definer`, both
returning `display_name` and no other column. That is a column-level answer to what was always a
column-level question. `is_linked_with` is kept: it is correct and the next policy that needs it
should not write it again.

### Evidence

```
S18 · a coaching link does not expose the profiles row
  PASS  profiles_select is own-row only (email is not readable across a link)
```

The check strips SQL comments before reading the policy, and the first draft of it is why: the
migration that fixes this QUOTES the broken policy in its header, so the check matched the
explanation and reported the fix as unfixed. Proved to fail on the broken state by running it
against a directory holding only `20260910140000_coaching.sql`.

_Captured 10 September 2026, working tree, uncommitted. **Unapplied.**_

---

## S19 · a coach may read every set of a session and not one exercise name

🟡 **Medium** · `exercises_select`, unchanged from `20260716000000_init.sql`

`exercises` is the table the coaching migration did not widen. Its policy is still "your own rows,
or a global default" — and a movement the client's own catalogue owns (which is every movement the
built-in list did not already have, so most of a real athlete's) is a row with
`user_id = <the client>`. The coach may not select it.

The failure is silent and reads as a parser bug rather than a policy one:
`lib/coaching/read-workout.ts` resolves the name through that table and falls back to the string
`Unread line`. So the coach's screen prints the sets, the reps and the kilograms correctly, under a
column of rows that all say **Unread line**. Anyone who tries the feature concludes it is broken.

Not a security finding in itself — it is the audit of S18 finding the same widening done wrong in
the other direction, and it is recorded here because the two share a migration.

### Fix

`20260910210000_coach_read_scope.sql` adds `public.is_active_coach_of(user_id)` to
`exercises_select`. **This adds no category of information to what the link already granted:** the
coach can already read `raw_text`, which names the movement outright, plus every item and set of
the session. The canonical name and its learned shorthands are the same fact in tidier form. Still
SELECT only, still an active link only — insert, update and delete keep their owner-only policies,
so a coach cannot rename, merge or delete anything in a client's catalogue.

### Evidence

```
S19 · a coach can read the exercise NAMES of a session they may read
  PASS  exercises_select reaches an active coach
```
_Captured 10 September 2026, working tree, uncommitted. **Unapplied.**_

---

## S20 · the privacy policy contradicts coaching and omits a processor

🟠 **High** · `src/lib/legal.ts`, and `.env` carries `EXPO_PUBLIC_COACH_MODE=1`

The policy says, of the account's rows:

> Every row is scoped to your account at the database level, **so no other user can read it**

and, of the processor list:

> **There is no sixth.**

Coaching makes the first sentence false and the second one short by one. A linked coach reads the
text of every session, the sets read out of it, the session rating, the end-of-session check-in
note and the per-exercise note. And `supabase/functions/notify-comment` hands a comment's text and
the sender's chosen name to **Expo's push service** so the notification can reach the phone —
a processor the policy does not name.

This is not a live violation: `eas.json` sets the flag in no build profile, so cloud builds ship
coaching OFF, and the hosted `docs/*.html` are correct as they stand. It is a **release blocker for
the day it ships**, and `.env` has it on today, so the day is close.

### Fix

The disclosure is written and **gated on the same flag as the feature** — `isCoachModeOn()`, the
build-time constant Metro inlines. Both mistakes then become impossible rather than remembered:

- a release with coaching off does not tell readers their training can be shared with another
  person, which would be false and is the kind of false that makes somebody close the app;
- a build that turns coaching on turns the section on with it, and there is no separate step to
  forget.

Every claim in it was checked against the SQL — what a coach reads, that they can never write to
the record, that the email is not on the list (S18), and that setup answers, bodyweight and height
never leave the device at all because they live in the local key-value table and are not synced.
`.env.example` now documents the flag and says plainly that routing around this gate is the one way
it can do real harm.

**The wording is the owner's to approve before it is published** — it is factual and checked, but a
privacy policy is a legal document and an agent should not be its last reader.

### Evidence

```
S20 · the privacy policy describes coaching exactly when the build has it
  PASS  the policy's coaching section is gated on the same flag as the feature
  PASS  the section exists and names what a coach can read
  PASS  Expo's push service is named as a processor under the same flag
  PASS  the account-scoping sentence no longer contradicts the feature
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S21 · a note that will not read asks the model again on every app open

🟠 **High** · `src/lib/db/workouts.ts` (`getWorkoutsNeedingParse`), `src/lib/sync/index.ts`
(`retryPendingParses`), `src/lib/parse/client.ts`

The client's own half of S2, and nobody has to attack anything for it to bill.

`needs_parse` is a flag, not a memory: it says "this text has no reading". That was the entire
retry policy. Every sync pass took the newest five flagged notes and called `parse-workout` again,
and **a sync pass runs on every foreground**. So a note the parser genuinely cannot read — a model
answer `validateParseResult` rejects, an input the function refuses — asked again every single time
the app was opened, for ever, and every ask is a model call on the project owner's Anthropic
account. Twenty opens a day against five such notes is a hundred calls a day that were never going
to produce a reading.

The same flag had a second cost with no money involved. The queue was
`ORDER BY updated_at DESC LIMIT 5`, so five unreadable notes at the top of it are **the same five
on every pass** — and a hundred days of imported history behind them are never read at all.
Starvation, not slowness: no amount of waiting clears it.

### Fix

`src/lib/parse/backoff.ts` — a PURE module, for the same reason `csv-field.ts` is one (S6): its
caller reaches `expo-sqlite` through `db/index` and cannot be imported under `node --test`, and
this rule decides how much money the project spends. `src/lib/db/parse-backoff.ts` is the database
half; two local-only columns, `parse_attempts` and `parse_next_at`, at schema v8.

The wait grows **2 min → 10 → 1 h → 6 h → 24 h and stops there**. It never gives up: a reading is
the app's core promise (CLAUDE.md §2), a note abandoned after N tries is that promise quietly
withdrawn, and a week-long provider outage must not cost anybody their history. Bounded, not
surrendered — the worst an unreadable note can cost is one call a day instead of one per open.

- **Offline and signed-out are free and are not counted.** `parse/client.ts` draws the line on
  `FunctionsFetchError`: the request never left the phone, which is the ordinary state of a phone
  in a gym. Counting it would push a perfectly readable note into a day-long wait for the offence
  of having been written underground.
- **The order changed too**, `parse_attempts ASC, updated_at DESC`. A note that has never been
  tried always outranks one that has failed, which is what makes the starvation impossible.
- **Four things reset it**: the words changing, a reading landing, text arriving from another
  device, and the "clear local cache" repair. The first is the one that matters — rewriting the
  line is how a person actually fixes an unreadable one, and they must not then wait out a backoff
  earned by words they have deleted.

### Evidence

```
S21 · a reading that fails does not ask again on every app open
  PASS  the retry rule exists as a pure, testable module
  PASS  the parse client records a failed reading
  PASS  the queue honours the wait
  PASS  fewest failures first, so a poison note cannot starve the queue
  PASS  the rule has test coverage, including the ceiling
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S22 · a full sync batch stops instead of continuing

🟡 **Medium** · `src/lib/sync/index.ts`

A pass pushed at most 50 workouts and pulled at most 100, and then simply stopped — nothing
scheduled the continuation. The next pass came only from a foreground, a keystroke's debounce, or a
parse landing.

Invisible in ordinary use, where a person writes one day at a time and 50 is never reached. Not
invisible after `import/apply.ts`: a tracker export writes a year of history in one transaction,
every row `dirty = 1`, and the account's backup then advanced **fifty days per app open**. Somebody
who imported and went to train had most of their history still only on the phone — the one state
the sync loop exists to prevent — and it reported no error the whole time it lasted.

### Fix

`pushWorkouts` and `pullRemote` return whether their batch came back FULL, and `syncNow` treats
that as "there is more" through the `queued` flag it already had. The caps stay: they bound one
pass's work, which is what they were for.

The re-queue cannot loop: a push that fails THROWS before the flag is set, so an offline device
schedules nothing, and the pull's cursor advances strictly (the query is `gt(since)` ordered
ascending), so a page that returns rows always moves it forward.

### Evidence

```
S22 · a full sync batch books its continuation
  PASS  a full push batch queues another pass
  PASS  a full pull page queues another pass
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S23 · every signed-out install is the same RevenueCat customer

🔴 **Critical** · `src/lib/auth/provider.tsx`

One unreachable `else`, and it is the most expensive line in this document.

```ts
const userId = state.session?.user.id ?? LOCAL_USER_ID;   // 'sim-verify-user'
…
if (userId) { … } else { stopSync(); void releaseEntitlement(); reset(); }
```

`LOCAL_USER_ID` is a non-empty constant, so `userId` is **never falsy** and the else branch could
not run. Two things it existed to do therefore never happened — `releaseEntitlement()` and
`reset()` — and the comment above it stated the exact consequence it was failing to prevent:
*"otherwise the next account signed in on this device inherits the previous one's entitlement."*

**What ran instead is worse than what did not.** The if-branch calls `resolveEntitlement(userId)`,
which calls `Purchases.logIn(userId)`. So every signed-out install, on every device, logged into
RevenueCat as the literal string `sim-verify-user`. RevenueCat treats a known app-user-id as one
customer wherever it appears — so those installs **share a customer, and therefore an
entitlement**: a purchase or a grant against that pseudo-customer is readable by all of them.

And the funnel puts the paywall BEFORE sign-in by design (`app/_layout.tsx`), so
`isAttachedToAccount()` answered **true with no account behind it** — which is precisely the
anonymous receipt CLAUDE.md §2 rule 5 forbids. `purchase(plan, session?.user.id)` passes
`undefined` when signed out, so the function skipped its own attach check and went straight to
`purchasePlan`, satisfied that a customer was already attached.

### Fix

Entitlement is resolved only for a real session, and dropped when one ends. The rest of the effect
(scoping the database, seeding, hydrating, the first-open counter) runs either way, because those
are local-first and have never needed an account.

**Prices are unaffected.** `getOfferings` needs `configureStore()` and nothing else — `logIn` is
not involved — so the paywall still shows real prices to somebody who has not signed in yet. It
simply cannot charge them into a shared customer any more.

### Evidence

```
S23 · the store is attached to an account or to nothing
  PASS  the signed-out branch is reachable (no 'if (userId)' on a constant)
  PASS  entitlement is resolved only for a real session
  PASS  signing out detaches the store customer
```

Proved to fail on the defect by running the check against a copy with `if (signedIn)` restored to
`if (userId)`. The check strips comments first — the fix quotes the broken code in its header, and
the first draft matched the explanation.

_Captured 10 September 2026, working tree, uncommitted._

---

## S24 · sign-out promises the local copy survives, then deletes unsynced sessions

🟠 **High** · `src/app/(tabs)/you/index.tsx`

The confirmation read:

> Your training stays on this device and on the server.

It does not stay on the device. Signing out re-scopes the local database to the pre-account id, and
`ensureLocalUser` **wipes every table** when the scope changes. That wipe is correct — a device with
nobody signed in should not hold an account's training — which is what makes the sentence a defect
rather than a rounding error: the app stated the opposite of a deliberate design decision.

The cost is in the second half. The wipe is harmless only while sync has already carried the
record, and `dirty = 1` is exactly the set of rows for which it has not. Somebody who logged three
sessions underground and signs out before the phone finds signal loses them — silently, having just
been told they would not. S22 made that set smaller; it does not make it empty.

### Fix

`countUnsyncedSessions` (a `dirty = 1` count over non-empty notes, the same definition of "session"
the calendar dots use) and an alert that says what is true:

- nothing pending → *"Your training stays on the server and comes back when you sign in. The copy
  on this device is removed."*
- **N pending** → how many, that signing out would lose them, and to reconnect first if possible.

It still does not try to talk anybody out of signing out (§20: never harder to leave than to
arrive). Naming a cost is not arguing against the decision.

### Evidence

```
S24 · signing out does not promise what the wipe takes
  PASS  the alert no longer claims the local copy survives
  PASS  the alert names how many sessions have not reached the server
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S25 · the local wipe is a literal in two files

🟡 **Medium** · `src/lib/db/index.ts`, `src/lib/account/delete.ts`

The same ten-table `DELETE` string, character for character, in both files. **Nothing was missing on
10 September** — all ten tables in `SCHEMA_SQL` were named in both copies. The finding is the shape
of the failure, not its presence.

The next table added to `SCHEMA_SQL` gets a `DELETE` in whichever of the two files its author
happened to have open. The surviving copy is invisible: both wipes still run, both still succeed,
both still look right — and one account's rows outlive the account, on a device, with nothing on
any screen to show for it. Both wipes are promises the privacy policy makes in so many words
("no other user can read it", "wipes the local copy on the device").

### Fix

`WIPE_SQL`, exported from `db/schema.ts` beside the CREATE statements it has to keep up with, used
by both callers. Order is deliberate and now also asserted: children before parents, because the
database runs with `PRAGMA foreign_keys = ON`, and `meta` last because it carries `user_id`.

Three tests in `schema.test.ts` — string tests over the schema source, so they run under plain
`node --test`:

1. every table `SCHEMA_SQL` creates is wiped;
2. the wipe names no table that does not exist (`execSync` runs the batch as one statement, so one
   bad name throws and takes the tables it had not reached with it);
3. the FK order holds.

Proved by adding a table to `SCHEMA_SQL` and watching test 1 fail.

### Evidence

```
S25 · the local wipe has ONE definition
  PASS  WIPE_SQL is declared beside the tables it names
  PASS  both wipe call sites use the shared constant
  PASS  a test fails the build if a new table is never wiped
```
_Captured 10 September 2026, working tree, uncommitted._

---

## S26 · a guard-rejected brief rewrite is re-requested on every screen open

🟠 **High** · `src/lib/brief-explain.ts`

S21 wearing different clothes, on a shipped screen.

A rewrite that LANDS is cached under a signature of the paragraph, language and scope, so it is
asked for once — that half was always right. A rewrite that FAILS caches nothing, and
`refineBriefSummary` is called from a `useEffect` keyed on the paragraph. So the next mount of Next,
or the next opening of a lift sheet, asks the model again. Every time, for ever, two ways:

- **the guard rejects the summary** — the model wrote a number it was not given. This is the
  expensive one: the model ran, produced something unusable, and the same question will most
  likely produce it again.
- **the function answers 429 or 500.**

The exercise sheet multiplies it in the way that costs most: one cache slot per lift, so ten lifts
that all fail the guard are ten calls, again on every open.

### Fix

A failed signature is remembered and waits, by **the same rule the parser uses** —
`parse/backoff.ts`, already pure and already tested — so the codebase has one answer to "how soon
may this ask again" rather than two. Offline is still free: the same `FunctionsFetchError` line
`parse/client.ts` draws.

**In memory, and deliberately narrower than the parser's.** The loop that costs real money is
within one run of the app — open Next, go back, open Next. A cold start is a legitimate fresh try,
the paragraph is recomposed from the record then anyway, and persisting this would mean a meta
write on every guard rejection for a value whose whole job is to expire.

`explain-prediction` was checked for the same shape and does **not** have it:
`refinePredictionReason` is reached only from `recachePrediction`, which fires after a parse or a
correction, never from a render. It is already bounded by the thing that triggers it.

### Evidence

```
S26 · a rejected brief rewrite is not asked for again on every open
  PASS  a failed rewrite is remembered
  PASS  it waits by the same rule the parser uses (one answer, not two)
  PASS  being offline is still free
```
_Captured 10 September 2026, working tree, uncommitted._

---

## Change log

| Date | Entry |
|---|---|
| 10 Sep 2026 | Review opened. 16 findings recorded, `scripts/security-verify.sh` added, baseline captured at `841619f`: 4 passed · 30 failed. S15 passing at open. |
| 10 Sep 2026 | Baseline corrected to **3 passed · 31 failed**. The missing pass was `lint`, failing on a stale ESLint cache entry (`expo lint` caches by default) that claimed a merge conflict marker in `src/components/lifts-screen.tsx`. No such marker exists; `--no-cache` reports 0 errors. Refreshed, gate green. |
| 10 Sep 2026 | **S4 fixed.** `sanitizePredictionReason` added to `brief-guard.ts` — same number whitelist as the brief guard, built from the fact bundle plus the user's own quoted lines. `predict/explain.ts` routes through it; 8 cases added to `brief-guard.test.ts` (13 pass). |
| 10 Sep 2026 | **S5 fixed.** `bumpGuardRejection('brief' \| 'prediction')` added to `funnel.ts`, called from both guard call sites, carried in the JSON export, and surfaced on the You tab's Development rows — flagged `warn` above zero, because the row exists to be noticed. |
| 10 Sep 2026 | **S6 fixed.** `RISKY_LEAD` + `csvField` extracted to the pure `src/lib/csv-field.ts` and re-exported from `export-csv.ts`; `\r` joined the quote set. 9 cases in the new `export-csv.test.ts`. Checked and confirmed `canonical` is the only free-text CSV field — `kind` is a closed enum on both write paths. |
| 10 Sep 2026 | **S7 fixed.** `keychainAccessible` → `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. No migration needed. |
| 10 Sep 2026 | **S8 fixed (unapplied).** `20260910120000_security_remediation_rls.sql` constrains `alias_overrides.exercise_id` to own-or-global rows on **both** insert and update. `rls-verification.sql` gained the `alias_overrides_cross_user` case, a case proving own/global ids are still accepted, and the S13 delete case. Not run against any database. |
| 10 Sep 2026 | **S9 fixed.** `.env.example` carries placeholders, plus the two new optional dev-door variables. |
| 10 Sep 2026 | **S10 fixed.** `MAX_IMPORT_BYTES` (10 MB) checked before the read *and* against the text actually read, since `size` is absent from some providers; `MAX_IMPORT_ROWS` (50 000) caps the mapped rows. An oversized file gets its own truthful `too-large` outcome rather than being called "not a Hevy export", and dropped rows are reported, not swallowed. |
| 10 Sep 2026 | **S11 fixed (undeployed).** `_shared/cors.ts` replaces the wildcard in all four functions with a narrow allow-list and `Vary: Origin`. The native app is unaffected — React Native sends no `Origin` at all. |
| 10 Sep 2026 | **S12 fixed (undeployed).** `delete-account` calls `bump_parse_rate` after `getUser()`. |
| 10 Sep 2026 | **S13 fixed (unapplied).** `corrections_delete` policy added in the same migration as S8. |
| 10 Sep 2026 | **S14 fixed.** `expo-modules-core@~57.0.17` declared via `npx expo install`. |
| 10 Sep 2026 | **S16 fixed (undeployed).** `sanitizeAliasText` strips angle brackets from the alias, its canonical name and the recent exercise names before templating; the assembled block is capped at 2000 chars. |
| 10 Sep 2026 | **S1, S2, S3 partial.** Everything reachable from the repository is done (see each section). What remains needs the owner: a `git filter-repo` + force-push and key rotation (S1); the Email-provider toggle and the RevenueCat webhook that would let entitlement enforcement be switched on (S2); deleting the `dev@recore.invalid` user and standing up a separate development project (S3). |
| 10 Sep 2026 | **Three checks repaired.** S8's `grep -rzq` could never match under ugrep (`-z` is *decompress* there, not null-data) — replaced with `scripts/check-alias-policy.py`. S6's check follows the rule to `csv-field.ts` and now also asserts it is applied. S2's entitlement check no longer passes on a gate that is not enforcing. Net: 34 check lines → 37. |
| 10 Sep 2026 | **Run at close: 33 passed · 4 failed · 0 skipped.** All four failures are owner-only actions, listed above. Nothing in this document is committed — the Commit column reads `working tree` throughout and needs real hashes. |
| 10 Sep 2026 | **Second pass, same day — six findings added (S17–S22).** The first review read `src/` at `841619f`; the coaching migrations landed after it, and the client's own spend path was never looked at. S17/S18/S19 come from reading `20260910140000_coaching.sql` against what RLS actually does; S20 from reading the privacy policy against the same migration; S21/S22 from the sync and parse loops. |
| 10 Sep 2026 | **Two failing gate items repaired first.** `src/lib/parse/receipt.test.ts` asserted a `setTableOf` contract that had moved — `warm`/`drop` from `label` to `mark`, RIR from `note` to its own field — so the tests, not the code, were stale. Updated to the real contract; `npm test` green. |
| 10 Sep 2026 | **S1 had silently regressed and was re-applied.** `app.zip` was tracked again and the staged `git rm --cached` was gone. Worth recording as a property, not an incident: **the S1 fix lives only in the index, so any `git reset` undoes it.** It is not durable until it is committed. |
| 10 Sep 2026 | **S17 fixed (unapplied).** `20260910200000_redeem_rate_limit.sql`: 10 attempts / 15 min per user, 500 / hour project-wide. `redeem_coach_invite` returns `jsonb` instead of raising, because PostgREST's one-transaction-per-request would roll the counter back with the exception. |
| 10 Sep 2026 | **S18 fixed (unapplied).** `profiles_select` back to `id = auth.uid()`; the linked display name comes from the two `security definer` RPCs that already return that column alone. Closes the email leak across a coaching link. |
| 10 Sep 2026 | **S19 fixed (unapplied).** `exercises_select` reaches an active coach, so the coach's screen stops printing `Unread line` for every client-owned movement. |
| 10 Sep 2026 | **S20 fixed.** The coaching disclosure and Expo's processor line are gated on `isCoachModeOn()`, the same build-time flag every coaching screen uses; the flat "no other user can read it" promise is qualified. `.env.example` documents the flag. **Wording still needs the owner's approval before publication.** |
| 10 Sep 2026 | **S21 fixed.** `parse/backoff.ts` (pure, tested) + `db/parse-backoff.ts` + schema v8. A failed reading waits 2 min → 24 h and never gives up; offline is free; the queue orders by fewest failures so a poison note cannot starve an imported history. |
| 10 Sep 2026 | **S22 fixed.** A full push batch or pull page queues the next pass. |
| 10 Sep 2026 | **Run at close of the second pass: 51 passed · 4 failed · 0 skipped** (37 check lines → 55). All four failures are the owner-only actions of S1 and S2 — every finding reachable from this repository now passes. |
| 10 Sep 2026 | **Third pass — the systematic sweep the first two skipped (S23–S26).** The first two passes followed findings; this one walked the app in order: boot → auth → billing attach → storage → deletion → export → caches → the three model call sites. That ordering is what surfaced S23, which no amount of reading security-shaped files would have found: it is a plain unreachable `else`. |
| 10 Sep 2026 | **S23 fixed.** `if (userId)` on a constant made the signed-out branch dead code, so `Purchases.logIn('sim-verify-user')` ran on every signed-out install and aliased them all to one RevenueCat customer — with `isAttachedToAccount()` answering true in front of a pre-sign-in paywall. Entitlement is now resolved only for a real session and released when one ends. Prices unaffected: offerings need `configureStore()`, not `logIn`. |
| 10 Sep 2026 | **S24 fixed.** The sign-out alert said "Your training stays on this device"; `ensureLocalUser` wipes it. Now it says what is true, and when rows are still `dirty = 1` it says how many would be lost. |
| 10 Sep 2026 | **S25 fixed.** One `WIPE_SQL` in `db/schema.ts` replacing the literal in two files, with three tests over the schema source: coverage, no ghost tables, FK order. |
| 10 Sep 2026 | **S26 fixed.** A guard-rejected brief rewrite waited for nothing and was re-requested on every mount of Next and every opening of a lift sheet. It now backs off by the parser's own rule. `explain-prediction` checked and clear — it fires off a parse, not off a render. |
| 10 Sep 2026 | **Run at close of the third pass: 62 passed · 4 failed · 0 skipped.** Unchanged failures, all owner-only: S1's force-push and key rotation, S2's Email toggle and RevenueCat webhook. |
| 10 Sep 2026 | **Disk, not code, and it blocked everything.** The machine had 158 MB free of 228 GB — no local Time Machine snapshots, just ~14 GB of Xcode DerivedData, iOS DeviceSupport and dead simulators. Cleared with the owner's yes; 9.9 GB free. A full disk fails builds in ways that read as code faults, so it is recorded here. |

---

## The run at close

10 September 2026, working tree, uncommitted. Baseline was 3 passed · 31 failed across 34 check
lines; this is 33 passed · 4 failed across 37. Every remaining failure is one of the four owner
actions above.

```

S1 · build archive with .env out of git
  PASS  app.zip is not tracked
  PASS  app.zip is gitignored
  FAIL  app.zip still appears in 1 commit(s) — history not rewritten
  PASS  no build archive of any kind is tracked
  FAIL  NET app.zip still downloadable from the public repo (HTTP 200)

S2 · open signup + unmetered AI access
  FAIL  NET live auth config: email provider enabled; disable_signup=false; mailer_autoconfirm=true
  PASS  all three AI functions call the entitlement gate
  FAIL  entitlement gate is present but NOT enforcing — no webhook writes profiles.entitled_until yet. Flip the default in _shared/gate.ts and 'supabase secrets set REQUIRE_ENTITLEMENT=true' once it does.
  PASS  a global (not just per-user) rate ceiling exists
  PASS  parse-workout max_tokens lowered
  NOTE  a repo grep is not a deploy. Confirm with:  supabase functions list
        and compare UPDATED_AT against: git log -1 --format=%cI -- supabase/functions

S3 · hardcoded dev credential
  PASS  no literal password in the dev sign-in path
  PASS  no client-side account creation in src/lib/auth/
  NOTE  deleting the dev@recore.invalid row is a dashboard action; record
        the Supabase Auth → Users screenshot or the CLI output as evidence.

S4 · explain-prediction output guard
  PASS  sanitizePredictionReason exists in brief-guard.ts
  PASS  predict/explain.ts routes the model reason through the guard
  PASS  the guard has test coverage

S5 · guard rejections counted
  PASS  funnel.ts records guard rejections
  PASS  both guard call sites report a rejection

S6 · CSV formula injection on export
  PASS  csv-field.ts defines the formula-lead rule (RISKY_LEAD)
  PASS  export-csv.ts names the rule its output obeys
  PASS  the exercise-name column routes through csvField
  PASS  export-csv.test.ts exists and exercises the rule

S7 · session keychain item must not leave the device
  PASS  secure-storage.ts uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY

S8 · alias_overrides.exercise_id ownership
  PASS  the insert AND update policies constrain exercise_id to own/global rows
  PASS  rls-verification.sql proves the cross-user reference is refused

S9 · .env.example holds no live project values
  PASS  .env.example has no real project ref
  PASS  .env.example carries a placeholder anon key

S10 · CSV import bounds
  PASS  pick.ts bounds the file size before reading it
  PASS  the row/day count is bounded

S11 · CORS not wildcard
  PASS  no edge function answers Allow-Origin: *

S12 · delete-account rate limited
  PASS  delete-account calls the rate-limit RPC

S13 · corrections delete policy
  PASS  a corrections delete policy exists

S14 · no undeclared (phantom) dependency
  PASS  expo-modules-core is a declared dependency

S15 · npm advisories (runtime deps)
  PASS  NET no high/critical advisories in runtime deps

S16 · alias text cannot escape the prompt tag
  PASS  alias text is stripped of angle brackets before templating

Repository gates (CLAUDE.md §5.5) — these must pass with every fix
  PASS  typecheck
  PASS  tests
  PASS  lint

33 passed · 4 failed · 0 skipped
```
