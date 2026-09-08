-- 0014 — voice guides, served the same way specs are.
--
-- Hard rule 9: no drafting role ships before its voice guide exists. Since
-- agents draft freely here, the guide is the safety system, and a missing one
-- is a hard stop rather than a warning.
--
-- The guides themselves live in the entity's own repository, which is right:
-- the people editing a brand's voice are editing that brand, and a guide kept
-- in the estate would drift from the site it governs. But a scheduled routine
-- has no checkout and no credential for a private repo, so it cannot read one.
-- Same problem the specs had, same answer: the repo is the source of truth, D1
-- is the serving copy, and every row carries the SHA it came from.
--
-- WHY source_sha IS THE GUIDE'S OWN REPO, NOT THIS ONE. A spec's sha is this
-- repository's HEAD because the spec lives here. A guide's is the sha of the
-- repository the guide came from, because that is the thing that would have
-- changed. Stamping the estate's sha would mean an edit to the guide showed no
-- drift at all until something unrelated was committed here, which is worse
-- than no stamp: it would read as verified.

CREATE TABLE IF NOT EXISTS guides (
  entity      TEXT NOT NULL,          -- 'jbmangum' | 'crownandcompass' | 'directories'
  /*
   * What the guide governs, not what it is.
   *
   * One entity legitimately has several: jbmangum writes blog posts in one
   * register and X posts in another, and its own X guide says so ("Those remain
   * the source for blog writing. This is the X layer"). Keying on the surface
   * means a role asks for the voice of the thing it is about to write, rather
   * than for "the jbmangum voice" and getting whichever one was synced last.
   */
  surface     TEXT NOT NULL,          -- 'blog' | 'x' | 'listing' | 'email'
  body        TEXT NOT NULL,

  source_repo TEXT NOT NULL,          -- 'realjbmangum/site-jbmangum'
  source_path TEXT NOT NULL,          -- 'voice-guide.md'
  source_sha  TEXT,                   -- that repo's HEAD when it was read
  synced_at   TEXT NOT NULL DEFAULT (datetime('now')),

  PRIMARY KEY (entity, surface)
);

-- A drafting role asks for one guide by name, so the primary key is the only
-- index it needs. Listing them is a human's occasional question, not an agent's.
