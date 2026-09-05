-- 0002 - agent_runs. One row per execution of anything scheduled, anywhere.
--
-- Lifted from ascend-systems (scripts/2026-08-14-job-runs.sql and
-- worker/src/lib/job-runs.ts). Renamed from job_runs because the desk at
-- app-jbmangum already has a `runs` table meaning something else entirely, and two
-- tables called runs in one estate is how the next confusion starts.
--
-- THE RULE THIS ENFORCES: a run reports COVERAGE, not success.
--
-- The original was written after the SEO cron returned ok=true every Monday for six
-- weeks while covering 3 of 16 sites, because nothing compared what it processed
-- against what it should have processed. `ok` alone is not a health signal. Pass
-- `expected` and `actual` even when they match: a run that cannot say what it
-- expected cannot be checked by anything.
--
-- As of 2026-09-05 exactly one of 26 scheduled things in this estate wrote a row like
-- this. The other 25 could fail indefinitely with nothing anywhere noticing, and two
-- of them were doing precisely that.

CREATE TABLE IF NOT EXISTS agent_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Joins to registry.key. Deliberately not a foreign key: a report from something
  -- unregistered must land rather than be rejected, because "who is this" is a finding
  -- the watcher should surface, not an error that loses the evidence.
  registry_key TEXT NOT NULL,

  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  ok           INTEGER NOT NULL DEFAULT 0,

  expected     INTEGER,   -- items that SHOULD have produced a result
  actual       INTEGER,   -- items that actually did

  summary      TEXT,      -- one human-readable line
  detail       TEXT,      -- JSON, bounded: per-item notes, error strings

  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every read is "the recent runs of X", so index that directly.
CREATE INDEX IF NOT EXISTS idx_agent_runs_key_started
  ON agent_runs(registry_key, started_at DESC);

-- And "what is unhealthy right now" across everything.
CREATE INDEX IF NOT EXISTS idx_agent_runs_started
  ON agent_runs(started_at DESC);

-- ---------------------------------------------------------------------------
-- findings - what the watcher noticed, so a problem has a life cycle rather than
-- being recomputed and re-announced forever.
--
-- Without this the watcher can only ever say "these things are wrong right now",
-- which means either it notifies every 15 minutes about the same dead routine or it
-- notifies once and you miss it. A finding opens, stays open while the condition
-- holds, and closes when it clears. Only the OPENING is worth a notification.
--
-- This is the same lesson as job_runs collapsing unchanged repeats: stripe-sync wrote
-- ~96 identical rows a day for months. A persistent condition should read as one
-- finding with a duration, not ninety-six findings.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS findings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  registry_key TEXT NOT NULL,

  -- 'overdue'      = has not reported inside its expected window
  -- 'never_ran'    = active, registered, and has never reported at all
  -- 'undercovered' = reported ok, but actual < expected
  -- 'failing'      = reported ok = 0
  -- 'unregistered' = something reported under a key with no registry row
  kind         TEXT NOT NULL
               CHECK (kind IN ('overdue','never_ran','undercovered','failing','unregistered')),

  detail       TEXT,
  opened_at    TEXT NOT NULL DEFAULT (datetime('now')),

  -- "still true as of". Bumped every cycle the condition persists, so a finding shows
  -- how long it has been going on without writing a new row.
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at    TEXT,

  -- Set when the watcher has told someone. Separate from opened_at so a notification
  -- failure does not silently mark the finding as delivered.
  notified_at  TEXT
);

-- One open finding per (thing, problem). The partial unique index makes this a database
-- invariant rather than watcher discipline, the same way RecordStops guarantees one live
-- proposal per listing+field.
CREATE UNIQUE INDEX IF NOT EXISTS idx_findings_open_unique
  ON findings(registry_key, kind)
  WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_findings_open ON findings(closed_at, opened_at DESC);
