-- 0011 — let a human quiet a finding, with an expiry.
--
-- Not re-runnable. SQLite has no ADD COLUMN IF NOT EXISTS.
--
-- Hard rule 3 says a finding opens once and is bumped rather than re-opened, so
-- a condition true for three days is one finding with a duration instead of 288
-- alerts. That solved repetition. It did not solve a finding that is correct,
-- understood, and not going away.
--
-- There is one open right now that proves the point. Watchy opened
-- `undercovered` against Tidy for reporting 13 of 15, which was the right call
-- at the time. Since then the coverage semantics were corrected and 13 of 15 is
-- understood to be a good run: the two gaps are business websites that were
-- down, which nothing on this side can fix and which will recur. The finding is
-- accurate and permanent, so the desk's "wrong right now" count would sit at 1
-- forever and stop meaning anything inside a week.
--
-- The wrong fixes, considered and rejected:
--
--   Close it            A lie. The condition is still true, and Watchy would
--                       correctly reopen it on the next cycle anyway.
--   Delete it           Loses the history of a real observation.
--   Raise the threshold Hides every genuine undercoverage to hide one known one.
--
-- So: mute, always with an expiry. An indefinite mute is how an alarm dies
-- quietly and nobody remembers switching it off — the same failure as a status
-- with no date beside it. When the mute lapses the finding is simply visible
-- again, and if the condition really has cleared by then Watchy will have
-- closed it on its own.
--
-- NULL means not muted. A past timestamp means the mute has lapsed, and the
-- row is left rather than cleaned up so "this was muted until Tuesday" stays
-- answerable.

ALTER TABLE findings ADD COLUMN muted_until TEXT;

-- Who quieted it, so a muted alarm is attributable like everything else here.
ALTER TABLE findings ADD COLUMN muted_by TEXT;

-- The watcher's query for open findings does not filter on this, deliberately.
-- Muting changes what the DESK shows a human, not what the estate knows. A
-- muted finding is still open, still bumped, and still counted by anything
-- asking the database directly.
CREATE INDEX IF NOT EXISTS idx_findings_muted ON findings(muted_until)
  WHERE closed_at IS NULL;
