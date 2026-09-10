role:      designy
property:  null
room:      field
schedule:  weekly, Saturday 11:00 ET (15:00 UTC)
batch:     6
priorities:
  - candidates decided is the unit of work, and a drop is a decision
  - when unsure, produce fewer concepts rather than weaker ones
  - the objects come out of the verse's own words, never out of the theme
access:
  read:            green
  draft_email:     green, one draft, addressed to the account's own mailbox
  report_run:      green
  generate_image:  none, prompts only, never art
  send_message:    none, never
  read_mailbox:    none, the memory comes from its own run reports
  write_draft_row: none, this role writes to no database but the run log
  publish:         none, objects end at a human
api:
  estate: https://estate-api.bmangum1.workers.dev/api
guide:
  crownandcompass/apparel, the design grammar, appended to the composed spec
  crownandcompass/blog, fetched by the role for label copy only
# Which published guide governs what this hire makes.
#
# `apparel` rather than `blog`, and the choice is load-bearing. The design
# grammar says of itself that voice governs sentences and it governs objects,
# and this hire makes objects. The blog guide is written for letters of three
# hundred to fifteen hundred words and carries tone spectrums, platform
# adaptations, reply patterns and a crisis protocol. An agent handed that as the
# thing governing a garment produces shirt copy reading like a blog opening,
# which is a failure nobody would be able to name while reviewing it.
#
# The lookup is by property first and entity second. This hire carries
# `property: null` on purpose so it resolves to `crownandcompass`, which is
# where the guides index registers this brand. Setting a property here without
# registering a guide under that key in the same edit moves the lookup to a key
# with nothing behind it and composes a STOP block instead of the grammar.
#
# AS OF WRITING NO `crownandcompass/apparel` GUIDE IS PUBLISHED, so this hire
# composes a STOP block and will refuse to draft. That is the system working,
# not a defect to route around. Publishing it is one entry in guides.json
# pointing at brand/design-grammar.md in the Crown and Compass site repository,
# and a sync. Do not paper over it by switching this line to `blog`.
voice:     apparel
cycle:
  book:      unset
  confirmed: never
  length:    42 days

notes: |
  Saturday 11:00 ET, which is where this already runs and where the registry already has
  it. Keeping the slot is the point: this hire registers a routine that has been producing
  concepts for a while, and moving its time in the same change that brings it into the
  estate would leave any later difference in what arrives with two possible causes.

  Saturday also holds Blogy at 09:00 ET, so two weekly drafting roles land on one day
  rather than each on its own. It stays that way because the budget that binds is
  decisions per day, not roles per day. Saturday's queue is one blog draft and one email
  holding at most three concepts: two things to open, a handful of verdicts. Moving this
  to a weekday would add a creative review to a day already carrying the daily judging and
  the two directory Mailrooms, and would separate the two pieces of work most worth
  reading side by side, both being the week's proposals in a brand's own voice.

  Intended local time is 11:00 and the cron is 15:00 UTC. They agree from March to
  November and stop agreeing when the clocks change, and nobody has to remember that: the
  registry stores the intent beside the fact and the watcher opens a schedule_drift
  finding naming the cron that would fix it.

  Batch 6 is the shortlist, not the output. Six candidates examined, at most three drafted,
  and the run reports six of six whenever all six were decided, including weeks that ship
  nothing. Six is low enough that filling the shortlist is never the hard part, so a run
  reporting fewer than six decided means the run was abandoned part way rather than that
  the week was thin.

  The cycle block is deliberately unset rather than filled in. A book title was available
  from a source carrying no date, and writing it here would hand the first run an
  unverified fact to aim a week of work at, in a role whose whole discipline is that a
  claim has to be checkable. Set `book` and `confirmed` together in one edit, never one
  without the other. An undated cycle line is worse than an absent one: absent makes the
  agent say `unknown`, undated makes it say the name of whatever book was current the last
  time somebody thought about it.

  Grant the mail connector scoped to `create_draft` alone. It also exposes send, reply,
  forward, trash and spam, and the assumption that it did not is what made an unscoped
  grant look harmless on a different routine. The draft is addressed to the mailbox the
  connector is authenticated as, and no address is ever typed, so an accidental send
  delivers to where the draft already was.

  Never put a person's name or an email address in an estate run report. The output is one
  draft in the owner's own mailbox. A concept is referred to by its handle and a verse by
  its citation, and neither of those is a person.
