-- 0015 — hire Blogy, and retire the routine it replaces.
--
-- The seed row said "One blog post a week from unconsumed ship_events, against
-- voice-guide.md", which was right and described nothing that existed: there
-- was no ship_events table, no guide being served, and no way for a routine to
-- read either. All three exist now.
--
-- What this replaces is Wordy, which drafted from ascend-db.session_log. That
-- table was retired on 7 Sep and the log became the git history, so the
-- material now arrives as commits something judged worth telling rather than as
-- session notes somebody remembered to write. The difference that matters is
-- not the storage: a session note was written to be filed, and a commit body is
-- written to explain a change to whoever reads it next, which is much closer to
-- what a post needs.

UPDATE registry SET
  schedule = 'weekly, Saturday 09:00 ET',
  expected_every_minutes = 10080,
  notes = 'One blog post a week, built only from ship_events Loggy judged publishable, against the jbmangum/blog voice guide served by the estate. The wrong_assumption on each event is the material: a post that could survive having those deleted is the wrong post. Cannot publish, cannot judge its own material, and cannot widen its own query. A week with nothing publishable produces no post and says so, which is a correct outcome rather than a slot to fill. Replaces Wordy, which read ascend-db.session_log until that was retired on 7 Sep 2026.'
  WHERE key = 'jbmangum:blogy';

UPDATE registry SET timezone = 'America/New_York', local_time = '09:00', cron_utc = '0 13 * * 6'
  WHERE key = 'jbmangum:blogy';
