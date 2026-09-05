# estate

The tier above the individual project, for Lighthouse 27 LLC.

Holds the registry of everything scheduled anywhere, the run log everything reports to,
and the watcher that notices when something stops. Later it will hold role templates,
voice guides and the build-in-public event spine.

Read `CLAUDE.md` first. It carries the five laws and the hard rules.

## The problem it solves

Twenty-six scheduled things across three unrelated execution rails: Claude cloud
routines, local scheduled tasks on the Mac, and Cloudflare Worker crons. Before this
repo, exactly one of the twenty-six wrote a row saying what it had done. The other
twenty-five could fail indefinitely with nothing anywhere noticing, and on 2026-09-05
two of them were doing exactly that.

## How it works

Every scheduled thing reports after each run:

```
POST /api/runs
Authorization: Bearer <ESTATE_TOKEN>

{ "registry_key": "directories:tidy", "ok": true, "expected": 15, "actual": 15,
  "summary": "15 listings enriched" }
```

`expected` and `actual` are both required. A run that cannot say what it expected cannot
be checked by anything, so the API refuses a half report. If the work genuinely has no
countable unit, send `no_unit: true` and say so.

Watchy runs every 15 minutes as a Worker cron and flags five things:

| Finding | Means |
|---|---|
| `never_ran` | Registered, active, and has never reported once |
| `overdue` | Reported before, but not inside its expected window |
| `failing` | Reported `ok: false` |
| `undercovered` | Reported success while covering less than it should |
| `unregistered` | Something reported under a key with no registry row |

A finding opens once and is bumped while the condition holds. Only a new finding
notifies, so a routine that has been dead for three days is one finding with a duration
rather than 288 alerts.

## Routes

| Route | Purpose |
|---|---|
| `GET /health` | Liveness. Unauthenticated, reveals nothing |
| `GET /api/state` | Control switches, counts, `all_clear`. What an agent reads first |
| `GET /api/registry` | What is supposed to exist, and how long since each reported |
| `POST /api/registry` | Register or update one thing |
| `GET /api/registry/findings` | What is wrong right now |
| `POST /api/runs` | The heartbeat |
| `GET /api/runs` | Unhealthy runs by default |
| `POST /api/watchy/run` | Run the watcher on demand |

## Setup

```bash
cd worker
npm install
wrangler d1 create estate-db          # put the id in wrangler.toml
npm run migrate:remote
wrangler secret put ESTATE_TOKEN      # 32 chars minimum, enforced in code
npm run deploy
```

`NOTIFY_URL` is optional and gated on `estate_control.notify_enabled`, which ships off.

## Test

```bash
npm run typecheck
bash ../scripts/acceptance-watchy.sh
```
