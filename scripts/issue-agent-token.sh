#!/usr/bin/env bash
#
# Issue an agent its own bearer token.
#
#   bash scripts/issue-agent-token.sh directories:tidy
#
# The token is generated here, written to a 0600 file under .secrets/, and only its
# SHA-256 is sent to the database. The value never transits the API, never appears in a
# response, and never lands in a transcript. The estate therefore holds nothing that
# could impersonate its own agents, and a dump of the registry is not a set of
# credentials.
#
# You still have to paste the token into the routine's prompt by hand, because routines
# have no secret store. That is the accepted structural exception, written up in
# docs/decisions/per-agent-tokens.md: assume every agent token is already public, and
# design so that a leak is contained to one role rather than prevented.
set -euo pipefail

KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo "usage: bash scripts/issue-agent-token.sh <registry_key>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SAFE="$(printf '%s' "$KEY" | tr ':/' '__')"
OUT="$ROOT/.secrets/agent-$SAFE"

mkdir -p "$ROOT/.secrets" && chmod 700 "$ROOT/.secrets"

if [ -e "$OUT" ]; then
  echo "A token already exists at $OUT" >&2
  echo "Rotating means updating the routine prompt too. Delete the file first if you mean it." >&2
  exit 1
fi

# 64 hex characters, comfortably past the 32-character floor the API enforces.
openssl rand -hex 32 > "$OUT"
chmod 600 "$OUT"

HASH=$(tr -d '\n' < "$OUT" | shasum -a 256 | cut -d' ' -f1)

cd "$ROOT/worker"
npx wrangler d1 execute estate-db --remote --command \
  "UPDATE registry SET token_sha256='${HASH}', token_set_at=datetime('now') WHERE key='${KEY}';" \
  >/dev/null 2>&1

VERIFY=$(npx wrangler d1 execute estate-db --remote --json --command \
  "SELECT key, substr(token_sha256,1,12) AS hash_head, token_set_at FROM registry WHERE key='${KEY}';" 2>/dev/null \
  | python3 -c "
import json,sys
raw=sys.stdin.read(); rows=json.loads(raw[raw.index('['):])[0]['results']
if not rows: print('NO SUCH REGISTRY ROW'); raise SystemExit(1)
r=rows[0]
print(f\"{r['key']}  hash {r['hash_head']}...  set {r['token_set_at']}\")
")

echo "issued: $VERIFY"
echo "token file: $OUT  (gitignored, 0600)"
echo
echo "Paste it into the routine prompt with:"
echo "  cat $OUT"
