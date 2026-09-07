-- 0009 - say plainly what the switches mean, and add the one that was missing.
--
-- `draft_only` was written as "no agent may send, post, publish or spend". On a site
-- that renders from its database on every request, filling a blank field IS publishing,
-- so read literally the switch blocked everything, and read loosely it blocked nothing.
-- A switch nobody can interpret is worse than no switch, because it gets ignored.
--
-- The line that actually matters is REVERSIBILITY, not visibility. An email to a real
-- person cannot be unsent. A post cannot be unposted. Money cannot be unspent. A blank
-- field filled from a checkable source, with the old value logged, is undone in one
-- click and reached nobody.
--
-- So: draft_only covers what cannot be taken back. Reversible data edits are governed by
-- the per-role access tables and by dry_run below, not by this.

UPDATE estate_control SET
  value = '1',
  note = 'Blocks anything that CANNOT BE TAKEN BACK: sending mail to a real person, posting publicly, spending money. Reversible edits are not covered, because they are undone in one click with the old value logged and they reach nobody. This is the switch to flip when you are unsure, without editing any agent.',
  updated_at = datetime('now')
WHERE key = 'draft_only';

-- ---------------------------------------------------------------------------
-- dry_run: look, decide, report, change nothing.
--
-- The gap between "the fleet is off" and "the fleet writes to a live directory" was a
-- cliff. Turning it on meant the first real run of a brand new agent wrote to production
-- with nobody watching, on the strength of a spec that had never been exercised against
-- real websites.
--
-- Dry run is the step in between. The agent does the whole job, reads the same sites,
-- reaches the same conclusions, and reports exactly what it WOULD have changed, with its
-- evidence. Then a human reads that and decides whether it reads the world correctly.
--
-- It ships ON. Turning it off is a deliberate act taken after seeing a dry run, per
-- agent, not a default anyone inherits.
-- ---------------------------------------------------------------------------

INSERT OR REPLACE INTO estate_control (key, value, note, updated_at) VALUES
  ('dry_run', '1',
   'While 1, an agent does the entire job and writes NOTHING. It reports what it would have changed, with the evidence for each, so a human can judge whether it reads the world correctly before it touches anything. Ships on. Turn it off once you have read a dry run you believe.',
   datetime('now'));
