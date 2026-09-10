role:      reachy
property:  null
room:      field
schedule:  weekly, Monday 08:40 ET (12:40 UTC)
account:   @RealJBMangum
batch:     6
stale_after: 30 days
readings:
  - followers_total      the count shown on the public profile, https://x.com/RealJBMangum
  - followers_verified   the verified subset of that count, X Creator Studio
  - impressions_90d      qualified Home Timeline impressions from verified users over the
                         trailing 90 days, X Creator Studio
  - premium_tier         which Premium tier, if any, is currently active on the account
  - posts_last_7d        originals and replies posted in the week, counted separately,
                         from the profile timeline
  - program_rules        the monetization program that currently exists and the thresholds
                         it sets, read live from help.x.com
priorities:
  - an unread number is written `unread`, never `0`, and never a figure somebody remembers
  - a carried reading keeps the source and the date it was true, never today's date
  - a table of unread rows, each with a reason and a next step, is a finished report
access:
  read:                green
  draft_reach_report:  green, always lands at needs_review
  report_run:          green
  post, reply, follow: none, never
  publish:             none, the report ends at a human
api:
  estate: https://estate-api.bmangum1.workers.dev/api
# No voice guide, and that is a decision rather than an omission.
#
# Every drafting hire in this estate names a surface here and is hard-stopped if no
# guide is published for it, because agents draft freely and the guide is the only
# thing between "freely" and "badly". Reachy writes a table of numbers and the
# sentences that say where each one came from. There is no register for a guide to
# govern, and its safety system is a different one: it may write down only what it
# read, with the source and the date attached.
#
# The key is COMMENTED OUT on purpose and must stay that way. Spec composition reads
# the first line matching `voice:` and treats whatever follows as a surface to look
# up. Writing the word "none" as the value would send it looking for a guide called
# "none", find nothing, and paste a STOP instruction into this hire's composed spec
# telling it to write nothing and report the run as failed. Every week. A commented
# line is read by the person reviewing this file and ignored by the parser, which is
# the only way to say "deliberately absent" in a format that has no word for it.

