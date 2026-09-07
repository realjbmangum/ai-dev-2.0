-- 0008 - served specs. The fifth law, made mechanical.
--
-- "Instructions are served, versioned and drift-checked, never embedded."
--
-- WHY THIS EXISTS NOW. Tidy is the first field role, and writing its spec into its
-- routine prompt would have broken that law on the very first agent. A prompt is not
-- version controlled, cannot be diffed, and drifts silently: nobody can tell what it said
-- last Tuesday or roll it back. The estate repo is private, and a cloud routine cannot
-- clone a private repo, so the repo cannot be the runtime source either.
--
-- So the repo stays the source of truth and D1 is the serving copy, exactly as
-- ascend-systems does with agent_docs. Each row carries the git SHA it came from and
-- when it was pushed, and the endpoint returns both, so an agent can SEE that it is
-- reading a stale copy and say so in its run report rather than silently following
-- out-of-date instructions.
--
-- That failure has already cost this estate real rework more than once, which is the only
-- reason this table is worth its own migration.

CREATE TABLE IF NOT EXISTS specs (
  key        TEXT PRIMARY KEY,   -- the role name: 'tidy', 'scouty', 'wordy'
  body       TEXT NOT NULL,      -- instructions/spec.md, verbatim
  access     TEXT,               -- access.md, verbatim: the verb-to-tier table
  source_sha TEXT,               -- git commit the sync ran from
  synced_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------------
-- hires - what a directory or entity decides about one role.
--
-- The role is written once and belongs to nobody. The hire is where cadence, batch size,
-- priorities and local notes live. The same role hired twice on different terms is two
-- hire rows, never two specs, so fixing a template once reaches every hire at its next
-- wake.
--
-- Lifted whole from directory-machine's template-vs-roster split, which is the best idea
-- in that repo.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hires (
  registry_key TEXT PRIMARY KEY,   -- joins registry.key, e.g. 'directories:tidy'
  role         TEXT NOT NULL,      -- joins specs.key
  terms        TEXT NOT NULL,      -- the hire paper, verbatim markdown
  source_sha   TEXT,
  synced_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hires_role ON hires(role);
