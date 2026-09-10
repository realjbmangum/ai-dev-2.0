<!--
  Mailroom, hired for RecordStops.

  A copy of the Patriot hire with the property and the API changed, and it is a
  copy on purpose: the terms below are the standard, and a directory that wants
  different terms should have to say so in a diff rather than by drifting.

  WHY THIS LIVES UNDER entities/recordstops/ RATHER THAN entities/directories/.
  The sync keys a hire as <entity>:<role> from its file path, so one entity can
  hold exactly one hire per role. Patriot and RecordStops are both directories,
  so putting this beside Patriot's would have collided and one would have
  silently overwritten the other.

  That is a real disagreement between the code and the PRD, which defines a hire
  as a role instantiated for ONE PROPERTY. The registry keys by entity instead.
  Resolving it properly means renaming four live keys and the four running
  routines that fetch their specs by those names, which is a refactor rather
  than a row, and doing it at the same time as bringing a directory online is
  how both go wrong.

  So this takes the cheap door: RecordStops is its own entity here. It works
  today, renames nothing that is running, and leaves the decision visible rather
  than buried. Recorded as an open question in the PRD.
-->

role:      mailroom
property:  recordstops
room:      field
schedule:  daily, 12:25 ET (16:25 UTC)
batch:     25
priorities:
  - oldest first, always — a queue worked newest-first leaves its oldest item forever
  - claims and reports before enquiries; a person waiting on an answer about their own
    business is the one most likely to give up on the directory
access:
  read:              green
  write_work_log:    green
  triage_inbox:      green
  open_ticket:       green
  propose_candidate: green
  enrich:            yellow (empty field, sender_verified) / none (anything already set)
  stage_change:      red (always staged, never applied)
  draft_to_outbox:   none — until a correspondence voice guide exists
  send_email:        none — never
api:
  directory: https://recordstops.com/api/automation
  estate:    https://estate-api.bmangum1.workers.dev/api
notes: |
  Daily, and cheap when there is nothing there. An empty run reports 0 of 0 and takes
  seconds, which is the point: it proves the whole path is alive on a day when no mail
  came, so the day mail does come is not also the day you find out something broke.

  Read `sender_verified` from the inbox route. Do not compare addresses yourself. That
  one comparison is what the 1 September 2026 verb-tier ruling hangs the yellow tier on,
  and every way of getting it wrong is quiet: a capital letter, a trailing space, a
  display name in angle brackets, a plus-addressed variant that looks close enough.

  `no_dmarc_verdict_recorded` is not a pass. Every message that arrived before September
  2026 looks like that, because nothing was reading Cloudflare's authentication results
  until the intake worker was taught to. Unknown is not verified.

  Only 18 of 67 listings have an email address on file at all. For the other 49 there is
  nothing to validate a sender against, so `sender_verified` can never be true and every
  request from those businesses correctly goes to a human. That is not a bug to work
  around, and it is the strongest argument for the confirmation campaign: each address
  earned moves a business from "always needs Brian" to "can correct itself".

  Never put an email address or a person's name in an estate run report. Refer to a
  message by its inbox id and a listing by its listing id. This is the rule most likely
  to be broken by trying to be helpful, and a sibling role already put one business's
  address into the estate database by reporting a field it had filled.

  The site is server-rendered and reads its database on every request, so a write is
  public the instant it commits. There is no build step between a yellow fill and a
  stranger reading it.
