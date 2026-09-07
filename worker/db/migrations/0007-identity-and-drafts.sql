-- 0007 - per-agent identity, and the draft queue with its feedback loop.
--
-- Two decisions land here, taken 2026-09-06. See docs/decisions/.

-- ---------------------------------------------------------------------------
-- 1. PER-AGENT TOKENS
--
-- One shared bearer token has two problems, and the second is the worse one.
--
-- The obvious problem: it leaks. The token is pasted into every routine prompt
-- because routines have no secret store, and it is then echoed verbatim into every run
-- transcript. It has already been read out of a live run log as a literal
-- `curl -H "Authorization: Bearer ..."`. Anyone who can list routines can read it.
--
-- The problem nobody names: with one token, ANY agent can report a run as ANY other
-- agent. Attribution in agent_runs is therefore a convention, not a fact, and the
-- watcher's entire picture rests on it. A per-agent token makes the report provably
-- from that agent, because the token IS the identity.
--
-- Per-agent tokens do not stop the leak. Nothing available stops the leak, since the
-- token has to sit in a prompt. They contain it to one role and make forgery impossible,
-- which is the honest goal.
--
-- Only the HASH is stored. The estate never holds a value that would let it impersonate
-- its own agents, and a dump of this table is not a set of credentials.
-- ---------------------------------------------------------------------------

ALTER TABLE registry ADD COLUMN token_sha256 TEXT;  -- lowercase hex of SHA-256(token)
ALTER TABLE registry ADD COLUMN token_set_at TEXT;  -- when it was last rotated

-- Lookup is by hash on every authenticated request, so it needs to be fast and unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_registry_token
  ON registry(token_sha256) WHERE token_sha256 IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. DRAFTS
--
-- Everything any agent proposes, from any entity, in one table.
--
-- WHY NOT IN THE DESK'S OWN DATABASE. The desk is the surface Brian uses; it is not the
-- store. jbmangum-desk belongs to the JB Mangum entity, and a Crown and Compass draft
-- sitting inside it is the same category error as putting the estate-wide work log in
-- Ascend's CRM. The desk binds this database and renders from it.
--
-- WHAT NEVER APPEARS HERE. No client name, no email address, no dollar amount. Ascend's
-- work reaches the desk as a pointer ("3 leads quiet 9+ days, open the CRM"), never as
-- a payload. That rule is inherited from the desk and it is not negotiable.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS drafts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  registry_key TEXT NOT NULL,          -- who wrote it; joins registry.key
  entity       TEXT NOT NULL,          -- for filtering the desk by entity
  kind         TEXT NOT NULL,          -- 'x_post' | 'x_reply' | 'blog_post' | 'apparel_concept' | ...
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  source_note  TEXT,                   -- what this traces back to; a ship_event id, a signal

  -- needs_review is the only status an agent may write. Everything else is Brian's.
  status       TEXT NOT NULL DEFAULT 'needs_review'
               CHECK (status IN ('needs_review','approved','rejected','published')),

  /*
   * The feedback loop, and why the vocabulary is closed.
   *
   * Between 8 and 14 August 2026, 39 of 42 drafts across the fleet were rejected and
   * nothing changed between runs, because a rejection recorded only status='rejected'
   * and the reason stayed in Brian's head. Every routine stayed exactly as good as it
   * started.
   *
   * Free text fixed that and introduced a new problem: typing a sentence per rejection
   * does not survive a five-minute morning. So the reason is one tap from a fixed list.
   * Closed vocabulary also means an agent can act on it mechanically rather than having
   * to interpret prose, and it can be counted: "six of your last ten were wrong_voice"
   * is a far sharper instruction than six paragraphs.
   *
   * note stays available for the times a sentence is worth typing.
   */
  rejection_reason TEXT
               CHECK (rejection_reason IS NULL OR rejection_reason IN
                      ('wrong_voice','already_said','not_true','too_thin','not_now','other')),
  rejection_note   TEXT,

  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at  TEXT,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drafts_entity ON drafts(entity, created_at DESC);
-- The read every drafting agent makes before it writes.
CREATE INDEX IF NOT EXISTS idx_drafts_rejected ON drafts(registry_key, status, reviewed_at DESC);

-- A rejection with no reason carries no signal, so it is refused at the point of
-- rejection rather than discovered as a gap later. Enforced here as well as in code,
-- because the desk is not the only thing that will ever write this table.
CREATE TRIGGER IF NOT EXISTS trg_drafts_rejection_needs_reason
BEFORE UPDATE OF status ON drafts
WHEN NEW.status = 'rejected' AND NEW.rejection_reason IS NULL
BEGIN
  SELECT RAISE(ABORT, 'a rejection needs a reason, or the agent learns nothing from it');
END;
