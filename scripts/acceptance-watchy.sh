#!/usr/bin/env bash
#
# Acceptance test for Watchy, run against a local D1.
#
# This is the test the whole estate exists to pass, and nothing in the estate passed it
# on 2026-09-05. It sets up four registered things in four states and asserts that the
# watcher reaches the right verdict about each:
#
#   healthy       reported recently                       -> no finding
#   overdue       reported once, long ago                 -> overdue
#   neverran      registered long ago, never reported     -> never_ran
#   undercovered  reported success, covered less than due -> undercovered
#
# The third case is the important one. On 2026-09-05 the two genuinely dead things in
# the estate, patriot-tidy and shipnotes, were both enabled, both correctly configured,
# and had both never run once. Any check that asks "does this exist" reports them
# healthy. Only a check that asks "has this reported" catches them.
#
# Usage: bash scripts/acceptance-watchy.sh
set -euo pipefail

cd "$(dirname "$0")/../worker"

TOKEN="local-development-token-not-a-real-secret-000000"
PORT=8799
BASE="http://127.0.0.1:${PORT}"

d1() { npx wrangler d1 execute estate-db --local --command "$1" >/dev/null 2>&1; }

echo "== seeding four test rows in known states =="

d1 "DELETE FROM findings WHERE registry_key LIKE 'test:%';"
d1 "DELETE FROM agent_runs WHERE registry_key LIKE 'test:%';"
d1 "DELETE FROM registry WHERE key LIKE 'test:%';"

# Backdated directly in SQL. The API deliberately refuses to accept last_run_at, so a
# registry row can never claim a liveness it has not demonstrated. A test is the one
# place that rule has to be worked around, and doing it here rather than loosening the
# API is the right trade.
d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status, last_run_at, first_run_at, created_at)
    VALUES ('test:healthy','test','healthy','worker','worker_cron',60,'active',
            datetime('now','-10 minutes'), datetime('now','-1 day'), datetime('now','-1 day'));"

d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status, last_run_at, first_run_at, created_at)
    VALUES ('test:overdue','test','overdue','field','routine',60,'active',
            datetime('now','-200 minutes'), datetime('now','-1 day'), datetime('now','-1 day'));"

d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status, created_at)
    VALUES ('test:neverran','test','neverran','field','routine',60,'active',
            datetime('now','-200 minutes'));"

d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status, last_run_at, first_run_at, created_at)
    VALUES ('test:undercovered','test','undercovered','worker','worker_cron',60,'active',
            datetime('now','-5 minutes'), datetime('now','-1 day'), datetime('now','-1 day'));"

# The six-week-SEO-failure shape: ok = 1, and covered 3 of 16.
d1 "INSERT INTO agent_runs (registry_key, started_at, ok, expected, actual, summary)
    VALUES ('test:undercovered', datetime('now','-5 minutes'), 1, 16, 3, 'Reported success.');"

d1 "INSERT INTO agent_runs (registry_key, started_at, ok, expected, actual, summary)
    VALUES ('test:healthy', datetime('now','-10 minutes'), 1, 4, 4, 'All four covered.');"

# Daylight saving guard. 08:15 Eastern is 12:15 UTC while EDT is in force and 13:15 UTC
# after 1 November. So "15 13 * * *" is the November value, and asserting that it reads
# as drift TODAY is the same check that will catch the real transition in reverse.
d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status,
                          last_run_at, first_run_at, created_at, local_time, timezone, cron_utc)
    VALUES ('test:drifted','test','drifted','field','routine',1440,'active',
            datetime('now','-10 minutes'), datetime('now','-1 day'), datetime('now','-1 day'),
            '08:15','America/New_York','15 13 * * *');"

d1 "INSERT INTO registry (key, entity, role, room, source, expected_every_minutes, status,
                          last_run_at, first_run_at, created_at, local_time, timezone, cron_utc)
    VALUES ('test:ontime','test','ontime','field','routine',1440,'active',
            datetime('now','-10 minutes'), datetime('now','-1 day'), datetime('now','-1 day'),
            '08:15','America/New_York','15 12 * * *');"

