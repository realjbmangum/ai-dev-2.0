-- 0013 — hire Loggy, and correct what the registry says it does.
--
-- The seed row described Loggy as writing the session_log row from the day's
-- commits. Two things changed under it.
--
-- session_log was retired on 7 Sep, so there is no row to write. And the
-- sweeping half turned out to be an Action's job rather than a routine's: it
-- fires when a commit lands instead of up to a day later, holds no credential
-- of its own, and cannot miss a push that happened while it was not looking.
--
-- What is left is the judgement, which is the part neither a webhook nor a cron
-- can do: reading a commit body and deciding whether there is a story in it.
-- Registered planned until it has been watched once.

UPDATE registry SET
  schedule = 'daily, 09:10 ET',
  expected_every_minutes = 1440,
  notes = 'Reads unjudged ship_events once a day and decides which commits are worth telling someone about, and what the wrong assumption was in each. Publishes nothing: a judgement moves an event into a queue something else drafts from, and that draft still needs a human. Cannot capture events, only judge them, because the GitHub Action is the only thing that can be certain a commit existed and an agent able to write events could report work that never happened. Most commits are held, which is the expected shape of a week rather than a bar set wrong.'
  WHERE key = 'estate:loggy';

UPDATE registry SET timezone = 'America/New_York', local_time = '09:10', cron_utc = '10 13 * * *'
  WHERE key = 'estate:loggy';
