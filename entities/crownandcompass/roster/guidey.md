role:      guidey
property:  null
room:      field
schedule:  weekly, Tuesday 09:00 ET (13:00 UTC)
batch:     1
book:      killing-kryptonite
book_confirmed:  UNCONFIRMED. Nobody has dated this. See notes.
priorities:
  - one week of the guide per run, sourced or honestly blank, never improvised
  - the men read this out loud to each other, so every line has to survive being checked
access:
  read:                 green
  draft_field_guide_week: green, always lands at needs_review
  report_run:           green
  write_book_database:  none, no credential, and it could not read the row back
  set_guide_status:     none, that gate is the application's and a human's
  choose_next_book:     none, the hire names it
  publish:              none
  repository:           none, no commit, no branch, no page generation
  send_email:           none, never
api:
  estate: https://estate-api.bmangum1.workers.dev/api
guide:
  crownandcompass/blog: https://estate-api.bmangum1.workers.dev/api/guides/crownandcompass/blog
# Which voice guide governs anything this hire writes.
#
# `blog` is the only guide registered for crownandcompass, and that guide calls
# itself the master guide covering every surface, including long form work. It
# is the right guide today. If a surface specific to study material is ever
# registered, move this line to it.
#
# `property` must stay null. Crown and Compass registers under its entity key,
# and a property value would send the lookup somewhere with no guide behind it,
# which composes a STOP block instead of a voice.
voice:     blog

notes: |
  Tuesday morning, so an approved week is in his hands before the Wednesday meeting
  rather than after it. It does not land on Loggy's day, on the interview's day, or on
  the writer's day: the whole point of one thing per day is that the queue stays inside
  five to ten minutes.

  batch is 1 and it means one WEEK of the guide, not one guide. Six weekly runs complete
  a book. That cadence was chosen over one big run every six weeks for two reasons: a
  routine that fires every six weeks is nearly invisible to the watcher, and six drafts
  arriving at once is six decisions in one morning, which is most of a day's budget spent
  on one thing.

  COVERAGE HERE IS CUMULATIVE AND THAT IS DELIBERATE. expected is 6, always, because a
  field guide is six weeks. actual is how many of those six now exist as drafts. So a
  good run reports something like 4 of 6, and it must never be written up as a two thirds
  failure. The shape exists to catch the opposite case: 1 of 6 week after week means the
  role has stopped advancing, and a per run count of one out of one would report perfect
  health while a guide sat frozen for two months. That is the same failure the estate's
  second law was written for.

  THE BOOK NAME ABOVE IS NOT CONFIRMED. It is taken from a project note, not from the
  live database, and nothing on disk in the site repository states which book is current.
  Somebody with access to the application must confirm it and date this line before the
  first real run, and the role is told to flag a stale or missing confirmation rather
  than proceed quietly. A status with no date beside it is not a fact.

  The week number is NOT on this hire, on purpose. It is computed by the role from its
  own drafts, because a week number here would need editing every seven days and would
  drift inside a month. Draft titles follow "<book-slug> week <N>: <title>" and that
  convention is the only thing telling the role where it is, so it is load-bearing rather
  than cosmetic. A rejected week is rewritten, not skipped.

  IT HAS NOT READ THE BOOK, and the role is built around that. Commentary about the text
  is the only part of a week that needs an outside source, and the rule is that it comes
  from something fetched that run and cited by URL, or it is left blank with a reason. A
  fluent paragraph about a well known Christian book, with a real author's name on it, is
  the most convincing wrong thing this role could produce, and nobody skimming would
  catch it. Scripture is fetched before any question is written about it, for the same
  reason.

  It cannot write to the book's own database, and that is not a trust judgement. The
  public guide page is generated from a published row by a script that reaches the
  database through a deployment credential a scheduled routine does not hold. A role that
  wrote where it cannot read back would have mistakes invisible to itself and to the
  watcher. So the week lands in the estate queue it can see, and a human carries it
  across into the application, where a second status column still decides whether a
  public page exists at all.

  UNRESOLVED, and the role is told to say so rather than guess: the stored document has
  one flat questions list and no prayer field, while the one guide that has actually
  shipped separates questions about the text from questions about the life and ends each
  week with a prayer. Whether the application enforces that separation cannot be
  established from the site repository. The role writes both groups plus the prayer,
  labels them plainly, and reports the mapping as needing a human who can see the
  application's schema.

  For whoever writes the registry row: weekly, so expected_every_minutes is 10080.
