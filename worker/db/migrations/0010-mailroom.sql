-- 0010 — hire Mailroom.

-- ---------------------------------------------------------------------------
-- 1. An address that should never have been in this database
--
-- Hard rule 4: this database holds no client data — no client name, no email
-- address, no dollar amount, ever. On 7 September a Tidy run put a business's
-- contact address into its `detail` JSON, because its spec asks for
-- `value_proposed` on every field it fills and the field it was filling was
-- `email`.
--
-- The scrub itself was applied by hand the same day and is deliberately NOT
-- reproduced here. It was a `replace()` naming the address, and this file is
-- committed to a repo whose commit messages are public raw material: writing
-- the address into the permanent git record to document removing it from the
-- database would be a strange way to honour the rule. Verified afterwards by
-- scanning every row of agent_runs for an address pattern: zero matches.
--
-- It is not reproducible on a fresh database in any case. A fresh database has
-- no such row. This is historical data cleanup, not schema, and the durable
-- fix is upstream: roles/tidy/instructions/spec.md now says to report
-- "[recorded in the work log]" in place of any address or phone number, with
-- the reasoning and the date attached.
--
-- ONE MECHANICAL GUARD CONSIDERED AND REJECTED, so nobody adds it later
-- thinking it was overlooked. A trigger could scrub any incoming summary or
-- detail matching an address pattern, which would satisfy the estate's own test
-- that a rule needing a human to remember it has already failed. It is not
-- worth it here: SQLite has no regex, `LIKE '%@%.%'` matches ordinary prose
-- like "3 of 5 @ 20%. Next run...", and a run report is how an agent proves it
-- is alive. A guard that silently mangles reports, or worse rejects them, would
-- trade a rule violation for a watcher that cannot tell working from dead.
--
-- One published business address is not a crisis. The pattern is, and this is
-- the session that noticed, because Mailroom reads mail from people. If it
-- reported the way Tidy did, every run would copy a correspondent's address
-- into a second database they never wrote to — and unlike a listing's public
-- support address, those belong to individuals. Its spec forbids it explicitly.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 2. Mailroom
--
-- Registered `planned`, not `active`, and deliberately so. Email Routing on
-- patriot.directory is not finished — there is no MX record on the zone, which
-- means no message can physically arrive — so an active row would be claiming a
-- liveness nothing can demonstrate. It becomes active when mail can reach the
-- intake worker, and not before.
--
-- Daily is right even though the inbox is empty today. A run that finds nothing
-- reports 0 of 0 in seconds, and the value of that is that the whole path —
-- token, spec, control switch, API, report — is exercised on quiet days. The
-- alternative is discovering it broke on the same day the first real message
-- arrives.
--
-- ON A WORKER THAT IS NOT REGISTERED HERE. `machine-email-intake` is deployed
-- and has been since 2 September, and it is not in this registry. That looks
-- like a Law 1 violation and is a deliberate omission instead: it has no
-- schedule, it fires only when a stranger sends mail, and absence-detection
-- cannot distinguish "broken" from "nobody wrote today". A row with
-- expected_every_minutes NULL is never flagged, so it would be a row that does
-- nothing while implying something is watched.
--
-- The real check on that worker is this one. Once routing is live, Mailroom
-- reporting 0 of 0 every day for weeks is the signal — either no mail is
-- coming, or the worker stopped filing it, and both are worth a look. That is
-- a coverage number doing its job rather than a registry row pretending to.
-- ---------------------------------------------------------------------------

INSERT INTO registry
  (key, entity, role, property, room, source, schedule, expected_every_minutes, status, notes)
VALUES
  ('directories:mailroom', 'directories', 'mailroom', 'patriot', 'field', 'routine',
   'daily, 12:10 ET', 1440, 'planned',
   'Triages inbound mail into staged changes, tickets and candidates. Sends nothing and drafts nothing: draft_to_outbox stays none until a correspondence voice guide exists, because patriot/voice/tone.md governs listing copy and says nothing about writing to a person. Yellow tier is a fill only — an empty field, from a sender who passed DMARC and matches the address on the listing. Anything already set is staged for a human, however plausible the request, because a forged fill reverts to nothing and a forged overwrite destroyed something somebody chose. Blocked on Email Routing: the zone has no MX record, so nothing can arrive yet.');

UPDATE registry SET timezone = 'America/New_York', local_time = '12:10', cron_utc = '10 16 * * *'
  WHERE key = 'directories:mailroom';
