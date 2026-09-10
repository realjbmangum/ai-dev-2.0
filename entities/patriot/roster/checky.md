<!--
  Checky, hired for Patriot.

  Not a copy of its RecordStops sibling. The single biggest term in a walker's
  hire is whether its cycle can close, and the answer is opposite on the two
  properties. Patriot held about 80 listings on 10 Sep 2026 and the listings route
  caps at 100 rows, so every listing here is reachable and a cycle genuinely
  closes. RecordStops holds 286 against the same 100-row cap, so 186 of its rows
  cannot be reached by any run at any batch size. That difference drives the batch,
  the priorities and most of the notes, and it is the reason these two files should
  never be edited by copying one over the other.

  Two more differences worth naming at the top so nobody reads them as drift:

    1. This property has no `listing_status` column, nowhere to record that a
       listing is gone, and no closure filter on the listings feed, because there
       is nothing to filter on. Its sibling has all three.
    2. This property's listings carry seven ownership flags. Its sibling has none
       and describes a shop with genre arrays instead. Those flags are the real
       work here and they have their own rule in the notes.

  `voice: listing` is carried, unlike the Scouty hires. Checky composes no prose of
  its own, but it stages prose diffs quoted off a business's site, and a staged
  `story` or `short_description` is a sentence somebody is about to publish under
  this brand's name. Having the guide in front of the agent is the difference
  between staging a quote that belongs here and staging one that reads like
  marketing copy.
-->

role:      checky
property:  patriot
room:      field
schedule:  monthly, the 6th at 08:20 ET (12:20 UTC). Cron `20 12 6 * *`
batch:     20
priorities:
  - the ownership flags first. They are the only fields on a listing here that make
    a claim rather than record a detail, and this directory was seeded from a viral
    social thread, so a flag may never have been read off the business's own page
    by anybody
  - then the fields that fail in public: website, street_address, phone
  - genuinely nothing on closure, because there is nowhere to record it. See the notes
access:
  read:                green
  write_work_log:      green
  verify_listing:      green (a walk, and the note must never phrase it as confirmation)
  open_ticket:         green
  report_run:          green
  enrich:              yellow (field is empty, value stated on the business's own site)
                       / none (field is empty, value from anywhere else)
  enrich overwrite:    none, never, at any evidence strength
  stage_change:        red (origin research, a stored value the site contradicts)
                       / red (story, short_description, with no path to yellow)
  identity fields:     none as a change, ticket only
  propose closure:     red, ticket only, and only on the bar in step 7
  resolve_ticket:      none. The work route accepts the line and nothing changes
  propose_candidate:   none, deciding what is listed is Scouty's job then a person's
  apply, revert:       none, levers
  send_email:          none, never
api:
  directory: https://patriot.directory/api/automation
  estate:    https://estate-api.bmangum1.workers.dev/api
# Which voice guide governs anything this hire writes.
#
# Looked up by PROPERTY first, so `listing` here means this property's own
# listing guide and never a sibling directory's. If no guide is published for
# it, the composed spec says STOP rather than falling back, because writing in a
# voice nobody approved ships and looks like success.
voice:     listing

notes: |
  **There is nowhere on this property to record that a listing is gone.** No
  `listing_status` column, no closure filter on the listings feed, and the health
  census counts every row because there is no lifecycle to exclude. So the ticket
  in step 7 is not the preferred shape of a closure here, it is the only shape that
  exists, and there is no field left to be tempted by at three in the morning. Say
  so inside the ticket when you open one. The person reading it is choosing between
  deleting the row, hiding it by hand and leaving it, and they should not have to
  discover that themselves.

  **The whole directory is reachable, and that fact has an expiry date.** The
  listings route caps at 100 rows with no offset and no cursor, and this directory
  held about 80 on 10 Sep 2026. So a cycle here actually closes, which it does not
  on the sibling property. The moment the total passes 100 that stops being true
  silently: the front of the alphabet gets walked forever, the back never gets
  walked once, and every individual run goes on reporting honest full coverage
  while it happens. Compare `businesses.total` against the number of rows the route
  actually hands you, every run, and open the ticket step 3 describes the first
  time they differ. Do not wait to be told.

  **The ownership flags are the real work here, and they need a rule of their
  own.** They are `veteran_owned`, `woman_owned`, `family_owned`, `immigrant_owned`,
  `made_in_usa`, `ships_nationwide` and `brick_and_mortar`. Three cases and they do
  not go the same way:

  - Empty, and the business says it plainly in its own words on its own site: that
    is a fill, and it is the good case.
  - The row says yes and the site says nothing at all: **this is not a
    contradiction and it is not a staged no.** It is the closure rule in a smaller
    costume. Absence of a claim is not evidence the claim is false, and plenty of
    family-owned businesses never mention it on a website. Where it matters, that
    is a ticket, or it is nothing.
  - The row says yes and the site says something incompatible, "manufactured in
    Vietnam" against `made_in_usa`: red, staged, with the URL and the sentence.

  The reason to be careful is that the claim on the card is this directory's whole
  proposition. A wrong flag is the one error here a visitor would call a lie rather
  than a mistake.

  Note also that these flags are owner-correctable, so the mail role can stage them
  from an owner's own email. Two writers on one field. If a flag already carries a
  staged diff, leave it alone: the owner's account of their own business beats your
  reading of their About page every time.

  **`story` and `short_description` are red on this property even when empty.**
  They are writable and they are deliberately not owner-correctable, which is the
  gap that tells you what they are: prose the directory publishes about a business.
  There is no path to yellow for them, an empty one is not a blank to fill, and the
  site is server-rendered with no build step between a write and a stranger reading
  it.

  **`verify_listing` means a walk when you write it and a confirmation when the
  mail role writes it.** Nothing in the schema separates the two; only the `agent`
  column does. Your note must say plainly that an agent walked this row against
  public sources on this date, and what was checked. Never phrase it as the
  business having confirmed anything, because somebody reading the log later will
  believe it.

  **No email address, no phone number, no person's name in the estate run report.**
  Where you filled or staged a contact detail, the value in the estate entry is
  `"[recorded in the work log]"`. The real before and after is already in this
  directory's own work log, which is where anyone auditing the change would look.

  **Why the batch is twenty.** Eighty listings on a monthly run is four runs to
  close a cycle, so every listing is walked roughly three times a year and the
  calendar tells you which month. Twenty also keeps a single run's possible changes
  at or under `runaway_pct` of the directory, which sat at 25 today, rather than
  relying on most walks being quiet to stay under it. Read both numbers at run
  time; the eighty is a snapshot and the database is not.

  **A cycle that finds nothing is this hire working.** Most walks here should end
  in `no_change`, and in a healthy month the visible output of this role is almost
  entirely fresh dates. The pressure runs the other way, so it is worth saying in
  the hire as well as in the template: nothing in the run report rewards a finding,
  and a weak observation promoted into a correction is how a directory somebody
  assembled by hand gets quietly degraded by a machine that was trying to help.
