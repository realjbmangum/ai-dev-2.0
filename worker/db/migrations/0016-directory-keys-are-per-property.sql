-- The patriot:* rename, written down. It existed only in production until now.
--
-- WHAT HAPPENED. On 10 September the hire key scheme changed from <entity>:<role>
-- to <property>:<role>, because one entity could otherwise hold exactly one hire
-- per role and `directories:mailroom` silently meant Patriot. A RecordStops hire
-- beside it would have collided and one would have overwritten the other.
--
-- The four live keys were renamed with a hand-run UPDATE against production,
-- preserving token_sha256 so nothing had to be re-issued, and the two running
-- routines that fetch their specs by name were updated in the same sitting. All
-- of that worked. None of it was written into a migration.
--
-- WHY THAT IS WORSE THAN IT SOUNDS. sync-specs.mjs derives every hire key from
-- its FILE PATH, so entities/patriot/roster/mailroom.md is patriot:mailroom and
-- always will be. The migrations seed directories:mailroom. Those two agree only
-- because a person typed an UPDATE once. Rebuild this database from 0001 onward
-- for a restore, a staging copy or a second account, and the registry comes back
-- holding the old keys while every hire syncs under the new ones. Every directory
-- agent then 404s on its own name with "no hire registered", which is precisely
-- the symptom the registry check in sync-specs.mjs was added to catch, arriving
-- at the worst possible moment.
--
-- A fix that lives only in production is not a fix. It is a coincidence with a
-- good track record.
--
-- Idempotent on purpose: this runs against a live database where the rename has
-- already happened by hand, and against a fresh one where it has not.

-- Patriot's four. UPDATE rather than delete-and-insert, so token_sha256,
-- token_set_at, first_seen_at and last_run_at survive. A renamed agent is the
-- same agent and its history is not a thing to throw away.
UPDATE registry SET key = 'patriot:mailroom', property = 'patriot'
 WHERE key = 'directories:mailroom' AND NOT EXISTS (SELECT 1 FROM registry WHERE key = 'patriot:mailroom');
UPDATE registry SET key = 'patriot:tidy', property = 'patriot'
 WHERE key = 'directories:tidy' AND NOT EXISTS (SELECT 1 FROM registry WHERE key = 'patriot:tidy');
UPDATE registry SET key = 'patriot:scouty', property = 'patriot'
 WHERE key = 'directories:scouty' AND NOT EXISTS (SELECT 1 FROM registry WHERE key = 'patriot:scouty');
UPDATE registry SET key = 'patriot:checky', property = 'patriot'
 WHERE key = 'directories:checky' AND NOT EXISTS (SELECT 1 FROM registry WHERE key = 'patriot:checky');

-- Anything left under the old scheme after those four is a row nothing can serve:
-- no hire file produces a directories:* key any more, so it joins to nothing.
DELETE FROM registry WHERE key LIKE 'directories:%' AND key NOT IN ('directories:email-intake', 'directories:mail-events');

-- The two shared mail Workers keep the entity key deliberately, and this is the
-- one place the scheme's own rule reads oddly, so it is worth stating. The key is
-- <owner>:<role>, where owner is the PROPERTY when a thing serves exactly one and
-- the ENTITY when it serves several. One email-intake Worker files mail for both
-- directories by recipient domain; one mail-events consumer handles both senders.
-- The agents are per property; the plumbing is not, because two copies of the
-- same parser drift apart.
INSERT INTO registry (key, entity, role, property, room, schedule, status, source, worker_name, confirmed_at)
VALUES
  ('directories:email-intake', 'directories', 'email-intake', NULL, 'worker',
   'on each inbound message, no schedule', 'active', 'worker_cron', 'machine-email-intake', datetime('now')),
  ('directories:mail-events', 'directories', 'mail-events', NULL, 'worker',
   'on each delivery event, no schedule', 'active', 'worker_cron', 'machine-mail-events', datetime('now'))
ON CONFLICT(key) DO NOTHING;

-- RecordStops' two, which were only ever created by hand. property is NOT NULL
-- and that is load-bearing rather than tidy: spec.ts binds `hire.property ?? hire.entity`
-- for both the voice lookup and the {directory} substitution, so a NULL here
-- serves this directory Patriot's brand voice and renders its inclusion rule as
-- "find places that belong in directories", which is not a rule at all.
INSERT INTO registry (key, entity, role, property, room, schedule, status, source, expected_every_minutes, confirmed_at)
VALUES
  ('recordstops:mailroom', 'directories', 'mailroom', 'recordstops', 'field',
   'daily, 12:25 ET (16:25 UTC)', 'active', 'routine', 1440, datetime('now')),
  ('recordstops:tidy', 'directories', 'tidy', 'recordstops', 'field',
   'weekly, Wednesday 11:00 ET (15:00 UTC)', 'active', 'routine', 10080, datetime('now'))
ON CONFLICT(key) DO NOTHING;
