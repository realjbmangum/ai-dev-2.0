-- 0012 — ship_events: the build-in-public spine.
--
-- The log is the git history. That was settled on 29 August when ship_logs was
-- retired, and again on 7 September when session_log followed it: both were
-- tables holding a story the commits were already telling, and two records
-- means keeping two records in agreement, which never happened.
--
-- What was missing is the other half. A commit is written and then nothing
-- reads it. The desk has a Ships page and a `ship_notes` table behind it that
-- has never had a single row. The weekly blog is drafted by a routine that
-- reads session_log, which is the table we just stopped writing. So the record
-- exists and nothing surfaces it, and the thing that consumes it is pointed at
-- a source that is going dry.
--
-- This table is where a commit becomes something publishable, in three stages,
-- each done by whoever is actually able to do it:
--
--   1. A GitHub Action posts the commit the moment it lands on main. No agent
--      holds a credential for anyone's repository, no polling, and a private
--      repo works the same as a public one because the Action already has the
--      access. `publishable` is NULL: nobody has judged it yet.
--
--   2. Loggy reads the unjudged rows once a day and does the editorial pass a
--      webhook cannot: is this worth telling, what was the wrong assumption,
--      which of the four kinds is it. Sets publishable to 1 or 0.
--
--   3. Blogy reads publishable = 1 AND consumed_at IS NULL once a week, writes
--      from them, and stamps consumed_at so the same week is not written twice.
--
-- The split matters. Stage 1 must never be skipped or delayed, because a commit
-- nobody captured is gone. Stage 2 is judgement and belongs to something that
-- can read prose. Collapsing them would mean either a webhook deciding what is
-- interesting, or a daily routine that silently loses anything pushed while it
-- was not looking.

CREATE TABLE IF NOT EXISTS ship_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Who it belongs to, in the estate's own vocabulary. Derived from the repo by
  -- the Action, so a new repo is a line in its config rather than a schema change.
  entity        TEXT NOT NULL,          -- 'directories' | 'jbmangum' | 'estate' | ...
  property      TEXT,                   -- 'patriot', 'recordstops'; null for entity-level work

  happened_at   TEXT NOT NULL,          -- the COMMIT's timestamp, not the insert's

  /*
   * What kind of thing happened.
   *
   * NULL until Loggy decides. A commit arrives as an undifferentiated fact and
   * the four kinds are a judgement about it, so defaulting to 'shipped' would
   * quietly turn every bug fix into an announcement.
   */
  kind          TEXT
                CHECK (kind IS NULL OR kind IN ('shipped','broke','learned','milestone')),

  headline      TEXT NOT NULL,          -- the commit subject, verbatim
  body          TEXT,                   -- the commit body, verbatim

  /*
   * The wrong assumption, or the thing that broke.
   *
   * A first-class column rather than a paragraph inside `body`, because naming
   * it forces whoever fills it to actually have one. A post that says what
   * somebody believed and why it was wrong is worth reading; a post that says
   * what shipped is a changelog.
   *
   * Filled by Loggy from the commit body, which is where the standing rule now
   * says that reasoning belongs.
   */
  wrong_assumption TEXT,

  source_ref    TEXT,                   -- the commit sha
  source_url    TEXT,                   -- the GitHub link, so a claim can be checked
  repo          TEXT NOT NULL,          -- 'realjbmangum/directory-machine'

  /*
   * Three-valued on purpose. NULL means nobody has judged it, 1 means it may be
   * written about, 0 means it may not.
   *
   * NULL is not 0. An unjudged commit and a commit deliberately held back are
   * different facts, and collapsing them means a day Loggy failed to run looks
   * exactly like a day with nothing worth saying.
   */
  publishable   INTEGER
                CHECK (publishable IS NULL OR publishable IN (0,1)),
  judged_at     TEXT,
  judged_by     TEXT,

  -- Stamped by whatever wrote about it, so a week is never written up twice.
  consumed_at   TEXT,
  consumed_by   TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

/*
 * One row per commit, forever.
 *
 * A push can be retried, an Action can be re-run by hand, and a force-push
 * replays commits that were already sent. Without this the blog reads the same
 * work three times and writes it up as three separate things.
 *
 * Keyed on repo AND sha rather than sha alone: a sha is only unique within a
 * repository, and a commit genuinely cherry-picked into a second repo is a
 * second event.
 */
CREATE UNIQUE INDEX IF NOT EXISTS idx_ship_events_commit
  ON ship_events(repo, source_ref) WHERE source_ref IS NOT NULL;

-- Loggy's query: what has nobody judged yet.
CREATE INDEX IF NOT EXISTS idx_ship_events_unjudged
  ON ship_events(happened_at) WHERE publishable IS NULL;

-- Blogy's query: what may be written about and has not been.
CREATE INDEX IF NOT EXISTS idx_ship_events_unconsumed
  ON ship_events(happened_at) WHERE publishable = 1 AND consumed_at IS NULL;

/*
 * A NOTE ON WHAT MAY BE IN HERE.
 *
 * Commit messages are public raw material by standing rule: no client names, no
 * email addresses, no dollar amounts, nothing from a personal project. That rule
 * exists because repos get opened, and it is the same reason this table is safe
 * to hold them. It is NOT a licence to relax it. If something must not go on X,
 * it must not go in a commit body, and therefore it will never arrive here.
 *
 * Hard rule 4 still applies to this database and is unchanged by any of the
 * above: no client name, no email address, no dollar amount, ever.
 */
