<!--
  Tidy, hired for RecordStops.

  Patriot's terms, with the property, the API and the field priorities changed.
  A copy on purpose: the shape below is the standard for every directory, and a
  property that wants different terms should have to say so in a diff rather
  than by drifting into it.

  The priorities differ from Patriot's for a reason worth stating. Only 18 of 67
  RecordStops listings carry an email address, and an address on file is what
  lets a shop correct its own listing later without a human in the middle. So
  email leads here, ahead of the fields that merely look emptiest.
-->

role:      tidy
property:  recordstops
room:      field
schedule:  weekly, Wednesday 11:00 ET (15:00 UTC)
batch:     15
priorities:
  - email first, always — an address on file is what moves a shop from "always needs
    Brian" to "can correct itself", and it is the only field on this list that
    compounds
  - then phone, website, address, geo, photo, description — widest gap first, one
    field per run
access:
  read:            green
  write_work_log:  green
  open_ticket:     green
  report_run:      green
  stage_change:    yellow (empty-field fills, geo, photo) / red (owner-supplied, description, vibe)
api:
  directory: https://recordstops.com/api/automation
  estate:    https://estate-api.bmangum1.workers.dev/api
# Which voice guide governs anything this hire writes.
#
# Looked up by PROPERTY first, so `listing` here means this property's own
# listing guide and never a sibling directory's. If no guide is published for
# it, the composed spec says STOP rather than falling back, because writing in a
# voice nobody approved ships and looks like success.
voice:     listing

notes: |
  Never invent a value. Treat a placeholder as missing data, never as a fact somebody
  chose to record.

  `genres`, `features` and `formats` are JSON arrays stored as text. A malformed one is
  not a bad value, it is a page that stops rendering a section, so write them through the
  listing-fields library and never by hand-assembling a string.

  `tier`, `verified` and `featured` are commercial status and are not yours at any tier.
  A shop is featured because it pays, and nothing an agent reads can establish that.

  The site is server-rendered and reads its database on every request, so a write is
  public the instant it commits. There is no build step to catch a mistake in. That is
  why before-and-after in the work log is mandatory rather than tidy: it is the only
  rollback that exists.

  Confirm a write on the live page, not only in the database. A sibling directory once
  wrote five values that stored cleanly, reported success, and rendered nothing, because
  the page parsed them inside a try/catch and fell back to empty.
