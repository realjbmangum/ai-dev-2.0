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
assert_no_finding "test:healthy"

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

echo
echo "ALL ACCEPTANCE CHECKS PASSED"
