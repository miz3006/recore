#!/usr/bin/env bash
#
# security-verify.sh — the machine half of docs/security-remediation-2026-09.md.
#
# Every finding in that document has a check here. A finding may be recorded as
# FIXED only when its check prints PASS. This exists so "fixed" is an observed
# fact rather than a claim: the person closing an item pastes this script's
# output into the item's Evidence block.
#
#   ./scripts/security-verify.sh          # everything
#   ./scripts/security-verify.sh S1 S4    # only these ids
#
# Checks that need the network are marked NET and are skipped with SKIP when
# offline. A SKIP is never a PASS and never closes an item.
#
# Exit code is the number of FAILs, so CI can gate on it.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 99

PASS=0; FAIL=0; SKIP=0
WANT=("$@")

want() {
  [ ${#WANT[@]} -eq 0 ] && return 0
  for w in "${WANT[@]}"; do [ "$w" = "$1" ] && return 0; done
  return 1
}
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
skip() { printf '  \033[33mSKIP\033[0m  %s\n' "$1"; SKIP=$((SKIP+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

online() { curl -s --max-time 5 -o /dev/null https://registry.npmjs.org/ 2>/dev/null; }
NET_OK=1; online || NET_OK=0

# Read the project from .env so the script never hardcodes a URL or a key.
SB_URL="$(grep -m1 '^EXPO_PUBLIC_SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)"
SB_KEY="$(grep -m1 '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d= -f2- || true)"

# ---------------------------------------------------------------------------
if want S1; then
head_ "S1 · build archive with .env out of git"

  if git ls-files --error-unmatch app.zip >/dev/null 2>&1; then
    fail "app.zip is still tracked by git"
  else
    pass "app.zip is not tracked"
  fi

  if git check-ignore -q app.zip 2>/dev/null; then
    pass "app.zip is gitignored"
  else
    fail "app.zip is not gitignored — 'git add -A' would commit it again"
  fi

  n_hist="$(git log --all --oneline -- app.zip 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$n_hist" = "0" ]; then
    pass "app.zip appears in no commit on any ref"
  else
    fail "app.zip still appears in $n_hist commit(s) — history not rewritten"
  fi

  # Any archive tracked at all is the same mistake wearing a different name.
  n_arch="$(git ls-files | grep -cE '\.(zip|tar|tar\.gz|tgz|ipa|apk|aab)$' || true)"
  if [ "$n_arch" = "0" ]; then
    pass "no build archive of any kind is tracked"
  else
    fail "$n_arch archive(s) tracked: $(git ls-files | grep -E '\.(zip|tar|tar\.gz|tgz|ipa|apk|aab)$' | tr '\n' ' ')"
  fi

  if [ "$NET_OK" = "1" ]; then
    code="$(curl -sL --max-time 20 -o /dev/null -w '%{http_code}' https://github.com/miz3006/recore/raw/main/app.zip 2>/dev/null)"
    if [ "$code" = "404" ]; then
      pass "NET github.com/miz3006/recore/raw/main/app.zip → 404"
    else
      fail "NET app.zip still downloadable from the public repo (HTTP $code)"
    fi
  else
    skip "NET public-repo reachability check (offline)"
  fi
fi

# ---------------------------------------------------------------------------
if want S2; then
head_ "S2 · open signup + unmetered AI access"

  if [ "$NET_OK" = "1" ] && [ -n "$SB_URL" ] && [ -n "$SB_KEY" ]; then
    curl -s --max-time 20 "$SB_URL/auth/v1/settings" -H "apikey: $SB_KEY" > /tmp/.recore-auth-settings.json 2>/dev/null
    python3 - <<'PY' > /tmp/.recore-auth-verdict 2>/dev/null
import json
try:
    d = json.load(open('/tmp/.recore-auth-settings.json'))
except Exception:
    print('ERROR unreadable'); raise SystemExit
e = d.get('external', {})
bad = []
if e.get('email'):            bad.append('email provider enabled')
if not d.get('disable_signup'): bad.append('disable_signup=false')
if d.get('mailer_autoconfirm'): bad.append('mailer_autoconfirm=true')
print(('FAIL ' + '; '.join(bad)) if bad else 'OK apple/google only, signup closed')
PY
    v="$(cat /tmp/.recore-auth-verdict 2>/dev/null || echo 'ERROR')"
    case "$v" in
      OK*)   pass "NET live auth config: ${v#OK }" ;;
      FAIL*) fail "NET live auth config: ${v#FAIL }" ;;
      *)     skip "NET auth settings probe returned nothing usable" ;;
    esac
  else
    skip "NET live auth-config probe (offline or .env unreadable)"
  fi

  miss=""
  for f in parse-workout explain-brief explain-prediction; do
    grep -q 'checkEntitlement' "supabase/functions/$f/index.ts" 2>/dev/null || miss="$miss $f"
  done
  if [ -z "$miss" ]; then
    pass "all three AI functions call the entitlement gate"
  else
    fail "no entitlement check in:$miss"
  fi

  # THE GATE EXISTING IS NOT THE GATE ENFORCING. checkEntitlement returns ok
  # when REQUIRE_ENTITLEMENT is unset, so the check above would pass on a gate
  # that lets everyone through — precisely the "passed for the wrong reason"
  # failure this script is written to avoid. Enforcement is deliberately off
  # until the RevenueCat webhook writes profiles.entitled_until (see
  # _shared/gate.ts); this line is what keeps S2 visibly open until it is on.
  if grep -q "Deno.env.get('REQUIRE_ENTITLEMENT') ?? 'true'" supabase/functions/_shared/gate.ts 2>/dev/null; then
    pass "entitlement is ENFORCED by default"
  else
    fail "entitlement gate is present but NOT enforcing — no webhook writes profiles.entitled_until yet. Flip the default in _shared/gate.ts and 'supabase secrets set REQUIRE_ENTITLEMENT=true' once it does."
  fi

  if grep -qE 'p_global|GLOBAL_(DAILY|RATE)|bump_global' supabase/migrations/*.sql supabase/functions/*/index.ts 2>/dev/null; then
    pass "a global (not just per-user) rate ceiling exists"
  else
    fail "rate limiting is per-user only — N accounts buy N quotas"
  fi

  if grep -q 'max_tokens: 16000' supabase/functions/parse-workout/index.ts 2>/dev/null; then
    fail "parse-workout max_tokens is still 16000 for a 4000-char input"
  else
    pass "parse-workout max_tokens lowered"
  fi

  echo "  NOTE  a repo grep is not a deploy. Confirm with:  supabase functions list"
  echo "        and compare UPDATED_AT against: git log -1 --format=%cI -- supabase/functions"
fi

# ---------------------------------------------------------------------------
if want S3; then
head_ "S3 · hardcoded dev credential"

  if [ -f src/lib/auth/dev-sign-in.ts ] && grep -qE "^const DEV_PASSWORD = '" src/lib/auth/dev-sign-in.ts 2>/dev/null; then
    fail "a literal password is still in src/lib/auth/dev-sign-in.ts"
  else
    pass "no literal password in the dev sign-in path"
  fi

  if grep -rq 'signUp(' src/lib/auth/ 2>/dev/null; then
    fail "src/lib/auth/ can still create an account with signUp()"
  else
    pass "no client-side account creation in src/lib/auth/"
  fi

  echo "  NOTE  deleting the dev@recore.invalid row is a dashboard action; record"
  echo "        the Supabase Auth → Users screenshot or the CLI output as evidence."
fi

# ---------------------------------------------------------------------------
if want S4; then
head_ "S4 · explain-prediction output guard"

  if grep -q 'sanitizePredictionReason' src/lib/brief-guard.ts 2>/dev/null; then
    pass "sanitizePredictionReason exists in brief-guard.ts"
  else
    fail "no sanitizePredictionReason in src/lib/brief-guard.ts"
  fi

  if grep -q 'sanitizePredictionReason' src/lib/predict/explain.ts 2>/dev/null; then
    pass "predict/explain.ts routes the model reason through the guard"
  else
    fail "predict/explain.ts still writes the model reason unguarded"
  fi

  if grep -q 'sanitizePredictionReason' src/lib/brief-guard.test.ts 2>/dev/null; then
    pass "the guard has test coverage"
  else
    fail "no test asserts an invented number is rejected"
  fi
fi

# ---------------------------------------------------------------------------
if want S5; then
head_ "S5 · guard rejections counted"

  if grep -q 'GuardRejection\|guard_rejection\|bumpGuardRejection' src/lib/funnel.ts 2>/dev/null; then
    pass "funnel.ts records guard rejections"
  else
    fail "guard rejections are invisible — no counter in funnel.ts"
  fi

  hits=0
  grep -q 'bumpGuardRejection' src/lib/brief-explain.ts 2>/dev/null && hits=$((hits+1))
  grep -q 'bumpGuardRejection' src/lib/predict/explain.ts 2>/dev/null && hits=$((hits+1))
  if [ "$hits" = "2" ]; then
    pass "both guard call sites report a rejection"
  else
    fail "only $hits/2 guard call sites report a rejection"
  fi
fi

# ---------------------------------------------------------------------------
if want S6; then
head_ "S6 · CSV formula injection on export"

  # RISKY_LEAD is the named constant the fix introduces — an exact token, so
  # this cannot pass by accidentally matching prose. It is DEFINED in
  # csv-field.ts (a pure module, so `node --test` can reach it — export-csv.ts
  # itself drags in expo-sqlite) and re-exported from export-csv.ts, so both
  # files are checked: the rule must exist, and the file that writes the CSV
  # must still name it.
  if grep -q 'RISKY_LEAD' src/lib/csv-field.ts 2>/dev/null; then
    pass "csv-field.ts defines the formula-lead rule (RISKY_LEAD)"
  else
    fail "no RISKY_LEAD rule — a leading =/+/-/@ is emitted unescaped"
  fi

  if grep -q 'RISKY_LEAD' src/lib/export-csv.ts 2>/dev/null; then
    pass "export-csv.ts names the rule its output obeys"
  else
    fail "export-csv.ts no longer references RISKY_LEAD"
  fi

  # The rule existing is not the rule being APPLIED: the free-text column has
  # to route through csvField or none of the above matters.
  if grep -q 'csvField(r.canonical)' src/lib/export-csv.ts 2>/dev/null; then
    pass "the exercise-name column routes through csvField"
  else
    fail "the exercise-name column does not route through csvField"
  fi

  if [ -f src/lib/export-csv.test.ts ] && grep -q 'RISKY_LEAD' src/lib/export-csv.test.ts 2>/dev/null; then
    pass "export-csv.test.ts exists and exercises the rule"
  else
    fail "no test pins the escaping rule"
  fi
fi

# ---------------------------------------------------------------------------
if want S7; then
head_ "S7 · session keychain item must not leave the device"

  if grep -q 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY' src/lib/secure-storage.ts 2>/dev/null; then
    pass "secure-storage.ts uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY"
  else
    fail "secure-storage.ts still allows iCloud Keychain / cross-device restore"
  fi
fi

# ---------------------------------------------------------------------------
if want S8; then
head_ "S8 · alias_overrides.exercise_id ownership"

  # The rewritten policies must name public.exercises inside their own
  # with-check, which is a MULTI-LINE match.
  #
  # This was `grep -rzq` until 10 Sep 2026, on the assumption that -z makes grep
  # treat the file as one buffer. That is true of GNU grep and FALSE of ugrep,
  # which is what `grep` resolves to on the machine this was written on — there
  # -z means DECOMPRESS, so the pattern could never match and the check reported
  # an unfixed policy no matter what the migration said. Python has no such
  # ambiguity and is already a dependency of this script.
  #
  # Both verbs are required: insert alone would let the check be satisfied on
  # creation and then walked to another user's row by an update.
  if python3 scripts/check-alias-policy.py 2>/dev/null; then
    pass "the insert AND update policies constrain exercise_id to own/global rows"
  else
    fail "alias_overrides insert/update still accepts another user's exercise_id"
  fi

  # An exact marker, not the table name — the old test already mentions the
  # table without testing the cross-user case.
  if grep -q 'alias_overrides_cross_user' supabase/tests/rls-verification.sql 2>/dev/null; then
    pass "rls-verification.sql proves the cross-user reference is refused"
  else
    fail "no RLS test proves the cross-user reference is refused"
  fi
fi

# ---------------------------------------------------------------------------
if want S9; then
head_ "S9 · .env.example holds no live project values"

  if grep -q 'nkjrukxrocplesonotqo' .env.example 2>/dev/null; then
    fail ".env.example still contains the real project ref"
  else
    pass ".env.example has no real project ref"
  fi

  if grep -qE '^EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ' .env.example 2>/dev/null; then
    fail ".env.example still contains a real anon JWT"
  else
    pass ".env.example carries a placeholder anon key"
  fi
fi

# ---------------------------------------------------------------------------
if want S10; then
head_ "S10 · CSV import bounds"

  if grep -qE '\.size|MAX_IMPORT' src/lib/import/pick.ts 2>/dev/null; then
    pass "pick.ts bounds the file size before reading it"
  else
    fail "pick.ts reads a file of any size into memory"
  fi

  if grep -qE 'MAX_IMPORT_(ROWS|DAYS)|slice\(0,' src/lib/import/formats.ts src/lib/import/apply.ts 2>/dev/null; then
    pass "the row/day count is bounded"
  else
    fail "an import of any length is written in one transaction"
  fi
fi

# ---------------------------------------------------------------------------
if want S11; then
head_ "S11 · CORS not wildcard"

  bad=""
  for f in supabase/functions/*/index.ts; do
    grep -q "'Access-Control-Allow-Origin': '\*'" "$f" 2>/dev/null && bad="$bad $(basename "$(dirname "$f")")"
  done
  if [ -z "$bad" ]; then
    pass "no edge function answers Allow-Origin: *"
  else
    fail "wildcard CORS still in:$bad"
  fi
fi

# ---------------------------------------------------------------------------
if want S12; then
head_ "S12 · delete-account rate limited"

  # An actual RPC call, not the word "rate" — the header comment mentions
  # "the rate-limit row" and used to make this pass while nothing was enforced.
  if grep -q "rpc('bump_parse_rate'" supabase/functions/delete-account/index.ts 2>/dev/null; then
    pass "delete-account calls the rate-limit RPC"
  else
    fail "delete-account has no rate limit"
  fi
fi

# ---------------------------------------------------------------------------
if want S13; then
head_ "S13 · corrections delete policy"

  if grep -q 'corrections_delete' supabase/migrations/*.sql 2>/dev/null; then
    pass "a corrections delete policy exists"
  else
    fail "a user cannot delete their own corrections rows"
  fi
fi

# ---------------------------------------------------------------------------
if want S14; then
head_ "S14 · no undeclared (phantom) dependency"

  if node -e "process.exit(require('./package.json').dependencies['expo-modules-core']?0:1)" 2>/dev/null; then
    pass "expo-modules-core is a declared dependency"
  else
    fail "expo-modules-core is imported but only installed transitively"
  fi
fi

# ---------------------------------------------------------------------------
if want S15; then
head_ "S15 · npm advisories (runtime deps)"

  if [ "$NET_OK" = "1" ]; then
    # npm audit exits non-zero whenever anything is found, and pipefail would
    # turn that into a spurious ERR — so the exit status is discarded here and
    # the verdict comes from the JSON alone.
    npm audit --omit=dev --json >/tmp/.recore-audit.json 2>/dev/null || true
    n="$(python3 -c "import json;m=json.load(open('/tmp/.recore-audit.json')).get('metadata',{}).get('vulnerabilities',{});print(m.get('high',0)+m.get('critical',0))" 2>/dev/null || echo ERR)"
    if [ "$n" = "0" ]; then
      pass "NET no high/critical advisories in runtime deps"
    elif [ "$n" = "ERR" ]; then
      skip "NET npm audit produced no parseable output"
    else
      fail "NET $n high/critical advisor(y|ies) in runtime deps"
    fi
  else
    skip "NET npm audit (offline)"
  fi
fi

# ---------------------------------------------------------------------------
if want S16; then
head_ "S16 · alias text cannot escape the prompt tag"

  if grep -qE "replace.*[<>].*alias|sanitizeAlias|alias.*replace\(/\[<>\]" supabase/functions/parse-workout/index.ts 2>/dev/null; then
    pass "alias text is stripped of angle brackets before templating"
  else
    fail "a user alias can still contain </user_vocabulary>"
  fi
fi

# ---------------------------------------------------------------------------
if want S17; then
head_ "S17 · invite redemption is rate limited"

  if grep -q 'redeem_attempts' supabase/migrations/*.sql 2>/dev/null; then
    pass "a per-user attempt counter exists"
  else
    fail "redeem_coach_invite can be called as often as anyone likes"
  fi

  # THE POINT OF THE CHECK. PostgREST runs a request in one transaction, so a
  # `raise exception` would roll the counter's own increment back and the
  # limiter would forget every attempt it rejected. The function must answer,
  # not raise. Read the LAST definition, which is the one that is deployed.
  latest_redeem="$(grep -l 'function public.redeem_coach_invite' supabase/migrations/*.sql 2>/dev/null | sort | tail -1)"
  if [ -n "$latest_redeem" ] && ! sed 's/--.*$//' "$latest_redeem" |
       awk '/function public.redeem_coach_invite/,/^\$\$;/' | grep -q 'raise exception'; then
    pass "the newest redeem_coach_invite returns its refusals instead of raising"
  else
    fail "redeem_coach_invite still raises — the attempt counter rolls back with it"
  fi

  if grep -q "bump_global_rate('coach_redeem'" supabase/migrations/*.sql 2>/dev/null; then
    pass "a global ceiling bounds redemption across all accounts"
  else
    fail "a per-user limit only, which open signup defeats"
  fi

  if grep -q 'too_many_attempts' src/lib/coaching/index.ts 2>/dev/null; then
    pass "the client understands the new refusal"
  else
    fail "the app cannot tell a rate-limited join from a wrong code"
  fi
fi

# ---------------------------------------------------------------------------
if want S18; then
head_ "S18 · a coaching link does not expose the profiles row"

  # profiles.email lives on the row a widened select hands over whole. The
  # newest definition wins, so that is the one that is read.
  #
  # COMMENTS ARE STRIPPED FIRST, and the first draft of this check is why. The
  # migration that fixes this QUOTES the broken policy in its header so the next
  # reader can see what changed — so the check matched the explanation and
  # reported the fix as unfixed. A check that reads prose is not reading code.
  latest_profiles="$(grep -l 'policy profiles_select' supabase/migrations/*.sql 2>/dev/null | sort | tail -1)"
  if [ -n "$latest_profiles" ] && ! sed 's/--.*$//' "$latest_profiles" |
       awk '/policy profiles_select/,/;/' | grep -q 'is_linked_with'; then
    pass "profiles_select is own-row only (email is not readable across a link)"
  else
    fail "a linked account can select the other person's email from profiles"
  fi
fi

# ---------------------------------------------------------------------------
if want S19; then
head_ "S19 · a coach can read the exercise NAMES of a session they may read"

  latest_ex="$(grep -l 'policy exercises_select' supabase/migrations/*.sql 2>/dev/null | sort | tail -1)"
  if [ -n "$latest_ex" ] && sed 's/--.*$//' "$latest_ex" |
       awk '/policy exercises_select/,/;/' | grep -q 'is_active_coach_of'; then
    pass "exercises_select reaches an active coach"
  else
    fail "every client-owned movement renders as 'Unread line' on the coach's screen"
  fi
fi

# ---------------------------------------------------------------------------
if want S20; then
head_ "S20 · the privacy policy describes coaching exactly when the build has it"

  if grep -q 'isCoachModeOn()' src/lib/legal.ts 2>/dev/null; then
    pass "the policy's coaching section is gated on the same flag as the feature"
  else
    fail "the policy cannot turn on with the feature — it says nothing about a coach"
  fi

  if grep -q 'If you link a coach' src/lib/legal.ts 2>/dev/null; then
    pass "the section exists and names what a coach can read"
  else
    fail "no section describes what a linked coach reads"
  fi

  # A comment's text and the sender's name reach Expo's push service, so the
  # processor list has a sixth entry the moment coaching is on.
  if grep -q 'Expo — delivers the notification' src/lib/legal.ts 2>/dev/null; then
    pass "Expo's push service is named as a processor under the same flag"
  else
    fail "the processor list is short by one whenever coaching ships"
  fi

  # THE PROMISE AND THE CROSS-REFERENCE MOVE TOGETHER, which is why this reads
  # for a pair rather than for an absence. The flat sentence is still in the
  # file and must be — it is the correct text for a build WITHOUT coaching. What
  # must not exist is a build where only one of the two is true: the flat
  # promise beside the feature, or a pointer to a section that is not on the
  # page. So both spellings must be present and the qualifier must be gated.
  if grep -q 'so no other user can read it unless you deliberately link a coach' src/lib/legal.ts 2>/dev/null &&
     grep -q 'so no other user can read it, and the same scoping' src/lib/legal.ts 2>/dev/null &&
     grep -q 'isCoachModeOn()$' src/lib/legal.ts 2>/dev/null; then
    pass "the scoping sentence and its cross-reference are gated as a pair"
  else
    fail "the policy either contradicts coaching or points at a section it does not have"
  fi

  # And the generated page must actually obey it, not just the source.
  # `grep -c` PRINTS 0 and EXITS 1 when nothing matches, so `|| echo 0` appends a
  # second zero and every numeric test downstream reads "0\n0". Let the count
  # stand on its own and default only when the file is missing entirely.
  off_refs="$(grep -c 'If you link a coach' docs/privacy.html 2>/dev/null)"
  off_refs="${off_refs:-0}"
  if grep -q 'Expo — delivers' docs/privacy.html 2>/dev/null; then
    if [ "$off_refs" -ge 2 ]; then
      pass "docs/privacy.html was generated WITH coaching and is internally consistent"
    else
      fail "docs/privacy.html names Expo but has no coaching section"
    fi
  elif [ "$off_refs" = "0" ]; then
    pass "docs/privacy.html was generated without coaching and has no dangling reference"
  else
    fail "docs/privacy.html points at a coaching section it does not contain"
  fi
fi

# ---------------------------------------------------------------------------
if want S21; then
head_ "S21 · a reading that fails does not ask again on every app open"

  if [ -f src/lib/parse/backoff.ts ]; then
    pass "the retry rule exists as a pure, testable module"
  else
    fail "no backoff rule — needs_parse retries for ever, one model call per open"
  fi

  if grep -q 'recordParseFailure' src/lib/parse/client.ts 2>/dev/null; then
    pass "the parse client records a failed reading"
  else
    fail "failures are not counted, so nothing can bound them"
  fi

  if grep -q 'parse_next_at' src/lib/db/workouts.ts 2>/dev/null; then
    pass "the queue honours the wait"
  else
    fail "the wait is recorded and then ignored by the queue"
  fi

  # The order matters as much as the wait: newest-first alone means five
  # unreadable notes starve an imported history behind them for ever.
  if grep -q 'parse_attempts ASC' src/lib/db/workouts.ts 2>/dev/null; then
    pass "fewest failures first, so a poison note cannot starve the queue"
  else
    fail "the queue still returns the same failing notes on every pass"
  fi

  if [ -f src/lib/parse/backoff.test.ts ] && grep -q '1440' src/lib/parse/backoff.test.ts 2>/dev/null; then
    pass "the rule has test coverage, including the ceiling"
  else
    fail "the spend bound is untested"
  fi
fi

# ---------------------------------------------------------------------------
if want S22; then
head_ "S22 · a full sync batch books its continuation"

  if grep -q 'PUSH_BATCH' src/lib/sync/index.ts 2>/dev/null &&
     grep -q 'if (await pushWorkouts(userId)) queued = true' src/lib/sync/index.ts 2>/dev/null; then
    pass "a full push batch queues another pass"
  else
    fail "an imported history advances 50 days per app open and reports no error"
  fi

  if grep -q 'if (await pullRemote(userId)) queued = true' src/lib/sync/index.ts 2>/dev/null; then
    pass "a full pull page queues another pass"
  else
    fail "a second device stops pulling after 100 workouts until it is reopened"
  fi
fi

# ---------------------------------------------------------------------------
if want S23; then
head_ "S23 · the store is attached to an account or to nothing"

  # THE DEFECT WAS AN UNREACHABLE ELSE. `userId` is `session?.user.id ??
  # LOCAL_USER_ID`, so `if (userId)` was always true and the signed-out branch
  # was dead — which meant every signed-out install called
  # Purchases.logIn('sim-verify-user') and shared one RevenueCat customer.
  #
  # COMMENTS STRIPPED FIRST, for the third time in this script. The fix QUOTES
  # the defect it replaced so the next reader can see what changed, so a naive
  # grep reads the explanation and calls the fix unfixed. Drop `//` lines and
  # JSDoc continuation lines before reading any of these files.
  code_only() { grep -vE '^[[:space:]]*(//|\*|/\*)' "$1" 2>/dev/null; }

  if code_only src/lib/auth/provider.tsx | grep -q 'if (signedIn) {' &&
     ! code_only src/lib/auth/provider.tsx | grep -q 'if (userId) {'; then
    pass "the signed-out branch is reachable (no 'if (userId)' on a constant)"
  else
    fail "the signed-out branch is dead code — releaseEntitlement never runs"
  fi

  # resolveEntitlement is what calls Purchases.logIn. It must sit INSIDE the
  # signed-in branch, not above it.
  if code_only src/lib/auth/provider.tsx |
       awk '/if \(signedIn\) \{/,/^    \} else \{/' | grep -q 'resolveEntitlement'; then
    pass "entitlement is resolved only for a real session"
  else
    fail "the placeholder id is handed to the store, aliasing every install to one customer"
  fi

  if code_only src/lib/auth/provider.tsx |
       awk '/\} else \{/,/^  \}, \[/' | grep -q 'releaseEntitlement'; then
    pass "signing out detaches the store customer"
  else
    fail "the next account on this device inherits the previous entitlement"
  fi
fi

# ---------------------------------------------------------------------------
if want S24; then
head_ "S24 · signing out does not promise what the wipe takes"

  if ! grep -q 'Your training stays on this device and on the server' "src/app/(tabs)/you/index.tsx" 2>/dev/null; then
    pass "the alert no longer claims the local copy survives"
  else
    fail "the alert promises local data that ensureLocalUser deletes"
  fi

  if grep -q 'countUnsyncedSessions' "src/app/(tabs)/you/index.tsx" 2>/dev/null &&
     grep -q 'countUnsyncedSessions' src/lib/db/workouts.ts 2>/dev/null; then
    pass "the alert names how many sessions have not reached the server"
  else
    fail "unsynced sessions are destroyed on sign-out with no warning"
  fi
fi

# ---------------------------------------------------------------------------
if want S25; then
head_ "S25 · the local wipe has ONE definition"

  if grep -q 'export const WIPE_SQL' src/lib/db/schema.ts 2>/dev/null; then
    pass "WIPE_SQL is declared beside the tables it names"
  else
    fail "the wipe is a literal, so its two copies can drift apart"
  fi

  # No caller may keep its own copy of the list.
  stray="$(grep -lE "DELETE FROM parse_cache; DELETE FROM corrections" src/lib/db/index.ts src/lib/account/delete.ts 2>/dev/null | tr '\n' ' ')"
  if [ -z "$stray" ]; then
    pass "both wipe call sites use the shared constant"
  else
    fail "a literal wipe list survives in: $stray"
  fi

  if grep -q 'the wipe empties every table the schema creates' src/lib/db/schema.test.ts 2>/dev/null; then
    pass "a test fails the build if a new table is never wiped"
  else
    fail "nothing guarantees a new table is included in the wipe"
  fi
fi

# ---------------------------------------------------------------------------
if want S26; then
head_ "S26 · a rejected brief rewrite is not asked for again on every open"

  if grep -q 'recordRefineFailure' src/lib/brief-explain.ts 2>/dev/null; then
    pass "a failed rewrite is remembered"
  else
    fail "a guard-rejected paragraph calls the model again on every screen open"
  fi

  if grep -q "nextAttemptAt" src/lib/brief-explain.ts 2>/dev/null; then
    pass "it waits by the same rule the parser uses (one answer, not two)"
  else
    fail "the brief invented its own retry policy"
  fi

  if grep -q 'FunctionsFetchError' src/lib/brief-explain.ts 2>/dev/null; then
    pass "being offline is still free"
  else
    fail "a gym with no signal earns a backoff it did not cause"
  fi
fi

# ---------------------------------------------------------------------------
if want GATES; then
head_ "Repository gates (CLAUDE.md §5.5) — these must pass with every fix"

  if npm run -s typecheck >/dev/null 2>&1; then pass "typecheck"; else fail "typecheck"; fi
  if npm test >/dev/null 2>&1;            then pass "tests";     else fail "tests"; fi
  if npm run -s lint >/dev/null 2>&1;     then pass "lint";      else fail "lint"; fi
fi

# ---------------------------------------------------------------------------
printf '\n\033[1m%d passed · %d failed · %d skipped\033[0m\n' "$PASS" "$FAIL" "$SKIP"
[ "$SKIP" -gt 0 ] && echo "A SKIP is not a PASS. Re-run online before closing an item."
exit "$FAIL"
