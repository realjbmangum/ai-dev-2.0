-- 0006 - the intended local time, so daylight saving becomes a finding rather than a mystery.
--
-- THE PROBLEM. Cron has no concept of a timezone. Every schedule in this estate is
-- configured in UTC, and the intent behind it is local: "Posty runs at quarter past
-- eight, before Brian opens the desk." Those two agree today and stop agreeing on
-- 1 November, when Eastern moves from UTC-4 to UTC-5 and every routine silently starts
-- running an hour later in local terms.
--
-- Nothing about that failure is loud. The routine fires, reports success, and covers
-- exactly what it should. It is simply doing it at the wrong time of day, which for
-- Posty means drafting before the morning's signals have landed, and for the whole
-- fleet means the desk is not ready when Brian opens it.
--
-- THE FIX. Record what was actually meant, alongside what is actually configured, and
-- let the watcher compare them. `local_time` and `timezone` are the intent.
-- `cron_utc` is the fact. When the offset changes, they diverge, and Watchy opens a
-- `schedule_drift` finding naming both values and the correct new cron.
--
-- This is the same shape as every other rule here: the intent is written down once, the
-- machine checks it forever, and nobody has to remember that November exists.

ALTER TABLE registry ADD COLUMN local_time TEXT;   -- 'HH:MM' in `timezone`, the intent
ALTER TABLE registry ADD COLUMN timezone   TEXT;   -- IANA name, e.g. 'America/New_York'
ALTER TABLE registry ADD COLUMN cron_utc   TEXT;   -- the cron expression actually configured

CREATE INDEX IF NOT EXISTS idx_registry_localtime ON registry(timezone, local_time);

-- Fill in the intent for everything that has a wall-clock meaning. Deliberately NOT set
-- for the every-N-minutes jobs: "every 15 minutes" has no local time and never drifts,
-- so giving it one would invent a check that can only produce false findings.

UPDATE registry SET timezone = 'America/New_York', local_time = '08:15', cron_utc = '15 12 * * *'
  WHERE key = 'jbmangum:posty';
UPDATE registry SET timezone = 'America/New_York', local_time = '09:00', cron_utc = '0 13 * * 3'
  WHERE key = 'jbmangum:blogy';
UPDATE registry SET timezone = 'America/New_York', local_time = '09:15', cron_utc = '15 13 * * 1'
  WHERE key = 'jbmangum:reachy';
UPDATE registry SET timezone = 'America/New_York', local_time = '23:00', cron_utc = '0 3 * * *'
  WHERE key = 'estate:loggy';

UPDATE registry SET timezone = 'America/New_York', local_time = '11:00', cron_utc = '0 15 * * 4'
  WHERE key = 'directories:scouty';
UPDATE registry SET timezone = 'America/New_York', local_time = '11:00', cron_utc = '0 15 * * 2'
  WHERE key = 'directories:tidy';
UPDATE registry SET timezone = 'America/New_York', local_time = '11:00', cron_utc = '0 15 1 * *'
  WHERE key = 'directories:checky';

UPDATE registry SET timezone = 'America/New_York', local_time = '09:00', cron_utc = '0 13 * * 6'
  WHERE key = 'crownandcompass:wordy';
UPDATE registry SET timezone = 'America/New_York', local_time = '11:00', cron_utc = '0 15 * * 6'
  WHERE key = 'crownandcompass:designy';
UPDATE registry SET timezone = 'America/New_York', local_time = '09:40', cron_utc = '40 13 * * 1,4'
  WHERE key = 'ascend:salesy';

-- Guidey has no wall-clock intent: it is keyed to the six-week book cycle, which starts
-- whenever a cycle starts. Left null on purpose.
