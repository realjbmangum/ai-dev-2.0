<!--
  Salesy, hired for Ascend Systems.

  The first hire in the estate for an entity that holds client data, which is why
  the terms below carry more restriction than any other roster file. Everything
  in the access block that reads `none` on a field this role could technically
  fetch is there because the field belongs to a person who never agreed to be in
  a second database.

  ON THE `api: directory:` KEY BELOW, AND WHY IT IS NOT RENAMED.
  `worker/src/routes/spec.ts` fills `{directory_api}` in the role template by
  matching the literal line `directory:` in these terms. The name is a
  directory-machine inheritance from the first two hires, and Ascend is not a
  directory. Renaming this key to something honest, `product:` or `crm:`, makes
  the regex miss, and every call in the composed spec then reads
  "[NO api.directory ON THE HIRE FOR ascend, STOP AND REPORT IT]". The whole run
  fails loudly, which is the good version of that mistake, but it still fails.

  So the key stays wrong on purpose and the trap is documented rather than left
  to be discovered. The right fix is renaming the substitution to something
  property-agnostic in spec.ts and updating all five hires in one change, which
  is a refactor rather than a row, and doing it in the same session as bringing a
  new entity online is how both go wrong.

  The alternative was writing the CRM's hostname into the role template. That is
  the exact defect the Mailroom comment in spec.ts was written about: a literal
  host is invisible while one hire exists and becomes the whole problem on the
  second one.
-->

role:      salesy
property:  null
room:      field
schedule:  twice weekly, Monday and Thursday 09:40 ET (13:40 UTC)
batch:     5
priorities:
  - oldest touched first, always, so a run that stops early handled the most neglected lead
  - a lead you have nothing honest to say to is a skip, not a paragraph
  - counts and ids cross to the estate, names and figures never do
access:
  read:                     green
  draft_outreach:           green, into the CRM, lands at needs_review, always
  stamp_outreach_drafted:   green, records a draft was written, never that one was sent
  report_run:               green, counts, integer ids and one link
  write_draft_to_estate:    none, the draft is client data, that database holds none
  set_lead_status:          none, status, owner, notes and labels are a human's
  read_contact_details:     none, email, phone, address, linkedin, deal value, close date
  approve, publish:         none, words end at a human
  send_email:               none, never
api:
  # Do not rename this key. See the comment at the top of this file.
  directory: https://ascend-api.bmangum1.workers.dev/api/automation
  estate:    https://estate-api.bmangum1.workers.dev/api
# Which voice guide governs anything this hire writes.
#
# Looked up by PROPERTY first and entity as the fallback, so with property null
# this resolves to the `ascend` guides. `client-facing` is the surface the
# published guide names in its own front matter, and it is the register for
# writing TO a client rather than about the company.
#
# If no guide is published for it, the composed spec says STOP rather than
# falling back, because writing in a voice nobody approved ships and looks like
# success. That is currently the live state: the guide exists at
# realjbmangum/ascend-systems brand/voice.md and is NOT yet indexed in
# guides.json, so the estate is not serving it and every run of this hire will
# correctly refuse to draft. One entry in guides.json fixes it. See the notes.
voice:     client-facing

notes: |
  THE SCHEDULE, AND WHY IT IS THE ONE ALREADY IN THE REGISTRY.

  Monday and Thursday at 09:40 ET, cron `40 13 * * 1,4`. The registry row already
  carries exactly that as `local_time` and `cron_utc`, set when the intended-local-time
  columns were added, and those two columns are an intent-and-fact pair the watcher
  compares to catch daylight saving drift. Changing the time here for no reason would
  either open a schedule_drift finding against a healthy routine or require touching a
  migration, and neither buys anything.

  The slot is genuinely free. Loggy is daily at 13:10 UTC, thirty minutes earlier and a
  judging role that queues nothing for a human. Blogy is Saturday 13:00, a day this hire
  never runs. The two directory Mailrooms are daily at 16:10 and 16:25. Nothing else in
  the fleet wakes between 13:10 and 15:00.

  It also matches the time this work ran under before the estate existed, so the pipeline's
  own rhythm does not shift as a side effect of registering it here.

  BATCH 5, AND IT IS A REVIEW BUDGET RATHER THAN A RATE LIMIT.

  The whole queue gets five to ten minutes a day, which is roughly ten to fifteen
  decisions. An outreach draft is the most expensive decision in that budget: a person has
  to read a whole message, decide whether it is true, edit it, and then decide to send it
  to somebody who might become a client. That is not comparable to approving an empty
  field on a listing.

  Five per run, twice a week, is ten outreach decisions a week landing on two days that
  otherwise carry only the daily roles. If more leads come back than that, the spec says
  draft the oldest touched five and report how many were left. Clearing the queue in one
  run is the failure that killed the routine this replaces: a queue nobody clears is
  indistinguishable from a routine nobody wanted.

  Note that batch means something different here than in the other hires. Loggy's 50 and
  Blogy's 25 cap what is READ. Five caps what is WRITTEN, and writes are what cost a
  person time.

  THE QUIET THRESHOLD IS TEN DAYS, NOT NINE.

  The registry row's own note, and the desk's design example, both read "3 leads quiet 9+
  days, open the CRM". That sentence was written to demonstrate the shape of a pointer,
  which is the thing this hire is actually about, and it has since been read as a
  threshold. The threshold that was decided is ten days: short enough that a live
  conversation does not go cold, long enough that nobody feels chased. The seven day
  cool-off underneath it is enforced in SQL on the CRM side rather than by this agent's
  judgement, and the query parameter can only lengthen it.

  If somebody wants nine, that is a decision and it changes this line and the spec's
  step 4 together.

  THE VOICE GUIDE IS A HARD DEPENDENCY AND IS NOT SERVED YET.

  `brand/voice.md` in realjbmangum/ascend-systems is the guide, derived 6 September 2026
  from 64 real samples, and its front matter already declares `entity: ascend, surface:
  client-facing`, which is exactly the shape guides.json indexes. It is not in guides.json,
  so `scripts/sync-specs.mjs` does not push it, so the estate does not serve it, so the
  composed spec for this hire carries the STOP block instead of a voice section.

  That is correct behaviour, not a bug in the estate, and it is the ninth hard rule doing
  its job: no drafting role ships before its guide exists. It does mean this hire cannot
  usefully run until one entry is added to guides.json.

  The guide matters more for this role than for any other, because the rules that stop a
  costly draft live in it rather than here: never name another client, never state a price
  or a rate, never invent a result or a timeline, match the length of what you are
  replying to. A draft written against a remembered tone would break all four and read as
  fine.

  THE TOKEN SITUATION IS UNUSUAL AND SOMEBODY WILL BE SURPRISED BY IT.

  Estate calls use this hire's own agent token, which is its identity: the estate refuses a
  run reported under any other key. CRM calls use `AUTOMATION_TOKEN` on the CRM's Worker,
  which is SHARED with that system's other routines. It authorises and does not identify.

  So the CRM cannot tell this hire's writes from another routine's, and the `routine` field
  on each draft is the only attribution that exists over there. A draft filed under the
  wrong routine name disappears from the rejection query the spec reads before it writes,
  which means the feedback loop silently stops working while everything still looks alive.

  POINTER-ONLY IS THE POINT OF THIS HIRE.

  Everything above is detail. The thing that makes this hire different from every other one
  in the estate is that it reads a database full of real people and writes a run report
  that contains none of them. Counts, integer ids, one link. The spec argues that boundary
  at length because the next person to extend this role will want to carry a first name
  across to make the summary readable, and by then this file will be the only thing that
  answered them.