echo "== starting worker =="
npx wrangler dev --local --port "$PORT" >/tmp/estate-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  if curl -fsS "${BASE}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS "${BASE}/health" >/dev/null || { echo "worker did not start"; tail -30 /tmp/estate-dev.log; exit 1; }

echo "== auth must fail closed =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/state")
[ "$CODE" = "401" ] || { echo "FAIL: unauthenticated /api/state returned $CODE, expected 401"; exit 1; }
echo "  unauthenticated request rejected with 401"

echo "== running watchy =="
curl -fsS -X POST "${BASE}/api/watchy/run" -H "Authorization: Bearer ${TOKEN}" >/tmp/estate-watchy.json
cat /tmp/estate-watchy.json | head -c 600; echo

echo "== asserting findings =="
FINDINGS=$(curl -fsS "${BASE}/api/registry/findings" -H "Authorization: Bearer ${TOKEN}")

assert_finding() {
  local key="$1" kind="$2"
  if echo "$FINDINGS" | grep -q "\"registry_key\":\"${key}\",\"kind\":\"${kind}\""; then
    echo "  PASS  ${key} -> ${kind}"
  else
    echo "  FAIL  expected ${key} -> ${kind}"; echo "$FINDINGS"; exit 1
  fi
}

assert_no_finding() {
  local key="$1"
  if echo "$FINDINGS" | grep -q "\"registry_key\":\"${key}\""; then
    echo "  FAIL  ${key} should have no finding"; echo "$FINDINGS"; exit 1
  else
    echo "  PASS  ${key} -> no finding"
  fi
}

assert_finding "test:overdue" "overdue"
assert_finding "test:neverran" "never_ran"
assert_finding "test:undercovered" "undercovered"
assert_finding "test:drifted" "schedule_drift"
assert_no_finding "test:healthy"
assert_no_finding "test:ontime"

echo "== the drift finding must name the correct cron =="
if echo "$FINDINGS" | grep -q 'Correct cron is'; then
  echo "  PASS  drift detail names the cron that would fix it"
else
  echo "  FAIL  drift detail does not name a corrected cron"; echo "$FINDINGS"; exit 1
fi

echo "== findings must not duplicate on a second cycle =="
# Counted over this test's own keys only. A global count would make the test sensitive to
# unrelated estate state, which is how it first reported a phantom failure.
count_test_findings() {
  curl -fsS "${BASE}/api/registry/findings" -H "Authorization: Bearer ${TOKEN}" \
    | grep -o '"registry_key":"test:[a-z]*"' | wc -l | tr -d ' '
}
BEFORE=$(count_test_findings)
curl -fsS -X POST "${BASE}/api/watchy/run" -H "Authorization: Bearer ${TOKEN}" >/tmp/estate-watchy2.json
AFTER=$(count_test_findings)
[ "$BEFORE" = "$AFTER" ] || { echo "FAIL: test findings went from $BEFORE to $AFTER on a repeat cycle"; exit 1; }
echo "  PASS  $BEFORE findings before and after a repeat cycle"

OPENED=$(grep -o '"opened":\[\]' /tmp/estate-watchy2.json || true)
[ -n "$OPENED" ] || { echo "FAIL: second cycle reported new findings"; cat /tmp/estate-watchy2.json; exit 1; }
echo "  PASS  second cycle opened nothing new, so only the first would notify"

echo "== a report clears the finding =="
curl -fsS -X POST "${BASE}/api/runs" -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:overdue","ok":true,"expected":3,"actual":3,"summary":"back from the dead"}' >/dev/null
curl -fsS -X POST "${BASE}/api/watchy/run" -H "Authorization: Bearer ${TOKEN}" >/dev/null
STILL=$(curl -fsS "${BASE}/api/registry/findings" -H "Authorization: Bearer ${TOKEN}")
if echo "$STILL" | grep -q '"registry_key":"test:overdue","kind":"overdue"'; then
  echo "  FAIL  overdue finding survived a successful report"; exit 1
fi
echo "  PASS  overdue cleared once it reported"

