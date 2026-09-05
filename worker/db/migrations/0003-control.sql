-- 0003 - estate_control. Runtime-read configuration, and the kill switch.
--
-- Lifted from RecordStops (migrations/042-listing-findings.sql, factory_control).
-- ascend-systems has no equivalent, which is why its cron jobs cannot be paused
-- without a deploy. Every agent reads this table at the top of its run.
--
-- Values are TEXT even when they are numbers or booleans, so one table holds
-- everything and nothing needs a type column. `note` is load-bearing: the agent
-- reading a limit at runtime should be able to read why it exists.
--
-- Everything that can cause an action ships OFF. Turning the fleet on is a deliberate
-- act by a human, recorded with a date, not a default that nobody chose.

CREATE TABLE IF NOT EXISTS estate_control (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  note       TEXT
);

INSERT OR IGNORE INTO estate_control (key, value, note) VALUES
  ('fleet_enabled', '0',
   'Master switch. Every agent reads this first and exits if it is 0, logging that it stood down. Ships off: the fleet does not run until someone deliberately turns it on.'),

  ('watchy_enabled', '1',
   'The watcher is the exception that ships ON. A watcher that has to be remembered is not a watcher. It only reads and writes findings, so it can never take an action worth gating.'),

  ('watchy_grace_multiplier', '1.5',
   'How far past expected_every_minutes a thing may drift before it is called overdue. 1.5 absorbs normal jitter (the scheduler adds up to ~10 minutes of its own) without hiding a real stall. A daily job is late at 36 hours, not 25.'),

  ('notify_enabled', '0',
   'Whether the watcher may send anything outward. Ships off so findings accumulate visibly for a few days before anything starts pushing. Turn on once the noise level is known.'),

  ('runaway_pct', '25',
   'If one run would change more than this percent of a collection, stop and ask a human. From RecordStops: this is an anomaly detector, not a throttle. Normal runs are far under it, and the first full pass of anything WILL trip it, which is correct.'),

  ('min_age_hours', '24',
   'How long a proposed change must sit before any agent may apply it unattended. This is the veto window and it is load-bearing. From RecordStops, where the site reads D1 per request so a write is public the instant it commits.'),

  ('draft_only', '1',
   'While 1, no agent may send, post, publish or spend, regardless of its own verb tiers. A second belt on top of the per-role access tables, for the period while the fleet is new.');
