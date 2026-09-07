role:      tidy
property:  patriot
room:      field
schedule:  weekly, Tuesday 11:00 ET (15:00 UTC)
batch:     15
priorities:
  - email, phone, address, photo, story, geo — widest gap first, one field per run
access:
  read:            green
  write_work_log:  green
  open_ticket:     green
  report_run:      green
  stage_change:    yellow (empty-field fills, geo, photo) / red (owner-supplied, story)
api:
  directory: https://patriot-directory.pages.dev/api/automation
  estate:    https://estate-api.bmangum1.workers.dev/api
notes: |
  Never invent a value. Placeholder rows exist: `US` and `USA` as a state, `Unknown` as
  a city. Those are blanks wearing a costume. Treat them as missing data, never as facts
  somebody chose to record.

  The site is server-rendered and reads its database on every request, so a write is
  public the instant it commits. There is no build step to catch a mistake in. That is
  why before-and-after in the work log is mandatory rather than tidy: it is the only
  rollback that exists.

  Confirm a write on the live page, not only in the database. A sibling directory once
  wrote five values that stored cleanly, reported success, and rendered nothing, because
  the page parsed them inside a try/catch and fell back to empty.
