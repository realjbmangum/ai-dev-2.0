-- 0005 - the opening registry.
--
-- Seeded from what was actually observed on 2026-09-05: the live trigger list, the live
-- scheduled-task list, and a sweep of every wrangler.toml in the estate. Not from any
-- document, because the documents were wrong. ascend-systems/docs/agents/ROSTER.md
-- listed two routines as Live that had been deleted, and its Known Constraints section
-- was wrong on two counts.
--
-- STATUS DISCIPLINE, and why almost everything here starts 'planned'.
--
-- 'active' means "this reports, and silence is a fault". A row is only promoted to
-- active once it actually reports through POST /runs. Seeding the nine surviving Worker
-- crons as active would claim a liveness none of them has yet: not one of them writes a
-- run row today, which is the whole problem. They move to active in build step 3, one at
-- a time, as each is retrofitted.
--
-- Watchy is the single exception, and it is active because it reports on itself in the
-- same cycle it checks everything else.
--
-- The nine cloud routines, four local Mac tasks and four grok bots that existed on
-- 2026-09-05 are deliberately absent. They are being deleted, and registering something
-- in order to delete it is churn. Their replacements are here as 'planned'.
--
-- SCOPE. The estate covers four things: JB Mangum (the parent), the directories, Crown
-- and Compass, Ascend Systems, and the work log that runs across all of them.
--
-- scdmv-alerts and txdps-alerts were in the first draft of this seed and have been
-- removed. They are dying projects and were never in scope; they came in because the
-- audit found them broken, which is a different question from whether they belong here.
-- A registry that quietly grows to hold everything that is wrong stops being a statement
-- of what should be running and becomes a second bug tracker.

-- ---------------------------------------------------------------------------
-- Estate staff
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO registry
  (key, entity, role, room, source, schedule, worker_name, expected_every_minutes, status, notes)
VALUES
  ('estate:watchy', 'estate', 'watchy', 'worker', 'worker_cron',
   'every 15 minutes', 'estate-api', 15, 'active',
   'A Worker cron and not a cloud routine, deliberately. The routine platform is what silently dropped patriot-tidy and patriot-scouty, and a watcher living on the rail it watches can be deleted by editing a routine list, which is how Tally and Chiefy vanished.');

INSERT OR IGNORE INTO registry
  (key, entity, role, room, source, schedule, expected_every_minutes, status, notes)
VALUES
  ('estate:voicey', 'estate', 'voicey', 'cockpit', 'local_task',
   'on demand', NULL, 'planned',
   'Drafts a missing voice guide from what has actually shipped on a surface. No cadence: on-demand cockpit work is never flagged as overdue.'),

  ('estate:loggy', 'estate', 'loggy', 'field', 'routine',
   'daily', 1440, 'planned',
   'The work log, made automatic. Writes the session_log row from what actually happened: the day''s commits across the estate, agent_runs, and open findings. Exists because the rule that a session must log itself is mandatory, manual, and mostly not happening. Across the whole filesystem on 2026-09-05, only three repos had EVER produced a session_log row, and a headless routine cannot produce one at all because it has no wrangler. Needs an HTTPS session-log endpoint on ascend-api first.');

-- ---------------------------------------------------------------------------
-- Worker crons that survive the agent-layer deletion.
-- Real work, none of it currently reporting. Retrofit order is build step 3.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO registry
  (key, entity, role, property, room, source, schedule, worker_name, expected_every_minutes, status, notes)
VALUES
  ('ascend:api-cron', 'ascend', 'api-cron', NULL, 'worker', 'worker_cron',
   '*/15 * * * *', 'ascend-api', 15, 'planned',
   'Drip processor, Stripe sync, weekly GSC ingest, daily analytics. Already writes job_runs in its own database: the only thing in the estate that does. Retrofit means also reporting here.'),

  ('crownandcompass:reminders', 'crownandcompass', 'reminders', NULL, 'worker', 'worker_cron',
   '*/15 * * * *', 'cc-reminders', 15, 'planned',
   'Day-before meeting reminders to real men. On 2026-09-01 every send failed on a 401 in the one tick that mattered and the occurrence was silently spent. The alert for that was never built. This is the highest-value retrofit in the list.'),

  ('ascend:clt-ev', 'ascend', 'sync', 'clt-ev', 'worker', 'worker_cron',
   '*/30, 0 */2, 0 6', 'clt-ev-worker', 30, 'planned',
   'City of Charlotte engagement. Live and unattended since 2026-03-23. Its own progress.txt documents an intermittent ChargePoint 403, so a job known to fail sometimes has been running five months with nothing watching.'),

  ('ascend:masonry-analyzer', 'ascend', 'analyzer', 'masonry', 'worker', 'worker_cron',
   '*/5 * * * *', 'app-masonry-analyzer', 5, 'planned',
   'Contract analysis queue. Deploys by wrangler CLI rather than git.'),

  ('jbmangum:substack-deploy', 'jbmangum', 'deploy-hook', NULL, 'worker', 'worker_cron',
   '0 * * * *', 'jbmangum-deploy', 60, 'planned',
   'Polls the Substack feed hourly and fires a Pages deploy hook on a new post. Its reason to exist is expiring: the Substack migration is complete on disk and uncommitted, and jbmangum.com/rss.xml still 404s.'),

  ('personal:mangum-home', 'personal', 'api-cron', NULL, 'worker', 'worker_cron',
   '*/15, 0 5, 0 6 mon, 20 *, */5', 'mangum-home-api', 15, 'planned',
   'Family hub. Five cron expressions on one Worker, none of them watched.'),

  ('personal:shelf', 'personal', 'sync', NULL, 'worker', 'worker_cron',
   '0 */6 * * *', 'shelf', 360, 'planned',
   'Reading shelf sync.');