echo "== coverage pair is mandatory =="
CODE=$(curl -s -o /tmp/estate-nocov.json -w '%{http_code}' -X POST "${BASE}/api/runs" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:healthy","ok":true,"summary":"no numbers"}')
[ "$CODE" = "400" ] || { echo "FAIL: a run with no coverage returned $CODE, expected 400"; exit 1; }
echo "  PASS  a run that cannot say what it expected is refused"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/runs" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:healthy","ok":true,"no_unit":true,"summary":"genuinely no unit"}')
[ "$CODE" = "200" ] || { echo "FAIL: no_unit escape hatch returned $CODE, expected 200"; exit 1; }
echo "  PASS  no_unit:true is accepted, so omission is always a decision"

echo "== an active row with no expectation is refused =="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/registry" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"key":"test:blind","entity":"test","role":"blind","source":"routine","status":"active"}')
[ "$CODE" = "400" ] || { echo "FAIL: registering an unwatchable active row returned $CODE, expected 400"; exit 1; }
echo "  PASS  an active row with no cadence is refused"

echo "== per-agent identity =="
# Two agents, each with its own token. Only the hash is ever stored, so the estate never
# holds a value that could impersonate its own agents.
AGENT_A="agent-a-token-for-local-testing-000000000000"
AGENT_B="agent-b-token-for-local-testing-000000000000"
HASH_A=$(printf '%s' "$AGENT_A" | shasum -a 256 | cut -d' ' -f1)
HASH_B=$(printf '%s' "$AGENT_B" | shasum -a 256 | cut -d' ' -f1)

d1 "UPDATE registry SET token_sha256='${HASH_A}', token_set_at=datetime('now') WHERE key='test:healthy';"
d1 "UPDATE registry SET token_sha256='${HASH_B}', token_set_at=datetime('now') WHERE key='test:ontime';"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/runs" \
  -H "Authorization: Bearer ${AGENT_A}" -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:healthy","ok":true,"expected":2,"actual":2}')
[ "$CODE" = "200" ] || { echo "FAIL: agent reporting its own key returned $CODE"; exit 1; }
echo "  PASS  an agent may report its own key"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/runs" \
  -H "Authorization: Bearer ${AGENT_A}" -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:ontime","ok":true,"expected":2,"actual":2}')
[ "$CODE" = "403" ] || { echo "FAIL: agent reporting ANOTHER key returned $CODE, expected 403"; exit 1; }
echo "  PASS  an agent cannot report as another agent"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/registry" \
  -H "Authorization: Bearer ${AGENT_A}" -H 'Content-Type: application/json' \
  -d '{"key":"test:sneaky","entity":"test","role":"sneaky","source":"routine","status":"planned"}')
[ "$CODE" = "403" ] || { echo "FAIL: agent editing the registry returned $CODE, expected 403"; exit 1; }
echo "  PASS  an agent cannot register anything, including itself"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/watchy/run" \
  -H "Authorization: Bearer ${AGENT_A}")
[ "$CODE" = "403" ] || { echo "FAIL: agent running the watcher returned $CODE, expected 403"; exit 1; }
echo "  PASS  an agent cannot drive the watcher"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/state" -H "Authorization: Bearer wrong-token-entirely-0000000000000000")
[ "$CODE" = "401" ] || { echo "FAIL: unknown token returned $CODE, expected 401"; exit 1; }
echo "  PASS  an unknown token is rejected"

for ST in paused retired planned; do
  d1 "UPDATE registry SET status='${ST}' WHERE key='test:ontime';"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/state" -H "Authorization: Bearer ${AGENT_B}")
  [ "$CODE" = "401" ] || { echo "FAIL: '${ST}' agent's token returned $CODE, expected 401"; exit 1; }
  echo "  PASS  status '${ST}' revokes the token, with the same 401 as an unknown one"
done
d1 "UPDATE registry SET status='active' WHERE key='test:ontime';"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/state" -H "Authorization: Bearer short")
[ "$CODE" = "401" ] || { echo "FAIL: a short token returned $CODE, expected 401"; exit 1; }
echo "  PASS  a token under 32 chars is refused before it costs a database read"

echo "== the watcher cannot be blinded by a forged timestamp =="
# One report with a year-9999 timestamp would win MAX(started_at) forever, so every real
# failure afterwards would sort beneath a row that says ok.
curl -fsS -X POST "${BASE}/api/runs" -H "Authorization: Bearer ${AGENT_A}" \
  -H 'Content-Type: application/json' \
  -d '{"registry_key":"test:healthy","ok":true,"expected":1,"actual":1,"started_at":"9999-01-01T00:00:00Z"}' >/dev/null
