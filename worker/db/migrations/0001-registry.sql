-- 0001 - the registry. The one place that says what is supposed to be running.
--
-- WHY THIS EXISTS. On 2026-09-05 an audit of 26 scheduled things found two cloud
-- routines that had never produced a single run, a local task that had never fired,
-- and a hand-maintained roster (docs/agents/ROSTER.md in ascend-systems) that had
-- drifted three times in three weeks while itself containing a rule saying it must
-- never be hand-maintained. That file's own rule 5 asked for exactly this table and
-- it was never built.
--
-- The estate's first law: nothing runs unless it is in the registry.
--
-- HOW LIVENESS IS ACTUALLY DETECTED, and why it is not what you would expect.
-- The obvious design is to enumerate the live Claude routine list and diff it against
-- this table. That cannot work from a Worker: the routine API is OAuth-authenticated
-- as Brian, and a Cloudflare cron has no way to hold that session. So the model is
-- inverted. Every registered thing reports in after each run (POST /runs), and the
-- watcher flags absence rather than confirming presence.
--
-- That inversion is strictly better, for three reasons:
--   1. It covers all three rails identically. Cloud routines, local Mac tasks and
--      Worker crons all just POST. Enumeration would only ever have seen one rail.
--   2. It catches "registered but never ran", which is the exact shape of both live
--      failures found in the audit. An enumeration diff would have shown patriot-tidy
--      as present and healthy, because it WAS present. It just never fired.
--   3. A thing that cannot report is already broken. Requiring the heartbeat makes
--      the report the proof, rather than trusting a config file's word for it.
--
-- Seeding this table from the live routine list is a cockpit job, run by a human with
-- an OAuth session, not the watcher's job. Detecting a routine that exists but was
-- never registered needs that same session, so it is also cockpit work.

CREATE TABLE IF NOT EXISTS registry (
  key                    TEXT PRIMARY KEY,   -- stable slug: 'jbmangum:posty', 'patriot:tidy'
  entity                 TEXT NOT NULL,      -- 'jbmangum' | 'directories' | 'crownandcompass' | 'ascend' | 'estate'
  role                   TEXT NOT NULL,      -- 'posty', 'tidy', 'watchy'
  property               TEXT,               -- 'patriot', 'recordstops'; null for entity-level work

  -- Where it runs. From the Directory Machine vocabulary: 'field' is a cloud routine
  -- reaching the API over HTTPS, 'cockpit' is a session on the Mac.
  room                   TEXT NOT NULL DEFAULT 'field'
                         CHECK (room IN ('field','cockpit','worker','action')),

  -- Which rail it lives on. Recorded so a human can find the thing when it goes quiet,
  -- and so "you have three systems and no single list" stops being true.
  source                 TEXT NOT NULL
                         CHECK (source IN ('routine','local_task','worker_cron','github_action')),

  schedule               TEXT,               -- human-readable, from the roster file
  trigger_id             TEXT,               -- the cloud routine's id, when source='routine'
  worker_name            TEXT,               -- the Worker's name, when source='worker_cron'

  -- The heartbeat contract. This is the column the whole watcher depends on: it is how
  -- long may pass between reports before something is wrong. Null means "no expectation",
  -- which is legitimate for on-demand cockpit work and is never flagged.
  expected_every_minutes INTEGER,

  -- 'planned'  = registered, not yet live. Never flagged as overdue.
  -- 'active'   = live and expected to report.
  -- 'paused'   = deliberately stood down. Never flagged.
  -- 'retired'  = kept for history. Never flagged.
  status                 TEXT NOT NULL DEFAULT 'planned'
                         CHECK (status IN ('planned','active','paused','retired')),

  -- Set the first time this key ever reports, and never moved afterwards. It answers
  -- "has this thing EVER worked", which is a different question from "is it working
  -- now" and is the one that catches a bot that was born broken.
  first_run_at           TEXT,
  last_run_at            TEXT,

  -- Follows the ascend-db.entities precedent: a row nobody has confirmed reads as
  -- unconfirmed, never as fact. Set when a human says "yes, this should exist".
  confirmed_at           TEXT,

  notes                  TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The watcher's only hot query: active things with an expectation, oldest report first.
CREATE INDEX IF NOT EXISTS idx_registry_watch
  ON registry(status, expected_every_minutes, last_run_at);

CREATE INDEX IF NOT EXISTS idx_registry_entity ON registry(entity, role);