-- ---------------------------------------------------------------------------
-- The planned roster. None of these is built. None is built until its voice guide
-- exists, per the estate's rule that a drafting role without a guide is a role with no
-- safety system.
-- ---------------------------------------------------------------------------
INSERT OR IGNORE INTO registry
  (key, entity, role, property, room, source, schedule, expected_every_minutes, status, notes)
VALUES
  ('jbmangum:posty', 'jbmangum', 'posty', NULL, 'field', 'routine',
   'daily', 1440, 'planned',
   'Merges the old Daily Desk and Post Kit into one run, removing a bot-to-bot handoff and the class of failures where one bot read the other stale file. The only role that runs daily: the 5-to-10-minute budget allows exactly one.'),

  ('jbmangum:blogy', 'jbmangum', 'blogy', NULL, 'field', 'routine',
   'weekly', 10080, 'planned',
   'One blog post a week from unconsumed ship_events, against voice-guide.md.'),

  ('jbmangum:reachy', 'jbmangum', 'reachy', NULL, 'field', 'routine',
   'weekly', 10080, 'planned',
   'X metrics. Inherits the rule that made the old Reach worth keeping: an unknown is never rendered as zero. Zero is a claim about the account, unknown is a claim about the bot eyesight, and those are different facts.'),

  ('directories:scouty', 'directories', 'scouty', 'patriot', 'field', 'routine',
   'weekly, Thursday', 10080, 'planned',
   'Proposes candidates with checkable evidence. Never publishes.'),

  ('directories:tidy', 'directories', 'tidy', 'patriot', 'field', 'routine',
   'weekly, Tuesday', 10080, 'planned',
   'Enriches existing listings. The previous incarnation was enabled from 2026-09-01 and never produced a single run session, which is the exact failure this registry exists to make impossible to miss.'),

  ('directories:checky', 'directories', 'checky', 'patriot', 'field', 'routine',
   'monthly', 43200, 'planned',
   'Full sweep testing reality against the database: is the shop still there, is the site still up, does the page still say what the row says. Batch-first so a dying run resumes from least-recently-checked rather than restarting at the top. Writes a row for every check INCLUDING the clean ones, which is the whole point: RecordStops learned that a table recording only problems makes the selection query pick the same listings forever.'),

  ('crownandcompass:wordy', 'crownandcompass', 'wordy', NULL, 'field', 'routine',
   'weekly', 10080, 'planned',
   'Ministry blog, drafting against brand/voice.md. Blocked until brand-standards.md is corrected: it currently describes EB Garamond and DM Sans while the live site runs Zilla Slab, Spectral and IBM Plex Mono.'),

  ('crownandcompass:designy', 'crownandcompass', 'designy', NULL, 'field', 'routine',
   'weekly, Saturday', 10080, 'planned',
   'Apparel concepts and image prompts, never finished art. Reads brand/design-grammar.md.'),

  ('crownandcompass:guidey', 'crownandcompass', 'guidey', NULL, 'field', 'routine',
   'per six-week book cycle', 60480, 'planned',
   'Six-week field guides. The cycle length comes from watch-books.ts, which opens each cycle with ends_on = date(now, +42 days).'),

  ('ascend:salesy', 'ascend', 'salesy', NULL, 'field', 'routine',
   'Mon and Thu', 5040, 'planned',
   'Lead follow-up drafts. Pointer-only into the desk: the desk holds no client name, address or dollar amount, so a row here reads "3 leads quiet 9+ days, open the CRM" and nothing crosses the boundary.');
