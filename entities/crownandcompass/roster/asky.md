role:      asky
property:  null
room:      field
schedule:  weekly, Monday 08:00 ET (12:00 UTC)
batch:     5
priorities:
  - a blank page is work, and this role is the one that does it
  - answering must be cheap, or he will not answer, and the week dies quietly
access:
  read:          green
  send_email:    green, to the authenticated mailbox only, never any other address
  report_run:    green
  draft:         none, this role writes no prose for publication
  publish:       none
  repository:    none, no commit, no branch, no pull request
api:
  estate: https://estate-api.bmangum1.workers.dev/api
guide:
  crownandcompass/blog: https://estate-api.bmangum1.workers.dev/api/guides/crownandcompass/blog
# Which voice guide governs anything this hire writes.
#
# Crown and Compass registers under its ENTITY key because it has no separate
# property, so `property` above must stay null. Give this hire a property value
# and spec composition looks the guide up under that key instead, finds nothing,
# and serves a STOP block in place of a voice. The role then reports a missing
# guide that is sitting in guides.json the whole time.
voice:     blog

notes: |
  Monday morning, so the answers have three days to arrive before the writer runs on
  Thursday. He answers from his phone, usually by voice, usually in fragments, and the
  email is written on that assumption.

  batch is 5 and it is the number of prompts, not a queue size. The five have five
  distinct shapes in the spec: two grounded in news, one on the brotherhood, one on his
  own reading in Scripture, one open. Changing this number means changing those shapes,
  so it is not a dial to turn on its own.

  This is the only green send_email in the estate and it survives on one narrow fact:
  the only permitted recipient is the mailbox the connector is already authenticated as.
  It sends from him to him. There is no address in this file, in the role, or in the
  database, so there is nothing for a poisoned page or a crafted article to swap. Scope
  the routine's connector to sending and nothing else. Unscoped, a mail connector also
  carries reply, forward, trash and mark as spam, and none of those belong here. The
  estate has already paid once for leaving a grant wide on the belief that a connector
  could only draft.

  The subject line is a contract. The writer finds this conversation by the leading
  phrase "Blog prompts" and has no other handle on it. Change the wording and the writer
  finds no thread, correctly concludes he did not answer, and writes nothing, and nothing
  anywhere says the subject line was why. That failure is silent in both directions.

  This hire declares a voice guide even though nothing it writes is published. The email
  is prose in the brand's register, and more usefully, a missing guide stops Monday
  loudly three days before it would have stopped Thursday. The cost of that is one unsent
  interview. The alternative is discovering it on the day the post was due.

  It cannot read the writer's rejections. `/api/drafts/rejections` is scoped to the
  calling token and this hire posts no drafts, so its own list is empty forever. That
  means an `already_said` verdict never reaches the questions that caused it. Known gap,
  written into the spec rather than worked around, and the partial answer is that the
  role reads the published titles itself and steers around them.

  For whoever writes the registry row: weekly, so expected_every_minutes is 10080. An
  active row without it is invisible to the watcher, which is the hole this estate exists
  to close.