notes: |
  WHY MONDAY MORNING, AND WHY 08:40.

  A metrics report is worth reading when there is a full week of posting behind it and
  a week of posting ahead of it, and Monday is the only day where both are true of the
  same reading. Filed at 08:40 ET it is sitting in the queue before the morning clear,
  and the one thing it asks for can be acted on across the whole week rather than
  landing on a Friday, when the account is quietest anyway.

  The slot is also free, which matters more than it sounds. Loggy runs daily at 13:10
  UTC, the two directory Mailrooms daily at 16:10 and 16:25, Tidy on Tuesday and
  Wednesday at 15:00, Blogy on Saturday at 13:00. Monday 12:40 UTC collides with none
  of them and is far enough from Loggy's 13:10 that a line in the run log at that
  minute is unambiguous about who wrote it. The budget rule is untouched: exactly one
  drafting role runs daily, this is weekly, and it adds one item to one morning.

  WHAT THIS CAN ACTUALLY READ, WHICH IS ALMOST NOTHING, AND WHY IT IS SPECIFIED ANYWAY.

  A routine runs headless. It has account-level connectors and HTTPS, no browser
  session, no cookie jar, and no way to be logged in as anybody. Against that, here is
  the honest state of the six readings above, so nobody has to discover it a run at a
  time:

  `followers_verified`, `impressions_90d` and `premium_tier` live behind Creator
  Studio and account settings, which require an authenticated session. They are not
  obtainable headlessly and there is no trick that changes that. Expect `unread` on
  all three, every week, until somebody types them in.

  `followers_total` and `posts_last_7d` come off the public profile, which X has not
  served to logged-out clients in a usable form for years. A fetch is likely to return
  a login interstitial or an application shell with no numbers in the markup. The
  reading is attempted anyway, once, because the evidence bar in the spec makes an
  ungrounded number impossible to record: it has to quote the URL and the text it read
  the value in, and a login page contains neither. If X ever serves the profile again
  the readings start working with no edit to anything.

  `program_rules` is the one row with a real chance. help.x.com is a public help
  centre and does not need a session. It is also the row that matters most, because
  every "on pace" sentence in the report is a claim about a threshold, and the account
  has already lived through one program being replaced: the previous bot recorded a
  change around 7 September 2026 and warned that any threshold remembered from before
  that date was suspect. So the rules are a first-class reading with their own as-of
  date, and when they are unread every threshold under them is unread too.

  There is no X connector at the account level and the estate holds no X API
  credential. The free API tier does not return another account's audience metrics,
  and a paid tier is a purchase decision rather than a build step, so nothing here
  assumes one exists.

  WHY A LIST OF MOSTLY UNREACHABLE READINGS IS NOT A BROKEN SPEC.

  Because coverage counts verdicts, not numbers. `expected` is 6, the length of this
  list, and `actual` is 6 on any week the run reaches a verdict on all six, where
  "unread, login wall, https://x.com/..." is a complete verdict. A week where nothing
  at all could be read is 6 of 6 with `ok: true`, no finding, and a report that says in
  plain words which instrument is broken and what would open it.

  Had coverage counted numbers obtained, this role would report 0 of 6 every Monday,
  the watcher would open an `undercovered` finding against a run that did its job
  perfectly, and it would reopen every week forever. That is the exact shape of a
  routine nobody reads any more, and it is worth saying out loud here because the
  numbers look wrong at first glance and somebody will eventually want to "fix" them.

  THE PREDECESSOR, AND WHY ITS FILES ARE NOT AN INPUT.

  A grok bot called Reach did this job until it was deleted. It wrote one markdown file
  per run to `growth/YYYY-MM-DD.md` in `realjbmangum/jbmangum-inbox`, and it is where
  the rule at the top of this file comes from: it already said `[unknown]` is stored as
  "not visible" and displayed as "not visible", never as zero, because zero is a claim
  about the account and unknown is a claim about the bot's eyesight.

  Those files still exist and Reachy deliberately does not read them. Every reading in
  them carries a date, so each is still a true fact about the day it was taken, and a
  person seeding the first ledger by hand from the newest one would be doing something
  reasonable. A weekly agent re-reading a frozen directory is doing something else
  entirely: the newest file never changes, so the same figure would be carried forward
  every Monday, ageing quietly while looking exactly like a fresh reading. That is the
  failure this whole role is built against, arriving through the back door.

  Reach also lost two things worth naming. Its output shape was strict because a
  machine parsed the file, so it ran seven fixed sections whether or not there was
  anything to put in them. Nothing parses this report now, a person reads it, so it
  runs four sections and the biggest one is usually the list of what could not be seen.
  And it wrote to a git repo, which meant its record lived somewhere the rest of the
  fleet could not see: this one files into the estate's own draft queue, where it is
  one item in the same morning list as everything else.

  THE ONE THING NOT RESOLVED, AND IT IS THE ONE THAT MATTERS.

  There is currently no place for a human to file a reading. He can see the numbers in
  ninety seconds on his phone, and there is nowhere to put them, which means the ledger
  can only ever fill up from sources that are closed.

  Two mechanisms already exist and both are wrong. An admin `POST /api/runs` under this
  key would carry the numbers in `detail` and Reachy could read them back, but it also
  writes `last_run_at` on the registry row, so a human pasting numbers would silence
  the watcher for this key for a week, and a Reachy that had actually died would look
  alive. An admin `POST /api/drafts` is invisible to Reachy, because an agent sees only
  drafts written under its own registry key and an admin draft is written under
  `admin`. Neither is worth adopting to avoid building the right thing.

  The right thing is small: somewhere a reading can be written with a value, a source
  and an as-of date, which Reachy can read and which nothing mistakes for a heartbeat.
  It is not built, it is not assumed anywhere in the spec, and until it exists this
  role's honest weekly output is a report about the instruments. That is still worth
  having, because "nothing in this estate can see this account" is a fact somebody can
  act on, and it was not visible before.

  BEFORE THIS CAN RUN.

  The registry row `jbmangum:reachy` exists as `planned` with
  `expected_every_minutes` already set to 10080. It needs its schedule, `local_time`,
  `timezone` and `cron_utc` written so the daylight-saving drift check can see it, an
  agent token issued with `bash scripts/issue-agent-token.sh jbmangum:reachy`, and
  promotion to `active` only after a real run reports. Nothing here promotes itself.