STORED=$(npx wrangler d1 execute estate-db --local --json \
  --command "SELECT MAX(started_at) AS m FROM agent_runs WHERE registry_key='test:healthy';" 2>/dev/null \
  | python3 -c "import json,sys;raw=sys.stdin.read();print(json.loads(raw[raw.index('['):])[0]['results'][0]['m'])")
case "$STORED" in
  9999*) echo "  FAIL  a forged future timestamp was stored: $STORED"; exit 1 ;;
  *) echo "  PASS  a forged future timestamp was clamped to server time ($STORED)" ;;
esac

echo "== an agent cannot read the estate =="
LIST=$(curl -fsS "${BASE}/api/drafts?status=needs_review" -H "Authorization: Bearer ${AGENT_B}")
echo "$LIST" | grep -q '"drafts":\[\]' || { echo "FAIL: agent B can read another agent's drafts"; echo "$LIST"; exit 1; }
echo "  PASS  an agent's draft list shows only its own"

CODE=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/api/registry" -H "Authorization: Bearer ${AGENT_A}")
[ "$CODE" = "403" ] || { echo "FAIL: agent listing the registry returned $CODE, expected 403"; exit 1; }
echo "  PASS  an agent cannot enumerate the registry"

RUNS=$(curl -fsS "${BASE}/api/runs?unhealthy=false" -H "Authorization: Bearer ${AGENT_B}")
echo "$RUNS" | grep -q 'test:healthy' && { echo "FAIL: agent B can read agent A's runs"; exit 1; }
echo "  PASS  an agent's run history shows only its own"

echo "== drafts and the rejection loop =="
DRAFT=$(curl -fsS -X POST "${BASE}/api/drafts" -H "Authorization: Bearer ${AGENT_A}" \
  -H 'Content-Type: application/json' \
  -d '{"entity":"test","kind":"x_post","title":"a draft","body":"some body text"}')
echo "$DRAFT" | grep -q '"status":"needs_review"' || { echo "FAIL: draft did not land at needs_review"; echo "$DRAFT"; exit 1; }
DRAFT_ID=$(echo "$DRAFT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
echo "  PASS  an agent's draft lands at needs_review, id ${DRAFT_ID}"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "${BASE}/api/drafts/${DRAFT_ID}" \
  -H "Authorization: Bearer ${AGENT_A}" -H 'Content-Type: application/json' \
  -d '{"status":"approved"}')
[ "$CODE" = "403" ] || { echo "FAIL: agent approving its own draft returned $CODE, expected 403"; exit 1; }
echo "  PASS  an agent cannot approve its own draft"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "${BASE}/api/drafts/${DRAFT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"status":"rejected"}')
[ "$CODE" = "400" ] || { echo "FAIL: rejection with no reason returned $CODE, expected 400"; exit 1; }
echo "  PASS  a rejection with no reason is refused"

curl -fsS -X PATCH "${BASE}/api/drafts/${DRAFT_ID}" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' \
  -d '{"status":"rejected","rejection_reason":"wrong_voice","rejection_note":"reads like a consultant"}' >/dev/null
echo "  PASS  a rejection with a reason is accepted"

REJ=$(curl -fsS "${BASE}/api/drafts/rejections" -H "Authorization: Bearer ${AGENT_A}")
echo "$REJ" | grep -q '"rejection_reason":"wrong_voice"' || { echo "FAIL: agent cannot read its own rejection"; echo "$REJ"; exit 1; }
echo "$REJ" | grep -q '"n":1' || { echo "FAIL: rejection counts missing"; echo "$REJ"; exit 1; }
echo "  PASS  the agent reads its own rejection, with counts"

REJ_B=$(curl -fsS "${BASE}/api/drafts/rejections" -H "Authorization: Bearer ${AGENT_B}")
echo "$REJ_B" | grep -q '"rejections":\[\]' || { echo "FAIL: agent B can see agent A's rejections"; echo "$REJ_B"; exit 1; }
echo "  PASS  an agent sees only its own rejections"

echo
echo "ALL ACCEPTANCE CHECKS PASSED"
