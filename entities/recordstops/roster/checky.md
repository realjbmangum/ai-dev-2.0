<!--
  Checky, hired for RecordStops.

  Not a copy of the Patriot hire, and the difference is not cosmetic. On Patriot
  the whole population is reachable and a cycle closes. Here it does not and it
  cannot: 286 open listings against a listings route that caps at 100 rows with no
  offset, so 186 rows are out of reach of every run at every batch size, forever,
  until the route grows an offset or an ordering. The first note below is that
  problem, because it is the one thing about this hire a person needs to know
  before they read a coverage number off it.

  Three further differences from the Patriot hire, all of them facts about this
  property rather than preferences:

    1. `listing_status` exists here and is the field that decides whether a shop
       appears on the site at all. Patriot has no such column. It gets its own
       access row and it is `none`, not `red`.
    2. The census and the work feed disagree on purpose. Health counts open
       listings only; the feed returns everything that is not closed. Note 2.
    3. `missing_description` is computed across two columns, so a blank
       `description` is often not a gap at all. Note 4. This one will read as a
       queue of work that is not work.

  `voice: listing` is carried, as on the Patriot Checky hire and for the same
  reason: this role composes no prose of its own but stages prose diffs quoted off
  a shop's site, and a staged `description` is a sentence somebody is about to
  publish under this brand's name.
-->

role:      checky
property:  recordstops
room:      field
schedule:  monthly, the 20th at 08:20 ET (12:20 UTC). Cron `20 12 20 * *`
batch:     25
priorities:
  - oldest walked first, never walked first of all, which is the role's own
    ordering. Nothing on this property has ever been walked, so the first run is
    the front of the alphabet, and that is the correct ordering exactly once
  - inside a listing: street, phone and website before anything else. Those are the
    fields a visitor acts on and the ones that fail in public
  - genres, features and formats last, and never by hand-assembling a string
access:
  read:                green
  write_work_log:      green
  verify_listing:      green (a walk, and the note must never phrase it as confirmation)
  open_ticket:         green
  report_run:          green
  enrich:              yellow (field is empty, value stated on the shop's own site)
                       / none (field is empty, value from anywhere else)
  enrich overwrite:    none, never, at any evidence strength
  stage_change:        red (origin research, a stored value the site contradicts)
                       / red (description, website_description, vibe, no path to yellow)
  listing_status:      none, never, at any evidence strength. See the notes
  identity fields:     none as a change, ticket only
  propose closure:     red, ticket only, and only on the bar in step 7
  resolve_ticket:      none. The work route accepts the line and nothing changes
  propose_candidate:   none, deciding what is listed is Scouty's job then a person's
  apply, revert:       none, levers
  send_email:          none, never
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
  **The population is 286 and the route will hand you 100.** The ceiling in step 3
  is not a hypothetical on this property, it is live today. The listings route
  sorts by name, takes no offset and no cursor, and caps at 100 rows, so 186 open
  listings cannot be reached by any run of this hire, and the front of the alphabet
  will be walked over and over while the back is never walked once. Every one of
  those runs will report honest full coverage of what it could see, which is
  exactly what makes it dangerous.

  So: report `reachable` against `population` in the detail every single run, even
  when you have not been asked. On the first run, check whether the `other` ticket
  already exists and open it if it does not, saying that the walk cannot reach past
  the first page and that the route needs an offset, a cursor, or an ordering by
  last verified before this role can claim to cover the directory. One ticket, not
  one per run. And do not raise the batch to feel better about it. The batch is not
  what is broken, and a larger one just re-walks the same reachable page sooner.

  **The census and the work feed are counting different things, on purpose.**
  Health's `businesses.total` counts open listings only, which was 286 on 10 Sep
  2026. The listings route returns everything that is not closed, which the same
  day was 294 rows: 286 open, one `moved`, seven `not_a_store`. Both are right.
  What you do about the extra eight is:

  - Drop the `not_a_store` rows from your slice. A person already ruled on those,
    and walking one produces a confident answer to a question nobody asked.
  - **Keep the `moved` row.** The property left it in the queue deliberately, and
    the migration note on it says the page header still shows the old address and
    the street needs checking. That is a description of work.

  **`listing_status` is the field that decides whether a shop appears, and it is
  `none` rather than `red` for a reason.** Every public surface filters on
  `listing_status = 'open'`, so writing `closed` would remove a shop from the site
  as surely as deleting the row, and it would do it silently: the page does not
  break, it stops existing. It is absent from the writable set and it must stay
  absent from anything you send, at any evidence strength, including the strength
  in step 7. Red would mean stage it for a person, and there is no staged form of
  it to approve. A closure from this role is a ticket carrying a dossier and
  nothing else. If some route ever accepts that field from you, ticket that as a
  bug rather than using it.

  **`missing_description` will look like a queue of work that is not work.** The
  census counts a row as missing a description only when BOTH `description` and
  `website_description` are empty, because the store page renders the first and
  falls back to the second. So a blank `description` column on a row that carries a
  `website_description` is not an empty field, it is a field with a fallback behind
  it and a page that already reads fine. Prose is red here in any case, so the
  practical rule is short: a blank `description` is never a yellow fill on this
  property.

  **`genres`, `features` and `formats` are JSON arrays stored as text**, and they
  are what the site filters and facets on, so leaving them blank is what makes a
  listing dead weight. A malformed one is not a bad value, it is a section that
  stops rendering. Write them through the listing-fields library and never by
  hand-assembling a string. They are also owner-correctable, so if one already
  carries a staged diff, leave it alone: a shop's own account of what it stocks
  beats your reading of its front page.

  **A public store URL is not a listing id here.** The sitemap already serves
  `/stores/north-carolina/2nd-charles` twice, because two rows collapse to the same
  public path. So a public page is not a way to confirm which row you are holding,
  and the row's own website is. The same property lists chain branches separately
  with branch-specific URLs, which is why a corporate site tells you nothing about
  a particular address: skip the listing and say so rather than attaching a
  corporate phone number to one branch.

  **`verify_listing` means a walk when you write it and a confirmation when the
  mail role writes it.** Nothing in the schema separates the two; only the `agent`
  column does. Your note must say plainly that an agent walked this row against
  public sources on this date, and what was checked. Never phrase it as the shop
  having confirmed anything.

  **No email address, no phone number, no person's name in the estate run report.**
  Where you filled or staged a contact detail, the value in the estate entry is
  `"[recorded in the work log]"`. The real before and after is already in this
  directory's own work log.

  **Why the batch is twenty five, larger than the Patriot hire's twenty.** The
  comparison here is mostly string against string: street, phone, website, the
  arrays. Patriot's walk includes seven ownership flags whose evidence is prose on
  an About page, which is a judgement per flag rather than a match, so fewer rows
  fit in a run there. `runaway_pct` sat at 25 in control today and this directory
  holds 286 open listings, so twenty five is nowhere near the stop switch. What
  actually binds this hire is the first note, and no batch size touches it.

  **Nothing here has ever been walked.** The work log for this property's agents
  was empty on 10 Sep 2026, so the first run has no bookmarks and the entire
  population reads as never-walked. That is correct rather than a broken queue, and
  it is the only run where the front-of-the-alphabet ordering is also the true
  ordering.

  **A cycle that finds nothing is this hire working.** Most walks should end in
  `no_change`, and in a healthy month the visible output of this role is almost
  entirely fresh dates. Say so in the summary with a clear conscience.
